const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { imageSizeFromFile } = require('image-size/fromFile');
const probeImageSize = require('probe-image-size');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffprobe = require('ffprobe');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// ffprobe 경로 설정
ffmpeg.setFfprobePath(ffprobeInstaller.path);
// ffprobe 경로 저장
const ffprobePath = ffprobeInstaller.path;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    center: true,
    resizable: true, 
    frame: true,
    backgroundColor: '#121212',
    title: 'RENAMER by HEIMLICH®',
    icon: path.join(__dirname, 'assets/app-icon.png'),
    show: false,
    enableLargerThanScreen: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      disableBlinkFeatures: 'AutomationControlled'
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle internal link clicks
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  
  // Setup rules directory
  const userDataPath = app.getPath('userData');
  const rulesDir = path.join(userDataPath, 'saved-rules');
  
  // Create rules directory if it doesn't exist
  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for file operations
ipcMain.handle('get-file-paths', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  
  if (canceled) return [];
  return filePaths;
});

ipcMain.handle('rename-files', async (event, files, config) => {
  const results = [];
  
  for (const filePath of files) {
    try {
      const dirPath = path.dirname(filePath);
      const fileName = path.basename(filePath);
      
      // Generate new name based on config
      let newName;
      
      // Extract file parts
      const lastDotIndex = fileName.lastIndexOf('.');
      const fileExt = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
      const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
      const index = files.indexOf(filePath);
      
      switch (config.method) {
        case 'pattern':
          newName = config.pattern || '{name}';
          
          // Format sequential number
          const numValue = index + 1;
          
          // Get date in YYYY-MM-DD format
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;
          
          // Replace variables in pattern
          newName = newName
            .replace(/{name}/g, baseName)
            .replace(/{ext}/g, fileExt.replace('.', ''))
            .replace(/{num}/g, numValue.toString())
            .replace(/{date}/g, dateString);
          
          // Add extension if not included in pattern
          if (fileExt && !newName.includes(fileExt)) {
            newName += fileExt;
          }
          break;
          
        case 'replace':
          const find = config.find;
          const replace = config.replace;
          
          if (!find) {
            newName = fileName;
          } else {
            const flags = config.caseSensitive ? 'g' : 'gi';
            const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedFind, flags);
            newName = fileName.replace(regex, replace);
          }
          break;
          
        case 'regex':
          const pattern = config.pattern;
          const replacement = config.replacement;
          
          if (!pattern) {
            newName = fileName;
          } else {
            try {
              const regex = new RegExp(pattern, 'g');
              newName = fileName.replace(regex, replacement);
            } catch (error) {
              newName = fileName;
            }
          }
          break;
          
        case 'word':
          // For word selection method, the renderer already calculated the new name
          // and will pass it in the wordResult property
          newName = config.wordResult || fileName;
          break;
          
        default:
          newName = fileName;
      }
      
      const newPath = path.join(dirPath, newName);
      
      // Check if the new file name already exists
      if (fs.existsSync(newPath) && filePath !== newPath) {
        throw new Error('A file with this name already exists');
      }
      
      // Perform the rename operation
      fs.renameSync(filePath, newPath);
      
      results.push({
        success: true,
        oldPath: filePath,
        newPath: newPath
      });
    } catch (error) {
      results.push({
        success: false,
        oldPath: filePath,
        error: error.message
      });
    }
  }
  
  return results;
});

// Rules management handlers
ipcMain.handle('save-rule', async (event, ruleName, ruleData) => {
  console.log('Main process: Received save-rule request', { ruleName, ruleData });
  
  try {
    // Ensure rule name is valid
    if (!ruleName || typeof ruleName !== 'string' || ruleName.trim() === '') {
      console.error('Invalid rule name:', ruleName);
      return { success: false, error: 'Invalid rule name' };
    }
    
    // Ensure rule data is valid
    if (!ruleData || typeof ruleData !== 'object') {
      console.error('Invalid rule data:', ruleData);
      return { success: false, error: 'Invalid rule data' };
    }
    
    const userDataPath = app.getPath('userData');
    console.log('User data path:', userDataPath);
    
    const rulesDir = path.join(userDataPath, 'saved-rules');
    console.log('Rules directory:', rulesDir);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(rulesDir)) {
      console.log('Creating rules directory');
      fs.mkdirSync(rulesDir, { recursive: true });
    }
    
    const filePath = path.join(rulesDir, `${ruleName}.json`);
    console.log('Rule file path:', filePath);
    
    // Stringify rule data with pretty formatting
    const jsonData = JSON.stringify(ruleData, null, 2);
    console.log('Saving JSON data:', jsonData);
    
    fs.writeFileSync(filePath, jsonData);
    console.log('Rule saved successfully');
    
    return { success: true };
  } catch (error) {
    console.error('Error saving rule:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-saved-rules', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const rulesDir = path.join(userDataPath, 'saved-rules');
    
    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(rulesDir);
    const rules = files
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: path.basename(file, '.json'),
        filePath: path.join(rulesDir, file)
      }));
    
    return rules;
  } catch (error) {
    console.error('Error getting saved rules:', error);
    return [];
  }
});

ipcMain.handle('load-rule', async (event, ruleName) => {
  try {
    const userDataPath = app.getPath('userData');
    const rulesDir = path.join(userDataPath, 'saved-rules');
    const filePath = path.join(rulesDir, `${ruleName}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Rule not found' };
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const ruleData = JSON.parse(data);
    
    return { success: true, data: ruleData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-rule', async (event, ruleName) => {
  try {
    const userDataPath = app.getPath('userData');
    const rulesDir = path.join(userDataPath, 'saved-rules');
    const filePath = path.join(rulesDir, `${ruleName}.json`);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Rule not found' };
    }
    
    fs.unlinkSync(filePath);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 이미지 크기 가져오기 함수
async function handleGetImageSize(event, filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return { width: 0, height: 0 };
    }

    // 이미지 및 비디오 확장자 확인
    const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
    const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i.test(filePath);
    const isSpecialImage = /\.(exr|dpx|tiff?|psd|hdr)$/i.test(filePath);
    
    if (!isImage && !isVideo) {
      console.log(`Not a supported media file: ${filePath}`);
      return { width: 0, height: 0 };
    }
    
    // 비디오 파일 처리
    if (isVideo) {
      console.log(`Processing video file: ${filePath}`);
      try {
        return await getVideoResolution(filePath);
      } catch (error) {
        console.error('Error getting video resolution:', error);
        // 실패하면 일반적인 해상도 추정 (파일 크기 기반)
        return estimateDimensionsByFileSize(filePath);
      }
    }
    
    // 특수 이미지 포맷 처리 (sharp, probe-image-size 사용)
    if (isSpecialImage) {
      console.log(`Processing special image format: ${filePath}`);
      try {
        // 먼저 probe-image-size 시도
        try {
          const result = await probeSpecialImageFile(filePath);
          if (result && result.width && result.height) {
            console.log(`Image dimensions for ${filePath}: ${result.width}x${result.height} (using probe)`);
            return { width: result.width, height: result.height };
          }
        } catch (probeErr) {
          console.log('Probe image size failed, trying sharp:', probeErr.message);
        }
        
        // 다음으로 sharp 시도
        try {
          const metadata = await sharp(filePath).metadata();
          if (metadata.width && metadata.height) {
            console.log(`Image dimensions for ${filePath}: ${metadata.width}x${metadata.height} (using sharp)`);
            return { width: metadata.width, height: metadata.height };
          }
        } catch (sharpErr) {
          console.log('Sharp metadata failed:', sharpErr.message);
        }
        
        // 두 방법 모두 실패하면 파일 크기 기반 추정
        console.log('Falling back to file size estimation');
        return estimateDimensionsByFileSize(filePath);
      } catch (error) {
        console.error('Error processing special image format:', error);
        return estimateDimensionsByFileSize(filePath);
      }
    }

    // 일반 이미지 포맷의 경우 imageSizeFromFile 사용
    try {
      // 이미지 크기 가져오기 (Promise를 반환하므로 await 사용)
      const dimensions = await imageSizeFromFile(filePath);
      console.log(`Image dimensions for ${filePath}: ${dimensions.width}x${dimensions.height}`);
      return { width: dimensions.width, height: dimensions.height };
    } catch (error) {
      console.error('Error getting image size:', error);
      // 형식을 지원하지만 파일 손상 등의 이유로 읽기 실패한 경우
      return { width: 0, height: 0 };
    }
  } catch (error) {
    console.error('General error in handleGetImageSize:', error);
    return { width: 0, height: 0 };
  }
}

// 비디오 해상도 가져오기 함수
function getVideoResolution(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error in ffprobe:', err);
        return reject(err);
      }
      
      try {
        // 비디오 스트림 찾기
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        if (videoStream && videoStream.width && videoStream.height) {
          console.log(`Video dimensions: ${videoStream.width}x${videoStream.height}`);
          
          // 프레임 레이트 계산
          let fps = 0;
          if (videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/');
            fps = parseInt(num) / parseInt(den);
          }
          
          // 총 프레임 수 계산
          let frames = 0;
          if (fps > 0 && videoStream.duration) {
            frames = Math.round(fps * parseFloat(videoStream.duration));
          } else if (videoStream.nb_frames) {
            frames = parseInt(videoStream.nb_frames);
          }
          
          return resolve({ 
            width: videoStream.width, 
            height: videoStream.height,
            duration: videoStream.duration, // 추가 정보: 재생 시간(초)
            frames: frames  // 추가: 총 프레임 수
          });
        } else {
          console.log('No valid video stream found');
          return reject(new Error('No valid video stream found'));
        }
      } catch (parseErr) {
        console.error('Error parsing ffprobe result:', parseErr);
        return reject(parseErr);
      }
    });
  });
}

// 특수 이미지 파일의 크기 검색 함수
async function probeSpecialImageFile(filePath) {
  try {
    // 파일 스트림 생성
    const stream = fs.createReadStream(filePath);
    // probe-image-size 실행
    const result = await probeImageSize(stream);
    // 스트림 닫기
    stream.destroy();
    return result;
  } catch (error) {
    console.error('Error probing image file:', error);
    throw error;
  }
}

// 파일 크기 기반 해상도 추정 함수
function estimateDimensionsByFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // 파일 크기가 클수록 높은 해상도로 추정
    if (fileSize > 20 * 1024 * 1024) { // 20MB 이상
      return { width: 4096, height: 2160 }; // 4K+
    } else if (fileSize > 10 * 1024 * 1024) { // 10MB 이상
      return { width: 3840, height: 2160 }; // 4K
    } else if (fileSize > 5 * 1024 * 1024) { // 5MB 이상
      return { width: 1920, height: 1080 }; // Full HD
    } else if (fileSize > 2 * 1024 * 1024) { // 2MB 이상
      return { width: 1280, height: 720 }; // HD
    } else {
      return { width: 854, height: 480 }; // SD 품질
    }
  } catch (error) {
    console.error('Error reading file stats:', error);
    // 기본 HD 해상도 반환
    return { width: 1280, height: 720 };
  }
}

// 비디오 파일 정보 추출 함수 - 외부 호출용 인터페이스
async function analyzeVideo(filePath) {
  try {
    // getVideoResolution을 호출하여 일관된 구현 사용
    return await getVideoResolution(filePath);
  } catch (error) {
    console.error('FFprobe 분석 오류:', error);
    return null;
  }
}

// IPC Handlers
ipcMain.handle('get-image-size', handleGetImageSize); 
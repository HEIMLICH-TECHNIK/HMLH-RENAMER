const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const imageSize = require('image-size');
const probeImageSize = require('probe-image-size');
const https = require('https');
const os = require('os');

// 업데이트 관리자 모듈 가져오기
const updater = require('./updater');

// Try to load sharp, but don't crash if it's not available
let sharp;
try {
  sharp = require('sharp');
  console.log('Sharp module loaded successfully');
} catch (error) {
  console.warn('Could not load sharp module, some image processing features will be limited', error);
  // Create dummy sharp module to prevent errors
  sharp = {
    metadata: () => Promise.resolve({ width: 0, height: 0 })
  };
}

const ffmpeg = require('fluent-ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

// Set ffprobe path for ffmpeg
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Try to load electron-updater, but don't crash if it's not available
let autoUpdater;
let electronLog;
try {
  const { autoUpdater: updater } = require('electron-updater');
  electronLog = require('electron-log');
  
  electronLog.transports.file.level = 'debug';
  electronLog.transports.console.level = 'debug';
  
  // 더미 설정만 유지 (실제 업데이트는 updater.js에서 처리)
  autoUpdater = updater;
  autoUpdater.logger = electronLog;
  
  console.log('Electron updater loaded for passing to updater module');
} catch (error) {
  console.warn('Could not load electron-updater, auto updates will be disabled', error);
  // Create dummy autoUpdater to prevent errors
  autoUpdater = {
    logger: null,
    checkForUpdatesAndNotify: () => Promise.resolve(),
    checkForUpdates: () => Promise.resolve(),
    on: () => {},
    once: () => {},
    quitAndInstall: () => {}
  };
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// 아이콘 경로 설정
const getIconPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, 'assets', 'icons', 'app-icon.ico');
  } else if (process.platform === 'darwin') {
    return path.join(__dirname, 'assets', 'icons', 'app-icon.icns');
  } else {
    return path.join(__dirname, 'assets', 'icons', 'app-icon.png');
  }
};

// ffprobe 경로 설정 (개발 환경과 프로덕션 환경 모두 지원)
let ffprobePath;
if (app.isPackaged) {
  // 프로덕션 환경에서는 extraResources에 복사된 경로 사용
  const platform = process.platform;
  const ext = platform === 'win32' ? '.exe' : '';
  ffprobePath = path.join(process.resourcesPath, 'ffprobe', `ffprobe${ext}`);
  
  // Windows에서는 실행 권한 필요 없음
  if (platform !== 'win32') {
    try {
      // macOS 및 Linux에서 실행 권한 부여
      fs.chmodSync(ffprobePath, '755');
    } catch (error) {
      console.error('Failed to set executable permissions on ffprobe:', error);
    }
  }
  
  console.log('Production ffprobe path:', ffprobePath);
} else {
  // 개발 환경에서는 ffprobe-installer 경로 사용
  ffprobePath = ffprobeInstaller.path;
  console.log('Development ffprobe path:', ffprobePath);
}

// ffmpeg에 ffprobe 경로 설정
ffmpeg.setFfprobePath(ffprobePath);

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
    icon: getIconPath(),
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

  // 업데이트 관리자 초기화
  updater.initUpdater(mainWindow, autoUpdater, electronLog);

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 앱 시작 시 업데이트 확인
    updater.checkForUpdatesOnStartup();
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
          
          // 미디어 파일 메타데이터 가져오기
          let mediaMetadata = null;
          
          // 확장자로 이미지/비디오 파일 확인
          const isImage = /\.(jpe?g|png|gif|bmp|webp|tiff?|exr|dpx|hdr|avif|heic|tga|svg|psd)$/i.test(filePath);
          const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(filePath);
          
          // 미디어 파일인 경우 메타데이터 가져오기
          if (isImage || isVideo) {
            try {
              mediaMetadata = await handleGetImageSize(event, filePath);
              
              // 비디오일 경우 추가 메타데이터 가져오기
              if (isVideo) {
                const videoMetadata = await extractFFProbeData(filePath);
                mediaMetadata = { ...mediaMetadata, ...videoMetadata };
              }
            } catch (error) {
              console.error('Error getting media metadata:', error);
              mediaMetadata = { width: 0, height: 0 };
            }
          }
          
          // Replace variables in pattern
          newName = newName
            .replace(/{name}/g, baseName)
            .replace(/{ext}/g, fileExt.replace('.', ''))
            .replace(/{num}/g, numValue.toString())
            .replace(/{date}/g, dateString);
          
          // 미디어 메타데이터가 있을 경우 추가 변수 대체
          if (mediaMetadata) {
            // 기본 미디어 변수
            newName = newName.replace(/{width}/g, mediaMetadata.width || 0);
            newName = newName.replace(/{height}/g, mediaMetadata.height || 0);
            
            // 비디오 관련 변수
            if (isVideo && mediaMetadata.duration) {
              const duration = parseFloat(mediaMetadata.duration) || 0;
              const frames = parseInt(mediaMetadata.frames) || 0;
              
              // 시간 포맷팅
              const formatTime = (seconds) => {
                if (!seconds || isNaN(seconds)) return "00:00:00";
                seconds = Math.floor(seconds);
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = seconds % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              };
              
              newName = newName.replace(/{duration}/g, duration.toString());
              newName = newName.replace(/{duration_fmt}/g, formatTime(duration));
              newName = newName.replace(/{frames}/g, frames.toString());
              
              // 추가 비디오 속성
              if (mediaMetadata.colorspace) {
                newName = newName.replace(/{colorspace}/g, mediaMetadata.colorspace);
              }
              if (mediaMetadata.color_transfer) {
                newName = newName.replace(/{log}/g, mediaMetadata.color_transfer);
              }
              if (mediaMetadata.codec) {
                newName = newName.replace(/{codec}/g, mediaMetadata.codec);
              }
              if (mediaMetadata.bit_depth) {
                newName = newName.replace(/{bit_depth}/g, mediaMetadata.bit_depth);
              }
              if (mediaMetadata.chroma_subsampling) {
                newName = newName.replace(/{chroma_subsampling}/g, mediaMetadata.chroma_subsampling);
              }
              if (mediaMetadata.scan_type) {
                newName = newName.replace(/{scan_type}/g, mediaMetadata.scan_type);
              }
              if (mediaMetadata.bitrate) {
                newName = newName.replace(/{bitrate}/g, mediaMetadata.bitrate);
              }
              if (mediaMetadata.pixel_format) {
                newName = newName.replace(/{pixel_format}/g, mediaMetadata.pixel_format);
              }
            }
            
            // 파일 유형 변수
            newName = newName.replace(/{is_image}/g, isImage ? "image" : "");
            newName = newName.replace(/{is_video}/g, isVideo ? "video" : "");
            
            // 조건부 변수 처리
            newName = newName.replace(/{if_image:(.*?)}/g, (match, content) => isImage ? content : "");
            newName = newName.replace(/{if_video:(.*?)}/g, (match, content) => isVideo ? content : "");
            
            if (mediaMetadata.width && mediaMetadata.height) {
              const isLandscape = mediaMetadata.width > mediaMetadata.height;
              newName = newName.replace(/{if_landscape:(.*?)}/g, (match, content) => isLandscape ? content : "");
              newName = newName.replace(/{if_portrait:(.*?)}/g, (match, content) => !isLandscape ? content : "");
            }
            
            // 포맷 변수 처리
            newName = newName.replace(/{upper_name}/g, baseName.toUpperCase());
            newName = newName.replace(/{lower_name}/g, baseName.toLowerCase());
            
            // 숫자 패딩 변수 (예: {padnum3})
            newName = newName.replace(/{padnum(\d+)}/g, (match, padCount) => {
              const count = parseInt(padCount);
              return numValue.toString().padStart(count, '0');
            });
          }
          
          // Add extension if not included in pattern
          if (fileExt && !newName.includes(fileExt)) {
            newName += fileExt;
          }
          break;
          
        case 'numbering':
          // 넘버링 방식 이름 변경
          let sortedIndex = index;
          
          // 정렬 방식에 따라 인덱스 조정
          if (config.sort) {
            // 미리 정렬된 인덱스 배열을 생성하지 않고 현재 파일의 정렬 위치 계산
            const sortedFiles = [...files];
            
            // 파일 이름 정렬
            if (config.sort === 'name') {
              sortedFiles.sort((a, b) => {
                const nameA = path.basename(a).toLowerCase();
                const nameB = path.basename(b).toLowerCase();
                return config.reverse ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
              });
            } 
            // 날짜 정렬
            else if (config.sort === 'date') {
              sortedFiles.sort((a, b) => {
                try {
                  const statsA = fs.statSync(a);
                  const statsB = fs.statSync(b);
                  return config.reverse ? 
                    statsB.mtime.getTime() - statsA.mtime.getTime() : 
                    statsA.mtime.getTime() - statsB.mtime.getTime();
                } catch (error) {
                  console.error('Error sorting by date:', error);
                  return 0;
                }
              });
            }
            // 크기 정렬
            else if (config.sort === 'size') {
              sortedFiles.sort((a, b) => {
                try {
                  const statsA = fs.statSync(a);
                  const statsB = fs.statSync(b);
                  return config.reverse ? 
                    statsB.size - statsA.size : 
                    statsA.size - statsB.size;
                } catch (error) {
                  console.error('Error sorting by size:', error);
                  return 0;
                }
              });
            }
            // 랜덤 정렬
            else if (config.sort === 'random') {
              // 랜덤으로 섞기 전에 인덱스를 생성하여 일관성 유지
              const indexMap = Array.from({ length: files.length }, (_, i) => i);
              indexMap.sort(() => Math.random() - 0.5);
              
              // 섞인 인덱스에 따라 파일 배열 정렬
              sortedFiles.sort((a, b) => {
                const indexA = files.indexOf(a);
                const indexB = files.indexOf(b);
                return indexMap[indexA] - indexMap[indexB];
              });
            }
            
            // 정렬된 배열에서 현재 파일의 인덱스 찾기
            sortedIndex = sortedFiles.indexOf(filePath);
            if (sortedIndex === -1) sortedIndex = index; // 찾지 못한 경우 원래 인덱스 사용
          }
          
          // 인덱스에 해당하는 순차 번호 생성
          const startNum = config.startNumber || 1;
          const stepNum = config.step || 1;
          const padCount = config.padding || 0;
          
          // 패턴 적용
          const numberingPattern = config.pattern || '{name}_{num}';
          let formattedNumber = (startNum + (sortedIndex * stepNum)).toString();
          
          // 패딩 적용
          if (padCount > 0) {
            formattedNumber = formattedNumber.padStart(padCount, '0');
          }
          
          // 패턴 치환
          newName = numberingPattern
            .replace(/{name}/g, baseName)
            .replace(/{num}/g, formattedNumber)
            .replace(/{ext}/g, fileExt.replace('.', ''));
          
          // 확장자가 패턴에 포함되지 않았다면 추가
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
    const isVideo = /\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp|mxf|r3d|braw|ari|arw|sraw|raw)$/i.test(filePath);
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
          if (typeof sharp.metadata === 'function') {
            const metadata = await sharp(filePath).metadata();
            if (metadata.width && metadata.height) {
              console.log(`Image dimensions for ${filePath}: ${metadata.width}x${metadata.height} (using sharp)`);
              return { width: metadata.width, height: metadata.height };
            }
          } else {
            console.log('Sharp module not available for metadata extraction');
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
      // 이미지 크기 가져오기 (동기 방식)
      const dimensions = imageSize(filePath);
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

// 컬러스페이스 코드를 사용자 친화적인 이름으로 변환
function friendlyColorspaceName(code) {
  const colorspaceMap = {
    // 표준 컬러스페이스
    'bt709': 'BT.709',
    'bt470bg': 'BT.601',
    'smpte170m': 'BT.601',
    'bt2020nc': 'BT.2020',
    'bt2020': 'BT.2020',
    'smpte2085': 'SMPTE 2085',
    'srgb': 'sRGB',
    'iec61966-2-1': 'sRGB',
    'iec61966-2-4': 'xvYCC',
    'bt470m': 'NTSC',
    
    // ProRes 코덱 특수 컬러스페이스 매핑
    'gbr': 'BT.709',  // ProRes는 보통 BT.709 사용
    'gbrp': 'BT.709',
    'gbra': 'BT.709',
    'rgb': 'BT.709',
    
    // ARRI 컬러스페이스
    'arri wide gamut': 'ARRI Wide Gamut',
    'awg': 'ARRI Wide Gamut',
    'arri_wide_gamut': 'ARRI Wide Gamut',
    'awg3': 'ARRI Wide Gamut 3',
    'awg4': 'ARRI Wide Gamut 4',
    'arri wide gamut 4': 'ARRI Wide Gamut 4',
    'arri_wide_gamut_4': 'ARRI Wide Gamut 4',
    
    // RED 컬러스페이스
    'red wide gamut': 'RED Wide Gamut',
    'redwidegamut': 'RED Wide Gamut',
    'red_wide_gamut': 'RED Wide Gamut',
    'rwg': 'RED Wide Gamut',
    'dragon color': 'Dragon Color',
    'dragoncolor': 'Dragon Color',
    'dragon color 2': 'Dragon Color 2',
    'dragoncolor2': 'Dragon Color 2',
    'red color': 'RED Color',
    'redcolor': 'RED Color',
    'red color 2': 'RED Color 2',
    'redcolor2': 'RED Color 2',
    'red color 3': 'RED Color 3',
    'redcolor3': 'RED Color 3',
    'red color 4': 'RED Color 4',
    'redcolor4': 'RED Color 4',
    'redcolor5': 'RED Color 5',
    'redcolor6': 'RED Color 6',
    
    // Sony 컬러스페이스
    'sgamut': 'S-Gamut',
    's-gamut': 'S-Gamut',
    's_gamut': 'S-Gamut',
    'sgamut3': 'S-Gamut3',
    's-gamut3': 'S-Gamut3', 
    's_gamut3': 'S-Gamut3',
    'sgamut3.cine': 'S-Gamut3.Cine',
    's-gamut3.cine': 'S-Gamut3.Cine',
    's_gamut3_cine': 'S-Gamut3.Cine',
    'venice': 'VENICE',
    
    // Canon 컬러스페이스
    'cinema gamut': 'Cinema Gamut',
    'cinemagamut': 'Cinema Gamut',
    'cinema_gamut': 'Cinema Gamut',
    'canon log': 'Canon Log',
    'canon_log': 'Canon Log',
    'canonlog': 'Canon Log',
    
    // Panasonic 컬러스페이스
    'v-gamut': 'V-Gamut',
    'vgamut': 'V-Gamut',
    'v_gamut': 'V-Gamut',
    
    // Blackmagic 컬러스페이스
    'blackmagic wide gamut': 'Blackmagic Wide Gamut',
    'bmdwg': 'Blackmagic Wide Gamut',
    'blackmagic_wide_gamut': 'Blackmagic Wide Gamut',
    'blackmagic design film': 'Blackmagic Design Film',
    'blackmagic_design_film': 'Blackmagic Design Film',
    
    // ACES 컬러스페이스
    'aces': 'ACES',
    'acescg': 'ACEScg',
    'aces cg': 'ACEScg',
    'ap0': 'ACES AP0',
    'ap1': 'ACES AP1',
    
    // 기타
    'alexa wide gamut': 'ALEXA Wide Gamut',
    'dcip3': 'DCI-P3',
    'dci-p3': 'DCI-P3',
    'dci_p3': 'DCI-P3',
    'p3': 'DCI-P3',
    'p3-d65': 'P3-D65',
    'p3_d65': 'P3-D65',
    'xyz': 'CIE XYZ',
    'unknown': 'unknown'
  };
  
  if (!code) return 'unknown';
  return colorspaceMap[code.toLowerCase()] || code;
}

// 컬러 트랜스퍼 코드를 사용자 친화적인 이름으로 변환
function friendlyTransferName(code) {
  const transferMap = {
    // 표준 트랜스퍼
    'bt709': 'BT.709',
    'bt2020-10': 'BT.2020 (10-bit)',
    'bt2020-12': 'BT.2020 (12-bit)',
    'gamma22': 'Gamma 2.2',
    'gamma28': 'Gamma 2.8',
    'smpte2084': 'PQ (HDR10)',
    'smpte428': 'SMPTE ST 428',
    'arib-std-b67': 'HLG (HDR)',
    'srgb': 'sRGB',
    'log': 'Log',
    'log100': 'Log100',
    'log316': 'Log316',
    'bt1361e': 'BT.1361',
    'iec61966-2-1': 'sRGB',
    'iec61966-2-4': 'xvYCC',
    'linear': 'Linear',
    
    // 특수 값 매핑
    'reserved': 'BT.709',  // 대부분의 ProRes는 BT.709 감마
    'unspecified': 'BT.709',
    'unknown': 'BT.709',
    
    // ARRI 로그
    'logc': 'ARRI LogC',
    'arri logc': 'ARRI LogC',
    'logc3': 'ARRI LogC3',
    'arri logc3': 'ARRI LogC3',
    'logc4': 'ARRI LogC4',
    'arri logc4': 'ARRI LogC4',
    'arri_logc': 'ARRI LogC',
    'arri_logc3': 'ARRI LogC3',
    'arri_logc4': 'ARRI LogC4',
    // ARRI LogC4 특수 코드 (ALEXA 35 카메라)
    '0E17010204020000': 'ARRI LogC4',
    
    // RED 로그
    'redlog': 'RED Log',
    'red log': 'RED Log',
    'red_log': 'RED Log',
    'redlogfilm': 'RED Log Film',
    'red log film': 'RED Log Film',
    'red_log_film': 'RED Log Film',
    'log3g10': 'RED Log3G10',
    'red log3g10': 'RED Log3G10',
    'red_log3g10': 'RED Log3G10',
    'log3g12': 'RED Log3G12',
    'red log3g12': 'RED Log3G12',
    'red_log3g12': 'RED Log3G12',
    
    // Sony 로그
    'slog': 'Sony S-Log',
    's-log': 'Sony S-Log',
    's_log': 'Sony S-Log',
    'slog2': 'Sony S-Log2',
    's-log2': 'Sony S-Log2',
    's_log2': 'Sony S-Log2',
    'slog3': 'Sony S-Log3',
    's-log3': 'Sony S-Log3',
    's_log3': 'Sony S-Log3',
    
    // Canon 로그
    'canonlog': 'Canon Log',
    'canon log': 'Canon Log',
    'canon_log': 'Canon Log',
    'canonlog2': 'Canon Log 2',
    'canon log 2': 'Canon Log 2',
    'canon_log2': 'Canon Log 2',
    'canonlog3': 'Canon Log 3',
    'canon log 3': 'Canon Log 3',
    'canon_log3': 'Canon Log 3',
    
    // Panasonic 로그
    'vlog': 'Panasonic V-Log',
    'v-log': 'Panasonic V-Log',
    'v_log': 'Panasonic V-Log',
    'v-log l': 'Panasonic V-Log L',
    'vlogl': 'Panasonic V-Log L',
    
    // Blackmagic 로그
    'bmdfilm': 'Blackmagic Film',
    'blackmagicfilm': 'Blackmagic Film',
    'blackmagic film': 'Blackmagic Film',
    'blackmagic_film': 'Blackmagic Film',
    'braw': 'Blackmagic RAW',
    'blackmagic raw': 'Blackmagic RAW',
    'blackmagic_raw': 'Blackmagic RAW',
    
    // ACES 로그
    'acescc': 'ACES CC',
    'aces cc': 'ACES CC',
    'aces_cc': 'ACES CC',
    'acescct': 'ACES CCT',
    'aces cct': 'ACES CCT',
    'aces_cct': 'ACES CCT',
    'aceslog': 'ACES Log',
    'aces log': 'ACES Log',
    'aces_log': 'ACES Log',
    
    // 기타
    'filmic': 'Filmic',
    'cineon': 'Cineon',
    'davinci wide gamut': 'DaVinci Wide Gamut',
    'davinci_wide_gamut': 'DaVinci Wide Gamut',
    'filmlight t-log': 'FilmLight T-Log',
    'filmlight_tlog': 'FilmLight T-Log',
    'unknown': 'unknown'
  };
  
  if (!code) return 'unknown';
  return transferMap[code.toLowerCase()] || code;
}

// 비디오 해상도 가져오기 함수
function getVideoResolution(filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      // ffprobe 사용하여 비디오 정보 추출
      const metadata = await extractFFProbeData(filePath);
      return resolve(metadata);
    } catch (error) {
      console.error('Error in getVideoResolution:', error);
      reject(error);
    }
  });
}

// ffprobe에서 비디오 데이터 추출하는 함수
async function extractFFProbeData(filePath) {
  try {
    // 파일 확장자 확인
    const fileExt = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    // 파일명에서 카메라 모델 추출 시도
    const isALEXA35 = fileName.includes('ALEXA35') || fileName.includes('ALEXA 35') || /A_\d{4}C\d{3}/.test(fileName);
    
    console.log(`Processing video file: ${filePath}, file extension: ${fileExt}`);
    
    // ffprobe 호출을 Promise로 래핑
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Error in ffprobe:', err);
          return reject(err);
        }
        
        // 전체 메타데이터 로깅 (디버깅용)
        console.log('Full metadata:', JSON.stringify(metadata, null, 2));
        
        // 비디오 스트림 찾기
        let videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        if (!videoStream) {
          console.log('No valid video stream found');
          return reject(new Error('No valid video stream found'));
        }
        
        console.log(`Video dimensions: ${videoStream.width}x${videoStream.height}`);
        
        // 전체 비디오 스트림 정보 로깅 (디버깅용)
        console.log('Full video stream metadata:', JSON.stringify(videoStream, null, 2));
        
        // 프레임 레이트 계산
        let fps = 0;
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/');
          fps = parseInt(num) / parseInt(den);
        } else if (videoStream.avg_frame_rate) {
          const [num, den] = videoStream.avg_frame_rate.split('/');
          if (den !== '0') {
            fps = parseInt(num) / parseInt(den);
          }
        }
        
        // 총 프레임 수 계산
        let frames = 0;
        if (fps > 0 && videoStream.duration) {
          frames = Math.round(fps * parseFloat(videoStream.duration));
        } else if (videoStream.nb_frames) {
          frames = parseInt(videoStream.nb_frames);
        } else if (metadata.format && metadata.format.duration) {
          frames = Math.round(fps * parseFloat(metadata.format.duration));
        }
        
        // 재생 시간
        let duration = videoStream.duration || 0;
        if (duration === 0 && metadata.format && metadata.format.duration) {
          duration = parseFloat(metadata.format.duration);
        }
        
        // 나머지 메타데이터 추출 코드 (기존과 동일)
        let colorspace = 'unknown';
        if (videoStream.color_space) {
          colorspace = videoStream.color_space;
        } else if (videoStream.colorspace) {
          colorspace = videoStream.colorspace;
        } else if (videoStream.color_primaries) {
          colorspace = videoStream.color_primaries;
        }
        
        // 비디오 코덱 정보
        let codec = 'unknown';
        if (videoStream.codec_name) {
          codec = videoStream.codec_name.toUpperCase();
        }
        
        // 비트 심도 정보
        let bitDepth = 'unknown';
        if (videoStream.bits_per_raw_sample) {
          bitDepth = `${videoStream.bits_per_raw_sample}-bit`;
        } else if (videoStream.pix_fmt && videoStream.pix_fmt.includes('p10')) {
          bitDepth = '10-bit';
        } else if (videoStream.pix_fmt && videoStream.pix_fmt.includes('p12')) {
          bitDepth = '12-bit';
        } else if (videoStream.pix_fmt && videoStream.pix_fmt.includes('p8')) {
          bitDepth = '8-bit';
        }
        
        // 컬러 트랜스퍼 정보
        let colorTransfer = 'unknown';
        if (videoStream.color_transfer) {
          colorTransfer = videoStream.color_transfer;
        } else if (videoStream.color_trc) {
          colorTransfer = videoStream.color_trc;
        } else if (videoStream.transfer_characteristics) {
          colorTransfer = videoStream.transfer_characteristics;
        }
        
        // 픽셀 포맷 및 크로마 서브샘플링 정보
        let pixelFormat = 'unknown';
        let chromaSubsampling = 'unknown';
        if (videoStream.pix_fmt) {
          pixelFormat = videoStream.pix_fmt;
          
          // 크로마 서브샘플링 추론
          if (videoStream.pix_fmt.includes('444')) {
            chromaSubsampling = '4:4:4';
          } else if (videoStream.pix_fmt.includes('422')) {
            chromaSubsampling = '4:2:2';
          } else if (videoStream.pix_fmt.includes('420')) {
            chromaSubsampling = '4:2:0';
          }
        }
        
        // 스캔 타입 정보 (인터레이스 또는 프로그레시브)
        let scanType = 'unknown';
        if (videoStream.field_order) {
          if (videoStream.field_order === 'progressive') {
            scanType = 'Progressive';
          } else {
            scanType = 'Interlaced';
          }
        }
        
        // 비트레이트 정보
        let bitrate = 'unknown';
        if (videoStream.bit_rate) {
          const bitrateMbps = Math.round(parseInt(videoStream.bit_rate) / 1000000);
          bitrate = `${bitrateMbps} Mbps`;
        } else if (metadata.format && metadata.format.bit_rate) {
          const bitrateMbps = Math.round(parseInt(metadata.format.bit_rate) / 1000000);
          bitrate = `${bitrateMbps} Mbps`;
        }
        
        // 사용자 친화적인 이름으로 변환
        colorspace = friendlyColorspaceName(colorspace);
        colorTransfer = friendlyTransferName(colorTransfer);
        
        console.log(`Video Codec: ${codec}`);
        console.log(`Video FPS: ${fps}, Duration: ${duration}s, Total frames: ${frames}`);
        console.log(`Color Space: ${colorspace}, Color Transfer: ${colorTransfer}`);
        console.log(`Bit Depth: ${bitDepth}, Chroma Subsampling: ${chromaSubsampling}`);
        console.log(`Scan Type: ${scanType}, Bitrate: ${bitrate}`);
        
        resolve({ 
          width: videoStream.width, 
          height: videoStream.height,
          duration: duration,
          frames: frames,
          colorspace: colorspace,
          color_transfer: colorTransfer,
          codec: codec,
          fps: fps,
          bit_depth: bitDepth,
          chroma_subsampling: chromaSubsampling,
          scan_type: scanType,
          bitrate: bitrate,
          pixel_format: pixelFormat
        });
      });
    });
  } catch (error) {
    console.error('Error in extractFFProbeData:', error);
    throw error;
  }
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

// IPC Handlers
ipcMain.handle('get-image-size', handleGetImageSize);

// 비디오 메타데이터 핸들러 추가
ipcMain.handle('get-video-metadata', async (event, filePath) => {
  try {
    // 비디오 파일 확장자 확인
    const fileExt = path.extname(filePath).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.3gp', '.mxf', '.r3d', '.braw', '.ari', '.raw', '.arw', '.sraw'].includes(fileExt);
    
    if (!isVideo) {
      return null;
    }
    
    const metadata = await extractFFProbeData(filePath);
    return metadata;
  } catch (error) {
    console.error('Error getting video metadata:', error);
    return null;
  }
});

// 시스템 정보 가져오는 함수 추가
ipcMain.handle('get-system-info', async () => {
  try {
    return {
      os: `${os.platform()} ${os.release()} (${os.arch()})`,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return {
      os: 'Unknown',
      electronVersion: 'Unknown',
      nodeVersion: 'Unknown',
      chromeVersion: 'Unknown'
    };
  }
});

// 업데이트 핸들러 
ipcMain.on('check-for-updates', (event) => {
  console.log('[MAIN] Checking for updates...');
  const result = updater.handleUpdateCheck(event);
  console.log('[MAIN] Update check result:', result);
});

// 앱 버전 반환
ipcMain.handle('get-app-version', () => {
  return updater.getAppVersion();
}); 
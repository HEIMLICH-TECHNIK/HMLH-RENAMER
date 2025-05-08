const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
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
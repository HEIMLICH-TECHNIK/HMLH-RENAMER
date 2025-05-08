const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', 
  {
    getFilePaths: () => ipcRenderer.invoke('get-file-paths'),
    renameFiles: (files, pattern) => ipcRenderer.invoke('rename-files', files, pattern)
  }
); 
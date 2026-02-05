const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCachedData: (key) => ipcRenderer.invoke('get-cached-data', key),
  setCachedData: (key, value) => ipcRenderer.invoke('set-cached-data', key, value),
});

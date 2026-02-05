import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getCachedData: (key: string) => ipcRenderer.invoke('get-cached-data', key),
  setCachedData: (key: string, value: unknown) => ipcRenderer.invoke('set-cached-data', key, value),
});

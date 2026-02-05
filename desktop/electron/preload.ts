import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getCachedData: (key: string) => ipcRenderer.invoke('get-cached-data', key),
  setCachedData: (key: string, value: unknown) => ipcRenderer.invoke('set-cached-data', key, value),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});

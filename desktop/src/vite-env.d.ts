/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ElectronAPI {
  getCachedData: (key: string) => Promise<unknown>;
  setCachedData: (key: string, value: unknown) => Promise<void>;
  showNotification?: (title: string, body: string) => Promise<void>;
  openExternal?: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

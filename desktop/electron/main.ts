import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function getCachePath() {
  return path.join(app.getPath('userData'), 'relaxdrive-cache.json');
}

async function readCache(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.promises.readFile(getCachePath(), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeCache(data: Record<string, unknown>) {
  await fs.promises.writeFile(getCachePath(), JSON.stringify(data), 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'RelaxDrive Control Center',
    backgroundColor: '#0a0a0b',
    show: false,
  });

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Local cache / persistence for graceful degradation
ipcMain.handle('get-cached-data', async (_, key: string) => {
  const data = await readCache();
  return data[key] ?? null;
});
ipcMain.handle('set-cached-data', async (_, key: string, value: unknown) => {
  const data = await readCache();
  data[key] = value;
  await writeCache(data);
});

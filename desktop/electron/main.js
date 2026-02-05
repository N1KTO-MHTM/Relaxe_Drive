const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function getCachePath() {
  return path.join(app.getPath('userData'), 'relaxdrive-cache.json');
}

async function readCache() {
  try {
    const raw = await fs.promises.readFile(getCachePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCache(data) {
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

  const distPath = path.join(__dirname, '../dist/index.html');
  const useDevServer = process.env.ELECTRON_DEV === '1' || !fs.existsSync(distPath);
  if (useDevServer) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(distPath);
  }

  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('get-cached-data', async (_, key) => {
  const data = await readCache();
  return data[key] ?? null;
});
ipcMain.handle('set-cached-data', async (_, key, value) => {
  const data = await readCache();
  data[key] = value;
  await writeCache(data);
});

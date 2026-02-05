const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

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

ipcMain.handle('get-cached-data', (_, key) => Promise.resolve(null));
ipcMain.handle('set-cached-data', (_, key, value) => Promise.resolve());

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';
import { parse } from 'csv-parse';
import { processBookingData, Config, Template } from './processor';

let mainWindow: BrowserWindow | null = null;

// Ensure required directories exist
function ensureDirectories() {
  const appPath = path.dirname(app.getPath('exe'));
  const dirs = [
    path.join(appPath, 'data'),
    path.join(appPath, 'data/incoming'),
    path.join(appPath, 'data/processed'),
    path.join(appPath, 'data/payloads'),
    path.join(appPath, 'config'),
    path.join(appPath, 'logs')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create config files if they don't exist
  const configFiles = [
    {
      path: path.join(appPath, 'config/config.ini'),
      content: fs.readFileSync(path.join(__dirname, '../config.ini'), 'utf-8')
    },
    {
      path: path.join(appPath, 'config/payload-template.json'),
      content: fs.readFileSync(path.join(__dirname, '../payload-template.json'), 'utf-8')
    }
  ];

  configFiles.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Only show window when it's ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Don't show DevTools in production
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  ensureDirectories();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle file selection
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (!result.canceled) {
    const incomingDir = path.join(path.dirname(app.getPath('exe')), 'data/incoming');

    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      fs.copyFileSync(filePath, path.join(incomingDir, fileName));
    }
    return result.filePaths.map(p => path.basename(p));
  }
  return [];
});

// Scan incoming directory
ipcMain.handle('scan-incoming', () => {
  const incomingDir = path.join(path.dirname(app.getPath('exe')), 'data/incoming');
  if (!fs.existsSync(incomingDir)) {
    fs.mkdirSync(incomingDir, { recursive: true });
    return [];
  }
  return fs.readdirSync(incomingDir).filter(file => file.endsWith('.csv'));
});

// Process selected file
ipcMain.handle('process-file', async (event, fileName: string) => {
  try {
    const appPath = path.dirname(app.getPath('exe'));
    const config = ini.parse(fs.readFileSync(path.join(appPath, 'config/config.ini'), 'utf-8')) as Config;
    const template = JSON.parse(fs.readFileSync(path.join(appPath, 'config/payload-template.json'), 'utf-8')) as Template;

    const result = await processBookingData(fileName, config, template);
    return result;
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
});
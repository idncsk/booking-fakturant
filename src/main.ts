import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';
import { parse } from 'csv-parse/sync';
import { processBookingData, Config, Template } from './processor';
import { getAppBasePath } from './utils';

let mainWindow: BrowserWindow | null = null;

// Disable the sandbox completely for Linux
app.commandLine.appendSwitch('no-sandbox');

// Ensure required directories exist
function ensureDirectories() {
  const appPath = getAppBasePath();
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
      content: fs.readFileSync(path.join(appPath, 'config', 'config.ini'), 'utf-8')
    },
    {
      path: path.join(appPath, 'config/payload-template.json'),
      content: fs.readFileSync(path.join(appPath, 'config', 'payload-template.json'), 'utf-8')
    }
  ];

  configFiles.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content);
    }
  });
}

function createWindow() {
  const appPath = getAppBasePath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false
    },
    autoHideMenuBar: true,
    show: false,
    icon: process.env.NODE_ENV === 'development'
      ? path.join(appPath, 'assets/icon.png')
      : path.join(appPath, 'assets/icon.png')
  });

  // Let's check both possible locations for the HTML file
  let htmlPath = path.join(appPath, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(appPath, 'src/index.html');
  }
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, 'index.html');
  }
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, '../index.html');
  }

  console.log('Loading HTML from:', htmlPath);
  if (fs.existsSync(htmlPath)) {
    mainWindow.loadFile(htmlPath);
  } else {
    console.error('Could not find index.html in any of the expected locations');
    mainWindow.loadFile(path.join(__dirname, 'error.html'));
  }

  // Only show window when it's ready to avoid flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Don't show DevTools in production
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Add this function to help debug the config file
function debugConfigFile() {
  const appPath = getAppBasePath();
  const configPath = path.join(appPath, 'config/config.ini');

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      console.log('Raw config content:', content);

      const parsed = ini.parse(content);
      console.log('Parsed config:', parsed);

      if (parsed.AUTH_HEADER) {
        console.log('Auth header format:', {
          raw: parsed.AUTH_HEADER,
          split: parsed.AUTH_HEADER.split('='),
          processed: parsed.AUTH_HEADER.split('=')[1]?.replace(/"/g, '') || 'N/A'
        });
      } else {
        console.log('AUTH_HEADER not found in config');
      }
    } catch (error) {
      console.error('Error reading config file:', error);
    }
  } else {
    console.error('Config file not found at:', configPath);
  }
}

app.whenReady().then(() => {
  console.log('App path:', getAppBasePath());
  console.log('__dirname:', __dirname);
  console.log('process.cwd():', process.cwd());

  ensureDirectories();
  debugConfigFile();
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
    const incomingDir = path.join(getAppBasePath(), 'data/incoming');

    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      fs.copyFileSync(filePath, path.join(incomingDir, fileName));
    }
    return result.filePaths.map((p: string) => path.basename(p));
  }
  return [];
});

// Scan incoming directory
ipcMain.handle('scan-incoming', () => {
  const incomingDir = path.join(getAppBasePath(), 'data/incoming');
  if (!fs.existsSync(incomingDir)) {
    fs.mkdirSync(incomingDir, { recursive: true });
    return [];
  }
  return fs.readdirSync(incomingDir).filter((file: string) => file.endsWith('.csv'));
});

// Process selected file
ipcMain.handle('process-file', async (event: Electron.IpcMainInvokeEvent, fileName: string) => {
  try {
    const appPath = getAppBasePath();
    const configPath = path.join(appPath, 'config/config.ini');
    console.log('Reading config from:', configPath);

    const configContent = fs.readFileSync(configPath, 'utf-8');
    console.log('Config content:', configContent);

    const config = ini.parse(configContent) as Config;
    console.log('Parsed config:', config);

    const template = JSON.parse(fs.readFileSync(path.join(appPath, 'config/payload-template.json'), 'utf-8')) as Template;

    // Debug the auth header
    console.log('Auth header from config:', config.AUTH_HEADER);

    const result = await processBookingData(fileName, config, template);
    return result;
  } catch (error) {
    console.error('Error processing file:', error);
    throw error;
  }
});
import * as path from 'path';
import { app } from 'electron';

export function getAppBasePath() {
  // In development mode, use the current directory
  if (process.env.NODE_ENV === 'development') {
    return process.cwd();
  } else {
    // In production, for packaged apps
    if (app.isPackaged) {
      // On Windows and Linux, the app is in resources/app.asar
      // On macOS, it's in Resources/app.asar
      return path.dirname(path.dirname(app.getAppPath()));
    } else {
      // For non-packaged production runs
      return process.cwd();
    }
  }
}
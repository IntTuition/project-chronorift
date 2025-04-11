const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // For a simple static app, no special preload or Node integration is needed.
      contextIsolation: true
    }
  });

  // Load the index.html from the static export (we'll adjust paths next).
  const indexPath = path.join(__dirname, 'out', 'index.html');
  mainWindow.loadFile(indexPath);
}

app.whenReady().then(() => {
    protocol.interceptFileProtocol('file', (request, callback) => {
        const url = request.url.substr(7); // strip off the "file://" prefix
        // e.g. request.url = "file:///C:/path/to/app/out/_next/asset.js"
        // url will be "/C:/path/to/app/out/_next/asset.js" after substr
        callback({ path: path.normalize(`${__dirname}/${url}`) });
      });
      
  createWindow();

  // On macOS it's common to re-create a window in the app when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit the app when all windows are closed (except on macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

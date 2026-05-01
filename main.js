const { app, BrowserWindow, session, Menu } = require('electron');
const { initNetworkBlocking } = require('./network-blocking');

const WEBVIEW_PARTITION = 'persist:ward-v2';
const ENABLE_NETWORK_BLOCKING = process.env.WARD_NETWORK_ADBLOCK === '1';

let networkBlockingHandle = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('will-attach-webview', (_event, _webPreferences, params) => {
    if (!String(params.src || '').startsWith('https://www.youtube.com/')) {
      params.src = 'https://www.youtube.com/';
    }
  });

  win.loadFile('index.html');
  Menu.setApplicationMenu(null);
}

app.whenReady().then(async () => {
  const ytSession = session.fromPartition(WEBVIEW_PARTITION);

  try {
    await ytSession.clearCache();
    await ytSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
    });
  } catch (error) {
    console.warn('[Ward] No se pudo limpiar cache de la sesion:', error);
  }

  if (ENABLE_NETWORK_BLOCKING) {
    networkBlockingHandle = await initNetworkBlocking(ytSession);
  } else {
    console.log('[WardAds] Modo estable: bloqueo de red desactivado para no romper el player');
  }

  createWindow();
});

app.on('before-quit', () => {
  if (networkBlockingHandle && typeof networkBlockingHandle.disable === 'function') {
    networkBlockingHandle.disable();
  }
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

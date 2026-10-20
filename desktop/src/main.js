// Processo principal do app desktop.
//
// O build web do upstream é servido localmente "fingindo" ser o site oficial
// (https://simulador.latam-tools.com.br). Assim, sem alterar nada no código do
// upstream:
//   - links de compartilhamento (que usam location.origin) apontam para o site real;
//   - chamadas a APIs externas (encurtador, assets, issues) têm a mesma origem do
//     site, então CORS e restrições de domínio continuam funcionando.
// Rotas que só existem no servidor (/mcp, /api) são repassadas para a internet.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const SITE_HOST = 'simulador.latam-tools.com.br';
const SITE_URL = `https://${SITE_HOST}/`;
const REMOTE_PREFIXES = ['/mcp', '/api/'];

const webRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(__dirname, '..', 'web');

function localFileFor(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const file = path.resolve(webRoot, '.' + decoded);
  if (file !== webRoot && !file.startsWith(webRoot + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  // Rotas da SPA (sem extensão) caem no index.html, como no servidor de dev.
  if (!path.extname(decoded)) return path.join(webRoot, 'index.html');
  return null;
}

function serveSite() {
  protocol.handle('https', request => {
    const url = new URL(request.url);
    const isSite = url.hostname === SITE_HOST;
    const isRemoteRoute = REMOTE_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
    if (isSite && !isRemoteRoute && request.method === 'GET') {
      const file = localFileFor(url.pathname);
      if (file) return net.fetch(pathToFileURL(file).toString());
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'RO Calc Optimizer',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Links para outros sites abrem no navegador padrão.
  const isInternal = target => {
    try { return new URL(target).hostname === SITE_HOST; } catch { return false; }
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) { event.preventDefault(); shell.openExternal(url); }
  });

  win.loadURL(SITE_URL);
  return win;
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', error => console.error('[auto-update]', error));
    autoUpdater.checkForUpdatesAndNotify();
    // Verifica de novo a cada 6 horas para quem deixa o app aberto.
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000).unref();
  } catch (error) {
    console.error('[auto-update] indisponível', error);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    if (app.isPackaged) Menu.setApplicationMenu(null);
    serveSite();
    createWindow();
    setupAutoUpdate();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

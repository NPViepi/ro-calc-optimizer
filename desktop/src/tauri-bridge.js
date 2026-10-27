// Versão Electron "ponte" para o app Tauri (fase 3 do plano de migração).
//
// 1. Exporta o localStorage do site (autosave, builds salvas) para
//    %APPDATA%\RO Calc Optimizer\migration.json — reserva da migração: o app Tauri lê primeiro o
//    perfil do Electron direto (LevelDB) e usa este arquivo se não conseguir
//    (desktop/src-tauri/src/migration.rs).
// 2. Procura na última GitHub Release o instalador do Tauri (*_x64-setup.exe) e oferece
//    instalar. O instalador do Tauri remove esta versão Electron (src-tauri/windows/hooks.nsh).
//
// Apague este arquivo na fase 4 (limpeza), junto com o resto do Electron.
const { app, dialog, net, shell } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SITE_ORIGIN = 'https://simulador.latam-tools.com.br';
const RELEASES_API = 'https://api.github.com/repos/NPViepi/ro-calc-optimizer/releases/latest';
const SETUP_ASSET = /_x64-setup\.exe$/i;
const EXPORT_INTERVAL = 5 * 60 * 1000;

const migrationFile = () => path.join(app.getPath('userData'), 'migration.json');

/** -1, 0 ou 1, comparando "x.y.z". */
function compareVersions(a, b) {
  const pa = String(a).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b).split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
}

async function exportLocalStorage(win) {
  if (!win || win.isDestroyed()) return false;
  let origin;
  try { origin = new URL(win.webContents.getURL()).origin; } catch { return false; }
  if (origin !== SITE_ORIGIN) return false;
  const json = await win.webContents.executeJavaScript(
    'JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])))',
    true,
  );
  const data = { version: 1, origin: SITE_ORIGIN, exportedAt: new Date().toISOString(), localStorage: JSON.parse(json) };
  const file = migrationFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
  fs.renameSync(`${file}.tmp`, file);
  return true;
}

async function findTauriRelease() {
  const res = await net.fetch(RELEASES_API, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'ro-calc-optimizer' },
  });
  if (!res.ok) return null;
  const release = await res.json();
  const asset = (release.assets || []).find(a => SETUP_ASSET.test(a.name));
  if (!asset) return null;
  const version = String(release.tag_name || '').replace(/^desktop-v/, '');
  // A ponte é publicada na mesma release do Tauri (mesma versão), então "igual" também vale.
  if (compareVersions(version, app.getVersion()) < 0) return null;
  return { version, url: asset.browser_download_url, name: asset.name, page: release.html_url };
}

async function offerTauri(win) {
  const release = await findTauriRelease();
  if (!release || win.isDestroyed()) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    buttons: ['Instalar agora', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    title: 'Nova versão do RO Calc Optimizer',
    message: `A versão ${release.version} do app está disponível.`,
    detail: 'A nova versão é bem menor e mais leve. Suas builds salvas são levadas junto automaticamente.',
  });
  if (response !== 0) return;
  let installer;
  try {
    const res = await net.fetch(release.url);
    if (!res.ok) throw new Error(`download falhou: HTTP ${res.status}`);
    installer = path.join(os.tmpdir(), release.name);
    fs.writeFileSync(installer, Buffer.from(await res.arrayBuffer()));
  } catch (error) {
    console.error('[ponte tauri]', error);
    shell.openExternal(release.page);
    return;
  }
  // Exportação final, depois do download: o usuário pode ter alterado builds enquanto baixava.
  // Se falhar, não instala (o app Tauri também lê o perfil do Electron direto, mas não arriscamos).
  const exported = await exportLocalStorage(win).catch(error => { console.error('[ponte tauri] exportação', error); return false; });
  if (!exported) {
    if (!win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Não foi possível atualizar',
        message: 'Não conseguimos salvar suas builds para levar à nova versão.',
        detail: 'A atualização foi cancelada e nada foi alterado. Tente de novo mais tarde.',
      });
    }
    return;
  }
  // Não instalar uma atualização Electron pendente ao fechar: o instalador do Tauri assume.
  try { require('electron-updater').autoUpdater.autoInstallOnAppQuit = false; } catch { /* sem updater */ }
  spawn(installer, [], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

function setupTauriBridge(win) {
  if (process.platform !== 'win32') return;
  const save = () => exportLocalStorage(win).catch(error => console.error('[ponte tauri] exportação', error));
  win.webContents.on('did-finish-load', save);
  win.on('blur', save);
  setInterval(save, EXPORT_INTERVAL).unref();
  if (app.isPackaged) {
    setTimeout(() => offerTauri(win).catch(error => console.error('[ponte tauri]', error)), 10_000).unref();
  }
}

module.exports = { setupTauriBridge, compareVersions };

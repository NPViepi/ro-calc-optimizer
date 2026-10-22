// Ponte segura entre o app web e o Electron.
// Use este arquivo para expor recursos exclusivos do desktop (ex.: o otimizador
// de builds rodando localmente) sem precisar alterar o código do upstream.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('roDesktop', {
  isDesktop: true,
  platform: process.platform,
});

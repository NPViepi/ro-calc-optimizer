// cd desktop && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSiteFile } = require('../src/site-files');

const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
fs.writeFileSync(path.join(webRoot, 'index.html'), '<html></html>');
fs.mkdirSync(path.join(webRoot, 'optimizer'));
fs.writeFileSync(path.join(webRoot, 'optimizer', 'panel.js'), '');
const index = path.join(webRoot, 'index.html');

test('link de compartilhamento com ponto no token abre o app', () => {
  assert.strictEqual(resolveSiteFile(webRoot, '/s/N4IgzglgNjBiB7AT.gWwK4wIYDUC/'), index);
  assert.strictEqual(resolveSiteFile(webRoot, '/s/abc.def.'), index);
});

test('arquivos existentes são servidos', () => {
  assert.strictEqual(resolveSiteFile(webRoot, '/optimizer/panel.js'), path.join(webRoot, 'optimizer', 'panel.js'));
});

test('rotas sem extensão e navegações caem no index.html', () => {
  assert.strictEqual(resolveSiteFile(webRoot, '/qualquer/rota'), index);
  assert.strictEqual(resolveSiteFile(webRoot, '/pagina.v2', true), index);
});

test('arquivo inexistente com extensão (não navegação) é 404', () => {
  assert.strictEqual(resolveSiteFile(webRoot, '/assets/nao-existe.json'), null);
});

test('não sai da pasta do site', () => {
  assert.strictEqual(resolveSiteFile(webRoot, '/%2e%2e/%2e%2e/etc/passwd'), null);
});

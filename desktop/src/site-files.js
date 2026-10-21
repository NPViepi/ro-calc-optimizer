// Qual arquivo do build web responde a cada caminho do site (usado pelo main.js).
// Separado do main.js para poder ser testado sem o Electron (desktop/test).
const path = require('node:path');
const fs = require('node:fs');

/**
 * Rotas da SPA: links de compartilhamento `/s/<token>/` e qualquer caminho sem arquivo.
 * O token pode conter "." (o codec troca "+" por "."), então "ter extensão" não serve para
 * distinguir arquivo de rota: `/s/abc.def/` não é um arquivo `.def`.
 */
function isSpaRoute(decoded, acceptsHtml) {
  return decoded.startsWith('/s/') || acceptsHtml || !path.extname(decoded);
}

/**
 * Arquivo local para `pathname`, ou null (404).
 * `acceptsHtml`: a requisição é uma navegação de página (cabeçalho Accept com text/html).
 */
function resolveSiteFile(webRoot, pathname, acceptsHtml = false) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const file = path.resolve(webRoot, '.' + decoded);
  if (file !== webRoot && !file.startsWith(webRoot + path.sep)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  if (isSpaRoute(decoded, acceptsHtml)) return path.join(webRoot, 'index.html');
  return null;
}

module.exports = { resolveSiteFile, isSpaRoute };

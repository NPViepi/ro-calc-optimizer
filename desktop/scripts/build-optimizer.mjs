// Empacota o otimizador (src/optimizer) para o app desktop, sem mexer no build do upstream:
//   web/optimizer/panel.js   — o painel, injetado na página pelo main.js
//   web/optimizer/worker.js  — o Web Worker com o motor de cálculo
//
// Usa o esbuild já instalado na raiz (pnpm install) e os mesmos ajustes do build web do
// upstream (tools/build-web.mjs): o catálogo de skills sem as descrições
// (`browserDataPlugin`) e o `environment.prod.ts` no lugar do `environment.ts`, que
// esconde as skills de desenvolvimento como no site.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(desktop, '..');
const outdir = resolve(process.argv[2] ?? resolve(desktop, 'web/optimizer'));

const require = createRequire(resolve(root, 'package.json'));
const { build } = require('esbuild');
const { browserDataPlugin } = await import(pathToFileURL(resolve(root, 'tools/browser-data.mjs')).href);

const environmentPlugin = {
  name: 'environment',
  setup(builder) {
    builder.onLoad({ filter: /src[\\/]environments[\\/]environment\.ts$/ }, () => ({
      contents: readFileSync(resolve(root, 'src/environments/environment.prod.ts'), 'utf8'),
      loader: 'ts',
    }));
  },
};

await build({
  absWorkingDir: root,
  entryPoints: {
    panel: resolve(root, 'src/optimizer/ui/panel.ts'),
    worker: resolve(root, 'src/optimizer/worker.ts'),
  },
  outdir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: 'linked',
  tsconfig: resolve(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [browserDataPlugin(root), environmentPlugin],
  logLevel: 'info',
});

console.log(`Otimizador empacotado em ${outdir}`);

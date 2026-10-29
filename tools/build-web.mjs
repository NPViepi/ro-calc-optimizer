import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';
import { copyWebAssets } from './web-assets.mjs';
import { browserDataPlugin } from './browser-data.mjs';
import { startupOutputs } from './web-startup.mjs';

const root = resolve(import.meta.dirname, '..');
const defaultOutput = resolve(root, 'dist/sakai-ng');
const budgets = JSON.parse(readFileSync(resolve(root, 'tools/web-budgets.json'), 'utf8'));
export function compileWeb() {
  const result = spawnSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(root, 'tsconfig.app.json'), '--noEmit'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
}

export async function buildWeb({ production = true, outputDirectory = defaultOutput } = {}) {
  const output = resolve(outputDirectory);
  if (output !== defaultOutput && !output.startsWith(resolve(root, '.tmp') + sep)) throw new Error('Custom web output must stay inside .tmp');
  compileWeb();
  if (production) {
    const stylesIn = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? stylesIn(resolve(directory, entry.name)) : entry.name.endsWith('.component.css') ? [resolve(directory, entry.name)] : []);
    for (const file of stylesIn(resolve(root, 'src/app'))) {
      const bytes = Buffer.byteLength((await transform(readFileSync(file, 'utf8'), { loader: 'css', minify: true })).code);
      const name = relative(root, file).replaceAll('\\', '/');
      const limit = budgets.existingStyleLimits[name] ?? budgets.componentStyleError;
      if (bytes > limit) throw new Error(`Component style budget exceeded: ${name} (${bytes} > ${limit})`);
      if (bytes > budgets.componentStyleWarning) console.warn(`Component style warning: ${name} (${bytes} bytes)`);
    }
  }
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: { main: resolve(root, 'src/main.ts'), styles: resolve(root, 'src/styles.css') },
    outdir: output, bundle: true, splitting: true, format: 'esm', platform: 'browser',
    target: 'es2022', minify: production, sourcemap: 'linked', metafile: true,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
    entryNames: production ? '[name].[hash]' : '[name]', chunkNames: 'chunk-[hash]', assetNames: 'media/[name].[hash]',
    legalComments: 'external',
    plugins: [browserDataPlugin(root), { name: 'environment', setup(builder) {
      builder.onLoad({ filter: /src[\\/]environments[\\/]environment\.ts$/ }, args => production
        ? { contents: readFileSync(resolve(root, 'src/environments/environment.prod.ts'), 'utf8'), loader: 'ts' } : null);
    } }],
    logLevel: 'info',
  });
  copyWebAssets(root, output);
  const entries = Object.entries(result.metafile.outputs);
  // The translation catalogs are mutually exclusive: `loadCatalog` fetches the one chunk
  // for the chosen language and no reader ever downloads another. Counting all of them
  // against the ratchet would charge every future language to the same baseline, so the
  // total carries the largest of them and leaves the rest out — a Spanish catalog that
  // doubled would still be caught, a fourth language would not be charged twice.
  const code = entries.filter(([name]) => /\.(js|css)$/.test(name));
  const isAltCatalog = ([, meta]) => Object.keys(meta.inputs || {}).some(input => /src[\/]app[\/]i18n[\/](?!pt-br|index)[a-z-]+\.ts$/.test(input));
  const altCatalogs = code.filter(isAltCatalog);
  const totalBytes = code.filter(entry => !isAltCatalog(entry)).reduce((sum, [, meta]) => sum + meta.bytes, 0)
    + Math.max(0, ...altCatalogs.map(([, meta]) => meta.bytes));
  if (production && totalBytes > budgets.totalBaseline) throw new Error(`Web JS/CSS regressed against the Angular baseline: ${totalBytes} > ${budgets.totalBaseline}`);
  if (Object.keys(result.metafile.inputs).some(name => /node_modules.*(?:@angular|rxjs|zone\.js|tslib)/.test(name))) throw new Error('Removed framework dependency entered the browser bundle');
  const main = entries.find(([, meta]) => meta.entryPoint?.endsWith('/src/main.ts') || meta.entryPoint === 'src/main.ts');
  const styles = entries.find(([, meta]) => meta.entryPoint === 'src/styles.css');
  const bootstrap = entries.find(([, meta]) => meta.entryPoint === 'src/react/bootstrap.tsx');
  if (!main || !styles || !bootstrap) throw new Error('Missing web startup output');
  // A dynamic import of the bootstrap is still critical to the first usable screen.
  // esbuild's main CSS bundle already includes bootstrap CSS; do not count its copy.
  const initial = startupOutputs(result.metafile.outputs, [main[0], bootstrap[0], styles[0], ...(main[1].cssBundle ? [main[1].cssBundle] : [])]);
  const initialBytes = [...initial].reduce((sum, name) => sum + (result.metafile.outputs[name]?.bytes ?? 0), 0);
  if (production && initialBytes > budgets.initialError) throw new Error(`Startup JS/CSS exceeds budget: ${initialBytes} > ${budgets.initialError}`);
  if (production && initialBytes > budgets.initialWarning) console.warn(`Startup JS/CSS warning: ${initialBytes} > ${budgets.initialWarning}`);
  const preloads = [...initial].filter(name => name.endsWith('.js'))
    .map(name => `<link rel="modulepreload" href="${basename(name)}">`).join('\n');
  const stylesheetLinks = [styles[0], ...(main[1].cssBundle ? [main[1].cssBundle] : [])]
    .map(name => `<link rel="preload" as="style" href="${basename(name)}"><link rel="stylesheet" data-ro-styles media="print" href="${basename(name)}">`).join('\n');
  const html = readFileSync(resolve(root, 'src/index.html'), 'utf8')
    .replace('</head>', `${stylesheetLinks}\n${preloads}\n</head>`)
    .replace('</body>', `<script type="module" src="${basename(main[0])}"></script>${production ? '' : '<script type="module">const events=new EventSource("/__reload");events.onmessage=()=>location.reload();</script>'}\n</body>`);
  writeFileSync(resolve(output, 'index.html'), html);
  mkdirSync(resolve(root, 'out-tsc'), { recursive: true });
  writeFileSync(resolve(root, output === defaultOutput ? 'out-tsc/web-metafile.json' : 'out-tsc/web-dev-metafile.json'), JSON.stringify(result.metafile));
  writeFileSync(resolve(root, output === defaultOutput ? 'out-tsc/web-startup.json' : 'out-tsc/web-dev-startup.json'), JSON.stringify({ bytes: initialBytes, files: [...initial] }, null, 2));
  console.log(`Web build complete; initial JS/CSS ${(initialBytes / 1024).toFixed(0)} KB`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--check')) compileWeb({ checkOnly: true });
    else {
      const at = process.argv.indexOf('--output');
      await buildWeb({ production: !process.argv.includes('--development'), outputDirectory: at < 0 ? defaultOutput : process.argv[at + 1] });
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

// Gera o build web do upstream (sem modificá-lo) e copia para desktop/web.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// O build web do upstream exige Node 22.12+ (ver "engines" no package.json da raiz).
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(`Node ${process.versions.node} detectado. Instale o Node 22.12 ou mais recente (LTS) e rode de novo.`);
  process.exit(1);
}

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(desktop, '..');
const source = resolve(root, 'dist/sakai-ng');
const target = resolve(desktop, 'web');

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!process.argv.includes('--skip-build')) {
  if (!existsSync(resolve(root, 'node_modules'))) run('pnpm', ['install', '--frozen-lockfile']);
  // Mesmos passos do "pnpm build", exceto o worker do Cloudflare, que não é usado no desktop.
  run('node', ['tools/build-web-data.mjs', '--hash']);
  run('node', ['tools/build-web.mjs']);
  run('node', ['tools/inject-data-manifest.mjs']);
}

if (!existsSync(resolve(source, 'index.html'))) {
  console.error(`Build web não encontrado em ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`Build web copiado para ${target}`);

// Otimizador (src/optimizer): painel + Web Worker, empacotados à parte.
const optimizer = spawnSync(process.execPath, [resolve(desktop, 'scripts/build-optimizer.mjs'), resolve(target, 'optimizer')], { cwd: root, stdio: 'inherit' });
if (optimizer.status !== 0) process.exit(optimizer.status ?? 1);

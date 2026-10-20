// Gera o build web do upstream (sem modificá-lo) e copia para desktop/web.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const desktop = resolve(import.meta.dirname, '..');
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

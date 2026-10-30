#!/usr/bin/env node
// Post-build step: teach the built index.html where the hashed data artifacts
// are, and start downloading them during HTML parse.
//
// Why not just fetch a manifest from the app? Because RoService only exists
// inside the lazy route chunk (1,35 MB), so a fetch issued from there cannot
// start until that chunk has downloaded AND executed. Injecting the map into the
// HTML costs zero extra round trips and moves the start of the ~275 KB core
// download about 1,4 MB of JavaScript earlier. The app still falls back to
// fetching assets/data-manifest.json when the injection is absent (`pnpm start`).
//
// A real fetch() rather than <link rel="preload" as="fetch">: preload only
// dedupes when the later request's CORS mode and credentials match exactly,
// otherwise the browser silently downloads the file twice. A promise parked on
// window has no matching semantics to get wrong, and it warms the JSON parse.
//
// Usage:
//   node tools/inject-data-manifest.mjs [--dist dist/sakai-ng]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

const MARKER = '__RO_DATA__';
// items-desc e item-views ficam de fora: disputariam banda com o núcleo, e o
// RoService só os pede depois que ele resolve.
const EAGER_KEYS = ['itemsCore', 'monsters', 'hpsp', 'classes'];

// The item-name overlay for a reader who chose Spanish or English. It is ~55 KB over
// the wire and `initData` awaits it beside items-core, so leaving it to the app would
// put it a megabyte of JavaScript behind the table it is laid over — the one request
// here that depends on a stored preference rather than on nothing at all.
const LOCALE_NAME_KEYS = { es: 'itemNamesEs', en: 'itemNamesEn' };

function parseArgs(argv) {
  let dist = join(ROOT, 'dist/sakai-ng');
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dist') dist = argv[++i];
    else {
      console.error('usage: node tools/inject-data-manifest.mjs [--dist <dir>]');
      process.exit(1);
    }
  }
  return { dist: resolve(dist) };
}

function fail(message) {
  console.error(`inject-data-manifest: ${message}`);
  process.exit(1);
}

function buildSnippet(manifest) {
  const boot = `<script>window.${MARKER}=${JSON.stringify(manifest)};
(function(m){var b=m.base,f=m.files,o={};
function g(k){var p=fetch(b+f[k]).then(function(r){if(!r.ok)throw new Error(k+" "+r.status);return r.json();});
p.catch(function(){});o[k]=p;}
${JSON.stringify(EAGER_KEYS)}.forEach(g);
var l=null;try{l=localStorage.getItem("ro-locale");}catch(e){}
var n=${JSON.stringify(LOCALE_NAME_KEYS)}[l];
if(n&&f[n])g(n);
window.__RO_BOOT__=o;})(window.${MARKER});</script>`;

  return boot;
}

function main() {
  const { dist } = parseArgs(process.argv);

  const indexPath = join(dist, 'index.html');
  const manifestPath = join(dist, 'assets/data-manifest.json');

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail(`could not read ${manifestPath} — did \`node tools/build-web-data.mjs --hash\` run before \`pnpm build\`?`);
  }

  for (const key of EAGER_KEYS) {
    if (!manifest.files?.[key]) fail(`manifest is missing the "${key}" entry`);
  }

  // Every artifact the manifest names must actually be in the build — not just the eager
  // ones. `not_found_handling: "single-page-application"` answers a missing asset with
  // index.html and a 200, so a manifest that outlives its files fails at runtime as JSON
  // parsed from HTML: in the browser for the app's own fetches, and on a live /mcp request
  // for the Worker (worker/mcp/data.ts keeps a content-type check as the backstop).
  // Catching it here turns that whole class into a red build.
  for (const [key, file] of Object.entries(manifest.files ?? {})) {
    const path = join(dist, manifest.base + file);
    if (!existsSync(path)) fail(`manifest names "${key}" -> ${file}, which is not in the build`);
  }

  let html;
  try {
    html = readFileSync(indexPath, 'utf8');
  } catch {
    fail(`could not read ${indexPath}`);
  }

  if (html.includes(MARKER)) fail('index.html already carries an injection — build output is stale, clean dist/ first');
  if (!html.includes('</head>')) fail('index.html has no </head> to inject before');

  // build-web follows the startup graph. Scanning every chunk would also fetch
  // on-demand history and undo its lazy loading.
  writeFileSync(indexPath, html.replace('</head>', `${buildSnippet(manifest)}\n</head>`));

  console.log(`inject-data-manifest: ${EAGER_KEYS.length} fetches injected in ${indexPath}`);
}

main();

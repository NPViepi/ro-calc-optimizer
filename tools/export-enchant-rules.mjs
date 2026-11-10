#!/usr/bin/env node
// Exporta as regras de encantamento do simulador (EnchantTable) para arquivos JSON
// estáticos, um por equipamento: enchant-rules/<itemId>.json.
// Uso: node tools/export-enchant-rules.mjs
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'enchant-rules');
const tmp = mkdtempSync(join(tmpdir(), 'enchant-rules-'));

try {
  const bundle = join(tmp, 'table.mjs');
  await build({
    entryPoints: [join(root, 'src/app/constants/enchant_item/_enchant_table.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: bundle,
    logLevel: 'error',
  });
  const { EnchantTable } = await import(pathToFileURL(bundle).href);

  const items = JSON.parse(readFileSync(join(root, 'src/assets/demo/data/item.json'), 'utf8'));
  const byAegis = new Map();
  for (const it of Object.values(items)) if (it?.aegisName) byAegis.set(it.aegisName, it);

  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith('.json')) rmSync(join(outDir, f));

  const index = {};
  const missing = new Set();
  for (const entry of EnchantTable) {
    const equip = byAegis.get(entry.name);
    if (!equip) { missing.add(entry.name); continue; }
    const slots = {};
    entry.enchants.forEach((list, i) => {
      if (!list) return;
      slots[`enchant${i}`] = [...new Set(list)].map((aegis) => {
        const e = byAegis.get(aegis);
        if (!e) missing.add(aegis);
        return e ? { id: e.id, name: e.name } : { id: null, aegisName: aegis };
      });
    });
    const data = { id: equip.id, aegisName: equip.aegisName, name: equip.name, slots };
    writeFileSync(join(outDir, `${equip.id}.json`), JSON.stringify(data) + '\n');
    index[equip.id] = equip.name;
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index) + '\n');
  console.log(`${Object.keys(index).length} equipamentos exportados para enchant-rules/`);
  if (missing.size) console.log(`${missing.size} nomes sem id no item.json (ignorados ou com id null)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

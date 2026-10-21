import { readFileSync } from 'node:fs';
import { OptimizerData } from '../runtime';

/**
 * Os dados no formato que o app baixa: itens com o nome pt-BR do LATAM (inglês em `enName`) e
 * `presentInLatam`, monstros com o nome pt-BR — o que `tools/build-web-data.mjs` produz.
 */
export function appShapedData(): OptimizerData {
  const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
  const latam = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8'));
  const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
  const latamMonsters = JSON.parse(readFileSync('src/assets/demo/data/latam-monsters.json', 'utf8'));
  for (const [id, item] of Object.entries<any>(items)) {
    const overlay = latam[id];
    if (overlay || item.preRelease) item.presentInLatam = true;
    if (overlay?.name && overlay.name !== item.name) { item.enName = item.name; item.name = overlay.name; }
  }
  for (const [id, monster] of Object.entries<any>(monsters)) if (latamMonsters[id]) monster.name = latamMonsters[id];
  return { items, monsters, hpSpTable: JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8')) };
}

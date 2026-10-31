#!/usr/bin/env node
// Gera src/optimizer/data/chance-effects.ts: chance, duração e gatilho dos efeitos de
// ativação (`chance__*` nos scripts), lidos da descrição pt-BR de latam-items.json.
//
// O script do item só traz o bônus do efeito; chance e duração estão no texto
// ("Ao realizar ataques físicos, 3% de chance de ativar um [Efeito] por 10 segundos.").
// Só entram efeitos com gatilho explícito — ataques físicos, mágicos, os dois, ou o uso de
// uma skill. Os que só dizem "N% de chance de ativar…" ficam de fora (decisão do projeto:
// sem gatilho conhecido, o otimizador não os considera).
//
// Uso: node tools/build-chance-effects.mjs [--report]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/assets/demo/data');
const OUT = join(ROOT, 'src/optimizer/data/chance-effects.ts');
const report = process.argv.includes('--report');

const items = JSON.parse(readFileSync(join(DATA, 'item.json'), 'utf8'));
const latam = JSON.parse(readFileSync(join(DATA, 'latam-items.json'), 'utf8'));

const clean = (text) => text.replace(/\^[0-9a-fA-F]{6}/g, '');
const number = (text) => Number(text.replace(',', '.'));
const RATE = /(\d+(?:[.,]\d+)?)\s*%\s*de chance/i;
const DURATION = /por\s+(\d+(?:[.,]\d+)?)\s*segundos?/i;

/** Gatilho da linha, ou undefined quando ela não diz. */
function triggerOf(line) {
  if (/ao realizar ataques f[ií]sicos ou m[aá]gicos/i.test(line)) return { trigger: 'any' };
  if (/ao realizar ataques f[ií]sicos/i.test(line)) return { trigger: 'physical' };
  if (/ao realizar ataques m[aá]gicos/i.test(line)) return { trigger: 'magical' };
  const skill = /ao (?:usar|utilizar) \[([^\]]+)\]/i.exec(line);
  if (skill) return { trigger: 'skill', skill: skill[1].trim() };
  return undefined;
}

const effects = [];
const skipped = { noTrigger: [], noRateOrDuration: [], multiple: [] };
for (const [key, item] of Object.entries(items)) {
  const pt = latam[item.id] ?? latam[key];
  if (!pt || !Object.keys(item.script ?? {}).some((attr) => attr.startsWith('chance__'))) continue;
  const all = clean(pt.description ?? '').split('\n').map((line) => line.trim());
  const indexes = all.flatMap((line, index) => (/chance/i.test(line) && DURATION.test(line) && RATE.test(line) ? [index] : []));
  if (!indexes.length) { skipped.noRateOrDuration.push(pt.name); continue; }
  if (indexes.length > 1) skipped.multiple.push(pt.name);
  // O gatilho vem na própria linha ou num cabeçalho logo acima ("Ao realizar ataques físicos:").
  const triggerAt = (index) => triggerOf(all[index]) ?? (index > 0 && all[index - 1].endsWith(':') ? triggerOf(all[index - 1]) : undefined);
  const line = all[indexes[0]];
  let trigger = triggerAt(indexes[0]);
  // O motor junta os bônus de todos os efeitos do item numa entrada só: um efeito físico e
  // outro mágico no mesmo item (Cauda de Gato Real, Chapéu de Imp-LT) viram "qualquer ataque".
  const kinds = new Set(indexes.map(triggerAt).filter(Boolean).map((t) => t.trigger));
  if (trigger && (kinds.has('any') || (kinds.has('physical') && kinds.has('magical')))) trigger = { trigger: 'any' };
  if (!trigger) { skipped.noTrigger.push(pt.name); continue; }
  effects.push({ id: item.id, name: pt.name, chance: number(RATE.exec(line)[1]), duration: number(DURATION.exec(line)[1]), ...trigger });
}
effects.sort((a, b) => a.id - b.id);

const body = effects.map((effect) => {
  const skill = effect.skill ? `, skill: ${JSON.stringify(effect.skill)}` : '';
  return `  ${effect.id}: { chance: ${effect.chance}, duration: ${effect.duration}, trigger: '${effect.trigger}'${skill} }, // ${effect.name}`;
}).join('\n');

writeFileSync(OUT, `// Gerado por tools/build-chance-effects.mjs — não edite à mão.
// Efeitos de ativação (\`chance__*\`) com gatilho explícito na descrição pt-BR.

export type ChanceTrigger = 'physical' | 'magical' | 'any' | 'skill';

export interface ChanceEffect {
  /** Chance por tentativa, em %. */
  chance: number;
  /** Duração, em segundos. */
  duration: number;
  /** \`physical\`/\`magical\`/\`any\`: sorteia a cada golpe desse tipo; \`skill\`: a cada uso de \`skill\`. */
  trigger: ChanceTrigger;
  /** Nome pt-BR da skill que ativa (gatilho \`skill\`). */
  skill?: string;
}

export const CHANCE_EFFECTS: Readonly<Record<number, ChanceEffect>> = {
${body}
};
`);

console.log(`${effects.length} efeitos com gatilho → ${OUT}`);
console.log(`fora: ${skipped.noTrigger.length} sem gatilho, ${skipped.noRateOrDuration.length} sem chance/duração; ${skipped.multiple.length} com mais de uma linha (usa a primeira)`);
if (report) console.log(JSON.stringify(skipped, null, 2));

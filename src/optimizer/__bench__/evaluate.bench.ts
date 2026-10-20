/**
 * Benchmark do avaliador: quantas builds por segundo o motor consegue pontuar.
 * É o número que define os orçamentos de busca do otimizador.
 *
 *   bun src/optimizer/__bench__/evaluate.bench.ts
 *   (ou: npx tsx src/optimizer/__bench__/evaluate.bench.ts)
 */
import { readFileSync } from 'node:fs';
import { canUsedByClass } from 'src/app/utils/can-used-by-class';
import { BuildEvaluator } from '../evaluate';
import { itemDb, windhawkContext, windhawkModel } from '../__tests__/windhawk-build';

const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
// Um alvo real com defesas: Ifrit (1832) se existir, senão o primeiro MVP da base.
const monster = monsters[1832] ?? Object.values<any>(monsters).find((m) => m.stats?.mvp) ?? Object.values(monsters)[0];

const context = windhawkContext({ hpSpTable, monster });
const evaluator = new BuildEvaluator(context, 0);
const base = windhawkModel(130);

const time = (label: string, runs: number, build: (i: number) => any) => {
  const before = evaluator.stats.engineMs;
  for (let i = 0; i < runs; i++) evaluator.evaluate(build(i));
  const ms = evaluator.stats.engineMs - before;
  console.log(`${label.padEnd(34)} ${runs} avaliações  ${(ms / runs).toFixed(2)} ms/aval  ${Math.round(runs / (ms / 1000))} aval/s`);
};

// Aquecimento (JIT).
time('aquecimento', 50, (i) => ({ ...base, dex: 100 + (i % 30) }));

time('variando atributos', 500, (i) => ({ ...base, dex: 80 + (i % 50), agi: 60 + (i % 40) }));

// Troca de capa entre itens que a classe pode usar: exercita setItem/scripts de verdade.
const garments = Object.values<any>(itemDb)
  .filter((item) => item.location === 'Garment')
  .filter(canUsedByClass(context.character))
  .slice(0, 300);
if (garments.length) time(`trocando capa (${garments.length} itens)`, garments.length, (i) => ({ ...base, garment: garments[i].id }));

console.log('final', evaluator.evaluate(base));

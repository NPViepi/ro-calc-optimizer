/** Modo exato no escopo completo (Guerrilheiro 240, Artilharia Pesada): mostra o tamanho do espaço e o ritmo. */
import { BuildEvaluator } from '../evaluate';
import { prepareSession } from '../runtime';
import { appShapedData } from '../__tests__/app-data';
import { MAGAZINE_FOR_ONE, nightWatchModel } from '../__tests__/nightwatch-build';
import { optimizeExact } from '../exact/optimize';

console.log = (() => { const log = console.log; return (...args: unknown[]) => { if (typeof args[0] === 'string') log(...args); }; })();
const data = appShapedData();
const session = prepareSession(data, { preset: JSON.parse(JSON.stringify(nightWatchModel())), monsterId: 1832, skillValue: MAGAZINE_FOR_ONE });
const evaluator = new BuildEvaluator(session.context);
const result = await optimizeExact(evaluator, session.context, session.model, {
  objective: 'dps', seedTimeMs: 15_000, timeLimitMs: 20_000, placement: { defaultRefine: { equip: 10, shadow: 10, accessory: 0 } },
});
console.log(`status ${result.status} · espaço ~10^${result.spaceLog10.toFixed(0)} · DPS ${result.damageBefore.toFixed(0)} → semente ${result.seedScore.damage.toFixed(0)} → ${result.damage.toFixed(0)}`);
console.log(`folhas ${result.stats.leaves} · nós ${result.stats.nodes} · podas ${JSON.stringify(result.stats.pruned)} · progresso ${result.stats.progress.toExponential(2)} · ${(result.elapsedMs / 1000).toFixed(1)} s`);

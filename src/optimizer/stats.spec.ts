import { describe, expect, it } from 'vitest';
import { BaseStateCalculator } from 'src/app/core/base-state-calculator';
import { MAIN_STAT_KEYS, TRAIT_KEYS } from 'src/app/constants/trait-keys';
import { BuildEvaluator } from './evaluate';
import { damageScore } from './objective';
import { allocationOf, optimizeStats, StatAllocation, statBudget, usedMainPoints, usedTraitPoints } from './stats';
import { windhawkContext, windhawkModel } from './__tests__/windhawk-build';
import { ENGINE_TIMEOUT } from './__tests__/timeouts';

const context = windhawkContext();
const evaluator = new BuildEvaluator(context);

/** Pontos restantes pela conta do próprio upstream (a mesma da tela). */
function upstreamPointsLeft(model: any) {
  const { str, agi, vit, int, dex, luk, pow, sta, wis, spl, con, crt } = model;
  return new BaseStateCalculator().setClass(context.character).setLevel(model.level)
    .setMainStatusLevels([str, agi, vit, int, dex, luk])
    .setTraitStatusLevels([pow, sta, wis, spl, con, crt])
    .calculate().summary;
}

/** Gerador determinístico para o teste de amostragem aleatória. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('statBudget', () => {
  it('usa as mesmas regras de pontos do upstream', () => {
    const budget = statBudget(context.character, 230);
    const summary = upstreamPointsLeft({ ...windhawkModel(1), str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1, pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 });

    expect(budget.mainTotal).toBe(summary.totalPoint);
    expect(budget.traitTotal).toBe(summary.totalTraitPoint);
    expect(budget.mainCost[1]).toBe(0);
    expect(budget.mainCost[130]).toBeGreaterThan(budget.mainCost[100]);
  }, ENGINE_TIMEOUT);
});

describe('optimizeStats', () => {
  it('nunca piora a build e respeita o orçamento e os limites', () => {
    const model = windhawkModel(130);
    const result = optimizeStats(evaluator, model, context.character, { objective: 'dps' });
    const left = upstreamPointsLeft(result.model);

    expect(result.damage).toBeGreaterThanOrEqual(result.damageBefore);
    expect(left.availablePoint).toBeGreaterThanOrEqual(0);
    expect(left.availableTraitPoint).toBeGreaterThanOrEqual(0);
    expect(left.availablePoint).toBe(result.mainPointsLeft);
    for (const key of MAIN_STAT_KEYS) expect(result.model[key]).toBeGreaterThanOrEqual(1);
    for (const key of MAIN_STAT_KEYS) expect(result.model[key]).toBeLessThanOrEqual(130);
    for (const key of TRAIT_KEYS) expect(result.model[key]).toBeLessThanOrEqual(100);
    // Só os atributos mudam.
    expect({ ...result.model, ...allocationOf(model) }).toEqual({ ...model, ...allocationOf(model) });
  }, ENGINE_TIMEOUT);

  it('conserta uma distribuição ruim (tudo em VIT)', () => {
    const bad = { ...windhawkModel(1), str: 1, agi: 1, vit: 130, int: 1, dex: 1, luk: 1 };
    const result = optimizeStats(evaluator, bad, context.character, { objective: 'avg' });

    expect(result.damage).toBeGreaterThan(result.damageBefore * 1.2);
    expect(result.changes.find((change) => change.key === 'dex')?.to).toBeGreaterThan(1);
  }, ENGINE_TIMEOUT);

  it('respeita atributos travados e mínimos', () => {
    const model = windhawkModel(130);
    const result = optimizeStats(evaluator, model, context.character, {
      objective: 'dps', locked: ['int'], minimum: { vit: 90 },
    });

    expect(result.model.int).toBe(model.int);
    expect(result.model.vit).toBeGreaterThanOrEqual(90);
    expect(result.changes.map((change) => change.key)).not.toContain('int');
  }, ENGINE_TIMEOUT);

  it('nenhuma de 150 distribuições aleatórias válidas supera o resultado', () => {
    const model = windhawkModel(130);
    const result = optimizeStats(evaluator, model, context.character, { objective: 'dps' });
    const budget = statBudget(context.character, model.level);
    const random = mulberry32(42);

    for (let i = 0; i < 150; i++) {
      const alloc = { ...allocationOf(model) } as StatAllocation;
      for (const key of MAIN_STAT_KEYS) alloc[key] = 1;
      for (const key of TRAIT_KEYS) alloc[key] = 0;
      // Distribui pontos aleatoriamente até o orçamento acabar.
      for (let guard = 0; guard < 5000; guard++) {
        const key = MAIN_STAT_KEYS[Math.floor(random() * MAIN_STAT_KEYS.length)];
        if (alloc[key] >= budget.maxMain) continue;
        const next = { ...alloc, [key]: alloc[key] + 1 };
        if (usedMainPoints(next, budget) > budget.mainTotal) break;
        Object.assign(alloc, next);
      }
      for (let guard = 0; guard < 500 && usedTraitPoints(alloc) < budget.traitTotal; guard++) {
        const key = TRAIT_KEYS[Math.floor(random() * TRAIT_KEYS.length)];
        if (alloc[key] < budget.maxTrait) alloc[key]++;
      }
      const score = damageScore(evaluator.evaluate({ ...model, ...alloc }), 'dps');
      expect(score).toBeLessThanOrEqual(result.damage);
    }
  }, ENGINE_TIMEOUT);

  it('para no teto de avaliações e avisa', () => {
    const result = optimizeStats(new BuildEvaluator(context), windhawkModel(1), context.character, { maxEvaluations: 20 });

    expect(result.truncated).toBe(true);
    expect(result.evaluations).toBeLessThanOrEqual(20);
    expect(result.damage).toBeGreaterThanOrEqual(result.damageBefore);
  }, ENGINE_TIMEOUT);
});

import { describe, expect, it } from 'vitest';
import { BuildEvaluator, BuildMetrics } from './evaluate';
import { checkConstraints, isBetter, isFeasible, scoreOf } from './objective';
import { optimizeStats } from './stats';
import { windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const context = windhawkContext();
const evaluator = new BuildEvaluator(context);

const metrics = (overrides: Partial<BuildMetrics>): BuildMetrics => ({
  skillValue: 'x', damageMin: 100, damageMax: 200, damageAvg: 150, dps: 300, hitsPerSec: 2, totalHits: 1,
  vct: 0.5, fct: 0.3, acd: 0.4, cd: 0, castPeriod: 0.8, hitPeriod: 1.2, acdPercent: 10, baseAcd: 0.4, fctReduction: 0, vctPercent: 0, baseFct: 0.3, baseVct: 0.5, fctFactor: 1, vctByStat: 1, vctFlat: 0, dex2Int1: 400, timingUnknown: false,
  ...overrides,
});

describe('restrições de tempo (objective)', () => {
  it('mede quanto cada tempo passa do limite', () => {
    const checks = checkConstraints(metrics({}), { maxVct: 0.2, maxFct: 0.3, maxAcd: 1 });

    expect(checks.map((c) => [c.key, c.ok])).toEqual([['maxVct', false], ['maxFct', true], ['maxAcd', true]]);
    expect(checks[0].excess).toBeCloseTo(0.3, 3);
  });

  it('ignora limites não informados e tolera o arredondamento do motor', () => {
    expect(checkConstraints(metrics({}), {})).toEqual([]);
    expect(checkConstraints(metrics({ vct: 0.20005 }), { maxVct: 0.2 })[0].ok).toBe(true);
  });

  it('cumprir os limites vale mais que qualquer dano', () => {
    const feasibleWeak = scoreOf(metrics({ vct: 0, damageAvg: 10 }), 'avg', { maxVct: 0 });
    const strongButSlow = scoreOf(metrics({ vct: 0.1, damageAvg: 99999 }), 'avg', { maxVct: 0 });
    const closer = scoreOf(metrics({ vct: 0.05, damageAvg: 1 }), 'avg', { maxVct: 0 });

    expect(isFeasible(feasibleWeak)).toBe(true);
    expect(isBetter(feasibleWeak, strongButSlow)).toBe(true);
    expect(isBetter(closer, strongButSlow)).toBe(true);
    expect(isBetter(strongButSlow, closer)).toBe(false);
  });
});

describe('optimizeStats com restrições', () => {
  const model = windhawkModel(130);
  const free = optimizeStats(evaluator, model, context.character, { objective: 'dps' });

  it('cumpre um limite alcançável e, dentro dele, maximiza o dano', () => {
    const limit = 0.05;
    const result = optimizeStats(evaluator, model, context.character, { objective: 'dps', constraints: { maxVct: limit } });

    expect(result.feasible).toBe(true);
    expect(result.metrics.vct).toBeLessThanOrEqual(limit + 1e-4);
    expect(result.constraints).toEqual([expect.objectContaining({ key: 'maxVct', ok: true })]);
    // A build inicial já cumpria o limite, então o resultado não pode ser pior que ela.
    // (Não comparamos com a busca livre: as duas são heurísticas e podem parar em ótimos
    // locais diferentes — num caso real a restrita achou +0,016% a mais.)
    expect(result.constraintsBefore[0].ok).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(result.damageBefore);
  });

  it('sem como cumprir só com atributos, entrega a build mais próxima e avisa', () => {
    // 2·DES + INT não chega a 530 nem com DES e INT no máximo: variável 0 é impossível aqui.
    const result = optimizeStats(evaluator, model, context.character, { objective: 'dps', constraints: { maxVct: 0 } });

    expect(result.feasible).toBe(false);
    expect(result.model.dex).toBe(130);
    expect(result.model.int).toBe(130);
    expect(result.metrics.vct).toBeLessThan(result.before.vct);
    expect(result.constraints[0]).toMatchObject({ key: 'maxVct', ok: false });
  });

  it('parte de uma build longe do limite e corrige', () => {
    const bad = { ...model, dex: 1, int: 1, str: 130 };
    const result = optimizeStats(evaluator, bad, context.character, { objective: 'dps', constraints: { maxVct: 0.05 } });

    expect(result.constraintsBefore[0].ok).toBe(false);
    expect(result.feasible).toBe(true);
  });

  it('limite que atributos não alteram (pós-conjuração) não atrapalha o dano', () => {
    const result = optimizeStats(evaluator, model, context.character, { objective: 'dps', constraints: { maxAcd: 0.1 } });

    expect(result.feasible).toBe(false);
    expect(result.constraints[0]).toMatchObject({ key: 'maxAcd', ok: false });
    expect(result.damage).toBeCloseTo(free.damage, 6);
  });
});

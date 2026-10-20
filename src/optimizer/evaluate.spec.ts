import { describe, expect, it } from 'vitest';
import { solveInstintoBuild } from 'src/app/core/__tests__/instinto-build';
import { BuildEvaluator, readMetrics, stableKey } from './evaluate';
import { windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const SKILL = 'Focused Arrow Strike==5';

describe('BuildEvaluator', () => {
  it('dá o mesmo resultado que o fixture do upstream (caminho do prepare())', () => {
    for (const dex of [60, 130]) {
      const reference = readMetrics(solveInstintoBuild({ dex, selectedChances: [] }).calc, SKILL);
      const metrics = new BuildEvaluator(windhawkContext()).evaluate(windhawkModel(dex));

      expect(metrics).toEqual(reference);
      expect(metrics.damageMax).toBeGreaterThan(0);
    }
  });

  it('não vaza estado entre avaliações intercaladas no mesmo Calculator', () => {
    // cacheSize 0: força o motor a recalcular sempre.
    const evaluator = new BuildEvaluator(windhawkContext(), 0);
    const first = evaluator.evaluate(windhawkModel(60));
    evaluator.evaluate(windhawkModel(130));
    const noWeapon = { ...windhawkModel(130), weapon: undefined, weaponRefine: 0 };
    evaluator.evaluate(noWeapon as any);
    const again = evaluator.evaluate(windhawkModel(60));

    expect(again).toEqual(first);
    expect(evaluator.stats.cacheHits).toBe(0);
  });

  it('reage aos atributos: mais DES reduz a conjuração variável', () => {
    const evaluator = new BuildEvaluator(windhawkContext());
    const low = evaluator.evaluate(windhawkModel(60));
    const high = evaluator.evaluate(windhawkModel(130));

    expect(high.dex2Int1).toBeGreaterThan(low.dex2Int1);
    expect(high.vct).toBeLessThanOrEqual(low.vct);
    expect(high.damageAvg).toBeGreaterThan(low.damageAvg);
  });

  it('usa o cache para builds iguais, mesmo com as chaves em outra ordem', () => {
    const evaluator = new BuildEvaluator(windhawkContext());
    const model = windhawkModel(100);
    const reordered = Object.fromEntries(Object.entries(model).reverse()) as typeof model;

    const a = evaluator.evaluate(model);
    const b = evaluator.evaluate(reordered);

    expect(stableKey(model)).toBe(stableKey(reordered));
    expect(b).toBe(a);
    expect(evaluator.stats).toMatchObject({ evaluations: 2, cacheHits: 1 });
  });

  it('não altera o modelo recebido', () => {
    const model = windhawkModel(100);
    const before = structuredClone(model);
    new BuildEvaluator(windhawkContext()).evaluate(model);

    expect(model).toEqual(before);
  });
});

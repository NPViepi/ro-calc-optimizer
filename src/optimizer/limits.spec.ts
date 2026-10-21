import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { decodeShared } from 'src/app/core/share-codec';
import { readShareToken } from 'src/app/core/share-path';
import { raiseToLimits } from './candidates';
import { BuildEvaluator } from './evaluate';
import { optimizeBuild } from './items';
import { checkConstraints, dpsWithAcdTarget, isBetter, scoreOf } from './objective';
import { runOptimization } from './runtime';
import { appShapedData } from './__tests__/app-data';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const context = windhawkContext({ items: latamItemDb });
const ACD_HAT = 400001; // Victorious Wing Ears: Pós-conjuração -8%

describe('redução de pós-conjuração em %', () => {
  const evaluator = new BuildEvaluator(context, 0);

  it('a métrica é o "Pós-conjuração -X%" total que o motor soma', () => {
    const base = evaluator.evaluate(windhawkModel(130));
    const withHelmet = evaluator.evaluate({ ...windhawkModel(130), headUpper: ACD_HAT } as any);
    expect(withHelmet.acdPercent).toBeGreaterThan(base.acdPercent);
    // E ela reduz a pós em segundos na mesma direção.
    expect(withHelmet.acd).toBeLessThan(base.acd);
  });

  it('limite mínimo: abaixo do pedido falha, igual ou acima cumpre', () => {
    const metrics = evaluator.evaluate({ ...windhawkModel(130), headUpper: ACD_HAT } as any);
    const [ok] = checkConstraints(metrics, { minAcdPercent: metrics.acdPercent });
    const [bad] = checkConstraints(metrics, { minAcdPercent: metrics.acdPercent + 5 });
    expect(ok).toMatchObject({ kind: 'min', unit: '%', ok: true });
    expect(bad.ok).toBe(false);
    expect(bad.excess).toBeCloseTo(5, 4);
    // Cumprir vale mais que dano.
    expect(isBetter(scoreOf(metrics, 'dps', { minAcdPercent: metrics.acdPercent }), scoreOf(metrics, 'dps', { minAcdPercent: metrics.acdPercent + 5 }))).toBe(true);
  });

  it('a busca troca itens para chegar à redução pedida', () => {
    const before = evaluator.evaluate(windhawkModel(130));
    const result = optimizeBuild(new BuildEvaluator(context), context, windhawkModel(130), {
      objective: 'dps', constraints: { minAcdPercent: before.acdPercent + 5 }, slots: [ItemTypeEnum.headUpper],
      optimizeStats: false, optimizeSets: false, optimizeCards: false, optimizeEnchants: false,
    });
    expect(result.constraintsBefore[0].ok).toBe(false);
    expect(result.feasible).toBe(true);
    expect(result.metrics.acdPercent).toBeGreaterThanOrEqual(before.acdPercent + 5);
  }, 60_000);
});

describe('meta de pós: o que passa da meta não vale DPS', () => {
  const evaluator = new BuildEvaluator(context, 0);
  // Pós de 0,45 s com 10% de redução; recarga 0,15 s.
  const metrics = evaluator.evaluate({ ...windhawkModel(130), headUpper: ACD_HAT } as any);

  it('abaixo da meta (ou sem meta), o DPS é o do motor', () => {
    expect(dpsWithAcdTarget(metrics, undefined)).toBe(metrics.dps);
    expect(dpsWithAcdTarget(metrics, metrics.acdPercent + 10)).toBe(metrics.dps);
  });

  it('acima da meta, o DPS é recalculado com a pós da meta', () => {
    const target = metrics.acdPercent - 8;
    const capped = dpsWithAcdTarget(metrics, target);
    const unreduced = metrics.acd / (1 - metrics.acdPercent / 100);
    const period = Math.max(metrics.cd, unreduced * (1 - target / 100)) + metrics.castPeriod;
    expect(capped).toBeLessThan(metrics.dps);
    expect(capped).toBeCloseTo(metrics.dps * (metrics.hitPeriod / period), 6);
    // A pontuação com objetivo DPS usa esse valor.
    expect(scoreOf(metrics, 'dps', { minAcdPercent: target }).damage).toBeCloseTo(capped, 6);
  });

  it('na busca, a meta é cumprida', () => {
    const goal = 30;
    const result = optimizeBuild(new BuildEvaluator(context), context, windhawkModel(130), {
      objective: 'dps', constraints: { minAcdPercent: goal }, optimizeStats: false, optimizeSets: false,
      slots: [ItemTypeEnum.headUpper, ItemTypeEnum.headMiddle, ItemTypeEnum.garment, ItemTypeEnum.accLeft, ItemTypeEnum.accRight],
      optimizeCards: false, optimizeEnchants: false,
    });
    expect(result.feasible).toBe(true);
    expect(result.metrics.acdPercent).toBeGreaterThanOrEqual(goal);
  }, 120_000);
});

describe('refino e grau máximos', () => {
  const { items } = context;

  it('leva os itens atuais ao máximo sem nunca baixar', () => {
    const model = { ...windhawkModel(130), weapon: 700045, weaponRefine: 11, accLeft: 2630 } as any; // Brisingamen não refina
    const higher = raiseToLimits(model, items, [ItemTypeEnum.weapon, ItemTypeEnum.accLeft], { defaultRefine: { equip: 15, accessory: 15 }, defaultGrade: 'A' });
    expect(higher.weaponRefine).toBe(15);
    expect(higher.weaponGrade).toBe('A');
    expect(higher.accLeftRefine ?? 0).toBe(0);

    const lower = raiseToLimits(model, items, [ItemTypeEnum.weapon], { defaultRefine: { equip: 9 } });
    expect(lower.weaponRefine).toBe(11);
    expect(model.weaponRefine).toBe(11); // não altera o modelo recebido
  });

  it('no runtime: o "antes" continua sendo a build real e a mudança de refino aparece e entra na comparação', () => {
    const data = appShapedData();
    const preset = JSON.parse(JSON.stringify({ ...windhawkModel(130), weapon: 700045, weaponRefine: 7 }));
    const response = runOptimization(data, {
      preset, monsterId: 1832, objective: 'dps', slots: [], optimizeStats: false,
      defaultRefine: { equip: 15 }, applyLimitsToCurrent: true,
    });
    const realBefore = new BuildEvaluator({ ...context, items: data.items, monster: data.monsters[1832], hpSpTable: data.hpSpTable })
      .evaluate({ ...windhawkModel(130), weapon: 700045, weaponRefine: 7 } as any);
    expect(response.before.damageAvg).toBe(realBefore.damageAvg);
    expect(response.changes).toContainEqual(expect.objectContaining({ from: '+7', to: '+15' }));
    const compared = decodeShared(readShareToken(`https://x${response.comparePath}`));
    expect(compared?.compare?.itemNames).toContain('weapon');
    expect(compared?.compare?.model2).toMatchObject({ weaponRefine: 15 });
  }, 60_000);
});

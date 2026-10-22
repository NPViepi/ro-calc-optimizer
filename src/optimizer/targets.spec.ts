import { describe, expect, it } from 'vitest';
import { BuildEvaluator } from './evaluate';
import { checkConstraints, dpsAtTargets } from './objective';
import { buildCatalog, isGodlyItem, WeaponRulesProbe } from './candidates';
import { prepareSession, runOptimization } from './runtime';
import { appShapedData } from './__tests__/app-data';
import { MAGAZINE_FOR_ONE, nightWatchModel } from './__tests__/nightwatch-build';
import { ENGINE_TIMEOUT } from './__tests__/timeouts';

const data = appShapedData();
const preset = JSON.parse(JSON.stringify(nightWatchModel()));
const session = prepareSession(data, { preset, monsterId: 1832 });
const evaluator = new BuildEvaluator(session.context, 0);
const FIXA_1 = 29056; // encant. de visual da capa: fixa −0,5 s

describe('metas de redução (Guerrilheiro, Artilharia Pesada)', () => {
  it('a skill tem 1 s de fixa e 1 s de pós sem redução', () => {
    const metrics = evaluator.evaluate(session.model, MAGAZINE_FOR_ONE);
    expect(metrics.baseFct).toBe(1);
    expect(metrics.baseAcd).toBe(1);
    expect(metrics.fctReduction).toBe(0);
  }, ENGINE_TIMEOUT);

  it('a redução de fixa soma os "-X s" e é a mesma que o motor usa', () => {
    const metrics = evaluator.evaluate({ ...session.model, costumeEnchantGarment: FIXA_1 } as any, MAGAZINE_FOR_ONE);
    expect(metrics.fctReduction).toBeCloseTo(0.5, 6);
    expect(metrics.fct).toBeCloseTo(0.5, 3); // o motor arredonda (0,4999)
    const [check] = checkConstraints(metrics, { minFctReduction: 1 });
    expect(check).toMatchObject({ label: 'Redução de fixa', unit: 's', ok: false });
    expect(check.excess).toBeCloseTo(0.5, 3); // menos a tolerância de 0,0001 s
  }, ENGINE_TIMEOUT);

  it('fixa reduzida além da meta não aumenta o DPS usado na comparação', () => {
    const metrics = evaluator.evaluate({ ...session.model, costumeEnchantGarment: FIXA_1, costumeEnchantGarment2: 310658 } as any, MAGAZINE_FOR_ONE);
    expect(metrics.fctReduction).toBeGreaterThan(0.5);
    const atHalf = dpsAtTargets(metrics, { minFctReduction: 0.5 });
    expect(atHalf).toBeLessThan(metrics.dps);
    expect(dpsAtTargets(metrics, { minFctReduction: 5 })).toBe(metrics.dps);
  }, ENGINE_TIMEOUT);

  it('a busca atinge as metas e não passa dos tetos', () => {
    const response = runOptimization(data, {
      preset, monsterId: 1832, objective: 'dps', timeLimitMs: 45_000,
      constraints: { minAcdPercent: 40, maxAcdPercent: 45, minFctReduction: 1, maxFctReduction: 1.3 },
    });
    expect(response.feasible).toBe(true);
    expect(response.after.acdPercent).toBeGreaterThanOrEqual(40);
    expect(response.after.acdPercent).toBeLessThanOrEqual(45);
    expect(response.after.fctReduction).toBeGreaterThanOrEqual(1);
    expect(response.after.fctReduction).toBeLessThanOrEqual(1.3 + 1e-6);
    expect(response.after.fct).toBe(0); // 1 s de fixa da skill − 1 s de redução
  }, 180_000);
});

describe('armas aceitas pela skill e itens divinos', () => {
  const { items, character } = session.context;
  const catalog = buildCatalog(items, character, {});

  it('Artilharia Pesada aceita revólver e metralhadora (regra da própria skill), nada além', () => {
    const skill = (character.getAtkSkills() as any[]).find((entry) => entry.name === 'Magazine for One');
    const probe = new WeaponRulesProbe(items, character);
    const accepted = (catalog.weapon ?? []).filter((id) => probe.accepts(id, skill.verifyItemFn, session.model));
    const types = new Set(accepted.map((id) => items[id].itemSubTypeId));
    expect(types).toEqual(new Set([273, 275])); // Revolver, Gatling Gun
    expect((catalog.weapon ?? []).some((id) => items[id].itemSubTypeId === 274)).toBe(true); // há rifles no catálogo…
    expect(accepted.some((id) => items[id].itemSubTypeId === 274)).toBe(false); // …mas a skill não aceita
  }, ENGINE_TIMEOUT);

  it('itens divinos ficam fora por padrão e entram com a opção', () => {
    for (const id of [2629, 2630, 2410, 1530]) expect(isGodlyItem(items[id])).toBe(true);
    const all = (c: Record<string, number[] | undefined>) => Object.values(c).flatMap((ids) => ids ?? []);
    expect(all(catalog).some((id) => isGodlyItem(items[id]))).toBe(false);
    const withGodly = buildCatalog(items, character, { allowGodlyItems: true });
    expect(all(withGodly)).toEqual(expect.arrayContaining([2629, 2630]));
  }, ENGINE_TIMEOUT);
});

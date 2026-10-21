import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { decodeShared } from 'src/app/core/share-codec';
import { readShareToken } from 'src/app/core/share-path';
import { buildCatalog, slotsForItem } from './candidates';
import { BuildEvaluator } from './evaluate';
import { defaultSlots, optimizeBuild } from './items';
import { runOptimization } from './runtime';
import { appShapedData } from './__tests__/app-data';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const context = windhawkContext({ items: latamItemDb });
const { items, character } = context;
const FIXA_1 = 29056; // Encantamento de visual da capa: conjuração fixa −0,5 s
const AIMED_BOLT = 'Aimed Bolt==10'; // Disparo Certeiro: 0,5 s de fixa

describe('visuais e encantamentos de visual', () => {
  const catalog = buildCatalog(items, character, { maxRequiredLevel: 230 });

  it('encantamentos de visual vão para os seus slots (eram ignorados por serem do tipo carta)', () => {
    expect(slotsForItem(items[FIXA_1])).toEqual([ItemTypeEnum.costumeEnchantGarment]);
    expect(catalog.costumeEnchantGarment).toContain(FIXA_1);
    expect(catalog.costumeEnchantUpper?.length).toBeGreaterThan(0);
    expect(catalog.costumeEnchantMiddle?.length).toBeGreaterThan(0);
    expect(catalog.costumeEnchantLower?.length).toBeGreaterThan(0);
  });

  it('por padrão a busca mexe nos encantamentos de visual, nunca nos visuais (bônus de visual não conta)', () => {
    const slots = defaultSlots();
    expect(slots).toEqual(expect.arrayContaining([ItemTypeEnum.costumeEnchantUpper, ItemTypeEnum.costumeEnchantGarment]));
    for (const visual of [ItemTypeEnum.costumeUpper, ItemTypeEnum.costumeMiddle, ItemTypeEnum.costumeLower, ItemTypeEnum.costumeGarment]) {
      expect(slots).not.toContain(visual);
    }
    expect(defaultSlots({ includeCostumes: false }).some((slot) => slot.startsWith('costume'))).toBe(false);
  });

  it('o catálogo de visuais só traz os que têm bônus', () => {
    for (const slot of [ItemTypeEnum.costumeUpper, ItemTypeEnum.costumeLower, ItemTypeEnum.costumeGarment] as const) {
      for (const id of catalog[slot] ?? []) expect(Object.keys(items[id].script ?? {}).length).toBeGreaterThan(0);
    }
  });

  it('o motor conta o encantamento de visual: "Fixa 1" zera os 0,5 s do Disparo Certeiro', () => {
    const evaluator = new BuildEvaluator(context, 0);
    const before = evaluator.evaluate(windhawkModel(130), AIMED_BOLT);
    const after = evaluator.evaluate({ ...windhawkModel(130), costumeEnchantGarment: FIXA_1 } as any, AIMED_BOLT);
    expect(before.fct).toBeCloseTo(0.5, 4);
    expect(after.fct).toBe(0);
  });

  it('a busca usa encantamento de visual para cumprir limite de fixa', () => {
    const model = { ...windhawkModel(130), selectedAtkSkill: AIMED_BOLT, rotation: [AIMED_BOLT] } as any;
    const result = optimizeBuild(new BuildEvaluator(context), context, model, {
      objective: 'dps', constraints: { maxFct: 0 },
      slots: [ItemTypeEnum.costumeEnchantGarment, ItemTypeEnum.costumeEnchantGarment2],
      optimizeStats: false, optimizeSets: false,
    });
    expect(result.constraintsBefore[0].ok).toBe(false);
    expect(result.feasible).toBe(true);
    expect(result.metrics.fct).toBe(0);
  }, 60_000);

  it('o runtime avisa que o encantamento precisa de um visual e o link de comparação o inclui', () => {
    const data = appShapedData();
    const preset = JSON.parse(JSON.stringify({ ...windhawkModel(130), selectedAtkSkill: AIMED_BOLT, rotation: [AIMED_BOLT] }));
    const response = runOptimization(data, {
      preset, monsterId: 1832, objective: 'dps', constraints: { maxFct: 0 }, optimizeStats: false, optimizeSets: false,
      slots: [ItemTypeEnum.costumeEnchantGarment],
    });
    expect(response.feasible).toBe(true);
    expect(response.warnings.some((warning) => warning.includes('precisa de um visual'))).toBe(true);
    const compared = decodeShared(readShareToken(`https://x${response.comparePath}`));
    expect(compared?.compare?.itemNames).toContain('costumeEnchantGarment');
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { placeItem, WeaponRulesProbe } from './candidates';
import { BuildEvaluator } from './evaluate';
import { optimizeBuild } from './items';
import { findMvpCards } from './mvp-cards';
import { buildDefaults, runOptimization } from './runtime';
import { appShapedData } from './__tests__/app-data';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const context = windhawkContext({ items: latamItemDb });
const { items, character } = context;
const probe = new WeaponRulesProbe(items, character);

const ROYAL_BOW = 700045; // itemLevel 5? (testado abaixo pelo canGrade)
const THANOS_BOW = 700029;
const BRISINGAMEN = 2630; // acessório não refinável
const SHADOW_ARMOR = 24663;

describe('refino e grau dos itens colocados', () => {
  it('item novo em slot vazio usa o refino padrão (antes ficava +0)', () => {
    const model = { ...windhawkModel(130), armor: undefined, armorRefine: 0 } as any;
    const placed = placeItem(model, ItemTypeEnum.armor, 450127, items, probe, { defaultRefine: { equip: 12 } });
    expect(placed.armorRefine).toBe(12);

    const sem = placeItem(model, ItemTypeEnum.armor, 450127, items, probe);
    expect(sem.armorRefine).toBe(0);
  });

  it('respeita os tetos da tela e acessório não refinável fica +0', () => {
    const model = windhawkModel(130);
    expect(placeItem(model, ItemTypeEnum.shadowArmor, SHADOW_ARMOR, items, probe, { defaultRefine: { shadow: 15 } }).shadowArmorRefine).toBe(10);
    expect(placeItem(model, ItemTypeEnum.weapon, ROYAL_BOW, items, probe, { defaultRefine: { equip: 25 } }).weaponRefine).toBe(18);
    expect(items[BRISINGAMEN].isRefinable).toBeFalsy();
    expect(placeItem(model, ItemTypeEnum.accLeft, BRISINGAMEN, items, probe, { defaultRefine: { accessory: 10 } }).accLeftRefine).toBe(0);
  });

  it('grau só em item que aceita grau; sem padrão, mantém o grau que o slot tinha', () => {
    const gradeable = [THANOS_BOW, ROYAL_BOW, 700016].find((id) => items[id].itemLevel === 5);
    const plain = [700016, ROYAL_BOW, THANOS_BOW].find((id) => items[id].itemLevel !== 5);
    // Arma diferente de todas as testadas, para que cada uma seja uma troca de verdade.
    const model = { ...windhawkModel(130), weapon: 700001, weaponGrade: 'B' } as any;
    if (gradeable) {
      expect(placeItem(model, ItemTypeEnum.weapon, gradeable, items, probe, { defaultGrade: 'A' }).weaponGrade).toBe('A');
      expect(placeItem(model, ItemTypeEnum.weapon, gradeable, items, probe).weaponGrade).toBe('B');
    }
    if (plain) expect(placeItem(model, ItemTypeEnum.weapon, plain, items, probe, { defaultGrade: 'A' }).weaponGrade).toBeUndefined();
  });

  it('o motor conta refino e grau (sanidade)', () => {
    const evaluator = new BuildEvaluator(context, 0);
    const base = windhawkModel(130);
    const plus0 = evaluator.evaluate({ ...base, weaponRefine: 0 }).damageAvg;
    const plus15 = evaluator.evaluate({ ...base, weaponRefine: 15 }).damageAvg;
    expect(plus15).toBeGreaterThan(plus0);
  });

  it('a busca coloca os itens com o refino pedido', () => {
    const result = optimizeBuild(new BuildEvaluator(context), context, windhawkModel(130), {
      objective: 'dps', slots: [ItemTypeEnum.armor, ItemTypeEnum.garment], optimizeStats: false, optimizeSets: false,
      shortlistSize: 3, cardShortlistSize: 2, maxRounds: 1, placement: { defaultRefine: { equip: 11 } },
    });
    for (const change of result.itemChanges) {
      if (change.to) expect((result.model as any)[`${change.slot}Refine`]).toBe(11);
    }
    expect(result.itemChanges.length).toBeGreaterThan(0);
  }, 60_000);

  it('sugestões do painel vêm da build atual', () => {
    const model = { ...windhawkModel(130), shadowArmor: SHADOW_ARMOR, shadowArmorRefine: 7, weaponGrade: 'C' } as any;
    expect(buildDefaults(model)).toEqual({ equipRefine: 11, shadowRefine: 7, grade: 'C' });
  });
});

describe('cartas MVP', () => {
  const data = appShapedData();
  const mvp = findMvpCards(data.items, data.monsters);

  it('detecta pelos nomes do LATAM, sem confundir variações', () => {
    expect(mvp.has(4147)).toBe(true); // Carta Bafomé
    expect(mvp.has(4430)).toBe(true); // Carta Ifrit
    expect(mvp.has(4121)).toBe(true); // Carta Freeoni
    expect(mvp.has(4361)).toBe(true); // Mestre-ferreiro Howard (correção manual: "Harword" no LATAM)
    expect(mvp.has(4129)).toBe(false); // Carta Bafomé Jr. — não é MVP
    expect(mvp.has(4001)).toBe(false); // Carta Poring
  });

  it('com a opção desligada, a busca não coloca carta MVP', () => {
    const preset = JSON.parse(JSON.stringify(windhawkModel(130)));
    const response = runOptimization(data, {
      preset, monsterId: 1832, objective: 'dps', allowMvpCards: false, optimizeStats: false, optimizeSets: false,
      slots: [ItemTypeEnum.weapon, ItemTypeEnum.armor, ItemTypeEnum.garment], timeLimitMs: 30_000,
    });
    expect(response.changes.filter((change) => change.to.includes('(MVP)'))).toEqual([]);
  }, 90_000);
});

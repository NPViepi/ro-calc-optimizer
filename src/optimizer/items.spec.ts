import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { buildCatalog, placeItem, slotsForItem, WeaponRulesProbe } from './candidates';
import { BuildEvaluator } from './evaluate';
import { optimizeBuild } from './items';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const context = windhawkContext({ items: latamItemDb });
const { character, items } = context;
const probe = new WeaponRulesProbe(items, character);

const SHARPBOLT_BOW = 700016; // 0 encaixes
const ROYAL_BOW = 700045; // 2 encaixes
const STONE_BUCKLER = 2114;
const ODIUM_MASK = 436002; // Meio + Baixo
const ELVEN_ARROW = 1773;
const SOME_CARD = 4001;

describe('catálogo de candidatos', () => {
  const catalog = buildCatalog(items, character, { maxRequiredLevel: 230 });

  it('separa os itens por slot como os dropdowns', () => {
    expect(catalog.weapon).toContain(SHARPBOLT_BOW);
    expect(catalog.ammo).toContain(ELVEN_ARROW);
    expect(catalog.headMiddle).toContain(ODIUM_MASK);
    expect(catalog.headLower).toContain(ODIUM_MASK);
    expect(slotsForItem(items[ODIUM_MASK])).toEqual([ItemTypeEnum.headMiddle, ItemTypeEnum.headLower]);
    expect(slotsForItem(items[SOME_CARD])).toEqual([]);
  });

  it('só lista armas que a classe usa e itens do LATAM', () => {
    for (const id of catalog.weapon ?? []) {
      expect(items[id].presentInLatam).toBe(true);
      const usable = items[id].usableClass as string[] | undefined;
      if (Array.isArray(usable)) expect(usable.some((name) => character.classNameSet.has(name))).toBe(true);
    }
  });

  it('respeita inventário, exclusões e nível', () => {
    const owned = buildCatalog(items, character, { allowedItemIds: new Set([SHARPBOLT_BOW, ELVEN_ARROW]) });
    expect(owned).toEqual({ weapon: [SHARPBOLT_BOW], ammo: [ELVEN_ARROW] });

    const excluded = buildCatalog(items, character, { excludedItemIds: new Set([SHARPBOLT_BOW]) });
    expect(excluded.weapon).not.toContain(SHARPBOLT_BOW);

    const lowLevel = buildCatalog(items, character, { maxRequiredLevel: 1 });
    expect((lowLevel.weapon ?? []).every((id) => !((items[id] as any).requiredLevel > 1))).toBe(true);
  });
});

describe('placeItem', () => {
  it('mantém cartas que cabem e limpa encantamentos, grau e refino herdado conforme a regra', () => {
    const model = { ...windhawkModel(130), weapon: ROYAL_BOW, weaponCard1: SOME_CARD, weaponCard2: SOME_CARD, weaponEnchant3: 4879, weaponGrade: 'A' } as any;
    const toSharpbolt = placeItem(model, ItemTypeEnum.weapon, SHARPBOLT_BOW, items, probe) as any;

    expect(toSharpbolt.weapon).toBe(SHARPBOLT_BOW);
    expect(toSharpbolt.weaponCard1).toBeUndefined(); // arco sem encaixe
    expect(toSharpbolt.weaponEnchant3).toBeUndefined();
    expect(toSharpbolt.weaponGrade).toBeUndefined();
    expect(toSharpbolt.weaponRefine).toBe(model.weaponRefine);

    const back = placeItem({ ...toSharpbolt, weaponCard1: SOME_CARD, weaponCard2: SOME_CARD }, ItemTypeEnum.weapon, ROYAL_BOW, items, probe) as any;
    expect([back.weaponCard1, back.weaponCard2]).toEqual([SOME_CARD, SOME_CARD]);
  });

  it('usa o refino pedido e não altera o modelo original', () => {
    const model = windhawkModel(130);
    const placed = placeItem(model, ItemTypeEnum.weapon, ROYAL_BOW, items, probe, { refine: { weapon: 15 } });

    expect(placed.weaponRefine).toBe(15);
    expect(model.weapon).toBe(SHARPBOLT_BOW);
  });

  it('arco (duas mãos) não fica com escudo; munição incompatível sai', () => {
    const withShield = { ...windhawkModel(130), weapon: undefined, ammo: ELVEN_ARROW, shield: STONE_BUCKLER } as any;
    expect(probe.rules(undefined).allowShield).toBe(true);

    const bow = placeItem(withShield, ItemTypeEnum.weapon, ROYAL_BOW, items, probe);
    expect(bow.shield).toBeUndefined();
    expect(bow.ammo).toBe(ELVEN_ARROW); // flecha serve no arco

    // Sem arma, a munição só fica se a própria classe usar munição (regra do motor).
    const unarmed = placeItem(bow, ItemTypeEnum.weapon, undefined, items, probe);
    const rules = probe.rules(undefined);
    const keeps = rules.allowAmmo && items[ELVEN_ARROW].itemSubTypeId === rules.ammoSubTypeId;
    expect(unarmed.ammo).toBe(keeps ? ELVEN_ARROW : undefined);
  });

  it('máscara de Meio+Baixo libera os dois slots, e um item de Baixo depois a remove', () => {
    const model = { ...windhawkModel(130), headMiddle: 410093, headLower: 420076 } as any;
    const masked = placeItem(model, ItemTypeEnum.headMiddle, ODIUM_MASK, items, probe);
    expect(masked.headMiddle).toBe(ODIUM_MASK);
    expect(masked.headLower).toBeUndefined();

    const lower = placeItem(masked, ItemTypeEnum.headLower, 420076, items, probe);
    expect(lower.headLower).toBe(420076);
    expect(lower.headMiddle).toBeUndefined();
  });
});

describe('optimizeBuild', () => {
  const evaluator = new BuildEvaluator(context);
  const fast = { shortlistSize: 5, statEvaluations: 600, maxRounds: 2 } as const;

  it('melhora a build, respeita slots travados e só usa itens do catálogo', () => {
    const model = windhawkModel(130);
    const result = optimizeBuild(evaluator, context, model, {
      ...fast, objective: 'dps', slots: [ItemTypeEnum.weapon, ItemTypeEnum.ammo, ItemTypeEnum.garment, ItemTypeEnum.accLeft, ItemTypeEnum.boot],
      lockedSlots: [ItemTypeEnum.boot],
    });

    expect(result.damage).toBeGreaterThan(result.damageBefore);
    expect(result.model.boot).toBe(model.boot);
    expect(result.model.bootEnchant2).toBe(model.bootEnchant2);
    expect(result.itemChanges.map((change) => change.slot)).not.toContain(ItemTypeEnum.boot);
    const catalog = buildCatalog(items, character, { maxRequiredLevel: model.level });
    for (const change of result.itemChanges) if (change.to) expect(catalog[change.slot]).toContain(change.to);
    // A arma escolhida precisa de flecha: a busca garante uma compatível.
    expect(result.model.ammo).toBeTruthy();
  }, 60_000);

  it('com itens, alcança variável 0 que só atributos não alcançavam', () => {
    const result = optimizeBuild(evaluator, context, windhawkModel(130), { ...fast, objective: 'dps', constraints: { maxVct: 0 } });

    expect(result.constraintsBefore[0].ok).toBe(false);
    expect(result.feasible).toBe(true);
    expect(result.metrics.vct).toBe(0);
  }, 120_000);

  it('nunca piora: sem candidatos melhores, devolve a build de entrada', () => {
    const model = windhawkModel(130);
    const result = optimizeBuild(evaluator, context, model, {
      objective: 'dps', slots: [ItemTypeEnum.weapon], optimizeStats: false,
      catalog: { allowedItemIds: new Set([SHARPBOLT_BOW]) },
    });

    expect(result.itemChanges).toEqual([]);
    expect(result.damage).toBe(result.damageBefore);
  }, 60_000);
});

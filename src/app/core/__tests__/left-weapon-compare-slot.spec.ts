import { describe, expect, it } from 'vitest';
import { AllowedCompareItemTypes } from 'src/app/app-config';
import { AllowLeftWeaponMapper, ItemTypeEnum, ItemTypeId } from 'src/app/constants';
import { itemSlotLabelKey } from 'src/app/constants/item-slot-i18n';
import { DEFAULT_CATALOG } from 'src/app/i18n';
import { ClassIDEnum, getClassDropdownList, GuillotineCross } from 'src/app/jobs';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { createMainModel } from 'src/app/utils';
import { Calculator } from '../calculator';
import { CalculatorController } from '../calculator-controller';
import { resolveOffHandEviction } from '../off-hand-slots';

/**
 * The off-hand weapon joined the "comparar slot" list, requested by Luís. It is the only
 * comparable slot whose hand is contested: a shield wants it too, and a two-handed weapon
 * takes it from both. These pin who keeps the hand, and pin that emptying the loser has
 * to go through the model — the off-hand's own ATQ and its dual-wield VelAtq are read
 * from `leftWeaponData`, which only `loadItemFromModel` writes.
 */

const DAGGER_SUBTYPE = 256;

const MAIN_DAGGER = 1;
const OFF_HAND_SMALL = 2;
const OFF_HAND_BIG = 3;

const items: Record<number, Partial<ItemModel>> = {
  [MAIN_DAGGER]: { id: MAIN_DAGGER, name: 'Adaga Principal', itemTypeId: ItemTypeId.WEAPON, itemSubTypeId: DAGGER_SUBTYPE, itemLevel: 3, attack: 100, script: {} },
  [OFF_HAND_SMALL]: { id: OFF_HAND_SMALL, name: 'Adaga Esquerda', itemTypeId: ItemTypeId.WEAPON, itemSubTypeId: DAGGER_SUBTYPE, itemLevel: 3, attack: 60, script: {} },
  [OFF_HAND_BIG]: { id: OFF_HAND_BIG, name: 'Adaga Esquerda Maior', itemTypeId: ItemTypeId.WEAPON, itemSubTypeId: DAGGER_SUBTYPE, itemLevel: 3, attack: 90, script: {} },
};

const monster = {
  id: 1002, name: 'Poring', spawn: 'pay_fild04',
  stats: { level: 1, health: 50, attack: { min: 7, max: 8 }, range: 1, defense: 0, magicDefense: 0, str: 1, int: 0, vit: 1, dex: 6, agi: 1, luk: 30, element: 1, elementName: 'Neutral 1', elementShortName: 'W1', race: 4, raceName: 'Plant', scale: 0, scaleName: 'Small', class: 0, criShield: 0, softDef: 0, mdef: 0, softMdef: 0, res: 0, mres: 0 },
  data: { def: 0, mdef: 0, criShield: 0, softDef: 0, res: 0, mres: 0 },
} as any;

function baseModel(): MainModel {
  const model = createMainModel();
  model.class = ClassIDEnum.GuillotineCross;
  model.level = 200;
  model.jobLevel = 70;
  model.str = 90; model.agi = 90; model.vit = 1; model.int = 1; model.dex = 60; model.luk = 1;
  model.weapon = MAIN_DAGGER;
  model.weaponRefine = 0;
  return model;
}

/** A calculator loaded with `model`, then solved the way prepare() + runChain() do. */
function load(model: MainModel): Calculator {
  const cls = new GuillotineCross();
  cls.setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] }).getSkillBonusAndName();

  const calc = new Calculator();
  calc
    .setMasterItems(items as any)
    .setHpSpTable([{ jobs: { GuillotineCross: true }, baseHp: Array(251).fill(10000), baseSp: Array(251).fill(1000) }] as any)
    .setClass(cls)
    .setMonster(monster);
  calc.loadItemFromModel(model);

  return calc;
}

function solve(calc: Calculator) {
  new CalculatorController().runChain(calc, {
    monster,
    equipAtks: {}, masteryAtks: {}, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: 0, extraOptionScripts: [],
    activeSkillNames: new Set(), learnedSkillMap: new Map(),
    selectedAtkSkill: '', selectedChances: [], usedHpL: false,
  } as any);

  return calc.getTotalSummary().calc;
}

describe('off-hand weapon as a comparable slot', () => {
  it('is offered in the "comparar slot" picker, with a pt-BR label', () => {
    expect([...AllowedCompareItemTypes]).toContain('leftWeapon');
    expect(DEFAULT_CATALOG[itemSlotLabelKey('leftWeapon')]).toBe('Arma Esq.');
  });

  it('there is something to compare: a different off-hand weapon moves the numbers', () => {
    const bare = solve(load(baseModel()));
    const small = solve(load({ ...baseModel(), leftWeapon: OFF_HAND_SMALL } as MainModel));
    const big = solve(load({ ...baseModel(), leftWeapon: OFF_HAND_BIG } as MainModel));

    // Its ATQ rides along with the equipment total (getTotalSummary adds leftWeaponAtk).
    expect(small.totalEquipAtk).toBe(bare.totalEquipAtk + 60);
    expect(big.totalEquipAtk).toBe(bare.totalEquipAtk + 90);
    // And dual wielding costs VelAtq, so the two columns differ there too.
    expect(small.totalAspd).toBeLessThan(bare.totalAspd);
    expect(big.totalAspd).toBe(small.totalAspd);
  });

  it('emptying the slot in the model is what removes it — setItem(undefined) is not enough', () => {
    const bare = solve(load(baseModel()));

    // What evictFromCompareOffHand does: empty the field and re-load.
    const reloaded = solve(load({ ...baseModel(), leftWeapon: null } as any));
    expect(reloaded.totalEquipAtk).toBe(bare.totalEquipAtk);
    expect(reloaded.totalAspd).toBe(bare.totalAspd);

    // What it must NOT do: clearing through setItem unregisters the scripts but leaves
    // leftWeaponData behind, so the evicted weapon keeps paying its ATQ and its VelAtq.
    const viaSetItem = load({ ...baseModel(), leftWeapon: OFF_HAND_SMALL } as MainModel);
    viaSetItem.setItem({ itemType: ItemTypeEnum.leftWeapon, itemId: undefined });
    const stale = solve(viaSetItem);
    expect(stale.totalEquipAtk).toBe(bare.totalEquipAtk + 60);
    expect(stale.totalAspd).toBeLessThan(bare.totalAspd);
  });
});

/**
 * bROWiki, "Perícia com Mão Esquerda": *"Apenas Mercenários, Kagerou, Oboro e evoluções
 * podem equipar armas nas duas mãos"*. The picker asks this table which classes get the
 * off-hand row offered to them, so a wrong answer either hides a slot a class really has
 * or offers one that can never be filled.
 */
describe('which classes put a weapon in the off hand', () => {
  it('is the Assassin line and the Kagerou/Oboro branch, ancestors excluded', () => {
    expect(Object.keys(AllowLeftWeaponMapper).sort()).toEqual([
      'Assassin', 'AssassinCross', 'GuillotineCross', 'Kagerou', 'Oboro', 'ShadowCross', 'Shinkiro', 'Shiranui',
    ]);
    // Gatuno and Ninja head those lines but have no off hand of their own.
    expect(AllowLeftWeaponMapper['Thief']).toBeUndefined();
    expect(AllowLeftWeaponMapper['Ninja']).toBeUndefined();
  });

  it('reaches exactly seven of the classes the picker can actually be opened on', () => {
    const playable = getClassDropdownList()
      .filter((c) => AllowLeftWeaponMapper[c.instant.className])
      .map((c) => c.instant.className)
      .sort();

    expect(playable).toEqual(['AssassinCross', 'GuillotineCross', 'Kagerou', 'Oboro', 'ShadowCross', 'Shinkiro', 'Shiranui']);
  });
});

describe('resolveOffHandEviction', () => {
  const dualWielding = { isWeaponTwoHanded: false, canWieldOffHandWeapon: true };

  it('a two-handed weapon takes the hand from both rivals', () => {
    const twoHanded = { isWeaponTwoHanded: true, canWieldOffHandWeapon: true, hasShield: false, hasLeftWeapon: true, comparedSlots: [ItemTypeEnum.leftWeapon] };
    expect(resolveOffHandEviction(twoHanded)).toEqual([ItemTypeEnum.shield, ItemTypeEnum.leftWeapon]);
  });

  it('leaves the hand alone when only one claimant is in it', () => {
    const one = { ...dualWielding, comparedSlots: [] };
    expect(resolveOffHandEviction({ ...one, hasShield: true, hasLeftWeapon: false })).toEqual([]);
    expect(resolveOffHandEviction({ ...one, hasShield: false, hasLeftWeapon: true })).toEqual([]);
    expect(resolveOffHandEviction({ ...one, hasShield: false, hasLeftWeapon: false })).toEqual([]);
  });

  it('when a comparison puts both there, the compared slot keeps the hand', () => {
    const both = { ...dualWielding, hasShield: true, hasLeftWeapon: true };

    // Comparing off-hand weapons against a build carrying a shield: the shield leaves.
    expect(resolveOffHandEviction({ ...both, comparedSlots: [ItemTypeEnum.leftWeapon] })).toEqual([ItemTypeEnum.shield]);
    // Comparing shields against a dual-wielding build: the off-hand weapon leaves.
    expect(resolveOffHandEviction({ ...both, comparedSlots: [ItemTypeEnum.shield] })).toEqual([ItemTypeEnum.leftWeapon]);
    // Comparing both at once — the off-hand weapon is the slot with an item picked for it.
    expect(resolveOffHandEviction({ ...both, comparedSlots: [ItemTypeEnum.shield, ItemTypeEnum.leftWeapon] })).toEqual([ItemTypeEnum.shield]);
  });

  /**
   * The off-hand weapon row is hidden whenever the build cannot hold one — wrong class, no
   * main weapon, a shield in the way — and its compare row goes with it. What is left in
   * the compared model then is a leftover from an earlier state, so it must not pay: a
   * comparison the user cannot see must not move the numbers.
   */
  it('drops an off-hand weapon the build cannot wield, without a contest', () => {
    const hidden = { isWeaponTwoHanded: false, canWieldOffHandWeapon: false, hasLeftWeapon: true };

    expect(resolveOffHandEviction({ ...hidden, hasShield: false, comparedSlots: [ItemTypeEnum.leftWeapon] })).toEqual([ItemTypeEnum.leftWeapon]);
    // Even while it is the slot being compared — being compared cannot win it a hand the
    // screen is not offering.
    expect(resolveOffHandEviction({ ...hidden, hasShield: true, comparedSlots: [ItemTypeEnum.leftWeapon] })).toEqual([ItemTypeEnum.leftWeapon]);
    // And an empty off hand is nothing to evict.
    expect(resolveOffHandEviction({ ...hidden, hasLeftWeapon: false, hasShield: true, comparedSlots: [] })).toEqual([]);
  });
});

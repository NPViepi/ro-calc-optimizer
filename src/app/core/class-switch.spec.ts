import { describe, expect, it } from 'vitest';
import { EQUIPMENT_SLOTS, SlotClassFilter } from '../app-config/equipment-slots';
import { ItemTypeEnum } from '../constants/item-type.enum';
import { DEFAULT_PET_LOYALTY, PetLoyalty } from '../constants/pet-loyalty';
import { ArchMage } from '../jobs/ArchMage';
import { DragonKnight } from '../jobs/DragonKnight';
import { GuillotineCross } from '../jobs/GuillotineCross';
import { RuneKnight } from '../jobs/RuneKnight';
import { ShadowCross } from '../jobs/ShadowCross';
import { SuperNovice } from '../jobs/SuperNovice';
import { CharacterBase } from '../jobs/_character-base.abstract';
import { ItemModel } from '../models/item.model';
import { MainModel } from '../models/main.model';
import { createMainModel } from '../utils/create-main-model';
import { applyClassSwitch, findClassSwitchLosses, hasBuildToKeep, slotEquipFilter } from './class-switch';

/**
 * The class dropdown used to wipe the build; it now offers to carry it over, which is only
 * safe if what the new class cannot wear is subtracted first. Report:
 * issues.latam-tools.com.br/t/A1ju2K45hrVkKRrb0kNa
 */

const item = (overrides: Partial<ItemModel>): ItemModel =>
  ({ id: 1, aegisName: 'Test_Item', name: 'Item de Teste', slots: 0, ...overrides }) as ItemModel;

const buildWith = (overrides: Partial<MainModel>): MainModel => ({ ...createMainModel(), ...overrides });

/** A catalogue keyed by id, the shape the component passes in. */
const catalogue = (...items: ItemModel[]): Record<number, ItemModel> => Object.fromEntries(items.map((entry) => [entry.id, entry]));

/** The slot predicate over item records, the shape findClassSwitchLosses uses. */
const equipable = (rule: SlotClassFilter, equipped: ItemModel | undefined, cClass: CharacterBase) =>
  slotEquipFilter<ItemModel>(rule, cClass, (row) => row)(equipped);

const lossFor = (model: MainModel, items: Record<number, ItemModel>, nextClass: CharacterBase) =>
  findClassSwitchLosses({ model, items, nextClass });

describe('slotEquipFilter', () => {
  const knight = new RuneKnight();
  const superNovice = new SuperNovice();
  const mageSword = item({ usableClass: ['Swordman'], itemLevel: 4, itemSubTypeId: 257 });

  it('reads usableClass against the whole lineage, not just the current job', () => {
    // A Rune Knight is still a Swordman as far as the item tables are concerned.
    expect(equipable('gear', item({}), knight)).toBe(true);
    expect(equipable('gear', item({ usableClass: ['Swordman'] }), knight)).toBe(true);
    expect(equipable('gear', item({ usableClass: ['Mage'] }), knight)).toBe(false);
    expect(equipable('gear', item({ unusableClass: ['Swordman'] }), knight)).toBe(false);
  });

  it('judges nothing at all on an unfiltered slot', () => {
    expect(equipable('none', mageSword, new ArchMage())).toBe(true);
  });

  it('gives the Super Novice its level-4 one-hander and any head gear', () => {
    // itemSubTypeId 257 is the one-handed sword: not on the Swordman-only list, but the
    // Super Novice exemption in the weapon picker takes it anyway.
    expect(equipable('weapon', mageSword, superNovice)).toBe(true);
    expect(equipable('weapon', mageSword, knight)).toBe(true);
    expect(equipable('weapon', mageSword, new ArchMage())).toBe(false);

    const knightHat = item({ usableClass: ['Swordman'] });
    expect(equipable('headGear', knightHat, superNovice)).toBe(true);
    expect(equipable('headGear', knightHat, new ArchMage())).toBe(false);
  });

  it('does not extend the weapon exemption past level 4 or past the six types', () => {
    expect(equipable('weapon', item({ usableClass: ['Swordman'], itemLevel: 3, itemSubTypeId: 257 }), superNovice)).toBe(false);
    // itemSubTypeId 267 is the bow, which the Super Novice never gets.
    expect(equipable('weapon', item({ usableClass: ['Swordman'], itemLevel: 4, itemSubTypeId: 267 }), superNovice)).toBe(false);
  });
});

describe('findClassSwitchLosses', () => {
  const items = catalogue(
    item({ id: 100, name: 'Espada do Cavaleiro', usableClass: ['Swordman'], itemLevel: 4, itemSubTypeId: 257 }),
    item({ id: 200, name: 'Manto Comum' }),
    item({ id: 300, name: 'Elmo do Cavaleiro', usableClass: ['Swordman'] }),
    item({ id: 400, name: 'Carta do Cavaleiro', usableClass: ['Swordman'] }),
    item({ id: 500, name: 'Adaga Curta', usableClass: ['Thief'], itemLevel: 4, itemSubTypeId: 256 }),
  );

  it('names the slot, the item and why, in picker order', () => {
    const model = buildWith({ weapon: 100, garment: 200, headUpper: 300 });

    expect(lossFor(model, items, new ArchMage())).toEqual([
      { key: ItemTypeEnum.weapon, slotLabelKey: 'itemSlot.weapon', itemId: 100, itemName: 'Espada do Cavaleiro', reason: 'class' },
      { key: ItemTypeEnum.headUpper, slotLabelKey: 'itemSlot.headUpper', itemId: 300, itemName: 'Elmo do Cavaleiro', reason: 'class' },
    ]);
  });

  it('keeps everything on a switch inside the same lineage', () => {
    const model = buildWith({ weapon: 100, garment: 200, headUpper: 300 });

    expect(lossFor(model, items, new DragonKnight())).toEqual([]);
  });

  it('leaves the slots the picker never filters alone', () => {
    // A card, a pet and a costume enchant go on whoever picks them: the lists behind them
    // carry no class filter at all, so no switch can cost them.
    const model = buildWith({ weaponCard1: 400, pet: 400, costumeEnchantUpper: 400 });

    expect(lossFor(model, items, new ArchMage())).toEqual([]);
  });

  it('takes the off-hand weapon from a class that does not dual wield', () => {
    // AllowLeftWeaponMapper is the Assassin line and the Kagerou/Oboro branch, and the
    // class itself is what says so — the caller does not get to pass a different answer.
    const model = buildWith({ leftWeapon: 500 });

    expect(lossFor(model, items, new ShadowCross())).toEqual([]);
    expect(lossFor(model, items, new GuillotineCross())).toEqual([]);
    expect(lossFor(model, items, new ArchMage())).toEqual([
      { key: ItemTypeEnum.leftWeapon, slotLabelKey: 'itemSlot.leftWeapon', itemId: 500, itemName: 'Adaga Curta', reason: 'offHand' },
    ]);
  });

  it('keeps an id with no record rather than dropping it unread', () => {
    expect(lossFor(buildWith({ armor: 999999 }), items, new ArchMage())).toEqual([]);
  });
});

describe('applyClassSwitch', () => {
  const items = catalogue(item({ id: 100, name: 'Espada do Cavaleiro', usableClass: ['Swordman'], itemLevel: 4, itemSubTypeId: 257 }));

  /** A slot highlight marks the piece in the slot, so it goes out when the piece does. */
  it('drops the highlight of a slot the new class cannot wear, and keeps the rest', () => {
    const model = buildWith({ weapon: 100, armor: 200, slotColors: { weapon: 'azul', armor: 'rosa' } });

    const switched = applyClassSwitch(model, lossFor(model, items, new ArchMage()), new ArchMage());

    expect(switched.slotColors).toEqual({ armor: 'rosa' });
  });

  /**
   * The switch is offered, not imposed — the dialog can still be cancelled, and this
   * result thrown away. A write reaching back through the shallow spread would have
   * stripped the marks off the build the player chose to keep.
   */
  it('never writes the highlights back into the model it was handed', () => {
    const model = buildWith({ weapon: 100, slotColors: { weapon: 'azul' } });

    applyClassSwitch(model, lossFor(model, items, new ArchMage()), new ArchMage());

    expect(model.slotColors).toEqual({ weapon: 'azul' });
  });

  it('empties the whole slot, not just the item', () => {
    const model = buildWith({
      weapon: 100,
      weaponRefine: 12,
      weaponGrade: 'A',
      weaponCard1: 4001,
      weaponEnchant0: 4002,
      weaponEnchant3: 4003,
      ammo: 7000,
      propertyAtk: 'fire' as any,
      rawOptionTxts: [],
    });
    // W_Left_1..3, the main weapon's three Bônus Aleatórios.
    model.rawOptionTxts[0] = 'STR +10';

    const switched = applyClassSwitch(model, lossFor(model, items, new ArchMage()), new ArchMage());

    expect(switched.weapon).toBeUndefined();
    expect(switched.weaponRefine).toBeUndefined();
    expect(switched.weaponGrade).toBeUndefined();
    expect(switched.weaponCard1).toBeUndefined();
    expect(switched.weaponEnchant0).toBeUndefined();
    expect(switched.weaponEnchant3).toBeUndefined();
    // The ammo list is decided by the weapon and the converter paints its element: with
    // the weapon gone, neither has anything to apply to.
    expect(switched.ammo).toBeUndefined();
    expect(switched.propertyAtk).toBeUndefined();
    expect(switched.rawOptionTxts[0]).toBeUndefined();
  });

  it('takes the costume enchants off with their costume', () => {
    const costume = catalogue(item({ id: 700, name: 'Visual do Cavaleiro', usableClass: ['Swordman'] }));
    const model = buildWith({ costumeUpper: 700, costumeEnchantUpper: 4100 });

    const switched = applyClassSwitch(model, lossFor(model, costume, new ArchMage()), new ArchMage());

    expect(switched.costumeUpper).toBeUndefined();
    expect(switched.costumeEnchantUpper).toBeUndefined();
  });

  it('leaves the slots it was not told about untouched', () => {
    const model = buildWith({ weapon: 100, weaponRefine: 12, armor: 300, armorRefine: 9, str: 120 });

    const switched = applyClassSwitch(model, lossFor(model, items, new ArchMage()), new ArchMage());

    expect(switched.armor).toBe(300);
    expect(switched.armorRefine).toBe(9);
    expect(switched.str).toBe(120);
  });

  it('drops the trait points on a class with no trait table', () => {
    // damage-calculator adds model.pow and friends into the totals whatever the class is,
    // and only the input is hidden on a 3rd class — so carrying them over would keep
    // paying POD and CON with no field on screen to explain it.
    const model = buildWith({ pow: 60, sta: 30, wis: 10, spl: 20, con: 50, crt: 40 });

    expect(applyClassSwitch(model, [], new RuneKnight())).toMatchObject({ pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 });
    expect(applyClassSwitch(model, [], new DragonKnight())).toMatchObject({ pow: 60, con: 50 });
    // ...leaving the sheet it was handed alone, which is what lets it be called twice here.
    expect(model.pow).toBe(60);
  });

  it('restores the pet loyalty default when a pet slot is cleared', () => {
    const model = buildWith({ pet: 800, petLoyalty: PetLoyalty.Baixa });

    // The pet list is never class-filtered, so this only happens if a caller asks for it.
    const switched = applyClassSwitch(model, [{ key: ItemTypeEnum.pet, slotLabelKey: 'itemSlot.pet', itemId: 800, itemName: 'Ovo', reason: 'class' }], new ArchMage());

    expect(switched.pet).toBeUndefined();
    expect(switched.petLoyalty).toBe(DEFAULT_PET_LOYALTY);
  });
});

describe('hasBuildToKeep', () => {
  it('says no to a sheet nothing has been put on', () => {
    expect(hasBuildToKeep(createMainModel())).toBe(false);
  });

  it('says yes to any worn item, including the ones no switch can cost', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(hasBuildToKeep(buildWith({ [slot.key]: 100 })), slot.key).toBe(true);
    }
  });

  it('says yes to hand-assigned stat and trait points', () => {
    expect(hasBuildToKeep(buildWith({ dex: 120 }))).toBe(true);
    expect(hasBuildToKeep(buildWith({ con: 30 }))).toBe(true);
  });
});

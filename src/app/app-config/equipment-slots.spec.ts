import { describe, expect, it } from 'vitest';
import { AllowedCompareItemTypes } from './allowed-compare-item-types';
import { EQUIPMENT_SLOTS, SLOTS_BY_KEY, SLOT_GROUPS, comparableKeysOf } from './equipment-slots';
import { ItemOptionNumber } from '../constants/item-option-number.enum';
import { ItemTypeEnum } from '../constants/item-type.enum';
import { MainItemWithRelations } from '../constants/item-type.enum';
import { DEFAULT_CATALOG } from '../i18n';

/**
 * The descriptor table is the whole equipment picker now, so it has to stay pinned to the
 * enums it mirrors. Every check here failed at least once while the table was being
 * written; they are cheaper than finding the same drift on screen.
 */

const ALL_ITEM_TYPES = new Set<string>(Object.values(ItemTypeEnum));
const ALL_SUB_SLOTS = EQUIPMENT_SLOTS.flatMap((slot) => slot.subItemSlots ?? []);

describe('EQUIPMENT_SLOTS', () => {
  it('names only real model fields', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(ALL_ITEM_TYPES, slot.key).toContain(slot.key);
      for (const field of [...slot.cardFields, ...slot.enchantFields.filter(Boolean)]) {
        expect(ALL_ITEM_TYPES, `${slot.key}: ${field}`).toContain(field);
      }
    }
    for (const sub of ALL_SUB_SLOTS) {
      expect(ALL_ITEM_TYPES, sub.key).toContain(sub.key);
    }
  });

  it('keeps every card and enchant field inside the slot own clear cascade', () => {
    // onClearItem walks MainItemWithRelations to empty a slot. A field the descriptor
    // shows but that table does not list would survive a clear and keep paying its bonus.
    for (const slot of EQUIPMENT_SLOTS) {
      const related = new Set<string>(MainItemWithRelations[slot.key] ?? []);
      for (const field of [...slot.cardFields, ...slot.enchantFields.filter(Boolean)]) {
        expect(related, `${slot.key} -> ${field}`).toContain(field);
      }
    }
  });

  it('exposes enchant position 0 on weapons only, and 0-1 never on shadow gear', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      if (!slot.enchantFields.length) continue;
      expect(slot.enchantFields).toHaveLength(4);

      const isWeapon = slot.key === ItemTypeEnum.weapon || slot.key === ItemTypeEnum.leftWeapon;
      expect(Boolean(slot.enchantFields[0]), `${slot.key} position 0`).toBe(isWeapon);
      if (slot.group === 'shadow') expect(slot.enchantFields[1]).toBeNull();
    }
  });

  it('agrees with AllowedCompareItemTypes in both directions', () => {
    const declared = new Set<string>([
      ...EQUIPMENT_SLOTS.filter((s) => s.comparable).map((s) => s.key),
      ...ALL_SUB_SLOTS.filter((s) => s.comparable).map((s) => s.key),
    ]);

    expect([...declared].sort()).toEqual([...AllowedCompareItemTypes].sort());
  });

  it('offers every comparable slot through exactly one card', () => {
    const owners = new Map<string, number>();
    for (const slot of EQUIPMENT_SLOTS) {
      for (const key of comparableKeysOf(slot)) owners.set(key, (owners.get(key) ?? 0) + 1);
    }

    for (const key of AllowedCompareItemTypes) {
      expect(owners.get(key), key).toBe(1);
    }
  });

  it('never reuses a rawOptionTxts index', () => {
    const seen = new Map<ItemOptionNumber, string>();
    for (const slot of EQUIPMENT_SLOTS) {
      for (const index of slot.optionIndexes) {
        expect(seen.has(index), `${slot.key} reuses index ${index} (${seen.get(index)})`).toBe(false);
        seen.set(index, slot.key);
      }
    }
  });

  it('gives boots two random-option slots of their own', () => {
    // Boots took none until the Botas Desconhecidas (Contas de Ymir, two lines) needed them.
    expect(SLOTS_BY_KEY.get(ItemTypeEnum.boot)!.optionIndexes).toEqual([ItemOptionNumber.Boot_1, ItemOptionNumber.Boot_2]);
  });

  it('covers each slot key once and only names known groups', () => {
    expect(SLOTS_BY_KEY.size).toBe(EQUIPMENT_SLOTS.length);
    for (const slot of EQUIPMENT_SLOTS) {
      expect(SLOT_GROUPS.map((group) => group.key), slot.key).toContain(slot.group);
    }
  });

  it('asks for a card list exactly when the slot sockets cards', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(Boolean(slot.cardListKey), slot.key).toBe(slot.cardFields.length > 0);
    }
  });

  it('marks the class filter the picker and the class-switch dialog both read', () => {
    // Drift here shows up twice over: a dropdown that offers what the class cannot wear,
    // and a switch dialog that promises to keep it. The three head positions carry the
    // Super Novice head-gear exemption, the two weapons its level-4 one-hander, and the
    // pet is the only slot no class filter reaches. Everything else is the plain test —
    // asserted as the complement so a new slot has to declare itself either way.
    const byFilter = (filter: string) => EQUIPMENT_SLOTS.filter((s) => s.classFilter === filter).map((s) => s.key);
    const exempt = [
      ItemTypeEnum.weapon,
      ItemTypeEnum.leftWeapon,
      ItemTypeEnum.headUpper,
      ItemTypeEnum.headMiddle,
      ItemTypeEnum.headLower,
      ItemTypeEnum.pet,
    ];

    expect(byFilter('weapon')).toEqual([ItemTypeEnum.weapon, ItemTypeEnum.leftWeapon]);
    expect(byFilter('headGear')).toEqual([ItemTypeEnum.headUpper, ItemTypeEnum.headMiddle, ItemTypeEnum.headLower]);
    expect(byFilter('none')).toEqual([ItemTypeEnum.pet]);
    expect(byFilter('gear')).toEqual(EQUIPMENT_SLOTS.map((s) => s.key).filter((key) => !exempt.includes(key)));
  });

  it('does not let the head-gear filter be mistaken for the headSlot flag', () => {
    // The three costume positions are head slots too, and the Super Novice exemption does
    // not reach them — deriving one from the other would hand it every costume in the game.
    expect(EQUIPMENT_SLOTS.filter((s) => s.headSlot).length).toBe(6);
    expect(EQUIPMENT_SLOTS.filter((s) => s.headSlot && s.classFilter === 'headGear').length).toBe(3);
  });

  it('puts the converter and the ammo on the main weapon alone', () => {
    expect(EQUIPMENT_SLOTS.filter((s) => s.converter).map((s) => s.key)).toEqual([ItemTypeEnum.weapon]);
    expect(EQUIPMENT_SLOTS.filter((s) => s.ammo).map((s) => s.key)).toEqual([ItemTypeEnum.weapon]);
    expect(EQUIPMENT_SLOTS.filter((s) => s.loyalty).map((s) => s.key)).toEqual([ItemTypeEnum.pet]);
  });

  it('marks the six head positions that take part in the occupancy rule', () => {
    expect(EQUIPMENT_SLOTS.filter((s) => s.headSlot).map((s) => s.key)).toEqual([
      ItemTypeEnum.headUpper,
      ItemTypeEnum.headMiddle,
      ItemTypeEnum.headLower,
      ItemTypeEnum.costumeUpper,
      ItemTypeEnum.costumeMiddle,
      ItemTypeEnum.costumeLower,
    ]);
  });

  it('names every slot with a catalog key', () => {
    for (const slot of EQUIPMENT_SLOTS) {
      expect(slot.labelKey, slot.key).not.toBe(slot.key);
      expect(DEFAULT_CATALOG[slot.labelKey], slot.key).toBeTruthy();
    }
    for (const sub of ALL_SUB_SLOTS) {
      expect(DEFAULT_CATALOG[sub.label.key], sub.key).toBeTruthy();
    }
  });
});

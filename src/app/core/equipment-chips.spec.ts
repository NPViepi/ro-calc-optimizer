import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from '../app-config/equipment-slots';
import { DEFAULT_CATALOG } from '../i18n';
import { translate } from './i18n';
import { ItemTypeEnum } from '../constants/item-type.enum';
import { DropdownModel } from '../models/dropdown.model';
import { buildChipRows, Chip, ChipContext } from './equipment-chips';
import { SlotDerivation } from './equipment-slot-derivation';

const opts = (n: number): DropdownModel[] => Array.from({ length: n }, (_, i) => ({ label: `o${i}`, value: i }));

const derivation = (over: Partial<SlotDerivation> = {}): SlotDerivation => ({
  cardSlots: 0,
  enchantLists: [null, null, null, null],
  gradeList: [],
  refineList: [],
  optionSlots: 0,
  ...over,
});

const rows = (key: ItemTypeEnum, model: Record<string, any>, der: SlotDerivation, ctx: Partial<ChipContext> = {}) =>
  buildChipRows(SLOTS_BY_KEY.get(key)!, model, der, { variant: 'main', ...ctx });

const kinds = (row: Chip[]) => row.map((c) => c.kind);
const fields = (row: Chip[]) => row.map((c) => c.field);
/** A chip names itself with a catalog key; pt-BR is what the assertions are written in. */
const placeholders = (row: Chip[]) => row.map((c) => translate(DEFAULT_CATALOG, c.placeholder.key, c.placeholder.params));

describe('buildChipRows', () => {
  it('shows only the item chip while the slot is empty', () => {
    const out = rows(ItemTypeEnum.weapon, {}, derivation({ refineList: opts(19), gradeList: opts(5) }));
    expect(out).toHaveLength(1);
    expect(kinds(out[0])).toEqual(['item']);
    expect(out[0][0].primary).toBe(true);
  });

  it('lays a fully loaded weapon out as item / cards+enchants / options', () => {
    const out = rows(
      ItemTypeEnum.weapon,
      { weapon: 1 },
      derivation({ cardSlots: 4, enchantLists: [opts(2), opts(2), opts(2), opts(2)], gradeList: opts(5), refineList: opts(19), optionSlots: 3 }),
      { showAmmo: true },
    );

    expect(kinds(out[0])).toEqual(['refine', 'grade', 'item', 'converter', 'ammo']);
    // Cards and enchants are independent — a 4-socket weapon with 4 enchant positions
    // puts eight chips on the second line.
    expect(kinds(out[1])).toEqual(['card', 'card', 'card', 'card', 'enchant', 'enchant', 'enchant', 'enchant']);
    expect(fields(out[1])).toEqual([
      'weaponCard1',
      'weaponCard2',
      'weaponCard3',
      'weaponCard4',
      'weaponEnchant0',
      'weaponEnchant1',
      'weaponEnchant2',
      'weaponEnchant3',
    ]);
    expect(kinds(out[2])).toEqual(['option', 'option', 'option']);
    expect(out[2].map((c) => c.optionIndex)).toEqual([0, 1, 2]);
  });

  it('hides the ammo chip when the weapon takes none', () => {
    const der = derivation({ refineList: opts(19) });
    expect(kinds(rows(ItemTypeEnum.weapon, { weapon: 1 }, der, { showAmmo: false })[0])).toEqual(['refine', 'item', 'converter']);
  });

  it('drops the options onto the second line when the slot has no enchants', () => {
    const out = rows(ItemTypeEnum.armor, { armor: 1 }, derivation({ cardSlots: 1, optionSlots: 2 }));
    expect(out).toHaveLength(2);
    expect(kinds(out[1])).toEqual(['card', 'option', 'option']);
  });

  it('skips enchant positions the item has no list for', () => {
    // An armour exposes positions 1-3; only the ones the enchant table filled get a chip.
    const out = rows(ItemTypeEnum.armor, { armor: 1 }, derivation({ enchantLists: [null, [], opts(3), opts(1)] }));
    expect(fields(out[1])).toEqual(['armorEnchant2', 'armorEnchant3']);
    expect(out[1].map((c) => c.index)).toEqual([2, 3]);
    expect(placeholders(out[1])).toEqual(['Encant. 3', 'Encant. 4']);
  });

  it('numbers a single card socket without an index', () => {
    expect(placeholders(rows(ItemTypeEnum.shield, { shield: 1 }, derivation({ cardSlots: 1 }))[1])).toEqual(['Carta']);
    expect(placeholders(rows(ItemTypeEnum.weapon, { weapon: 1 }, derivation({ cardSlots: 2 }))[1])).toEqual(['Carta 1', 'Carta 2']);
  });

  it('gives the pet its loyalty chip and nothing else', () => {
    const out = rows(ItemTypeEnum.pet, { pet: 1 }, derivation());
    expect(out).toHaveLength(1);
    expect(kinds(out[0])).toEqual(['item', 'loyalty']);
  });

  it('draws a costume card as the visual plus its enchants', () => {
    const out = rows(ItemTypeEnum.costumeGarment, { costumeGarment: 1 }, derivation());
    expect(kinds(out[0])).toEqual(['item']);
    expect(fields(out[1])).toEqual(['costumeEnchantGarment', 'costumeEnchantGarment2', 'costumeEnchantGarment4']);
    expect(out[1].map((c) => c.slotKey)).toEqual([
      ItemTypeEnum.costumeEnchantGarment,
      ItemTypeEnum.costumeEnchantGarment2,
      ItemTypeEnum.costumeEnchantGarment4,
    ]);
  });

  it('shows a costume sub slot even when the visual itself is empty', () => {
    // The enchants are worn by whatever costume is on; an empty visual must not hide them.
    expect(fields(rows(ItemTypeEnum.costumeUpper, {}, derivation())[1] ?? [])).toEqual(['costumeEnchantUpper']);
  });
});

describe('buildChipRows in the comparison', () => {
  const comparing = (...keys: string[]) => ({ variant: 'compare' as const, comparing: new Set(keys) });

  it('offers the compared weapon its own converter and ammo', () => {
    // Both are model fields rather than related items, and the compare pass carries them
    // across by hand — without them "this bow converted vs plain" is unaskable.
    const out = rows(
      ItemTypeEnum.weapon,
      { weapon: 1 },
      derivation({ refineList: opts(19), cardSlots: 1 }),
      { ...comparing(ItemTypeEnum.weapon), showAmmo: true },
    );
    expect(kinds(out[0])).toEqual(['refine', 'item', 'converter', 'ammo']);
  });

  it('collapses a costume card to the enchants actually being compared', () => {
    const out = rows(ItemTypeEnum.costumeGarment, { costumeGarment: 1 }, derivation(), comparing(ItemTypeEnum.costumeEnchantGarment2));

    expect(out).toHaveLength(1);
    expect(fields(out[0])).toEqual(['costumeEnchantGarment2']);
  });

  it('draws nothing for a slot that is not in the comparison', () => {
    expect(rows(ItemTypeEnum.armor, { armor: 1 }, derivation({ cardSlots: 1 }), comparing(ItemTypeEnum.garment))).toEqual([]);
  });

  it('draws the full slot for a compared piece of gear', () => {
    const out = rows(
      ItemTypeEnum.armor,
      { armor: 1 },
      derivation({ cardSlots: 1, gradeList: opts(5), refineList: opts(19), enchantLists: [null, opts(2), null, null], optionSlots: 2 }),
      comparing(ItemTypeEnum.armor),
    );
    expect(kinds(out[0])).toEqual(['refine', 'grade', 'item']);
    expect(kinds(out[1])).toEqual(['card', 'enchant']);
    expect(kinds(out[2])).toEqual(['option', 'option']);
  });
});

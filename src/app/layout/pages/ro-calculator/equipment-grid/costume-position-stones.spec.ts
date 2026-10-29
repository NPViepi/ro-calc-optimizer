import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemSubTypeId } from 'src/app/constants/item-sub-type.enum';
import { ItemTypeEnum as Slot } from 'src/app/constants/item-type.enum';
import { buildChipRows } from 'src/app/core/equipment-chips';
import { ItemModel } from 'src/app/models/item.model';
import { EquipmentGridComponent } from '../../../../../react/controllers/equipment-grid';
import { EquipmentSlotCardComponent } from '../../../../../react/controllers/equipment-slot-card';
import { DEFAULT_CATALOG, TextKey } from 'src/app/i18n';
import { TextParams, translate } from 'src/app/core/i18n';

/** The card titles its picker through a translator; pt-BR is the source catalog. */
const text = (key: TextKey, params?: TextParams) => translate(DEFAULT_CATALOG, key, params);

// Tracker card SZDOZ1byiLnJZmPBdxV6: every occupied costume position accepts its own stone.
function setup(key: Slot, locations: string[]) {
  const grid = new EquipmentGridComponent({ hintPending: false } as any, text);
  grid.items = { 1: { id: 1, name: 'Visual', aegisName: 'Visual', slots: 0, script: {}, locations,
    itemSubTypeId: key === Slot.costumeUpper ? ItemSubTypeId.CostumeUpper : key === Slot.costumeLower ? ItemSubTypeId.CostumeLower : ItemSubTypeId.CostumeMiddle } as ItemModel };
  grid.model = { [key]: 1, costumeEnchantUpper: 11, costumeEnchantMiddle: 22, costumeEnchantLower: 33, rawOptionTxts: [] };
  grid.model2 = { rawOptionTxts: [] };
  grid.lists = { costumeEnhUpperList: [{ label: 'Topo', value: 11 }],
    costumeEnhMiddleList: [{ label: 'Meio', value: 22 }], costumeEnhLowerList: [{ label: 'Baixo', value: 33 }] } as any;
  grid.compareItemNames = [];
  grid.refreshInputs();
  const slot = () => grid.columns.flatMap((column) => column.flatMap((group) => group.slots)).find((entry) => entry.key === key)!;
  const chips = () => buildChipRows(slot(), grid.model, grid.derivations[key], { variant: 'main' }).flat().filter((chip) => chip.kind === 'subItem');
  return { grid, slot, chips };
}

describe('costume position stones', () => {
  it.each([
    [Slot.costumeMiddle, ['Middle', 'Lower'], [Slot.costumeEnchantMiddle, Slot.costumeEnchantLower], [22, 33]],
    [Slot.costumeLower, ['Middle', 'Lower'], [Slot.costumeEnchantMiddle, Slot.costumeEnchantLower], [22, 33]],
    [Slot.costumeUpper, ['Upper', 'Middle', 'Lower'], [Slot.costumeEnchantUpper, Slot.costumeEnchantMiddle, Slot.costumeEnchantLower], [11, 22, 33]],
    [Slot.costumeUpper, ['Upper', 'Middle'], [Slot.costumeEnchantUpper, Slot.costumeEnchantMiddle], [11, 22]],
    [Slot.costumeMiddle, ['Middle'], [Slot.costumeEnchantMiddle], [22]],
  ] as const)('offers each position on %s with %j', (key, locations, fields, values) => {
    const { grid, slot, chips } = setup(key, [...locations]);
    expect(chips().map((chip) => chip.field)).toEqual(fields);
    const card = new EquipmentSlotCardComponent({} as any, {} as any, {} as any, {} as any, text);
    Object.assign(card, { descriptor: slot(), lists: grid.lists, model: grid.model, derivation: grid.derivations[key], items: grid.items });
    chips().forEach((chip, index) => {
      const request = (card as any).pickerRequest(chip, {} as HTMLElement, false);
      expect(request.options.map((option: any) => option.value)).toEqual([values[index]]);
      grid.onPickField({ chip, value: values[index], compare: false });
      expect(grid.model[fields[index]]).toBe(values[index]);
    });
  });

  it('compares, swaps and clears all positions on the costume holding them', () => {
    const { grid } = setup(Slot.costumeUpper, ['Upper', 'Middle', 'Lower']);
    const descriptor = SLOTS_BY_KEY.get(Slot.costumeUpper)!;
    grid.onToggleCompare(descriptor);
    expect(grid.compareItemNames).toEqual([Slot.costumeEnchantUpper, Slot.costumeEnchantMiddle, Slot.costumeEnchantLower]);
    expect([grid.model2.costumeEnchantUpper, grid.model2.costumeEnchantMiddle, grid.model2.costumeEnchantLower]).toEqual([11, 22, 33]);
    grid.model2.costumeEnchantLower = 44;
    grid.onSwapCompare(descriptor);
    expect(grid.model.costumeEnchantLower).toBe(44);
    expect(grid.model2.costumeEnchantLower).toBe(33);
    grid.onClearSlot(descriptor);
    expect(grid.compareItemNames).toEqual([]);
    for (const field of [Slot.costumeUpper, Slot.costumeEnchantUpper, Slot.costumeEnchantMiddle, Slot.costumeEnchantLower]) {
      expect(grid.model[field]).toBeUndefined();
      expect(grid.model2[field]).toBeUndefined();
    }
  });

  it('returns to one picker when a multi-position visual is replaced', () => {
    const { grid, chips } = setup(Slot.costumeMiddle, ['Middle', 'Lower']);
    grid.items[2] = { ...grid.items[1], id: 2, locations: ['Middle'] };
    grid.onPickField({ chip: { kind: 'item', slotKey: Slot.costumeMiddle, field: Slot.costumeMiddle, index: 0, placeholder: '' }, value: 2, compare: false });
    expect(chips().map((chip) => chip.field)).toEqual([Slot.costumeEnchantMiddle]);
    expect(SLOTS_BY_KEY.get(Slot.costumeMiddle)!.subItemSlots!.map((sub) => sub.key)).toEqual([Slot.costumeEnchantMiddle]);
  });
});

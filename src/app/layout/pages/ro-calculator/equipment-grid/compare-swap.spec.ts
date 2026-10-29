import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { ItemModel } from 'src/app/models/item.model';
import { EquipmentGridComponent, SelectGradeEvent, SelectItemEvent } from '../../../../../react/controllers/equipment-grid';
import { SlotListBag } from './slot-list-bag.model';
import { DEFAULT_CATALOG } from 'src/app/i18n';
import { translate } from 'src/app/core/i18n';

/**
 * The ⇅ on a compared slot: it exchanges the alternative with what the build wears, so the
 * item that won a comparison is kept without being picked out of the list again.
 *
 * Card jSJIuhMp8982pDsKnT2g on the tracker.
 */

const item = (id: number, over: Partial<ItemModel> = {}): ItemModel =>
  ({ id, name: `item ${id}`, aegisName: `Item_${id}`, itemLevel: 4, slots: 1, canGrade: true, script: {}, ...over }) as ItemModel;

const lists = () =>
  ({
    refineList: Array.from({ length: 21 }, (_, value) => ({ label: `+${value}`, value })),
    shadowRefineList: Array.from({ length: 11 }, (_, value) => ({ label: `+${value}`, value })),
  }) as unknown as SlotListBag;

interface Emissions {
  selectItem: SelectItemEvent[];
  selectGrade: SelectGradeEvent[];
  clearItem: string[];
  option: number;
  propertyAtk: number;
  compareItem: number;
  compareSlots: boolean[];
}

function makeGrid(model: Record<string, any>, model2: Record<string, any>, compareItemNames: string[]) {
  const grid = new EquipmentGridComponent({ hintPending: false } as any, (key) => translate(DEFAULT_CATALOG, key));

  grid.items = { 1: item(1), 2: item(2), 3: item(3), 4: item(4), 5: item(5), 6: item(6) };
  // Known enchants, so an enchant the item's own table does not list is rescued on
  // hydration rather than cleared — which is what a swap has to look like.
  grid.mapEnchant = new Map(Object.values(grid.items).map((entry) => [entry.aegisName, entry]));
  grid.lists = lists();
  grid.model = { rawOptionTxts: [], ...model };
  grid.model2 = { rawOptionTxts: [], ...model2 };
  grid.compareItemNames = compareItemNames;
  // What the compare pipeline would have answered for these slots.
  grid.showCompareItemMap = compareItemNames.reduce((agg, key) => ({ ...agg, [key]: true }), {});

  const seen: Emissions = { selectItem: [], selectGrade: [], clearItem: [], option: 0, propertyAtk: 0, compareItem: 0, compareSlots: [] };
  grid.selectItem.subscribe((event) => seen.selectItem.push(event));
  grid.selectGrade.subscribe((event) => seen.selectGrade.push(event));
  grid.clearItem.subscribe((key) => seen.clearItem.push(key));
  grid.optionChange.subscribe(() => (seen.option += 1));
  grid.propertyAtkChange.subscribe(() => (seen.propertyAtk += 1));
  grid.compareItemChange.subscribe(() => (seen.compareItem += 1));
  grid.compareSlotsChange.subscribe((clear) => seen.compareSlots.push(clear));

  grid.refreshInputs();

  return { grid, seen, swap: (key: ItemTypeEnum) => grid.onSwapCompare(SLOTS_BY_KEY.get(key)!) };
}

describe('swapping a compared slot', () => {
  it('exchanges every field the slot owns, in both directions at once', () => {
    const { grid, swap } = makeGrid(
      {
        armor: 1,
        armorRefine: 9,
        armorGrade: 'A',
        armorCard: 2,
        armorEnchant1: 3,
        rawOptionTxts: ['opt-build'],
      },
      {
        armor: 4,
        armorRefine: 15,
        armorGrade: 'B',
        armorCard: 5,
        armorEnchant2: 6,
        rawOptionTxts: ['opt-compare'],
      },
      [ItemTypeEnum.armor],
    );

    swap(ItemTypeEnum.armor);

    expect(grid.model['armor']).toBe(4);
    expect(grid.model['armorRefine']).toBe(15);
    expect(grid.model['armorGrade']).toBe('B');
    expect(grid.model['armorCard']).toBe(5);
    expect(grid.model['armorEnchant2']).toBe(6);
    // The build's own enchant went with it — the alternative had nothing in position 1.
    expect(grid.model['armorEnchant1']).toBeUndefined();

    expect(grid.model2['armor']).toBe(1);
    expect(grid.model2['armorRefine']).toBe(9);
    expect(grid.model2['armorGrade']).toBe('A');
    expect(grid.model2['armorCard']).toBe(2);
    expect(grid.model2['armorEnchant1']).toBe(3);
    expect(grid.model2['armorEnchant2']).toBeUndefined();
  });

  it('swaps the slot Bônus Aleatórios along with the item that carries them', () => {
    const armor = SLOTS_BY_KEY.get(ItemTypeEnum.armor)!;
    const [index] = armor.optionIndexes;
    const main: string[] = [];
    const compare: string[] = [];
    main[index] = 'do build';
    compare[index] = 'do comparado';

    const { grid, swap } = makeGrid({ armor: 1, rawOptionTxts: main }, { armor: 4, rawOptionTxts: compare }, [ItemTypeEnum.armor]);

    swap(ItemTypeEnum.armor);

    expect(grid.model['rawOptionTxts'][index]).toBe('do comparado');
    expect(grid.model2['rawOptionTxts'][index]).toBe('do build');
  });

  it('announces the build half on the item bus and re-persists the comparison', () => {
    const { seen, swap } = makeGrid(
      { armor: 1, armorRefine: 9, armorGrade: 'A', armorCard: 2 },
      { armor: 4, armorRefine: 15, armorGrade: 'B', armorCard: 5 },
      [ItemTypeEnum.armor],
    );

    swap(ItemTypeEnum.armor);

    // The refine rides along with the item, as it does out of the item chip.
    expect(seen.selectItem).toContainEqual({ itemType: 'armor', itemId: 4, refine: 15 });
    expect(seen.selectItem).toContainEqual({ itemType: 'armorCard', itemId: 5, refine: 0 });
    expect(seen.selectGrade).toContainEqual({ itemType: 'armor', itemId: 4, grade: 'B' });
    // The two halves are saved under separate keys, so both buses have to hear about it.
    expect(seen.compareItem).toBe(1);
    // Nothing joined or left the comparison.
    expect(seen.compareSlots).toEqual([]);
  });

  it('empties the slot when the comparison is the empty one, and lets the clear cascade run', () => {
    const { grid, seen, swap } = makeGrid({ armor: 1, armorRefine: 9, armorCard: 2 }, {}, [ItemTypeEnum.armor]);

    swap(ItemTypeEnum.armor);

    expect(grid.model['armor']).toBeUndefined();
    expect(grid.model['armorRefine']).toBeUndefined();
    expect(grid.model['armorCard']).toBeUndefined();
    expect(grid.model2['armor']).toBe(1);
    expect(grid.model2['armorRefine']).toBe(9);

    expect(seen.selectItem).toContainEqual({ itemType: 'armor', itemId: null, refine: 0 });
    // The off-hand, the converter and the ammo belong to no slot of their own; only the
    // host's cascade evicts them.
    expect(seen.clearItem).toEqual(['armor']);
  });

  it("carries the weapon's converter, ammo and off-hand-shaped extras across", () => {
    const { grid, seen, swap } = makeGrid(
      { weapon: 1, weaponRefine: 4, propertyAtk: 'fire', ammo: 2 },
      { weapon: 4, weaponRefine: 10, propertyAtk: 'water', ammo: 5 },
      [ItemTypeEnum.weapon],
    );

    swap(ItemTypeEnum.weapon);

    expect(grid.model['propertyAtk']).toBe('water');
    expect(grid.model['ammo']).toBe(5);
    expect(grid.model2['propertyAtk']).toBe('fire');
    expect(grid.model2['ammo']).toBe(2);

    expect(seen.selectItem).toContainEqual({ itemType: 'weapon', itemId: 4, refine: 10 });
    expect(seen.selectItem).toContainEqual({ itemType: 'ammo', itemId: 5, refine: 0 });
    expect(seen.propertyAtk).toBe(1);
    // The weapon is still equipped, so nothing has to cascade.
    expect(seen.clearItem).toEqual([]);
  });

  it("carries the pet's loyalty tier across with the egg", () => {
    const { grid, seen, swap } = makeGrid({ pet: 1, petLoyalty: 'Alta' }, { pet: 4, petLoyalty: 'Baixa' }, [ItemTypeEnum.pet]);

    swap(ItemTypeEnum.pet);

    expect(grid.model['pet']).toBe(4);
    expect(grid.model['petLoyalty']).toBe('Baixa');
    expect(grid.model2['petLoyalty']).toBe('Alta');
    expect(seen.option).toBe(1);
  });

  it('moves only the enchants of a costume card, never the visual it rides on', () => {
    const costume = SLOTS_BY_KEY.get(ItemTypeEnum.costumeUpper)!;
    const enchant = costume.subItemSlots!.find((sub) => sub.comparable)!.key;

    const { grid, seen, swap } = makeGrid({ costumeUpper: 1, [enchant]: 2 }, { [enchant]: 5 }, [enchant]);

    swap(ItemTypeEnum.costumeUpper);

    // The visual is not comparable, so it stays where it was — swapping it would take the
    // costume off to make room for a comparison that never held one.
    expect(grid.model['costumeUpper']).toBe(1);
    expect(grid.model2['costumeUpper']).toBeUndefined();

    expect(grid.model[enchant]).toBe(5);
    expect(grid.model2[enchant]).toBe(2);
    expect(seen.selectItem).toEqual([{ itemType: enchant, itemId: 5, refine: 0 }]);
    expect(seen.compareItem).toBe(1);
  });
});

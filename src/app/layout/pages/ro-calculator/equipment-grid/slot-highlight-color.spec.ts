import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { SLOT_COLOR_BY_ID } from 'src/app/core/slot-colors';
import { ItemModel } from 'src/app/models/item.model';
import { EquipmentGridComponent } from '../../../../../react/controllers/equipment-grid';
import { SlotListBag } from './slot-list-bag.model';
import { DEFAULT_CATALOG } from 'src/app/i18n';
import { translate } from 'src/app/core/i18n';

/**
 * The highlight a player puts on an equipment card to say which pieces are the build
 * and which are stand-ins: how it is written, what carries it, and what drops it.
 */

const item = (id: number): ItemModel =>
  ({ id, name: `item ${id}`, aegisName: `Item_${id}`, itemLevel: 4, slots: 1, canGrade: true, script: {} }) as ItemModel;

const lists = () =>
  ({
    refineList: Array.from({ length: 21 }, (_, value) => ({ label: `+${value}`, value })),
    shadowRefineList: Array.from({ length: 11 }, (_, value) => ({ label: `+${value}`, value })),
  }) as unknown as SlotListBag;

/** The colour panel service, which owns the two values that belong to the browser. */
const colorPicker = () => ({ hintPending: true, labels: {} }) as any;

function makeGrid(model: Record<string, any>, picker = colorPicker()) {
  const grid = new EquipmentGridComponent(picker, (key) => translate(DEFAULT_CATALOG, key));

  grid.items = { 1: item(1), 2: item(2) };
  grid.mapEnchant = new Map(Object.values(grid.items).map((entry) => [entry.aegisName, entry]));
  grid.lists = lists();
  grid.model = { rawOptionTxts: [], slotColors: {}, ...model };
  grid.model2 = { rawOptionTxts: [] };
  grid.compareItemNames = [];
  grid.showCompareItemMap = {};

  let colorChanges = 0;
  grid.slotColorChange.subscribe(() => (colorChanges += 1));
  grid.refreshInputs();

  const slot = (key: ItemTypeEnum) => SLOTS_BY_KEY.get(key)!;

  return {
    grid,
    changes: () => colorChanges,
    pick: (key: ItemTypeEnum, id: string | null) => grid.onPickColor(slot(key), id),
    clearCard: (key: ItemTypeEnum) => grid.onClearSlot(slot(key)),
    /** The item chip's own ✕, which is a pick of null rather than a card-wide clear. */
    clearChip: (key: ItemTypeEnum, kind: 'item' | 'subItem' = 'item') =>
      grid.onPickField({ chip: { kind, slotKey: key, field: key, index: 0, placeholder: '' } as any, value: null, compare: false }),
  };
}

describe('picking a colour', () => {
  it('writes the palette id under the slot key and announces it once', () => {
    const g = makeGrid({ weapon: 1 });

    g.pick(ItemTypeEnum.weapon, 'azul');

    expect(g.grid.model['slotColors']).toEqual({ weapon: 'azul' });
    expect(g.changes()).toBe(1);
  });

  /**
   * The host builds its blank model once and keeps it for the session, so an unmarked
   * build shares that object's empty map. A write in place would leave the next build
   * loaded wearing this one's marks.
   */
  it('replaces the map rather than writing into it', () => {
    const g = makeGrid({ weapon: 1 });
    const before = g.grid.model['slotColors'];

    g.pick(ItemTypeEnum.weapon, 'rosa');

    expect(g.grid.model['slotColors']).not.toBe(before);
    expect(before).toEqual({});
  });

  it('clears the slot with a null pick', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'azul' } });

    g.pick(ItemTypeEnum.weapon, null);

    expect(g.grid.model['slotColors']).toEqual({});
  });

  it('says nothing when the colour is already the one asked for', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'azul' } });

    g.pick(ItemTypeEnum.weapon, 'azul');

    expect(g.changes()).toBe(0);
  });

  it('resolves the colour on a card to the palette entry, by reference', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'turquesa' } });

    expect(g.grid.colorOf(SLOTS_BY_KEY.get(ItemTypeEnum.weapon)!)).toBe(SLOT_COLOR_BY_ID.get('turquesa'));
    expect(g.grid.colorOf(SLOTS_BY_KEY.get(ItemTypeEnum.armor)!)).toBeNull();
  });

  it('resolves an unknown id to no colour, so a stale save draws a plain card', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'dourado' } });

    expect(g.grid.colorOf(SLOTS_BY_KEY.get(ItemTypeEnum.weapon)!)).toBeNull();
  });
});

describe('what drops the colour', () => {
  it('goes out with the card\'s own ✕', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'azul', armor: 'rosa' } });

    g.clearCard(ItemTypeEnum.weapon);

    expect(g.grid.model['slotColors']).toEqual({ armor: 'rosa' });
  });

  it('goes out with the item chip\'s ✕ too', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'azul' } });

    g.clearChip(ItemTypeEnum.weapon);

    expect(g.grid.model['slotColors']).toEqual({});
  });

  /** The mark is on the slot, not on the piece that happens to be in it right now. */
  it('survives swapping one item for another', () => {
    const g = makeGrid({ weapon: 1, slotColors: { weapon: 'azul' } });

    g.grid.onPickField({
      chip: { kind: 'item', slotKey: ItemTypeEnum.weapon, field: ItemTypeEnum.weapon, index: 0, placeholder: '' } as any,
      value: 2,
      compare: false,
    });

    expect(g.grid.model['slotColors']).toEqual({ weapon: 'azul' });
  });

  /** A costume's enchants are slots of their own; emptying one must not untag the costume. */
  it('survives clearing a sub-slot', () => {
    const g = makeGrid({ costumeUpper: 1, slotColors: { costumeUpper: 'rosa' } });

    g.clearChip(ItemTypeEnum.costumeEnchantUpper, 'subItem');

    expect(g.grid.model['slotColors']).toEqual({ costumeUpper: 'rosa' });
  });

  /** The comparison is not marked: the alternative is amber, and only the build is tagged. */
  it('is never written to the compared model', () => {
    const g = makeGrid({ weapon: 1 });

    g.pick(ItemTypeEnum.weapon, 'azul');

    expect(g.grid.model2['slotColors']).toBeUndefined();
  });
});

/**
 * The button is on every filled card, so the first-run nudge has to pick one of them —
 * twenty callouts saying the same thing would be a banner, not a hint.
 */
describe('the first-run hint', () => {
  const slotOf = (key: ItemTypeEnum) => SLOTS_BY_KEY.get(key)!;

  it('goes to the topmost card that holds a piece', () => {
    const g = makeGrid({ armor: 1, boot: 2 });

    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.armor))).toBe(true);
    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.boot))).toBe(false);
    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.weapon))).toBe(false);
  });

  it('moves to whichever card is filled first', () => {
    const g = makeGrid({ weapon: 1, armor: 1 });

    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.weapon))).toBe(true);
    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.armor))).toBe(false);
  });

  it('goes nowhere on an empty build, where there is nothing to mark', () => {
    const g = makeGrid({});

    expect(SLOTS_BY_KEY.size).toBeGreaterThan(0);
    expect([...SLOTS_BY_KEY.values()].some((slot) => g.grid.showsColorHint(slot))).toBe(false);
  });

  it('goes nowhere once the button has been opened on this browser', () => {
    const g = makeGrid({ weapon: 1 }, { hintPending: false, labels: {} } as any);

    expect(g.grid.showsColorHint(slotOf(ItemTypeEnum.weapon))).toBe(false);
  });
});

/**
 * The button is drawn on every card so the slot names stay in line, but an empty slot has
 * no piece to mark — the guard lives in the handler rather than in a `disabled` attribute,
 * which would stop the tooltip that explains why.
 */
describe('an empty slot', () => {
  it('ignores a colour picked on a card holding nothing', () => {
    const g = makeGrid({});

    g.pick(ItemTypeEnum.weapon, 'azul');

    expect(g.grid.model['slotColors']).toEqual({});
    expect(g.changes()).toBe(0);
  });

  /** Clearing is never refused, so a mark left behind by anything can always be taken off. */
  it('still clears a mark left on a slot that has since been emptied', () => {
    const g = makeGrid({ slotColors: { weapon: 'azul' } });

    g.pick(ItemTypeEnum.weapon, null);

    expect(g.grid.model['slotColors']).toEqual({});
  });
});

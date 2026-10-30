import { describe, expect, it } from 'vitest';
import { EquipmentGridComponent } from './equipment-grid';
import { ItemSearchComponent } from './item-search';
import { ItemPickerOverlayComponent } from './item-picker-overlay';
import { CalculatorLayout, ItemShop } from '../services/calculator-services';
import { DescriptionStore } from '../services/data-client';
import { Events } from '../services/events';
import { ItemModel } from '../../app/models/item.model';
import { SlotListBag } from '../../app/layout/pages/ro-calculator/equipment-grid/slot-list-bag.model';
import { DEFAULT_CATALOG, TextKey } from '../../app/i18n';
import { TextParams, translate } from '../../app/core/i18n';

/** The controllers take a translator; pt-BR is the one the assertions read in. */
const text = (key: TextKey, params?: TextParams) => translate(DEFAULT_CATALOG, key, params);

function setup() {
  const layout = new CalculatorLayout();
  const descriptions = new DescriptionStore();
  const grid = new EquipmentGridComponent({ hintPending: false } as any, text, layout);
  const item = (id: number, name: string, fields: Partial<ItemModel> = {}) => ({ id, name, aegisName: 'Test_' + id, slots: 1, script: {}, ...fields } as ItemModel);
  grid.items = { 1: item(1, 'Chapéu'), 2: item(2, 'Armadura'), 3: item(3, 'Carta'),
    4: item(4, 'Acessório esquerdo'), 5: item(5, 'Acessório direito'), 6: item(6, 'Armadura alternativa'),
    7: item(7, 'Chapéu alternativo'), 8: item(8, 'Personalizado', { custom: true, schemaVersion: 1,
      cardCapacity: 2, enchantCapacity: 2, baCapacity: 0, defaultCards: [], defaultEnchants: [], defaultBas: [], isRefinable: true } as any) };
  grid.model = { rawOptionTxts: [], armor: 2, armorRefine: 9 };
  grid.model2 = { rawOptionTxts: [], armor: 6, armorRefine: 12 };
  grid.mapEnchant = new Map();
  grid.lists = { refineList: Array.from({ length: 19 }, (_, value) => ({ label: String(value), value })), shadowRefineList: [],
    headUpperList: [{ label: 'Chapéu', value: 1 }, { label: 'Chapéu alternativo', value: 7 }],
    armorList: [{ label: 'Armadura', value: 2 }, { label: 'Alternativa', value: 6 }, { label: 'Personalizado', value: 8 }],
    armorCardList: [{ label: 'Carta', value: 3 }], headCardList: [{ label: 'Carta', value: 3 }],
    accLeftList: [{ label: 'Esquerdo', value: 4 }], accRightList: [{ label: 'Direito', value: 5 }],
  } as unknown as SlotListBag;
  grid.compareItemNames = ['armor'];
  grid.showCompareItemMap = { armor: true };
  grid.ngOnInit(); grid.refreshInputs();
  const vm = new ItemSearchComponent(layout, {} as ItemShop, descriptions);
  vm.onClassChanged = new Events<boolean>();
  vm.items = grid.items;
  vm.equipableItems = [1, 7].map(id => ({ id, label: grid.items[id].name, value: id, position: 'headUpperList' }));
  vm.ngOnInit();
  const targets = () => layout.itemSearchTargets.getSnapshot();
  const dispose = () => { vm.ngOnDestroy(); grid.ngOnDestroy(); };
  return { layout, grid, vm, descriptions, targets, dispose };
}

describe('equipping from item search', () => {
  it('preselects the originating type, searches it, and equips through the normal event flow', () => {
    const { layout, grid, vm, targets, dispose } = setup();
    const target = targets().find(target => target.chip.slotKey === 'headUpper' && target.chip.kind === 'item' && !target.compare)!;
    const seen: unknown[] = []; grid.selectItem.subscribe(event => seen.push(event));
    vm.selectedItemPositions = ['armorList']; vm.filteredItems = vm.equipableItems; vm.activeFilteredItem = vm.equipableItems[0];
    layout.openItemSearch(target);
    expect(vm.selectedItemPositions).toEqual(['headUpperList']);
    expect(vm.filteredItems.map(row => row.id)).toEqual([1, 7]);
    expect(vm.activeFilteredItem).toBeNull();
    vm.activeFilteredItem = vm.filteredItems[0];
    expect(vm.equipTargetValue).toBe(target.targetKey);
    vm.equipSelectedItem();
    expect(grid.model.headUpper).toBe(1);
    expect(seen).toEqual([{ itemType: 'headUpper', itemId: 1, refine: 0 }]);
    expect(vm.isShowSearchDialog).toBe(false);
    dispose();
  });
  it('only offers compatible sides and existing sockets, and rejects incompatible requests', () => {
    const { layout, grid, targets, dispose } = setup();
    expect(targets().filter(target => !target.compare && target.options.some(option => option.value === 4)).map(target => target.chip.slotKey)).toEqual(['accLeft']);
    expect(targets().filter(target => !target.compare && target.chip.kind === 'card').map(target => target.chip.field)).toEqual(['armorCard']);
    const armor = targets().find(target => !target.compare && target.chip.kind === 'item' && target.chip.slotKey === 'armor')!;
    layout.itemSearchEquip.next({ targetKey: armor.targetKey, itemId: 4 });
    expect(grid.model.armor).toBe(2);
    const card = targets().find(target => !target.compare && target.chip.kind === 'card')!;
    layout.itemSearchEquip.next({ targetKey: card.targetKey, itemId: 3 });
    expect(grid.model.armorCard).toBe(3);
    layout.itemSearchEquip.next({ targetKey: armor.targetKey, itemId: 6 });
    expect(grid.model.armor).toBe(6); expect(grid.model.armorRefine).toBe(9);
    dispose();
  });
  it('keeps comparison writes separate and supports custom attachment sockets', () => {
    const { layout, grid, targets, dispose } = setup();
    const armor = targets().find(target => target.compare && target.chip.kind === 'item' && target.chip.slotKey === 'armor')!;
    const seen: unknown[] = []; grid.selectItem.subscribe(event => seen.push(event));
    layout.itemSearchEquip.next({ targetKey: armor.targetKey, itemId: 2 });
    expect(grid.model2.armor).toBe(2); expect(grid.model2.armorRefine).toBe(12);
    expect(grid.model.armor).toBe(2); expect(seen).toEqual([]);
    const main = targets().find(target => !target.compare && target.chip.kind === 'item' && target.chip.slotKey === 'armor')!;
    layout.itemSearchEquip.next({ targetKey: main.targetKey, itemId: 8 });
    const card = targets().find(target => !target.compare && target.chip.kind === 'card' && target.chip.custom && target.chip.index === 1)!;
    layout.itemSearchEquip.next({ targetKey: card.targetKey, itemId: 3 });
    expect(grid.model.customAttachments.armor.cards[1]).toBe(3);
    dispose();
  });
  it('removes stale destinations after an item is cleared and releases subscriptions', () => {
    const { layout, grid, vm, targets, dispose } = setup();
    const card = targets().find(target => !target.compare && target.chip.kind === 'card')!;
    grid.model.armor = undefined; grid.refreshInputs();
    layout.itemSearchEquip.next({ targetKey: card.targetKey, itemId: 3 });
    expect(grid.model.armorCard).toBeUndefined();
    dispose();
    expect(targets()).toEqual([]);
    layout.openItemSearch(card); expect(vm.isShowSearchDialog).toBe(false);
  });
  it('prefers the originating accessory side when the item fits both sides', () => {
    const { layout, grid, vm, targets, dispose } = setup();
    grid.lists.accRightList.push({ label: 'Esquerdo', value: 4 }); grid.refreshInputs();
    vm.equipableItems = [{ id: 4, label: 'Acessório', value: 4, position: 'accList' }];
    const right = targets().find(target => !target.compare && target.chip.slotKey === 'accRight')!;
    layout.openItemSearch(right); vm.activeFilteredItem = vm.filteredItems[0];
    expect(vm.equipTargetOptions).toHaveLength(2);
    expect(vm.equipTargetValue).toBe(right.targetKey);
    vm.equipSelectedItem();
    expect(grid.model.accRight).toBe(4); expect(grid.model.accLeft).toBeUndefined();
    dispose();
  });
  it('only offers ammunition when the equipment grid exposes its picker', () => {
    const { grid, targets, dispose } = setup();
    grid.model.weapon = 1; grid.lists.ammoList = [{ label: 'Munição', value: 3 }];
    grid.hiddenMap.ammu = true; grid.refreshInputs();
    expect(targets().some(target => target.chip.kind === 'ammo')).toBe(false);
    grid.hiddenMap.ammu = false; grid.refreshInputs();
    expect(targets().some(target => target.chip.kind === 'ammo' && !target.compare)).toBe(true);
    dispose();
  });
  it('hands off the compact picker without committing a selection', () => {
    const { targets, descriptions, dispose } = setup();
    const target = targets()[0];
    const picker = new ItemPickerOverlayComponent({ nativeElement: null! }, descriptions, text);
    picker.init({ mode: 'flat', anchor: null!, title: 'Selecionar', options: target.options,
      value: null, filterKeys: ['label'], search: target });
    const seen: unknown[] = []; picker.closed.subscribe(result => seen.push(result));
    picker.openSearch();
    expect(seen).toEqual([{ committed: false, search: target }]);
    expect(picker.canSearch).toBe(true);
    dispose();
  });
});

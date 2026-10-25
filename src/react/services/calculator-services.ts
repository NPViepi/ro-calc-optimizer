import { Store } from '../state/store';
import { PreviewPreferences } from './preview-preferences';
import { StorageLike } from '../../app/core/calc-storage';
import type { ItemSearchOpenRequest, ItemSearchEquipTarget } from '../../app/core/item-search-equipment';
import { DataClient, DescriptionStore } from './data-client';
import { CustomItems } from './custom-items';
import { Events } from './events';
import { SlotColorLabels } from '../../app/core/slot-colors';
import { CustomItemDefinition } from '../../app/core/custom-items';
import { ColorPicker } from './pickers';
import { SlotColorPickerRequest, SlotColorPickerEvent } from '../../app/layout/pages/ro-calculator/slot-color-picker/slot-color-picker.model';

export class CalculatorData {
  constructor(private readonly client: DataClient) {}
  getItems<T>(): Promise<T> { return this.client.load('itemsCore'); }
  getMonsters<T>(): Promise<T> { return this.client.load('monsters'); }
  getHpSpTable<T>(): Promise<T> { return this.client.load('hpsp'); }
  getLatamClasses(): Promise<number[]> { return this.client.load('classes'); }
  getItemViews(): Promise<Record<string, [number, number]>> { return this.client.load('itemViews'); }
  getItemDescriptions(): Promise<void> { return this.client.loadDescriptions(); }
  getSkillDescriptions(): Promise<void> { return this.client.loadSkillDescriptions(); }
}
export class CalculatorLayout {
  readonly previews: PreviewPreferences;
  constructor(storage: StorageLike | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
    this.previews = new PreviewPreferences(storage);
  }
  readonly customItemsOpen = new Events<void>();
  readonly customItemCreate = new Events<{ kind: string; slot: string; compare: boolean }>();
  readonly customItemEdit = new Events<number>();
  readonly helpImproveOpen = new Events<void>();
  /** The phone topbar's save and link buttons, which act on the calculator's build. */
  readonly buildSaveOpen = new Events<void>();
  readonly buildShareOpen = new Events<void>();
  readonly itemSearchOpen = new Events<ItemSearchOpenRequest | undefined>();
  readonly itemSearchTargets = new Store<readonly ItemSearchEquipTarget[]>([]);
  readonly itemSearchEquip = new Events<{ targetKey: string; itemId: number }>();
  openCustomItems(): void { this.customItemsOpen.next(); }
  openCustomItem(kind: string, slot: string, compare: boolean): void { this.customItemCreate.next({ kind, slot, compare }); }
  openCustomItemEdit(id: number): void { this.customItemEdit.next(id); }
  openHelpImprove(): void { this.helpImproveOpen.next(); }
  openBuildSave(): void { this.buildSaveOpen.next(); }
  openBuildShare(): void { this.buildShareOpen.next(); }
  openItemSearch(request?: ItemSearchOpenRequest): void { this.itemSearchOpen.next(request); }
}
export class SlotColorPreferences {
  labels: SlotColorLabels = {};
  hintPending = false;
  readonly localChange = new Events<void>();
  readonly picker = new ColorPicker();
  open(request: SlotColorPickerRequest): Promise<SlotColorPickerEvent> { return this.picker.open(request); }
  initLocal(labels: SlotColorLabels, hintPending: boolean): void { this.labels = labels; this.hintPending = hintPending; }
  markFound(): void { if (this.hintPending) { this.hintPending = false; this.localChange.next(); } }
}
export class ItemShop {
  readonly serverOptions = [{ label: 'Freya', value: 'FREYA' }, { label: 'Nidhogg', value: 'NIDHOGG' }];
  private selected = localStorage.getItem('ro-shop-server') || 'FREYA';
  get server(): string { return this.selected; }
  set server(value: string) { this.selected = value; localStorage.setItem('ro-shop-server', value); }
  divinePrideItemUrl(id: number): string { return id ? `https://www.divine-pride.net/database/item/${id}` : ''; }
  marketItemUrl(name: string): string {
    return name ? `https://ro.gnjoylatam.com/pt/intro/shop-search/trading?${new URLSearchParams({ storeType: 'BUY', serverType: this.server, searchWord: name })}` : '';
  }
}
export interface CustomStudioHandle {
  openLibrary(): void;
  openCreate(kind: string, context: { slot: string; compare: boolean }): void;
  edit(item: CustomItemDefinition): void;
}
export { DescriptionStore, CustomItems };

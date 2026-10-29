import { ViewState } from '../state/view-state';
import { Events, Disposable } from '../services/events';
import { prettyItemDesc } from '../../app/utils/pretty-item-desc';
import { DropdownModel } from '../../app/models/dropdown.model';
import type { CustomKind } from '../../app/core/custom-items';
import { ItemModel } from '../../app/models/item.model';
import { filterSearchItems, ITEM_SEARCH_BONUS_OPTIONS, ItemSearchRow } from '../../app/core/item-search';
import { CalculatorLayout as LayoutService, ItemShop as ItemShopService } from '../services/calculator-services';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { DescriptionStore as ItemDescriptionStore } from '../services/data-client';

/**
 * The equipment positions the type filter offers, in the order they are listed.
 * Labels are resolved per render from `itemPosition.<value>` in the catalog, so the
 * list itself carries no text — see `itemPositions`.
 *
 * `as const` is load-bearing: it keeps each `value` a literal, so the view's
 * `itemPosition.${value}` lookup is checked against the catalog's key set.
 */
const positions = [
  { value: 'weaponList', iconKind: 'weapon' },
  { value: 'ammoList', iconKind: 'ammo' },
  { value: 'weaponCardList', iconKind: 'card' },

  { value: 'shieldList', iconKind: 'shield' },
  { value: 'shieldCardList', iconKind: 'card' },

  { value: 'headUpperList', iconKind: 'headUpper' },
  { value: 'headMiddleList', iconKind: 'headMiddle' },
  { value: 'headLowerList', iconKind: 'headLower' },
  { value: 'headCardList', iconKind: 'card' },

  { value: 'enchants', iconKind: 'enchant' },

  { value: 'armorList', iconKind: 'armor' },
  { value: 'armorCardList', iconKind: 'card' },
  { value: 'garmentList', iconKind: 'garment' },
  { value: 'garmentCardList', iconKind: 'card' },
  { value: 'bootList', iconKind: 'boot' },
  { value: 'bootCardList', iconKind: 'card' },
  { value: 'accList', iconKind: 'accessory' },
  { value: 'accCardList', iconKind: 'card' },

  { value: 'petList', iconKind: 'pet' },

  { value: 'costumeList', iconKind: 'costumeUpper' },

  { value: 'shadowWeaponList', iconKind: 'shadowWeapon' },
  { value: 'shadowArmorList', iconKind: 'shadowArmor' },
  { value: 'shadowShieldList', iconKind: 'shadowShield' },
  { value: 'shadowBootList', iconKind: 'shadowBoot' },
  { value: 'shadowEarringList', iconKind: 'shadowEarring' },
  { value: 'shadowPendantList', iconKind: 'shadowPendant' },
] as const satisfies readonly { value: string; iconKind: CustomKind }[];

export class ItemSearchComponent extends ViewState {
  items: Record<number, ItemModel> = {};
  selectedCharacter?: { className: string };
  className = '';
  currentLevel = 1;
  equipableItems: ItemSearchRow[] = [];
  offensiveSkills: (DropdownModel & { icon?: number })[] = [];
  onClassChanged!: Events<boolean>;

  private classSubscription?: Disposable;
  private openSubscription?: Disposable;
  private unsubscribeTargets?: () => void;
  private preferredTargetKey?: string;
  equipInComparison = false;
  selectedEquipTarget: string | null = null;
  private nextBonusId = 1;

  constructor(
    private readonly layoutService: LayoutService,
    private readonly itemShop: ItemShopService,
    private readonly itemDescriptions: ItemDescriptionStore,
  ) { super(); }

  isShowSearchDialog = false;
  readonly itemPositions = positions;
  readonly bonusNameList = ITEM_SEARCH_BONUS_OPTIONS;
  searchName = '';
  selectedItemPositions: string[] = [];
  selectedOffensiveSkills: string[] = [];
  bonusPickers: { id: number; value: string | null }[] = [{ id: 0, value: null }];
  matchAllBonuses = true;
  onlyCurrentLevel = false;
  itemSearchFirst = 0;
  filteredItems: ItemSearchRow[] = [];
  activeFilteredItem: ItemSearchRow | null = null;

  get totalFilteredItems(): number { return this.filteredItems.length; }
  get activeItem(): ItemModel | undefined { return this.items[this.activeFilteredItem?.id]; }
  // controllerView already subscribes to DescriptionStore. Read the current value on
  // every render so an item selected before itemsDesc arrives gains its description.
  get activeFilteredItemDesc(): string {
    return prettyItemDesc(this.itemDescriptions.get(this.activeFilteredItem?.id)) ?? '';
  }
  get shopServerOptions() { return this.itemShop.serverOptions; }
  get selectedShopServer(): string { return this.itemShop.server; }
  set selectedShopServer(value: string) { this.itemShop.server = value; }
  get divinePrideItemUrl(): string { return this.itemShop.divinePrideItemUrl(this.activeFilteredItem?.id); }
  get marketItemUrl(): string { return this.itemShop.marketItemUrl(this.activeItem?.name); }

  ngOnInit(): void {
    this.classSubscription = this.onClassChanged.subscribe(() => this.action(() => {
      this.selectedOffensiveSkills = [];
      this.preferredTargetKey = undefined;
      this.equipInComparison = false;
      this.clearResults();
    }));
    this.unsubscribeTargets = this.layoutService.itemSearchTargets.subscribe(() => this.publish());
    this.openSubscription = this.layoutService.itemSearchOpen.subscribe(request => this.action(() => {
      this.preferredTargetKey = request?.targetKey;
      this.equipInComparison = request?.compare ?? false;
      this.selectedEquipTarget = null;
      if (request) {
        this.selectedItemPositions = [request.position];
      }
      if (request || this.onlyCurrentLevel) this.onItemSearchFilterChange();
      this.isShowSearchDialog = true;
    }));
  }
  ngOnDestroy(): void {
    this.classSubscription?.unsubscribe();
    this.openSubscription?.unsubscribe();
    this.unsubscribeTargets?.();
  }

  get equipTargetOptions(): DropdownModel[] {
    const id = this.activeFilteredItem?.id;
    if (!id) return [];
    return this.layoutService.itemSearchTargets.getSnapshot()
      .filter(target => target.compare === this.equipInComparison && target.options.some(option => option.value === id))
      .map(target => ({ label: target.label, value: target.targetKey }));
  }
  get equipTargetValue(): string | null {
    const options = this.equipTargetOptions;
    return [this.selectedEquipTarget, this.preferredTargetKey].find(key => options.some(option => option.value === key))
      ?? (options[0]?.value as string | undefined) ?? null;
  }
  equipSelectedItem(): void {
    const itemId = this.activeFilteredItem?.id;
    const targetKey = this.equipTargetValue;
    if (!itemId || !targetKey) return;
    this.layoutService.itemSearchEquip.next({ targetKey, itemId });
    this.isShowSearchDialog = false;
  }

  addBonusPicker(): void { this.bonusPickers.push({ id: this.nextBonusId++, value: null }); }
  removeBonusPicker(id: number): void {
    if (this.bonusPickers.length > 1) this.bonusPickers = this.bonusPickers.filter(picker => picker.id !== id);
  }

  onItemSearchFilterChange(): void {
    this.filteredItems = filterSearchItems(this.items, this.equipableItems.filter(row =>
      this.layoutService.previews.getSnapshot() || !this.items[row.id]?.preRelease), {
      name: this.searchName,
      positions: this.selectedItemPositions,
      skillIds: this.selectedOffensiveSkills.map(name => SKILL_ID_BY_NAME[name]).filter(id => id != null),
      bonuses: this.bonusPickers.map(picker => picker.value),
      matchAllBonuses: this.matchAllBonuses,
      maxRequiredLevel: this.onlyCurrentLevel ? this.currentLevel : undefined,
    });
    this.activeFilteredItem = null;
    this.selectedEquipTarget = null;
    this.itemSearchFirst = 0;
  }

  private clearResults(): void {
    this.filteredItems = [];
    this.itemSearchFirst = 0;
    this.activeFilteredItem = null;
  }
}

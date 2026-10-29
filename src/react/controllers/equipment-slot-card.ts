import { itemChipOptions, itemSearchPosition, itemSearchTargetKey } from '../../app/core/item-search-equipment';
import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { EquipmentSlotDescriptor, comparableKeysOf } from 'src/app/app-config/equipment-slots';
import { DescriptionStore as ItemDescriptionStore } from '../services/data-client';
import { Chip, buildChipRows } from 'src/app/core/equipment-chips';
import { SlotDerivation } from 'src/app/core/equipment-slot-derivation';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { SlotColor, slotColorLabel } from 'src/app/core/slot-colors';
import { PetLoyalty } from 'src/app/constants/pet-loyalty';
import { DropdownModel } from 'src/app/models/dropdown.model';
import { ItemModel } from 'src/app/models/item.model';
import { ExtraOptionMap } from 'src/app/utils/create-extra-option-list';
import { getGradeList } from 'src/app/utils/to-grade-list';
import { PickerRequest } from '../../app/layout/pages/ro-calculator/item-picker/item-picker.model';
import { CalculatorLayout as LayoutService } from '../services/calculator-services';
import { ItemPicker as ItemPickerService } from '../services/pickers';
import { SlotColorPreferences } from '../services/calculator-services';
import { ChipView } from '../../app/layout/pages/ro-calculator/equipment-grid/chip-view.model';
import { SlotListBag } from '../../app/layout/pages/ro-calculator/equipment-grid/slot-list-bag.model';

/** What a chip click asks the grid to write. `value` of null means the field was cleared. */
export interface ChipPick {
  chip: Chip;
  value: string | number | null;
  compare: boolean;
}

/** Lealdade has no element of its own; the tiers replace one another, so the scale reads high → low. */
const LOYALTY_CLASS: Record<string, string> = {
  [PetLoyalty.Alta]: 'loyalty_alta',
  [PetLoyalty.Normal]: 'loyalty_normal',
  [PetLoyalty.Nenhuma]: 'loyalty_nenhuma',
  [PetLoyalty.Baixa]: 'loyalty_baixa',
};


export class EquipmentSlotCardComponent extends ViewState {
   descriptor!: EquipmentSlotDescriptor;
   items!: Record<number, ItemModel>;
   lists!: SlotListBag;
   model!: Record<string, any>;
   model2!: Record<string, any>;
  /** Reconciled by the grid, so a rescued enchant shows up here too. */
   derivation!: SlotDerivation;
   compareDerivation!: SlotDerivation;
  /** Name of the multi-slot head gear that already fills this position, if any. */
   occupiedBy: string | null = null;
  /**
   * Why the main build has no picker here while the compared one does — the shield row
   * against a two-handed weapon. Unlike `occupiedBy` it leaves the comparison alone: the
   * row is on screen precisely so the other build can be given a shield.
   */
   mainBlockedNote: string | null = null;
  /** Slot keys currently in the comparison. */
   comparing: ReadonlySet<string> = new Set();
  /** False when the class or the weapon takes no ammo. */
   showAmmo = false;
  /** The highlight this slot wears, resolved by the grid so the binding stays reference-stable. */
   color: SlotColor | null = null;
  /** The grid picks one card to carry the first-run hint; false everywhere else. */
   colorHint = false;
  /** Bumped by the grid to re-run the view build; the model object never changes identity. */
   revision = 0;

   readonly pickField = new Events<ChipPick>();
   readonly clearSlot = new Events<void>();
   readonly toggleCompare = new Events<void>();
   readonly clearCompare = new Events<void>();
   readonly swapCompare = new Events<void>();
  /** The chosen palette id, or null for "Sem cor". */
   readonly pickColor = new Events<string | null>();

  mainRows: ChipView[][] = [];
  compareRows: ChipView[][] = [];
  comparable = false;
  comparingHere = false;
  hasContent = false;
  hasCompareContent = false;
  canSwap = false;
  /** Set the moment the button is used, so the callout goes at once rather than fading. */
  hintDismissed = false;

  constructor(
    private readonly picker: ItemPickerService,
    private readonly colorPicker: SlotColorPreferences,
    private readonly layoutService: LayoutService,
public readonly itemDescriptions: ItemDescriptionStore,
  ) { super();}

  refreshInputs(): void {
    this.comparable = comparableKeysOf(this.descriptor).length > 0;
    this.comparingHere = comparableKeysOf(this.descriptor).some((key) => this.comparing.has(key));
    this.hasContent = this.computeHasContent();

    this.mainRows = this.buildRows(this.model, this.derivation, false);
    this.compareRows = this.comparingHere ? this.buildRows(this.model2, this.compareDerivation, true) : [];
    this.hasCompareContent = this.compareRows.some((row) => row.some((view) => view.filled));
    // Two empty sides have nothing to exchange; one filled side still does — swapping into
    // an empty comparison is how the card answers "and how much is this worth at all".
    this.canSwap = this.comparingHere && (this.hasCompareContent || this.mainRows.some((row) => row.some((view) => view.filled)));
    this.publish();
  }

  /**
   * Whether the header ✕ has anything to undo. An empty slot draws its item chip and
   * nothing else, so a clear button there is a control that cannot change what is on
   * screen; an occupied one holds no item of its own either — the gear is worn in the
   * slot that spans into this one.
   */
  private computeHasContent(): boolean {
    if (this.occupiedBy) return false;

    const keys = [this.descriptor.key, ...(this.descriptor.subItemSlots ?? []).map((sub) => sub.key)];

    return this.comparingHere || keys.some((key) => this.model?.[key] != null);
  }

  /** The item this card is holding, for the big icon and the header badge. */
  get item(): ItemModel | undefined {
    return this.items?.[this.model?.[this.descriptor.key]];
  }

  get compareItem(): ItemModel | undefined {
    return this.items?.[this.model2?.[this.descriptor.key]];
  }

  /**
   * Whether the card offers the swatch at all.
   *
   * Not `hasContent`, which is also true for an empty card that is being compared: there
   * is no piece there to call core or temporary. A card already marked keeps the button
   * whatever else happened, so the mark can always be taken off again.
   */
  get colorable(): boolean {
    return !this.occupiedBy && (this.model?.[this.descriptor.key] != null || !!this.color);
  }

  get colorTitle(): string {
    if (!this.colorable) return 'Escolha um item para poder destacar este slot';

    return this.color ? `Destaque: ${slotColorLabel(this.color, this.colorPicker.labels)}` : 'Destacar este slot com uma cor';
  }

  onPickColor(anchor: HTMLElement): void {
    if (!this.colorable) return;

    // Opening it is what counts as having found it — whether or not a colour is chosen.
    // A rename is the service's business and never reaches here; only a pick is the
    // build's, and that is what goes up to the grid.
    this.hintDismissed = true;
    this.colorPicker.markFound();

    this.colorPicker.open({ anchor, value: this.color?.id ?? null }).then((event) => {
      if (event.kind === 'pick') this.pickColor.emit(event.value ?? null);
    });
  }

  get compareTitle(): string {
    return this.occupiedBy
      ? `Comparação indisponível: este espaço está ocupado por ${this.occupiedBy}, que é usado em outro slot. Compare no slot que carrega o item.`
      : 'Ligar ou desligar a comparação deste slot';
  }

  /** See EquipmentGridComponent.trackSlot — the rows are rebuilt on every refresh. */
  trackIndex = (index: number) => index;
  trackChip = (_: number, view: ChipView) => `${view.chip.slotKey}:${view.chip.kind}:${view.chip.index}`;

  onToggleCompare(): void {
    if (this.occupiedBy) return;
    this.toggleCompare.emit();
  }

  onChipClear(view: ChipView, compare: boolean): void {
    this.pickField.emit({ chip: view.chip, value: null, compare });
  }

  onChipEdit(id: number): void {
    this.layoutService.openCustomItemEdit(id);
  }

  onChipPick(view: ChipView, anchor: HTMLElement, compare: boolean): void {
    const request = this.pickerRequest(view.chip, anchor, compare);
    if (!request) return;

    this.picker.open(request).then((result) => { if (this.lifetime.active) this.action(() => {
      if (result.search) {
        this.layoutService.openItemSearch(result.search);
        return;
      }
      if (result.create) {
        this.layoutService.openCustomItem(result.create.kind, result.create.slot, result.create.compare);
        return;
      }
      if (!result.committed) return;
      this.pickField.emit({ chip: view.chip, value: result.value ?? null, compare });
    }); });
  }

  // ── view building ────────────────────────────────────────────────────────────

  private buildRows(model: Record<string, any>, derivation: SlotDerivation, compare: boolean): ChipView[][] {
    const rows = buildChipRows(this.descriptor, model, derivation, {
      variant: compare ? 'compare' : 'main',
      comparing: this.comparing,
      showAmmo: this.showAmmo,
    });

    return rows.map((row) => row.map((chip) => this.toView(chip, model)));
  }

  private toView(chip: Chip, model: Record<string, any>): ChipView {
    const customState = chip.custom ? model?.['customAttachments']?.[chip.slotKey] : undefined;
    const raw = chip.custom
      ? customState?.[chip.kind === 'card' ? 'cards' : chip.kind === 'enchant' ? 'enchants' : 'bas']?.[chip.index]
      : chip.kind === 'option' ? model?.['rawOptionTxts']?.[chip.optionIndex!] : model?.[chip.field!];
    const empty: ChipView = {
      chip,
      text: chip.placeholder,
      filled: false,
      icon: null,
      elementClass: null,
      descId: null,
      primary: !!chip.primary,
      preRelease: false,
    };

    if (raw == null || raw === '') return empty;

    switch (chip.kind) {
      case 'item':
      case 'subItem':
      case 'card':
      case 'enchant':
      case 'ammo': {
        const item = this.items?.[raw as number];
        if (!item) return empty;
        return {
          ...empty,
          text: itemChipLabel(item),
          filled: true,
          icon: item.id,
          descId: item.id,
          preRelease: !!item.preRelease,
          // Ammo carries an element of its own and the old picker coloured it.
          elementClass: chip.kind === 'ammo' ? elementClassOf(this.lists.ammoList, raw) : null,
        };
      }
      case 'refine': {
        // 0 is a value, not a choice — it reads as the placeholder so the ✕ only shows
        // up once there is a refine worth clearing.
        const refine = Number(raw) || 0;
        return refine > 0 ? { ...empty, text: `+ ${refine}`, filled: true } : empty;
      }
      case 'grade': {
        const grade = GRADE_LABELS.get(String(raw)) ?? `Grau ${raw}`;
        return { ...empty, text: grade, filled: true };
      }
      case 'loyalty': {
        const option = this.lists.petLoyaltyList?.find((o) => o.value === raw);
        return { ...empty, text: option?.label ?? String(raw), filled: true, elementClass: LOYALTY_CLASS[String(raw)] ?? null };
      }
      case 'converter': {
        const option = this.lists.propertyAtkList?.find((o) => o.value === raw);
        if (!option) return empty;
        return { ...empty, text: option.label, filled: true, icon: option['img'], elementClass: `property_${option['element']}` };
      }
      case 'option':
        return { ...empty, text: ExtraOptionMap.get(String(raw)) ?? String(raw), filled: true };
      default:
        return empty;
    }
  }

  // ── picker wiring ────────────────────────────────────────────────────────────

  private pickerRequest(chip: Chip, anchor: HTMLElement, compare: boolean): PickerRequest | null {
    const model = compare ? this.model2 : this.model;
    const derivation = compare ? this.compareDerivation : this.derivation;
    const customState = chip.custom ? model?.['customAttachments']?.[chip.slotKey] : undefined;
    const value = chip.custom
      ? customState?.[chip.kind === 'card' ? 'cards' : chip.kind === 'enchant' ? 'enchants' : 'bas']?.[chip.index]
      : chip.kind === 'option' ? model?.['rawOptionTxts']?.[chip.optionIndex!] : model?.[chip.field!];
    // `clearable` rides on the chip, so equipment-chips.ts stays the one place that
    // decides which fields have an empty state.
    const base = { anchor, title: this.pickerTitle(chip), value, clearable: chip.clearable };

    const position = itemSearchPosition(chip, this.descriptor);
    const itemBase = { ...base, mode: 'flat' as const,
      options: itemChipOptions(chip, this.descriptor, derivation, this.lists, this.items),
      filterKeys: ITEM_KEYS, iconKey: 'value' as const, items: this.items,
      search: position ? { position, targetKey: itemSearchTargetKey(chip, compare), compare } : undefined };
    switch (chip.kind) {
      case 'item':
        return { ...itemBase, createKind: this.descriptor.key, createSlot: this.descriptor.key, createCompare: compare };
      case 'subItem': {
        const sub = this.descriptor.subItemSlots?.find(s => s.key === chip.slotKey);
        return { ...itemBase, createKind: sub?.key, createSlot: sub?.key, createCompare: compare };
      }
      case 'card':
        return { ...itemBase, filterKeys: CARD_KEYS, createKind: 'card',
          createSlot: chip.custom ? 'custom:' + chip.slotKey + ':card:' + chip.index : chip.field, createCompare: compare };
      case 'enchant':
        return { ...itemBase, createKind: 'enchant',
          createSlot: chip.custom ? 'custom:' + chip.slotKey + ':enchant:' + chip.index : chip.field, createCompare: compare };
      case 'ammo':
        return { ...itemBase, elementColoured: true, createKind: 'ammo', createSlot: 'ammo', createCompare: compare };
      case 'refine':
        return { ...base, mode: 'flat', options: refineOptions(derivation.refineList), filterKeys: ['label'] };
      case 'grade':
        return { ...base, mode: 'flat', options: derivation.gradeList, filterKeys: ['label'] };
      case 'loyalty':
        return {
          ...base,
          mode: 'flat',
          options: this.lists.petLoyaltyList ?? [],
          filterKeys: ['label'],
          colourClasses: LOYALTY_CLASS,
        };
      case 'converter':
        return { ...base, mode: 'flat', options: this.lists.propertyAtkList ?? [], filterKeys: ['label'], iconKey: 'img', elementColoured: true };
      case 'option':
        return { ...base, mode: 'tree', roots: this.lists.optionList ?? [], leafIndex: ExtraOptionMap };
      default:
        return null;
    }
  }

  private pickerTitle(chip: Chip): string {
    switch (chip.kind) {
      case 'item':
        return this.descriptor.key === ItemTypeEnum.pet ? 'Selecionar ovo' : `Selecionar ${this.descriptor.label}`;
      case 'refine':
        return 'Refino';
      case 'grade':
        return 'Grau';
      case 'loyalty':
        return 'Lealdade do pet';
      case 'converter':
        return 'Conversor de elemento';
      case 'ammo':
        return 'Munição';
      default:
        return chip.placeholder;
    }
  }
}

const GRADE_LABELS = new Map(getGradeList().map((option) => [String(option.value), option.label]));

const ITEM_KEYS = ['label', 'value'];
const CARD_KEYS = ['label', 'cardPrefix', 'value'];

/**
 * Same label the pickers show: the pt-BR names drop the "[N]" socket suffix the game
 * displays, so a 0-slot and a 1-slot version would otherwise read identically.
 */
function itemChipLabel(item: ItemModel): string {
  return item.slots > 0 && !/\[\d+\]$/.test(item.name) ? `${item.name} [${item.slots}]` : item.name;
}

function elementClassOf(list: DropdownModel[] | undefined, value: string | number): string | null {
  const element = list?.find((o) => o.value === value)?.element;
  return element ? `property_${element}` : null;
}

function refineOptions(list: DropdownModel[]): DropdownModel[] {
  return list.map((option) => ({ label: `+ ${option.value}`, value: option.value }));
}

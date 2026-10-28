import { ViewState } from '../state/view-state';
import { Events, Disposable } from '../services/events';
import { equipmentSearchTargets } from '../../app/core/item-search-equipment';
import {
  EQUIPMENT_SLOTS,
  EquipmentSlotDescriptor,
  SLOTS_BY_KEY,
  SLOT_COLUMN_COUNT,
  SLOT_GROUPS,
  comparableKeysOf,
} from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum, MainItemWithRelations } from 'src/app/constants/item-type.enum';
import { itemSlotLabelPtBr } from 'src/app/constants/item-slot-i18n';
import { Chip, slotOwnFields } from 'src/app/core/equipment-chips';
import { SlotDerivation, cardsToClear, deriveSlot, reconcileEnchants } from 'src/app/core/equipment-slot-derivation';
import { ensureCustomAttachment } from 'src/app/core/custom-attachments';
import { costumeSlotDescriptor } from 'src/app/core/costume-slot-descriptor';
import { SLOT_COLOR_BY_ID, SlotColor } from 'src/app/core/slot-colors';
import { ItemModel } from 'src/app/models/item.model';
import { CalculatorLayout, SlotColorPreferences } from '../services/calculator-services';
import { ChipPick } from './equipment-slot-card';
import { SlotListBag } from '../../app/layout/pages/ro-calculator/equipment-grid/slot-list-bag.model';

/** What the host needs to run onSelectItem — the same three arguments it always took. */
export interface SelectItemEvent {
  itemType: string;
  itemId: number | null;
  refine: number;
}

export interface SelectGradeEvent {
  itemType: string;
  itemId: number | null;
  grade: string | null;
}

interface RenderedGroup {
  label: string;
  slots: EquipmentSlotDescriptor[];
}

/**
 * The equipment picker.
 *
 * One tag in place of the ~1200 lines of markup that used to write every slot out twice,
 * once for the build and once for the comparison. What it owns is the translation between
 * a chip and the host's handlers: the emitted sequences have to match what the old
 * `ui-dropdown`s produced, or the debounced buses, the head-slot occupancy rule, the clear
 * cascade and the compare pipeline all start to disagree with the numbers.
 *
 * Layout follows SLOT_GROUPS: an Equipamento column (the pet card included), then Visuais
 * and Equipamentos Sombrios stacked beside it, in a grid that folds to a single column when
 * the left pane is narrow.
 */

export class EquipmentGridComponent extends ViewState {
   items!: Record<number, ItemModel>;
   mapEnchant!: Map<string, ItemModel>;
   model!: Record<string, any>;
   model2!: Record<string, any>;
   lists!: SlotListBag;
  /** The host's array, mutated in place — it stays the single source of truth. */
   compareItemNames: string[] = [];
  /** Which comparisons the compare pipeline is actually honouring. */
   showCompareItemMap: Record<string, boolean> = {};
   headSlotOccupiedBy: Partial<Record<ItemTypeEnum, string>> = {};
   hiddenMap: { ammu: boolean; shield: boolean } = { ammu: true, shield: true };
   isLeftWeaponShown = false;
  /** The two halves of the shield row's question, both settled by the host. */
   isShieldShown = false;
   isCompareShieldShown = false;
  /**
   * Bumped by the host at the end of each debounced pass. The models are mutated in place,
   * so nothing else tells the cards that a preset, a replay import or a share link landed.
   */
   revision = 0;

   readonly selectItem = new Events<SelectItemEvent>();
   readonly clearItem = new Events<string>();
   readonly selectGrade = new Events<SelectGradeEvent>();
   readonly optionChange = new Events<void>();
   readonly propertyAtkChange = new Events<void>();
   readonly compareItemChange = new Events<void>();
   readonly compareSlotsChange = new Events<boolean>();
  /** A slot's highlight changed and the build needs persisting — no recalculation. */
   readonly slotColorChange = new Events<void>();

  /** One entry per column of SLOT_GROUPS, each holding that column's groups in order. */
  columns: RenderedGroup[][] = [];
  derivations: Record<string, SlotDerivation> = {};
  compareDerivations: Record<string, SlotDerivation> = {};
  comparing: ReadonlySet<string> = new Set();
  /** Own counter, so a write made here reaches the OnPush cards without waiting for the bus. */
  cardRevision = 0;

  /**
   * Slots switched on since the last input change. The compare pipeline is what fills
   * `showCompareItemMap`, and it is debounced, so for those keys the map still holds the
   * previous pass's answer — a stale `false` would keep the sub-row from drawing for a
   * quarter of a second. A card only offers the toggle when it is on screen, which is the
   * same condition the pipeline applies, so trusting the toggle here is safe.
   */
  private readonly justEnabled = new Set<string>();

  /**
   * Emissions raised while deriving, flushed after the current change-detection pass.
   *
   * `refresh` runs from `ngOnChanges` and can settle a value that no longer fits — an
   * enchant the new item does not offer, a grade it cannot take. Announcing that from
   * inside change detection is what the old pickers used a `setTimeout(…, 0)` to avoid,
   * and it stays avoided here.
   */
  private queued: (() => void)[] = [];
  private searchSubscription?: Disposable;

  constructor(
private readonly colorPicker: SlotColorPreferences,
    private readonly layoutService?: CalculatorLayout,
  ) { super();}

  ngOnInit(): void {
    this.searchSubscription = this.layoutService?.itemSearchEquip.subscribe(({ targetKey, itemId }) => this.action(() => {
      const target = this.layoutService!.itemSearchTargets.getSnapshot().find(target => target.targetKey === targetKey);
      if (!target || !target.options.some(option => option.value === itemId)) return;
      this.onPickField({ chip: target.chip, value: itemId, compare: target.compare });
    }));
  }
  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.layoutService?.itemSearchTargets.set([]);
  }

  refreshInputs(): void {
    // The pipeline has run, so its answer beats the toggle's optimism from here on.
    this.justEnabled.clear();
    // Anything arriving from outside is a load, not a pick: an enchant the kRO-derived
    // table does not list has to survive it.
    this.refresh(null);
  }

  get compareCount(): number {
    return this.comparing.size;
  }

  get ribbonText(): string {
    return this.compareCount === 1 ? '1 slot em comparação' : `${this.compareCount} slots em comparação`;
  }

  /** One compared slot per line — the ribbon only renders when there is at least one. */
  get ribbonTitle(): string {
    return [...this.comparing].map((key) => itemSlotLabelPtBr(key)).join('\n');
  }

  occupiedBy(slot: EquipmentSlotDescriptor): string | null {
    return slot.headSlot ? (this.headSlotOccupiedBy?.[slot.key] ?? null) : null;
  }

  /**
   * Why the main build is not offered a shield while the row is on screen for the
   * comparison's sake. The row is there so the compared build can be given one; this half
   * of it has to say what is holding the hand, or it would hand out a picker whose item
   * the engine then ignores.
   *
   * The three reasons are the three terms of `isShieldShown`, in the same order.
   */
  mainBlockedNote(slot: EquipmentSlotDescriptor): string | null {
    if (slot.visibility !== 'shield' || this.isShieldShown) return null;

    if (!this.model?.['weapon']) return 'Equipe uma arma para poder usar escudo';
    if (this.model?.['leftWeapon']) return `${this.itemName(this.model['leftWeapon']) ?? 'A arma da mão esquerda'} ocupa a outra mão`;

    return `${this.itemName(this.model['weapon']) ?? 'A arma'} ocupa as duas mãos`;
  }

  private itemName(itemId: number): string | undefined {
    return this.items?.[itemId]?.name;
  }

  // ── highlight colours ────────────────────────────────────────────────────────

  /**
   * The palette entry a card wears, by reference.
   *
   * Handing the cards the constant rather than a fresh object is what lets the colour
   * reach an OnPush card without a `cardRevision` bump: the binding only changes identity
   * when the colour actually does.
   */
  colorOf(slot: EquipmentSlotDescriptor): SlotColor | null {
    return SLOT_COLOR_BY_ID.get(this.model?.['slotColors']?.[slot.key]) ?? null;
  }

  /**
   * Whether this card is the one that carries the first-run hint.
   *
   * Exactly one does. The button is on every card that holds a piece, and twenty callouts
   * saying the same thing would be a banner across the whole panel rather than a nudge —
   * so the topmost filled card speaks for all of them.
   */
  showsColorHint(slot: EquipmentSlotDescriptor): boolean {
    return this.colorPicker.hintPending && slot.key === this.firstMarkableSlot;
  }

  /** Recomputed per refresh: the first visible card with something in it. */
  private firstMarkableSlot: string | null = null;

  onPickColor(slot: EquipmentSlotDescriptor, id: string | null): void {
    // A slot holding nothing has no piece to call core or temporary, so it cannot take a
    // mark — the card greys its button out, and the rule is repeated here because this is
    // where the write happens. Clearing is always allowed, whatever the slot holds.
    if (id && this.model?.[slot.key] == null) return;
    // Re-picking the colour a slot already wears is a no-op, not an autosave.
    if ((this.model['slotColors']?.[slot.key] ?? null) === id) return;

    this.writeColor(slot.key, id);
    this.slotColorChange.emit();
  }

  /**
   * Always a new map, never a write into the one that is there.
   *
   * The host builds its blank model once and keeps it for the session, so an unmarked
   * build loaded from an old save shares that object's empty map — mutating it in place
   * would leave the next build loaded wearing this one's marks.
   */
  private writeColor(key: string, id: string | null): void {
    const next = { ...(this.model['slotColors'] ?? {}) };
    if (id) next[key] = id;
    else delete next[key];
    this.model['slotColors'] = next;
  }

  /**
   * Every refresh rebuilds `columns`, `derivations` and the cards' chip rows from scratch.
   * Without trackBy the default differ compares by object identity, so picking anything —
   * a pet's loyalty tier, say — tore down and recreated *every* card in the grid. The page
   * briefly lost its height, the browser clamped the scroll to the new maximum, and the
   * view jumped to the top; focus went with it.
   */
  trackSlot = (_: number, slot: EquipmentSlotDescriptor) => slot.key;
  trackIndex = (index: number) => index;
  trackGroup = (_: number, group: RenderedGroup) => group.label;

  // ── compare ──────────────────────────────────────────────────────────────────

  onToggleCompare(slot: EquipmentSlotDescriptor): void {
    slot = this.renderedSlot(slot);
    const keys = comparableKeysOf(slot);
    const isOn = keys.some((key) => this.compareItemNames.includes(key));

    if (isOn) {
      this.stopComparing(keys);
    } else {
      for (const key of keys) {
        if (!this.compareItemNames.includes(key)) this.compareItemNames.push(key);
        this.justEnabled.add(key);
      }
      this.seedComparison(slot);
    }

    this.compareSlotsChange.emit(false);
    this.refresh(null);
  }

  /**
   * Starts a comparison as a copy of what the slot is already wearing.
   *
   * A compared slot is evaluated on its own contents, not inherited from the build — so an
   * empty one asks "what if I took this off", which is almost never the question. Copying
   * makes the opening state a no-op and leaves the player to change the one thing they came
   * to try.
   *
   * Only seeds fields the comparison has not filled in, so toggling a slot off and back on
   * brings back the alternative that was built rather than overwriting it.
   */
  private seedComparison(slot: EquipmentSlotDescriptor): void {
    const copy = (field: string) => {
      if (this.model2[field] == null && this.model[field] != null) this.model2[field] = this.model[field];
    };

    if (this.model2[slot.key] == null) {
      for (const field of slotOwnFields(slot)) copy(field);
      if (this.model['customAttachments']?.[slot.key]) {
        this.model2['customAttachments'] ??= {};
        this.model2['customAttachments'][slot.key] = structuredClone(this.model['customAttachments'][slot.key]);
      }

      for (const index of slot.optionIndexes) {
        if (this.model2['rawOptionTxts'][index] == null) this.model2['rawOptionTxts'][index] = this.model['rawOptionTxts']?.[index];
      }
    }

    // The costume enchants are slots of their own, each seeded independently.
    for (const sub of slot.subItemSlots ?? []) {
      if (sub.comparable) copy(sub.key);
    }
  }

  /** Takes a card's slots out of the comparison list, which is the host's array. */
  private stopComparing(keys: string[]): void {
    for (const key of keys) {
      const at = this.compareItemNames.indexOf(key);
      if (at >= 0) this.compareItemNames.splice(at, 1);
    }
  }

  /**
   * The ✕ on a card's comparison sub-row: empties the alternative, leaving the slot
   * compared. Only the comparison side moves, so this goes out on `compareItemChange`
   * rather than through the translation table the build's own fields use.
   */
  onClearCompareSlot(slot: EquipmentSlotDescriptor): void {
    slot = this.renderedSlot(slot);
    this.clearComparedFields(slot);
    this.refresh(null);
    this.compareItemChange.emit();
  }

  /**
   * The ⇅ on a card's comparison sub-row: exchanges the alternative with what the build is
   * wearing. Trying gear on is a loop — compare, look, compare again — and the item that
   * wins it had to be picked a second time to be kept, from a list where the reason it won
   * is no longer on screen. Swapping keeps the loser in the comparison, so switching back
   * costs another click rather than another search.
   *
   * Only the compared fields move. A costume card compares its enchants and not the visual
   * they ride on, so swapping `slotOwnFields` wholesale there would take the costume itself
   * out of the build to make room for a comparison that never held one.
   */
  onSwapCompare(slot: EquipmentSlotDescriptor): void {
    slot = this.renderedSlot(slot);
    if (!comparableKeysOf(slot).length) return;

    for (const field of this.swappedFields(slot)) {
      const mine = this.model[field];
      this.model[field] = this.model2[field];
      this.model2[field] = mine;
    }
    this.model['customAttachments'] ??= {};
    this.model2['customAttachments'] ??= {};
    const mineAttachments = this.model['customAttachments'][slot.key];
    this.model['customAttachments'][slot.key] = this.model2['customAttachments'][slot.key];
    this.model2['customAttachments'][slot.key] = mineAttachments;

    if (slot.comparable) {
      for (const index of slot.optionIndexes) {
        const mine = this.model['rawOptionTxts'][index];
        this.model['rawOptionTxts'][index] = this.model2['rawOptionTxts'][index];
        this.model2['rawOptionTxts'][index] = mine;
      }
    }

    // Hydration, not a pick: both sides already held values that fitted their own item, so
    // an enchant the kRO-derived table does not list has to survive crossing over — the
    // same reason a preset or a share link refreshes this way.
    this.refresh(null);
    this.announceSwap(slot);
  }

  /**
   * The compared half of what the card owns — the mirror of what `seedComparison` copies
   * in, minus the fields a non-comparable card key drags along.
   */
  private swappedFields(slot: EquipmentSlotDescriptor): string[] {
    return [
      ...(slot.comparable ? slotOwnFields(slot) : []),
      ...(slot.subItemSlots ?? []).filter((sub) => sub.comparable).map((sub) => sub.key),
    ];
  }

  /**
   * Tells the host what the build now wears, field by field, exactly as picking each of
   * them would have. Both buses have to hear it: `updateItemEvent` recalculates and writes
   * the autosave, `updateCompareEvent` re-persists the comparison, and they save to
   * separate keys — one firing alone leaves the two halves of the swap disagreeing.
   */
  private announceSwap(slot: EquipmentSlotDescriptor): void {
    const idOf = (field: string): number | null => (this.model[field] as number) ?? null;

    if (slot.comparable) {
      // The refine travels with the item, as it does out of the item chip.
      this.selectItem.emit({ itemType: slot.key, itemId: idOf(slot.key), refine: Number(this.model[`${slot.key}Refine`]) || 0 });

      for (const field of MainItemWithRelations[slot.key] ?? []) {
        this.selectItem.emit({ itemType: field, itemId: idOf(field), refine: 0 });
      }
      if (slot.ammo) this.selectItem.emit({ itemType: ItemTypeEnum.ammo, itemId: idOf(ItemTypeEnum.ammo), refine: 0 });
      if (slot.grade) {
        this.selectGrade.emit({ itemType: slot.key, itemId: idOf(slot.key), grade: (this.model[`${slot.key}Grade`] as string) ?? '' });
      }
      if (slot.converter) this.propertyAtkChange.emit();
      if (slot.loyalty || slot.optionIndexes.length) this.optionChange.emit();

      // Swapping an empty comparison in empties the slot, and the host's clear cascade is
      // what evicts the fields that belong to no slot of their own — the off-hand a weapon
      // was holding open, its converter and its ammo.
      if (this.model[slot.key] == null && (MainItemWithRelations[slot.key] ?? []).length) this.clearItem.emit(slot.key);
    }

    for (const sub of slot.subItemSlots ?? []) {
      if (sub.comparable) this.selectItem.emit({ itemType: sub.key, itemId: idOf(sub.key), refine: 0 });
    }

    this.compareItemChange.emit();
  }

  onClearComparison(): void {
    // The host empties the comparison by *replacing* compareItemNames, so the new array
    // reaches us as an input change on the next pass — refreshing here would only compute
    // against the array it just discarded.
    this.compareSlotsChange.emit(true);
  }

  // ── the event translation table ──────────────────────────────────────────────

  onPickField(pick: ChipPick): void {
    const touched = this.applyPick(pick);
    // Only the slot the player just touched counts as hand-picked: an enchant that is no
    // longer valid for the new item must clear rather than be rescued.
    this.refresh(touched);
  }

  /**
   * Writes one chip's value and tells the host, without re-deriving the grid — so a caller
   * emptying a whole card pays for one rebuild instead of one per field. Returns the slot
   * to treat as hand-picked, or null.
   */
  private applyPick({ chip, value, compare }: ChipPick): string | null {
    const model = compare ? this.model2 : this.model;
    const slot = chip.slotKey;

    if (chip.custom) {
      const state = model['customAttachments']?.[slot];
      if (!state) return null;
      const field = chip.kind === 'card' ? 'cards' : chip.kind === 'enchant' ? 'enchants' : 'bas';
      state[field][chip.index] = value ?? null;
      if (compare) this.compareItemChange.emit(); else this.optionChange.emit();
      return null;
    }

    switch (chip.kind) {
      case 'item':
      case 'subItem': {
        // The refine travels with the item: onSelectItem has always been handed the
        // refine the slot is already wearing.
        const refine = Number(model[`${slot}Refine`]) || 0;
        model[slot] = value ?? undefined;
        // The comparison has no onClearItem behind it, so its Bônus Aleatórios are
        // emptied here; the build's are the host's job.
        if (value == null && compare) {
          for (const index of SLOTS_BY_KEY.get(slot)?.optionIndexes ?? []) model['rawOptionTxts'][index] = undefined;
        }
        if (!compare) {
          this.selectItem.emit({ itemType: slot, itemId: (value as number) ?? null, refine });
          // A slot with no related fields has nothing to cascade, and never bound the
          // clear event in the first place (costume visuals, costume enchants, the pet).
          if (value == null && (MainItemWithRelations[slot as ItemTypeEnum] ?? []).length) this.clearItem.emit(slot);
          // Emptying the slot takes its highlight with it: the mark named the piece that
          // was there, and a painted empty card would point at nothing. Only `item` —
          // clearing a costume's enchant must not untag the costume. Both the header ✕
          // and the chip's own reach this line, and neither needs an emission of its
          // own: the item change is already on its way to the autosave.
          if (value == null && chip.kind === 'item') this.writeColor(slot, null);
        }
        break;
      }
      case 'card':
      case 'enchant': {
        model[chip.field!] = value ?? undefined;
        if (!compare) this.selectItem.emit({ itemType: chip.field!, itemId: (value as number) ?? null, refine: 0 });
        break;
      }
      case 'refine': {
        const refine = Number(value) || 0;
        model[chip.field!] = refine;
        if (model['customAttachments']?.[slot]?.itemId === model[slot]) model['customAttachments'][slot].refine = refine;
        if (!compare) this.selectItem.emit({ itemType: chip.field!, itemId: model[slot] ?? null, refine });
        break;
      }
      case 'grade': {
        const grade = (value as string) ?? '';
        model[chip.field!] = grade;
        if (model['customAttachments']?.[slot]?.itemId === model[slot]) model['customAttachments'][slot].grade = grade;
        if (!compare) this.selectGrade.emit({ itemType: slot, itemId: model[slot] ?? null, grade });
        break;
      }
      case 'ammo': {
        model[chip.field!] = value ?? undefined;
        if (!compare) this.selectItem.emit({ itemType: ItemTypeEnum.ammo, itemId: (value as number) ?? null, refine: 0 });
        break;
      }
      case 'converter': {
        model[chip.field!] = value ?? undefined;
        if (!compare) this.propertyAtkChange.emit();
        break;
      }
      case 'loyalty': {
        model[chip.field!] = value ?? undefined;
        if (!compare) this.optionChange.emit();
        break;
      }
      case 'option': {
        model['rawOptionTxts'][chip.optionIndex!] = value ?? undefined;
        if (!compare) this.optionChange.emit();
        break;
      }
    }

    if (compare) this.compareItemChange.emit();

    return chip.kind === 'item' || chip.kind === 'subItem' ? slot : null;
  }

  /**
   * The ✕ in the card header: empties the card outright, comparison included.
   *
   * Clearing only the build would leave the compared alternative behind — still counted,
   * still drawn, on a card that now reads as empty. It also has to come out of
   * `compareItemNames`, or the row would come back the moment anything re-rendered.
   */
  onClearSlot(slot: EquipmentSlotDescriptor): void {
    slot = this.renderedSlot(slot);
    const keys = comparableKeysOf(slot);
    const wasComparing = keys.some((key) => this.compareItemNames.includes(key));

    this.stopComparing(keys);
    this.clearComparedFields(slot);

    // Every picker the card draws is emptied through the same translation table a chip's
    // own ✕ goes through, so the host hears about each one exactly as it would have. The
    // sub slots need naming individually: a costume's enchants are slots of their own, and
    // the visual they ride on has no `MainItemWithRelations` entry to cascade into them.
    this.clearField('item', slot.key, slot.label);
    if (this.model['customAttachments']) delete this.model['customAttachments'][slot.key];
    for (const sub of slot.subItemSlots ?? []) this.clearField('subItem', sub.key, sub.label);
    // onClearItem covers the weapon's converter and ammo, but nothing covers the pet's
    // loyalty tier — it is a model field, not a related item.
    if (slot.loyalty) this.clearField('loyalty', 'petLoyalty', 'Lealdade');
    // One rebuild for the click, not one per field: a costume card clears four of them.
    this.refresh(slot.key);

    if (wasComparing) this.compareSlotsChange.emit(false);
    else this.compareItemChange.emit();
  }

  private clearField(kind: Chip['kind'], key: string, placeholder: string): void {
    const chip = { kind, slotKey: key as ItemTypeEnum, field: key, index: 0, placeholder } as Chip;
    this.applyPick({ chip, value: null, compare: false });
  }

  /**
   * Empties the comparison side of a card. Only that side: the build's own fields go
   * through `onPickField`, so the host hears about each one.
   */
  private clearComparedFields(slot: EquipmentSlotDescriptor): void {
    const fields = [...slotOwnFields(slot), ...(slot.subItemSlots ?? []).map((sub) => sub.key)];

    for (const field of fields) this.model2[field] = undefined;
    if (this.model2['customAttachments']) delete this.model2['customAttachments'][slot.key];
    for (const index of slot.optionIndexes) this.model2['rawOptionTxts'][index] = undefined;
  }

  // ── derivation and reconciliation ────────────────────────────────────────────

  /**
   * Recomputes what every slot offers and settles the values that no longer fit.
   *
   * `handPicked` names the slot whose item the player just chose; everywhere else counts
   * as hydration, where an enchant the table omits is surfaced instead of wiped.
   */
  private refresh(handPicked: string | null): void {
    this.comparing = new Set(
      this.compareItemNames.filter((key) => this.justEnabled.has(key) || this.showCompareItemMap?.[key] !== false),
    );

    const derivations: Record<string, SlotDerivation> = {};
    const compareDerivations: Record<string, SlotDerivation> = {};

    for (const slot of EQUIPMENT_SLOTS) {
      derivations[slot.key] = this.deriveAndSettle(slot, this.model, slot.key !== handPicked, false);
      compareDerivations[slot.key] = this.deriveAndSettle(slot, this.model2, slot.key !== handPicked, true);
    }

    this.derivations = derivations;
    this.compareDerivations = compareDerivations;
    const visible = this.visibleSlots();
    this.firstMarkableSlot = visible.find((slot) => !this.occupiedBy(slot) && this.model?.[slot.key] != null)?.key ?? null;
    this.columns = buildColumns(visible);
    if (this.layoutService && this.model && this.model2 && this.lists && this.items) {
      const targets = visible.filter(slot => !this.occupiedBy(slot));
      this.layoutService.itemSearchTargets.set([
        ...equipmentSearchTargets(targets, this.model, derivations, this.lists, this.items, false, this.comparing, !this.hiddenMap.ammu),
        ...equipmentSearchTargets(targets, this.model2, compareDerivations, this.lists, this.items, true, this.comparing, !this.hiddenMap.ammu),
      ]);
    }
    this.cardRevision += 1;
    this.publish();
    this.flush();
  }

  /** Raise what deriving settled, once the pass that settled it is over. */
  private flush(): void {
    if (!this.queued.length) return;

    const pending = this.queued;
    this.queued = [];
    setTimeout(() => {
      for (const emit of pending) emit();
    });
  }

  private deriveAndSettle(
    slot: EquipmentSlotDescriptor,
    model: Record<string, any>,
    isHydration: boolean,
    compare: boolean,
  ): SlotDerivation {
    const itemId = model?.[slot.key];
    ensureCustomAttachment(model, slot.key, this.items?.[itemId]);
    const derivation = deriveSlot({
      descriptor: slot,
      item: this.items?.[itemId],
      mapEnchant: this.mapEnchant ?? new Map(),
      refineList: this.lists?.refineList ?? [],
      shadowRefineList: this.lists?.shadowRefineList ?? [],
    });

    const { lists, clear } = reconcileEnchants({
      enchantLists: derivation.enchantLists,
      current: slot.enchantFields.map((field) => (field ? model?.[field] : undefined)),
      hasItem: !!itemId,
      items: this.items,
      mapEnchant: this.mapEnchant,
      isHydration,
    });
    derivation.enchantLists = lists;

    for (const index of clear) {
      const field = slot.enchantFields[index]!;
      model[field] = undefined;
      // The old picker routed this through onSelectItem, which emitted with a zeroed id.
      if (!compare) this.queued.push(() => this.selectItem.emit({ itemType: field, itemId: 0, refine: 0 }));
    }

    // A socket the new item does not have: the old picker emitted only the two-way
    // binding here, leaving the item change already in flight to notify the bus.
    for (const index of cardsToClear(derivation.cardSlots, slot.cardFields.map((field) => model?.[field]))) {
      model[slot.cardFields[index]] = undefined;
    }

    const gradeField = `${slot.key}Grade`;
    if (slot.grade && !derivation.gradeList.length && model?.[gradeField]) {
      model[gradeField] = null;
      if (!compare) this.queued.push(() => this.selectGrade.emit({ itemType: slot.key, itemId: itemId ?? null, grade: null }));
    }

    // A non-refinable accessory cannot keep the refine the previous one had.
    const refineField = `${slot.key}Refine`;
    if (slot.refine === 'accessory' && !derivation.refineList.length && model?.[refineField] > 0) {
      model[refineField] = 0;
    }

    return derivation;
  }

  private visibleSlots(): EquipmentSlotDescriptor[] {
    return EQUIPMENT_SLOTS.filter((slot) => {
      switch (slot.visibility) {
        case 'leftWeapon':
          return this.isLeftWeaponShown;
        case 'shield':
          return this.isShieldShown || this.isCompareShieldShown;
        default:
          return true;
      }
    }).map((slot) => this.renderedSlot(slot));
  }

  private renderedSlot(slot: EquipmentSlotDescriptor): EquipmentSlotDescriptor {
    return costumeSlotDescriptor(slot, this.items?.[this.model?.[slot.key]]);
  }
}

function buildColumns(slots: EquipmentSlotDescriptor[]): RenderedGroup[][] {
  return Array.from({ length: SLOT_COLUMN_COUNT }, (_, column) =>
    SLOT_GROUPS.filter((group) => group.column === column)
      .map((group) => ({ label: group.label, slots: slots.filter((slot) => slot.group === group.key) }))
      .filter((group) => group.slots.length > 0),
  );
}

import { EQUIPMENT_SLOTS, EquipmentSlotDescriptor, SLOTS_BY_KEY, SlotClassFilter } from '../app-config/equipment-slots';
import { AllowLeftWeaponMapper } from '../constants/allow-left-weapon-mapper';
import { ItemTypeEnum } from '../constants/item-type.enum';
import { DEFAULT_PET_LOYALTY } from '../constants/pet-loyalty';
import { MAIN_STAT_KEYS, TRAIT_KEYS } from '../constants/trait-keys';
import { WeaponTypeName, WeaponTypeNameMapBySubTypeId } from '../constants/weapon-type-mapper';
import { TextKey } from '../i18n';
import { CharacterBase } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { ItemModel } from '../models/item.model';
import { MainModel } from '../models/main.model';
import { ClassUsage, canUsedByClass } from '../utils/can-used-by-class';
import { createMainModel } from '../utils/create-main-model';
import { slotOwnFields } from './equipment-chips';

/**
 * Switching class while keeping the build.
 *
 * The class dropdown used to wipe the model down to class/level/job, so every switch was
 * a fresh start whether or not that was wanted. Keeping the build instead is only safe
 * once the parts that belong to the old class are taken out of it, and this module is
 * that subtraction: which equipped items the new class cannot wear, and what else in the
 * model stops meaning anything once the class changes.
 *
 * Framework-free so the rules can be tested without the picker. The dialog only renders
 * what `findClassSwitchLosses` returns and hands the choice back to `applyClassSwitch`.
 */

/**
 * The six one-handed types a Super Novice may carry at weapon level 4, on top of whatever
 * its own `usableClass` rows allow. Mirrors the picker's long-standing exemption.
 */
const SUPER_NOVICE_WEAPON_TYPES = new Set<WeaponTypeName>(['dagger', 'sword', 'axe', 'mace', 'rod', 'twohandRod']);

const isSuperNoviceWeapon = (item: ItemModel | undefined): boolean =>
  item?.itemLevel === 4 && SUPER_NOVICE_WEAPON_TYPES.has(WeaponTypeNameMapBySubTypeId[item.itemSubTypeId]);

/**
 * The predicate a slot filtered by `rule` offers `cClass`, over rows of whatever shape the
 * caller holds — picker rows carry the class fields themselves, `findClassSwitchLosses`
 * passes the item records.
 *
 * Built per class rather than per row on purpose: `canUsedByClass` reads the
 * Set-allocating `classNameSet` getter once, and the Super Novice branches are settled
 * here instead of being re-asked for every one of the thousands of items the pickers
 * filter. `itemOf` is only ever called on the one path that needs the full record.
 */
export function slotEquipFilter<T extends ClassUsage>(
  rule: SlotClassFilter,
  cClass: CharacterBase,
  itemOf: (row: T) => ItemModel | undefined,
): (row: T) => boolean {
  if (rule === 'none') return () => true;

  const allowed = canUsedByClass<T>(cClass);
  if (cClass.className !== ClassName.SuperNovice) return allowed;

  // Any head gear at all, and any level-4 one-hander of the six types it is allowed.
  if (rule === 'headGear') return () => true;
  if (rule === 'weapon') return (row) => isSuperNoviceWeapon(itemOf(row)) || allowed(row);

  return allowed;
}

/** Why a slot has to be emptied. */
export type ClassSwitchLossReason =
  /** The new class is not on the item's `usableClass`, or is on its `unusableClass`. */
  | 'class'
  /** A second weapon, on a class that does not dual wield — the row is not even drawn. */
  | 'offHand';

export interface ClassSwitchLoss {
  key: ItemTypeEnum;
  /** Catalog key for the slot heading, straight from the descriptor. */
  slotLabelKey: TextKey;
  itemId: number;
  /** pt-BR item name, or the bare id when the record is missing. */
  itemName: string;
  reason: ClassSwitchLossReason;
}

export interface ClassSwitchInput {
  model: MainModel;
  items: Record<number, ItemModel>;
  nextClass: CharacterBase;
}

/**
 * Every equipped item the new class would have to give up, in picker order.
 *
 * Cards, enchants and the pet are absent by construction: their lists are not filtered by
 * class (`classFilter: 'none'`), so they survive any switch. A card socketed in a weapon
 * the class cannot hold still goes, but as part of that weapon's slot rather than on its
 * own row — see `clearSlot`.
 *
 * An id with no record behind it is left alone: the picker cannot judge it either, and
 * dropping an item because its record failed to load would be worse than keeping it.
 */
export function findClassSwitchLosses({ model, items, nextClass }: ClassSwitchInput): ClassSwitchLoss[] {
  const itemOf = (item: ItemModel | undefined) => item;
  const allows: Record<SlotClassFilter, (item: ItemModel | undefined) => boolean> = {
    none: () => true,
    gear: slotEquipFilter('gear', nextClass, itemOf),
    weapon: slotEquipFilter('weapon', nextClass, itemOf),
    headGear: slotEquipFilter('headGear', nextClass, itemOf),
  };
  const canWieldOffHandWeapon = AllowLeftWeaponMapper[nextClass.className] || false;

  const losses: ClassSwitchLoss[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = model[slot.key] as number;
    if (!itemId) continue;

    const item = items?.[itemId];
    const row = { key: slot.key, slotLabelKey: slot.labelKey, itemId, itemName: item?.name ?? String(itemId) };

    if (slot.key === ItemTypeEnum.leftWeapon && !canWieldOffHandWeapon) {
      losses.push({ ...row, reason: 'offHand' });
      continue;
    }
    if (!item || allows[slot.classFilter](item)) continue;

    losses.push({ ...row, reason: 'class' });
  }

  return losses;
}

/** Empty a slot: the item, its refine, grade, cards, enchants, random options and chips. */
const clearSlot = (model: MainModel, slot: EquipmentSlotDescriptor): void => {
  // The highlight marks the piece that was in the slot, so it goes out with it — the
  // same rule the card's own header ✕ follows.
  if (model.slotColors) delete model.slotColors[slot.key];

  // `slotOwnFields` already covers the ammo and the element converter, which belong to the
  // item rather than to the slot: the ammo list is decided by the weapon and the converter
  // paints its element, so with the weapon gone neither has anything to apply to.
  for (const field of slotOwnFields(slot)) {
    model[field] = undefined;
  }
  for (const sub of slot.subItemSlots ?? []) {
    model[sub.key] = undefined;
  }
  for (const index of slot.optionIndexes) {
    model.rawOptionTxts[index] = undefined;
  }

  // The one field that resets to a value rather than to empty.
  if (slot.loyalty) model.petLoyalty = DEFAULT_PET_LOYALTY;
};

/**
 * The build as the new class would carry it: a copy of `model` with the named slots
 * emptied, and the trait points dropped when the class has none.
 *
 * Traits are the quiet one. `damage-calculator` adds `model.pow` and friends into the
 * totals whatever the class is, and only the *input* is hidden on a class without a trait
 * table — so a 4th-class build carried over to a 3rd class would keep paying POD and CON
 * with no field on screen to explain it.
 */
export function applyClassSwitch(model: MainModel, losses: ClassSwitchLoss[], nextClass: CharacterBase): MainModel {
  // A real copy, not a spread: `clearSlot` empties whatever it is handed, and the caller
  // may still cancel the switch, so a write reaching through into the live model would
  // damage the build the user chose to keep — on the one path nobody exercises. A spread
  // plus a hand-written list of the mutable fields holds only until the next one is added;
  // MainModel is JSON-safe by construction (it is stringified whole into the autosave, the
  // named saves and the share token), so cloning it is always correct and costs nothing at
  // one click behind a confirmation.
  const next: MainModel = structuredClone(model);

  for (const loss of losses) {
    const slot = SLOTS_BY_KEY.get(loss.key);
    if (slot) clearSlot(next, slot);
  }

  if (!nextClass.isAllowTraitStat()) {
    for (const key of TRAIT_KEYS) next[key] = 0;
  }

  return next;
}

/**
 * Whether the build holds anything a switch could carry over.
 *
 * A blank sheet has nothing to ask about, so the dialog stays out of the way until the
 * user has actually put something in it. Only the two things the dialog offers to keep
 * count: worn items and hand-assigned stat points, the latter measured against the sheet
 * `createMainModel` hands out rather than against a baseline copied here by hand.
 */
export function hasBuildToKeep(model: MainModel): boolean {
  if (EQUIPMENT_SLOTS.some((slot) => model[slot.key])) return true;

  const blank = createMainModel();

  return [...MAIN_STAT_KEYS, ...TRAIT_KEYS].some((key) => (model[key] ?? blank[key]) > blank[key]);
}

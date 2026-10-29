import { EquipmentSlotDescriptor } from '../app-config/equipment-slots';
import { ItemTypeEnum, MainItemWithRelations } from '../constants/item-type.enum';
import { TextRef } from '../i18n';
import { SlotDerivation } from './equipment-slot-derivation';

/**
 * How a slot card lays its pickers out: which chips exist, in which row, in which order.
 *
 * Structure only — a chip says what it writes and what to show when it is empty. Turning
 * one into a label, an icon and a colour needs the item map and the option lists, so that
 * stays in the card component; this part is pure so the layout rules can be tested.
 */

export type ChipKind = 'item' | 'subItem' | 'refine' | 'grade' | 'loyalty' | 'converter' | 'ammo' | 'card' | 'enchant' | 'option';

export interface Chip {
  kind: ChipKind;
  /** Slot key this chip belongs to — the card's own, or one of its sub slots. */
  slotKey: ItemTypeEnum;
  /** Model field the chip writes. Absent on `option`, which writes into rawOptionTxts. */
  field?: string;
  /** rawOptionTxts index — `option` only. */
  optionIndex?: number;
  /** Position within its own kind: card socket, enchant position, option number. */
  index: number;
  /** Shown when the chip is empty — resolved wherever the chip is drawn. */
  placeholder: TextRef;
  /** The item chip, drawn larger than the rest. */
  primary?: boolean;
  /**
   * False when the field has no empty state. Pet loyalty is the only one: the tiers
   * replace one another and the calculator falls back to DEFAULT_PET_LOYALTY, so an empty
   * chip would show "none" while the numbers used Alta. ("Lealdade Nenhuma" is itself a
   * tier, not the absence of one.)
   */
  clearable?: boolean;
  custom?: true;
}

export interface ChipContext {
  variant: 'main' | 'compare';
  /** Compare only: the slot keys actually in the comparison. */
  comparing?: ReadonlySet<string>;
  /** Weapon only: false when the class or the weapon takes no ammo (hiddenMap.ammu). */
  showAmmo?: boolean;
}

/**
 * Every model field a slot owns, sub slots excluded — the item, its refine and grade, the
 * cards and enchants that hang off it, and the loose fields a descriptor flag adds.
 *
 * Seeding a comparison and emptying a card are the same list walked in opposite
 * directions, so they read it from here rather than each spelling it out: a field added to
 * one and forgotten in the other is a comparison that copies something it never clears.
 * Sub slots are left to the caller, which is the one difference between the two — seeding
 * only takes the comparable ones.
 */
export function slotOwnFields(slot: EquipmentSlotDescriptor): string[] {
  return [
    slot.key,
    `${slot.key}Refine`,
    `${slot.key}Grade`,
    ...(MainItemWithRelations[slot.key] ?? []),
    ...(slot.loyalty ? ['petLoyalty'] : []),
    ...(slot.converter ? ['propertyAtk'] : []),
    ...(slot.ammo ? [ItemTypeEnum.ammo as string] : []),
  ];
}

const cardPlaceholder = (slot: EquipmentSlotDescriptor, index: number): TextRef =>
  slot.cardFields.length > 1 ? { key: 'chip.cardNumber', params: { number: index + 1 } } : { key: 'chip.card' };

/**
 * Enchant chips keep the position number the old dropdowns showed ("Encantamento 2" for
 * the first one an armour offers), so a build people know still reads the same.
 */
const enchantPlaceholder = (index: number): TextRef => ({ key: 'chip.enchantNumber', params: { number: index + 1 } });

const optionPlaceholder = (index: number): TextRef => ({ key: 'chip.optionNumber', params: { number: index + 1 } });

export function buildChipRows(
  descriptor: EquipmentSlotDescriptor,
  model: Record<string, any>,
  derivation: SlotDerivation,
  ctx: ChipContext,
): Chip[][] {
  const isCompare = ctx.variant === 'compare';
  // In the comparison a card draws only what is actually being compared. A costume card
  // owns no comparable item of its own — just its enchants — so this is what collapses it
  // to the enchant chips alone.
  const showsOwnItem = !isCompare || !!ctx.comparing?.has(descriptor.key);
  const hasItem = !!model[descriptor.key];

  const row1: Chip[] = [];
  const row2: Chip[] = [];
  const row3: Chip[] = [];

  const chip = (kind: ChipKind, field: string | undefined, index: number, placeholder: TextRef, slotKey = descriptor.key): Chip => ({
    kind,
    slotKey,
    field,
    index,
    placeholder,
  });

  if (showsOwnItem) {
    if (hasItem && derivation.refineList.length) row1.push(chip('refine', `${descriptor.key}Refine`, 0, { key: 'chip.refine' }));
    if (hasItem && derivation.gradeList.length) row1.push(chip('grade', `${descriptor.key}Grade`, 0, { key: 'chip.grade' }));

    row1.push({ ...chip('item', descriptor.key, 0, { key: descriptor.labelKey }), primary: true });

    if (hasItem) {
      if (descriptor.loyalty) row1.push({ ...chip('loyalty', 'petLoyalty', 0, { key: 'chip.loyalty' }), clearable: false });
      // The converter and the ammo belong to the weapon being compared, not to the build:
      // "this bow with a Fire converter vs without" is the same kind of question every
      // other chip answers. The compare pass carries both across by hand, the way it
      // already does the pet's loyalty tier.
      if (descriptor.converter) row1.push(chip('converter', 'propertyAtk', 0, { key: 'chip.converter' }));
      if (descriptor.ammo && ctx.showAmmo) row1.push(chip('ammo', ItemTypeEnum.ammo, 0, { key: 'chip.ammo' }));

      if (derivation.custom) {
        for (let index = 0; index < derivation.custom.cards; index++) row2.push({ ...chip('card', undefined, index, { key: 'chip.cardNumber', params: { number: index + 1 } }), custom: true });
        for (let index = 0; index < derivation.custom.enchants; index++) row2.push({ ...chip('enchant', undefined, index, enchantPlaceholder(index)), custom: true });
        for (let index = 0; index < derivation.custom.bas; index++) row3.push({ ...chip('option', undefined, index, optionPlaceholder(index)), custom: true });
      } else {
      descriptor.cardFields.slice(0, derivation.cardSlots).forEach((field, index) => {
        row2.push(chip('card', field, index, cardPlaceholder(descriptor, index)));
      });

      derivation.enchantLists.forEach((list, index) => {
        const field = descriptor.enchantFields[index];
        if (!field || !list?.length) return;
        row2.push(chip('enchant', field, index, enchantPlaceholder(index)));
      });

      descriptor.optionIndexes.slice(0, derivation.optionSlots).forEach((optionIndex, index) => {
        row3.push({ ...chip('option', undefined, index, optionPlaceholder(index)), optionIndex });
      });
      }
    }
  }

  for (const sub of descriptor.subItemSlots ?? []) {
    if (isCompare && !ctx.comparing?.has(sub.key)) continue;
    row2.push(chip('subItem', sub.key, 0, sub.label, sub.key));
  }

  // The third row exists to keep the random options off the cards-and-enchants line. With
  // no enchants there is nothing to keep them off, so they move up.
  const hasEnchantChips = row2.some((c) => c.kind === 'enchant');
  const rows = hasEnchantChips ? [row1, row2, row3] : [row1, [...row2, ...row3], []];

  return rows.filter((row) => row.length > 0);
}

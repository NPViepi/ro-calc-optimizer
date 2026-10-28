import { ItemTypeEnum } from 'src/app/constants';

/** The two slots that share the character's off hand. */
export const OFF_HAND_SLOTS: ItemTypeEnum[] = [ItemTypeEnum.shield, ItemTypeEnum.leftWeapon];

/** One of the two. */
export type OffHandSlot = ItemTypeEnum.shield | ItemTypeEnum.leftWeapon;

/**
 * The other claimant to the hand. Each of the two rows hides while its rival is filled,
 * and that is the only thing the two questions differ in.
 */
export const OFF_HAND_RIVAL: Record<OffHandSlot, OffHandSlot> = {
  [ItemTypeEnum.shield]: ItemTypeEnum.leftWeapon,
  [ItemTypeEnum.leftWeapon]: ItemTypeEnum.shield,
};

export interface OffHandState {
  /** True when the compared build's main weapon needs both hands. */
  isWeaponTwoHanded: boolean;
  /**
   * True when a second weapon is an option for this build at all — the class dual wields
   * and the screen is offering the slot. When it is false the off-hand weapon row is not
   * on screen, so a value left in the compared model is a leftover, not a choice.
   */
  canWieldOffHandWeapon: boolean;
  hasShield: boolean;
  hasLeftWeapon: boolean;
  /** The slots the "comparar slot" picker is comparing, as ItemTypeEnum values. */
  comparedSlots: readonly string[];
}

/**
 * Which off-hand slots the compared build has to give up.
 *
 * One hand, three claimants: a shield, a second weapon, or the second half of a
 * two-handed weapon. The main build can never hold two of them — each of the two rows
 * hides while a rival is filled — but a comparison can, because it merges the compared
 * slots over the main model: pick a shield against a dual-wielding build, or an off-hand
 * weapon against one carrying a shield, and the merged model would wear the pair.
 *
 * A two-handed weapon takes the hand from both. An off-hand weapon the build cannot wield
 * loses it without a contest — the row offering it is not even on screen, so nothing there
 * is a choice the user made. Between a shield and an off-hand weapon that are both real
 * options, the slot being compared is the one the user is asking about, so it keeps the
 * hand.
 */
export function resolveOffHandEviction(state: OffHandState): ItemTypeEnum[] {
  const { isWeaponTwoHanded, canWieldOffHandWeapon, hasShield, hasLeftWeapon, comparedSlots } = state;

  if (isWeaponTwoHanded) return [...OFF_HAND_SLOTS];
  if (hasLeftWeapon && !canWieldOffHandWeapon) return [ItemTypeEnum.leftWeapon];
  if (!hasShield || !hasLeftWeapon) return [];

  return [comparedSlots.includes(ItemTypeEnum.leftWeapon) ? ItemTypeEnum.shield : ItemTypeEnum.leftWeapon];
}

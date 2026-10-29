import { TextKey } from '../i18n';

// Catalog keys for the equipment slot names, by slot key. Display-only: the calc keys
// its logic on the English ItemTypeEnum values, so this map is reached only when a slot
// has to be shown to the user (a card heading, a chip, the "comparar slot" list).
//
// A key rather than the word itself — `itemSlot.*` in the catalogs carries the three
// languages, and whatever renders the slot translates it.
export const ItemSlotLabelKey: Record<string, TextKey> = {
  weapon: 'itemSlot.weapon',
  leftWeapon: 'itemSlot.leftWeapon',
  shield: 'itemSlot.shield',
  headUpper: 'itemSlot.headUpper',
  headMiddle: 'itemSlot.headMiddle',
  headLower: 'itemSlot.headLower',
  armor: 'itemSlot.armor',
  garment: 'itemSlot.garment',
  boot: 'itemSlot.boot',
  accRight: 'itemSlot.accRight',
  accLeft: 'itemSlot.accLeft',
  pet: 'itemSlot.pet',
  // The visuals are not comparable, so these four never reached the old multiselect. The
  // picker cards name every slot, comparable or not.
  costumeUpper: 'itemSlot.costumeUpper',
  costumeMiddle: 'itemSlot.costumeMiddle',
  costumeLower: 'itemSlot.costumeLower',
  costumeGarment: 'itemSlot.costumeGarment',
  costumeEnchantUpper: 'itemSlot.costumeEnchantUpper',
  costumeEnchantMiddle: 'itemSlot.costumeEnchantMiddle',
  costumeEnchantLower: 'itemSlot.costumeEnchantLower',
  costumeEnchantGarment: 'itemSlot.costumeEnchantGarment',
  costumeEnchantGarment2: 'itemSlot.costumeEnchantGarment2',
  costumeEnchantGarment4: 'itemSlot.costumeEnchantGarment4',
  shadowWeapon: 'itemSlot.shadowWeapon',
  shadowShield: 'itemSlot.shadowShield',
  shadowArmor: 'itemSlot.shadowArmor',
  shadowBoot: 'itemSlot.shadowBoot',
  shadowEarring: 'itemSlot.shadowEarring',
  shadowPendant: 'itemSlot.shadowPendant',
};

/**
 * The key naming `slot`, or the slot key itself when nothing names it.
 *
 * `translate` answers an unknown key with the key, so an unmapped slot shows up as its
 * own name — ugly and visible, which is what a missing entry here should be.
 */
export const itemSlotLabelKey = (key: string): TextKey => ItemSlotLabelKey[key] ?? (key as TextKey);

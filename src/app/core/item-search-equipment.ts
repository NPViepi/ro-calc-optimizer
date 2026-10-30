import { EquipmentSlotDescriptor } from '../app-config/equipment-slots';
import { Chip, buildChipRows } from './equipment-chips';
import { SlotDerivation } from './equipment-slot-derivation';
import { costumeSlotDescriptor } from './costume-slot-descriptor';
import { DropdownModel } from '../models/dropdown.model';
import { ItemModel } from '../models/item.model';
import { isEquipmentEnchant } from '../constants/enchant_item';
import { Translate, resolveText } from '../i18n';

export type ItemChipLists = Readonly<Record<string, readonly DropdownModel[] | undefined>>;

export interface ItemSearchOpenRequest {
  position: string;
  targetKey: string;
  compare: boolean;
}
export interface ItemSearchEquipTarget extends ItemSearchOpenRequest {
  label: string;
  chip: Chip;
  options: readonly DropdownModel[];
}
export const itemSearchTargetKey = (chip: Chip, compare: boolean) =>
  (compare ? 'compare:' : 'main:') + chip.slotKey + ':' + chip.kind + ':' + chip.index;

const customCardLists: Record<string, string> = {
  shadowWeapon: 'weaponCardList', shadowShield: 'shieldCardList', shadowArmor: 'armorCardList',
  shadowBoot: 'bootCardList', shadowEarring: 'accCardList', shadowPendant: 'accCardList',
  costumeUpper: 'headCardList', costumeMiddle: 'headCardList', costumeLower: 'headCardList',
  costumeGarment: 'garmentCardList',
};
const cardListKey = (descriptor: EquipmentSlotDescriptor) => descriptor.cardListKey ?? customCardLists[descriptor.key];

/** The search and compact picker share the exact same allowed item options. */
export function itemChipOptions(chip: Chip, descriptor: EquipmentSlotDescriptor, derivation: SlotDerivation,
  lists: ItemChipLists, items: Record<number, ItemModel>): readonly DropdownModel[] {
  switch (chip.kind) {
    case 'item': return lists[descriptor.itemListKey] ?? [];
    case 'subItem': return lists[descriptor.subItemSlots?.find(sub => sub.key === chip.slotKey)?.itemListKey ?? ''] ?? [];
    case 'card': return lists[cardListKey(descriptor) ?? ''] ?? [];
    case 'enchant': return chip.custom
      ? Object.values(items).filter(isEquipmentEnchant).map(item => ({ label: item.name, value: item.id }))
      : derivation.enchantLists[chip.index] ?? [];
    case 'ammo': return lists['ammoList'] ?? [];
    default: return [];
  }
}

export function itemSearchPosition(chip: Chip, descriptor: EquipmentSlotDescriptor): string | undefined {
  let list: string | undefined;
  switch (chip.kind) {
    case 'item': list = descriptor.itemListKey; break;
    case 'subItem': return 'costumeList';
    case 'card': list = cardListKey(descriptor); break;
    case 'enchant': return 'enchants';
    case 'ammo': return 'ammoList';
    default: return undefined;
  }
  if (list?.startsWith('costume')) return 'costumeList';
  return ({ leftWeaponList: 'weaponList', accLeftList: 'accList', accRightList: 'accList',
    accLeftCardList: 'accCardList', accRightCardList: 'accCardList' } as Record<string, string>)[list ?? ''] ?? list;
}

export function equipmentSearchTargets(slots: readonly EquipmentSlotDescriptor[], model: Record<string, any>,
  derivations: Record<string, SlotDerivation>, lists: ItemChipLists, items: Record<number, ItemModel>,
  text: Translate, compare = false, comparing: ReadonlySet<string> = new Set(), showAmmo = false): ItemSearchEquipTarget[] {
  return slots.flatMap(original => {
    const descriptor = costumeSlotDescriptor(original, items[model[original.key]]);
    const derivation = derivations[descriptor.key];
    if (!derivation) return [];
    return buildChipRows(descriptor, model, derivation, { variant: compare ? 'compare' : 'main', comparing, showAmmo })
      .flat().flatMap(chip => {
        const position = itemSearchPosition(chip, descriptor);
        if (!position) return [];
        const options = itemChipOptions(chip, descriptor, derivation, lists, items);
        if (!options.length) return [];
        return [{ position, targetKey: itemSearchTargetKey(chip, compare), chip, options, compare,
          label: chip.kind === 'item' ? text(descriptor.labelKey)
            : text(descriptor.labelKey) + ' · ' + resolveText(text, chip.placeholder) }];
      });
  });
}

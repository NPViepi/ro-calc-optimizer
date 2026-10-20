/**
 * Fase 4: cartas e encantamentos.
 *
 * Quantas cartas um item aceita e quais encantamentos cada posição oferece vêm de
 * `deriveSlot` (src/app/core/equipment-slot-derivation.ts), o mesmo código que desenha os
 * chips do card de equipamento. As cartas por slot seguem `compositionPos`, como as listas de
 * cartas da sessão (`setItemList`).
 */

import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { CardPosition } from 'src/app/constants/card-position.enum';
import { isEquipmentEnchant } from 'src/app/constants/enchant_item/equipment_enchants';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { ItemTypeId } from 'src/app/constants/item.const';
import { deriveSlot } from 'src/app/core/equipment-slot-derivation';
import { isCustomItem } from 'src/app/core/custom-items';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { CatalogOptions, OptimizableSlot } from './candidates';

const HEAD = [ItemTypeEnum.headUpper, ItemTypeEnum.headMiddle, ItemTypeEnum.headLower];

/** Slots que recebem cartas de cada `compositionPos`. */
const CARD_POSITION_SLOTS: Record<number, OptimizableSlot[]> = {
  [CardPosition.Weapon]: [ItemTypeEnum.weapon],
  [CardPosition.Head]: HEAD as OptimizableSlot[],
  [CardPosition.Shield]: [ItemTypeEnum.shield],
  [CardPosition.Armor]: [ItemTypeEnum.armor],
  [CardPosition.Garment]: [ItemTypeEnum.garment],
  [CardPosition.Boot]: [ItemTypeEnum.boot],
  [CardPosition.AccL]: [ItemTypeEnum.accLeft],
  [CardPosition.AccR]: [ItemTypeEnum.accRight],
  [CardPosition.Acc]: [ItemTypeEnum.accLeft, ItemTypeEnum.accRight],
  [CardPosition.All]: [
    ItemTypeEnum.weapon, ...HEAD, ItemTypeEnum.shield, ItemTypeEnum.armor, ItemTypeEnum.garment, ItemTypeEnum.boot,
    ItemTypeEnum.accLeft, ItemTypeEnum.accRight,
  ] as OptimizableSlot[],
};

export type CardCatalog = Partial<Record<OptimizableSlot, number[]>>;

/** Cartas disponíveis por slot (LATAM por padrão, como os dropdowns). */
export function buildCardCatalog(items: Record<number, ItemModel>, options: CatalogOptions = {}): CardCatalog {
  const latamOnly = options.latamOnly ?? true;
  const catalog: CardCatalog = {};
  for (const item of Object.values(items)) {
    if (!item || item.itemTypeId !== ItemTypeId.CARD) continue;
    if (latamOnly && !item.presentInLatam) continue;
    if (!options.includePreRelease && item.preRelease) continue;
    if (options.allowedItemIds && !options.allowedItemIds.has(item.id)) continue;
    if (options.excludedItemIds?.has(item.id)) continue;
    const position = (item as any).compositionPos;
    const slots = isCustomItem(item) && position == null ? CARD_POSITION_SLOTS[CardPosition.All] : CARD_POSITION_SLOTS[position] ?? [];
    for (const slot of slots) (catalog[slot] ??= []).push(item.id);
  }
  return catalog;
}

/** `aegisName → item` de todos os encantamentos, como `CalculatorSession.mapEnchant`. */
export function buildEnchantMap(items: Record<number, ItemModel>): Map<string, ItemModel> {
  return new Map(Object.values(items).filter((item) => item && isEquipmentEnchant(item)).map((item) => [item.aegisName, item]));
}

export interface SlotAttachments {
  /** Campos de carta utilizáveis pelo item do slot (pelos encaixes dele). */
  cardFields: ItemTypeEnum[];
  /** Cada posição de encantamento com os ids aceitos pelo item. */
  enchants: { field: ItemTypeEnum; ids: number[] }[];
}

const NONE: SlotAttachments = { cardFields: [], enchants: [] };
const NO_REFINE_LIST: [] = [];

/** O que o item atualmente no `slot` aceita de cartas e encantamentos. */
export function attachmentsFor(
  model: MainModel, slot: OptimizableSlot, items: Record<number, ItemModel>, enchantMap: Map<string, ItemModel>,
  options: { includePreRelease?: boolean; excludedItemIds?: ReadonlySet<number>; allowedItemIds?: ReadonlySet<number> } = {},
): SlotAttachments {
  const descriptor = SLOTS_BY_KEY.get(slot);
  const itemId = (model as Record<string, any>)[slot] as number | undefined;
  const item = itemId ? items[itemId] : undefined;
  if (!descriptor || !item || isCustomItem(item)) return NONE;

  const derived = deriveSlot({ descriptor, item, mapEnchant: enchantMap, refineList: NO_REFINE_LIST, shadowRefineList: NO_REFINE_LIST });
  const allowed = (id: number) => {
    const enchant = items[id];
    if (!enchant) return false;
    if (!options.includePreRelease && enchant.preRelease) return false;
    if (options.excludedItemIds?.has(id)) return false;
    return !options.allowedItemIds || options.allowedItemIds.has(id);
  };
  const enchants = descriptor.enchantFields.flatMap((field, index) => {
    const list = derived.enchantLists[index];
    if (!field || !list?.length) return [];
    const ids = [...new Set(list.map((option) => Number(option.value)).filter(allowed))];
    return ids.length ? [{ field, ids }] : [];
  });

  return { cardFields: descriptor.cardFields.slice(0, derived.cardSlots), enchants };
}

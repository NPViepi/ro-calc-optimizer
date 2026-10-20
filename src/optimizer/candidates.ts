/**
 * Fase 3: quais itens podem ir em cada slot e como trocar um item no modelo.
 *
 * A classificação espelha `CalculatorSession.setItemList`/`setItemDropdownList` (os
 * dropdowns do simulador): mesmo tipo/subtipo por slot, mesmo filtro de classe
 * (`slotEquipFilter`/`canUsedByClass`), cabeças de vários slots listadas em cada slot que
 * ocupam, e só itens do LATAM por padrão. Assim o otimizador nunca sugere algo que a
 * tela não deixaria equipar.
 */

import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemSubTypeId } from 'src/app/constants/item-sub-type.enum';
import { ItemTypeEnum, MainItemWithRelations } from 'src/app/constants/item-type.enum';
import { ItemTypeId } from 'src/app/constants/item.const';
import { Calculator } from 'src/app/core/calculator';
import { slotEquipFilter } from 'src/app/core/class-switch';
import { CharacterBase } from 'src/app/jobs';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { canUsedByClass } from 'src/app/utils/can-used-by-class';
import { getHeadGearSlots, resolveHeadSlotOccupancy } from 'src/app/utils/head-gear-slots';

/** Slots de equipamento que o otimizador sabe trocar, na ordem em que são visitados. */
export const EQUIPMENT_SLOT_KEYS = [
  ItemTypeEnum.weapon,
  ItemTypeEnum.ammo,
  ItemTypeEnum.shield,
  ItemTypeEnum.headUpper,
  ItemTypeEnum.headMiddle,
  ItemTypeEnum.headLower,
  ItemTypeEnum.armor,
  ItemTypeEnum.garment,
  ItemTypeEnum.boot,
  ItemTypeEnum.accLeft,
  ItemTypeEnum.accRight,
  ItemTypeEnum.shadowWeapon,
  ItemTypeEnum.shadowArmor,
  ItemTypeEnum.shadowShield,
  ItemTypeEnum.shadowBoot,
  ItemTypeEnum.shadowEarring,
  ItemTypeEnum.shadowPendant,
  ItemTypeEnum.pet,
] as const;

/** Visuais: opcionais, porque no LATAM o bônus costuma vir dos encantamentos de visual. */
export const COSTUME_SLOT_KEYS = [
  ItemTypeEnum.costumeUpper,
  ItemTypeEnum.costumeMiddle,
  ItemTypeEnum.costumeLower,
  ItemTypeEnum.costumeGarment,
] as const;

export type OptimizableSlot = (typeof EQUIPMENT_SLOT_KEYS)[number] | (typeof COSTUME_SLOT_KEYS)[number];

const SUB_TYPE_SLOTS: Partial<Record<number, OptimizableSlot[]>> = {
  [ItemSubTypeId.Shield]: [ItemTypeEnum.shield],
  [ItemSubTypeId.Armor]: [ItemTypeEnum.armor],
  [ItemSubTypeId.Garment]: [ItemTypeEnum.garment],
  [ItemSubTypeId.Boot]: [ItemTypeEnum.boot],
  [ItemSubTypeId.Acc_L]: [ItemTypeEnum.accLeft],
  [ItemSubTypeId.Acc_R]: [ItemTypeEnum.accRight],
  [ItemSubTypeId.Acc]: [ItemTypeEnum.accLeft, ItemTypeEnum.accRight],
  [ItemSubTypeId.Pet]: [ItemTypeEnum.pet],
  [ItemSubTypeId.ShadowWeapon]: [ItemTypeEnum.shadowWeapon],
  [ItemSubTypeId.ShadowArmor]: [ItemTypeEnum.shadowArmor],
  [ItemSubTypeId.ShadowShield]: [ItemTypeEnum.shadowShield],
  [ItemSubTypeId.ShadowBoot]: [ItemTypeEnum.shadowBoot],
  [ItemSubTypeId.ShadowEarring]: [ItemTypeEnum.shadowEarring],
  [ItemSubTypeId.ShadowPendant]: [ItemTypeEnum.shadowPendant],
  [ItemSubTypeId.CostumeGarment]: [ItemTypeEnum.costumeGarment],
};

const HEAD_SUB_TYPES = new Set<number>([
  ItemSubTypeId.Upper, ItemSubTypeId.CostumeUpper, ItemSubTypeId.CostumeMiddle, ItemSubTypeId.CostumeLower,
]);

/** Slots onde um item pode ser equipado (sem olhar classe). */
export function slotsForItem(item: ItemModel): OptimizableSlot[] {
  if (item.itemTypeId === ItemTypeId.WEAPON) return [ItemTypeEnum.weapon];
  if (item.itemTypeId === ItemTypeId.AMMO) return [ItemTypeEnum.ammo];
  if (item.itemTypeId === ItemTypeId.CARD || item.itemTypeId === ItemTypeId.CONSUMABLE) return [];
  if (HEAD_SUB_TYPES.has(item.itemSubTypeId)) return getHeadGearSlots(item) as OptimizableSlot[];
  return SUB_TYPE_SLOTS[item.itemSubTypeId] ?? [];
}

export interface CatalogOptions {
  /** Só itens do LATAM (`presentInLatam`), como os dropdowns. Padrão: true. */
  latamOnly?: boolean;
  /** Incluir itens ainda não lançados no LATAM. Padrão: false. */
  includePreRelease?: boolean;
  /** Ignora itens com nível exigido acima deste. */
  maxRequiredLevel?: number;
  /** Inventário: só estes ids (quando informado). */
  allowedItemIds?: ReadonlySet<number>;
  /** Ids que nunca devem ser sugeridos. */
  excludedItemIds?: ReadonlySet<number>;
}

export type SlotCatalog = Partial<Record<OptimizableSlot, number[]>>;

/** Itens disponíveis por slot para a classe, com os mesmos filtros dos dropdowns. */
export function buildCatalog(items: Record<number, ItemModel>, character: CharacterBase, options: CatalogOptions = {}): SlotCatalog {
  const latamOnly = options.latamOnly ?? true;
  const itemOf = (row: ItemModel) => row;
  const filters = {
    weapon: slotEquipFilter<ItemModel>('weapon', character, itemOf),
    headGear: slotEquipFilter<ItemModel>('headGear', character, itemOf),
    gear: canUsedByClass<ItemModel>(character),
  };
  const catalog: SlotCatalog = {};

  for (const item of Object.values(items)) {
    if (!item || typeof item.id !== 'number') continue;
    if (latamOnly && !item.presentInLatam) continue;
    if (!options.includePreRelease && item.preRelease) continue;
    if (options.maxRequiredLevel != null && (item as any).requiredLevel > options.maxRequiredLevel) continue;
    if (options.allowedItemIds && !options.allowedItemIds.has(item.id)) continue;
    if (options.excludedItemIds?.has(item.id)) continue;

    for (const slot of slotsForItem(item)) {
      const rule = SLOTS_BY_KEY.get(slot)?.classFilter ?? 'gear';
      // Munição e mascote não têm filtro de classe nos dropdowns.
      const allowed = slot === ItemTypeEnum.ammo || rule === 'none'
        || (rule === 'weapon' ? filters.weapon(item) : rule === 'headGear' ? filters.headGear(item) : filters.gear(item));
      if (!allowed) continue;
      (catalog[slot] ??= []).push(item.id);
    }
  }
  return catalog;
}

/** Regras que dependem da arma (escudo, munição), consultadas no próprio motor. */
export interface WeaponRules {
  allowShield: boolean;
  allowAmmo: boolean;
  ammoSubTypeId: number | undefined;
}

export class WeaponRulesProbe {
  private readonly calc = new Calculator();
  private readonly cache = new Map<number, WeaponRules>();

  constructor(items: Record<number, ItemModel>, character: CharacterBase) {
    this.calc.setMasterItems(items).setClass(character);
  }

  rules(weaponId: number | undefined): WeaponRules {
    const key = weaponId ?? 0;
    let rules = this.cache.get(key);
    if (!rules) {
      this.calc.loadItemFromModel(weaponId ? { weapon: weaponId, weaponRefine: 0 } : {});
      rules = {
        allowShield: !!this.calc.isAllowShield(),
        allowAmmo: !!this.calc.isAllowAmmo(),
        ammoSubTypeId: this.calc.getAmmoSubTypeId() || undefined,
      };
      this.cache.set(key, rules);
    }
    return rules;
  }
}

export interface PlacementOptions {
  /** Refino a usar no item novo, por slot. Padrão: o refino atual do slot. */
  refine?: Partial<Record<OptimizableSlot, number>>;
}

const REFINE_CAP: Record<string, number> = { equip: 20, shadow: 10, accessory: 20 };

const cardFieldsOf = (slot: ItemTypeEnum) => (MainItemWithRelations[slot] ?? []).filter((field) => /Card\d?$/.test(field));

/** Esvazia um slot e tudo o que pertence ao item dele (cartas, encantamentos, refino, opções). */
export function clearSlot(model: MainModel, slot: ItemTypeEnum) {
  const target = model as Record<string, any>;
  target[slot] = undefined;
  for (const field of MainItemWithRelations[slot] ?? []) target[field] = undefined;
  target[`${slot}Refine`] = undefined;
  target[`${slot}Grade`] = undefined;
  clearOptions(model, slot);
}

function clearOptions(model: MainModel, slot: ItemTypeEnum) {
  const indexes = SLOTS_BY_KEY.get(slot)?.optionIndexes ?? [];
  if (!indexes.length || !Array.isArray(model.rawOptionTxts)) return;
  model.rawOptionTxts = [...model.rawOptionTxts];
  for (const index of indexes) model.rawOptionTxts[index] = null as any;
}

/**
 * Coloca `itemId` em `slot` e mantém o modelo coerente:
 * - cartas ficam enquanto couberem nos encaixes do item novo; encantamentos, grau e opções
 *   aleatórias saem (pertencem ao item antigo);
 * - refino: o pedido em `options.refine`, senão o atual do slot;
 * - cabeça de vários slots: libera/limpa os slots que passa a ocupar ou que deixavam o
 *   item novo sem lugar (`resolveHeadSlotOccupancy`, mesma regra da tela);
 * - arma: tira o escudo se a arma nova não permitir e a munição se for incompatível.
 *   A escolha da munição nova fica com a busca, que precisa avaliar.
 */
export function placeItem(
  model: MainModel,
  slot: OptimizableSlot,
  itemId: number | undefined,
  items: Record<number, ItemModel>,
  probe: WeaponRulesProbe,
  options: PlacementOptions = {},
): MainModel {
  const next = { ...model } as MainModel;
  const target = next as Record<string, any>;
  if (target[slot] === itemId) return next;

  const item = itemId ? items[itemId] : undefined;
  const previousRefine = target[`${slot}Refine`];
  const cards = cardFieldsOf(slot).map((field) => target[field]);
  clearSlot(next, slot);
  if (!item) {
    if (slot === ItemTypeEnum.weapon) applyWeaponRules(next, undefined, items, probe);
    return next;
  }

  target[slot] = itemId;
  cardFieldsOf(slot).forEach((field, index) => {
    if (index < (item.slots ?? 0) && cards[index]) target[field] = cards[index];
  });

  const rule = SLOTS_BY_KEY.get(slot)?.refine ?? 'none';
  if (rule !== 'none') {
    const wanted = options.refine?.[slot] ?? previousRefine ?? 0;
    target[`${slot}Refine`] = Math.max(0, Math.min(REFINE_CAP[rule] ?? 20, Number(wanted) || 0));
  }

  if (getHeadGearSlots(item).length) {
    const family = getHeadGearSlots(item)[0].startsWith('costume')
      ? [ItemTypeEnum.costumeUpper, ItemTypeEnum.costumeMiddle, ItemTypeEnum.costumeLower]
      : [ItemTypeEnum.headUpper, ItemTypeEnum.headMiddle, ItemTypeEnum.headLower];
    const equipped: Partial<Record<ItemTypeEnum, ItemModel>> = {};
    for (const head of family) if (target[head]) equipped[head] = items[target[head]];
    for (const loser of resolveHeadSlotOccupancy(equipped, new Set([slot])).toClear) clearSlot(next, loser);
  }

  if (slot === ItemTypeEnum.weapon) applyWeaponRules(next, itemId, items, probe);

  return next;
}

/** Tira o escudo que a arma não permite e a munição que ela (ou a classe) não usa. */
function applyWeaponRules(model: MainModel, weaponId: number | undefined, items: Record<number, ItemModel>, probe: WeaponRulesProbe) {
  const target = model as Record<string, any>;
  const rules = probe.rules(weaponId);
  if (!rules.allowShield && target[ItemTypeEnum.shield]) clearSlot(model, ItemTypeEnum.shield);
  const ammo = target[ItemTypeEnum.ammo] ? items[target[ItemTypeEnum.ammo]] : undefined;
  if (ammo && (!rules.allowAmmo || ammo.itemSubTypeId !== rules.ammoSubTypeId)) clearSlot(model, ItemTypeEnum.ammo);
}

/** Munições compatíveis com a arma do modelo (vazio se a arma não usa munição). */
export function compatibleAmmo(model: MainModel, catalog: SlotCatalog, items: Record<number, ItemModel>, probe: WeaponRulesProbe): number[] {
  const rules = probe.rules(model.weapon);
  if (!rules.allowAmmo) return [];
  return (catalog[ItemTypeEnum.ammo] ?? []).filter((id) => items[id]?.itemSubTypeId === rules.ammoSubTypeId);
}

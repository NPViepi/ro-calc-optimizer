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
import { canGradeItem } from 'src/app/utils/can-grade';
import { canUsedByClass } from 'src/app/utils/can-used-by-class';
import { getHeadGearSlots, resolveHeadSlotOccupancy } from 'src/app/utils/head-gear-slots';
import { GODLY_ITEM_IDS, GODLY_ITEM_NAMES } from './data/godly-items';

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

/** Visuais. Poucos têm bônus próprio (o catálogo só traz esses); o forte são os encantamentos abaixo. */
export const COSTUME_SLOT_KEYS = [
  ItemTypeEnum.costumeUpper,
  ItemTypeEnum.costumeMiddle,
  ItemTypeEnum.costumeLower,
  ItemTypeEnum.costumeGarment,
] as const;

/**
 * Encantamentos de visual (ex.: "Fixa 1", −0,5 s de conjuração fixa na capa). No simulador são
 * slots próprios do modelo (`subItemSlots` dos cards de visual), carregados independentemente
 * do visual. No jogo, precisam de um visual naquele lugar (ver `COSTUME_ENCHANT_HOST`).
 */
export const COSTUME_ENCHANT_SLOT_KEYS = [
  ItemTypeEnum.costumeEnchantUpper,
  ItemTypeEnum.costumeEnchantMiddle,
  ItemTypeEnum.costumeEnchantLower,
  ItemTypeEnum.costumeEnchantGarment,
  ItemTypeEnum.costumeEnchantGarment2,
  ItemTypeEnum.costumeEnchantGarment4,
] as const;

/** Visual que recebe cada encantamento de visual. */
export const COSTUME_ENCHANT_HOST: Record<(typeof COSTUME_ENCHANT_SLOT_KEYS)[number], (typeof COSTUME_SLOT_KEYS)[number]> = {
  [ItemTypeEnum.costumeEnchantUpper]: ItemTypeEnum.costumeUpper,
  [ItemTypeEnum.costumeEnchantMiddle]: ItemTypeEnum.costumeMiddle,
  [ItemTypeEnum.costumeEnchantLower]: ItemTypeEnum.costumeLower,
  [ItemTypeEnum.costumeEnchantGarment]: ItemTypeEnum.costumeGarment,
  [ItemTypeEnum.costumeEnchantGarment2]: ItemTypeEnum.costumeGarment,
  [ItemTypeEnum.costumeEnchantGarment4]: ItemTypeEnum.costumeGarment,
} as any;

export type OptimizableSlot =
  | (typeof EQUIPMENT_SLOT_KEYS)[number] | (typeof COSTUME_SLOT_KEYS)[number] | (typeof COSTUME_ENCHANT_SLOT_KEYS)[number];

/** Todos os slots que o otimizador conhece. */
export const ALL_OPTIMIZABLE_SLOTS: readonly OptimizableSlot[] = [...EQUIPMENT_SLOT_KEYS, ...COSTUME_SLOT_KEYS, ...COSTUME_ENCHANT_SLOT_KEYS];
const COSTUME_SLOTS = new Set<string>(COSTUME_SLOT_KEYS);
const NO_CLASS_FILTER = new Set<string>([ItemTypeEnum.ammo, ...COSTUME_ENCHANT_SLOT_KEYS]);

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

/** Encantamentos de visual: tipo "carta", subtipos 71–76 (como as listas `costumeEnh*List` da sessão). */
const COSTUME_ENCHANT_SUB_TYPES: Partial<Record<number, OptimizableSlot>> = {
  [ItemSubTypeId.CostumeEnhUpper]: ItemTypeEnum.costumeEnchantUpper,
  [ItemSubTypeId.CostumeEnhMiddle]: ItemTypeEnum.costumeEnchantMiddle,
  [ItemSubTypeId.CostumeEnhLower]: ItemTypeEnum.costumeEnchantLower,
  [ItemSubTypeId.CostumeEnhGarment]: ItemTypeEnum.costumeEnchantGarment,
  [ItemSubTypeId.CostumeEnhGarment2]: ItemTypeEnum.costumeEnchantGarment2,
  [ItemSubTypeId.CostumeEnhGarment4]: ItemTypeEnum.costumeEnchantGarment4,
};

const HEAD_SUB_TYPES = new Set<number>([
  ItemSubTypeId.Upper, ItemSubTypeId.CostumeUpper, ItemSubTypeId.CostumeMiddle, ItemSubTypeId.CostumeLower,
]);

/** Slots onde um item pode ser equipado (sem olhar classe). */
export function slotsForItem(item: ItemModel): OptimizableSlot[] {
  if (item.itemTypeId === ItemTypeId.WEAPON) return [ItemTypeEnum.weapon];
  if (item.itemTypeId === ItemTypeId.AMMO) return [ItemTypeEnum.ammo];
  const costumeEnchant = item.itemTypeId === ItemTypeId.CARD ? COSTUME_ENCHANT_SUB_TYPES[item.itemSubTypeId] : undefined;
  if (costumeEnchant) return [costumeEnchant];
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
  /** Permitir itens divinos (Megingjard, Brisingamen, Sleipnir, Mjolnir…). Padrão: false. */
  allowGodlyItems?: boolean;
}

const GODLY_IDS = new Set(GODLY_ITEM_IDS);
const GODLY_NAME = new RegExp(`^(${GODLY_ITEM_NAMES.join('|')})\\b`, 'i');
/** Item divino, pelo id ou pelo nome (em inglês ou pt-BR, que para esses itens é o mesmo). */
export const isGodlyItem = (item: Pick<ItemModel, 'id' | 'name' | 'enName'>) =>
  GODLY_IDS.has(item.id) || GODLY_NAME.test(item.enName ?? '') || GODLY_NAME.test(item.name ?? '');

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
    if (!options.allowGodlyItems && isGodlyItem(item)) continue;

    for (const slot of slotsForItem(item)) {
      // Visual sem bônus nenhum não muda o cálculo: fica de fora (são ~1.270 de ~1.290).
      if (COSTUME_SLOTS.has(slot) && !Object.keys(item.script ?? {}).length) continue;
      const rule = SLOTS_BY_KEY.get(slot)?.classFilter ?? 'gear';
      // Munição, mascote e encantamentos de visual não têm filtro de classe nos dropdowns.
      const allowed = NO_CLASS_FILTER.has(slot) || rule === 'none'
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

  /**
   * A arma serve para a skill? Usa o próprio `verifyItemFn` da skill (o mesmo que o motor chama
   * antes de calcular: arma errada = dano zero). Skill sem `verifyItemFn` aceita qualquer arma.
   */
  accepts(weaponId: number, verify: ((input: any) => string) | undefined, model: MainModel): boolean {
    if (typeof verify !== 'function') return true;
    let byWeapon = this.acceptCache.get(verify);
    if (!byWeapon) this.acceptCache.set(verify, (byWeapon = new Map()));
    const cached = byWeapon.get(weaponId);
    if (cached !== undefined) return cached;
    this.calc.loadItemFromModel({ weapon: weaponId, weaponRefine: 0 });
    let ok = true;
    try {
      ok = !verify({ weapon: (this.calc as any).weaponData, model, status: {}, skillLevel: 1 });
    } catch {
      ok = true; // a regra depende de algo além da arma: deixa o motor decidir
    }
    byWeapon.set(weaponId, ok);
    return ok;
  }

  private readonly acceptCache = new WeakMap<object, Map<number, boolean>>();

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

export type Grade = '' | 'D' | 'C' | 'B' | 'A';

export interface PlacementOptions {
  /** Refino do item novo, por slot (tem prioridade sobre `defaultRefine`). */
  refine?: Partial<Record<OptimizableSlot, number>>;
  /**
   * Refino dos itens novos por tipo de slot: `equip` (equipamentos), `shadow` (sombrios) e
   * `accessory` (só acessórios refináveis). Ausente = o refino que o slot já tinha (0 se vazio).
   */
  defaultRefine?: Partial<Record<'equip' | 'shadow' | 'accessory', number>>;
  /** Grau dos itens novos que aceitam grau. Ausente = o grau que o slot já tinha. `''` = sem grau. */
  defaultGrade?: Grade;
}

/** Os mesmos tetos das listas da tela (0–18 equipamentos/acessórios, 0–10 sombrios). */
const REFINE_CAP: Record<string, number> = { equip: 18, shadow: 10, accessory: 18 };

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
  const previousGrade = target[`${slot}Grade`];
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

  applyRefineGrade(next, slot, item, previousRefine, previousGrade, options);

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

const GRADE_ORDER: Grade[] = ['', 'D', 'C', 'B', 'A'];

/** Refino e grau para o item do slot, pelas regras da tela (tetos, acessório refinável, `canGrade`). */
function applyRefineGrade(
  model: MainModel, slot: OptimizableSlot, item: ItemModel, previousRefine: unknown, previousGrade: unknown, options: PlacementOptions,
) {
  const target = model as Record<string, any>;
  const descriptor = SLOTS_BY_KEY.get(slot);
  const rule = descriptor?.refine ?? 'none';
  if (rule !== 'none') {
    // Acessório só refina se o item for refinável (mesma regra de `deriveSlot`).
    const refinable = rule !== 'accessory' || !!item.isRefinable;
    const wanted = refinable ? options.refine?.[slot] ?? options.defaultRefine?.[rule] ?? previousRefine ?? 0 : 0;
    target[`${slot}Refine`] = Math.max(0, Math.min(REFINE_CAP[rule] ?? 18, Number(wanted) || 0));
  }
  // Grau: só em slot com grau e item que aceita (Grau D/C/B/A — `canGradeItem`).
  if (descriptor?.grade && (item.canGrade || canGradeItem(item))) {
    const grade = options.defaultGrade ?? previousGrade;
    if (grade) target[`${slot}Grade`] = grade;
  }
}

/**
 * Leva os itens que já estão na build ao refino e grau pedidos (`defaultRefine`/`defaultGrade`),
 * sem nunca baixar o que o item já tem. Usado quando o usuário quer comparar tudo no mesmo
 * patamar: senão o item atual +7 perde para um item novo colocado a +15 só pelo refino.
 */
export function raiseToLimits(model: MainModel, items: Record<number, ItemModel>, slots: readonly OptimizableSlot[], options: PlacementOptions): MainModel {
  const next = { ...model } as MainModel;
  const target = next as Record<string, any>;
  for (const slot of slots) {
    const item = target[slot] ? items[target[slot]] : undefined;
    if (!item) continue;
    const refine = Number(target[`${slot}Refine`]) || 0;
    const grade = (target[`${slot}Grade`] ?? '') as Grade;
    const rule = SLOTS_BY_KEY.get(slot)?.refine ?? 'none';
    const desired = rule === 'none' ? refine : Math.max(refine, Number(options.defaultRefine?.[rule]) || 0);
    const desiredGrade = GRADE_ORDER.indexOf(options.defaultGrade ?? '') > GRADE_ORDER.indexOf(grade) ? options.defaultGrade : grade;
    applyRefineGrade(next, slot, item, desired, desiredGrade, { refine: { [slot]: desired }, defaultGrade: desiredGrade || undefined });
  }
  return next;
}

/** Munições compatíveis com a arma do modelo (vazio se a arma não usa munição). */
export function compatibleAmmo(model: MainModel, catalog: SlotCatalog, items: Record<number, ItemModel>, probe: WeaponRulesProbe): number[] {
  const rules = probe.rules(model.weapon);
  if (!rules.allowAmmo) return [];
  return (catalog[ItemTypeEnum.ammo] ?? []).filter((id) => items[id]?.itemSubTypeId === rules.ammoSubTypeId);
}

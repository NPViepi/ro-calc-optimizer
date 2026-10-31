/**
 * Itens que não valem a busca: tirá-los do catálogo encurta a triagem e a busca exata sem
 * mudar o resultado na prática. Fixo, sem opção no painel. São três regras:
 *
 * 1. **Por nome** — aluguel, Apoio/Paraíso (sombrios e "[Apoio]" de ilusão), Éden, novato
 *    (Iniciante/Aprendiz/Novato) e equipamentos de WoE TE. O nome em inglês (`enName`) também é
 *    olhado, porque a base às vezes só traz ele ("Booster Shadow Armor", "Paradise…").
 * 2. **Sem efeito** — não é arma nem munição (ATK base delas conta), não tem bônus próprio,
 *    nem slot de carta, nem encantamento, nem grade, e nenhum conjunto o pede como peça.
 * 3. **Cópia com menos slots** — mesmo item (nome pt-BR sem o "[n]", bônus, ATK/DEF, nível,
 *    classes, encantamentos) que outra versão do catálogo com mais slots. Calculado sobre a lista
 *    que já passou pelos outros filtros (inventário, nível), então a versão menor só sai se a
 *    maior estiver disponível de verdade. Compara pelo nome pt-BR porque o inglês às vezes difere
 *    entre as versões ("Modified Str Boot" / "Modified Str Boots [1]"). A versão menor fica se
 *    algum conjunto a aceita e não aceita a maior.
 */

import { getEnchants, getMalangdoEnchants, getMonarchTombEnchants, getMoraEnchants, getVerusEnchants } from 'src/app/constants/enchant_item';
import { ItemTypeId } from 'src/app/constants/item.const';
import { isCustomItem } from 'src/app/core/custom-items';
import { itemBonusScriptEntries, ItemModel } from 'src/app/models/item.model';
import { comboName } from './sets';

const IRRELEVANT_NAME = /aluguel|\bapoio\b|para[ií]so|\bdo [ÉE]den\b|iniciante|aprendiz|novato|\bTE\b/i;
const IRRELEVANT_EN_NAME = /^\[rental]|\bbooster\b|\bparadise\b/i;

/** Regra 1: o nome já diz que não interessa. */
export const isIrrelevantByName = (item: Pick<ItemModel, 'name' | 'enName'>) =>
  IRRELEVANT_NAME.test(item.name ?? '') || IRRELEVANT_EN_NAME.test(item.enName ?? '');

/** As posições de encantamento do item, pela mesma cadeia de `deriveSlot` (equipment-slot-derivation.ts). */
function enchantPositions(item: ItemModel): unknown[] {
  const { id, aegisName, name, slots } = item;
  const enchants = getMonarchTombEnchants(id) ?? getVerusEnchants(id) ?? getEnchants(aegisName) ?? getEnchants(name)
    ?? getMoraEnchants(id) ?? getMalangdoEnchants(id, slots);
  return Array.isArray(enchants) ? enchants : [];
}

const hasEnchants = (item: ItemModel) => enchantPositions(item).some((position) => Array.isArray(position) && position.length > 0);

const EQUIP_NAMES = /EQUIP\[(.+?)]/g;
const EQUIP_IDS = /EQUIP_ID\[([\d|&]+)]/g;

/**
 * Peças pedidas por algum conjunto (`EQUIP[...]`/`EQUIP_ID[...]`): para cada nome de combo e cada
 * id, em quais grupos de alternativas (`A||B`) ele aparece. Os grupos dizem se uma versão pode
 * substituir a outra num conjunto.
 */
export interface SetPartners { names: ReadonlyMap<string, ReadonlySet<number>>; ids: ReadonlyMap<number, ReadonlySet<number>> }

export function collectSetPartners(items: Record<number, ItemModel>): SetPartners {
  const names = new Map<string, Set<number>>();
  const ids = new Map<number, Set<number>>();
  let group = 0;
  const add = <K>(map: Map<K, Set<number>>, key: K) => {
    let groups = map.get(key);
    if (!groups) map.set(key, (groups = new Set()));
    groups.add(group);
  };
  for (const item of Object.values(items)) {
    if (!item?.script) continue;
    for (const [, lines] of itemBonusScriptEntries(item.script)) {
      for (const line of lines) {
        for (const [, body] of line.matchAll(EQUIP_NAMES)) {
          for (const alternatives of body.split('&&')) { group++; for (const name of alternatives.split('||')) add(names, name.trim()); }
        }
        for (const [, body] of line.matchAll(EQUIP_IDS)) {
          for (const alternatives of body.split('&&')) { group++; for (const id of alternatives.split('||')) add(ids, Number(id)); }
        }
      }
    }
  }
  return { names, ids };
}

const NO_GROUPS: ReadonlySet<number> = new Set();
/** Todos os grupos de conjunto em que o item entra (por nome ou por id). */
function setGroupsOf(item: ItemModel, partners: SetPartners): ReadonlySet<number> {
  const byName = partners.names.get(comboName(item));
  const byId = partners.ids.get(item.id);
  if (!byName) return byId ?? NO_GROUPS;
  if (!byId) return byName;
  return new Set([...byName, ...byId]);
}

/** Regra 2: equipá-lo não muda nada no cálculo de dano. */
export function isInertItem(item: ItemModel, partners: SetPartners): boolean {
  if (isCustomItem(item)) return false;
  if (item.itemTypeId === ItemTypeId.WEAPON || item.itemTypeId === ItemTypeId.AMMO) return false;
  if (Object.keys(item.script ?? {}).length || (item.slots ?? 0) > 0 || item.canGrade) return false;
  if (setGroupsOf(item, partners).size) return false;
  return !hasEnchants(item);
}

/** O que precisa ser igual para duas versões contarem como o mesmo item (tudo menos id, slots e nomes internos). */
function variantKey(item: ItemModel): string {
  const any = item as any;
  return JSON.stringify([
    (item.name ?? '').replace(/\s*\[\d]$/, '').trim(), item.itemTypeId, item.itemSubTypeId, any.itemLevel, any.attack, any.defense, any.propertyAtk,
    any.requiredLevel, any.location, any.locations, any.usableClass, any.unusableClass, any.armorElement,
    any.isRefinable, item.canGrade, item.script ?? {}, enchantPositions(item),
  ]);
}

/**
 * Regra 3: tira uma versão quando a mesma lista tem outra com mais slots que entra em todos os
 * conjuntos em que ela entra (ex.: "Modified Str Boots [1]" cobre "Modified Str Boot").
 */
export function dropFewerSlotVariants(ids: number[], items: Record<number, ItemModel>, partners: SetPartners): number[] {
  const byKey = new Map<string, number[]>();
  for (const id of ids) {
    if (isCustomItem(items[id])) continue;
    const key = variantKey(items[id]);
    byKey.set(key, [...(byKey.get(key) ?? []), id]);
  }
  const dropped = new Set<number>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const id of group) {
      const slots = items[id].slots ?? 0;
      const sets = setGroupsOf(items[id], partners);
      const covered = group.some((other) => (items[other].slots ?? 0) > slots
        && [...sets].every((set) => setGroupsOf(items[other], partners).has(set)));
      if (covered) dropped.add(id);
    }
  }
  return dropped.size ? ids.filter((id) => !dropped.has(id)) : ids;
}

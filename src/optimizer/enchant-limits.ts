/**
 * Aplica os limites de encantamento (`data/enchant-limits.ts`) e aponta repetições em itens
 * cujo limite ainda não foi cadastrado.
 */

import { MainItemWithRelations } from 'src/app/constants/item-type.enum';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { OptimizableSlot } from './candidates';
import { ENCHANT_LIMIT_RULES, EnchantLimitRule } from './data/enchant-limits';

const RULES_BY_ITEM = new Map<number, EnchantLimitRule[]>();
for (const rule of ENCHANT_LIMIT_RULES) {
  for (const id of rule.items) RULES_BY_ITEM.set(id, [...(RULES_BY_ITEM.get(id) ?? []), rule]);
}

export const enchantRulesFor = (itemId: number | undefined): EnchantLimitRule[] => (itemId ? RULES_BY_ITEM.get(itemId) ?? [] : []);

const enchantFields = (slot: OptimizableSlot) => (MainItemWithRelations[slot] ?? []).filter((field) => /Enchant\d$/.test(field));

/** Encantamentos atuais do item no slot, por campo. */
export function enchantsOf(model: MainModel, slot: OptimizableSlot): Map<string, number> {
  const target = model as Record<string, any>;
  const result = new Map<string, number>();
  for (const field of enchantFields(slot)) if (target[field]) result.set(field, target[field]);
  return result;
}

/** Quebra das regras para um conjunto de encantamentos do item (vazio = válido). */
export function limitViolations(itemId: number | undefined, enchantIds: number[]): string[] {
  const problems: string[] = [];
  const count = new Map<number, number>();
  for (const id of enchantIds) count.set(id, (count.get(id) ?? 0) + 1);
  for (const rule of enchantRulesFor(itemId)) {
    for (const [id, copies] of count) {
      const max = rule.perEnchant[id];
      if (max != null && copies > max) problems.push(`${rule.label}: encantamento ${id} ×${copies} (máximo ×${max})`);
    }
    for (const group of rule.groups ?? []) {
      const total = group.enchants.reduce((sum, id) => sum + (count.get(id) ?? 0), 0);
      if (total > group.max) problems.push(`${rule.label}: ${group.label} ×${total} (máximo ×${group.max})`);
    }
  }
  return problems;
}

/** Pode colocar `enchantId` no campo `field` do item do slot sem quebrar um limite? */
export function canPlaceEnchant(model: MainModel, slot: OptimizableSlot, field: string, enchantId: number): boolean {
  const itemId = (model as Record<string, any>)[slot] as number | undefined;
  if (!enchantRulesFor(itemId).length) return true;
  const others = [...enchantsOf(model, slot)].filter(([key]) => key !== field).map(([, id]) => id);
  return limitViolations(itemId, [...others, enchantId]).length === 0;
}

export interface EnchantWarning {
  slot: OptimizableSlot;
  itemId: number;
  /** `violation`: quebra uma regra cadastrada. `unverified`: repetição num item sem regra cadastrada. */
  kind: 'violation' | 'unverified';
  message: string;
}

/**
 * Problemas de encantamento na build: violações das regras cadastradas e repetições em itens
 * sem limite conhecido (podem ser válidas, mas vale conferir na bROWiki).
 */
export function enchantWarnings(model: MainModel, items: Record<number, ItemModel>, slots: readonly OptimizableSlot[]): EnchantWarning[] {
  const warnings: EnchantWarning[] = [];
  for (const slot of slots) {
    const itemId = (model as Record<string, any>)[slot] as number | undefined;
    if (!itemId) continue;
    const enchants = [...enchantsOf(model, slot).values()];
    if (enchantRulesFor(itemId).length) {
      for (const message of limitViolations(itemId, enchants)) warnings.push({ slot, itemId, kind: 'violation', message });
      continue;
    }
    const repeated = [...new Set(enchants.filter((id, index) => enchants.indexOf(id) !== index))];
    for (const id of repeated) {
      const copies = enchants.filter((value) => value === id).length;
      warnings.push({
        slot, itemId, kind: 'unverified',
        message: `${items[itemId]?.name ?? itemId}: ${items[id]?.name ?? id} ×${copies} — limite deste item não cadastrado, confira na bROWiki`,
      });
    }
  }
  return warnings;
}

/**
 * Fase 4: conjuntos (bônus de combinação).
 *
 * Um bônus de conjunto só aparece com todas as peças equipadas, então trocar uma peça de
 * cada vez (fase 3) nunca o encontra: cada peça sozinha parece fraca. Aqui cada condição
 * `EQUIP[A&&B||C]` / `EQUIP_ID[1&&2||3]` dos scripts vira um **movimento de conjunto**: o item
 * dono do script mais uma peça de cada grupo, equipados de uma vez.
 *
 * A gramática é a do motor (`Calculator.validateCondition`): `&&` = todas, `||` = qualquer uma,
 * e nomes casam pelo nome em inglês sem o sufixo de encaixes (`matchName`).
 * Condições que exigem cartas ficam de fora: as cartas são escolhidas por slot.
 */

import { itemBonusScriptEntries, ItemModel } from 'src/app/models/item.model';
import { OptimizableSlot, SlotCatalog } from './candidates';

export interface SetPiece { slot: OptimizableSlot; id: number }

export interface SetMove {
  /** Item cujo script traz o bônus. */
  ownerId: number;
  pieces: SetPiece[];
}

/** Mesmo critério de `Calculator.matchName`: nome em inglês, sem o "[2]" de encaixes. */
export const comboName = (item: Pick<ItemModel, 'name' | 'enName'>) => (item.enName ?? item.name).replace(/\[\d]$/, '').trim();

const EQUIP_NAMES = /EQUIP\[(.+?)]/g;
const EQUIP_IDS = /EQUIP_ID\[([\d|&]+)]/g;

/** Grupos de uma condição: cada grupo é uma lista de alternativas (`||`). */
function conditionGroups(line: string): { names: string[][]; ids: number[][] }[] {
  const conditions: { names: string[][]; ids: number[][] }[] = [];
  for (const [, body] of line.matchAll(EQUIP_NAMES)) {
    conditions.push({ names: body.split('&&').filter(Boolean).map((group) => group.split('||')), ids: [] });
  }
  for (const [, body] of line.matchAll(EQUIP_IDS)) {
    conditions.push({ names: [], ids: body.split('&&').filter(Boolean).map((group) => group.split('||').map(Number)) });
  }
  return conditions;
}

/**
 * Todos os movimentos de conjunto possíveis com os itens do catálogo.
 * Cada peça vai para um slot diferente; conjuntos que não cabem (dois itens no mesmo slot
 * único, peça fora do catálogo) são descartados.
 */
export function findSetMoves(items: Record<number, ItemModel>, catalog: SlotCatalog, allowedSlots?: ReadonlySet<OptimizableSlot>): SetMove[] {
  const slotsOf = new Map<number, OptimizableSlot[]>();
  for (const [slot, ids] of Object.entries(catalog) as [OptimizableSlot, number[]][]) {
    if (allowedSlots && !allowedSlots.has(slot)) continue;
    for (const id of ids) {
      const list = slotsOf.get(id) ?? [];
      list.push(slot);
      slotsOf.set(id, list);
    }
  }
  const byName = new Map<string, number[]>();
  for (const id of slotsOf.keys()) {
    const name = comboName(items[id]);
    byName.set(name, [...(byName.get(name) ?? []), id]);
  }

  const moves = new Map<string, SetMove>();
  for (const ownerId of slotsOf.keys()) {
    const owner = items[ownerId];
    const lines = new Set(itemBonusScriptEntries(owner.script).flatMap(([, values]) => values));
    for (const line of lines) {
      for (const condition of conditionGroups(line)) {
        const groups: number[][] = [
          ...condition.names.map((alternatives) => alternatives.flatMap((name) => byName.get(name.trim()) ?? [])),
          ...condition.ids.map((alternatives) => alternatives.filter((id) => slotsOf.has(id))),
        ];
        const move = assemble(ownerId, groups, slotsOf);
        if (!move) continue;
        const key = move.pieces.map((piece) => `${piece.slot}:${piece.id}`).sort().join('|');
        if (!moves.has(key)) moves.set(key, move);
      }
    }
  }
  return [...moves.values()];
}

/** Escolhe um slot livre para o dono e uma peça (com slot livre) para cada grupo. */
function assemble(ownerId: number, groups: number[][], slotsOf: Map<number, OptimizableSlot[]>): SetMove | null {
  const used = new Set<OptimizableSlot>();
  const pieces: SetPiece[] = [];
  const take = (id: number) => {
    const slot = slotsOf.get(id)?.find((candidate) => !used.has(candidate));
    if (!slot) return false;
    used.add(slot);
    pieces.push({ slot, id });
    return true;
  };
  if (!take(ownerId)) return null;
  for (const alternatives of groups) {
    // O próprio dono já cumpre o grupo (ex.: EQUIP[Elven Bow] no script do arco).
    if (alternatives.includes(ownerId)) continue;
    if (!alternatives.length || !alternatives.some(take)) return null;
  }
  return pieces.length > 1 ? { ownerId, pieces } : null;
}

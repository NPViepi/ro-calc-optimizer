/**
 * Problema artificial pequeno para testar o motor contra força bruta (plano, §10.1).
 *
 * Itens com ATQ/crítico, refino, conjuntos com limiar, sinergia entre slots, grupos exclusivos
 * e slots obrigatórios. O dano é (ATQ total) × (1 + crítico/100): não linear, e um item fraco
 * sozinho pode ser necessário para ativar um conjunto.
 */

import { Decision, SearchProblem } from '../engine';

export interface ToyItem {
  id: string;
  atk: number;
  crit?: number;
  /** ATQ por nível de refino. */
  refineAtk?: number;
  /** Conjuntos dos quais o item faz parte. */
  tags?: string[];
  /** No máximo um item por grupo exclusivo na build. */
  exclusive?: string;
  /** Sinergia: +ATQ se algum outro item da build tiver a tag. */
  synergy?: { tag: string; atk: number };
}

export interface ToySlot { name: string; items: ToyItem[]; maxRefine?: number; mandatory?: boolean }
export interface ToySet { tag: string; threshold: number; atk: number; crit?: number }
export interface ToyCatalog { slots: ToySlot[]; sets: ToySet[] }

export type ToyChoice = { item: ToyItem; refine: number } | null;
export interface ToyState { picks: ToyChoice[] }

export const EPS = 1e-9;
export const compareNumbers = (a: number, b: number) => (a > b + EPS ? 1 : a < b - EPS ? -1 : 0);

export function toyScore(catalog: ToyCatalog, picks: ToyChoice[]): number {
  const chosen = picks.filter((pick): pick is NonNullable<ToyChoice> => !!pick);
  let atk = 0;
  let crit = 0;
  const tagCount = new Map<string, number>();
  for (const { item } of chosen) for (const tag of item.tags ?? []) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  for (const { item, refine } of chosen) {
    atk += item.atk + (item.refineAtk ?? 0) * refine;
    crit += item.crit ?? 0;
    if (item.synergy && chosen.some((other) => other.item !== item && other.item.tags?.includes(item.synergy!.tag))) atk += item.synergy.atk;
  }
  for (const set of catalog.sets) {
    if ((tagCount.get(set.tag) ?? 0) >= set.threshold) { atk += set.atk; crit += set.crit ?? 0; }
  }
  return atk * (1 + crit / 100);
}

/** Validade de uma build completa — escrita de forma independente das podas do problema. */
export function toyValid(catalog: ToyCatalog, picks: ToyChoice[]): boolean {
  const groups = new Set<string>();
  for (const [index, pick] of picks.entries()) {
    if (!pick) { if (catalog.slots[index].mandatory) return false; continue; }
    if (pick.item.exclusive) {
      if (groups.has(pick.item.exclusive)) return false;
      groups.add(pick.item.exclusive);
    }
  }
  return true;
}

export function slotChoices(slot: ToySlot): ToyChoice[] {
  const choices: ToyChoice[] = [null];
  for (const item of slot.items) for (let refine = 0; refine <= (slot.maxRefine ?? 0); refine++) choices.push({ item, refine });
  return choices;
}

export const toyKey = (picks: ToyChoice[]) => picks.map((pick) => (pick ? `${pick.item.id}+${pick.refine}` : '-')).join('|');

/** Força bruta: produto cartesiano completo, depois filtra válidas. */
export function bruteForce(catalog: ToyCatalog) {
  const all: { picks: ToyChoice[]; score: number }[] = [];
  const walk = (index: number, picks: ToyChoice[]) => {
    if (index === catalog.slots.length) {
      if (toyValid(catalog, picks)) all.push({ picks: [...picks], score: toyScore(catalog, picks) });
      return;
    }
    for (const choice of slotChoices(catalog.slots[index])) walk(index + 1, [...picks, choice]);
  };
  walk(0, []);
  const bestScore = all.reduce((best, entry) => Math.max(best, entry.score), -Infinity);
  const optimal = all.filter((entry) => compareNumbers(entry.score, bestScore) === 0);
  return { valid: all, bestScore, optimalKeys: new Set(optimal.map((entry) => toyKey(entry.picks))) };
}

export interface ToyProblemOptions {
  withBound?: boolean;
  /** Ordem heurística: candidatos de maior ATQ primeiro (não muda o conjunto). */
  heuristicOrder?: boolean;
}

export function toyProblem(catalog: ToyCatalog, options: ToyProblemOptions = {}): SearchProblem<ToyState, ToyChoice, number> {
  const choicesBySlot = catalog.slots.map((slot) => {
    const choices = slotChoices(slot);
    if (options.heuristicOrder) {
      choices.sort((a, b) => (b ? b.item.atk + (b.item.refineAtk ?? 0) * b.refine : -1) - (a ? a.item.atk + (a.item.refineAtk ?? 0) * a.refine : -1));
    }
    return choices;
  });
  const maxValue = (slot: ToySlot, key: 'atk' | 'crit') => Math.max(0, ...slot.items.map((item) => key === 'atk'
    ? item.atk + (item.refineAtk ?? 0) * (slot.maxRefine ?? 0) + (item.synergy?.atk ?? 0)
    : item.crit ?? 0));

  return {
    root: () => ({ picks: [] }),
    isComplete: (state) => state.picks.length === catalog.slots.length,
    nextDecision: (state): Decision<ToyChoice> => ({ key: catalog.slots[state.picks.length].name, choices: choicesBySlot[state.picks.length] }),
    apply: (state, _decision, choice) => {
      const index = state.picks.length;
      // Podas de inviabilidade: só violações irreversíveis.
      if (!choice && catalog.slots[index].mandatory) return { pruned: 'mandatory' };
      if (choice?.item.exclusive && state.picks.some((pick) => pick?.item.exclusive === choice.item.exclusive)) return { pruned: 'exclusive' };
      return { state: { picks: [...state.picks, choice] } };
    },
    evaluate: (state) => toyScore(catalog, state.picks),
    compare: compareNumbers,
    keyOf: (state) => toyKey(state.picks),
    upperBound: options.withBound ? {
      name: 'toy-monotone',
      // Todos os termos são ≥ 0 e o dano cresce com ATQ e com crítico. O limite soma ao parcial:
      // a sinergia de cada item escolhido (ativa ou não), o máximo (ATQ+refino+sinergia) e o
      // crítico máximo de cada slot restante e o bônus de todos os conjuntos. Cada termo ≥ o real.
      proof: 'termos não negativos; dano monótono em ATQ e crítico; cada parcela superestima a real',
      bound: (state) => {
        let atk = 0;
        let crit = 0;
        for (const pick of state.picks) {
          if (!pick) continue;
          atk += pick.item.atk + (pick.item.refineAtk ?? 0) * pick.refine + (pick.item.synergy?.atk ?? 0);
          crit += pick.item.crit ?? 0;
        }
        for (const slot of catalog.slots.slice(state.picks.length)) { atk += maxValue(slot, 'atk'); crit += maxValue(slot, 'crit'); }
        for (const set of catalog.sets) { atk += set.atk; crit += set.crit ?? 0; }
        return atk * (1 + crit / 100);
      },
    } : undefined,
  };
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catálogo aleatório pequeno (cabe na força bruta). */
export function randomCatalog(seed: number): ToyCatalog {
  const random = rng(seed);
  const int = (max: number) => Math.floor(random() * (max + 1));
  const tags = ['a', 'b', 'c'];
  const slots: ToySlot[] = Array.from({ length: 3 + int(1) }, (_, s) => ({
    name: `s${s}`,
    maxRefine: int(2),
    mandatory: random() < 0.25,
    items: Array.from({ length: 1 + int(2) }, (_, i) => ({
      id: `s${s}i${i}`,
      atk: int(20),
      crit: random() < 0.4 ? int(30) : 0,
      refineAtk: int(3),
      tags: random() < 0.6 ? [tags[int(2)]] : [],
      exclusive: random() < 0.25 ? `g${int(1)}` : undefined,
      synergy: random() < 0.25 ? { tag: tags[int(2)], atk: int(15) } : undefined,
    })),
  }));
  const sets: ToySet[] = tags.map((tag) => ({ tag, threshold: 2 + int(1), atk: int(40), crit: random() < 0.3 ? int(20) : 0 }));
  return { slots, sets };
}

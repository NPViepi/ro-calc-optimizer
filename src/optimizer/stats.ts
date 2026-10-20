/**
 * Fase 1: distribuição de atributos (base e de traço) com os itens fixos.
 *
 * O orçamento e o custo de cada ponto vêm do próprio `BaseStateCalculator` do upstream, o
 * mesmo que a tela usa para "pontos restantes", então o otimizador nunca propõe uma
 * distribuição que a tela marcaria como inválida.
 *
 * Busca:
 * 1. **Guloso por ganho/custo**, com passos de 10 → 5 → 1 pontos. Passos grandes atravessam
 *    os "degraus" das fórmulas (bônus que só mudam a cada N pontos), os pequenos fazem o ajuste fino.
 * 2. **Trocas entre pares** (tira d de um atributo e devolve os pontos a outro) até não melhorar,
 *    o que corrige escolhas gulosas ruins.
 * O processo roda a partir da distribuição atual do usuário e a partir do zero; fica a melhor.
 */

import { BaseStateCalculator } from 'src/app/core/base-state-calculator';
import { MAIN_STAT_KEYS, MainStatKey, TRAIT_KEYS, TraitKey } from 'src/app/constants/trait-keys';
import { CharacterBase } from 'src/app/jobs';
import { MainModel } from 'src/app/models/main.model';
import { BuildEvaluator, BuildMetrics } from './evaluate';
import { damageScore, DamageObjective } from './objective';

export type StatKey = MainStatKey | TraitKey;
export type StatAllocation = Record<StatKey, number>;

const TRAIT_MAX = 100;
const STEPS = [10, 5, 1];
const EPSILON = 1e-9;

export interface StatBudget {
  /** Pontos de atributo base no nível (inclui os iniciais da classe). */
  mainTotal: number;
  traitTotal: number;
  allowTrait: boolean;
  maxMain: number;
  maxTrait: number;
  /** `mainCost[v]`: pontos gastos para levar um atributo de 1 até v. */
  mainCost: number[];
}

/** Orçamento de pontos para a classe/nível, pelas regras do upstream. */
export function statBudget(character: CharacterBase, level: number): StatBudget {
  const calculator = new BaseStateCalculator().setClass(character).setLevel(level);
  const base = calculator.setMainStatusLevels([1, 1, 1, 1, 1, 1]).setTraitStatusLevels([0, 0, 0, 0, 0, 0]).calculate().summary;
  const maxMain = character.maxBaseStat;
  const mainCost: number[] = [0, 0];
  for (let value = 2; value <= maxMain; value++) {
    mainCost[value] = calculator.setMainStatusLevels([value, 1, 1, 1, 1, 1]).calculate().summary.usedPoint;
  }
  const allowTrait = character.isAllowTraitStat();

  return {
    mainTotal: base.totalPoint,
    traitTotal: allowTrait ? base.totalTraitPoint : 0,
    allowTrait,
    maxMain,
    maxTrait: allowTrait ? TRAIT_MAX : 0,
    mainCost,
  };
}

export const usedMainPoints = (alloc: StatAllocation, budget: StatBudget) =>
  MAIN_STAT_KEYS.reduce((sum, key) => sum + budget.mainCost[alloc[key]], 0);

export const usedTraitPoints = (alloc: StatAllocation) => TRAIT_KEYS.reduce((sum, key) => sum + alloc[key], 0);

export function allocationOf(model: MainModel): StatAllocation {
  const alloc = {} as StatAllocation;
  for (const key of MAIN_STAT_KEYS) alloc[key] = Math.max(1, Math.round(Number(model[key]) || 1));
  for (const key of TRAIT_KEYS) alloc[key] = Math.max(0, Math.round(Number(model[key]) || 0));
  return alloc;
}

export interface StatOptions {
  objective?: DamageObjective;
  /** Atributos que não podem mudar (ex.: manter VIT para sobreviver). */
  locked?: StatKey[];
  /** Valor mínimo por atributo (ex.: `{ vit: 80 }`). */
  minimum?: Partial<Record<StatKey, number>>;
  /** Teto de avaliações do motor (≈ 1,4 ms cada). */
  maxEvaluations?: number;
  /** Chamado a cada melhoria encontrada. */
  onProgress?: (progress: { score: number; evaluations: number }) => void;
}

export interface StatChange { key: StatKey; from: number; to: number }

export interface StatResult {
  model: MainModel;
  metrics: BuildMetrics;
  before: BuildMetrics;
  score: number;
  scoreBefore: number;
  changes: StatChange[];
  mainPointsLeft: number;
  traitPointsLeft: number;
  evaluations: number;
  /** A busca parou pelo teto de avaliações. */
  truncated: boolean;
}

class StatSearch {
  private evaluations = 0;
  truncated = false;
  readonly keys: StatKey[];

  constructor(
    private readonly evaluator: BuildEvaluator,
    private readonly base: MainModel,
    private readonly budget: StatBudget,
    private readonly objective: DamageObjective,
    private readonly lower: StatAllocation,
    locked: Set<StatKey>,
    private readonly maxEvaluations: number,
    private readonly onProgress?: StatOptions['onProgress'],
  ) {
    this.keys = [...MAIN_STAT_KEYS, ...(budget.allowTrait ? TRAIT_KEYS : [])].filter((key) => !locked.has(key));
  }

  get spent() { return this.evaluations; }

  get exhausted() { return this.evaluations >= this.maxEvaluations; }

  isTrait = (key: StatKey) => (TRAIT_KEYS as readonly string[]).includes(key);

  cap = (key: StatKey) => (this.isTrait(key) ? this.budget.maxTrait : this.budget.maxMain);

  cost(key: StatKey, value: number) {
    return this.isTrait(key) ? value : this.budget.mainCost[value];
  }

  pointsLeft(alloc: StatAllocation, trait: boolean) {
    return trait ? this.budget.traitTotal - usedTraitPoints(alloc) : this.budget.mainTotal - usedMainPoints(alloc, this.budget);
  }

  /** Maior valor alcançável para `key` (até `target`) com os pontos livres. */
  affordable(alloc: StatAllocation, key: StatKey, target: number) {
    const left = this.pointsLeft(alloc, this.isTrait(key));
    const current = this.cost(key, alloc[key]);
    let value = Math.min(target, this.cap(key));
    while (value > alloc[key] && this.cost(key, value) - current > left) value--;
    return value;
  }

  score(alloc: StatAllocation): number {
    if (this.exhausted) { this.truncated = true; return -Infinity; }
    this.evaluations++;
    return damageScore(this.evaluator.evaluate(this.toModel(alloc)), this.objective);
  }

  toModel(alloc: StatAllocation): MainModel {
    return { ...this.base, ...alloc };
  }

  /** Gasta os pontos livres onde rendem mais dano por ponto. */
  greedy(start: StatAllocation, startScore: number): { alloc: StatAllocation; score: number } {
    let alloc = { ...start };
    let score = startScore;
    for (const step of STEPS) {
      for (;;) {
        let best: { alloc: StatAllocation; score: number; ratio: number } | null = null;
        for (const key of this.keys) {
          const value = this.affordable(alloc, key, alloc[key] + step);
          if (value <= alloc[key]) continue;
          const next = { ...alloc, [key]: value };
          const nextScore = this.score(next);
          const spent = this.cost(key, value) - this.cost(key, alloc[key]);
          const ratio = (nextScore - score) / Math.max(1, spent);
          if (nextScore > score + EPSILON && (!best || ratio > best.ratio)) best = { alloc: next, score: nextScore, ratio };
        }
        if (!best) break;
        alloc = best.alloc;
        score = best.score;
        this.onProgress?.({ score, evaluations: this.evaluations });
      }
      if (this.exhausted) break;
    }
    return { alloc, score };
  }

  /** Move pontos de um atributo para outro do mesmo tipo enquanto houver melhoria. */
  swaps(start: StatAllocation, startScore: number): { alloc: StatAllocation; score: number } {
    let alloc = { ...start };
    let score = startScore;
    let improved = true;
    while (improved && !this.exhausted) {
      improved = false;
      for (const from of this.keys) {
        for (const to of this.keys) {
          if (from === to || this.isTrait(from) !== this.isTrait(to)) continue;
          for (const step of STEPS) {
            if (alloc[from] - step < this.lower[from]) continue;
            const reduced = { ...alloc, [from]: alloc[from] - step };
            const value = this.affordable(reduced, to, this.cap(to));
            if (value <= alloc[to]) continue;
            // Devolve só o necessário: tenta o maior valor alcançável e, se não melhorar, o
            // equivalente ao passo (evita "jogar" pontos demais num atributo de uma vez).
            for (const target of new Set([value, Math.min(value, alloc[to] + step)])) {
              const next = { ...reduced, [to]: target };
              const nextScore = this.score(next);
              if (nextScore > score + EPSILON) {
                alloc = next;
                score = nextScore;
                improved = true;
                this.onProgress?.({ score, evaluations: this.evaluations });
                break;
              }
            }
          }
        }
      }
      // Pontos liberados por trocas podem ter ficado sobrando.
      if (improved) ({ alloc, score } = this.greedy(alloc, score));
    }
    return { alloc, score };
  }

  run(start: StatAllocation) {
    const first = this.greedy(start, this.score(start));
    return this.swaps(first.alloc, first.score);
  }
}

/** Ajusta uma alocação para caber no orçamento/limites, cortando dos atributos mais altos. */
function clampToBudget(alloc: StatAllocation, lower: StatAllocation, budget: StatBudget, locked: Set<StatKey>): StatAllocation {
  const result = { ...alloc };
  for (const key of MAIN_STAT_KEYS) result[key] = Math.min(budget.maxMain, Math.max(lower[key], result[key]));
  for (const key of TRAIT_KEYS) result[key] = budget.allowTrait ? Math.min(budget.maxTrait, Math.max(lower[key], result[key])) : 0;
  const trim = (keys: readonly StatKey[], over: () => boolean) => {
    while (over()) {
      const key = keys.filter((k) => !locked.has(k) && result[k] > lower[k]).sort((a, b) => result[b] - result[a])[0];
      if (!key) break;
      result[key]--;
    }
  };
  trim(MAIN_STAT_KEYS, () => usedMainPoints(result, budget) > budget.mainTotal);
  trim(TRAIT_KEYS, () => usedTraitPoints(result) > budget.traitTotal);
  return result;
}

/**
 * Otimiza os atributos de `model` para a skill selecionada nele, mantendo os itens.
 * Nunca devolve algo pior que a distribuição atual (quando ela cabe no orçamento).
 */
export function optimizeStats(evaluator: BuildEvaluator, model: MainModel, character: CharacterBase, options: StatOptions = {}): StatResult {
  const objective = options.objective ?? 'avg';
  const budget = statBudget(character, model.level);
  const locked = new Set<StatKey>(options.locked ?? []);
  const current = allocationOf(model);

  const lower = {} as StatAllocation;
  for (const key of MAIN_STAT_KEYS) lower[key] = 1;
  for (const key of TRAIT_KEYS) lower[key] = 0;
  for (const [key, value] of Object.entries(options.minimum ?? {}) as [StatKey, number][]) lower[key] = Math.max(lower[key], value);
  for (const key of locked) lower[key] = current[key];

  const search = new StatSearch(evaluator, model, budget, objective, lower, locked, options.maxEvaluations ?? 4_000, options.onProgress);

  const before = evaluator.evaluate(model);
  const scoreBefore = damageScore(before, objective);
  const fromCurrent = clampToBudget(current, lower, budget, locked);
  const fromScratch = { ...lower };

  const candidates = [search.run(fromCurrent), search.run(fromScratch)];
  // A distribuição atual entra como candidata só se for válida.
  const currentIsValid = usedMainPoints(current, budget) <= budget.mainTotal && usedTraitPoints(current) <= budget.traitTotal;
  if (currentIsValid) candidates.push({ alloc: current, score: scoreBefore });
  const best = candidates.reduce((a, b) => (b.score > a.score + EPSILON ? b : a));

  const optimized = search.toModel(best.alloc);
  const metrics = evaluator.evaluate(optimized);
  const changes = (search.keys as StatKey[])
    .filter((key) => current[key] !== best.alloc[key])
    .map((key) => ({ key, from: current[key], to: best.alloc[key] }));

  return {
    model: optimized,
    metrics,
    before,
    score: damageScore(metrics, objective),
    scoreBefore,
    changes,
    mainPointsLeft: budget.mainTotal - usedMainPoints(best.alloc, budget),
    traitPointsLeft: budget.traitTotal - usedTraitPoints(best.alloc),
    evaluations: search.spent,
    truncated: search.truncated,
  };
}

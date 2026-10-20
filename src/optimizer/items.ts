/**
 * Fase 3: otimização de equipamentos (sem cartas/encantamentos), combinada com atributos.
 *
 * 1. Atributos primeiro, para partir de uma base justa.
 * 2. **Triagem**: cada item possível de cada slot é testado sozinho na build atual (troca
 *    única) e só os K melhores ficam na lista curta do slot. O item atual sempre fica.
 * 3. **Descida coordenada**: slot a slot, testa a lista curta na build *atual* e fica com o
 *    melhor; ao fim de cada rodada, re-otimiza os atributos (um item com +DES pode liberar
 *    pontos, por exemplo). Para quando uma rodada não muda nada ou o tempo acaba.
 *
 * A pontuação é a mesma das fases 1–2 (`objective.ts`): limites de tempo primeiro, dano depois.
 * Conjuntos (bônus de combinação) e cartas/encantamentos ficam para a fase 4.
 */

import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { CharacterBase } from 'src/app/jobs';
import { MainModel } from 'src/app/models/main.model';
import {
  buildCatalog, CatalogOptions, compatibleAmmo, COSTUME_SLOT_KEYS, EQUIPMENT_SLOT_KEYS, OptimizableSlot, placeItem,
  PlacementOptions, SlotCatalog, WeaponRulesProbe,
} from './candidates';
import { BuildEvaluator, BuildMetrics, EvaluationContext } from './evaluate';
import {
  checkConstraints, ConstraintCheck, DamageObjective, isBetter, isFeasible, Score, scoreOf, TimingConstraints,
} from './objective';
import { optimizeStats, StatChange, StatKey } from './stats';

export interface BuildOptions {
  objective?: DamageObjective;
  constraints?: TimingConstraints;
  /** Slots que podem mudar. Padrão: todo o equipamento (sem visuais). */
  slots?: OptimizableSlot[];
  /** Incluir os slots de visual. Padrão: false. */
  includeCostumes?: boolean;
  /** Slots que não podem mudar (tem prioridade sobre `slots`). */
  lockedSlots?: OptimizableSlot[];
  catalog?: CatalogOptions;
  placement?: PlacementOptions;
  /** Tamanho da lista curta por slot após a triagem. Padrão: 12. */
  shortlistSize?: number;
  /** Re-otimizar atributos junto. Padrão: true. */
  optimizeStats?: boolean;
  lockedStats?: StatKey[];
  minimumStats?: Partial<Record<StatKey, number>>;
  /** Avaliações por rodada de atributos. Padrão: 2.500. */
  statEvaluations?: number;
  maxRounds?: number;
  /** Tempo máximo aproximado, em ms. Padrão: 60 s. */
  timeLimitMs?: number;
  onProgress?: (progress: BuildProgress) => void;
}

export interface BuildProgress {
  phase: 'stats' | 'screening' | 'search';
  slot?: OptimizableSlot;
  round?: number;
  score: Score;
  evaluations: number;
  elapsedMs: number;
}

export interface ItemChange {
  slot: OptimizableSlot;
  from: number | undefined;
  to: number | undefined;
}

export interface BuildResult {
  model: MainModel;
  metrics: BuildMetrics;
  before: BuildMetrics;
  score: Score;
  scoreBefore: Score;
  damage: number;
  damageBefore: number;
  feasible: boolean;
  constraints: ConstraintCheck[];
  constraintsBefore: ConstraintCheck[];
  itemChanges: ItemChange[];
  statChanges: StatChange[];
  shortlists: Partial<Record<OptimizableSlot, number[]>>;
  rounds: number;
  evaluations: number;
  elapsedMs: number;
  /** Parou por tempo antes de convergir. */
  truncated: boolean;
}

const DEFAULT_SHORTLIST = 12;

class BuildSearch {
  readonly started = performance.now();
  evaluations = 0;
  truncated = false;
  private readonly probe: WeaponRulesProbe;
  private readonly ammoRanking = new Map<number, number[]>();

  constructor(
    private readonly evaluator: BuildEvaluator,
    private readonly context: EvaluationContext,
    private readonly character: CharacterBase,
    private readonly catalog: SlotCatalog,
    private readonly options: BuildOptions,
  ) {
    this.probe = new WeaponRulesProbe(context.items, character);
  }

  get elapsed() { return performance.now() - this.started; }

  get outOfTime() { return this.elapsed > (this.options.timeLimitMs ?? 60_000); }

  score(model: MainModel): Score {
    this.evaluations++;
    return scoreOf(this.evaluator.evaluate(model), this.options.objective ?? 'avg', this.options.constraints);
  }

  progress(phase: BuildProgress['phase'], score: Score, extra: Partial<BuildProgress> = {}) {
    this.options.onProgress?.({ phase, score, evaluations: this.evaluations, elapsedMs: this.elapsed, ...extra });
  }

  /**
   * Troca o item e deixa a build válida. Arma nova sem munição compatível recebe a melhor
   * munição para aquele tipo (ranqueada uma vez por tipo de munição e reaproveitada).
   */
  place(model: MainModel, slot: OptimizableSlot, itemId: number | undefined): MainModel {
    const next = placeItem(model, slot, itemId, this.context.items, this.probe, this.options.placement);
    if (slot === ItemTypeEnum.weapon && itemId && !next.ammo) {
      const rules = this.probe.rules(itemId);
      if (rules.allowAmmo && rules.ammoSubTypeId != null) {
        const best = this.rankAmmo(next, rules.ammoSubTypeId)[0];
        if (best) return placeItem(next, ItemTypeEnum.ammo, best, this.context.items, this.probe, this.options.placement);
      }
    }
    return next;
  }

  private rankAmmo(model: MainModel, subType: number): number[] {
    let ranking = this.ammoRanking.get(subType);
    if (!ranking) {
      const scored = compatibleAmmo(model, this.catalog, this.context.items, this.probe)
        .map((id) => ({ id, score: this.score(placeItem(model, ItemTypeEnum.ammo, id, this.context.items, this.probe)) }));
      ranking = scored.sort((a, b) => (isBetter(a.score, b.score) ? -1 : isBetter(b.score, a.score) ? 1 : 0)).map((entry) => entry.id);
      this.ammoRanking.set(subType, ranking);
    }
    return ranking;
  }

  /** Itens possíveis no slot, dado o resto da build (escudo e munição dependem da arma). */
  candidatesFor(model: MainModel, slot: OptimizableSlot): number[] {
    if (slot === ItemTypeEnum.ammo) return compatibleAmmo(model, this.catalog, this.context.items, this.probe);
    if (slot === ItemTypeEnum.shield && (model.leftWeapon || !this.probe.rules(model.weapon).allowShield)) return [];
    return this.catalog[slot] ?? [];
  }

  /** Testa cada item do slot isoladamente e guarda os K melhores (mais o atual). */
  screen(model: MainModel, slot: OptimizableSlot, size: number): number[] {
    const current = (model as Record<string, any>)[slot] as number | undefined;
    const scored: { id: number; score: Score }[] = [];
    for (const id of this.candidatesFor(model, slot)) {
      if (this.outOfTime) { this.truncated = true; break; }
      scored.push({ id, score: this.score(this.place(model, slot, id)) });
    }
    scored.sort((a, b) => (isBetter(a.score, b.score) ? -1 : isBetter(b.score, a.score) ? 1 : 0));
    const shortlist = scored.slice(0, size).map((entry) => entry.id);
    if (current && !shortlist.includes(current)) shortlist.push(current);
    return shortlist;
  }

  /** Melhor item da lista curta para o slot, na build atual. */
  bestFor(model: MainModel, score: Score, slot: OptimizableSlot, shortlist: number[]): { model: MainModel; score: Score } {
    let best = { model, score };
    const current = (model as Record<string, any>)[slot];
    const valid = new Set(this.candidatesFor(model, slot));
    for (const id of shortlist) {
      if (id === current || !valid.has(id)) continue;
      if (this.outOfTime) { this.truncated = true; break; }
      const next = this.place(model, slot, id);
      const nextScore = this.score(next);
      if (isBetter(nextScore, best.score)) best = { model: next, score: nextScore };
    }
    return best;
  }

  stats(model: MainModel): { model: MainModel; score: Score } {
    if (this.options.optimizeStats === false) return { model, score: this.score(model) };
    const result = optimizeStats(this.evaluator, model, this.character, {
      objective: this.options.objective,
      constraints: this.options.constraints,
      locked: this.options.lockedStats,
      minimum: this.options.minimumStats,
      maxEvaluations: this.options.statEvaluations ?? 2_500,
    });
    this.evaluations += result.evaluations;
    return { model: result.model, score: result.score };
  }
}

const itemOf = (model: MainModel, slot: OptimizableSlot) => (model as Record<string, any>)[slot] as number | undefined;

/**
 * Otimiza itens (e, por padrão, atributos) da build para a skill selecionada nela.
 * Nunca devolve algo pior que a build de entrada.
 */
export function optimizeBuild(
  evaluator: BuildEvaluator, context: EvaluationContext, model: MainModel, options: BuildOptions = {},
): BuildResult {
  const character = context.character;
  const objective = options.objective ?? 'avg';
  const locked = new Set(options.lockedSlots ?? []);
  const slots = (options.slots ?? [...EQUIPMENT_SLOT_KEYS, ...(options.includeCostumes ? COSTUME_SLOT_KEYS : [])])
    .filter((slot) => !locked.has(slot));
  const catalog = buildCatalog(context.items, character, { maxRequiredLevel: model.level, ...options.catalog });
  const search = new BuildSearch(evaluator, context, character, catalog, options);

  const before = evaluator.evaluate(model);
  const scoreBefore = scoreOf(before, objective, options.constraints);

  // 1. Atributos.
  let state = search.stats(model);
  if (!isBetter(state.score, scoreBefore)) state = { model, score: scoreBefore };
  search.progress('stats', state.score);

  // 2. Triagem por slot.
  const shortlists: Partial<Record<OptimizableSlot, number[]>> = {};
  for (const slot of slots) {
    shortlists[slot] = search.screen(state.model, slot, options.shortlistSize ?? DEFAULT_SHORTLIST);
    search.progress('screening', state.score, { slot });
    if (search.outOfTime) break;
  }

  // 3. Descida coordenada + atributos.
  let rounds = 0;
  const maxRounds = options.maxRounds ?? 6;
  while (rounds < maxRounds && !search.outOfTime) {
    rounds++;
    const roundStart = state.score;
    for (const slot of slots) {
      const shortlist = slot === ItemTypeEnum.ammo
        ? (search.candidatesFor(state.model, slot)) // poucas munições: testa todas as compatíveis
        : shortlists[slot] ?? [];
      const best = search.bestFor(state.model, state.score, slot, shortlist);
      if (isBetter(best.score, state.score)) {
        state = best;
        search.progress('search', state.score, { slot, round: rounds });
      }
    }
    const withStats = search.stats(state.model);
    if (isBetter(withStats.score, state.score)) state = withStats;
    if (!isBetter(state.score, roundStart)) break;
  }

  const metrics = evaluator.evaluate(state.model);
  const score = scoreOf(metrics, objective, options.constraints);
  const changedSlots = new Set<OptimizableSlot>([...EQUIPMENT_SLOT_KEYS, ...COSTUME_SLOT_KEYS]);
  const itemChanges = [...changedSlots]
    .filter((slot) => itemOf(model, slot) !== itemOf(state.model, slot))
    .map((slot) => ({ slot, from: itemOf(model, slot), to: itemOf(state.model, slot) }));
  const statKeys: StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'pow', 'sta', 'wis', 'spl', 'con', 'crt'];
  const statChanges = statKeys
    .filter((key) => (Number(model[key]) || 0) !== (Number(state.model[key]) || 0))
    .map((key) => ({ key, from: Number(model[key]) || 0, to: Number(state.model[key]) || 0 }));

  return {
    model: state.model,
    metrics,
    before,
    score,
    scoreBefore,
    damage: score.damage,
    damageBefore: scoreBefore.damage,
    feasible: isFeasible(score),
    constraints: checkConstraints(metrics, options.constraints),
    constraintsBefore: checkConstraints(before, options.constraints),
    itemChanges,
    statChanges,
    shortlists,
    rounds,
    evaluations: search.evaluations,
    elapsedMs: search.elapsed,
    truncated: search.truncated || search.outOfTime,
  };
}

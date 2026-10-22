/**
 * Otimização exata de uma build (modo "Exato").
 *
 * 1. Build inicial: a busca heurística (`optimizeBuild`, com atributos fixos) dá uma boa build
 *    rápido. Ela só serve de **ordem** (as escolhas dela são exploradas primeiro, então o
 *    primeiro caminho do DFS é ela) — nunca descarta nada.
 * 2. DFS exato (`engine.ts`) sobre `RoBuildProblem`, avaliando cada build completa no simulador.
 * 3. Status: `OPTIMAL` só se a árvore inteira foi explorada. Parou antes = `INTERRUPTED`, com
 *    checkpoint para retomar.
 * 4. Opcional: ajuste heurístico de atributos na build final, informado à parte e **sem garantia**.
 */

import { MainModel } from 'src/app/models/main.model';
import { BuildEvaluator, BuildMetrics, EvaluationContext, stableKey } from '../evaluate';
import { enchantWarnings, EnchantWarning } from '../enchant-limits';
import { ALL_OPTIMIZABLE_SLOTS, COSTUME_ENCHANT_SLOT_KEYS, EQUIPMENT_SLOT_KEYS, OptimizableSlot } from '../candidates';
import { AttachmentChange, buildChanges, ItemChange, optimizeBuild } from '../items';
import { checkConstraints, ConstraintCheck, isFeasible, Score, scoreOf } from '../objective';
import { findSetMoves, SetMove } from '../sets';
import { optimizeStats, StatChange, StatKey } from '../stats';
import { ExactSearch, SearchCheckpoint, SearchStats, SearchStatus } from './engine';
import { hashString, RoBuildProblem, RoProblemOptions, RoState } from './ro-problem';

/** Muda quando a semântica da busca muda: checkpoints antigos deixam de valer. */
export const EXACT_ENGINE_VERSION = 1;

export interface ExactCheckpoint {
  version: number;
  signature: string;
  seed: MainModel;
  search: SearchCheckpoint<Score, MainModel>;
}

export interface ExactProgress {
  phase: 'seed' | 'screening' | 'search';
  status: SearchStatus;
  stats?: SearchStats;
  bestScore?: Score;
  spaceLog10?: number;
  elapsedMs: number;
}

export interface ExactBuildOptions extends RoProblemOptions {
  /** `best` (padrão): uma build ótima. `allTies`: todas as empatadas no ótimo. */
  mode?: 'best' | 'allTies';
  /** Incluir encantamentos de visual quando `slots` não é informado. Padrão: true. */
  includeCostumes?: boolean;
  /** Tempo da busca heurística da build inicial (ms). 0 = partir da build original. Padrão: 15 s. */
  seedTimeMs?: number;
  /** Tempo máximo do DFS nesta execução (ms). Ausente = sem limite. */
  timeLimitMs?: number;
  shouldStop?: () => boolean;
  onProgress?: (progress: ExactProgress) => void;
  onCheckpoint?: (checkpoint: ExactCheckpoint) => void;
  checkpointEveryMs?: number;
  resume?: ExactCheckpoint;
  /** Só para testes. */
  maxLeaves?: number;
  sliceMs?: number;
  /** Depois do DFS, ajustar atributos com o guloso das fases 1–2 (sem garantia de ótimo). */
  postOptimizeStats?: boolean;
  lockedStats?: StatKey[];
  minimumStats?: Partial<Record<StatKey, number>>;
}

export interface ExactBuildResult {
  status: SearchStatus;
  /** A melhor build do espaço exato (atributos da build original). */
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
  attachmentChanges: AttachmentChange[];
  statChanges: StatChange[];
  warnings: EnchantWarning[];
  setsPresent: SetMove[];
  /** No modo `allTies`: todas as builds empatadas com a melhor (inclui `model`). */
  ties: MainModel[];
  stats: SearchStats;
  /** Avaliações no simulador: semente + ordenação + DFS. */
  evaluations: number;
  seedScore: Score;
  spaceLog10: number;
  signature: string;
  /** Presente quando `status` é `INTERRUPTED`: passe em `resume` para continuar. */
  checkpoint?: ExactCheckpoint;
  elapsedMs: number;
  error?: string;
  /** Resultado do ajuste de atributos (heurístico, sem garantia), quando pedido. */
  statsAdjusted?: { model: MainModel; metrics: BuildMetrics; score: Score; damage: number; statChanges: StatChange[] };
}

const now = () => performance.now();

/** Identidade do problema: versão do motor, dados, regras, opções, build original e semente. */
export function problemSignature(problem: RoBuildProblem, context: EvaluationContext, options: ExactBuildOptions, seed: MainModel): string {
  const {
    shouldStop, onProgress, onCheckpoint, resume, timeLimitMs, maxLeaves, sliceMs, checkpointEveryMs, seedTimeMs, seed: _seed,
    postOptimizeStats, lockedStats, minimumStats, ...relevant
  } = options;
  const ids = new Set<number>();
  for (const list of [...Object.values(problem.catalog), ...Object.values(problem.cardCatalog)]) for (const id of list ?? []) ids.add(id);
  const itemsHash = hashString([...ids].sort((a, b) => a - b).map((id) => `${id}:${stableKey(context.items[id])}`).join('\n'));
  return hashString(stableKey({
    version: EXACT_ENGINE_VERSION,
    options: relevant,
    catalog: problem.catalog,
    cards: problem.cardCatalog,
    itemsHash,
    monster: context.monster?.id,
    pvp: context.playerTarget ?? null,
    chances: context.selectedChances ?? [],
    original: problem.original,
    seed,
  }));
}

export async function optimizeExact(
  evaluator: BuildEvaluator, context: EvaluationContext, model: MainModel, options: ExactBuildOptions = {},
): Promise<ExactBuildResult> {
  const started = now();
  const objective = options.objective ?? 'avg';
  const locked = new Set(options.lockedSlots ?? []);
  const slots = (options.slots ?? [...EQUIPMENT_SLOT_KEYS, ...(options.includeCostumes === false ? [] : COSTUME_ENCHANT_SLOT_KEYS)])
    .filter((slot) => !locked.has(slot)) as OptimizableSlot[];
  const progress = (update: Omit<ExactProgress, 'elapsedMs'>) => options.onProgress?.({ ...update, elapsedMs: now() - started });

  // 1. Build inicial (só ordem). Atributos fixos: o espaço exato não mexe neles.
  let seed: MainModel;
  if (options.resume) {
    seed = options.resume.seed;
  } else if ((options.seedTimeMs ?? 15_000) > 0) {
    progress({ phase: 'seed', status: 'BEST_FOUND' });
    seed = optimizeBuild(evaluator, context, model, {
      objective, constraints: options.constraints, slots, lockedSlots: options.lockedSlots, catalog: options.catalog,
      placement: options.placement, optimizeStats: false, optimizeCards: options.optimizeCards,
      optimizeEnchants: options.optimizeEnchants, keepWeaponType: options.keepWeaponType,
      unknownEnchantRepeats: options.unknownEnchantRepeats, timeLimitMs: options.seedTimeMs ?? 15_000,
      onProgress: () => progress({ phase: 'seed', status: 'BEST_FOUND' }),
    }).model;
  } else {
    seed = model;
  }

  // 2. Problema + ordenação.
  progress({ phase: 'screening', status: 'BEST_FOUND' });
  const problem = new RoBuildProblem(evaluator, context, model, { ...options, slots, seed });
  const spaceLog10 = problem.estimateSpaceLog10();
  const signature = problemSignature(problem, context, options, seed);
  if (options.resume && (options.resume.version !== EXACT_ENGINE_VERSION || options.resume.signature !== signature)) {
    throw new Error('O checkpoint não corresponde a esta build, a estes dados ou a estas opções. Comece uma busca nova.');
  }

  // 3. DFS.
  const wrap = (search: SearchCheckpoint<Score, MainModel>): ExactCheckpoint => ({ version: EXACT_ENGINE_VERSION, signature, seed, search });
  const serialize = (state: RoState) => state.model;
  const deserialize = (saved: MainModel): RoState => ({ model: saved, remaining: [], pending: [], decided: [] });
  const engine = new ExactSearch(problem, {
    mode: options.mode ?? 'best',
    resume: options.resume?.search,
    shouldStop: options.shouldStop,
    timeLimitMs: options.timeLimitMs,
    maxLeaves: options.maxLeaves,
    serialize,
    deserialize,
    checkpointEveryMs: options.checkpointEveryMs,
    onCheckpoint: options.onCheckpoint ? (checkpoint) => options.onCheckpoint!(wrap(checkpoint)) : undefined,
    onProgress: (snapshot) => progress({ phase: 'search', status: snapshot.status, stats: snapshot.stats, bestScore: snapshot.best?.score, spaceLog10 }),
  });
  const searched = await engine.runAsync(options.sliceMs ?? 50);

  const best = searched.best?.states[0]?.model ?? seed;
  const metrics = evaluator.evaluate(best);
  const score = scoreOf(metrics, objective, options.constraints);
  const before = evaluator.evaluate(model);
  const scoreBefore = scoreOf(before, objective, options.constraints);
  const seedScore = scoreOf(evaluator.evaluate(seed), objective, options.constraints);
  const changes = buildChanges(model, best);
  const setsPresent = findSetMoves(context.items, problem.catalog)
    .filter((move) => move.pieces.every((piece) => (best as Record<string, any>)[piece.slot] === piece.id));

  let statsAdjusted: ExactBuildResult['statsAdjusted'];
  if (options.postOptimizeStats && searched.status !== 'ERROR') {
    const adjusted = optimizeStats(evaluator, best, context.character, {
      objective, constraints: options.constraints, locked: options.lockedStats, minimum: options.minimumStats,
    });
    statsAdjusted = {
      model: adjusted.model, metrics: adjusted.metrics, score: adjusted.score, damage: adjusted.score.damage,
      statChanges: buildChanges(best, adjusted.model).statChanges,
    };
  }

  return {
    status: searched.status,
    model: best,
    metrics,
    before,
    score,
    scoreBefore,
    damage: score.damage,
    damageBefore: scoreBefore.damage,
    feasible: isFeasible(score),
    constraints: checkConstraints(metrics, options.constraints),
    constraintsBefore: checkConstraints(before, options.constraints),
    ...changes,
    warnings: enchantWarnings(best, context.items, ALL_OPTIMIZABLE_SLOTS),
    setsPresent,
    ties: (searched.best?.states ?? []).map((state) => state.model),
    stats: searched.stats,
    evaluations: problem.evaluations + problem.screenEvaluations,
    seedScore,
    spaceLog10,
    signature,
    checkpoint: searched.status === 'INTERRUPTED' ? wrap(engine.checkpoint()) : undefined,
    elapsedMs: now() - started,
    error: searched.error,
    statsAdjusted,
  };
}

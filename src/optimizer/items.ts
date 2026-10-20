/**
 * Fases 3 e 4: otimização de equipamentos, cartas, encantamentos e conjuntos, combinada
 * com atributos.
 *
 * 1. Atributos primeiro, para partir de uma base justa.
 * 2. **Triagem**: cada item possível de cada slot é testado sozinho na build atual (troca
 *    única) e só os K melhores ficam na lista curta do slot. O item atual sempre fica.
 *    Os conjuntos (`sets.ts`) passam pela mesma triagem.
 * 3. **Descida coordenada**: slot a slot, testa a lista curta na build *atual*. Os melhores
 *    candidatos (e o item atual) ganham cartas e encantamentos antes da comparação, para que
 *    um item bom de encantar não perca para um item "pelado" melhor. Depois do giro pelos
 *    slots, testa os conjuntos e re-otimiza os atributos. Para quando uma rodada não muda
 *    nada ou o tempo acaba.
 *
 * A pontuação é a mesma das fases 1–2 (`objective.ts`): limites de tempo primeiro, dano depois.
 */

import { MainItemWithRelations, ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { CharacterBase } from 'src/app/jobs';
import { MainModel } from 'src/app/models/main.model';
import { attachmentsFor, buildCardCatalog, buildEnchantMap, CardCatalog } from './attachments';
import {
  buildCatalog, CatalogOptions, compatibleAmmo, COSTUME_SLOT_KEYS, EQUIPMENT_SLOT_KEYS, OptimizableSlot, placeItem,
  PlacementOptions, SlotCatalog, WeaponRulesProbe,
} from './candidates';
import { BuildEvaluator, BuildMetrics, EvaluationContext } from './evaluate';
import {
  checkConstraints, ConstraintCheck, DamageObjective, isBetter, isFeasible, Score, scoreOf, TimingConstraints,
} from './objective';
import { canPlaceEnchant, enchantRulesFor, enchantsOf, enchantWarnings, EnchantWarning } from './enchant-limits';
import { findSetMoves, SetMove } from './sets';
import { optimizeStats, StatChange, StatKey } from './stats';

export interface BuildOptions {
  objective?: DamageObjective;
  constraints?: TimingConstraints;
  /** Slots que podem mudar. Padrão: todo o equipamento (sem visuais). */
  slots?: OptimizableSlot[];
  /** Incluir os slots de visual. Padrão: false. */
  includeCostumes?: boolean;
  /** Slots que não podem mudar, nem o item nem cartas/encantamentos (prioridade sobre `slots`). */
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
  /** Escolher cartas. Padrão: true. */
  optimizeCards?: boolean;
  /** Escolher encantamentos. Padrão: true. */
  optimizeEnchants?: boolean;
  /**
   * Manter o tipo de arma da build (arco continua arco). Padrão: true. Nem toda skill declara
   * a arma que exige (`verifyItemFn`) — Tiro Preciso, por exemplo, não —, e sem isso o motor
   * calcula dano com qualquer arma; trocar de tipo pode dar uma build que o jogo não aceita.
   */
  keepWeaponType?: boolean;
  /**
   * Repetir um encantamento num item cujo limite não está cadastrado em
   * `data/enchant-limits.ts`. `allow` (padrão) permite e avisa em `warnings`; `forbid` nunca repete.
   * Itens com limite cadastrado (Automatron, Ilusión, Capacetes do Passe) seguem sempre a regra.
   */
  unknownEnchantRepeats?: 'allow' | 'forbid';
  /** Testar conjuntos (bônus de combinação). Padrão: true. */
  optimizeSets?: boolean;
  /** Cartas por slot que passam da triagem. Padrão: 8. */
  cardShortlistSize?: number;
  /** Quantos candidatos por slot recebem cartas/encantamentos antes de comparar. Padrão: 2. */
  deepCandidates?: number;
  /** Conjuntos que passam da triagem. Padrão: 20. */
  setShortlistSize?: number;
  maxRounds?: number;
  /** Tempo máximo aproximado, em ms. Padrão: 90 s. */
  timeLimitMs?: number;
  onProgress?: (progress: BuildProgress) => void;
}

export interface BuildProgress {
  phase: 'stats' | 'screening' | 'sets' | 'search';
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

/** Mudança numa carta ou encantamento (campo do modelo, ex.: `weaponCard1`). */
export interface AttachmentChange {
  slot: OptimizableSlot;
  field: ItemTypeEnum;
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
  attachmentChanges: AttachmentChange[];
  statChanges: StatChange[];
  /** Encantamentos a conferir: violações de regra cadastrada ou repetições sem regra conhecida. */
  warnings: EnchantWarning[];
  /** Conjuntos aplicados pela busca (podem ter sido alterados depois). */
  setsApplied: SetMove[];
  shortlists: Partial<Record<OptimizableSlot, number[]>>;
  rounds: number;
  evaluations: number;
  elapsedMs: number;
  /** Parou por tempo antes de convergir. */
  truncated: boolean;
}

interface State { model: MainModel; score: Score }

const DEFAULT_SHORTLIST = 12;

const byScore = (a: { score: Score }, b: { score: Score }) => (isBetter(a.score, b.score) ? -1 : isBetter(b.score, a.score) ? 1 : 0);

const field = (model: MainModel, key: string) => (model as Record<string, any>)[key] as number | undefined;

class BuildSearch {
  readonly started = performance.now();
  evaluations = 0;
  truncated = false;
  private readonly probe: WeaponRulesProbe;
  private readonly ammoRanking = new Map<number, number[]>();
  private readonly cardCatalog: CardCatalog;
  private readonly enchantMap;
  private readonly cardShortlists = new Map<OptimizableSlot, number[]>();
  private readonly locked: OptimizableSlot[];
  private readonly weaponSubType: number | undefined;

  constructor(
    private readonly evaluator: BuildEvaluator,
    private readonly context: EvaluationContext,
    private readonly character: CharacterBase,
    private readonly catalog: SlotCatalog,
    private readonly options: BuildOptions,
    original: MainModel,
  ) {
    this.probe = new WeaponRulesProbe(context.items, character);
    this.cardCatalog = options.optimizeCards === false ? {} : buildCardCatalog(context.items, options.catalog);
    this.enchantMap = buildEnchantMap(context.items);
    this.locked = options.lockedSlots ?? [];
    const weapon = original.weapon ? context.items[original.weapon] : undefined;
    this.weaponSubType = options.keepWeaponType === false ? undefined : weapon?.itemSubTypeId;
  }

  /** Efeitos colaterais (cabeça de vários slots, arma que tira escudo) não podem mexer em slot travado. */
  keepsLocks(before: MainModel, after: MainModel) {
    return this.locked.every((slot) => field(before, slot) === field(after, slot));
  }

  get elapsed() { return performance.now() - this.started; }

  get outOfTime() { return this.elapsed > (this.options.timeLimitMs ?? 90_000); }

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
      ranking = compatibleAmmo(model, this.catalog, this.context.items, this.probe)
        .map((id) => ({ id, score: this.score(placeItem(model, ItemTypeEnum.ammo, id, this.context.items, this.probe)) }))
        .sort(byScore)
        .map((entry) => entry.id);
      this.ammoRanking.set(subType, ranking);
    }
    return ranking;
  }

  /** Itens possíveis no slot, dado o resto da build (escudo e munição dependem da arma). */
  candidatesFor(model: MainModel, slot: OptimizableSlot): number[] {
    if (slot === ItemTypeEnum.ammo) return compatibleAmmo(model, this.catalog, this.context.items, this.probe);
    if (slot === ItemTypeEnum.shield && (model.leftWeapon || !this.probe.rules(model.weapon).allowShield)) return [];
    if (slot === ItemTypeEnum.weapon && this.weaponSubType != null) {
      return (this.catalog[slot] ?? []).filter((id) => this.context.items[id]?.itemSubTypeId === this.weaponSubType);
    }
    return this.catalog[slot] ?? [];
  }

  /** Testa cada item do slot isoladamente e guarda os K melhores (mais o atual). */
  screen(model: MainModel, slot: OptimizableSlot, size: number): number[] {
    const current = field(model, slot);
    const scored: { id: number; score: Score }[] = [];
    for (const id of this.candidatesFor(model, slot)) {
      if (this.outOfTime) { this.truncated = true; break; }
      const next = this.place(model, slot, id);
      if (!this.keepsLocks(model, next)) continue;
      scored.push({ id, score: this.score(next) });
    }
    const shortlist = scored.sort(byScore).slice(0, size).map((entry) => entry.id);
    if (current && !shortlist.includes(current)) shortlist.push(current);
    return shortlist;
  }

  /** Cartas do slot que passam da triagem (testadas no primeiro encaixe, uma vez por slot). */
  private cardShortlist(model: MainModel, slot: OptimizableSlot, cardField: ItemTypeEnum): number[] {
    let shortlist = this.cardShortlists.get(slot);
    if (!shortlist) {
      shortlist = (this.cardCatalog[slot] ?? [])
        .map((id) => ({ id, score: this.score({ ...model, [cardField]: id } as MainModel) }))
        .sort(byScore)
        .slice(0, this.options.cardShortlistSize ?? 8)
        .map((entry) => entry.id);
      this.cardShortlists.set(slot, shortlist);
    }
    return shortlist;
  }

  /** Melhores cartas e encantamentos para o item que está no slot (descida por campo). */
  attachments(state: State, slot: OptimizableSlot): State {
    const useCards = this.options.optimizeCards !== false;
    const useEnchants = this.options.optimizeEnchants !== false;
    if (!useCards && !useEnchants) return state;
    const { cardFields, enchants } = attachmentsFor(state.model, slot, this.context.items, this.enchantMap, this.options.catalog);
    const fields: { field: ItemTypeEnum; ids: number[]; enchant: boolean }[] = [
      ...(useCards ? cardFields.map((cardField) => ({ field: cardField, ids: this.cardShortlist(state.model, slot, cardFields[0]), enchant: false })) : []),
      ...(useEnchants ? enchants.map((entry) => ({ ...entry, enchant: true })) : []),
    ];
    let best = state;
    for (let pass = 0; pass < 2 && fields.length; pass++) {
      let changed = false;
      for (const { field: key, ids, enchant } of fields) {
        const current = field(best.model, key);
        for (const id of ids) {
          if (id === current) continue;
          if (enchant && !this.enchantAllowed(best.model, slot, key, id)) continue;
          if (this.outOfTime) { this.truncated = true; return best; }
          const next = { ...best.model, [key]: id } as MainModel;
          const nextScore = this.score(next);
          if (isBetter(nextScore, best.score)) { best = { model: next, score: nextScore }; changed = true; }
        }
      }
      if (!changed) break;
    }
    return best;
  }

  /** Respeita os limites cadastrados e, com `unknownEnchantRepeats: 'forbid'`, não repete encantamentos. */
  private enchantAllowed(model: MainModel, slot: OptimizableSlot, key: string, id: number) {
    if (!canPlaceEnchant(model, slot, key, id)) return false;
    if (this.options.unknownEnchantRepeats !== 'forbid' || enchantRulesFor(field(model, slot)).length) return true;
    return ![...enchantsOf(model, slot)].some(([other, value]) => other !== key && value === id);
  }

  /** Melhor item da lista curta para o slot, já com cartas/encantamentos nos finalistas. */
  bestFor(state: State, slot: OptimizableSlot, shortlist: number[]): State {
    const current = field(state.model, slot);
    const valid = new Set(this.candidatesFor(state.model, slot));
    const scored: State[] = [];
    for (const id of shortlist) {
      if (id === current || !valid.has(id)) continue;
      if (this.outOfTime) { this.truncated = true; break; }
      const model = this.place(state.model, slot, id);
      if (!this.keepsLocks(state.model, model)) continue;
      scored.push({ model, score: this.score(model) });
    }
    scored.sort(byScore);
    let best = this.attachments(state, slot);
    const deep = this.options.deepCandidates ?? 2;
    scored.forEach((candidate, index) => {
      const finalist = index < deep ? this.attachments(candidate, slot) : candidate;
      if (isBetter(finalist.score, best.score)) best = finalist;
    });
    return best;
  }

  applySet(model: MainModel, move: SetMove): MainModel {
    return move.pieces.reduce((current, piece) => this.place(current, piece.slot, piece.id), model);
  }

  /** Conjuntos ordenados pelo resultado de equipá-los de uma vez na build atual. */
  screenSets(model: MainModel, moves: SetMove[], size: number): SetMove[] {
    const scored: { move: SetMove; score: Score }[] = [];
    for (const move of moves) {
      if (this.outOfTime) { this.truncated = true; break; }
      const weapon = move.pieces.find((piece) => piece.slot === ItemTypeEnum.weapon);
      if (weapon && this.weaponSubType != null && this.context.items[weapon.id]?.itemSubTypeId !== this.weaponSubType) continue;
      const next = this.applySet(model, move);
      if (!this.keepsLocks(model, next)) continue;
      scored.push({ move, score: this.score(next) });
    }
    return scored.sort(byScore).slice(0, size).map((entry) => entry.move);
  }

  /** Testa os conjuntos da lista curta; os primeiros ganham cartas/encantamentos nas peças. */
  bestSet(state: State, moves: SetMove[]): { state: State; move?: SetMove } {
    let best: { state: State; move?: SetMove } = { state };
    const deep = this.options.deepCandidates ?? 2;
    moves.forEach((move, index) => {
      if (this.outOfTime) { this.truncated = true; return; }
      if (move.pieces.every((piece) => field(state.model, piece.slot) === piece.id)) return;
      const model = this.applySet(state.model, move);
      if (!this.keepsLocks(state.model, model)) return;
      let candidate: State = { model, score: this.score(model) };
      if (index < deep) for (const piece of move.pieces) candidate = this.attachments(candidate, piece.slot);
      if (isBetter(candidate.score, best.state.score)) best = { state: candidate, move };
    });
    return best;
  }

  stats(model: MainModel): State {
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

const ALL_SLOTS = [...EQUIPMENT_SLOT_KEYS, ...COSTUME_SLOT_KEYS] as OptimizableSlot[];
const STAT_KEYS: StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'pow', 'sta', 'wis', 'spl', 'con', 'crt'];

/**
 * Otimiza itens, cartas, encantamentos e conjuntos (e, por padrão, atributos) da build para
 * a skill selecionada nela. Nunca devolve algo pior que a build de entrada.
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
  const search = new BuildSearch(evaluator, context, character, catalog, options, model);

  const before = evaluator.evaluate(model);
  const scoreBefore = scoreOf(before, objective, options.constraints);

  // 1. Atributos.
  let state = search.stats(model);
  if (!isBetter(state.score, scoreBefore)) state = { model, score: scoreBefore };
  search.progress('stats', state.score);

  // 2. Triagem por slot e de conjuntos.
  const shortlists: Partial<Record<OptimizableSlot, number[]>> = {};
  for (const slot of slots) {
    shortlists[slot] = search.screen(state.model, slot, options.shortlistSize ?? DEFAULT_SHORTLIST);
    search.progress('screening', state.score, { slot });
    if (search.outOfTime) break;
  }
  const setMoves = options.optimizeSets === false ? [] : search.screenSets(
    state.model, findSetMoves(context.items, catalog, new Set(slots)), options.setShortlistSize ?? 20,
  );
  search.progress('sets', state.score);

  // 3. Descida coordenada + conjuntos + atributos.
  const setsApplied: SetMove[] = [];
  let rounds = 0;
  const maxRounds = options.maxRounds ?? 6;
  while (rounds < maxRounds && !search.outOfTime) {
    rounds++;
    const roundStart = state.score;
    for (const slot of slots) {
      // Poucas munições: testa todas as compatíveis com a arma atual.
      const shortlist = slot === ItemTypeEnum.ammo ? search.candidatesFor(state.model, slot) : shortlists[slot] ?? [];
      const best = search.bestFor(state, slot, shortlist);
      if (isBetter(best.score, state.score)) {
        state = best;
        search.progress('search', state.score, { slot, round: rounds });
      }
    }
    const set = search.bestSet(state, setMoves);
    if (set.move) {
      state = set.state;
      setsApplied.push(set.move);
      search.progress('sets', state.score, { round: rounds });
    }
    const withStats = search.stats(state.model);
    if (isBetter(withStats.score, state.score)) state = withStats;
    if (!isBetter(state.score, roundStart)) break;
  }

  const metrics = evaluator.evaluate(state.model);
  const score = scoreOf(metrics, objective, options.constraints);
  const itemChanges = ALL_SLOTS
    .filter((slot) => field(model, slot) !== field(state.model, slot))
    .map((slot) => ({ slot, from: field(model, slot), to: field(state.model, slot) }));
  const attachmentChanges = ALL_SLOTS.flatMap((slot) => (MainItemWithRelations[slot] ?? [])
    .filter((key) => (field(model, key) ?? undefined) !== (field(state.model, key) ?? undefined))
    .map((key) => ({ slot, field: key, from: field(model, key) ?? undefined, to: field(state.model, key) ?? undefined })));
  const statChanges = STAT_KEYS
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
    attachmentChanges,
    statChanges,
    warnings: enchantWarnings(state.model, context.items, ALL_SLOTS),
    setsApplied,
    shortlists,
    rounds,
    evaluations: search.evaluations,
    elapsedMs: search.elapsed,
    truncated: search.truncated || search.outOfTime,
  };
}

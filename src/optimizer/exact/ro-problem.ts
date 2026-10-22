/**
 * O espaço de builds do Ragnarok como problema de busca exata (`engine.ts`).
 *
 * Cada slot livre é uma decisão; depois de escolher um item, cada encaixe de carta e cada posição
 * de encantamento daquele item vira uma decisão própria. As regras vêm todas do código que já
 * existe (nada de fórmula nova):
 * - itens por slot: `buildCatalog` (os mesmos filtros dos dropdowns);
 * - escudo e munição pela arma: `WeaponRulesProbe` (o próprio motor);
 * - armas aceitas pela skill: `verifyItemFn` (ou `keepWeaponType`, ver `items.ts`);
 * - cartas e encantamentos por item: `attachmentsFor` → `deriveSlot` (o código dos chips da tela);
 * - colocar um item: `placeItem` (cabeças de vários slots, arma que tira escudo/munição);
 * - limites de encantamento: `canPlaceEnchant`;
 * - dano e tempos: `BuildEvaluator` (o simulador) + `scoreOf` (a mesma pontuação do heurístico).
 *
 * Os atributos ficam fixos (os da build). Refino e grau: o limite configurado (`refineDomain:
 * 'limit'`, padrão) ou todos os níveis até ele (`'all'`).
 *
 * Podas de inviabilidade (todas irreversíveis — ver `src/optimizer/exact/README.md`):
 * - `conflict`: colocar o item tirou um item já decidido ou travado (máscara que ocupa um slot já
 *   preenchido; arma que não aceita o escudo travado). Decisões futuras não devolvem o item tirado.
 * - `enchantLimit`: o encantamento quebra um limite cadastrado (os limites são máximos: mais
 *   encantamentos nunca tiram a violação) ou repete um encantamento com `unknownEnchantRepeats: 'forbid'`.
 *
 * Não há limite superior de dano: o simulador é caixa-preta e não há prova de monotonicidade.
 */

import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum, MainItemWithRelations } from 'src/app/constants/item-type.enum';
import { CharacterBase } from 'src/app/jobs';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { canGradeItem } from 'src/app/utils/can-grade';
import { attachmentsFor, buildCardCatalog, buildEnchantMap, CardCatalog } from '../attachments';
import {
  buildCatalog, CatalogOptions, clearSlot, COSTUME_ENCHANT_SLOT_KEYS, EQUIPMENT_SLOT_KEYS, Grade, OptimizableSlot,
  placeItem, PlacementOptions, SlotCatalog, WeaponRulesProbe,
} from '../candidates';
import { canPlaceEnchant, enchantRulesFor, enchantsOf } from '../enchant-limits';
import { BuildEvaluator, EvaluationContext, stableKey } from '../evaluate';
import { DamageObjective, isBetter, Score, scoreOf, TimingConstraints } from '../objective';
import { Decision, SearchProblem } from './engine';

export type SlotChoice =
  /** O slot exatamente como está na build original (item, cartas, encantamentos, refino, grau, opções). */
  | { kind: 'original' }
  | { kind: 'empty' }
  /** Item novo; refino/grau explícitos (`refineDomain: 'all'`) ou os de `placement`. */
  | { kind: 'item'; id: number; refine?: number; grade?: Grade };
export type FieldChoice = { kind: 'field'; id: number | undefined };
export type RoChoice = SlotChoice | FieldChoice;

interface PendingField { slot: OptimizableSlot; field: ItemTypeEnum; ids: number[]; enchant: boolean }

export interface RoState {
  model: MainModel;
  remaining: OptimizableSlot[];
  pending: PendingField[];
  decided: OptimizableSlot[];
}

export interface RoProblemOptions {
  objective?: DamageObjective;
  constraints?: TimingConstraints;
  /** Slots livres. Padrão: equipamentos + encantamentos de visual. */
  slots?: OptimizableSlot[];
  lockedSlots?: OptimizableSlot[];
  catalog?: CatalogOptions;
  placement?: PlacementOptions;
  optimizeCards?: boolean;
  optimizeEnchants?: boolean;
  keepWeaponType?: boolean;
  unknownEnchantRepeats?: 'allow' | 'forbid';
  /** `limit` (padrão): itens novos no refino/grau de `placement`. `all`: todos os níveis até ele. */
  refineDomain?: 'limit' | 'all';
  /** `mrv` (padrão): primeiro o slot com menos opções. `fixed`: a ordem de `EQUIPMENT_SLOT_KEYS`. */
  slotOrder?: 'mrv' | 'fixed';
  /** Build usada só para ordenar (as escolhas dela vêm primeiro). Padrão: a original. */
  seed?: MainModel;
  /** Ordenar candidatos pela troca única na build-semente (custa ~1 avaliação por item). Padrão: true. */
  screen?: boolean;
}

const REFINE_CAP: Record<string, number> = { equip: 18, shadow: 10, accessory: 18 };
const GRADES: Grade[] = ['', 'D', 'C', 'B', 'A'];
const get = (model: MainModel, key: string) => (model as Record<string, any>)[key];

export const scoreCompare = (a: Score, b: Score) => (isBetter(a, b) ? 1 : isBetter(b, a) ? -1 : 0);

/** Campos do modelo que pertencem ao item do slot. */
function slotFields(slot: OptimizableSlot): string[] {
  return [slot, ...(MainItemWithRelations[slot as ItemTypeEnum] ?? []), `${slot}Refine`, `${slot}Grade`];
}

export class RoBuildProblem implements SearchProblem<RoState, RoChoice, Score> {
  readonly free: OptimizableSlot[];
  readonly catalog: SlotCatalog;
  readonly cardCatalog: CardCatalog;
  private readonly enchantMap: Map<string, ItemModel>;
  readonly probe: WeaponRulesProbe;
  private readonly weaponAllowed: (id: number) => boolean;
  private readonly locked: OptimizableSlot[];
  readonly base: MainModel;
  readonly seed: MainModel;
  private readonly itemRank = new Map<OptimizableSlot, Map<number, number>>();
  private readonly cardRank = new Map<OptimizableSlot, Map<number, number>>();
  evaluations = 0;
  screenEvaluations = 0;

  constructor(
    private readonly evaluator: BuildEvaluator,
    private readonly context: EvaluationContext,
    readonly original: MainModel,
    readonly options: RoProblemOptions = {},
  ) {
    const character: CharacterBase = context.character;
    const items = context.items;
    this.locked = options.lockedSlots ?? [];
    const locked = new Set(this.locked);
    this.free = (options.slots ?? [...EQUIPMENT_SLOT_KEYS, ...COSTUME_ENCHANT_SLOT_KEYS]).filter((slot) => !locked.has(slot));
    this.catalog = buildCatalog(items, character, { maxRequiredLevel: original.level, ...options.catalog });
    this.cardCatalog = options.optimizeCards === false ? {} : buildCardCatalog(items, options.catalog);
    this.enchantMap = buildEnchantMap(items);
    this.probe = new WeaponRulesProbe(items, character);
    this.seed = options.seed ?? original;

    // Mesma regra de armas da busca heurística (items.ts).
    const skillName = (original.selectedAtkSkill ?? '').split('==')[0];
    const skill = (character.getAtkSkills(original.skillFormulaVersion) as any[]).find((entry) => entry.name === skillName);
    const verify = skill?.verifyItemFn as ((input: any) => string) | undefined;
    const subType = original.weapon ? items[original.weapon]?.itemSubTypeId : undefined;
    if (typeof verify === 'function') this.weaponAllowed = (id) => this.probe.accepts(id, verify, original);
    else if (options.keepWeaponType !== false && subType != null) this.weaponAllowed = (id) => items[id]?.itemSubTypeId === subType;
    else this.weaponAllowed = () => true;

    // Ponto de partida: a build com os slots livres vazios (travados ficam como estão).
    const base = { ...original, rawOptionTxts: Array.isArray(original.rawOptionTxts) ? [...original.rawOptionTxts] : original.rawOptionTxts } as MainModel;
    for (const slot of this.free) clearSlot(base, slot as ItemTypeEnum);
    this.base = base;

    if (options.screen !== false) this.screen();
  }

  // ---------------------------------------------------------------- ordem heurística

  private scoreModel(model: MainModel): Score {
    return scoreOf(this.evaluator.evaluate(model), this.options.objective ?? 'avg', this.options.constraints);
  }

  /** Ranking por troca única na build-semente: só ordena, nunca remove. */
  private screen() {
    const byScore = (a: { score: Score }, b: { score: Score }) => -scoreCompare(a.score, b.score);
    for (const slot of this.free) {
      const scored = (this.catalog[slot] ?? []).map((id) => {
        const model = placeItem(this.seed, slot, id, this.context.items, this.probe, this.options.placement);
        this.screenEvaluations++;
        return { id, score: this.scoreModel(model) };
      });
      this.itemRank.set(slot, new Map(scored.sort(byScore).map((entry, index) => [entry.id, index])));
      const cards = this.cardCatalog[slot] ?? [];
      const field = (MainItemWithRelations[slot as ItemTypeEnum] ?? []).find((key) => /Card\d?$/.test(key));
      if (cards.length && field && get(this.seed, slot)) {
        const rankedCards = cards.map((id) => {
          this.screenEvaluations++;
          return { id, score: this.scoreModel({ ...this.seed, [field]: id } as MainModel) };
        });
        this.cardRank.set(slot, new Map(rankedCards.sort(byScore).map((entry, index) => [entry.id, index])));
      }
    }
  }

  private orderBy<T>(list: T[], rank: (value: T) => number): T[] {
    return list.map((value, index) => ({ value, index, rank: rank(value) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.value);
  }

  // ---------------------------------------------------------------- domínios

  /** Itens compatíveis com o slot no estado atual (escudo e munição dependem da arma escolhida). */
  candidateItems(model: MainModel, slot: OptimizableSlot): number[] {
    const items = this.context.items;
    if (slot === ItemTypeEnum.ammo) {
      const rules = this.probe.rules(model.weapon);
      if (!rules.allowAmmo) return [];
      return (this.catalog[slot] ?? []).filter((id) => items[id]?.itemSubTypeId === rules.ammoSubTypeId);
    }
    if (slot === ItemTypeEnum.shield && (model.leftWeapon || !this.probe.rules(model.weapon).allowShield)) return [];
    if (slot === ItemTypeEnum.weapon) return (this.catalog[slot] ?? []).filter(this.weaponAllowed);
    return this.catalog[slot] ?? [];
  }

  private refineVariants(slot: OptimizableSlot, id: number): SlotChoice[] {
    if (this.options.refineDomain !== 'all') return [{ kind: 'item', id }];
    const item = this.context.items[id];
    const descriptor = SLOTS_BY_KEY.get(slot);
    const rule = descriptor?.refine ?? 'none';
    const refinable = rule !== 'none' && (rule !== 'accessory' || !!item?.isRefinable);
    const limit = Math.min(REFINE_CAP[rule] ?? 0, this.options.placement?.defaultRefine?.[rule as 'equip'] ?? REFINE_CAP[rule] ?? 0);
    const refines = refinable ? Array.from({ length: Math.max(0, limit) + 1 }, (_, level) => level) : [0];
    const gradeable = !!descriptor?.grade && !!item && (item.canGrade || canGradeItem(item));
    const maxGrade = GRADES.indexOf(this.options.placement?.defaultGrade ?? 'A');
    const grades: Grade[] = gradeable ? GRADES.slice(0, Math.max(0, maxGrade) + 1) : [''];
    return refines.flatMap((refine) => grades.map((grade) => ({ kind: 'item' as const, id, refine, grade })));
  }

  slotChoices(model: MainModel, slot: OptimizableSlot): SlotChoice[] {
    const originalId = get(this.original, slot) as number | undefined;
    const ids = this.candidateItems(model, slot);
    const rank = this.itemRank.get(slot);
    const ordered = rank ? this.orderBy(ids, (id) => rank.get(id) ?? Infinity) : ids;
    const choices: SlotChoice[] = [];
    if (originalId) {
      choices.push({ kind: 'original' });
      // O item original com o refino/grau dele, mas cartas e encantamentos livres.
      choices.push({ kind: 'item', id: originalId, refine: Number(get(this.original, `${slot}Refine`)) || 0, grade: (get(this.original, `${slot}Grade`) ?? '') as Grade });
    }
    choices.push({ kind: 'empty' });
    for (const id of ordered) choices.push(...this.refineVariants(slot, id));
    return this.seedFirst(choices, slot);
  }

  /** A escolha da build-semente vai para a frente (o primeiro caminho do DFS reproduz a semente). */
  private seedFirst(choices: SlotChoice[], slot: OptimizableSlot): SlotChoice[] {
    const seedId = get(this.seed, slot) as number | undefined;
    const sameAsOriginal = slotFields(slot).every((key) => (get(this.seed, key) ?? undefined) === (get(this.original, key) ?? undefined));
    const seedRefine = Number(get(this.seed, `${slot}Refine`)) || 0;
    const seedGrade = (get(this.seed, `${slot}Grade`) ?? '') as Grade;
    const matches = (choice: SlotChoice) => {
      if (!seedId) return choice.kind === 'empty';
      if (sameAsOriginal) return choice.kind === 'original';
      return choice.kind === 'item' && choice.id === seedId && (choice.refine === undefined || (choice.refine === seedRefine && (choice.grade ?? '') === seedGrade));
    };
    const index = choices.findIndex(matches);
    if (index <= 0) return choices;
    return [choices[index], ...choices.slice(0, index), ...choices.slice(index + 1)];
  }

  private fieldChoices(state: RoState, pending: PendingField): FieldChoice[] {
    const rank = pending.enchant ? undefined : this.cardRank.get(pending.slot);
    const ordered = rank ? this.orderBy(pending.ids, (id) => rank.get(id) ?? Infinity) : pending.ids;
    const choices: FieldChoice[] = [{ kind: 'field', id: undefined }, ...ordered.map((id) => ({ kind: 'field' as const, id }))];
    const seedValue = get(this.seed, pending.field) as number | undefined;
    if (seedValue && get(this.seed, pending.slot) === get(state.model, pending.slot)) {
      const index = choices.findIndex((choice) => choice.id === seedValue);
      if (index > 0) return [choices[index], ...choices.slice(0, index), ...choices.slice(index + 1)];
    }
    return choices;
  }

  // ---------------------------------------------------------------- SearchProblem

  root(): RoState {
    return { model: this.base, remaining: [...this.free], pending: [], decided: [] };
  }

  isComplete(state: RoState) {
    return !state.remaining.length && !state.pending.length;
  }

  /** Slots prontos para decidir: munição e escudo só depois da arma (o domínio deles depende dela). */
  private ready(state: RoState): OptimizableSlot[] {
    const weaponPending = state.remaining.includes(ItemTypeEnum.weapon);
    return state.remaining.filter((slot) => !(weaponPending && (slot === ItemTypeEnum.ammo || slot === ItemTypeEnum.shield)));
  }

  nextDecision(state: RoState): Decision<RoChoice> {
    if (state.pending.length) {
      const pending = state.pending[0];
      return { key: pending.field, choices: this.fieldChoices(state, pending) };
    }
    const ready = this.ready(state);
    if (this.options.slotOrder === 'fixed') {
      const slot = ready[0];
      return { key: slot, choices: this.slotChoices(state.model, slot) };
    }
    // MRV: o slot com menos opções primeiro (empate: ordem do plano). Os maiores ficam mais
    // fundo, e o DFS varia primeiro o que fica mais fundo.
    let best: { slot: OptimizableSlot; choices: SlotChoice[] } | undefined;
    for (const slot of ready) {
      const choices = this.slotChoices(state.model, slot);
      if (!best || choices.length < best.choices.length) best = { slot, choices };
    }
    return { key: best!.slot, choices: best!.choices };
  }

  apply(state: RoState, decision: Decision<RoChoice>, choice: RoChoice): { state: RoState } | { pruned: string } {
    if (choice.kind === 'field') return this.applyField(state, choice);
    const slot = decision.key as OptimizableSlot;
    const items = this.context.items;
    let model: MainModel;
    if (choice.kind === 'empty') {
      model = placeItem(state.model, slot, undefined, items, this.probe);
    } else if (choice.kind === 'original') {
      model = placeItem(state.model, slot, get(this.original, slot), items, this.probe);
      const target = model as Record<string, any>;
      for (const key of slotFields(slot)) target[key] = get(this.original, key);
      const indexes = SLOTS_BY_KEY.get(slot)?.optionIndexes ?? [];
      if (indexes.length && Array.isArray(this.original.rawOptionTxts)) {
        model.rawOptionTxts = [...(Array.isArray(model.rawOptionTxts) ? model.rawOptionTxts : [])];
        for (const index of indexes) model.rawOptionTxts[index] = this.original.rawOptionTxts[index];
      }
    } else {
      const placement: PlacementOptions = choice.refine === undefined
        ? this.options.placement ?? {}
        : { refine: { [slot]: choice.refine }, defaultGrade: choice.grade ?? '' };
      model = placeItem(state.model, slot, choice.id, items, this.probe, placement);
    }

    // Efeito colateral num slot já decidido ou travado: a build pedida não existe.
    for (const other of [...state.decided, ...this.locked]) {
      if (other !== slot && get(model, other) !== get(state.model, other)) return { pruned: 'conflict' };
    }

    const pending: PendingField[] = [];
    if (choice.kind === 'item') {
      const { cardFields, enchants } = attachmentsFor(model, slot, items, this.enchantMap, this.options.catalog);
      if (this.options.optimizeCards !== false) {
        for (const field of cardFields) pending.push({ slot, field, ids: this.cardCatalog[slot] ?? [], enchant: false });
      }
      if (this.options.optimizeEnchants !== false) {
        for (const { field, ids } of enchants) pending.push({ slot, field, ids, enchant: true });
      }
    }
    return {
      state: {
        model,
        remaining: state.remaining.filter((other) => other !== slot),
        pending,
        decided: [...state.decided, slot],
      },
    };
  }

  private applyField(state: RoState, choice: FieldChoice): { state: RoState } | { pruned: string } {
    const [pending, ...rest] = state.pending;
    if (choice.id !== undefined && pending.enchant) {
      if (!canPlaceEnchant(state.model, pending.slot, pending.field, choice.id)) return { pruned: 'enchantLimit' };
      if (this.options.unknownEnchantRepeats === 'forbid' && !enchantRulesFor(get(state.model, pending.slot)).length
        && [...enchantsOf(state.model, pending.slot)].some(([other, value]) => other !== pending.field && value === choice.id)) {
        return { pruned: 'enchantLimit' };
      }
    }
    const model = choice.id === undefined ? state.model : ({ ...state.model, [pending.field]: choice.id } as MainModel);
    return { state: { ...state, model, pending: rest } };
  }

  evaluate(state: RoState): Score {
    this.evaluations++;
    return this.scoreModel(state.model);
  }

  compare = scoreCompare;

  keyOf(state: RoState) {
    return stableKey(state.model);
  }

  // ---------------------------------------------------------------- informações

  /**
   * Tamanho aproximado do espaço (log10), sem as podas: produto, por slot livre, de
   * Σ_item (variantes de refino/grau × Π (opções de cada carta/encantamento + vazio)).
   * Escudo e munição usam a arma original.
   */
  estimateSpaceLog10(): number {
    let total = 0;
    for (const slot of this.free) {
      let count = 0;
      for (const choice of this.slotChoices(this.original, slot)) {
        if (choice.kind !== 'item') { count++; continue; }
        const model = placeItem(this.base, slot, choice.id, this.context.items, this.probe, this.options.placement);
        const { cardFields, enchants } = attachmentsFor(model, slot, this.context.items, this.enchantMap, this.options.catalog);
        let combos = 1;
        if (this.options.optimizeCards !== false) for (const _ of cardFields) combos *= (this.cardCatalog[slot]?.length ?? 0) + 1;
        if (this.options.optimizeEnchants !== false) for (const { ids } of enchants) combos *= ids.length + 1;
        count += combos;
      }
      total += Math.log10(Math.max(1, count));
    }
    return total;
  }
}

/** FNV-1a de 32 bits em hexadecimal. */
export function hashString(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

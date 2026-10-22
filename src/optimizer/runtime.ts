/**
 * Fase 5: ponte entre o app e o otimizador, sem tocar no código do upstream.
 *
 * - Entrada: a build que o próprio app salva (`localStorage['ro-set']`, o mesmo preset do
 *   autosave) e o monstro selecionado (`localStorage['monster']`).
 * - Dados: os mesmos artefatos que o app baixa (`assets/data-manifest.json` → itens já
 *   mesclados com o LATAM, monstros, HP/SP), via `manifestPath`.
 * - Saída: links `/s/<token>/` gerados com `encodeBuild` (o codec de compartilhamento do app).
 *   Abrir o link carrega a build otimizada, ou a atual com a otimizada na coluna de comparação.
 *
 * Sem DOM: roda no Web Worker e nos testes.
 */

import { AllowedCompareItemTypes } from 'src/app/app-config/allowed-compare-item-types';
import { withBetelgeuseHp } from 'src/app/constants/betelgeuse-hp';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { DataManifest, manifestPath } from 'src/app/core/data-manifest';
import { normalizeSavedModel } from 'src/app/core/saved-model';
import { encodeBuild } from 'src/app/core/share-codec';
import { buildSharePath } from 'src/app/core/share-path';
import { CLASS_CTOR_BY_ID } from 'src/app/jobs/_class-list';
import { ClassNamePtBr } from 'src/app/jobs/_class-name';
import { HpSpTable } from 'src/app/models/hp-sp-table.model';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { MonsterModel } from 'src/app/models/monster.model';
import { resolveSkillMeta } from 'src/app/skills';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ALL_OPTIMIZABLE_SLOTS, COSTUME_ENCHANT_HOST, Grade, OptimizableSlot, raiseToLimits } from './candidates';
import { findMvpCards } from './mvp-cards';
import { BuildEvaluator, BuildMetrics, EvaluationContext } from './evaluate';
import { BuildOptions, BuildProgress, BuildResult, optimizeBuild } from './items';
import { checkConstraints, ConstraintCheck, DamageObjective, scoreOf, TimingConstraints } from './objective';
import { StatKey } from './stats';
import { SearchStats, SearchStatus } from './exact/engine';
import { ExactCheckpoint, ExactProgress, optimizeExact } from './exact/optimize';

export interface OptimizerData {
  items: Record<number, ItemModel>;
  monsters: Record<number, MonsterModel>;
  hpSpTable: HpSpTable;
}

/** Baixa os mesmos arquivos que o app (`root` = raiz do site, com barra no fim). */
export async function loadOptimizerData(fetcher: typeof fetch = fetch, root = '/'): Promise<OptimizerData> {
  const json = async <T>(path: string): Promise<T> => {
    const response = await fetcher(`${root}${path.replace(/^\//, '')}`);
    if (!response.ok) throw new Error(`Falha ao baixar ${path}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  const manifest = await json<DataManifest>('assets/data-manifest.json');
  const [items, monsters, hpSpTable] = await Promise.all([
    json<Record<number, ItemModel>>(manifestPath(manifest, 'itemsCore')),
    json<Record<number, MonsterModel>>(manifestPath(manifest, 'monsters')),
    json<HpSpTable>(manifestPath(manifest, 'hpsp')),
  ]);
  return { items, monsters, hpSpTable };
}

/** O que o painel manda: a build do app, o alvo e as escolhas do usuário. */
export interface OptimizeRequest {
  /** O preset salvo pelo app (`JSON.parse(localStorage['ro-set'])`). */
  preset: Record<string, any>;
  monsterId: number;
  betelgeuseHp?: number;
  /** `"Nome==nível"`; padrão: a skill selecionada na build. */
  skillValue?: string;
  objective?: DamageObjective;
  constraints?: TimingConstraints;
  slots?: OptimizableSlot[];
  lockedSlots?: OptimizableSlot[];
  lockedStats?: StatKey[];
  minimumStats?: Partial<Record<StatKey, number>>;
  optimizeStats?: boolean;
  optimizeCards?: boolean;
  optimizeEnchants?: boolean;
  optimizeSets?: boolean;
  keepWeaponType?: boolean;
  unknownEnchantRepeats?: 'allow' | 'forbid';
  includeCostumes?: boolean;
  /** Permitir que a busca coloque cartas de MVP. Padrão: true. As que já estão na build ficam. */
  allowMvpCards?: boolean;
  /** Permitir itens divinos (Megingjard, Brisingamen, Sleipnir, Mjolnir). Padrão: false. */
  allowGodlyItems?: boolean;
  /** Refino máximo dos itens que a busca colocar (ver `PlacementOptions.defaultRefine`). */
  defaultRefine?: { equip?: number; shadow?: number; accessory?: number };
  /** Grau máximo dos itens que a busca colocar (`''` = sem grau). */
  defaultGrade?: Grade;
  /**
   * Levar também os itens que já estão na build ao refino/grau máximos (nunca baixa). Assim um
   * item atual +7 não perde para um novo a +15 só pelo refino. Aparece nas mudanças.
   */
  applyLimitsToCurrent?: boolean;
  /** Inventário: só estes ids (itens, cartas e encantamentos). Vazio/ausente = todos. */
  allowedItemIds?: number[];
  excludedItemIds?: number[];
  timeLimitMs?: number;
  /** `heuristic` (padrão): rápido, sem garantia. `exact`: busca exata (DFS) com prova de otimalidade. */
  mode?: 'heuristic' | 'exact';
  exact?: ExactRequestOptions;
}

/** Opções do modo exato (ver `exact/optimize.ts`). Os atributos ficam fixos. */
export interface ExactRequestOptions {
  /** Devolver todas as builds empatadas no ótimo. */
  allTies?: boolean;
  /** `limit` (padrão): refino/grau máximos dos Limites. `all`: todos os níveis até eles. */
  refineDomain?: 'limit' | 'all';
  /** Tempo da busca heurística que gera a build inicial (ms). Padrão: 15 s. */
  seedTimeMs?: number;
  /** Tempo máximo do DFS (ms). Ausente = sem limite (até concluir ou parar). */
  timeLimitMs?: number;
  /** Ajustar atributos na build final (heurístico, sem garantia, mostrado à parte). */
  postOptimizeStats?: boolean;
  /** Checkpoint de uma execução interrompida. */
  resume?: ExactCheckpoint;
}

export interface ExactSummary {
  status: SearchStatus;
  stats: SearchStats;
  spaceLog10: number;
  /** Quantas builds empatadas no ótimo (modo "todas as empatadas"). */
  ties: number;
  seedDamage: number;
  signature: string;
  checkpoint?: ExactCheckpoint;
  error?: string;
  statsAdjusted?: { damage: number; changes: NamedChange[]; applyPath: string; comparePath: string };
}

export interface SkillOption { value: string; label: string }

export interface PreparedSession {
  model: MainModel;
  context: EvaluationContext;
  className: string;
  monsterName: string;
  skills: SkillOption[];
  skillValue: string;
  /** Sugestões para o painel, tiradas da build atual: maior refino e grau já usados. */
  defaults: { equipRefine: number; shadowRefine: number; grade: Grade };
}

const GRADE_ORDER: Grade[] = ['', 'D', 'C', 'B', 'A'];

/** Maior refino por tipo de slot e maior grau usados na build — ponto de partida do painel. */
export function buildDefaults(model: MainModel): PreparedSession['defaults'] {
  const target = model as Record<string, any>;
  let equipRefine = 0;
  let shadowRefine = 0;
  let grade: Grade = '';
  for (const [slot, descriptor] of SLOTS_BY_KEY) {
    if (!target[slot]) continue;
    const refine = Number(target[`${slot}Refine`]) || 0;
    if (descriptor.refine === 'equip') equipRefine = Math.max(equipRefine, refine);
    if (descriptor.refine === 'shadow') shadowRefine = Math.max(shadowRefine, refine);
    const slotGrade = target[`${slot}Grade`] as Grade;
    if (GRADE_ORDER.indexOf(slotGrade) > GRADE_ORDER.indexOf(grade)) grade = slotGrade;
  }
  return { equipRefine, shadowRefine, grade };
}

const mvpCache = new WeakMap<object, Set<number>>();
/** Cartas de MVP da base (calculado uma vez por conjunto de dados). */
export function mvpCardsOf(data: OptimizerData): Set<number> {
  let ids = mvpCache.get(data.items);
  if (!ids) {
    ids = findMvpCards(data.items, data.monsters);
    mvpCache.set(data.items, ids);
  }
  return ids;
}

/** Skills de ataque da classe, com os rótulos em pt-BR que a tela usa. */
export function attackSkills(character: EvaluationContext['character'], model: MainModel): SkillOption[] {
  const label = (name: string, fallback: string) => resolveSkillMeta(name)?.label ?? fallback;
  const options: SkillOption[] = [];
  for (const skill of character.getAtkSkills(model.skillFormulaVersion) as any[]) {
    if (skill.preview) continue;
    const base = label(skill.name, skill.label ?? skill.name);
    if (Array.isArray(skill.levelList) && skill.levelList.length) {
      for (const entry of skill.levelList) {
        const entryLabel = String(entry.label ?? entry.value);
        // As entradas vêm como "Nome Lv1" ou só "Nv 1": sempre mostra o nome da skill.
        const text = entryLabel.startsWith(skill.name) ? base + entryLabel.slice(skill.name.length)
          : entryLabel.startsWith(base) ? entryLabel : `${base} — ${entryLabel}`;
        options.push({ value: entry.value, label: text });
      }
    } else if (skill.value) {
      options.push({ value: skill.value, label: base });
    }
  }
  return options;
}

/** Monta modelo e contexto a partir do preset do app. */
export function prepareSession(data: OptimizerData, request: Pick<OptimizeRequest, 'preset' | 'monsterId' | 'betelgeuseHp' | 'skillValue'>): PreparedSession {
  const customItems: ItemModel[] = Array.isArray(request.preset?.['__customItems']) ? request.preset['__customItems'] : [];
  const items = customItems.length ? { ...data.items, ...Object.fromEntries(customItems.map((item) => [item.id, item])) } : data.items;
  const model = normalizeSavedModel(request.preset);
  const Ctor = CLASS_CTOR_BY_ID[Number(model.class)];
  if (!Ctor) throw new Error(`Classe ${model.class} desconhecida.`);
  const character = new Ctor();
  const rawMonster = data.monsters[request.monsterId];
  if (!rawMonster) throw new Error(`Monstro ${request.monsterId} não encontrado.`);
  const monster = withBetelgeuseHp(rawMonster, request.betelgeuseHp ?? 0);
  const skills = attackSkills(character, model);
  const skillValue = request.skillValue || model.selectedAtkSkill || skills[0]?.value || '';
  if (skillValue !== model.selectedAtkSkill) {
    // `selectedAtkSkill` espelha o primeiro item da rotação (ver MainModel): trocar a skill
    // sem trocar a rotação faria o app voltar para a antiga ao abrir o link.
    model.selectedAtkSkill = skillValue;
    model.rotation = [skillValue];
    model.rotationStacks = [];
  }

  return {
    model,
    context: { items, hpSpTable: data.hpSpTable, character, monster, selectedChances: [] },
    className: (ClassNamePtBr as Record<number, string>)[Number(model.class)] ?? character.className,
    monsterName: rawMonster.name,
    skills,
    skillValue,
    defaults: buildDefaults(model),
  };
}

/** Mudança pronta para exibir (com nomes). */
export interface NamedChange {
  group: 'item' | 'attachment' | 'stat';
  label: string;
  from: string;
  to: string;
}

export interface OptimizeResponse {
  skillValue: string;
  before: BuildMetrics;
  after: BuildMetrics;
  damageBefore: number;
  damageAfter: number;
  feasible: boolean;
  constraints: ConstraintCheck[];
  constraintsBefore: ConstraintCheck[];
  changes: NamedChange[];
  warnings: string[];
  sets: string[];
  evaluations: number;
  elapsedMs: number;
  truncated: boolean;
  /** Abre a build otimizada no simulador. */
  applyPath: string;
  /** Abre a build atual com a otimizada na coluna de comparação (slots comparáveis + atributos). */
  comparePath: string;
  /** Slots alterados que a comparação do simulador não mostra (ex.: sombrios). */
  notCompared: string[];
  /** Só no modo exato. */
  exact?: ExactSummary;
}

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Arma', ammo: 'Munição', shield: 'Escudo', headUpper: 'Topo', headMiddle: 'Meio', headLower: 'Baixo',
  armor: 'Armadura', garment: 'Capa', boot: 'Sapatos', accLeft: 'Acessório (E)', accRight: 'Acessório (D)', pet: 'Mascote',
  shadowWeapon: 'Arma sombria', shadowArmor: 'Armadura sombria', shadowShield: 'Escudo sombrio', shadowBoot: 'Sapatos sombrios',
  shadowEarring: 'Brinco sombrio', shadowPendant: 'Colar sombrio', costumeUpper: 'Visual topo', costumeMiddle: 'Visual meio',
  costumeLower: 'Visual baixo', costumeGarment: 'Visual capa',
  costumeEnchantUpper: 'Encant. visual topo', costumeEnchantMiddle: 'Encant. visual meio', costumeEnchantLower: 'Encant. visual baixo',
  costumeEnchantGarment: 'Encant. visual capa 1', costumeEnchantGarment2: 'Encant. visual capa 2', costumeEnchantGarment4: 'Encant. visual capa 4',
};
const STAT_LABELS: Record<string, string> = {
  str: 'FOR', agi: 'AGI', vit: 'VIT', int: 'INT', dex: 'DES', luk: 'SOR', pow: 'POT', sta: 'VIG', wis: 'SAB', spl: 'FEI', con: 'CON', crt: 'CRI',
};

const fieldLabel = (slot: string, field: string) => {
  const card = field.match(/Card(\d)?$/);
  if (card) return `${SLOT_LABELS[slot] ?? slot} · carta${card[1] ? ` ${card[1]}` : ''}`;
  const enchant = field.match(/Enchant(\d)$/);
  if (enchant) return `${SLOT_LABELS[slot] ?? slot} · encantamento ${Number(enchant[1]) + 1}`;
  return field;
};

/** Links do simulador para aplicar ou comparar. */
export function buildLinks(original: MainModel, optimized: MainModel, result: Pick<BuildResult, 'itemChanges' | 'attachmentChanges'>) {
  const changedSlots = new Set<string>([...result.itemChanges.map((c) => c.slot), ...result.attachmentChanges.map((c) => c.slot)]);
  const comparable = new Set<string>(AllowedCompareItemTypes as readonly string[]);
  const itemNames = [...changedSlots].filter((slot) => comparable.has(slot));
  const notCompared = [...changedSlots].filter((slot) => !comparable.has(slot) && slot !== ItemTypeEnum.ammo);
  return {
    applyPath: buildSharePath(encodeBuild(optimized as Record<string, any>)),
    comparePath: buildSharePath(encodeBuild(original as Record<string, any>, { itemNames, model2: optimized as Record<string, any>, stats: true })),
    notCompared: notCompared.map((slot) => SLOT_LABELS[slot] ?? slot),
  };
}

/** Opções, avaliador e build de partida a partir do pedido do painel (comum aos dois modos). */
function prepareRun(data: OptimizerData, request: OptimizeRequest, onProgress?: (progress: BuildProgress) => void) {
  const session = prepareSession(data, request);
  const { context, model } = session;
  const items = context.items;
  const allowed = request.allowedItemIds?.length ? new Set(request.allowedItemIds) : undefined;
  const mvpCards = mvpCardsOf(data);
  const excludedIds = [...(request.excludedItemIds ?? []), ...(request.allowMvpCards === false ? mvpCards : [])];
  const excluded = excludedIds.length ? new Set(excludedIds) : undefined;
  const options: BuildOptions = {
    objective: request.objective ?? 'dps',
    constraints: request.constraints,
    slots: request.slots,
    lockedSlots: request.lockedSlots,
    lockedStats: request.lockedStats,
    minimumStats: request.minimumStats,
    optimizeStats: request.optimizeStats,
    optimizeCards: request.optimizeCards,
    optimizeEnchants: request.optimizeEnchants,
    optimizeSets: request.optimizeSets,
    keepWeaponType: request.keepWeaponType,
    unknownEnchantRepeats: request.unknownEnchantRepeats,
    includeCostumes: request.includeCostumes,
    timeLimitMs: request.timeLimitMs,
    placement: { defaultRefine: request.defaultRefine, defaultGrade: request.defaultGrade },
    // O app já entrega só os campos que usa; `requiredLevel` não vem em items-core.
    catalog: { allowedItemIds: allowed, excludedItemIds: excluded, allowGodlyItems: request.allowGodlyItems },
    onProgress,
  };
  const evaluator = new BuildEvaluator(context);
  const placement = options.placement!;
  const locked = new Set(request.lockedSlots ?? []);
  const start = request.applyLimitsToCurrent ? raiseToLimits(model, items, ALL_OPTIMIZABLE_SLOTS.filter((slot) => !locked.has(slot)), placement) : model;
  return { session, options, evaluator, start, mvpCards };
}

type PreparedRun = ReturnType<typeof prepareRun>;

/** O que `respond` precisa de um resultado (heurístico ou exato). */
type ResultLike = Pick<BuildResult, 'model' | 'metrics' | 'damage' | 'feasible' | 'constraints' | 'itemChanges' | 'attachmentChanges'
  | 'statChanges' | 'warnings' | 'setsApplied' | 'evaluations' | 'elapsedMs' | 'truncated'>;

/** Roda a otimização heurística e devolve tudo pronto para o painel. */
export function runOptimization(data: OptimizerData, request: OptimizeRequest, onProgress?: (progress: BuildProgress) => void): OptimizeResponse {
  const prepared = prepareRun(data, request, onProgress);
  return respond(prepared, optimizeBuild(prepared.evaluator, prepared.session.context, prepared.start, prepared.options));
}

function respond({ session, options, evaluator, mvpCards }: PreparedRun, result: ResultLike): OptimizeResponse {
  const { context, model } = session;
  const items = context.items;
  const ALL = ALL_OPTIMIZABLE_SLOTS;
  // "Antes" é sempre a build real do usuário, mesmo quando a busca partiu dela com refino/grau elevados.
  const before = evaluator.evaluate(model);
  const scoreBefore = scoreOf(before, options.objective ?? 'dps', options.constraints);

  const name = (id: number | undefined) => (id ? `${items[id]?.name ?? `#${id}`}${mvpCards.has(id) ? ' (MVP)' : ''}` : '—');
  const refineOf = (slot: string) => {
    const target = result.model as Record<string, any>;
    const refine = Number(target[`${slot}Refine`]) || 0;
    const grade = target[`${slot}Grade`];
    return `${refine ? ` +${refine}` : ''}${grade ? ` (Grau ${grade})` : ''}`;
  };
  /** Dois itens diferentes com o mesmo nome em pt-BR (ex.: com e sem encaixe) ganham o nº de encaixes. */
  const pair = (from: number | undefined, to: number | undefined) => {
    let [a, b] = [name(from), name(to)];
    if (from && to && from !== to && a === b) {
      a = `${a} [${items[from]?.slots ?? 0}]`;
      b = `${b} [${items[to]?.slots ?? 0}]`;
    }
    return { from: a, to: b };
  };
  const changes: NamedChange[] = [
    ...result.itemChanges.map((c) => {
      const names = pair(c.from, c.to);
      return { group: 'item' as const, label: SLOT_LABELS[c.slot] ?? c.slot, from: names.from, to: c.to ? names.to + refineOf(c.slot) : names.to };
    }),
    ...result.attachmentChanges.map((c) => ({ group: 'attachment' as const, label: fieldLabel(c.slot, c.field), ...pair(c.from, c.to) })),
    ...result.statChanges.map((c) => ({ group: 'stat' as const, label: STAT_LABELS[c.key] ?? c.key, from: String(c.from), to: String(c.to) })),
  ];
  // Mesmo item, refino/grau diferentes (itens atuais levados ao máximo).
  const levelChanged: OptimizableSlot[] = [];
  const levelOf = (target: Record<string, any>, slot: string) =>
    `${Number(target[`${slot}Refine`]) || 0 ? `+${Number(target[`${slot}Refine`])}` : '+0'}${target[`${slot}Grade`] ? ` (Grau ${target[`${slot}Grade`]})` : ''}`;
  for (const slot of ALL) {
    const original = model as Record<string, any>;
    const final = result.model as Record<string, any>;
    if (!final[slot] || original[slot] !== final[slot]) continue;
    const from = levelOf(original, slot);
    const to = levelOf(final, slot);
    if (from !== to) {
      levelChanged.push(slot);
      changes.push({ group: 'item', label: `${SLOT_LABELS[slot] ?? slot} · ${name(final[slot])}`, from, to });
    }
  }

  return {
    skillValue: session.skillValue,
    before,
    after: result.metrics,
    damageBefore: scoreBefore.damage,
    damageAfter: result.damage,
    feasible: result.feasible,
    constraints: result.constraints,
    constraintsBefore: checkConstraints(before, options.constraints),
    changes,
    warnings: [
      ...result.warnings.map((warning) => warning.message),
      // O simulador aplica o encantamento de visual mesmo sem o visual; no jogo, ele precisa de um.
      ...Object.entries(COSTUME_ENCHANT_HOST)
        .filter(([enchantSlot, host]) => (result.model as Record<string, any>)[enchantSlot] && !(result.model as Record<string, any>)[host])
        .map(([enchantSlot, host]) => `${SLOT_LABELS[enchantSlot]}: precisa de um visual em "${SLOT_LABELS[host]}" no jogo (qualquer visual serve).`),
    ],
    // Só os conjuntos que continuam completos na build final (a busca pode ter trocado peças depois).
    sets: result.setsApplied
      .filter((move) => move.pieces.every((piece) => (result.model as Record<string, any>)[piece.slot] === piece.id))
      .map((move) => move.pieces.map((piece) => name(piece.id)).join(' + ')),
    evaluations: result.evaluations,
    elapsedMs: result.elapsedMs,
    truncated: result.truncated,
    ...buildLinks(model, result.model, {
      itemChanges: [...result.itemChanges, ...levelChanged.map((slot) => ({ slot, from: undefined, to: undefined }))],
      attachmentChanges: result.attachmentChanges,
    }),
  };
}

export interface ExactHooks {
  onProgress?: (progress: ExactProgress) => void;
  onCheckpoint?: (checkpoint: ExactCheckpoint) => void;
  shouldStop?: () => boolean;
}

/** Modo exato: DFS completo com a build heurística como ponto de partida (só ordem). */
export async function runExactOptimization(data: OptimizerData, request: OptimizeRequest, hooks: ExactHooks = {}): Promise<OptimizeResponse> {
  const prepared = prepareRun(data, request);
  const { session, options, evaluator, start } = prepared;
  const exact = request.exact ?? {};
  const result = await optimizeExact(evaluator, session.context, start, {
    objective: options.objective,
    constraints: options.constraints,
    slots: options.slots,
    includeCostumes: options.includeCostumes,
    lockedSlots: options.lockedSlots,
    catalog: options.catalog,
    placement: options.placement,
    optimizeCards: options.optimizeCards,
    optimizeEnchants: options.optimizeEnchants,
    keepWeaponType: options.keepWeaponType,
    unknownEnchantRepeats: options.unknownEnchantRepeats,
    refineDomain: exact.refineDomain,
    mode: exact.allTies ? 'allTies' : 'best',
    seedTimeMs: exact.seedTimeMs,
    timeLimitMs: exact.timeLimitMs,
    postOptimizeStats: exact.postOptimizeStats,
    lockedStats: options.lockedStats,
    minimumStats: options.minimumStats,
    resume: exact.resume,
    shouldStop: hooks.shouldStop,
    onProgress: hooks.onProgress,
    onCheckpoint: hooks.onCheckpoint,
  });
  const response = respond(prepared, {
    ...result,
    setsApplied: result.setsPresent,
    truncated: result.status === 'INTERRUPTED',
  });
  let statsAdjusted: ExactSummary['statsAdjusted'];
  if (result.statsAdjusted) {
    const adjusted = result.statsAdjusted;
    const links = buildLinks(session.model, adjusted.model, result);
    statsAdjusted = {
      damage: adjusted.damage,
      changes: adjusted.statChanges.map((c) => ({ group: 'stat' as const, label: STAT_LABELS[c.key] ?? c.key, from: String(c.from), to: String(c.to) })),
      applyPath: links.applyPath,
      comparePath: links.comparePath,
    };
  }
  return {
    ...response,
    exact: {
      status: result.status,
      stats: result.stats,
      spaceLog10: result.spaceLog10,
      ties: result.ties.length,
      seedDamage: result.seedScore.damage,
      signature: result.signature,
      checkpoint: result.checkpoint,
      error: result.error,
      statsAdjusted,
    },
  };
}

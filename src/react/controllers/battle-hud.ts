import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import type { SkillFormulaVersion } from '../../app/skills/skill-formula-version';
import { itemSlotLabelPtBr } from '../../app/constants/item-slot-i18n';
import { DropdownModel } from '../../app/models/dropdown.model';
import { dmgTypeLabel as dmgTypeLabelUtil, skillDescHtml } from '../../app/utils';
import { RotationCycle } from '../../app/core/rotation-schedule';
import { RotationEntryView, RotationView } from '../../app/layout/pages/ro-calculator/battle-hud/rotation-view';
import { DamageBranch } from './rotation-list';
import { CritRateBreakdown, CritRateStep } from '../../app/core/crit-rate';
import {
  buildDpsSteps,
  buildGraphClusters,
  buildOptimizeInfo,
  CastbarResult,
  computeCastbar,
  computeTimeToKill,
  CritRateRow,
  CritRateRowCache,
  deltaPercent,
  DpsSide,
  DpsSteps,
  elementTagClass as elementTagClassFn,
  FormulaGraphCluster,
  isCritWeighted,
  HeroDamage,
  OptimizeInfo,
  pickBiggerDpsSide,
  pickHeroDamage,
  pickHitsPerSec,
  TimeToKill,
} from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';

/** Hab./s is rendered to 2 decimals, so anything below this reads as "no change". */
const HITS_PER_SEC_EPSILON = 0.005;
import { DamageFormulaCalc, DamageFormulaNode } from '../../app/models/damage-summary.model';
import { formatNumber } from '../../app/utils/format-number';
import { ReductionCategory, ReductionRow } from '../../app/layout/pages/ro-calculator/reduction-breakdown';
import { IncomingDamageStep } from '../../app/core/monster-damage-taken';


export class BattleHudComponent extends ViewState {
   skillFormulaVersionChange = new Events<SkillFormulaVersion>();
   totalSummary = {} as any;
   totalSummary2 = {} as any;
   isEnableCompare: boolean;
   isCalculating: boolean;
   isInProcessingPreset: boolean;
   selectedChances: string[];
   chanceList: any[];
  /** The compared build's own Efeitos list and selection (comparison mode only). */
   chanceList2: any[] = [];
   selectedChances2: string[] = [];
   model = {} as any;
   showLeftWeapon: boolean;
   selectedMonster: number;
   selectedMonsterName: string;
   compareItemNames: any[];
  /** Whether level, job level, stats and traits are compared too (they are not slots). */
   compareStats = false;
  // PVP: when the target is a player, override the monster sprite with the
  // target's paper-doll (and a bare-job fallback if that image fails to load).
   spriteUrlOverride: string | null = null;
   spriteFallbackUrl: string | null = null;
  // Bound arrow property on the parent (ro-calculator.component.ts), same pattern as
  // skillTooltip — a plain method reference would lose its `this` once
  // called from here.
   canBreakdownFn: (keys: string[]) => boolean;

  // "Redução de dano" popover (PVP only): the target's reduction categories + its own
  // per-item sources (for the drill-down clickability). Empty on the vs-monster HUD.
   reductionCategories: ReductionCategory[] = [];
   reductionSources: Record<string, any> = {};

  // --- Rotation ---------------------------------------------------------------
  /** Everything the rotation draws: per-entry damage/timing plus the solved cycle. */
   rotationView: RotationView | null = null;
  /** The compared build's rotation, positionally aligned with `rotationView`. */
   rotationView2: RotationView | null = null;
  /** The raw ordered values — the list edits this, not the view. */
   rotation: string[] = [];
  get hasFlashCombo(): boolean {
    return this.rotation.some((skill) => skill.startsWith('Flash Combo=='));
  }
  /** The class's offensive skills, for the add picker and the level chips. */
   atkSkills: any[] = [];
   isShowSelectableSkillLevel = false;
  /**
   * Whether the target casts Aliviar (constants/monster-relieve). Only then does the level
   * picker appear on the monster card; every other target's card is unchanged. Left false
   * on the PVP tab, where the target is a player and no monster skill applies.
   */
   isRelieveTarget = false;
   relieveLevelOptions: DropdownModel[] = [];
   relieveLevel = 0;
   betelgeuseHp = 2_000_000_000;
   betelgeuseHpOptions: DropdownModel[] = [];
   betelgeuseHpChange = new Events<number>();

   relieveLevelChange = new Events<number>();
   rotationChange = new Events<{ rotation: string[]; stacks: number[] }>();
   stackChange = new Events<{ index: number; stack: number }>();
   optimizeClick = new Events<void>();

   selectedChancesChange = new Events<string[]>();
   selectedChances2Change = new Events<string[]>();
   showElementTableClick = new Events<any>();
   showBonusBreakdownClick = new Events<{
    label: string;
    keys: string[];
    valueClass: string;
    total?: number;
    calc?: DamageFormulaCalc;
    /** Line printed above the source rows, for a value the sum alone would misrepresent. */
    note?: string;
    /** Read the compared build's sources instead of the current one's. */
    compare?: boolean;
  }>();
   reductionRowClick = new Events<ReductionRow>();
   incomingReductionClick = new Events<IncomingDamageStep>();

  // Display-only pt-BR for the skill damage type (see dmgTypeLabelUtil;
  // the raw value still drives the [hidden] logic elsewhere, e.g. Magical-only chips).
  dmgTypeLabel(type: string): string {
    return dmgTypeLabelUtil(type);
  }

  // Elements without a `property_*` rule in styles.css (Neutral is the only one —
  // it never had a color, by design) must not fall through to ui-tag's own default
  // background. 'el-tag-neutral' (battle-hud.component.css) reproduces the old
  // outlined/neutral badge look instead of an arbitrary severity color.
  // The rule itself lives in battle-hud.logic.ts, shared with the rotation rows.
  elementTagClass = elementTagClassFn;

  /** For the basic-attack popover's Tx. Crít. row, which drills into both crit keys. */

  onShowElementalTableClick(): void {
    this.showElementTableClick.emit(1);
  }

  // "Which equipment affects this field" popover, same mechanism as the top
  // stat summary's ATQ/DEF/etc. rows (ro-calculator.component.ts canBreakdown/showBonusBreakdown).
  isBreakdownClickable(keys: string[]): boolean {
    return !!this.canBreakdownFn && this.canBreakdownFn(keys);
  }

  // `total`, when passed, is the actual clicked value (e.g. a formula-trace step's
  // running total) — showBonusBreakdown uses it to show what's left over after
  // summing equipment sources, for keys whose full value is never a pure equip sum
  // (e.g. "ATQ" also carries character stats, weapon base, refine...).
  //
  // `calc` is the node's own derivation (ATQ Status, ATQ da Arma, the synthesized
  // "Adicional" chips...). Those values come from a formula rather than a sum of
  // equipment bonuses, so they open the dialog on the strength of the calc alone —
  // isBreakdownClickable would (correctly) reject them, since no equipped source
  // contributes to their keys.
  //
  // `compare` resolves the rows against the compared build's own equipment instead of the
  // current one's — every "→ simulado" value drills into the build it actually belongs to.
  openBreakdown(
    label: string,
    keys: string[] = [],
    valueClass = 'summary_stat_matk',
    total?: number,
    calc?: DamageFormulaCalc,
    compare = false,
    note?: string,
  ): void {
    if (!calc && !this.isBreakdownClickable(keys)) return;
    this.showBonusBreakdownClick.emit({ label, keys, valueClass, total, calc, note, compare });
  }

  /** A kvPair's simulated column: the same breakdown, read from the compared build. */
  openBreakdownCompare(label: string, keys: string[] = [], note?: string): void {
    this.openBreakdown(label, keys, 'summary_stat_atk', undefined, undefined, true, note);
  }

  /**
   * The whole derivation of the crit rate the active row rolls with — LUK, equipment, the
   * skill's own flat crit and its share of the character's, and the target's shield.
   *
   * Read off the engine's own result object (core/crit-rate.ts), which is where the rate
   * itself comes from, so the popover cannot show a sum that disagrees with the figure
   * that was clicked. Falls back to the build's own solve when no row is picked.
   */
  get critRate(): CritRateBreakdown | null {
    const dmg = this.dmg;
    if (!dmg) return null;

    return (this.activeStep?.isBasic ? dmg.criRateBreakdown : dmg.skillCriRateBreakdown) ?? null;
  }

  private get critRateSim(): CritRateBreakdown | null {
    if (!this.isComparing) return null;
    const dmg2 = this.dmg2;
    if (!dmg2) return null;

    return (this.activeStep?.isBasic ? dmg2.criRateBreakdown : dmg2.skillCriRateBreakdown) ?? null;
  }

  /** Held steady across change-detection passes — see CritRateRowCache for why that is a
   *  correctness requirement here and not a performance one. */
  private readonly critRateRowCache = new CritRateRowCache();

  get critRateRows(): CritRateRow[] {
    return this.critRateRowCache.get(this.critRate, this.critRateSim);
  }

  trackByCritStep(_: number, row: CritRateRow): string {
    return row.step.key;
  }

  /** Whether the popover is describing an ataque básico row — it carries two terms
   *  (CRIT à distância, CRIT contra o alvo) that no skill receives. */
  get isCritRateBasic(): boolean {
    return !!this.activeStep?.isBasic;
  }

  /**
   * How one crit-rate row prints its number: a factor as a percentage, and everything else
   * unsigned — the operator column on the left already carries the sign, so a subtraction
   * would otherwise read "− ... -10".
   */
  critStepText(step: CritRateStep, value: number): string {
    if (step.kind === 'multiply') return `${formatNumber(value * 100, 0, 1)}%`;

    return formatNumber(Math.abs(value), 0, 1);
  }

  /** A row's crit rate was clicked: point the popover at that row before opening it. */
  openStepCritRate(payload: { index: number; event: Event }, panel: any) {
    this.activeStepIndex = payload.index;
    panel?.toggle(payload.event);
  }

  /** A graph node is clickable when it has a derivation to show or equipment behind it. */
  isNodeClickable(node: DamageFormulaNode): boolean {
    return !!node.detail || !!node.calc || (!!node.keys && this.isBreakdownClickable(node.keys));
  }

  formulaPart: {
    label: string;
    graph: { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] };
    hits: number;
    min: number;
    max: number;
    compare: boolean;
  } | null = null;

  openFormulaNode(node: DamageFormulaNode, compare = false): void {
    if (node.detail) {
      const graph = this.toClusterPair(node.detail.graph);
      if (graph) this.formulaPart = { label: node.label, graph, hits: node.detail.hits,
        min: node.detail.min, max: node.detail.max, compare };
      return;
    }
    this.openBreakdown(node.label, node.keys, 'summary_stat_matk', node.value, node.calc, compare);
  }

  // Changing the graph replaces its clicked node. Open the child on pointerdown,
  // before the later click can be lost when Angular removes that node. The click
  // binding remains for keyboard activation through keyActivate.
  openFormulaDetailOnPointerDown(node: DamageFormulaNode, compare: boolean, event: PointerEvent): void {
    if (!node.detail) return;
    event.preventDefault();
    event.stopPropagation();
    this.openFormulaNode(node, compare);
  }

  openHeroDamageFormula(event: Event, panel: any): void {
    this.formulaPart = null;
    panel?.toggle(event);
  }

  /**
   * Which rotation entry the per-skill popovers are describing. Set by a row's `(i)`;
   * -1 means "no row picked", and the panels fall back to the build's own summary.
   *
   * One overlay panel is reused for every row rather than one panel per row: with up to
   * 20 entries carrying the full details/formula markup, per-row instances would be a
   * lot of DOM for something only ever open one at a time.
   */
  activeStepIndex = -1;

  private get activeStep(): RotationEntryView | null {
    return this.rotationView?.entries?.[this.activeStepIndex] ?? null;
  }

  /** The rotation entry the (i) popover is describing — its header reads from this. */
  get activeEntry(): RotationEntryView | null {
    return this.activeStep;
  }

  /** Whether the (i) popover's description block is open. Starts closed on every step. */
  isDescExpanded = false;

  /** The client description of the skill the (i) popover is describing, so the panel says
   *  what the skill *does* and not only what it deals. Empty for ataque básico, which is
   *  not a skill, and for anything the catalog has no text for — the block is then hidden. */
  get activeEntryDesc(): string {
    const entry = this.activeEntry;

    return entry?.isBasic ? '' : skillDescHtml(entry?.icon);
  }

  /** Per-hit range behind a multi-hit total: the design's "soma de N golpes · X – Y cada". */
  get activePerHit(): { hits: number; min: number; max: number } | null {
    const hits = this.dmg?.skillTotalHit ?? 0;
    if (!(hits > 1)) return null;
    const h = pickHeroDamage(this.dmg, this.hasSelectedChances);

    return { hits, min: h.min / hits, max: h.max / hits };
  }

  /** The summary every per-skill panel reads: the picked rotation entry's own solve,
   *  or the build's when no row is picked. */
  private get activeSummary(): any {
    return this.activeStep?.summary ?? this.totalSummary;
  }

  private get activeSummary2(): any {
    return this.rotationView2?.entries?.[this.activeStepIndex]?.summary ?? this.totalSummary2;
  }

  /** Opens the details popover for a row — the basic-attack variant for ataque básico. */
  openStepDetails(payload: { index: number; event: Event }, detailsPanel: any, basicPanel: any) {
    this.activeStepIndex = payload.index;
    // The panel is about the damage; the skill's own text is reference the reader asks for.
    // Collapse it again per step, so opening a row always shows the numbers first.
    this.isDescExpanded = false;
    const panel = this.activeStep?.isBasic ? basicPanel : detailsPanel;
    panel?.toggle(payload.event);
  }

  /**
   * A row's damage figure opens the explanation of *that* figure, for that row's own step.
   *
   * Which explanation depends on what the figure is. The formula graph traces one
   * outcome — the crit — so it only explains the row when every use crits (or none does).
   * In between, the row shows the crit-weighted mean of two different numbers, and the
   * graph would answer with a third; the mean's own derivation is the honest target.
   * Ataque básico has no skill formula either way, so it keeps its own panel.
   */
  openStepDamageFormula(payload: { index: number; event: Event; branch?: DamageBranch }, panels: { formula: any; noCri: any; basic: any; mean: any }) {
    this.activeStepIndex = payload.index;
    this.formulaPart = null;
    const entry = this.activeStep;
    if (entry?.isBasic) return panels.basic?.toggle(payload.event);

    // Each figure opens its own branch and no more: the no-crit roll explains the no-crit
    // formula, the crit roll the crit one. The mean is the only figure with an explanation
    // of its own — and only where there *is* a mean; a skill with one flat roll has none, and
    // sending it to that popover opened an empty box.
    const branch = payload.branch ?? 'mean';
    if (branch === 'nocri') return panels.noCri?.toggle(payload.event);

    const wantsMean = branch === 'mean' && !!entry?.hasDamageSpread;
    (wantsMean ? panels.mean : panels.formula)?.toggle(payload.event);
  }

  openSharedDetails(payload: { index: number; event: Event }, details: any): void {
    this.activeStepIndex = payload.index;
    const entry = this.activeStep;
    if (!entry) return;
    details?.open(payload.event, {
      entry: {
        name: entry.name,
        levelLabel: entry.levelLabel,
        icon: entry.icon,
        isBasic: entry.isBasic,
        dmgTypeLabel: entry.dmgTypeLabel,
        element: entry.element,
        propertyMultiplier: entry.propertyMultiplier,
        hasDamageSpread: entry.hasDamageSpread,
        critWeighted: entry.critWeighted,
      },
      summary: entry.summary,
      summary2: this.rotationView2?.entries?.[payload.index]?.summary,
      isComparing: this.isComparing,
      optimizeInfo: this.optimizeInfo,
    }, payload.event.currentTarget);
  }

  /** Shared damage popovers used by both Batalha and Auto-conjuração. */
  openSharedDamage(payload: { index: number; event: Event; branch?: DamageBranch }, popovers: any): void {
    this.activeStepIndex = payload.index;
    const entry = this.activeStep;
    if (!entry) return;
    popovers?.open(payload.event, payload.branch ?? 'mean', {
      entry: {
        name: entry.name,
        isBasic: entry.isBasic,
        hasDamageSpread: entry.hasDamageSpread,
        critWeighted: entry.critWeighted,
      },
      summary: entry.summary,
      summary2: this.rotationView2?.entries?.[payload.index]?.summary,
      isComparing: this.isComparing,
      hasSelectedChances: this.hasSelectedChances,
      hasSelectedChances2: this.hasSelectedChances2,
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  get cycle(): RotationCycle | null {
    return this.rotationView?.cycle ?? null;
  }

  get cycle2(): RotationCycle | null {
    return this.isComparing ? this.rotationView2?.cycle ?? null : null;
  }

  /** A one-entry rotation reads as "spam this skill", so the panel promotes Hab./s and
   *  labels the damage "por uso" instead of "por ciclo". */
  get isSingleEntryRotation(): boolean {
    return this.rotation?.length === 1;
  }

  /** Unit for the kill count next to "Morre em" — "1 usos" was the one place the panel
   *  printed a plural for a single thing. */
  get killCountLabel(): string {
    const one = this.rotationView?.cyclesToKill === 1;
    if (this.isSingleEntryRotation) return one ? 'uso' : 'usos';
    return one ? 'ciclo' : 'ciclos';
  }

  /**
   * Whether the first pass is worth calling out. Compared with a half-a-centisecond
   * slack rather than `<`: the two are computed from the same float additions in a
   * different order, so a rotation with no stall at all lands a hair apart and would
   * otherwise render "1º ciclo 11,12s" next to "Ciclo 11,12s".
   */
  get showsFirstCycle(): boolean {
    const c = this.cycle;
    if (!c || this.isSingleEntryRotation) return false;

    return c.cycleDuration - c.firstCycleDuration > 0.005;
  }

  /**
   * How much a compared build moves one of the hero figures, in percent. `null` when
   * there is nothing to compare against, so the label simply does not render.
   */
  private deltaPercent(before: number, after: number): number | null {
    if (!(before > 0) || !this.isComparing) return null;

    return ((after - before) / before) * 100;
  }

  get dpsDeltaPercent(): number | null {
    return this.deltaPercent(this.cycle?.sustainedDps ?? 0, this.cycle2?.sustainedDps ?? 0);
  }

  /**
   * The same figure for "Por uso" / "Por ciclo". It had the arrow and the two numbers but
   * not the percentage the DPS line above it carries, which left the reader subtracting
   * two nine-digit numbers by eye to answer the question the comparison exists for
   * (suggested by Ynk). It is its own delta, not the DPS one: the two only agree while
   * the compared build keeps the same rate, and any change to cast or recarga separates
   * them.
   */
  get perCycleDeltaPercent(): number | null {
    return this.deltaPercent(this.cycle?.damagePerCycle ?? 0, this.cycle2?.damagePerCycle ?? 0);
  }

  get dmg(): any {
    return this.activeSummary?.dmg;
  }

  // "Dano Crít." tooltip: some skills only apply a fraction of the character's
  // crit-damage bonus (skillCriDmgPercentage, e.g. 0.5 for Sonic Blow, 0.25 for
  // Windhawk's Chain Crash). Undefined (no tooltip) when the skill gets the full
  // bonus (percentage === 1).
  criDmgPercentageTooltip(dmg: any): string | undefined {
    const pct = dmg?.skillCriDmgPercentage;
    if (pct == null || pct === 1) return undefined;
    return `Esta habilidade aplica apenas ${Math.round(pct * 100)}% do dano crítico total do personagem`;
  }

  get dmg2(): any {
    return this.activeSummary2?.dmg;
  }

  get calcSkill(): any {
    return this.activeSummary?.calcSkill;
  }

  get isComparing(): boolean {
    return !!(this.isEnableCompare && this.dmg2);
  }

  get isAutoSpell(): boolean {
    return !!this.dmg?.isAutoSpell;
  }

  // pt-BR item-slot labels for the compare ribbon, e.g. ['boot'] -> 'Bota' — same
  // util the compare-slot picker uses (ro-calculator.component.ts line ~341).
  get compareRibbonText(): string {
    const slots = (this.compareItemNames || []).map((v) => itemSlotLabelPtBr(v));
    return (this.compareStats ? ['Nível e atributos', ...slots] : slots).join(', ');
  }

  // --- Hero (DPS / damage per use) -------------------------------------------

  // Fix 10: when the last Efeito is unselected, the parent pipeline never refreshes
  // totalSummary, so dmg.effectedSkillDamageMin/effectedSkillHitsPerSec can stay
  // stale. Every effected-value read in this component must gate on this flag,
  // mirroring the legacy template's `selectedChances?.length` guards.
  private get hasSelectedChances(): boolean {
    return (this.selectedChances?.length ?? 0) > 0;
  }

  /** The same flag for the compared build, which ticks its own Efeitos. Reading the main
   *  build's flag for a `dmg2` value left the comparison column on base damage whenever
   *  the two selections differed. */
  private get hasSelectedChances2(): boolean {
    return (this.selectedChances2?.length ?? 0) > 0;
  }

  // "Hab./s" sub-line — see pickHitsPerSec for the effected||base fallback and the
  // VelAtq cap it applies.
  get heroHitsPerSec(): number {
    return pickHitsPerSec(this.totalSummary, this.hasSelectedChances);
  }

  // Compare build's "Hab./s", shown as `6 → 7,2` next to the current one. Null unless
  // we're comparing AND the rate actually moved: unlike DPS/"Morre em" (which shift on
  // any damage change), swapping most items leaves the cast/ASPD rate untouched, and
  // rendering `6 → 6` on every comparison is noise rather than information.
  // Null is the only "hide me" signal — 0 is a real answer (a compare build that cannot
  // attack at all), so the template tests `!== null` rather than truthiness.
  get heroHitsPerSecSim(): number | null {
    if (!this.isComparing) return null;
    const sim = pickHitsPerSec(this.totalSummary2, this.hasSelectedChances2);

    return Math.abs(sim - this.heroHitsPerSec) < HITS_PER_SEC_EPSILON ? null : sim;
  }

  // heroPrimaryCurrent/heroPrimarySimulated stay standalone (not folded into the
  // `hero` getter below) because optimizeInfo needs `dps` on its own, outside any
  // template-driven amplification — no *ngIf="hero as h" scope to piggyback on there.
  private get heroPrimaryCurrent(): number {
    const h = pickHeroDamage(this.dmg, this.hasSelectedChances);
    return this.isAutoSpell ? (h.min + h.max) / 2 : h.dps;
  }

  private get heroPrimarySimulated(): number {
    if (!this.isComparing) return 0;
    const h = pickHeroDamage(this.dmg2, this.hasSelectedChances2);
    return this.isAutoSpell ? (h.min + h.max) / 2 : h.dps;
  }

  // Single consolidated read of the hero (DPS / damage per use) section — the template
  // binds this once via `*ngIf="hero as h"` instead of re-invoking five separate
  // getters (which themselves used to re-derive heroCurrent/heroSimulated multiple
  // times each) on every CD pass.
  get hero(): {
    current: HeroDamage;
    simulated: HeroDamage | null;
    biggerSide: DpsSide;
    delta: number | null;
    showsEffected: boolean;
    ttk: TimeToKill | null;
    ttkSim: TimeToKill | null;
  } {
    const current = pickHeroDamage(this.dmg, this.hasSelectedChances);
    const simulated = this.isComparing ? pickHeroDamage(this.dmg2, this.hasSelectedChances2) : null;

    const primaryCurrent = this.isAutoSpell ? (current.min + current.max) / 2 : current.dps;
    const primarySimulated = simulated ? (this.isAutoSpell ? (simulated.min + simulated.max) / 2 : simulated.dps) : 0;

    // Same monster on both sides of a comparison, so only the DPS differs.
    const monsterHp = this.totalSummary?.monster?.hp || 0;

    return {
      current,
      simulated,
      biggerSide: this.isComparing ? pickBiggerDpsSide(primaryCurrent, primarySimulated) : 'current',
      delta: this.isComparing ? deltaPercent(primaryCurrent, primarySimulated) : null,
      ttk: computeTimeToKill(monsterHp, current.dps),
      ttkSim: simulated ? computeTimeToKill(monsterHp, simulated.dps) : null,
      // True when the hero figure is the chance-triggered one rather than the base roll,
      // which is what the "Sem efeitos" row and the formula panel's note both key off.
      showsEffected: current.effected,
    };
  }

  /** Explains the "Morre em" figure: the division behind it, plus the engine's own
   *  hits-to-kill (dmg.skillHitKill = ceil(HP / dano mínimo), so it's the pessimistic
   *  count — worth showing next to a DPS-averaged time). */
  get ttkTooltip(): string {
    const hp = this.totalSummary?.monster?.hp || 0;
    const hits = this.dmg?.skillHitKill || 0;
    const base = `HP do alvo (${formatNumber(hp)}) ÷ DPS — considera precisão, crítico e a cadência real da habilidade.`;
    return hits > 0 ? `${base}\nGolpes p/ matar: ${formatNumber(hits)} (pelo dano mínimo).` : base;
  }

  // Step-by-step DPS derivation, shown in a popover when the DPS/Dano numbers
  // are clicked. Built from the engine's own calcDmgDps inputs (see
  // dmg.skillDpsInput*), so it always reconciles with dmg.skillDps.
  get dpsSteps(): DpsSteps | null {
    return buildDpsSteps(this.dmg);
  }

  get dpsStepsSim(): DpsSteps | null {
    return this.isComparing ? buildDpsSteps(this.dmg2) : null;
  }

  /**
   * Whether this skill's per-use damage is a crit-weighted mean — see isCritWeighted.
   * When it is, the card owes three readings (sem crít., com crít., média) instead of the
   * single headline it used to show, because those are three different numbers and the
   * rotation, the DPS and the formula graph each use a different one of them.
   */
  get isCritWeighted(): boolean {
    return isCritWeighted(this.dmg?.skillCanCri, this.dmg?.skillCriRateToMonster);
  }

  /**
   * The mean's own derivation, straight out of calc-dmg-dps so the popover can never
   * disagree with the figure the rotation rows print.
   *
   * Not gated on the crit: a skill that never crits still has a mean — of its min and max
   * rolls — and that is just as much the figure the rotation runs on. Null only where the
   * active row has no spread at all, which is the case that has nothing to average.
   */
  get critMean(): DpsSteps | null {
    return this.activeStep?.hasDamageSpread ? this.dpsSteps : null;
  }

  get critMeanSim(): DpsSteps | null {
    return this.isComparing && this.critMean ? this.dpsStepsSim : null;
  }

  /** The popover explains two different averages, so it says which one it is showing. */
  get meanPanelTitle(): string {
    return this.isCritWeighted ? 'Como a média por crítico é calculada' : 'Como o dano médio é calculado';
  }

  // True when the attack speed caps the achieved Hab./s below what the cast timings
  // alone would allow — same condition buildOptimizeInfo uses for its "A Vel.Atq limita
  // a conjuração" callout, surfaced here too since this popover is where the capped
  // rate actually feeds into the DPS total.
  private isAspdLimiting(castRatePerSec: number, aspdHitsPerSec: number): boolean {
    return aspdHitsPerSec > 0 && aspdHitsPerSec < castRatePerSec - 1e-5;
  }

  // O teto que vale para esta habilidade. Zero — que as duas leituras acima tratam como
  // "sem dado de Vel.Atq", ou seja sem teto — para as que o motor isenta por trazerem a
  // própria pós-conjuração (`AtkSkillModel.ignoreAspdFloor`). Sem isto o painel anunciaria
  // um teto que o número ao lado dele já não respeita.
  private aspdCeiling(calcSkill: any, hitPerSecs?: number): number {
    return calcSkill?.ignoreAspdFloor ? 0 : hitPerSecs || 0;
  }

  get isAspdLimited(): boolean {
    return this.isAspdLimiting(this.calcSkill?.totalHitPerSec || 0, this.aspdCeiling(this.calcSkill, this.totalSummary?.calc?.hitPerSecs));
  }

  get isAspdLimitedSim(): boolean {
    const calcSkill = this.totalSummary2?.calcSkill;
    return this.isAspdLimiting(calcSkill?.totalHitPerSec || 0, this.aspdCeiling(calcSkill, this.totalSummary2?.calc?.hitPerSecs));
  }

  // Node-graph view of the real per-hit damage formula (see damage-calculator.ts
  // calcPhysicalSkillDamage/calcMagicalSkillDamage), shown when "Dano atual" is
  // clicked. buildGraphClusters groups the engine's flat node list into left-to-right
  // clusters — one per formula stage, with any contributing "input" values (statusAtk,
  // extraAtk's sub-parts, etc.) attached as chips. undefined for the handful of skills
  // with a fully custom formula that skip the traced code path.
  //
  // Memoized (keyed by the source `graph` object identity, which is stable across
  // change-detection cycles — it only changes when totalSummary is recalculated):
  // this getter is invoked by Angular on every CD pass, and *ngFor diffs its `clusters`
  // input by reference. Rebuilding fresh arrays/objects each call made every node
  // "new" on every pass, so *ngFor tore down and recreated the whole DOM subtree
  // constantly — including on the `mousedown` that precedes a click, detaching the
  // very node the user was about to click before the `click` event could reach it.
  private readonly graphClusterCache = new WeakMap<object, { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] }>();

  private toClusterPair(graph: { min: any; max: any } | undefined | null): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    if (!graph) return null;
    const cached = this.graphClusterCache.get(graph);
    if (cached) return cached;
    const built = { min: buildGraphClusters(graph.min), max: buildGraphClusters(graph.max) };
    this.graphClusterCache.set(graph, built);
    return built;
  }

  /** The panel explains the figure it hangs off, so it follows the same effected||base
   *  fallback the hero number does (see pickHeroDamage) — gated on the same
   *  hasSelectedChances flag, for the same stale-value reason. A proc that grants stats
   *  changes every row of the derivation: +STR/+LUK feeds ATQ Status, and the primary
   *  stat feeds ATQ da Arma's `ATQ base x FOR / 200` term too. */
  private effectedGraph(
    dmg: { skillFormulaGraph?: any; effectedSkillFormulaGraph?: any } | null | undefined,
    hasChances: boolean,
  ) {
    return (hasChances && dmg?.effectedSkillFormulaGraph) || dmg?.skillFormulaGraph;
  }

  private effectedGraphNoCri(
    dmg: { skillFormulaGraphNoCri?: any; effectedSkillFormulaGraphNoCri?: any } | null | undefined,
    hasChances: boolean,
  ) {
    return (hasChances && dmg?.effectedSkillFormulaGraphNoCri) || dmg?.skillFormulaGraphNoCri;
  }

  get formulaGraph(): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    return this.toClusterPair(this.effectedGraph(this.dmg, this.hasSelectedChances));
  }

  get formulaGraphSim(): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    return this.isComparing
      ? this.toClusterPair(this.effectedGraph(this.dmg2, this.hasSelectedChances2))
      : null;
  }

  // When the skill's min/max damage are the same (e.g. no weapon ATK variance),
  // the formula popover collapses "Dano mínimo"/"Dano máximo" into one "Dano"
  // section instead of showing the identical chain twice.
  get damageIsFlat(): boolean {
    const hero = pickHeroDamage(this.dmg, this.hasSelectedChances);
    return hero.min === hero.max;
  }

  // Same as formulaGraph/formulaGraphSim/damageIsFlat above, but for "Dano sem crít."
  // (skillMinDamageNoCri/skillMaxDamageNoCri) — only populated when skillCanCri is true.
  get formulaGraphNoCri(): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    return this.toClusterPair(this.effectedGraphNoCri(this.dmg, this.hasSelectedChances));
  }

  get formulaGraphNoCriSim(): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    return this.isComparing
      ? this.toClusterPair(this.effectedGraphNoCri(this.dmg2, this.hasSelectedChances2))
      : null;
  }

  get damageNoCriIsFlat(): boolean {
    return this.dmg?.skillMinDamageNoCri === this.dmg?.skillMaxDamageNoCri;
  }

  // --- Castbar -----------------------------------------------------------

  // Single normalization of a calcSkill-shaped object's cast timings, shared by
  // castbar/castbar2 and optimizeInfo below (both used to repeat the identical
  // `c.X || 0` fallback chain). Takes the source object explicitly so it can
  // normalize either side (current totalSummary.calcSkill or the comparison
  // totalSummary2.calcSkill) with the same logic.
  private normalizeCastTimings(c: any): {
    reducedFct: number;
    reducedVct: number;
    reducedAcd: number;
    reducedCd: number;
    castPeriod: number;
    hitPeriod: number;
    totalHitPerSec: number;
  } {
    c = c || {};
    return {
      reducedFct: c.reducedFct || 0,
      reducedVct: c.reducedVct || 0,
      reducedAcd: c.reducedAcd || 0,
      reducedCd: c.reducedCd || 0,
      castPeriod: c.castPeriod || 0,
      hitPeriod: c.hitPeriod || 0,
      totalHitPerSec: c.totalHitPerSec || 0,
    };
  }

  private get normalizedCastTimings() {
    return this.normalizeCastTimings(this.calcSkill);
  }

  private get normalizedCastTimings2() {
    return this.normalizeCastTimings(this.totalSummary2?.calcSkill);
  }

  get castbar(): CastbarResult {
    return computeCastbar(this.normalizedCastTimings);
  }

  get castbar2(): CastbarResult | null {
    return this.isComparing ? computeCastbar(this.normalizedCastTimings2) : null;
  }

  // The comparison castbar only earns its keep when the compared set actually
  // changes a cast-time component — otherwise it'd just be a redundant copy
  // of the current bar.
  get castTimingsDiffer(): boolean {
    if (!this.isComparing) return false;
    const a = this.normalizedCastTimings;
    const b = this.normalizedCastTimings2;
    const EPS = 1e-3;
    return (
      Math.abs(a.reducedFct - b.reducedFct) > EPS ||
      Math.abs(a.reducedVct - b.reducedVct) > EPS ||
      Math.abs(a.reducedAcd - b.reducedAcd) > EPS ||
      Math.abs(a.reducedCd - b.reducedCd) > EPS
    );
  }

  // When both bars are shown (comparing + differing timings), they share one scale:
  // the slower (bigger hitPeriod) side renders at full width, the faster one shrinks
  // proportionally — instead of each bar independently normalizing to its own 100%,
  // which would hide how much faster/slower one side's whole cycle actually is.
  castBarWidthPercent(hitPeriod: number): number {
    if (!this.isComparing || !this.castTimingsDiffer) return 100;
    const maxHitPeriod = Math.max(this.castbar?.hitPeriod || 0, this.castbar2?.hitPeriod || 0);
    return maxHitPeriod > 0 ? (hitPeriod / maxHitPeriod) * 100 : 100;
  }

  get optimizeInfo(): OptimizeInfo | null {
    if (this.calcSkill?.timingUnknown) return null;
    const { reducedFct, reducedVct, reducedAcd, reducedCd, castPeriod, hitPeriod } = this.normalizedCastTimings;
    return buildOptimizeInfo({
      reducedFct,
      reducedVct,
      reducedAcd,
      reducedCd,
      castPeriod,
      hitPeriod,
      dps: this.heroPrimaryCurrent || 0,
      sumDex2Int1: this.calcSkill?.sumDex2Int1 || 0,
      aspdHitsPerSec: this.aspdCeiling(this.calcSkill, this.totalSummary?.calc?.hitPerSecs),
    });
  }
}


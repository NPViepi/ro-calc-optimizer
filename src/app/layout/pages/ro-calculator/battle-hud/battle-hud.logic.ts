// Pure (no Angular imports) helpers for the "Resumo de Batalha" HUD component.
// Kept framework-free so they're unit-testable with plain Vitest, mirroring
// src/app/utils/calc-skill-aspd.ts. These functions only reshape numbers the
// engine already produced (calcSkillAspd via totalSummary.calcSkill) into
// display-ready segments — they never re-derive game-truth timing math.

import { ElementType } from '../../../../constants/element-type.const';
import { CritRateBreakdown, CritRateStep } from '../../../../core/crit-rate';
import { calcDmgDpsDetailed } from '../../../../utils/calc-dmg-dps';
import { formatCalcNumber, formatNumber, formatRate, formatSignedCalcNumber } from '../../../../utils/format-number';
import { DamageFormulaCalcRow, DamageFormulaGraph, DamageFormulaNode } from '../../../../models/damage-summary.model';
import { Translate } from '../../../../i18n';

/** Neutro has no colour of its own; everything else gets the theme's property_* class. */
const ELEMENT_COLOR_CLASSES: Set<string> = new Set(Object.values(ElementType).filter((e) => e !== ElementType.Neutral));

/** `styleClass` for the element ui-tag. Shared so the HUD and the rotation rows can't drift. */
export function elementTagClass(elementUpper: string | undefined): string {
  return elementUpper && ELEMENT_COLOR_CLASSES.has(elementUpper) ? 'property_' + elementUpper : 'el-tag-neutral';
}

export type CastComponentKey = 'fixa' | 'variavel' | 'pos' | 'recarga' | 'aspd';

export interface CastbarSegment {
  seconds: number;
  /** Percent width relative to hitPeriod, 0-100 (may exceed 100 only if hitPeriod is 0). */
  percent: number;
}

export interface CastbarParallelLane {
  posSeconds: number;
  recSeconds: number;
  /** Which of the two parallel lanes determines the block duration. */
  winner: 'pos' | 'recarga' | 'tie';
  blockSeconds: number;
  /** Percent width of the whole parallel block relative to hitPeriod, 0-100. */
  blockPercent: number;
  /** Width, 0-100, of the recharge lane's inner fill relative to the winning (longer) lane. */
  recFillPercent: number;
}

export interface CastbarResult {
  mode: 'sequential' | 'single';
  fixed?: CastbarSegment;
  variable?: CastbarSegment;
  parallel?: CastbarParallelLane;
  single?: CastbarSegment;
  hitPeriod: number;
  totalHitPerSec: number;
}

const EPSILON = 1e-5;

/**
 * Builds the castbar segments from the already-reduced timings on
 * totalSummary.calcSkill. Uses `blockPeriod = hitPeriod - castPeriod` (the
 * identity calcSkillAspd guarantees: hitPeriod = castPeriod + blockPeriod)
 * instead of re-deriving max(reducedAcd, reducedCd) locally, because
 * hitEveryNSec skills force blockPeriod to 0 even when reducedAcd/reducedCd
 * themselves are nonzero — only the derived value reflects that correctly.
 */
export function computeCastbar(input: {
  reducedFct: number;
  reducedVct: number;
  reducedAcd: number;
  reducedCd: number;
  castPeriod: number;
  hitPeriod: number;
  totalHitPerSec: number;
}): CastbarResult {
  const { reducedFct, reducedVct, reducedAcd, reducedCd, castPeriod, hitPeriod, totalHitPerSec } = input;
  const blockPeriod = hitPeriod - castPeriod;

  if (blockPeriod <= EPSILON) {
    return {
      mode: 'single',
      single: { seconds: castPeriod, percent: 100 },
      hitPeriod,
      totalHitPerSec,
    };
  }

  const total = hitPeriod > 0 ? hitPeriod : 1;
  const winner: CastbarParallelLane['winner'] = reducedAcd > reducedCd ? 'pos' : reducedAcd < reducedCd ? 'recarga' : 'tie';
  const blockSeconds = Math.max(reducedAcd, reducedCd);
  const recFillPercent = blockSeconds > 0 ? Math.min(100, (reducedCd / blockSeconds) * 100) : 0;

  return {
    mode: 'sequential',
    fixed: { seconds: reducedFct, percent: (reducedFct / total) * 100 },
    variable: { seconds: reducedVct, percent: (reducedVct / total) * 100 },
    parallel: {
      posSeconds: reducedAcd,
      recSeconds: reducedCd,
      winner,
      blockSeconds,
      // blockPeriod (not blockSeconds) so the three widths always sum to ~100
      // even when rounding makes max(acd, cd) differ from hitPeriod - castPeriod.
      blockPercent: (blockPeriod / total) * 100,
      recFillPercent,
    },
    hitPeriod,
    totalHitPerSec,
  };
}

/**
 * The bottleneck is whichever of the (up to) three time-costing components —
 * fixed cast, variable cast, and the winning side of the parallel block —
 * contributes the most seconds to hitPeriod. The losing side of the parallel
 * block costs zero time (it runs concurrently), so it's never the bottleneck.
 */
export function identifyCastBottleneck(input: { reducedFct: number; reducedVct: number; reducedAcd: number; reducedCd: number }): CastComponentKey {
  const { reducedFct, reducedVct, reducedAcd, reducedCd } = input;
  const blockWinnerKey: CastComponentKey = reducedCd > reducedAcd ? 'recarga' : 'pos';
  const blockSeconds = Math.max(reducedAcd, reducedCd);

  const candidates: Array<[CastComponentKey, number]> = [
    ['fixa', reducedFct],
    ['variavel', reducedVct],
    [blockWinnerKey, blockSeconds],
  ];
  return candidates.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export interface ZeroPosWhatIf {
  newDps: number;
  newHitPeriod: number;
  gainPercent: number;
}

/**
 * What-if: DPS if the after-cast delay (pós-conjuração / reducedAcd) were
 * zeroed out, leaving only sequential cast time plus whatever recarga is left
 * running in parallel. Guards against a degenerate (<=0) new hit period.
 *
 * The real per-use rate is capped by ASPD (engine truth, damage-calculator.ts:1422:
 * `Math.min(skillAspd.totalHitPerSec, basicAspd.hitsPerSec)`), so both the "current"
 * baseline and the "new" (post what-if) rate must go through that same min() against
 * `aspdHitsPerSec` — otherwise this would suggest gains ASPD won't actually let through.
 */
export function computeZeroPosWhatIf(input: {
  dps: number;
  hitPeriod: number;
  castPeriod: number;
  reducedCd: number;
  aspdHitsPerSec: number;
}): ZeroPosWhatIf | null {
  const { dps, hitPeriod, castPeriod, reducedCd, aspdHitsPerSec } = input;
  const newHitPeriod = castPeriod + Math.max(reducedCd, 0);
  if (newHitPeriod <= 0) return null;

  const castRate = hitPeriod > 0 ? 1 / hitPeriod : 0;
  const effectiveRate = aspdHitsPerSec > 0 ? Math.min(castRate, aspdHitsPerSec) : castRate;

  const newCastRate = 1 / newHitPeriod;
  const newEffectiveRate = aspdHitsPerSec > 0 ? Math.min(newCastRate, aspdHitsPerSec) : newCastRate;

  const gainPercent = effectiveRate > 0 ? (newEffectiveRate / effectiveRate - 1) * 100 : 0;
  const newDps = dps * (effectiveRate > 0 ? newEffectiveRate / effectiveRate : 1);

  return {
    newDps,
    newHitPeriod,
    gainPercent,
  };
}

export interface CastComponentInfo {
  key: CastComponentKey;
  label: string;
  seconds: number;
  /** Reduction hint shown when there's still something to gain from this component. */
  hint: string;
  /** Overrides `hint` when the component has nothing left to reduce (e.g. "já zerada ✓"). Null when still improvable. */
  doneText: string | null;
  /** True for the ASPD row: it has no meaningful "seconds" figure, so the template skips that span. */
  hideSeconds?: boolean;
}

export interface OptimizeInfo {
  /** True when neither the pós what-if nor fixa/variável offer anything worth chasing (recarga is never reducible, so it never counts). */
  isOptimized: boolean;
  /** Headline for the popover: either the bottleneck callout or the "nothing to improve" message. */
  headline: string;
  bottleneck: CastComponentKey;
  components: CastComponentInfo[];
  /** Null both when zeroing pós is degenerate (see computeZeroPosWhatIf) and when the gain is under 1% (not worth showing). */
  whatIf: ZeroPosWhatIf | null;
}

/** A component "counts" as already-optimal once it contributes less than this many seconds. */
const ZERO_SECONDS_EPS = 0.005;
/** Below this, the zero-pós what-if isn't worth surfacing as an actionable suggestion. */
const MIN_MEANINGFUL_GAIN_PERCENT = 1;

// Shared with the golpes/s chart — one decision about how a rate is printed. One decimal
// used to be enough when the ASPD ceiling was a floored integer; now that it is the real
// 50/(200-VelAtq) rate, rounding to 7,1 would render "7,1/s >= 7,1/s" for two rates that
// differ.
const fmtRate = formatRate;

/** Assembles the "otimizar" popover data: bottleneck + per-component hints + the zero-pós what-if. */
export function buildOptimizeInfo(input: {
  reducedFct: number;
  reducedVct: number;
  reducedAcd: number;
  reducedCd: number;
  castPeriod: number;
  hitPeriod: number;
  dps: number;
  sumDex2Int1: number;
  /** ASPD-supported uses/sec — the exact ceiling the engine caps with (basicAspd.hitsPerSec, i.e. totalSummary.calc.hitPerSecs). */
  aspdHitsPerSec: number;
}, text: Translate): OptimizeInfo {
  const { reducedFct, reducedVct, reducedAcd, reducedCd, castPeriod, hitPeriod, dps, sumDex2Int1, aspdHitsPerSec } = input;
  const toZero = Math.max(0, 530 - sumDex2Int1);

  // Cast mechanics alone can potentially fire faster than ASPD allows — the engine
  // caps the real rate at min(castRate, aspdHitsPerSec) (damage-calculator.ts:1422).
  // aspdHitsPerSec <= 0 means "no ASPD data" -> treat as uncapped.
  const castRate = hitPeriod > 0 ? 1 / hitPeriod : 0;
  const aspdLimits = aspdHitsPerSec > 0 && aspdHitsPerSec < castRate - EPSILON;

  const fixaZero = reducedFct < ZERO_SECONDS_EPS;
  // The variável cast is zeroed either by hitting the 530 DEX*2+INT stat threshold
  // (server-side rule, independent of float rounding) or by the reduced seconds
  // themselves already being ~0 (e.g. equipment -VCT%).
  const variavelStatsMet = sumDex2Int1 >= 530;
  const variavelZero = variavelStatsMet || reducedVct < ZERO_SECONDS_EPS;
  const posZero = reducedAcd < ZERO_SECONDS_EPS;

  const rawWhatIf = computeZeroPosWhatIf({ dps, hitPeriod, castPeriod, reducedCd, aspdHitsPerSec });
  const whatIfMeaningful = !!rawWhatIf && rawWhatIf.gainPercent >= MIN_MEANINGFUL_GAIN_PERCENT;
  const whatIf = whatIfMeaningful ? rawWhatIf : null;

  // Recarga is fixed per-skill and never reducible, so it never contributes to
  // "is there anything left to optimize" — only fixa/variável (and the pós what-if) do.
  // When ASPD is the limiter there's always something to improve (raise ASPD), so it
  // forces isOptimized false regardless of the cast components' own state.
  const isOptimized = !aspdLimits && !whatIfMeaningful && fixaZero && variavelZero;

  // Bottleneck is ASPD itself when it can't keep up with what the cast mechanics allow;
  // otherwise fall back to the usual largest-cast-component logic.
  const bottleneck: CastComponentKey = aspdLimits ? 'aspd' : identifyCastBottleneck({ reducedFct, reducedVct, reducedAcd, reducedCd });

  const components: CastComponentInfo[] = [
    {
      key: 'fixa',
      label: text('opt.fixa'),
      seconds: reducedFct,
      hint: text('opt.hintFixa'),
      doneText: fixaZero ? text('opt.doneZeroed') : null,
    },
    {
      key: 'variavel',
      label: text('opt.variavel'),
      seconds: reducedVct,
      hint: text('opt.hintVariavel', { sum: sumDex2Int1, missing: toZero }),
      doneText: variavelStatsMet
        ? text('opt.doneStats')
        : reducedVct < ZERO_SECONDS_EPS ? text('opt.doneZeroed') : null,
    },
    {
      key: 'pos',
      label: text('opt.pos'),
      seconds: reducedAcd,
      hint: text('opt.hintPos'),
      doneText: posZero ? text('opt.doneZeroed') : null,
    },
    {
      key: 'recarga',
      label: text('opt.recarga'),
      seconds: reducedCd,
      hint: text('opt.hintRecarga'),
      doneText: null,
    },
    {
      key: 'aspd',
      label: text('opt.aspd'),
      seconds: 0,
      hideSeconds: true,
      hint: aspdLimits
        ? text('opt.hintAspd', { cast: fmtRate(castRate), aspd: fmtRate(aspdHitsPerSec) })
        : '',
      doneText: aspdLimits ? null : text('opt.doneAspd', { aspd: fmtRate(aspdHitsPerSec), cast: fmtRate(castRate) }),
    },
  ];

  const headline = aspdLimits
    ? text('opt.headlineAspd')
    : isOptimized
      ? text('opt.headlineOptimized')
      : text('opt.headlineBottleneck', { component: components.find((c) => c.key === bottleneck)!.label });

  return { isOptimized, headline, bottleneck, components, whatIf };
}

export type DpsSide = 'current' | 'simulated' | 'tie';

/** The larger DPS side renders with the bigger font (46px vs 29px in the component CSS). */
export function pickBiggerDpsSide(currentDps: number, simulatedDps: number): DpsSide {
  if (currentDps > simulatedDps) return 'current';
  if (simulatedDps > currentDps) return 'simulated';
  return 'tie';
}

export interface HeroDamage {
  dps: number;
  min: number;
  max: number;
  effected: boolean;
}

/**
 * Hero DPS/damage-per-use selection: use the "effected" (chance-triggered)
 * figures when present, otherwise the base skill figures — same effected||base
 * fallback the legacy template applies per-field.
 *
 * `hasSelectedChances` gates the effected figures even when they're numerically
 * present: when the last Efeito is unselected, the parent pipeline's needCalc=false
 * branch never refreshes totalSummary, so dmg.effectedSkillDamageMin can stay stale
 * (nonzero) after unselecting. Legacy avoids this by gating every "Acionado" row on
 * `selectedChances?.length` in the template; this mirrors that at the source.
 */
export function pickHeroDamage(
  dmg: {
    skillDps?: number;
    skillMinDamage?: number;
    skillMaxDamage?: number;
    effectedSkillDps?: number;
    effectedSkillDamageMin?: number;
    effectedSkillDamageMax?: number;
  } | null | undefined,
  hasSelectedChances: boolean,
): HeroDamage {
  if (!dmg) return { dps: 0, min: 0, max: 0, effected: false };
  const hasEffected = hasSelectedChances && (dmg.effectedSkillDamageMin ?? 0) > 0;
  return {
    dps: (hasEffected ? dmg.effectedSkillDps : dmg.skillDps) || 0,
    min: (hasEffected ? dmg.effectedSkillDamageMin : dmg.skillMinDamage) || 0,
    max: (hasEffected ? dmg.effectedSkillDamageMax : dmg.skillMaxDamage) || 0,
    effected: hasEffected,
  };
}

/**
 * "Hab./s" for one side of the HUD (the current build or the compare build).
 *
 * Same effected||base fallback as {@link pickHeroDamage}, gated on the same
 * `hasSelectedChances` flag for the same reason: unselecting the last Efeito
 * doesn't refresh totalSummary, so effectedSkillHitsPerSec can stay stale.
 *
 * Capped by VelAtq (calc.hitPerSecs) — the engine's own DPS math applies this
 * same cap (skillHitsPerSec = min(castRate, aspdRate), damage-calculator.ts),
 * and buildOptimizeInfo already flags when ASPD is the bottleneck; showing the
 * uncapped cast rate here would promise a rate the character can't reach.
 * A missing/zero cap means "no ASPD data" -> treat as uncapped.
 */
export function pickHitsPerSec(
  summary:
    | {
        dmg?: { effectedSkillHitsPerSec?: number };
        calcSkill?: { totalHitPerSec?: number };
        calc?: { hitPerSecs?: number };
      }
    | null
    | undefined,
  hasSelectedChances: boolean,
): number {
  if (!summary) return 0;
  const effected = hasSelectedChances ? summary.dmg?.effectedSkillHitsPerSec : null;
  const raw = effected || summary.calcSkill?.totalHitPerSec || 0;
  const aspdCap = summary.calc?.hitPerSecs || 0;

  return aspdCap > 0 ? Math.min(raw, aspdCap) : raw;
}

/** Percent delta of `simulated` vs `current`; null when `current` is 0 (can't express a ratio). */
export function deltaPercent(current: number, simulated: number): number | null {
  if (!current) return null;
  return ((simulated - current) / current) * 100;
}

export interface TimeToKill {
  /** Raw seconds — kept alongside `text` so callers can compare the two sides. */
  seconds: number;
  text: string;
}

/** Past this the figure stops being useful (the practice Dummy has 2 billion HP, which
 *  runs to hundreds of hours) — show a bound instead of a precise-looking number. */
export const TTK_CAP_SECONDS = 24 * 60 * 60;

/** `12,3s` / `2min 05s` / `1h 23min` — the unit shrinks as the duration grows, so short
 *  fights keep their tenths and long ones don't read as a wall of seconds. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${formatNumber(seconds, 0, 1)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}min ${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
  }
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}min`;
}

/**
 * How long this build takes to kill the target: the monster's HP divided by the DPS
 * already shown in the HUD, so the two always reconcile. `dps` is the same
 * effected-or-base figure pickHeroDamage selects — it's accuracy- and crit-weighted and
 * ASPD-capped by the engine, so this inherits all of that rather than re-deriving it.
 *
 * Null when there's nothing meaningful to show: no DPS (autospell builds display none)
 * or no HP.
 */
export function computeTimeToKill(hp: number, dps: number): TimeToKill | null {
  if (!(dps > 0) || !(hp > 0)) return null;
  const seconds = hp / dps;
  return { seconds, text: seconds > TTK_CAP_SECONDS ? '> 24h' : formatDuration(seconds) };
}

export interface FormulaGraphCluster {
  stage: DamageFormulaNode;
  inputs: DamageFormulaNode[];
}

const fmtCalc = formatCalcNumber;
const fmtSigned = formatSignedCalcNumber;

/** Most stage labels already end in the percentage they apply ("Hab. Base 2475%",
 *  "ATQ +25%"), so naming the chips after them verbatim would read "Hab. Base 2475% %".
 *  Strip that trailing figure — the chip's own value carries it. */
const stripTrailingPercent = (label: string): string => label.replace(/\s*[+-]?[\d.,]+\s*%\s*$/, '');

/**
 * Every stage is a mutation of a running total, so on its own it only answers "what is
 * the value now" — not "what did this step actually do". These two synthesized chips
 * answer that: the percentage that was applied, and the absolute amount it added.
 *
 * The "Adicional" chip is deliberately `stage.value - prev.value` rather than any
 * engine-side increment (e.g. getAtkGroupA's `aVal`): only the difference of the two
 * real, already-verified stage totals guarantees `anterior + adicional = resultado`
 * exactly. `aVal` doesn't — floor() and the property multiplier sit between it and the
 * stage total — so showing it here would produce an identity that visibly fails to add up.
 * That same floor() is why `anterior × %` can differ slightly from the adicional, which
 * the note on the calc spells out.
 */
function synthesizeChips(stage: DamageFormulaNode, prev: DamageFormulaNode | null): DamageFormulaNode[] {
  const chips: DamageFormulaNode[] = [];

  if (stage.percent != null) {
    chips.push({
      id: `${stage.id}_pct`,
      label: `${stripTrailingPercent(stage.label)} %`,
      value: stage.percent,
      unit: 'percent',
      // Always signed: the percentage is what this stage added *on top of* the running
      // total, so "+2375%" can't be misread as "this stage's total is 2375%" (the stage
      // box itself already shows the skill's own 2475% ratio).
      showSign: true,
      keys: stage.keys,
      inputs: [],
      kind: 'input',
    });
  }

  const delta = prev ? stage.value - prev.value : 0;
  if (prev && delta !== 0) {
    // A stage carrying its own derivation (the class ATQ adjustment — see
    // CharacterBase.getFinalAtkCalc) lends its working to the chip: the reader clicked
    // "Adicional" to ask where the number came from, and "anterior + adicional" alone is
    // the one answer that never says. Its own emphasised total is dropped, because the
    // chip closes on the same figure as its own "Resultado" row.
    const stageRows = (stage.calc?.rows ?? []).filter((r) => !r.emphasis);

    const rows: DamageFormulaCalcRow[] = [{ label: `Valor anterior (${prev.label})`, display: fmtCalc(prev.value) }];
    rows.push(...stageRows);
    if (stage.percent != null) rows.push({ label: 'Multiplicador', display: `${fmtSigned(stage.percent)}%` });
    rows.push({ label: 'Adicional', display: fmtSigned(delta) });
    rows.push({ label: `Resultado (${stage.label})`, display: fmtCalc(stage.value), emphasis: true });

    chips.push({
      id: `${stage.id}_delta`,
      label: `${stripTrailingPercent(stage.label)} Adicional`,
      value: delta,
      showSign: true,
      inputs: [],
      kind: 'input',
      calc: {
        rows,
        note:
          stage.calc?.note ??
          (stage.percent != null
            ? 'O jogo arredonda para baixo a cada etapa, então o adicional pode diferir levemente de anterior × %.'
            : undefined),
        link: stage.calc?.link,
      },
    });
  }

  return chips;
}

/**
 * Groups a flat DamageFormulaGraph node list into left-to-right clusters: one per
 * `stage` node, with any `input`-kind nodes it directly depends on attached as
 * contributing chips. Stage-to-stage dependencies need no chip — they're just the
 * next cluster in the sequence. See damage-calculator.ts buildAtkNodes/buildMatkNodes
 * for how nodes are constructed (each input pushed immediately before the stage
 * that consumes it, so a single left-to-right pass is enough — no topological sort).
 *
 * On top of the engine's own input nodes, each cluster gets the synthesized "%" and
 * "Adicional" chips described on synthesizeChips — they're derived purely from the
 * stage list, so they live here rather than in the engine.
 */
export function buildGraphClusters(graph: DamageFormulaGraph | undefined | null): FormulaGraphCluster[] {
  if (!graph?.nodes?.length) return [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const consumed = new Set<string>();
  const clusters: FormulaGraphCluster[] = [];
  let prevStage: DamageFormulaNode | null = null;

  for (const node of graph.nodes) {
    if (node.kind !== 'stage') continue;
    const inputs: DamageFormulaNode[] = [];
    for (const inputId of node.inputs) {
      const inputNode = byId.get(inputId);
      if (inputNode?.kind === 'input' && !consumed.has(inputId)) {
        inputs.push(inputNode);
        consumed.add(inputId);
      }
    }
    inputs.push(...synthesizeChips(node, prevStage));
    clusters.push({ stage: node, inputs });
    prevStage = node;
  }

  return clusters;
}

export interface DpsSteps {
  avgBasicDamage: number;
  criRate: number;
  accuracy: number;
  /** The crit damage one hit deals — the other outcome `avgDamagePerHit` averages. */
  criDmg: number;
  /** `criDmg x criRate`, expressed in damage (calc-dmg-dps works in percent units and
   *  divides by 100 at the end; these two are already divided, so they sum to the mean). */
  criPart: number;
  /** `avgBasicDamage x (100 - criRate)`, accuracy applied — the non-crit leg. */
  noCriPart: number;
  avgDamagePerHit: number;
  hitsPerSec: number;
  oneHitDps: number;
  totalHit: number;
  /** Damage for one use, summed over every hit and with no rate applied. This is the
   *  figure the rotation rows show — see skillDamagePerUse in rotation-view.ts. */
  damagePerUse: number;
  totalDps: number;
}

/**
 * Whether a skill's per-use damage is a crit-weighted *mean* of two different outcomes
 * rather than a single number — which is exactly when the panel owes the reader all
 * three readings (sem crít., com crít., média) instead of one unlabelled figure.
 *
 * At 0% the skill never crits and at 100% it always does; either way the three collapse
 * to one and printing them three times would say nothing.
 */
export function isCritWeighted(canCri: boolean | undefined, criRate: number | undefined): boolean {
  const rate = criRate ?? 0;
  return !!canCri && rate > 0 && rate < 100;
}

/**
 * Rebuilds the "step by step" arithmetic behind a skill's DPS, from the exact
 * values the engine fed into calcDmgDps() (dmg.skillDpsInput*, damage-calculator.ts)
 * plus the hit count — so this always reconciles with the displayed skillDps,
 * instead of approximating a formula the UI doesn't otherwise have visibility into.
 */
export function buildDpsSteps(dmg: {
  skillDpsInputMin?: number;
  skillDpsInputMax?: number;
  skillDpsInputCriDmg?: number;
  skillDpsInputHitsPerSec?: number;
  skillCriRateToMonster?: number;
  skillAccuracy?: number;
  skillTotalHit?: number;
} | null | undefined): DpsSteps | null {
  if (!dmg) return null;
  const detailed = calcDmgDpsDetailed({
    min: dmg.skillDpsInputMin || 0,
    max: dmg.skillDpsInputMax || 0,
    cri: dmg.skillCriRateToMonster || 0,
    criDmg: dmg.skillDpsInputCriDmg || 0,
    hitsPerSec: dmg.skillDpsInputHitsPerSec || 0,
    accRate: dmg.skillAccuracy || 0,
  });
  const totalHit = dmg.skillTotalHit || 0;
  return {
    avgBasicDamage: detailed.avgBasicDamage,
    criRate: detailed.limitedCriRate,
    accuracy: detailed.limitedAccuracy,
    criDmg: dmg.skillDpsInputCriDmg || 0,
    criPart: detailed.criHit / 100,
    noCriPart: detailed.nonCriHit / 100,
    avgDamagePerHit: detailed.totalDamage,
    hitsPerSec: dmg.skillDpsInputHitsPerSec || 0,
    oneHitDps: detailed.oneHitDps,
    totalHit,
    damagePerUse: totalHit * detailed.totalDamage,
    totalDps: Math.floor(totalHit * detailed.oneHitDps),
  };
}

/** One entry of the rotation's add picker. `isBasic` marks the classless ataque básico. */
export interface RotationPickerOption {
  label: string;
  value: string;
  icon?: number;
  isBasic?: boolean;
  levelList?: { label: string; value: any }[];
}

/**
 * The rotation add picker's options: ataque básico first, then the class's offensive skills.
 *
 * Ataque básico is offered unconditionally, to every class. It used to follow the app-config
 * "Ocultar Ataque Básico" switch, which is from 2023 and means "hide the basic-attack panel in
 * the old Resumo de Batalha" — there the basic attack is a panel, here it is a choice. Since
 * that switch defaults to on, reusing it made a rotation unable to include the basic attack at
 * all until someone found and turned it off.
 *
 * `basicAttackValue` is passed in rather than imported so this module stays free of the core
 * rotation import; the component supplies BASIC_ATTACK_VALUE.
 */
export function buildRotationPickerOptions(
  basicAttackValue: string,
  atkSkills: { label: string; value: string; icon?: number; levelList?: any[] }[] | null | undefined,
  text: Translate,
): RotationPickerOption[] {
  const options: RotationPickerOption[] = [{ label: text('skd.basicAttack'), value: basicAttackValue, isBasic: true }];

  for (const skill of atkSkills ?? []) {
    options.push({ label: skill.label, value: skill.value, icon: skill.icon, levelList: skill.levelList });
  }

  return options;
}



/** One row of the "Tx. Crítico" popover: a step of the current build's derivation, with
 *  the compared build's figure for the same step when the two line up. */
export interface CritRateRow {
  step: CritRateStep;
  /** Null when there is nothing to compare, or when the two derivations do not match. */
  sim: number | null;
}

/**
 * Pairs the two builds' crit derivations row by row.
 *
 * Only when they are step-for-step the same shape. They can genuinely differ — swapping to
 * a katar doubles the character crit and moves the target's shield ahead of the skill's
 * percentage, so the two sides stop being the same calculation — and pairing those rows by
 * position would put a number under a label that did not produce it. In that case the
 * comparison column is simply dropped; the totals still sit side by side above.
 */
export function alignCritRateSteps(current: CritRateBreakdown | null | undefined, compare: CritRateBreakdown | null | undefined): CritRateRow[] {
  const steps = current?.steps ?? [];
  const simSteps = compare?.steps ?? [];
  const sameShape = simSteps.length === steps.length && steps.every((s, i) => s.key === simSteps[i].key);

  return steps.map((step, i) => ({ step, sim: sameShape ? simSteps[i].value : null }));
}

/**
 * Holds the aligned rows steady while the breakdown behind them is unchanged.
 *
 * Not an optimisation. The rows feed an `*ngFor`, which diffs by object identity, and the
 * getter behind them is read on every change-detection pass. Building fresh rows there makes
 * every row "new" each pass, so Angular tears the list down and rebuilds it constantly —
 * including on the `mousedown` that precedes a click, which detaches the very node the user
 * is about to click before the `click` can reach it. That is what stopped "CRIT de
 * equipamentos" opening its sources, and it is the same failure the formula graph's cluster
 * cache exists for (see toClusterPair in battle-hud.component.ts).
 *
 * Keyed on object identity rather than contents: the engine hands back a fresh summary
 * whenever anything is recalculated, so a new object is exactly the signal to rebuild.
 */
export class CritRateRowCache {
  private current: CritRateBreakdown | null | undefined;
  private compare: CritRateBreakdown | null | undefined;
  private rows: CritRateRow[] = [];
  private primed = false;

  get(current: CritRateBreakdown | null | undefined, compare: CritRateBreakdown | null | undefined): CritRateRow[] {
    if (this.primed && current === this.current && compare === this.compare) return this.rows;

    this.current = current;
    this.compare = compare;
    this.rows = alignCritRateSteps(current, compare);
    this.primed = true;

    return this.rows;
  }
}

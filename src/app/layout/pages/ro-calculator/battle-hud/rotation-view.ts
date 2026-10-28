// Turns the engine's per-skill solves into everything the rotation panel draws.
// Pure (no Angular imports), like battle-hud.logic.ts, so it is unit-testable with
// plain Vitest. It only reshapes numbers the engine already produced — it never
// re-derives game truth. The timing itself lives in src/app/core/rotation-schedule.ts.

import { BASIC_ATTACK_VALUE, isBasicAttack } from '../../../../core/rotation';
import { RotationCycle, RotationLane, RotationScheduleStep, simulateRotation } from '../../../../core/rotation-schedule';
import { SkillType } from '../../../../models/damage-summary.model';
import { dmgTypeLabel } from '../../../../utils/dmg-type-label';
import { buildDpsSteps, formatDuration, isCritWeighted, TimeToKill, TTK_CAP_SECONDS } from './battle-hud.logic';

/** The catalog fields a rotation row needs to render itself. */
export interface RotationSkillMeta {
  value?: string;
  values?: string[];
  label?: string;
  icon?: number;
  levelList?: { label: string; value: any }[];
  maxStack?: number;
  minStack?: number;
  defaultStack?: number;
  /** `boolean` when the skill always (or never) crits; a function when it depends on
   *  the character's state — which is what makes the row's crit reading conditional. */
  canCri?: boolean | ((input: any) => boolean);
  /** Declared on skills whose whole point is not to hit — see {@link RotationEntryView.isUtility}. */
  isUtility?: boolean;
}

export interface RotationEntryView {
  index: number;
  /** The `"Name==Level"` value, or BASIC_ATTACK_VALUE. */
  value: string;
  isBasic: boolean;
  /** Skill name without the level, e.g. "Chute Solar". */
  name: string;
  /** "Nv7", or empty for ataque básico and for skills that carry no level. */
  levelLabel: string;
  icon?: number;
  /** Levels this entry can be switched between; empty when the catalog fixes the level.
   *  Only 7 job files declare `levelList`, so most rows show a static level. */
  levelList: { label: string; value: any }[];
  stackOptions: { label: string; value: number }[];
  stackCount: number;
  /** Total damage for one use, summed over every hit. */
  damage: number;
  contributionPercent: number;
  /** "Corpo a corpo" / "À distância" / "Mágico". */
  dmgTypeLabel: string;
  element: string;
  propertyMultiplier: number;
  /** Set when the build cannot cast this skill (weapon gating). Damage is then 0. */
  requireTxt: string;
  /**
   * Whether the row has any damage to report. False for a utility skill that never hits
   * (Esconderijo, Infiltrar — cards bLnU1DLpGeA2vxQ794I4 e FPpmOoKCq7KzPxV4NUZ3) and for
   * a skill this build cannot cast at all.
   *
   * The row then leaves out every damage reading instead of printing a zero next to a
   * neutral element and "Sem crít." — figures that describe a hit that never happens. What
   * it still carries is what the skill is in the rotation for: its place and its time.
   * Which of the two it is, {@link requireTxt} says.
   */
  showsDamage: boolean;
  /**
   * Crit state, which every row states explicitly — silence would read as missing data.
   * `canCrit` false renders "Sem crít."; true renders the rate.
   */
  canCrit: boolean;
  critRate: number;
  /**
   * Magic never crits in this game, so a magic row saying "Sem crít." is stating a property
   * of the whole damage type rather than anything about this skill. The row leaves it out —
   * unlike a physical skill that cannot crit, where the absence really is worth naming.
   */
  isMagic: boolean;
  /**
   * Whether that reading depends on the character's state. Derived from the catalog
   * entry's `canCri` being a *function* rather than a flag — the only honest signal
   * available, since no skill declares which state it needs (see docs/combo.md §7).
   * The condition itself therefore cannot be named, only flagged.
   */
  critConditional: boolean;
  /**
   * True when {@link damage} is a crit-weighted *mean* rather than a single outcome —
   * the skill crits some of the time, so the row's figure sits between the sem-crít. and
   * com-crít. readings the skill card shows. The row labels itself on this, because a
   * bare number next to "Crít. 38,0%" reads as an invitation to apply the 38% again.
   */
  critWeighted: boolean;
  /**
   * The outcomes {@link damage} averages, each as the min–max roll it actually is: the
   * non-crit roll and the crit one where the skill crits some of the time, a single roll
   * where it does not. The same figures the skill card prints.
   */
  damageRanges: DamageRange[];
  /**
   * Whether those rolls say anything the mean does not. False for a single roll that never
   * varies — three copies of one number is not a reading — and it is also what decides
   * whether the row's figure has a mean to explain at all.
   */
  hasDamageSpread: boolean;
  /**
   * The rotation idled on *this* entry's own recarga — the red "Recarga não fecha" state.
   *
   * Always false for a one-entry rotation: there the skill simply repeats on its own
   * timer and the wait *is* the cycle, so every skill with a cooldown would be flagged
   * (Firmamento reported 59,53s missing on a perfectly normal rotation). This mirrors
   * `isSingleEntryRotation` in battle-hud.component.ts, which suppresses `showsFirstCycle`
   * for the same reason.
   */
  stalled: boolean;
  /** How many times this same skill appears before this entry — drives the "2ª vez" note. */
  occurrence: number;
  /** The full `getTotalSummary()` this entry was solved with, for its (i) popover. */
  summary: any;
  lane: RotationLane;
}

export interface RotationView {
  timingUnknown?: boolean;
  entries: RotationEntryView[];
  cycle: RotationCycle;
  /** Null when nothing can die — zero DPS, or an immune target. */
  ttk: TimeToKill | null;
  /** Cycles needed to kill the target. */
  cyclesToKill: number;
  /** Entries the build cannot actually cast. */
  blocked: { name: string; requireTxt: string }[];
  /** Seconds per action imposed by VelAtq. */
  aspdPeriod: number;
}

const splitValue = (value: string): { name: string; level: string } => {
  const [, name, level] = value?.match(/(.+)==(\d+)/) ?? [];
  return { name: name ?? value ?? '', level: level ?? '' };
};

/**
 * One outcome a row's damage can take, as the roll it is rather than a single point.
 *
 * `kind` names the formula branch that explains it, which is what a click on the figure has
 * to open; `label` is the tag the row prints beside it.
 */
export interface DamageRange {
  kind: 'nocri' | 'cri' | 'flat';
  label: string;
  min: number;
  max: number;
}

/** One row's damage readings: the mean, and the rolls it is a mean of. */
interface DamageReadings {
  damage: number;
  ranges: DamageRange[];
}

const NO_DAMAGE: DamageReadings = { damage: 0, ranges: [] };

/** A roll earns its place on the row when it is a real span, or when there is a sibling to
 *  contrast it with. One roll that never varies is already the mean. */
const isSpread = (ranges: DamageRange[]): boolean => ranges.length > 1 || ranges.some((r) => r.min !== r.max);

/**
 * The effected pass's DPS inputs when Efeitos are ticked, the base ones otherwise —
 * the same effected-or-base rule {@link pickHeroDamage} applies to the hero figure, and
 * gated on the same flag for the same reason (unticking the last Efeito can leave
 * `effected*` stale).
 *
 * Without this the rows read the un-effected inputs, so ticking an Efeito moved the hero
 * DPS and the (i) popover but left every row and the cycle total untouched.
 */
function effectedDpsInputs(dmg: any, hasSelectedChances: boolean): any {
  if (!dmg) return dmg;
  const hasEffected = hasSelectedChances && (dmg.effectedSkillDpsInputMin ?? 0) > 0;
  if (!hasEffected) return dmg;

  return {
    ...dmg,
    skillDpsInputMin: dmg.effectedSkillDpsInputMin,
    skillDpsInputMax: dmg.effectedSkillDpsInputMax,
    skillDpsInputCriDmg: dmg.effectedSkillDpsInputCriDmg,
    skillDpsInputHitsPerSec: dmg.effectedSkillDpsInputHitsPerSec,
    skillCriRateToMonster: dmg.effectedSkillCriRateToMonster,
    skillAccuracy: dmg.effectedSkillAccuracy,
    skillTotalHit: dmg.effectedSkillTotalHit,
  };
}

/**
 * Per-use damage for one skill: the engine's own damage arithmetic (accuracy- and
 * crit-weighted, summed over every hit), with no rate applied.
 *
 * DELIBERATE DIVERGENCE from `dmg.skillDps`. The engine derives its DPS through
 * truncations that are invisible at high rates and lossy at low ones:
 * `totalHitPerSec = floor(1 / hitPeriod, 6)` (calc-skill-aspd.ts) and
 * `oneHitDps = floor(hitsPerSec * totalDamage)` (calc-dmg-dps.ts) — that second floor
 * takes a slow skill's per-second damage down to whole units before the hit count
 * multiplies it back up.
 *
 * The rotation divides real damage by real time, so it reports the true rate, and it is
 * why this panel was already correct while the one-decimal `totalHitPerSec` had the old
 * tab reporting 60s-cooldown skills 122x too high. See docs/combo.md.
 */
function skillDamagePerUse(dmg: any): DamageReadings {
  const steps = buildDpsSteps(dmg);
  if (!steps) return NO_DAMAGE;

  const damage = steps.damagePerUse;
  const canCrit = !!dmg?.skillCanCri;
  const rate = dmg?.skillCriRateToMonster ?? 0;
  // skillMin/MaxDamage are already per-use totals — the card divides them by the hit count
  // to get its "cada" line — so these sit on the same scale as the mean.
  const cri: DamageRange = { kind: 'cri', label: 'crít.', min: dmg?.skillMinDamage ?? 0, max: dmg?.skillMaxDamage ?? 0 };

  if (isCritWeighted(canCrit, rate)) {
    const noCri: DamageRange = {
      kind: 'nocri',
      label: 'sem crít.',
      min: dmg?.skillMinDamageNoCri ?? 0,
      max: dmg?.skillMaxDamageNoCri ?? 0,
    };

    return { damage, ranges: [noCri, cri] };
  }
  // Every use crits, so the crit roll is the only outcome there is; the no-crit figures are
  // rolls this build never actually takes, and naming them would be a lie.
  if (canCrit && rate >= 100) return { damage, ranges: [cri] };

  return { damage, ranges: [{ ...cri, kind: 'flat', label: 'dano' }] };
}

/** Per-use damage for ataque básico. `basicDps` is already damage x rate, so dividing by
 *  the rate recovers the damage exactly rather than re-deriving it from min/max/crit. */
function basicDamagePerUse(summary: any, hasSelectedChances: boolean): DamageReadings {
  const dmg = summary?.dmg;
  const rate = summary?.calc?.hitPerSecs || 0;
  if (!dmg || rate <= 0) return NO_DAMAGE;

  const dps = (hasSelectedChances ? dmg.effectedBasicDps : 0) || dmg.basicDps || 0;
  const damage = dps / rate;
  // The same two rolls damage-calculator.ts hands calcDmgDps for basicDps, so the pair the
  // row prints is the pair the mean was actually built from.
  const plain: DamageRange = { kind: 'nocri', label: 'sem crít.', min: dmg.basicMinDamage || 0, max: dmg.basicMaxDamage || 0 };

  if (isCritWeighted((dmg.criRateToMonster ?? 0) > 0, dmg.criRateToMonster)) {
    return { damage, ranges: [plain, { kind: 'cri', label: 'crít.', min: dmg.criMinDamage || 0, max: dmg.criMaxDamage || 0 }] };
  }

  return { damage, ranges: [{ ...plain, kind: 'flat', label: 'dano' }] };
}

/**
 * Map one solved summary onto the scheduler's per-step timing.
 *
 * `castPeriod` is used rather than `reducedFct + reducedVct` so that `hitEveryNSec`
 * skills come through the way calc-skill-aspd already treats them: the channel time is
 * the cast and the block period is zero. `blockPeriod === 0` is exactly that signal.
 */
export function toScheduleStep(input: { value: string; summary: any; damage: number }): RotationScheduleStep {
  const { value, summary, damage } = input;
  if (isBasicAttack(value)) {
    return { key: BASIC_ATTACK_VALUE, cast: 0, acd: 0, cd: 0, damage };
  }

  const calcSkill = summary?.calcSkill ?? {};
  const cast = calcSkill.castPeriod || 0;
  const blockPeriod = Math.max(0, (calcSkill.hitPeriod || 0) - cast);
  const channelled = blockPeriod <= 0 && (calcSkill.reducedAcd > 0 || calcSkill.reducedCd > 0);

  return {
    // Recarga is per skill, shared across its levels, so the name is the identity.
    key: splitValue(value).name,
    timingUnknown: calcSkill.timingUnknown,
    cast,
    acd: channelled ? 0 : calcSkill.reducedAcd || 0,
    cd: channelled ? 0 : calcSkill.reducedCd || 0,
    damage,
    ignoreAspdFloor: calcSkill.ignoreAspdFloor,
  };
}

/**
 * When the target actually dies, walked off the schedule instead of divided out of the
 * sustained DPS.
 *
 * `hp / sustainedDps` smears one burst across the whole cycle, which for a 60s-recarga
 * skill answers a question nobody asked: Firmamento reported "Morre em 24,6s" next to
 * "1 usos" for a target that one cast overkills at ~1s. Damage is discrete — it lands
 * when a cast ends — so the honest reading is the moment the running total passes the
 * target's HP.
 *
 * The steady cycle is repeated for every pass, including the first. That is slightly
 * pessimistic (the first pass has every recarga clear and closes sooner), which the
 * panel already reports separately as "PRIMEIRO CICLO" rather than folding in here.
 */
export function computeRotationTimeToKill(hp: number, cycle: RotationCycle): TimeToKill | null {
  if (!(hp > 0) || !(cycle?.damagePerCycle > 0) || !(cycle.cycleDuration > 0)) return null;

  const cycles = Math.ceil(hp / cycle.damagePerCycle);
  let dealt = 0;

  for (let c = 0; c < cycles; c++) {
    for (const lane of cycle.lanes) {
      if (!(lane.damage > 0)) continue;
      dealt += lane.damage;
      if (dealt >= hp) {
        // The blow lands when its cast ends, not when the step was scheduled.
        const seconds = c * cycle.cycleDuration + lane.castEnd;
        return { seconds, text: seconds > TTK_CAP_SECONDS ? '> 24h' : formatDuration(seconds) };
      }
    }
  }

  return null;
}

export function buildRotationView(input: {
  rotation: string[];
  /** One solved `getTotalSummary()` per distinct rotation value. */
  summaryByValue: Map<string, any>;
  /** Any solved summary — ataque básico and the VelAtq floor read from it. */
  baseSummary: any;
  hasSelectedChances: boolean;
  atkSkills: RotationSkillMeta[];
  skillStacks?: Record<string, number>;
  rotationStacks?: number[];
  summaryByIndex?: Map<number, any>;
}): RotationView {
  const { rotation, summaryByValue, summaryByIndex, baseSummary, hasSelectedChances, atkSkills, skillStacks, rotationStacks } = input;

  const metaFor = (value: string): RotationSkillMeta | undefined =>
    atkSkills?.find((s) => s.value === value || s.values?.includes(value) || s.levelList?.some((l) => l.value === value));

  const aspdPeriod = baseSummary?.calc?.hitPerSecs > 0 ? 1 / baseSummary.calc.hitPerSecs : 0;

  const seen = new Map<string, number>();
  const partial = (rotation ?? []).map((value, index) => {
    const basic = isBasicAttack(value);
    const summary = basic ? baseSummary : summaryByIndex?.get(index) ?? summaryByValue.get(value) ?? baseSummary;
    const dmg = summary?.dmg;
    const { name, level } = splitValue(value);
    const meta = metaFor(value);
    const stackMin = meta?.minStack ?? 0;
    const stackMax = meta?.maxStack ?? 0;
    const savedStack = rotationStacks?.[index] ?? skillStacks?.[name];
    const stackCount = stackMax > 0
      ? Math.max(stackMin, Math.min(stackMax, Number.isFinite(savedStack) ? savedStack : (meta?.defaultStack ?? stackMax)))
      : 0;

    // One effected-or-base view of this skill's numbers, so the crit the row prints is
    // the crit its damage was computed with.
    const edmg = basic ? dmg : effectedDpsInputs(dmg, hasSelectedChances);
    const requireTxt = basic ? '' : dmg?.requireTxt || '';
    // A utility skill reads 0 from the chain already (see utility-skill-no-damage.spec.ts);
    // saying so here is what lets the row drop the readings rather than print the zeros.
    const noDamage = !basic && (!!requireTxt || !!meta?.isUtility);
    const readings = noDamage ? NO_DAMAGE : basic ? basicDamagePerUse(summary, hasSelectedChances) : skillDamagePerUse(edmg);

    const occurrence = seen.get(value) ?? 0;
    seen.set(value, occurrence + 1);

    return {
      index,
      value,
      isBasic: basic,
      name: basic ? 'Ataque básico' : meta?.label?.replace(/\s*Nv\d+.*$/, '') || name,
      levelLabel: basic || !level ? '' : `Nv${level}`,
      icon: meta?.icon,
      levelList: meta?.levelList ?? [],
      stackOptions: stackMax > 0 ? Array.from({ length: stackMax - stackMin + 1 }, (_, n) => ({ label: String(n + stackMin), value: n + stackMin })) : [],
      stackCount,
      damage: readings.damage,
      damageRanges: readings.ranges,
      hasDamageSpread: isSpread(readings.ranges),
      contributionPercent: 0,
      dmgTypeLabel: basic ? dmgTypeLabel('Melee') : dmgTypeLabel(summary?.calcSkill?.dmgType ?? ''),
      element: basic ? summary?.propertyAtk ?? '' : summary?.calcSkill?.propertySkill ?? '',
      propertyMultiplier: basic ? 1 : dmg?.skillPropertyMultiplier ?? 1,
      requireTxt,
      showsDamage: !noDamage,
      // Ataque básico always rolls crit; a skill only where the engine says so.
      isMagic: !basic && summary?.calcSkill?.dmgType === SkillType.MAGICAL,
      canCrit: basic ? (dmg?.criRateToMonster ?? 0) > 0 : !!dmg?.skillCanCri,
      critRate: basic ? dmg?.criRateToMonster ?? 0 : edmg?.skillCriRateToMonster ?? 0,
      critConditional: !basic && typeof meta?.canCri === 'function',
      // Ataque básico's own damage figure is recovered from basicDps, which is averaged
      // the same way, so both kinds of row answer this the same question.
      critWeighted: isCritWeighted(
        basic ? (dmg?.criRateToMonster ?? 0) > 0 : !!dmg?.skillCanCri,
        basic ? dmg?.criRateToMonster ?? 0 : edmg?.skillCriRateToMonster ?? 0,
      ),
      occurrence,
      summary,
    };
  });

  const cycle = simulateRotation({
    steps: partial.map((entry) => toScheduleStep({ value: entry.value, summary: entry.summary, damage: entry.damage })),
    aspdPeriod,
  });

  // A one-entry rotation cannot stall on itself — see RotationEntryView.stalled.
  const isSingleEntry = partial.length < 2;
  const entries: RotationEntryView[] = partial.map((entry, i) => ({
    ...entry,
    contributionPercent: cycle.lanes[i]?.contributionPercent ?? 0,
    lane: cycle.lanes[i],
    stalled: !isSingleEntry && (cycle.lanes[i]?.cdWait ?? 0) > 1e-3,
  }));

  const monsterHp = baseSummary?.monster?.hp || 0;

  return {
    entries,
    timingUnknown: partial.some(entry => !entry.isBasic && entry.summary?.calcSkill?.timingUnknown),
    cycle,
    ttk: computeRotationTimeToKill(monsterHp, cycle),
    cyclesToKill: cycle.damagePerCycle > 0 ? Math.ceil(monsterHp / cycle.damagePerCycle) : 0,
    blocked: entries.filter((e) => e.requireTxt).map((e) => ({ name: e.name, requireTxt: e.requireTxt })),
    aspdPeriod,
  };
}

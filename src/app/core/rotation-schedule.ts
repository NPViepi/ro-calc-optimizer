/**
 * Cycle timing for an attack rotation.
 *
 * Per skill: **fixa -> variável** run in sequence, and when the cast ends the
 * **pós-conjuração and the recarga start together**. Pós blocks *every* skill (it is the
 * global cooldown); recarga blocks *only that skill*. On top of that, VelAtq (ASPD) is a
 * floor between actions, measured start-to-start.
 *
 *     start_i   = max(gate, ready[key_i])
 *     castEnd_i = start_i + cast_i
 *     ready[key_i] = castEnd_i + cd_i          // recarga: this skill only
 *     gate      = max(castEnd_i + acd_i,       // pós: every skill
 *                     start_i + aspdPeriod)    // VelAtq floor, start-to-start
 *
 * A step that sets {@link RotationScheduleStep.ignoreAspdFloor} drops the second term:
 * the skill is not paced by the attack motion, so it releases the next action as soon as
 * its own pós-conjuração ends. It is per step, not per rotation — the skills around it
 * keep their floor.
 *
 * For a single-skill rotation this collapses to
 * `max(fct + vct + max(acd, cd), 1/aspd)` — exactly `calcSkillAspd`'s own `hitPeriod`
 * capped by ASPD. This module is a generalisation of `utils/calc-skill-aspd.ts`, not a
 * second source of truth, and `rotation-schedule.spec.ts` holds the two together.
 *
 * Waits are **absorbed into the cycle**, both the VelAtq wait and the recarga wait: the
 * rotation idles and the cycle gets longer, which is what makes the order matter at all.
 * A skill's own recarga spanning the cycle boundary is therefore normal, not an error —
 * see {@link RotationCycle.period} for the case that genuinely cannot be drawn.
 */

/** Times are seconds; the inputs are already rounded by `calcSkillAspd`. */
const EPSILON = 1e-6;

/** Cycles to unroll when solving for the steady state. */
const DEFAULT_MAX_CYCLES = 64;
/** How many trailing durations the period scan looks at. */
const TAIL_WINDOW = 16;
/** Longest super-cycle we bother naming. */
const MAX_PERIOD = 8;

export interface RotationScheduleStep {
  timingUnknown?: boolean;
  /**
   * Recarga identity. Use the skill *name*, not the `"Name==Level"` value: a cooldown is
   * per skill and shared across its levels. Ataque básico gets its own key and a zero
   * `cd`, so it never blocks anything.
   */
  key: string;
  /** `reducedFct + reducedVct`, i.e. `calcSkill.castPeriod`. For a `hitEveryNSec` skill
   *  the caller passes the channel time here and zeroes `acd`/`cd`, mirroring
   *  `blockPeriod = 0` in calc-skill-aspd.ts. */
  cast: number;
  /** Pós-conjuração, `reducedAcd`. Blocks every skill. */
  acd: number;
  /** Recarga, `reducedCd`. Blocks only this `key`. */
  cd: number;
  /** Total damage for one use, summed over all hits. */
  damage: number;
  /**
   * The VelAtq floor does not apply to this step — see `AtkSkillModel.ignoreAspdFloor`.
   * The step still *starts* no earlier than the previous pós-conjuração; it just does not
   * hold the next one back by `aspdPeriod`.
   */
  ignoreAspdFloor?: boolean;
}

/**
 * O piso de VelAtq que vale para um passo: zero para as habilidades que o pagam com a
 * própria pós-conjuração. O agendador aqui embaixo e a semente gulosa de
 * `rotation-optimize.ts` leem daqui, para a exceção ter um lugar só.
 */
export const aspdFloorOf = (step: Pick<RotationScheduleStep, 'ignoreAspdFloor'>, aspdPeriod: number): number =>
  step.ignoreAspdFloor ? 0 : aspdPeriod;

export interface RotationLane {
  start: number;
  castEnd: number;
  /** End of the pós-conjuração. Equals `castEnd` when `acd` is 0. */
  posEnd: number;
  /** End of the recarga. May sit past the end of the cycle — that is normal. */
  recEnd: number;
  /**
   * Idle *before* this lane's start that the VelAtq floor is responsible for — this
   * step is the one being held back, so the hatch belongs on its row.
   *
   * On the cycle's first lane the wait wraps from the previous pass, so it happens at
   * the end of the drawn window rather than before 0; the timeline places it there.
   */
  aspdWait: number;
  /** Idle before this lane's start caused by *its own* recarga not having elapsed
   *  (the red "faltam 0,40s" tail). Always 0 on the first cycle. */
  cdWait: number;
  damage: number;
  /** Share of the cycle's damage, in percent to one decimal. */
  contributionPercent: number;
}

export interface RotationCycle {
  /** One lane per rotation entry, normalised so the cycle starts at 0. */
  lanes: RotationLane[];
  /** Sustained cycle length. The mean over the super-cycle when `period > 1`. */
  cycleDuration: number;
  /** The first pass, with every recarga clear — always <= `cycleDuration`. */
  firstCycleDuration: number;
  damagePerCycle: number;
  sustainedDps: number;
  firstCycleDps: number;
  /** Total VelAtq idle in the steady cycle. */
  aspdWaitTotal: number;
  isAspdLimited: boolean;
  /** Total recarga idle in the steady cycle. */
  cdWaitTotal: number;
  /**
   * 1 when the rotation settles into one repeating cycle — the normal case, and the
   * only one where a single "Ciclo Xs" is literally true.
   *
   * `> 1` is a super-cycle: a recarga at a non-integer multiple of the natural cycle
   * makes successive cycles alternate (3,10 / 3,50 / 3,10 …). "O ciclo" is then not one
   * number, which is what earns the design's `Recarga não fecha` state and its
   * "estimativa" wording. `0` means it had not settled within the budget.
   */
  period: number;
  /** `period !== 1` — the numbers are a mean, not an exact cycle. */
  isEstimate: boolean;
  /** The cycle with no recarga constraints at all: `Σ max(cast + acd, aspdPeriod)`.
   *  Permutation-invariant, so it is both the optimiser's lower bound and the
   *  "ciclo sem o limite" figure for the VelAtq popover. */
  unconstrainedDuration: number;
}

/**
 * Split a total into percentages that add up to exactly 100,0 — largest remainder, so a
 * rotation's contributions never read as summing past 100%.
 */
export function distributePercents(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  if (!values.length || total <= 0) return values.map(() => 0);

  // Work in tenths of a percent so the result carries one decimal.
  const scaled = values.map((v) => ((v > 0 ? v : 0) / total) * 1000);
  const tenths = scaled.map((v) => Math.floor(v));
  const short = 1000 - tenths.reduce((sum, v) => sum + v, 0);

  const byRemainder = scaled
    .map((v, index) => ({ index, fraction: v - Math.floor(v) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < short && i < byRemainder.length; i++) tenths[byRemainder[i].index] += 1;

  return tenths.map((v) => v / 10);
}

/**
 * The smallest `p` for which the tail of `durations` repeats every `p`, or 0 when it
 * never settled. `p === 1` is a clean steady cycle.
 */
function detectPeriod(durations: number[]): number {
  const tail = durations.slice(-TAIL_WINDOW);
  const limit = Math.min(MAX_PERIOD, Math.floor(tail.length / 2));

  for (let p = 1; p <= limit; p++) {
    let repeats = true;
    for (let k = p; k < tail.length; k++) {
      if (Math.abs(tail[k] - tail[k - p]) > EPSILON) {
        repeats = false;
        break;
      }
    }
    if (repeats) return p;
  }

  return 0;
}

const emptyCycle = (): RotationCycle => ({
  lanes: [],
  cycleDuration: 0,
  firstCycleDuration: 0,
  damagePerCycle: 0,
  sustainedDps: 0,
  firstCycleDps: 0,
  aspdWaitTotal: 0,
  isAspdLimited: false,
  cdWaitTotal: 0,
  period: 1,
  isEstimate: false,
  unconstrainedDuration: 0,
});

/**
 * Unroll the rotation until its cycle length repeats, and report that steady cycle.
 *
 * Unrolling rather than solving a fixed point directly buys three things: the first
 * cycle (every recarga clear) falls out as cycle 0, a recarga that spans the cycle
 * boundary needs no circular definition, and a rotation that never settles to one period
 * is *observable* instead of silently averaged.
 */
export function simulateRotation(input: {
  steps: RotationScheduleStep[];
  aspdPeriod: number;
  maxCycles?: number;
}): RotationCycle {
  const { steps, aspdPeriod } = input;
  if (!steps?.length || steps.some(step => step.timingUnknown)) return emptyCycle();

  const maxCycles = Math.max(2, input.maxCycles ?? DEFAULT_MAX_CYCLES);
  const floor = aspdPeriod > 0 ? aspdPeriod : 0;

  const ready = new Map<string, number>();
  const cycles: { lanes: RotationLane[]; start: number; end: number }[] = [];
  let gate = 0;
  // The previous action's two end points, so each step can say what held *it* up:
  // the pós is the global lock, the floor is where VelAtq allows the next action.
  let prevPosEnd = 0;
  let prevFloorEnd = 0;
  let isFirstAction = true;

  for (let c = 0; c < maxCycles; c++) {
    const lanes: RotationLane[] = [];

    for (const step of steps) {
      const readyAt = ready.get(step.key);
      const start = readyAt === undefined ? gate : Math.max(gate, readyAt);

      // Split the idle in front of this step between the two things that can cause it.
      // The VelAtq floor runs from the previous action's start, so it is the leading
      // part of the gap; anything still left is this step's own recarga.
      const aspdWait = isFirstAction ? 0 : Math.max(0, Math.min(start, prevFloorEnd) - prevPosEnd);
      const cdWait = Math.max(0, start - gate);

      const castEnd = start + step.cast;
      const posEnd = castEnd + step.acd;
      const recEnd = castEnd + step.cd;
      ready.set(step.key, recEnd);

      const aspdFloorEnd = start + aspdFloorOf(step, floor);
      const next = Math.max(posEnd, aspdFloorEnd);

      lanes.push({
        start,
        castEnd,
        posEnd,
        recEnd,
        aspdWait,
        cdWait,
        damage: step.damage,
        contributionPercent: 0,
      });

      prevPosEnd = posEnd;
      prevFloorEnd = aspdFloorEnd;
      isFirstAction = false;
      gate = next;
    }

    cycles.push({ lanes, start: lanes[0].start, end: gate });
  }

  // A cycle's duration is only known once the next one has started.
  const durations: number[] = [];
  for (let c = 1; c < cycles.length; c++) durations.push(cycles[c].start - cycles[c - 1].start);

  const period = detectPeriod(durations);
  const settled = period > 0 ? period : MAX_PERIOD;
  const window = durations.slice(-settled);
  const cycleDuration = window.reduce((sum, d) => sum + d, 0) / window.length;

  // Render the last fully-measured cycle, normalised to start at 0.
  const steady = cycles[cycles.length - 2] ?? cycles[cycles.length - 1];
  const contributions = distributePercents(steady.lanes.map((l) => l.damage));
  const lanes = steady.lanes.map((lane, i) => ({
    ...lane,
    start: lane.start - steady.start,
    castEnd: lane.castEnd - steady.start,
    posEnd: lane.posEnd - steady.start,
    recEnd: lane.recEnd - steady.start,
    contributionPercent: contributions[i],
  }));

  const damagePerCycle = steps.reduce((sum, s) => sum + (s.damage > 0 ? s.damage : 0), 0);
  // The first pass *closes* in its own makespan — the design's "começando com todas as
  // recargas zeradas, nada segura a rotação". Deliberately not the start-to-start
  // distance to the second cycle: that already contains the wrap-around wait, so it
  // could never come out shorter than the sustained cycle, which is the whole point of
  // surfacing it.
  const firstCycleDuration = cycles[0].end - cycles[0].start;
  const aspdWaitTotal = lanes.reduce((sum, l) => sum + l.aspdWait, 0);
  const cdWaitTotal = lanes.reduce((sum, l) => sum + l.cdWait, 0);

  return {
    lanes,
    cycleDuration,
    firstCycleDuration,
    damagePerCycle,
    sustainedDps: cycleDuration > 0 ? damagePerCycle / cycleDuration : 0,
    firstCycleDps: firstCycleDuration > 0 ? damagePerCycle / firstCycleDuration : 0,
    aspdWaitTotal,
    isAspdLimited: aspdWaitTotal > EPSILON,
    cdWaitTotal,
    period: period === 0 ? 0 : period,
    isEstimate: period !== 1,
    unconstrainedDuration: steps.reduce((sum, s) => sum + Math.max(s.cast + s.acd, aspdFloorOf(s, floor)), 0),
  };
}

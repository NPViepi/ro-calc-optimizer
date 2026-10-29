/**
 * Reordering a rotation for the highest sustained DPS.
 *
 * The problem is far smaller than it looks, because of one property of the engine:
 * **nothing in a skill's damage depends on its position in the rotation.** There is no
 * per-skill prerequisite in the catalog; weapon gating (`verifyItemFn`) and character
 * states (Sky Emperor's `[Meio-Dia]` and friends) are global toggles that hold for the
 * whole cycle. So for a fixed multiset of entries:
 *
 * - `damagePerCycle` is permutation-invariant, and
 * - `Σ max(cast + acd, aspdPeriod)` — the cycle with no recargas at all — is too.
 *
 * Maximising `damagePerCycle / cycleDuration` therefore reduces to **minimising the
 * cycle duration**, and the only thing order can change is how much the rotation idles
 * waiting on its own recargas. `unconstrainedDuration` is a provable lower bound, which
 * gives an exact early exit rather than a "good enough" stopping rule.
 *
 * Scoring goes through {@link simulateRotation} itself, so the objective can never drift
 * from the cycle the panel draws.
 */

import { aspdFloorOf, RotationScheduleStep, simulateRotation } from './rotation-schedule';

const EPSILON = 1e-6;

/** Arrangements to score exhaustively before falling back to the heuristic. */
const DEFAULT_BUDGET = 50_000;
/** Cycles to unroll while scoring. The steady state is reached within a couple of
 *  cycles for any real rotation; the display path uses a far larger budget. */
const SCORING_CYCLES = 16;

export interface RotationMove {
  value: string;
  from: number;
  to: number;
}

export interface OptimizeResult {
  changed: boolean;
  reason?: 'no-cooldowns' | 'already-optimal' | 'no-improvement';
  /** The recommended order. Equals the input when `changed` is false. */
  order: string[];
  cycleBefore: number;
  cycleAfter: number;
  dpsBefore: number;
  dpsAfter: number;
  /** Whether the search was exhaustive over every distinct arrangement. */
  exhaustive: boolean;
  /** Entries that actually moved, for the "o que mudou" message. */
  moves: RotationMove[];
}

/** `n! / Π(mᵢ!)`, bailing out as soon as it exceeds `limit` so 20! never overflows. */
export function countArrangements(multiplicities: number[], limit: number): number {
  let total = 1;
  let used = 0;

  // Build the multinomial as a product of binomials: after placing each group the
  // running value is an exact integer count, so it never overflows before the bail-out.
  for (const m of multiplicities) {
    for (let k = 1; k <= m; k++) {
      used += 1;
      total = (total * used) / k;
      if (total > limit) return Number.POSITIVE_INFINITY;
    }
  }

  return Math.round(total);
}

/** Next lexicographic arrangement of `ids`, in place. Visits each distinct
 *  arrangement of a multiset exactly once. Returns false when the last one is reached. */
function nextArrangement(ids: number[]): boolean {
  let i = ids.length - 2;
  while (i >= 0 && ids[i] >= ids[i + 1]) i--;
  if (i < 0) return false;

  let j = ids.length - 1;
  while (ids[j] <= ids[i]) j--;
  [ids[i], ids[j]] = [ids[j], ids[i]];

  for (let l = i + 1, r = ids.length - 1; l < r; l++, r--) [ids[l], ids[r]] = [ids[r], ids[l]];
  return true;
}

/**
 * Which entries moved. The k-th occurrence of a value in the old order is matched to
 * the k-th occurrence in the new one, so duplicates report the smallest honest diff.
 */
export function describeMoves(before: string[], after: string[]): RotationMove[] {
  const positions = new Map<string, number[]>();
  after.forEach((value, index) => {
    const list = positions.get(value) ?? [];
    list.push(index);
    positions.set(value, list);
  });

  const taken = new Map<string, number>();
  const moves: RotationMove[] = [];

  before.forEach((value, from) => {
    const seen = taken.get(value) ?? 0;
    taken.set(value, seen + 1);
    const to = positions.get(value)?.[seen];
    if (to !== undefined && to !== from) moves.push({ value, from, to });
  });

  return moves;
}

export function optimizeRotation(input: {
  rotation: string[];
  /** Timing for each distinct rotation value. */
  stepByValue: Map<string, RotationScheduleStep>;
  aspdPeriod: number;
  budget?: number;
}): OptimizeResult {
  const { rotation, stepByValue, aspdPeriod } = input;
  const budget = input.budget ?? DEFAULT_BUDGET;

  const stepsOf = (order: string[]) => order.map((value) => stepByValue.get(value)).filter(Boolean) as RotationScheduleStep[];
  const score = (order: string[]) =>
    simulateRotation({ steps: stepsOf(order), aspdPeriod, maxCycles: SCORING_CYCLES }).cycleDuration;

  const current = simulateRotation({ steps: stepsOf(rotation), aspdPeriod, maxCycles: SCORING_CYCLES });
  const unchanged = (reason: OptimizeResult['reason'], exhaustive: boolean): OptimizeResult => ({
    changed: false,
    reason,
    order: rotation,
    cycleBefore: current.cycleDuration,
    cycleAfter: current.cycleDuration,
    dpsBefore: current.sustainedDps,
    dpsAfter: current.sustainedDps,
    exhaustive,
    moves: [],
  });

  if (rotation.length < 2) return unchanged('already-optimal', true);

  const steps = stepsOf(rotation);
  if (steps.every((s) => s.cd <= EPSILON)) return unchanged('no-cooldowns', true);
  // Already at the permutation-invariant floor: no order can do better.
  if (current.cycleDuration <= current.unconstrainedDuration + EPSILON) return unchanged('already-optimal', true);

  // Distinct values, ordered by first appearance so the search is deterministic.
  const distinct: string[] = [];
  for (const value of rotation) if (!distinct.includes(value)) distinct.push(value);
  const idOf = new Map(distinct.map((value, i) => [value, i]));
  const multiplicities = distinct.map((value) => rotation.filter((v) => v === value).length);

  let best = rotation.slice();
  let bestCycle = current.cycleDuration;
  const consider = (order: string[]) => {
    const cycle = score(order);
    if (cycle < bestCycle - EPSILON) {
      bestCycle = cycle;
      best = order.slice();
    }
  };

  const arrangements = countArrangements(multiplicities, budget);
  const exhaustive = arrangements <= budget;

  if (exhaustive) {
    const ids = rotation.map((v) => idOf.get(v)!).sort((a, b) => a - b);
    do {
      consider(ids.map((id) => distinct[id]));
      if (bestCycle <= current.unconstrainedDuration + EPSILON) break; // provably optimal
    } while (nextArrangement(ids));
  } else {
    for (const seed of [rotation, greedyOrder(rotation, stepByValue, aspdPeriod), byLongestCooldown(rotation, stepByValue)]) {
      consider(seed);
      consider(localSearch(seed, score, current.unconstrainedDuration));
    }
  }

  if (bestCycle >= current.cycleDuration - EPSILON) return unchanged('no-improvement', exhaustive);

  const after = simulateRotation({ steps: stepsOf(best), aspdPeriod, maxCycles: SCORING_CYCLES });

  return {
    changed: true,
    order: best,
    cycleBefore: current.cycleDuration,
    cycleAfter: after.cycleDuration,
    dpsBefore: current.sustainedDps,
    dpsAfter: after.sustainedDps,
    exhaustive,
    moves: describeMoves(rotation, best),
  };
}

/**
 * Walk the rotation picking, at each position, the remaining entry that is ready
 * soonest — the handoff's "encaixa as habilidades sem conjuração dentro da
 * pós-conjuração das outras e adia as de recarga longa". Two cycles are simulated and
 * the second is returned, so the order accounts for its own wrap-around.
 */
function greedyOrder(rotation: string[], stepByValue: Map<string, RotationScheduleStep>, aspdPeriod: number): string[] {
  const ready = new Map<string, number>();
  let gate = 0;
  let order: string[] = [];

  for (let pass = 0; pass < 2; pass++) {
    const pool = rotation.slice();
    order = [];

    while (pool.length) {
      let pick = 0;
      let bestStart = Number.POSITIVE_INFINITY;
      let bestCd = -1;

      pool.forEach((value, i) => {
        const stepValue = stepByValue.get(value);
        if (!stepValue) return;
        const start = Math.max(gate, ready.get(stepValue.key) ?? gate);
        // Earliest ready wins; ties go to the longest recarga, which is the one that
        // most needs the rest of the rotation to run before it comes round again.
        if (start < bestStart - EPSILON || (Math.abs(start - bestStart) <= EPSILON && stepValue.cd > bestCd)) {
          bestStart = start;
          bestCd = stepValue.cd;
          pick = i;
        }
      });

      const [value] = pool.splice(pick, 1);
      const stepValue = stepByValue.get(value);
      order.push(value);
      if (!stepValue) continue;

      const start = Math.max(gate, ready.get(stepValue.key) ?? gate);
      const castEnd = start + stepValue.cast;
      ready.set(stepValue.key, castEnd + stepValue.cd);
      gate = Math.max(castEnd + stepValue.acd, start + aspdFloorOf(stepValue, aspdPeriod));
    }
  }

  return order;
}

/** Longest recarga first — a cheap third seed with a very different shape. */
function byLongestCooldown(rotation: string[], stepByValue: Map<string, RotationScheduleStep>): string[] {
  return rotation
    .map((value, index) => ({ value, index, cd: stepByValue.get(value)?.cd ?? 0 }))
    .sort((a, b) => b.cd - a.cd || a.index - b.index)
    .map((entry) => entry.value);
}

/**
 * First-improvement hill climb over adjacent swaps and single-element moves.
 * Deterministic: the neighbourhood is scanned in a fixed order every time.
 */
function localSearch(seed: string[], score: (order: string[]) => number, lowerBound: number): string[] {
  let best = seed.slice();
  let bestCycle = score(best);

  for (let guard = 0; guard < 200 && bestCycle > lowerBound + EPSILON; guard++) {
    let improved = false;

    for (let i = 0; i < best.length && !improved; i++) {
      for (let j = 0; j < best.length && !improved; j++) {
        if (i === j) continue;
        const candidate = best.slice();
        const [moved] = candidate.splice(i, 1);
        candidate.splice(j, 0, moved);

        const cycle = score(candidate);
        if (cycle < bestCycle - EPSILON) {
          best = candidate;
          bestCycle = cycle;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best;
}

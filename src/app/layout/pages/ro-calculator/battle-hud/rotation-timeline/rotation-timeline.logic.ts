import { Translate } from 'src/app/i18n';
// Geometry for the cycle flowchart: turns the scheduler's absolute times into the
// percentage-positioned blocks the template draws. Pure, no Angular — same split as
// aspd-curve.logic.ts. Percentages (not pixels) so the chart is fluid, and so the two
// charts of comparison mode can share one scale by sharing one denominator.

import { RotationCycle } from '../../../../../core/rotation-schedule';

/** Blocks narrower than this lose their label; the value shows on hover instead. */
export const MIN_LABEL_PERCENT = 6;

/** A whole-second tick closer than this to the cycle end is dropped, so the two labels
 *  never overprint each other. */
export const TICK_COLLISION_PERCENT = 7;

/** How many axis labels the chart will carry before the tick step has to grow. */
export const MAX_AXIS_TICKS = 12;

/** Round steps the axis climbs through as the cycle gets longer. They are the intervals a
 *  reader already thinks in (seconds, quarter-minutes, minutes), so the labels stay
 *  mentally cheap however far apart they end up. */
const TICK_STEP_BANDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

/**
 * Seconds between axis ticks for a cycle of `scale` seconds.
 *
 * One tick per second only ever worked because rotations were short. A 61s Firmamento
 * cycle drew 62 labels into the axis, which rendered as "0s1s2s3s…" and read as the skill
 * repeating dozens of times — the lanes were right all along, the axis was not.
 */
export function pickTickStep(scale: number): number {
  const banded = TICK_STEP_BANDS.find((step) => scale / step <= MAX_AXIS_TICKS);
  // Past the last band, divide the cycle up directly so the count still cannot run away.
  return banded ?? Math.ceil(scale / MAX_AXIS_TICKS);
}

export interface TimelineBlock {
  kind: 'fixa' | 'variavel' | 'pos' | 'recarga' | 'aspd';
  leftPercent: number;
  widthPercent: number;
  seconds: number;
  /** Empty when the block is too narrow to letter. */
  label: string;
  tooltip: string;
  /** Pós and recarga normally share the lane as two 10px stripes. When one of them is
   *  zero the other has the lane to itself and is drawn full height. */
  isFullHeight: boolean;
}

export interface TimelineLane {
  index: number;
  /** Skill icon id, or null for ataque básico (which uses the cursor asset). */
  icon?: number;
  isBasic: boolean;
  name: string;
  blocks: TimelineBlock[];
  /** The red overrun marker when this entry's own recarga held the rotation up. */
  invalid: boolean;
  missingSeconds: number;
}

/** Which edge of the label sits on the tick. A label centred on 0% or 100% hangs off the
 *  chart, so the outermost ones are anchored by their own edge instead. */
export type TimelineTickAnchor = 'start' | 'middle' | 'end';

/** Within this much of either edge, a label anchors to that edge rather than centring. */
export const TICK_EDGE_ANCHOR_PERCENT = 2;

const anchorFor = (leftPercent: number): TimelineTickAnchor => {
  if (leftPercent <= TICK_EDGE_ANCHOR_PERCENT) return 'start';
  if (leftPercent >= 100 - TICK_EDGE_ANCHOR_PERCENT) return 'end';
  return 'middle';
};

export interface TimelineAxisTick {
  leftPercent: number;
  label: string;
  isCycleEnd: boolean;
  anchor: TimelineTickAnchor;
}

export interface TimelineChart {
  /** Present in comparison mode: "Atual" / "⇄ Comparação". */
  title: string;
  cycleDuration: number;
  lanes: TimelineLane[];
  ticks: TimelineAxisTick[];
  isCompare: boolean;
}

const fmt = (seconds: number) => seconds.toFixed(2).replace('.', ',');

/** What one chart is drawn from: a solved cycle plus the per-entry cast split. */
export interface TimelineSource {
  cycle: RotationCycle;
  entries: { name: string; icon?: number; isBasic: boolean; cast: number; fixed: number }[];
}

/**
 * One chart. `scale` is the denominator every position divides by — pass the longer of
 * the two cycles in comparison mode so both charts line up on one time axis.
 */
export function buildTimelineChart(input: TimelineSource & { text: Translate; scale: number; title?: string; isCompare?: boolean }): TimelineChart {
  const { cycle, entries, text, title = '', isCompare = false } = input;
  const scale = input.scale > 0 ? input.scale : 1;
  const pct = (seconds: number) => (seconds / scale) * 100;

  const lanes: TimelineLane[] = cycle.lanes.map((lane, index) => {
    const entry = entries[index];
    const blocks: TimelineBlock[] = [];

    const push = (kind: TimelineBlock['kind'], from: number, to: number, tooltip: string, isFullHeight = false) => {
      const seconds = to - from;
      // Zero-length components are not drawn at all, so widths stay proportional to
      // real time — a skill with fixa 0 shows no fixa block.
      if (seconds <= 1e-6) return;
      const widthPercent = pct(seconds);
      blocks.push({
        kind,
        leftPercent: pct(from),
        widthPercent,
        seconds,
        label: widthPercent >= MIN_LABEL_PERCENT ? fmt(seconds) : '',
        tooltip: `${tooltip} — ${fmt(seconds)}s`,
        isFullHeight,
      });
    };

    const fixedEnd = lane.start + (entry?.fixed ?? 0);
    push('fixa', lane.start, fixedEnd, text('tl.fixedCast'));
    push('variavel', fixedEnd, lane.castEnd, text('tl.variableCast'));
    // The two share the lane as stripes only while both exist; whichever is alone gets
    // the full height, so a lane never looks half-empty for no reason.
    const hasPos = lane.posEnd - lane.castEnd > 1e-6;
    const hasRecarga = lane.recEnd - lane.castEnd > 1e-6;
    push('pos', lane.castEnd, lane.posEnd, text('tl.afterCast'), !hasRecarga);
    push('recarga', lane.castEnd, lane.recEnd, text('tl.cooldown'), !hasPos);
    // The VelAtq wait sits immediately *before* the step it held back. On the first lane
    // it wraps from the previous pass, which is the same instant modulo the cycle — draw
    // it at the end of the window rather than off the left edge.
    if (lane.aspdWait > 1e-6) {
      const from = lane.start - lane.aspdWait;
      const tooltip = text('tl.aspdWaitTip');
      if (from < -1e-9) push('aspd', from + cycle.cycleDuration, cycle.cycleDuration, tooltip);
      else push('aspd', from, lane.start, tooltip);
    }

    return {
      index,
      icon: entry?.icon,
      isBasic: !!entry?.isBasic,
      name: entry?.name ?? '',
      blocks,
      // A one-lane chart has nothing to stall against: the skill repeats on its own
      // timer and that wait *is* the cycle. Same rule as RotationEntryView.stalled, so
      // the track never goes red while the row's own "Recarga não fecha" text is gone.
      invalid: cycle.lanes.length > 1 && lane.cdWait > 1e-3,
      missingSeconds: lane.cdWait,
    };
  });

  // Round ticks, plus the cycle end. A tick sitting almost on top of the cycle-end
  // marker is dropped rather than drawn through it — a 4,02s cycle would otherwise print
  // "4s" and "4,02s" over each other.
  const endPercent = pct(cycle.cycleDuration);
  const ticks: TimelineAxisTick[] = [];
  const tickStep = pickTickStep(scale);
  for (let s = 0; s <= Math.floor(scale); s += tickStep) {
    const leftPercent = pct(s);
    if (Math.abs(leftPercent - endPercent) < TICK_COLLISION_PERCENT) continue;
    ticks.push({ leftPercent, label: `${s}s`, isCycleEnd: false, anchor: anchorFor(leftPercent) });
  }
  ticks.push({
    leftPercent: endPercent,
    label: `${fmt(cycle.cycleDuration)}s`,
    isCycleEnd: true,
    anchor: anchorFor(endPercent),
  });

  return { title, cycleDuration: cycle.cycleDuration, lanes, ticks, isCompare };
}

/**
 * The chart set the panel renders: one normally, two on a shared scale when comparing.
 * Both keep their own cycle-end marker — they are complete, independent readings.
 */
export function buildTimelineCharts(input: { text: Translate; current: TimelineSource; compare?: TimelineSource | null }): TimelineChart[] {
  const { text, current, compare } = input;
  if (!compare) return [buildTimelineChart({ ...current, text, scale: current.cycle.cycleDuration })];

  const scale = Math.max(current.cycle.cycleDuration, compare.cycle.cycleDuration);

  return [
    buildTimelineChart({ ...current, text, scale, title: text('tl.titleCurrent', { cycle: fmt(current.cycle.cycleDuration) }) }),
    buildTimelineChart({ ...compare, text, scale, title: text('tl.titleCompare', { cycle: fmt(compare.cycle.cycleDuration) }), isCompare: true }),
  ];
}

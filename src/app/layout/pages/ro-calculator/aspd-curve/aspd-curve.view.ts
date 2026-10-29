import { ASPD_CAP, engineHitsPerSec, hitsPerSecCurve, MAX_HITS_PER_SEC } from '../../../../utils/aspd-hits-per-sec';
import { formatNumber, formatRate } from '../../../../utils/format-number';
import { ASPD_LANDMARKS, AspdLandmark, gainFromAspd } from './aspd-curve.logic';
import { Translate } from '../../../../i18n';
interface Point {
  x: number;
  y: number;
}

interface Marker extends Point {
  aspd: number;
  label: string;
  /** Label position, flipped to the inside of the frame near the right edge / top. */
  labelX: number;
  labelY: number;
  labelAnchor: 'start' | 'end';
  /** The compared build's marker: same geometry, different colour, no halo. */
  isCompare: boolean;
}

interface AxisTick extends Point {
  label: string;
}

interface LandmarkRow extends AspdLandmark {
  /** Precomputed so the template doesn't call a method on every change-detection pass. */
  reached: boolean;
}

/**
 * The iRO Wiki "Hits per Second" graph (https://irowiki.org/wiki/ASPD#Hits_per_Second)
 * with the current build plotted on it, opened from the "Hits/s" summary value.
 *
 * The curve is what makes VelAtq gear legible: it is a hyperbola, so the marker's
 * position — not its height — tells you whether the next +VelAtq is worth buying. The
 * caption prices that directly (what +10 would buy from here).
 *
 * The SVG is hand-built rather than pulled from a charting library: the domain is fixed
 * and tiny (VelAtq up to 193, 0..7,14 hits/s), and a dependency-free inline SVG inherits
 * the theme's colours and scales with the dialog for free.
 */
export class AspdCurveView {
  aspd: number;
  /** The compared build's VelAtq, or null when not comparing — plotted as a second marker. */
  aspd2?: number | null;

  constructor(aspd: number, aspd2: number | null | undefined, private readonly text: Translate) {
    this.aspd = aspd; this.aspd2 = aspd2; this.update();
  }

  /** SVG user units. The viewBox is fixed; the element scales to the dialog width. */
  private static readonly W = 620;
  private static readonly H = 300;
  private static readonly PAD = { left: 34, right: 30, top: 16, bottom: 34 };
  /** Head-room above the 7,14 hits/s cap so the top marker isn't clipped by the frame. */
  private static readonly Y_MAX = 7.6;

  readonly viewBox = `0 0 ${AspdCurveView.W} ${AspdCurveView.H}`;
  readonly cap = ASPD_CAP;

  /** Lowest VelAtq on the x axis — see ngOnChanges. */
  private domainMin = 140;

  plotLeft = AspdCurveView.PAD.left;
  plotRight = AspdCurveView.W - AspdCurveView.PAD.right;
  plotTop = AspdCurveView.PAD.top;
  plotBottom = AspdCurveView.H - AspdCurveView.PAD.bottom;

  /** Fixed 1..7 gridlines — they depend on no input, so they're built once. */
  readonly yTicks: AxisTick[] = Array.from({ length: 7 }, (_, i) => ({
    x: this.plotLeft,
    y: this.y(i + 1),
    label: String(i + 1),
  }));

  curvePath = '';
  xTicks: AxisTick[] = [];
  /** Compare marker first so the current build's marker draws on top of it. */
  markers: Marker[] = [];
  rows: LandmarkRow[] = [];
  /** Caption under the chart: where the build sits and what more VelAtq would buy. */
  summaryText = '';
  gainText = '';

  update(): void {
    const aspd = this.clampAspd(this.aspd);
    const aspd2 = this.aspd2 == null ? null : this.clampAspd(this.aspd2);

    // Keep the plotted builds inside the frame: the window normally starts at 140 (below
    // that the curve is flat and uninformative), but drops to a round ten below the
    // lowest marker when a build sits under it.
    const lowest = Math.min(aspd, aspd2 ?? aspd);
    this.domainMin = Math.min(140, Math.floor((lowest - 5) / 10) * 10);

    this.curvePath = this.buildCurvePath();
    this.xTicks = this.buildXTicks();
    this.markers = [
      ...(aspd2 != null && aspd2 !== aspd ? [this.buildMarker(aspd2, true)] : []),
      this.buildMarker(aspd, false),
    ];
    this.rows = ASPD_LANDMARKS.map((l) => ({ ...l, reached: l.aspd <= aspd }));
    this.buildCaption(aspd);
  }

  /** The summary feeds this from an untyped model, so coerce before trusting it. */
  private clampAspd(value: number): number {
    return Math.min(Number(value) || 0, ASPD_CAP);
  }

  private x(aspd: number): number {
    const ratio = (aspd - this.domainMin) / (ASPD_CAP - this.domainMin);
    return this.plotLeft + ratio * (this.plotRight - this.plotLeft);
  }

  private y(hits: number): number {
    const ratio = hits / AspdCurveView.Y_MAX;
    return this.plotBottom - ratio * (this.plotBottom - this.plotTop);
  }

  /** One sample per SVG unit of width — enough that the near-vertical tail reads as a curve. */
  private buildCurvePath(): string {
    const steps = Math.round(this.plotRight - this.plotLeft);
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const aspd = this.domainMin + ((ASPD_CAP - this.domainMin) * i) / steps;
      points.push(`${this.x(aspd).toFixed(1)},${this.y(hitsPerSecCurve(aspd)).toFixed(1)}`);
    }
    return `M${points.join(' L')}`;
  }

  /** Every ten from the domain start, plus the 193 cap. Ticks within 4 of the cap are
   *  dropped so their labels don't overlap it — those VelAtq values are landmarks and
   *  are already labelled in the table below. */
  private buildXTicks(): AxisTick[] {
    const ticks: AxisTick[] = [];
    for (let aspd = Math.ceil(this.domainMin / 10) * 10; aspd <= ASPD_CAP - 4; aspd += 10) {
      ticks.push({ x: this.x(aspd), y: this.plotBottom, label: String(aspd) });
    }
    ticks.push({ x: this.x(ASPD_CAP), y: this.plotBottom, label: String(ASPD_CAP) });
    return ticks;
  }

  /** Positioned on the exact curve, labelled with the rounded rate the engine uses. */
  private buildMarker(aspd: number, isCompare: boolean): Marker {
    const x = this.x(aspd);
    const y = this.y(hitsPerSecCurve(aspd));
    const flip = x > this.plotRight - 110;
    // The compare label sits below its dot so the two never collide when both builds
    // land on nearby VelAtq.
    const above = y < this.plotTop + 16 ? y + 16 : y - 8;
    return {
      x,
      y,
      aspd,
      label: `${aspd} → ${formatRate(engineHitsPerSec(aspd))}/s`,
      labelX: flip ? x - 8 : x + 8,
      labelY: isCompare ? above + 14 : above,
      labelAnchor: flip ? 'end' : 'start',
      isCompare,
    };
  }

  private buildCaption(aspd: number): void {
    this.summaryText = this.text('aspd.summary', { aspd, hits: formatRate(engineHitsPerSec(aspd)) });

    const gain = gainFromAspd(aspd);
    if (!gain) {
      this.gainText = this.text('aspd.atCap', { cap: ASPD_CAP, hits: formatRate(MAX_HITS_PER_SEC) });
      return;
    }
    // `gain.plus`, not the requested amount: near the cap the increase gets truncated,
    // and promising "+10" for what is really +9 would misprice the last stretch.
    this.gainText = this.text('aspd.gain', {
      plus: gain.plus, aspd: gain.aspd, hits: formatRate(gain.hits),
      delta: formatRate(gain.delta), percent: formatNumber(gain.percent, 0, 1),
    });
  }
}

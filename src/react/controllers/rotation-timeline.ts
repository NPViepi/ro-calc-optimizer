import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { RotationCycle } from '../../app/core/rotation-schedule';
import { BASIC_ATTACK_ICON } from './rotation-list';
import { RotationEntryView } from '../../app/layout/pages/ro-calculator/battle-hud/rotation-view';
import { Translate } from 'src/app/i18n';
import { buildTimelineCharts, TimelineChart } from '../../app/layout/pages/ro-calculator/battle-hud/rotation-timeline/rotation-timeline.logic';

/**
 * The cycle flowchart: one lane per rotation entry on a shared time axis.
 *
 * Built from positioned divs rather than the hand-rolled SVG that aspd-curve uses. The
 * lanes are percentage-positioned blocks carrying in-block numeric labels, hover
 * tooltips, dashed borders and a 45° hatch — all of which CSS does for free and SVG
 * would need hand-laid text for. The file layout still follows aspd-curve: a dumb
 * component over a pure, tested `.logic.ts`.
 */

export class RotationTimelineComponent extends ViewState {
   cycle!: RotationCycle;
   entries: RotationEntryView[] = [];
   cycle2: RotationCycle | null = null;
   entries2: RotationEntryView[] | null = null;

  /**
   * A lane icon was clicked. The index is the lane's position, which is the rotation
   * entry's own index — both charts are built from the same ordered entries, so a lane in
   * the comparison chart names the same step as the one above it.
   */
   iconClick = new Events<{ index: number; event: Event }>();

  readonly basicAttackIcon = BASIC_ATTACK_ICON;

  constructor(private readonly text: Translate) { super(); }

  get charts(): TimelineChart[] {
    if (!this.cycle) return [];

    const shape = (cycle: RotationCycle, entries: RotationEntryView[]) => ({
      cycle,
      entries: entries.map((e) => ({
        name: e.name,
        icon: e.icon,
        isBasic: e.isBasic,
        cast: e.summary?.calcSkill?.castPeriod ?? 0,
        // The fixed half of the cast, so the lane can show fixa and variável apart.
        fixed: e.isBasic ? 0 : e.summary?.calcSkill?.reducedFct ?? 0,
      })),
    });

    return buildTimelineCharts({
      text: this.text,
      current: shape(this.cycle, this.entries),
      compare: this.cycle2 ? shape(this.cycle2, this.entries2 ?? []) : null,
    });
  }

  trackByIndex(index: number): number {
    return index;
  }
}

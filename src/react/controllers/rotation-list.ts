import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import type { SkillFormulaVersion } from '../../app/skills/skill-formula-version';
import { moveItemInArray } from '../ui/reorder';
import { BASIC_ATTACK_VALUE, MAX_ROTATION_LENGTH } from '../../app/core/rotation';
import { buildRotationPickerOptions, elementTagClass as elementTagClassFn, RotationPickerOption } from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';
import { DamageRange, RotationEntryView } from '../../app/layout/pages/ro-calculator/battle-hud/rotation-view';
import { Translate } from '../../app/i18n';

/** Which of a row's three damage readings was clicked: the crit-weighted mean, or one of
 *  the two outcomes it averages. */
export type DamageBranch = 'mean' | 'nocri' | 'cri' | 'flat';

/** The synthetic option for ataque básico. ragassets serves no `/icons/skill` entry for
 *  the in-game sword cursor, so the picker points straight at the map asset. */
export const BASIC_ATTACK_ICON = 'https://assets.latam-tools.com.br/maps/_u/4680d9e5597cb23d.png';

/**
 * The "ROTAÇÃO" column: the ordered skill list, its drag/keyboard reordering, the add
 * and remove affordances, and the per-row triggers (level chip, `(i)`).
 *
 * Owns no damage math — it renders {@link RotationEntryView}s and emits the new order.
 */

export class RotationListComponent extends ViewState {
   skillFormulaVersion: SkillFormulaVersion = 'current';
   skillFormulaVersionChange = new Events<SkillFormulaVersion>();
   entries: RotationEntryView[] = [];
  /** The compared build's entries, positionally aligned with `entries`. */
   entries2: RotationEntryView[] | null = null;
   isComparing = false;
   rotation: string[] = [];
  /** The class's offensive skills, for the add picker. */
   atkSkills: any[] = [];
   isShowSelectableSkillLevel = false;
   isInProcessingPreset = false;
  /** Total damage of one cycle, for the contribution tooltip. */
   damagePerCycle = 0;
   rotationChange = new Events<{ rotation: string[]; stacks: number[] }>();
   stackChange = new Events<{ index: number; stack: number }>();
   optimizeClick = new Events<void>();
   clearClick = new Events<void>();
   detailsClick = new Events<{ index: number; event: Event }>();
  /** The element tag was clicked — the parent opens the elemental table. */
   elementTableClick = new Events<void>();
  /** A crit rate was clicked — the parent opens that row's full derivation. `index` says
   *  which row, since the skill's own flat crit and its share of the character's crit are
   *  part of the answer and differ per skill. */
   critBreakdownClick = new Events<{ index: number; event: Event }>();
  /** A damage figure was clicked — the parent opens the explanation of *that* figure.
   *  `branch` says which of the row's three readings it was. */
   damageClick = new Events<{ index: number; event: Event; branch: DamageBranch }>();

  /** Same rule the HUD's own element tags use. */
  elementTagClass = elementTagClassFn;

  /** Index of the placeholder row while the picker is open; null when not adding. */
  addingAt: number | null = null;
  pendingValue: string | null = null;
  /** Announced to screen readers after a keyboard move. */
  moveAnnouncement = '';

  readonly basicAttackIcon = BASIC_ATTACK_ICON;
  readonly maxLength = MAX_ROTATION_LENGTH;

  constructor(private readonly text: Translate) { super(); }

  /** Hover note for a roll's tag. Each says what the roll *is* and, where it matters, what
   *  it is not: "sem crít." is a roll the build takes most of the time, not a floor. */
  rangeTagTooltip(range: DamageRange): string {
    if (range.kind === 'nocri') return this.text('rot.tipNoCri');
    if (range.kind === 'cri') return this.text('rot.tipCri');

    return this.text('rot.tipFlat');
  }

  /** Hover note for the "média" tag. A crit row needs the warning — the rate is on screen
   *  right beside the figure and reads as something still to apply; a plain min–max row only
   *  needs saying what the number is. */
  meanTagTooltip(entry: RotationEntryView): string {
    return this.text(entry.damageRanges.length > 1 ? 'rot.tipMeanCrit' : 'rot.tipMean');
  }

  /** A row's figure is explained by whatever it is: the average where there is a roll to
   *  average, the formula itself where the damage never varies. */
  damageTooltip(entry: RotationEntryView): string {
    return this.text(entry.hasDamageSpread ? 'rot.tipDamageMean' : 'rot.tipDamageFlat');
  }

  /** The compared build's figure sits directly under the current one, and since the arrow
   *  between them went away only its colour says which is which. The tooltip says it too. */
  compareDamageTooltip(entry: RotationEntryView): string {
    return this.text(entry.hasDamageSpread ? 'rot.tipCompareMean' : 'rot.tipCompareFlat');
  }

  /** A one-skill rotation is all of the damage by definition, so its "100,0%" states the
   *  obvious. The share only earns its place once there is something to share it with. */
  get showsContribution(): boolean {
    return this.entries.length > 1;
  }

  get isFull(): boolean {
    return this.rotation.length >= MAX_ROTATION_LENGTH;
  }

  get canOptimize(): boolean {
    return this.rotation.length > 1 && !this.isInProcessingPreset;
  }

  private skillOptionsFor: any[] | null = null;
  private skillOptionsCache: RotationPickerOption[] = [];

  /**
   * Flat options for the add picker — ataque básico first, then the class's own skills.
   * Rebuilt only when the skill list itself changes: a fresh array on every change
   * detection makes ui-dropdown re-render every option, and an icon that fails to load
   * then errors again on each pass.
   */
  get skillOptions(): RotationPickerOption[] {
    if (this.skillOptionsFor !== this.atkSkills) {
      this.skillOptionsFor = this.atkSkills;
      this.skillOptionsCache = buildRotationPickerOptions(BASIC_ATTACK_VALUE, this.atkSkills, this.text);
    }
    return this.skillOptionsCache;
  }

  contributionTooltip(entry: RotationEntryView): string {
    const pct = entry.contributionPercent.toFixed(1).replace('.', ',');
    const total = Math.round(this.damagePerCycle).toLocaleString('pt-BR');

    return this.text('rot.tipContribution', { pct, total });
  }

  /** Marks options already in the rotation, so the picker can flag a repeat. */
  isInRotation(value: string): boolean {
    return this.rotation.includes(value);
  }

  trackByIndex(index: number): number {
    return index;
  }

  onDrop(event: { previousIndex: number; currentIndex: number }) {
    if (event.previousIndex === event.currentIndex) return;
    const next = this.rotation.slice();
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    const stacks = this.entries.map((entry) => entry.stackCount);
    moveItemInArray(stacks, event.previousIndex, event.currentIndex);
    this.rotationChange.emit({ rotation: next, stacks });
  }

  /**
   * Arrow Up/Down on the handle moves the row and announces where it landed.
   */
  moveBy(index: number, delta: number, event: Event) {
    const target = index + delta;
    if (target < 0 || target >= this.rotation.length) return;
    event.preventDefault();

    const next = this.rotation.slice();
    moveItemInArray(next, index, target);
    const stacks = this.entries.map((entry) => entry.stackCount);
    moveItemInArray(stacks, index, target);
    this.moveAnnouncement = this.text('rot.movedAnnouncement', {
      name: this.entries[index]?.name ?? this.text('rot.skillPlaceholder'),
      position: target + 1,
      total: next.length,
    });
    this.rotationChange.emit({ rotation: next, stacks });
  }

  remove(index: number) {
    const next = this.rotation.slice();
    next.splice(index, 1);
    const stacks = this.entries.map((entry) => entry.stackCount);
    stacks.splice(index, 1);
    this.rotationChange.emit({ rotation: next, stacks });
  }

  /** Opens a placeholder row with the picker focused. */
  startAdding() {
    if (this.isFull) return;
    this.pendingValue = null;
    this.addingAt = this.rotation.length;
  }

  /** Dismissing the picker without choosing removes the placeholder row. */
  cancelAdding() {
    this.addingAt = null;
    this.pendingValue = null;
  }

  commitAdding(value: string) {
    if (!value) return this.cancelAdding();
    const skill = this.atkSkills.find((entry) => entry.value === value || entry.values?.includes(value) || entry.levelList?.some((level) => level.value === value));
    const defaultStack = skill?.defaultStack ?? skill?.maxStack ?? 0;
    this.rotationChange.emit({ rotation: [...this.rotation, value], stacks: [...this.entries.map((entry) => entry.stackCount), defaultStack] });
    this.cancelAdding();
  }

  /** Swaps one entry's level in place, leaving its position alone. */
  changeLevel(index: number, value: string) {
    if (!value || this.rotation[index] === value) return;
    const next = this.rotation.slice();
    next[index] = value;
    this.rotationChange.emit({ rotation: next, stacks: this.entries.map((entry) => entry.stackCount) });
  }

  /** The compared build's entry at the same position, when the two line up. */
  compareOf(index: number): RotationEntryView | null {
    return this.isComparing ? this.entries2?.[index] ?? null : null;
  }
}

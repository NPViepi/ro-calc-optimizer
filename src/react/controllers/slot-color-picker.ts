import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { MAX_SLOT_COLOR_LABEL, SLOT_COLORS, SlotColor, SlotColorLabels, slotColorLabel } from 'src/app/core/slot-colors';
import { SlotColorPickerEvent, SlotColorPickerRequest } from '../../app/layout/pages/ro-calculator/slot-color-picker/slot-color-picker.model';
import { Translate } from 'src/app/i18n';

/**
 * The slot-highlight palette, as a panel: pick a colour, clear it, or rename one.
 *
 * A panel of its own rather than a `ItemPickerService` request, because a row here is
 * two controls — choose and rename — and that picker's rows are single buttons. It
 * borrows that panel's surface variables so the two read as the same control.
 */

export class SlotColorPickerComponent extends ViewState {
   readonly event = new Events<SlotColorPickerEvent>();
  /** At most one is rendered at a time — only the row being edited draws an input. */
   rename?: HTMLInputElement;

  readonly colors = SLOT_COLORS;
  readonly maxLabel = MAX_SLOT_COLOR_LABEL;

  value: string | null = null;
  labels: SlotColorLabels = {};
  /** Palette id whose name is being edited, if any. */
  editing: string | null = null;
  draft = '';

  constructor(
    private readonly text: Translate,
  ) { super();}

  init(request: SlotColorPickerRequest, labels: SlotColorLabels): void {
    this.value = request.value ?? null;
    this.labels = { ...labels };
    this.publish();
  }

  labelOf(color: SlotColor): string {
    return slotColorLabel(color, this.labels, this.text);
  }

  /** The palette's own name, which is what an empty box restores. */
  defaultLabelOf(color: SlotColor): string {
    return this.text(color.labelKey);
  }

  trackColor = (_: number, color: SlotColor) => color.id;

  choose(value: string | null): void {
    this.event.emit({ kind: 'pick', value });
  }

  // ── renaming ─────────────────────────────────────────────────────────────────

  startRename(color: SlotColor, event: Event): void {
    event.stopPropagation();
    this.editing = color.id;
    this.draft = this.labelOf(color);
    this.publish();
    // The box does not exist until this pass renders; `appFocusInitial` only runs when
    // the trap is first attached, so the focus is placed by hand here instead.
    void this.lifetime.wait(0).then(() => this.rename?.select()).catch(() => undefined);
  }

  /**
   * Commit the edit and stay open — naming a colour is not choosing one, and a player
   * setting up their own vocabulary will name several in a row. An empty box is how
   * the palette's own name is restored, so it clears the entry rather than storing "".
   */
  commitRename(color: SlotColor): void {
    if (this.editing !== color.id) return;

    const next = { ...this.labels };
    const trimmed = this.draft.trim().slice(0, MAX_SLOT_COLOR_LABEL);
    if (trimmed && trimmed !== this.defaultLabelOf(color)) next[color.id] = trimmed;
    else delete next[color.id];

    this.labels = next;
    this.closeEdit();
    this.event.emit({ kind: 'rename', labels: next });
  }

  cancelRename(): void {
    this.closeEdit();
  }

  private closeEdit(): void {
    this.editing = null;
    this.draft = '';
    this.publish();
  }

  onRenameKeyDown(color: SlotColor, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.commitRename(color);
      return;
    }
    if (event.key === 'Escape') {
      // Consumed here so the panel itself stays open: the first Escape backs out of
      // the edit, a second one closes the panel.
      event.stopPropagation();
      this.cancelRename();
    }
  }

  /**
   * Escape closes the panel, and never reaches the page.
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.event.emit({ kind: 'dismiss' });
  }
}

import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { VirtualListHandle as VirtualListComponent } from '../ui/virtual-list';
import { hoverless } from '../ui/viewport';
import { DescriptionStore as ItemDescriptionStore } from '../services/data-client';
import { buildFilterIndex, filterOptions, searchOptionLeaves } from 'src/app/core/picker-filter';
import { DropdownModel } from 'src/app/models/dropdown.model';
import { ItemModel } from 'src/app/models/item.model';
import { OptionTreeNode, PickerRequest, PickerResult } from '../../app/layout/pages/ro-calculator/item-picker/item-picker.model';

/** One rendered line. `group` rows drill into the tree instead of committing. */
interface PickerRow {
  label: string;
  value: string | number | null;
  icon?: string | number | null;
  elementClass?: string;
  preRelease?: boolean;
  group?: boolean;
  children?: readonly OptionTreeNode[];
  create?: boolean;
  section?: boolean;
}

const ROW_HEIGHT = 28;
// A finger needs a 44px row; a mouse keeps the dense list.
const TOUCH_ROW_HEIGHT = 44;
const MAX_VIEWPORT = 300;
/**
 * Above this many options the list is virtualised — and a virtualised list has to be a
 * fixed width, since its rows are out of flow. Below it, a plain list lets the panel size
 * itself to the longest label. Decided from the *source* list, not the filtered rows, so
 * the choice never flips mid-filter; `pinnedWidth` then holds the width still.
 */
const VIRTUALISE_ABOVE = 100;
/** Below this the list is short enough that virtualising it only costs a layout pass. */
const SEARCH_LIMIT = 1000;

/**
 * The panel behind every chip in the equipment picker.
 *
 * It replaces a `ui-dropdown` (item, card, enchant, refine, grade, ammo, converter,
 * loyalty) or a `ui-cascadeSelect` (Bônus Aleatório) — hence the two modes. The keyboard
 * keyboard contract remains unchanged: type to filter, arrows to move,
 * Enter to choose, Esc to close; tree mode adds left/right to walk the breadcrumb.
 */

export class ItemPickerOverlayComponent extends ViewState {
   readonly closed = new Events<PickerResult>();

   private viewport?: VirtualListComponent;

  request!: PickerRequest;
  query = '';
  /** -1 is the "Nenhum" row, which sits outside the scroller and is always reachable. */
  active = -1;
  rows: PickerRow[] = [];
  capped = false;
  virtualise = false;
  /** Tree mode: the path drilled so far, root first. */
  trail: OptionTreeNode[] = [];
  /** Flat mode: the lowercased haystack for `request.options`, built once on open. */
  private filterIndex: string[] = [];
  /**
   * Frozen width for a content-sized panel, in px. A plain list sizes the panel to its
   * longest label, so filtering it would resize the panel under the pointer — the weapon
   * list went from 271px to 202px on the first keystroke. Measured the moment before the
   * first filter is applied and held for the rest of the panel's life. Virtualised panels
   * are already a fixed width and never take one.
   */
  pinnedWidth: number | null = null;

  readonly rowHeight = hoverless() ? TOUCH_ROW_HEIGHT : ROW_HEIGHT;

  constructor(
private readonly host: { nativeElement: HTMLElement },
    public readonly itemDescriptions: ItemDescriptionStore,
    /** Opened as a bottom sheet (item-picker.tsx decides when it opens). */
    private readonly sheet = false,
  ) { super();}

  /** Called by the service right after the portal is attached. */
  init(request: PickerRequest): void {
    this.request = request;
    this.query = '';
    this.trail = [];
    this.active = this.minIndex;
    // Tree mode always virtualises: its flat search can return a thousand leaves, and a
    // panel that changed width between browsing and searching would be worse than a wide one.
    this.virtualise = request.mode === 'tree' || request.options.length > VIRTUALISE_ABOVE;
    this.filterIndex = request.mode === 'flat' ? buildFilterIndex(request.options, request.filterKeys) : [];
    this.rebuild();
  }

  get title(): string {
    return this.request?.title ?? '';
  }

  get items(): Record<number, ItemModel> | undefined {
    return this.request?.mode === 'flat' ? this.request.items : undefined;
  }

  /** An icon column only earns its width when the list actually carries icons. */
  get showIcons(): boolean {
    return this.request?.mode === 'flat' && !!this.request.iconKey;
  }

  /** Whether the "Nenhum" row is offered — and therefore whether index -1 is reachable. */
  get clearable(): boolean {
    return this.request?.clearable !== false;
  }

  get createKind(): string | undefined {
    return this.request?.mode === 'flat' ? this.request.createKind : undefined;
  }

  get canSearch(): boolean { return this.request?.mode === 'flat' && !!this.request.search; }

  openSearch(): void {
    if (this.request.mode === 'flat' && this.request.search) this.closed.emit({ committed: false, search: this.request.search });
  }

  private get minIndex(): number {
    return this.createKind ? -2 : this.clearable ? -1 : 0;
  }

  get viewportHeight(): number | null {
    // In a bottom sheet a short list fills the sheet instead of stopping at 300px.
    if (!this.virtualise && this.sheet) return null;
    return Math.min(this.rows.length * this.rowHeight, MAX_VIEWPORT);
  }

  /** Tree mode only, and only while browsing — a search has no place in the tree. */
  get breadcrumb(): OptionTreeNode[] {
    return this.request?.mode === 'tree' && !this.query.trim() ? this.trail : [];
  }

  onQuery(value: string): void {
    this.pinWidth();
    this.query = value;
    this.active = this.minIndex;
    this.rebuild();
  }

  onKeyDown(event: KeyboardEvent): void {
    const last = this.rows.length - 1;

    // A key this panel acts on is its own: it does not carry on to the page underneath.
    const consume = () => event.stopPropagation();

    switch (event.key) {
      case 'Escape':
        consume();
        this.dismiss();
        return;
      case 'ArrowDown':
        consume();
        event.preventDefault();
        this.moveTo(Math.min(this.active + 1, last));
        return;
      case 'ArrowUp':
        consume();
        event.preventDefault();
        this.moveTo(Math.max(this.active - 1, this.minIndex));
        return;
      case 'Enter':
        consume();
        event.preventDefault();
        this.choose(this.active);
        return;
      case 'ArrowRight': {
        const row = this.rows[this.active];
        if (row?.group) {
          consume();
          event.preventDefault();
          this.choose(this.active);
        }
        return;
      }
      case 'ArrowLeft':
        if (this.canAscend()) {
          consume();
          event.preventDefault();
          this.ascend();
        }
        return;
      case 'Backspace':
        // Only when the box is empty, so backspacing a typo never jumps a level.
        if (!this.query && this.canAscend()) {
          consume();
          event.preventDefault();
          this.ascend();
        }
        return;
      default:
        return;
    }
  }

  /** `index` of -1 is the "Nenhum" row. */
  choose(index: number): void {
    if (index === -2 && this.request.mode === 'flat' && this.request.createKind) {
      this.closed.emit({ committed: false, create: {
        kind: this.request.createKind, slot: this.request.createSlot ?? '', compare: !!this.request.createCompare,
      } });
      return;
    }
    if (index < 0) {
      if (!this.clearable) return;
      this.closed.emit({ committed: true, value: null });
      return;
    }

    const row = this.rows[index];
    if (!row) return;
    if (row.section) return;
    if (row.create && this.request.mode === 'flat') {
      this.closed.emit({ committed: false, create: {
        kind: this.request.createKind!, slot: this.request.createSlot ?? '', compare: !!this.request.createCompare,
      } });
      return;
    }

    if (row.group) {
      this.descend(row);
      return;
    }

    this.closed.emit({ committed: true, value: row.value });
  }

  hover(index: number): void {
    this.active = index;
  }

  dismiss(): void {
    this.closed.emit({ committed: false });
  }

  /** Jump straight to a level from the breadcrumb; index -1 is the root. */
  goToLevel(index: number): void {
    this.trail = this.trail.slice(0, index + 1);
    this.active = this.minIndex;
    this.rebuild();
  }

  isSelected(row: PickerRow): boolean {
    return row.value != null && row.value === this.request?.value;
  }

  /**
   * Snapshots the rendered width so the panel stops growing and shrinking with its
   * contents. Done here rather than on open because the panel is certainly laid out by
   * the time someone has typed into it, which no lifecycle hook can promise for a portal
   * the overlay attaches and change-detects on its own schedule.
   */
  private pinWidth(): void {
    if (this.virtualise || this.pinnedWidth != null) return;

    const panel = this.host.nativeElement.querySelector<HTMLElement>('.picker');
    if (panel?.offsetWidth) this.pinnedWidth = panel.offsetWidth;
  }

  /**
   * ragassets does not serve every icon. A broken-image box in a list of thirty rows is
   * worse than a gap, so drop the element — same as the chips do.
   */
  /** rebuild() returns fresh row literals on every keystroke, so without this the default
   *  differ tears down and recreates every rendered row — each an <img> and a tooltip
   *  directive — per character typed. Rows are already identified by value. */
  trackRow = (_: number, row: PickerRow): any => row.section ? `section:${row.label}` : row.value;

  private canAscend(): boolean {
    return this.request?.mode === 'tree' && !this.query.trim() && this.trail.length > 0;
  }

  private ascend(): void {
    this.trail = this.trail.slice(0, -1);
    this.active = this.minIndex;
    this.rebuild();
  }

  private descend(row: PickerRow): void {
    this.trail = [...this.trail, { label: row.label, value: row.value ?? undefined, children: [...(row.children ?? [])] }];
    this.active = this.minIndex;
    this.rebuild();
  }

  private moveTo(index: number): void {
    this.active = index;
    if (index < 0) return;

    if (this.virtualise) {
      this.viewport?.scrollToIndex(index);
      return;
    }
    // A plain list has no viewport to drive; nudge the row itself into view.
    this.host.nativeElement.querySelector<HTMLElement>(`.picker__row[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  private rebuild(): void {
    this.rows = this.request?.mode === 'tree' ? this.treeRows() : this.flatRows();
    this.publish();
  }

  private flatRows(): PickerRow[] {
    const request = this.request as Extract<PickerRequest, { mode: 'flat' }>;
    this.capped = false;

    const matches = filterOptions(request.options, this.query, this.filterIndex).map((option: DropdownModel) => ({
      label: option.label,
      value: option.value,
      icon: request.iconKey ? (option[request.iconKey] as string | number) : null,
      elementClass:
        request.colourClasses?.[String(option.value)] ??
        (request.elementColoured && option.element ? `property_${option.element}` : undefined),
      preRelease: !!option['preRelease'],
    }));
    if (!request.items || !request.iconKey) return matches;
    const custom = matches.filter((row) => !!request.items?.[Number(row.value)]?.custom);
    if (!custom.length) return matches;
    const official = matches.filter((row) => !request.items?.[Number(row.value)]?.custom);
    return [
      { label: 'Meus itens', value: null, section: true }, ...custom,
      ...(official.length ? [{ label: 'Banco de itens', value: null, section: true }, ...official] : []),
    ];
  }

  private treeRows(): PickerRow[] {
    const request = this.request as Extract<PickerRequest, { mode: 'tree' }>;
    const term = this.query.trim();

    if (term) {
      // Six thousand leaves are four levels down; searching beats drilling once the
      // reader knows the words.
      const { matches, capped } = searchOptionLeaves(request.leafIndex, term, SEARCH_LIMIT);
      this.capped = capped;
      return matches.map((match) => ({ label: match.label, value: match.value }));
    }

    this.capped = false;
    const level = this.trail.length ? (this.trail[this.trail.length - 1].children ?? []) : request.roots;

    return level.map((node) => ({
      label: node.label,
      value: node.value ?? null,
      group: !!node.children?.length,
      children: node.children,
    }));
  }
}

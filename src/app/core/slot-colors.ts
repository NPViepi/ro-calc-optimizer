/**
 * Per-slot highlight colors: the mark a player puts on an equipment card to say
 * "this piece is the build" or "this one is a stand-in". Two halves, stored in
 * two places, because they mean different things.
 *
 * The *assignment* (slot key -> palette id) rides the build model, so it reaches
 * whoever opens a share link or loads a named save — that is the whole point of
 * marking a slot. The *label* a player gives a color is their own vocabulary and
 * stays in their browser (see CalcStorage), so a link never imposes one person's
 * conventions on another's.
 *
 * Framework-free (lives in src/app/core) and structurally typed so it round-trips
 * through JSON and can be validated in unit tests without a DOM.
 */
import { SLOTS_BY_KEY } from '../app-config/equipment-slots';
import { ItemTypeEnum } from '../constants/item-type.enum';
import { TextKey, Translate } from '../i18n';

export interface SlotColor {
  /** Short and stable: this is what a share token carries. */
  id: string;
  /** Catalog key for the palette's own name, shown until the player renames it locally. */
  labelKey: TextKey;
  /** The swatch dot, at full strength. */
  hex: string;
  /**
   * The same colour as bare `R G B` channels, which is the whole entry the card needs:
   * it hands this to CSS as one custom property and each rule mixes its own alpha
   * (`rgb(var(--slot-color-rgb) / 12%)`). The frame, the header wash and the card wash
   * are three strengths of one hue, and how strong each one looks is a question for the
   * stylesheet — not three more strings to keep in step with the hex by hand.
   */
  rgb: string;
}

/**
 * Five colors, deliberately drawn from the teal-blue-violet-pink band plus a neutral.
 *
 * Every other hue in this panel already means something: amber (#fdd87d) is the
 * comparison, top to bottom — the toggle, the sub-row and its chips; green
 * (--green-400) is the hover border on every chip inside these very cards; red is a
 * negative delta; orange is the iRO badge. A mark in any of those reads as one of
 * them. `slot-colors.spec.ts` holds the line if a sixth colour is ever added.
 */
export const SLOT_COLORS: readonly SlotColor[] = [
  { id: 'azul', labelKey: 'slotColor.azul', hex: '#64b5f6', rgb: '100 181 246' },
  { id: 'violeta', labelKey: 'slotColor.violeta', hex: '#b39ddb', rgb: '179 157 219' },
  { id: 'rosa', labelKey: 'slotColor.rosa', hex: '#f48fb1', rgb: '244 143 177' },
  { id: 'turquesa', labelKey: 'slotColor.turquesa', hex: '#4dd0e1', rgb: '77 208 225' },
  { id: 'cinza', labelKey: 'slotColor.cinza', hex: '#b0bec5', rgb: '176 190 197' },
];

export const SLOT_COLOR_BY_ID: ReadonlyMap<string, SlotColor> = new Map(SLOT_COLORS.map((color) => [color.id, color]));

/** Slot key (an ItemTypeEnum value) -> palette id. Lives on the build model. */
export type SlotColorMap = Record<string, string>;

/** Palette id -> the name this browser gave it. Never leaves the browser. */
export type SlotColorLabels = Record<string, string>;

/** A renamed colour is a chip label, not a paragraph. */
export const MAX_SLOT_COLOR_LABEL = 24;

/**
 * Validate a parsed value into a SlotColorMap, dropping anything that does not name
 * both a real equipment card and a real palette entry.
 *
 * Returns a **new, empty** object rather than null when there is nothing valid: `{}`
 * is the model default, which `dropDefaults` already leaves out of a share token. A
 * fresh object every call is load-bearing — the component's `emptyModel` is built
 * once and lives for the session, so handing back a shared default would let one
 * build's marks leak into the next one loaded.
 */
export function sanitizeSlotColors(raw: unknown): SlotColorMap {
  const clean: SlotColorMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;

  for (const [slot, id] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== 'string' || !SLOT_COLOR_BY_ID.has(id) || !SLOTS_BY_KEY.has(slot as ItemTypeEnum)) continue;
    clean[slot] = id;
  }

  return clean;
}

/** Validate the local renames: a known palette id mapped to a trimmed, non-empty name. */
export function sanitizeSlotColorLabels(raw: unknown): SlotColorLabels {
  const clean: SlotColorLabels = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;

  for (const [id, label] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof label !== 'string' || !SLOT_COLOR_BY_ID.has(id)) continue;
    const trimmed = label.trim().slice(0, MAX_SLOT_COLOR_LABEL);
    if (trimmed) clean[id] = trimmed;
  }

  return clean;
}

/** What to call a colour here and now: the player's name for it, else the palette's. */
export function slotColorLabel(color: SlotColor, labels: SlotColorLabels | null | undefined, text: Translate): string {
  return labels?.[color.id] || text(color.labelKey);
}

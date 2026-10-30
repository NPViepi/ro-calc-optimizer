import { describe, expect, it } from 'vitest';
import {
  MAX_SLOT_COLOR_LABEL,
  SLOT_COLORS,
  SLOT_COLOR_BY_ID,
  sanitizeSlotColorLabels,
  sanitizeSlotColors,
  slotColorLabel,
} from './slot-colors';
import { DEFAULT_CATALOG } from '../i18n';
import { translate } from './i18n';

/** The pt-BR catalog, as the translator the palette takes. */
const text = (key: string) => translate(DEFAULT_CATALOG, key);

/**
 * The slot-highlight palette and the two values that ride on it: the per-slot colour,
 * which travels with the build, and the local rename, which must not.
 */

/** Hues this panel has already spent, which a highlight must never be mistaken for. */
const TAKEN = {
  '#fdd87d': 'the comparison, top to bottom',
  '#81c784': 'the chip hover border and the primary accent',
  '#6ebe71': 'the same green, as --green-400',
  '#f87171': 'a negative delta',
  '#f59e0b': 'the iRO pre-release badge',
};

describe('the palette', () => {
  it('offers five colours with unique ids', () => {
    expect(SLOT_COLORS).toHaveLength(5);
    expect(new Set(SLOT_COLORS.map((c) => c.id)).size).toBe(5);
    expect(SLOT_COLOR_BY_ID.size).toBe(5);
  });

  it('gives every colour a name and a hex', () => {
    for (const color of SLOT_COLORS) {
      expect(DEFAULT_CATALOG[color.labelKey]).toBeTruthy();
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  /**
   * The card mixes the frame, the header and the card wash from these channels, so a
   * triple that disagrees with its own hex would tint a card in a colour its swatch
   * never shows — and nothing on screen would say which of the two was meant.
   */
  it('states the same colour twice, as a hex and as channels', () => {
    for (const color of SLOT_COLORS) {
      const channels = [1, 3, 5].map((at) => parseInt(color.hex.slice(at, at + 2), 16));
      expect(color.rgb).toBe(channels.join(' '));
    }
  });

  it('never reuses a hue that already means something else on this screen', () => {
    for (const color of SLOT_COLORS) {
      expect(Object.keys(TAKEN)).not.toContain(color.hex.toLowerCase());
    }
  });
});

describe('sanitizeSlotColors', () => {
  it('keeps entries naming a real slot and a real colour', () => {
    expect(sanitizeSlotColors({ weapon: 'azul', armor: 'rosa' })).toEqual({ weapon: 'azul', armor: 'rosa' });
  });

  it('drops a slot the grid does not draw', () => {
    expect(sanitizeSlotColors({ weapon: 'azul', naoExiste: 'azul' })).toEqual({ weapon: 'azul' });
  });

  it('drops a colour that is not in the palette', () => {
    expect(sanitizeSlotColors({ weapon: 'dourado', armor: 'rosa' })).toEqual({ armor: 'rosa' });
  });

  it('drops a non-string value', () => {
    expect(sanitizeSlotColors({ weapon: 3, armor: null, boot: 'cinza' })).toEqual({ boot: 'cinza' });
  });

  it('answers an empty map for anything unusable', () => {
    for (const raw of [null, undefined, 'azul', 7, ['azul'], {}]) {
      expect(sanitizeSlotColors(raw)).toEqual({});
    }
  });

  /**
   * The component builds its blank model once and keeps it for the session. Handing back
   * a shared object would let one build's marks follow the next one loaded.
   */
  it('returns a fresh object every call', () => {
    expect(sanitizeSlotColors({ weapon: 'azul' })).not.toBe(sanitizeSlotColors({ weapon: 'azul' }));
    expect(sanitizeSlotColors(null)).not.toBe(sanitizeSlotColors(null));
  });
});

describe('sanitizeSlotColorLabels', () => {
  it('keeps a trimmed name for a known colour', () => {
    expect(sanitizeSlotColorLabels({ azul: '  Essencial  ' })).toEqual({ azul: 'Essencial' });
  });

  it('drops a name for a colour that is not in the palette', () => {
    expect(sanitizeSlotColorLabels({ dourado: 'Essencial', rosa: 'Temporário' })).toEqual({ rosa: 'Temporário' });
  });

  it('drops an empty or whitespace-only name, which is how the palette name comes back', () => {
    expect(sanitizeSlotColorLabels({ azul: '', rosa: '   ' })).toEqual({});
  });

  it('caps a name at chip length', () => {
    const long = 'a'.repeat(MAX_SLOT_COLOR_LABEL + 20);
    expect(sanitizeSlotColorLabels({ azul: long }).azul).toHaveLength(MAX_SLOT_COLOR_LABEL);
  });

  it('answers an empty map for anything unusable', () => {
    for (const raw of [null, undefined, 'Essencial', 7, ['Essencial']]) {
      expect(sanitizeSlotColorLabels(raw)).toEqual({});
    }
  });
});

describe('slotColorLabel', () => {
  const azul = SLOT_COLOR_BY_ID.get('azul')!;

  it('prefers the name this browser gave the colour', () => {
    expect(slotColorLabel(azul, { azul: 'Essencial' }, text)).toBe('Essencial');
  });

  it('falls back to the palette name when there is none', () => {
    expect(slotColorLabel(azul, {}, text)).toBe('Azul');
    expect(slotColorLabel(azul, null, text)).toBe('Azul');
  });
});

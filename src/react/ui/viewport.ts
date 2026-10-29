import { useSyncExternalStore } from 'react';
export type ViewportBand = 'desktop' | 'tablet' | 'phone';
/**
 * The breakpoints live in one place, src/react/views/responsive.css, which publishes the
 * active band as `--viewport-band`. Script reads that instead of repeating the widths.
 */
export function viewportBand(): ViewportBand {
  if (typeof document === 'undefined') return 'desktop';
  const band = getComputedStyle(document.documentElement).getPropertyValue('--viewport-band').trim();
  return band === 'phone' || band === 'tablet' ? band : 'desktop';
}
/** True where the item picker opens as a bottom sheet (`--item-picker` in responsive.css). */
export function itemPickerSheet(): boolean {
  if (typeof document === 'undefined') return false;
  return getComputedStyle(document.documentElement).getPropertyValue('--item-picker').trim() === 'sheet';
}
const hoverNone = typeof matchMedia === 'function' ? matchMedia('(hover: none)') : null;
/** True on a screen without hover (a phone or a touch tablet): tips open by tap there. */
export function hoverless(): boolean {
  return hoverNone?.matches ?? false;
}
/**
 * The active band, cached and re-read only when the window is resized, so a render does
 * not force a style recalculation. One resize listener is shared by every caller.
 */
let band: ViewportBand | null = null;
const listeners = new Set<() => void>();
function onResize(): void {
  const next = viewportBand();
  if (next === band) return;
  band = next;
  listeners.forEach(listener => listener());
}
function subscribeBand(onChange: () => void): () => void {
  if (!listeners.size) window.addEventListener('resize', onResize);
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (!listeners.size) { window.removeEventListener('resize', onResize); band = null; }
  };
}
function bandSnapshot(): ViewportBand {
  return band ??= viewportBand();
}
export function useViewportBand(): ViewportBand {
  return useSyncExternalStore(subscribeBand, bandSnapshot, () => 'desktop');
}

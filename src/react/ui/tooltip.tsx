import { FocusEvent as ReactFocusEvent, HTMLAttributes, MouseEvent as ReactMouseEvent, createElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ConnectedPosition } from './layers';
import { Portal } from './portal';
import { sanitizeHtml } from './sanitize-html';
import { HoverLifetime } from './hover-lifetime';
import { hoverless, viewportBand } from './viewport';

const POSITIONS: Record<string, ConnectedPosition> = {
  right: { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center' },
  left: { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center' },
  top: { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
  bottom: { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
};
// A touch sequence replays compatibility mouse events (mouseenter, focus, click) right
// after the touch. Within this window those events belong to the tap, not to a pointer.
const TOUCH_WINDOW = 800;
export interface TooltipOptions {
  text: string | null | undefined;
  position?: 'right' | 'left' | 'top' | 'bottom';
  className?: string;
  showDelay?: number;
  hideDelay?: number;
  escape?: boolean;
  disabled?: boolean;
  describedBy?: string;
  /**
   * Whether a tap on the anchor opens the tip. Off when the anchor's own click is its
   * action (the tip only names that action), so a tap never does two things.
   */
  tap?: boolean;
}
/** Adds no DOM wrapper, preserving the feature's native element and CSS geometry. */
export function useTooltip({ text, position = 'right', className = '', showDelay = 0, hideDelay = 0,
  escape = true, disabled = false, describedBy, tap = true }: TooltipOptions) {
  const id = `ui-tooltip-${useId()}`;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const lastTouch = useRef(0);
  // Opened by a tap: no mouseleave will ever close it, so an outside tap does.
  const tapped = useRef(false);
  const latest = useRef({ text, disabled, showDelay, hideDelay, className }); latest.current = { text, disabled, showDelay, hideDelay, className };
  const [hover] = useState(() => new HoverLifetime(() => setAnchor(target.current), () => { tapped.current = false; setAnchor(null); },
    () => !!target.current?.isConnected && !!latest.current.text && !latest.current.disabled,
    () => latest.current.showDelay, () => latest.current.className.includes('item_desc_tooltip') ? 150 : latest.current.hideDelay));
  const cancelHide = () => hover.cancelHide();
  const hide = () => hover.hide();
  const touching = () => Date.now() - lastTouch.current < TOUCH_WINDOW;
  const activate = (element: HTMLElement) => {
    target.current = element; hover.activate();
  };
  const deactivate = () => {
    if (!tapped.current) hover.deactivate();
  };
  /** Opens the tip the way a tap does, anchored to `element`; a second call closes it. */
  const openFor = (element: HTMLElement | null) => {
    if (!element) return;
    if (hover.isOpen) { hide(); return; }
    target.current = element; tapped.current = true;
    // On a phone a long description reads better as a sheet than as a bubble.
    setSheet(viewportBand() === 'phone' && latest.current.className.includes('item_desc_tooltip'));
    hover.open();
  };
  useEffect(() => {
    if (!text || disabled) hide();
  }, [text, disabled]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      hover.hide();
      queueMicrotask(() => { if (!mounted.current) hover.dispose(); });
    };
  }, [hover]);
  const positions = useMemo(() => [POSITIONS[position], ...Object.entries(POSITIONS).filter(([key]) => key !== position).map(([, value]) => value)], [position]);
  const align = (connection: ConnectedPosition, panel: HTMLElement) => {
    const chosen = Object.entries(POSITIONS).find(([, value]) => value.originX === connection.originX && value.originY === connection.originY)?.[0] ?? position;
    for (const key of Object.keys(POSITIONS)) panel.classList.remove(`ui-tooltip-${key}`);
    panel.classList.add(`ui-tooltip-${chosen}`);
    const correction = (panel.getBoundingClientRect().height - panel.offsetHeight) / 2;
    panel.style.marginTop = chosen === 'right' || chosen === 'left' ? `${correction}px` : '0';
  };
  const triggerProps: HTMLAttributes<HTMLElement> = {
    onPointerDown: event => { if (event.pointerType !== 'mouse') lastTouch.current = Date.now(); },
    // A screen without hover opens tips by tap only; a mouseenter there is synthetic (e.g.
    // a sheet sliding in under the last touch point) and must not open one.
    onMouseEnter: event => { if (!touching() && !hoverless()) activate(event.currentTarget); },
    onMouseLeave: deactivate,
    onFocus: event => { if (!touching()) activate(event.currentTarget); },
    onBlur: deactivate,
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (!tap || !touching() || !latest.current.text || latest.current.disabled) return;
      const element = event.currentTarget;
      // A tap inside a list option also picks that option and may unmount the anchor;
      // open only once the click has settled and the anchor is still on the page.
      setTimeout(() => { if (element.isConnected) openFor(element); });
    },
    'aria-describedby': [describedBy, anchor ? id : null].filter(Boolean).join(' ') || undefined,
    'data-tip-anchor': '',
  } as HTMLAttributes<HTMLElement>;
  const content = escape ? <div className="ui-tooltip-text">{text}</div> : <div className="ui-tooltip-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />;
  const tooltip = anchor && text && !disabled ? sheet
    ? <Portal anchor={null} origin={anchor} position="bottom" panelClass={`ui-tooltip ui-tooltip-sheet ${className}`} role="tooltip" id={id} lock={false}
      onDismiss={hide} onOutside={hide}>
      {createElement('app-ui-tooltip-content', null, <>
        <button type="button" className="ui-tooltip-sheet-close" aria-label="Fechar descrição" onClick={hide}>✕</button>
        {content}
      </>)}
    </Portal>
    : <Portal anchor={anchor} origin={anchor} positions={positions}
      panelClass={`ui-tooltip ui-tooltip-${position} ${className}`} role="tooltip" id={id} lock={false}
      onDismiss={hide} onOutside={tapped.current ? hide : undefined} onOutsideScroll={hide} onPosition={align}>
      {createElement('app-ui-tooltip-content', { onMouseEnter: cancelHide, onMouseLeave: deactivate }, content)}
    </Portal> : null;
  return { triggerProps, tooltip, openFor };
}
/**
 * A list option or a select button is the keyboard stop for the tip anchors inside it, so
 * its own focus and blur are passed on to its first anchor: the tip opens from the keyboard
 * without giving the anchor a second tab stop.
 */
export const forwardTipFocus = {
  onFocus: (event: ReactFocusEvent<HTMLElement>) => relayFocus(event, 'focusin'),
  onBlur: (event: ReactFocusEvent<HTMLElement>) => relayFocus(event, 'focusout'),
};
function relayFocus(event: ReactFocusEvent<HTMLElement>, type: 'focusin' | 'focusout') {
  // Only keyboard focus: a click also focuses the row or button, and must not leave a tip open.
  if (event.target !== event.currentTarget || (type === 'focusin' && !event.currentTarget.matches(':focus-visible'))) return;
  event.currentTarget.querySelector('[data-tip-anchor]')?.dispatchEvent(new FocusEvent(type, { bubbles: true }));
}

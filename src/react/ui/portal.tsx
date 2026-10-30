import { ReactNode, createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConnectedPosition, LayerManager, positionConnected, trapFocus } from './layers';

const LayersContext = createContext<LayerManager | null>(null);
export function useLayers(): LayerManager {
  const manager = useContext(LayersContext);
  if (!manager) throw new Error('Overlay controls require a LayersProvider');
  return manager;
}
export function LayersProvider({ manager, children }: { manager: LayerManager; children: ReactNode }) {
  return <LayersContext.Provider value={manager}>{children}</LayersContext.Provider>;
}
export interface PortalProps {
  children: ReactNode;
  origin?: HTMLElement | null;
  anchor?: HTMLElement | null;
  positions?: ConnectedPosition[];
  panelClass?: string;
  modal?: boolean;
  backdropClassName?: string;
  lock?: boolean;
  trap?: boolean;
  position?: 'center' | 'top' | 'right' | 'bottom';
  minWidth?: number;
  width?: number;
  role?: string;
  id?: string;
  onDismiss: () => void;
  onEscape?: () => void;
  onBackdrop?: () => void;
  onOutside?: () => void;
  onOutsideScroll?: () => void;
  onPosition?: (position: ConnectedPosition, panel: HTMLElement) => void;
}
export function Portal({ children, origin = null, anchor, positions, panelClass = '', modal = false, backdropClassName = 'ui-dialog-mask', lock = true,
  trap = false, position = 'center', minWidth, width, role, id, onDismiss, onEscape, onBackdrop, onOutside,
  onOutsideScroll, onPosition }: PortalProps) {
  const manager = useLayers();
  const callbacks = useRef({ onDismiss, onEscape, onBackdrop, onOutside, onOutsideScroll, onPosition });
  callbacks.current = { onDismiss, onEscape, onBackdrop, onOutside, onOutsideScroll, onPosition };
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const host = document.createElement('div');
    host.className = 'ui-overlay-host';
    const pane = document.createElement('div');
    pane.className = `ui-overlay-pane ${panelClass}`;
    if (role) pane.setAttribute('role', role);
    if (id) pane.id = id;
    if (minWidth != null) pane.style.minWidth = `${minWidth}px`;
    if (width != null) pane.style.width = `${width}px`;
    if (!anchor) {
      host.style.display = 'flex'; host.style.justifyContent = position === 'right' ? 'flex-end' : 'center';
      host.style.alignItems = position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center';
      pane.style.position = 'relative';
      if (position === 'top') pane.style.marginTop = '.75rem';
    }
    if (modal) {
      const backdrop = document.createElement('div');
      backdrop.className = `ui-overlay-backdrop ${backdropClassName}`;
      backdrop.addEventListener('click', () => callbacks.current.onBackdrop?.());
      host.append(backdrop);
    }
    host.append(pane); document.body.append(host);
    const release = manager.register(pane, origin ?? document.activeElement as HTMLElement, () => callbacks.current.onDismiss(), lock,
      () => (callbacks.current.onEscape ?? callbacks.current.onDismiss)());
    const outside = (event: MouseEvent) => {
      const path = event.composedPath();
      const onOrigin = origin && (path.includes(origin) || origin.contains(event.target as Node));
      if (manager.isOutside(pane, event.target as Node, path) && !onOrigin) callbacks.current.onOutside?.();
    };
    document.addEventListener('click', outside);
    const outsideScroll = (event: Event) => {
      if (manager.isOutside(pane, event.target as Node, event.composedPath())) callbacks.current.onOutsideScroll?.();
    };
    document.addEventListener('scroll', outsideScroll, true);
    setContainer(pane);
    return () => {
      release(); document.removeEventListener('click', outside); document.removeEventListener('scroll', outsideScroll, true); host.remove();
    };
  }, [manager, origin, anchor, panelClass, modal, lock, position, minWidth, width, role, id]);
  useLayoutEffect(() => {
    if (!container) return undefined;
    const reposition = () => {
      if (!anchor?.isConnected) return;
      const connection = positionConnected(container, anchor, positions);
      if (connection) callbacks.current.onPosition?.(connection, container);
    };
    reposition();
    const observer = new ResizeObserver(reposition); observer.observe(container);
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    const frame = requestAnimationFrame(reposition);
    const restore = trap ? trapFocus(container.querySelector<HTMLElement>('[role="dialog"]') ?? container) : undefined;
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', reposition); document.removeEventListener('scroll', reposition, true); restore?.();
    };
  }, [container, anchor, positions, trap]);
  return container ? createPortal(children, container) : null;
}

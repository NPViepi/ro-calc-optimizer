import { ReactNode, createElement } from 'react';
import { ConnectedPosition } from './layers';
import { Portal } from './portal';
import { alignPopover } from './popover-position';

const CENTERED: ConnectedPosition[] = [
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
];
export interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  className?: string;
  ariaLabel?: string;
  centered?: boolean;
  children: ReactNode;
  containerRef?: (element: HTMLDivElement | null) => void;
}
export function Popover({ anchor, onClose, className = '', ariaLabel, centered = false, children, containerRef }: PopoverProps) {
  if (!anchor) return null;
  const align = (position: ConnectedPosition, panel: HTMLElement) => {
    const container = panel.querySelector<HTMLElement>('.ui-overlaypanel');
    if (!container) return;
    alignPopover(container, anchor, position);
  };
  return createElement('app-ui-popover', null, <Portal anchor={anchor} origin={anchor} positions={centered ? CENTERED : undefined}
    panelClass="ui-popover-pane" lock={false} onDismiss={() => { onClose(); if (anchor.isConnected) anchor.focus({ preventScroll: true }); }}
    onOutside={onClose} onOutsideScroll={onClose} onPosition={align}>
    <div ref={containerRef} className={`ui-overlaypanel ui-component ${className}`} role="region" aria-label={ariaLabel}>
      {/* Shown on phones only (responsive.css), where a popover can fill the screen and
          leave no outside to tap. */}
      <button type="button" className="ui-overlaypanel-close" aria-label="Fechar" onClick={onClose}>✕</button>
      <div className="ui-overlaypanel-content">{children}</div>
    </div>
  </Portal>);
}

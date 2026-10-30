import { ReactNode, createElement } from 'react';
import { useText } from '../state/use-text';
import { ConnectedPosition } from './layers';
import { Portal } from './portal';
import { alignPopover } from './popover-position';
import { viewportBand } from './viewport';

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
  const t = useText();
  if (!anchor) return null;
  // A phone has no room for a panel beside its anchor: it opens as a bottom sheet.
  const sheet = viewportBand() === 'phone';
  const align = (position: ConnectedPosition, panel: HTMLElement) => {
    const container = panel.querySelector<HTMLElement>('.ui-overlaypanel');
    if (!container) return;
    alignPopover(container, anchor, position);
  };
  return createElement('app-ui-popover', null, <Portal anchor={sheet ? null : anchor} origin={anchor} positions={centered ? CENTERED : undefined}
    position={sheet ? 'bottom' : undefined} panelClass={`ui-popover-pane ${sheet ? 'ui-popover-pane--sheet' : ''}`} lock={false}
    onDismiss={() => { onClose(); if (anchor.isConnected) anchor.focus({ preventScroll: true }); }}
    onOutside={onClose} onOutsideScroll={sheet ? undefined : onClose} onPosition={sheet ? undefined : align}>
    <div ref={containerRef} className={`ui-overlaypanel ui-component ${className}`} role="region" aria-label={ariaLabel}>
      {/* A sheet can fill the screen and leave no outside to tap, so it gets a header that
          keeps its close button in reach while the content scrolls under it. */}
      {sheet && <div className="ui-overlaypanel-header">
        <button type="button" className="ui-overlaypanel-close" aria-label={t('ui.dialog.close')} onClick={onClose}>✕</button>
      </div>}
      <div className="ui-overlaypanel-content">{children}</div>
    </div>
  </Portal>);
}

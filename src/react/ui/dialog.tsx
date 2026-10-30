import { CSSProperties, ReactNode, createElement, useId, useLayoutEffect, useRef, useState } from 'react';
import { useText } from '../state/use-text';
import { Portal } from './portal';
import { Icon } from './primitives';

export interface DialogProps {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onClosed?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  modal?: boolean;
  closable?: boolean;
  closeOnEscape?: boolean;
  dismissableMask?: boolean;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  className?: string;
  position?: 'center' | 'top' | 'right';
}
export function Dialog({ visible, onVisibleChange, onClosed, header = '', footer, children, modal = false,
  closable = true, closeOnEscape = true, dismissableMask = false, style, contentStyle, className = '', position }: DialogProps) {
  const t = useText();
  const id = useId();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const closed = useRef(onClosed); closed.current = onClosed;
  const lifecycle = useRef<object | null>(null);
  useLayoutEffect(() => {
    if (!visible) return undefined;
    const token = {}; lifecycle.current = token;
    return () => {
      queueMicrotask(() => { if (lifecycle.current === token) closed.current?.(); });
    };
  }, [visible]);
  const close = () => onVisibleChange(false);
  return createElement('app-ui-dialog', { ref: setHost }, visible ? <Portal origin={host} modal={modal} trap={modal} panelClass={`ui-dialog-pane ${position === 'right' ? 'ui-dialog-sidebar-pane' : ''}`} position={position} minWidth={typeof style?.minWidth === 'string' ? parseFloat(style.minWidth) : style?.minWidth}
    onDismiss={close} onEscape={() => { if (closable && closeOnEscape) close(); }}
    onBackdrop={() => { if (dismissableMask) close(); }}>
    <section className={`ui-dialog ui-component ${position === 'right' ? 'ui-dialog-sidebar' : ''} ${className}`} style={style} role="dialog" aria-modal={modal} aria-labelledby={id} tabIndex={-1}>
      <div className="ui-dialog-header"><span className={`ui-dialog-title ${typeof header === 'string' ? '' : 'ui-dialog-title-custom'}`} id={id}>{header}</span>
        {closable && <button type="button" className="ui-dialog-header-icon ui-dialog-header-close ui-link" aria-label={t('ui.dialog.close')} onClick={close}><Icon name="times" /></button>}
      </div><div className="ui-dialog-content" style={contentStyle}>{children}</div>
      {footer != null && <div className="ui-dialog-footer">{footer}</div>}
    </section>
  </Portal> : null);
}

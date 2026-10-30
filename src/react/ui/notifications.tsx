import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Confirmations, Messages } from '../services/notifications';
import { useText } from '../state/use-text';
import { IconName } from '../../app/ui/icon-names';
import { Button, Icon } from './primitives';
import { Dialog } from './dialog';

const icons: Record<string, IconName> = { success: 'check', info: 'info-circle', warn: 'exclamation-triangle', error: 'times-circle' };
export function Toast({ service }: { service: Messages }) {
  const t = useText();
  const messages = useSyncExternalStore(service.subscribe, service.getSnapshot);
  return <div className="ui-toast ui-component" aria-live="polite">{messages.map((message, index) =>
    <div key={index} className={`ui-toast-message ui-toast-message-${message.severity || 'info'}`} role="status">
      <div className="ui-toast-message-content"><Icon className="ui-toast-message-icon" name={icons[message.severity || 'info']} />
        <div className="ui-toast-message-text"><div className="ui-toast-summary">{message.summary}</div><div className="ui-toast-detail">{message.detail}</div></div>
        <button type="button" className="ui-toast-icon-close ui-link" aria-label={t('ui.toast.close')} onClick={() => service.remove(message)}><Icon name="times" /></button>
      </div>
    </div>)}</div>;
}
export function ConfirmDialog({ service }: { service: Confirmations }) {
  const t = useText();
  const request = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const mounted = useRef<Confirmations | null>(null);
  useEffect(() => {
    mounted.current = service;
    return () => {
      mounted.current = null;
      // Strict Mode immediately reattaches effects. Cancel on a real unmount,
      // while preserving a request that was pending before the first render.
      const pending = service.getSnapshot();
      queueMicrotask(() => {
        if (mounted.current !== service && service.getSnapshot() === pending) service.resolve(false);
      });
    };
  }, [service]);
  return <Dialog visible={!!request} onVisibleChange={visible => { if (!visible) service.resolve(false); }}
    header={request?.header || t('ui.confirm.header')} modal className="ui-confirm-dialog" style={{ width: '25vw' }} position="top"
    footer={<><Button className="ui-confirm-dialog-reject" icon="times" label={t('common.no')} onClick={() => service.resolve(false)} />
      <Button className="ui-confirm-dialog-accept" data-focus-initial icon="check" label={t('common.yes')} onClick={() => service.resolve(true)} /></>}>
    <div className="ui-confirm-dialog-message">{request?.icon && <Icon className="ui-confirm-dialog-icon" name={request.icon} />}<span>{request?.message}</span></div>
  </Dialog>;
}

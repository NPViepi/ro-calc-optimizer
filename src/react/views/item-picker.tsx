import { MutableRefObject, createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PickerRequest } from '../../app/layout/pages/ro-calculator/item-picker/item-picker.model';
import { ItemPickerOverlayComponent } from '../controllers/item-picker-overlay';
import { ApplicationServices, useServices } from '../services/application';
import { Portal } from '../ui/portal';
import { itemPickerSheet } from '../ui/viewport';
import { PICKER_POSITIONS } from '../ui/layers';
import { Content } from './content/item-picker-overlay';
import { identityKey } from './template-values';
import { SlotColorPickerComponent } from '../controllers/slot-color-picker';
import { Content as ColorContent } from './content/slot-color-picker';
import { SlotColorPickerRequest } from '../../app/layout/pages/ro-calculator/slot-color-picker/slot-color-picker.model';

const itemPositions = PICKER_POSITIONS.map(position => ({ ...position, offsetY: position.originY === 'bottom' ? 4 : -4 }));

function PickerPanel({ request, services, sheet }: { request: PickerRequest; services: ApplicationServices; sheet: boolean }) {
  const [host] = useState<{ nativeElement: HTMLElement }>(() => ({ nativeElement: null! }));
  const [vm] = useState(() => {
    const controller = new ItemPickerOverlayComponent(host, services.data.descriptions, sheet);
    controller.init(request);
    return controller;
  });
  useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  useSyncExternalStore(services.data.descriptions.subscribe, services.data.descriptions.getSnapshot);
  useEffect(() => {
    const subscription = vm.closed.subscribe(value => services.itemPicker.settle(value));
    return () => { subscription.unsubscribe(); vm.dispose(); };
  }, [vm, services]);
  useLayoutEffect(() => () => { host.nativeElement = null!; }, [host]);
  return createElement('app-item-picker-overlay', { ref: (element: HTMLElement) => { host.nativeElement = element; } }, <Content vm={vm} services={services} />);
}
export function ItemPickerOverlay() {
  const services = useServices();
  const request = useSyncExternalStore(services.itemPicker.subscribe, services.itemPicker.getSnapshot);
  if (!request) return null;
  const close = () => services.itemPicker.close();
  // A phone, or a screen too short for the panel, has no room beside the slot: the picker
  // opens as a bottom sheet instead. The choice holds while it is open: an open panel is
  // clamped into a window that shrinks (dependency-replacements.spec.ts).
  const sheet = itemPickerSheet();
  return <Portal anchor={sheet ? null : request.anchor} origin={request.anchor} positions={itemPositions} position={sheet ? 'bottom' : undefined}
    modal backdropClassName={sheet ? 'ui-dialog-mask' : 'ui-overlay-transparent-backdrop'} trap
    onDismiss={close} onBackdrop={close} onOutside={close} panelClass={`ui-item-picker-pane ${sheet ? 'ui-item-picker-pane--sheet' : ''}`}>
    <PickerPanel key={identityKey(request)} request={request} services={services} sheet={sheet} />
  </Portal>;
}

function ColorPanel({ request, services, controller }: { request: SlotColorPickerRequest; services: ApplicationServices; controller: MutableRefObject<SlotColorPickerComponent | null> }) {
  const [vm] = useState(() => {
    const controller = new SlotColorPickerComponent(); controller.init(request, services.slotColors.labels); return controller;
  });
  useSyncExternalStore(vm.subscribe, vm.getSnapshot);
  controller.current = vm;
  useEffect(() => {
    const subscription = vm.event.subscribe(event => {
      if (event.kind === 'rename') {
        services.slotColors.labels = { ...(event.labels ?? {}) }; services.slotColors.localChange.next();
      } else services.slotColors.picker.settle(event);
    });
    return () => { subscription.unsubscribe(); vm.dispose(); if (controller.current === vm) controller.current = null; };
  }, [vm, services]);
  return createElement('app-slot-color-picker', null, <ColorContent vm={vm} services={services} />);
}
export function ColorPickerOverlay() {
  const services = useServices();
  const controller = useRef<SlotColorPickerComponent | null>(null);
  const request = useSyncExternalStore(services.slotColors.picker.subscribe, services.slotColors.picker.getSnapshot);
  if (!request) return null;
  const close = () => services.slotColors.picker.close();
  return <Portal anchor={request.anchor} origin={request.anchor} modal backdropClassName="ui-overlay-transparent-backdrop" trap
    onEscape={() => { const vm = controller.current; vm?.editing ? vm.action(() => vm.cancelRename()) : close(); }}
    onDismiss={close} onBackdrop={close} onOutside={close} panelClass="ui-slot-color-picker-pane">
    <ColorPanel key={identityKey(request)} request={request} services={services} controller={controller} />
  </Portal>;
}

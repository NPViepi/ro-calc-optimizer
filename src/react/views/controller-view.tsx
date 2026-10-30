import { ComponentType, ReactNode, createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ApplicationServices, useServices } from '../services/application';
import { Events } from '../services/events';
import { ViewState } from '../state/view-state';

interface ViewController extends ViewState {
  refreshInputs?: () => void;
  ngOnDestroy?: () => void;
  ngOnInit?: () => void;
}
/** Inputs commit before paint; emitted actions always use the parent's current handlers. */
export function controllerView<T extends ViewController>(factory: (services: ApplicationServices) => T,
  inputs: readonly string[], outputs: readonly string[], Content: ComponentType<{ vm: T; services: ApplicationServices }>, tag: string) {
  return function View(props: Record<string, any>): ReactNode {
    const services = useServices();
    const [vm] = useState(() => factory(services));
    const latest = useRef(props); latest.current = props;
    const mounted = useRef(false);
    const initialized = useRef(false);
    const [ready, setReady] = useState(false);
    useSyncExternalStore(vm.subscribe, vm.getSnapshot);
    useSyncExternalStore(services.data.descriptions.subscribe, services.data.descriptions.getSnapshot);
    useSyncExternalStore(services.customItems.subscribe, services.customItems.getSnapshot);
    useSyncExternalStore(services.layout.previews.subscribe, services.layout.previews.getSnapshot);
    // Controllers compute labels through `services.locale.text`, so a language switch
    // has to re-render them the same way a new item description does.
    useSyncExternalStore(services.locale.subscribe, services.locale.getSnapshot);
    useLayoutEffect(() => {
      for (const name of inputs) if (Object.prototype.hasOwnProperty.call(props, name)) (vm as any)[name] = props[name];
      if (!initialized.current) { initialized.current = true; vm.ngOnInit?.(); }
      vm.refreshInputs?.();
      vm.publish();
      setReady(true);
    }, inputs.map(name => props[name]));
    useEffect(() => {
      mounted.current = true;
      const subscriptions = outputs.map(name => ((vm as any)[name] as Events).subscribe(value => latest.current[name]?.(value)));
      return () => {
        mounted.current = false;
        subscriptions.forEach(subscription => subscription.unsubscribe());
        queueMicrotask(() => { if (!mounted.current) { vm.ngOnDestroy?.(); vm.dispose(); } });
      };
    }, [vm]);
    props['reference']?.(vm);
    return createElement(tag, { className: props['className'], style: props['style'] }, ready ? <Content vm={vm} services={services} /> : null);
  };
}

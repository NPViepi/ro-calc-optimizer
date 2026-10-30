import { createElement, useEffect, useSyncExternalStore } from 'react';
import { ApplicationServices, ServicesProvider } from './services/application';
import { CalculatorSession } from './state/calculator-session';
import { useCalculator } from './state/use-calculator';
import { registerCalculatorViews } from './views/calculator-views';
import { Content } from './views/content/ro-calculator';
import { ColorPickerOverlay, ItemPickerOverlay } from './views/item-picker';
import { Render, registerViews } from './views/render';
import { ElementalTable } from './views/elemental-table';
import { LocaleFirstRun } from './views/locale-first-run';
import { AspdCurve } from './views/aspd-curve';
import { useText } from './state/use-text';
import './views/calculator-styles';

registerCalculatorViews();
registerViews({
  'app-elemental-table-raw': props => <ElementalTable {...props as any} />,
  'app-aspd-curve': props => <AspdCurve {...props as any} />,
});
function Calculator({ services, session }: { services: ApplicationServices; session: CalculatorSession }) {
  const vm = useCalculator(session);
  useEffect(() => { session.start(); }, [session]);
  useEffect(() => { if (!vm.isBooting) session.viewReady(); }, [session, vm.isBooting]);
  // Mount the large editor once the initial solve is complete. Data preparation
  // otherwise repeatedly renders an empty/intermediate editor behind the splash.
  return createElement('app-ro-calculator', null, vm.isBooting ? null : <Content vm={vm} services={services} />);
}
function Footer({ session }: { session: CalculatorSession }) {
  const booting = useSyncExternalStore(session.subscribe, () => session.isBooting);
  const t = useText();
  if (booting) return null;
  // The credit reads around its link, so the sentence is split either side of it rather
  // than interpolated — a translation that moves the name keeps both halves.
  return createElement('app-footer', null, <div className="layout-footer flex-column gap-1 text-center" style={{ fontSize: '0.85rem' }}>
    <div><a href="https://latam-tools.com.br/" target="_blank" rel="noreferrer noopener">LATAM Tools</a><span className="mx-2">•</span>
      <a href="https://github.com/adsonpleal/latam-ro-calc" target="_blank" rel="noreferrer noopener">{t('footer.source')}</a><span className="mx-2">•</span>
      {t('footer.basedOn')}<a href="https://github.com/turugrura/tong-calc-ro" target="_blank" rel="noreferrer noopener">tong-calc-ro</a>{t('footer.basedOnTail')}</div>
    <div className="text-color-secondary">{t('footer.rights')}</div>
  </div>);
}
export function Application({ services, session }: { services: ApplicationServices; session: CalculatorSession }) {
  return <ServicesProvider services={services}>
    <div className="layout-wrapper layout-theme-dark layout-overlay">
      <Render tag="app-topbar" props={{}} />
      <div className="layout-main-container"><div className="layout-main"><Calculator services={services} session={session} /></div><Footer session={session} /></div>
      <div className="layout-mask" />
    </div>
    <ItemPickerOverlay /><ColorPickerOverlay /><LocaleFirstRun />
  </ServicesProvider>;
}

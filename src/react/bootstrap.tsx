import { createRoot } from 'react-dom/client';
import { DataKey, DataManifest } from '../app/core/data-manifest';
import { Application } from './application';
import { ApplicationServices } from './services/application';

export async function mountApplication(): Promise<void> {
  const boot = window as Window & { __RO_DATA__?: DataManifest; __RO_BOOT__?: Partial<Record<DataKey, Promise<unknown>>> };
  const services = new ApplicationServices(localStorage, { manifest: boot.__RO_DATA__, inFlight: boot.__RO_BOOT__ });
  const session = services.createCalculator();
  // Same reasoning as the stylesheets main.ts waits for: mount once the chosen
  // language is in hand, so a reader who picked Spanish never sees Portuguese first.
  await services.locale.ready;
  const root = createRoot(document.querySelector('app-root')!);
  root.render(<Application services={services} session={session} />);
  window.addEventListener('pagehide', () => { root.unmount(); services.dispose(); }, { once: true });
}

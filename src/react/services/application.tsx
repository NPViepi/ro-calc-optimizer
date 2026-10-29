import { ReactNode, createContext, useContext } from 'react';
import { DataKey, DataManifest } from '../../app/core/data-manifest';
import { CalcStorage, StorageLike } from '../../app/core/calc-storage';
import { SavedSimulationStore } from '../../app/core/saved-simulations';
import { ReplaySubmissionClient } from '../../app/replay/submission-client';
import { LayerManager } from '../ui/layers';
import { LayersProvider } from '../ui/portal';
import { CustomItems } from './custom-items';
import { DataClient } from './data-client';
import { LocalePreferences } from './locale';
import { Confirmations, Messages } from './notifications';
import { LocaleProvider } from '../state/use-text';
import { CalculatorSession } from '../state/calculator-session';
import { CalculatorData, CalculatorLayout, ItemShop, SlotColorPreferences } from './calculator-services';
import { ItemPicker } from './pickers';

/** Created by the browser entry, outside React rendering and its mutable engines. */
export class ApplicationServices {
  readonly data: DataClient;
  readonly customItems: CustomItems;
  readonly preferences: CalcStorage;
  readonly savedSimulations: SavedSimulationStore;
  readonly replaySubmissions = new ReplaySubmissionClient();
  readonly layers = new LayerManager();
  readonly messages = new Messages();
  readonly confirmations = new Confirmations();
  readonly layout: CalculatorLayout;
  readonly itemShop = new ItemShop();
  readonly slotColors = new SlotColorPreferences();
  readonly locale: LocalePreferences;
  readonly itemPicker: ItemPicker;
  private calculator?: CalculatorSession;
  /** Constructed by the entry before its React root mounts. */
  createCalculator(): CalculatorSession {
    return this.calculator ??= new CalculatorSession(new CalculatorData(this.data), this.messages, this.confirmations,
      this.itemShop, this.data.descriptions, this.slotColors, this.layout, this.customItems, this.locale.text, this.locale);
  }
  constructor(storage: StorageLike, boot: { manifest?: DataManifest; inFlight?: Partial<Record<DataKey, Promise<unknown>>> }) {
    this.data = new DataClient(boot);
    this.layout = new CalculatorLayout(storage);
    this.locale = new LocalePreferences(storage);
    this.itemPicker = new ItemPicker(this.layout.previews);
    this.customItems = new CustomItems(storage);
    this.preferences = new CalcStorage(storage);
    this.savedSimulations = new SavedSimulationStore(storage);
  }
  dispose(): void { this.calculator?.dispose(); this.itemPicker.close(); this.slotColors.picker.close(); this.confirmations.dispose(); this.messages.dispose(); this.locale.dispose(); this.layers.dispose(); }
}
const ServicesContext = createContext<ApplicationServices | null>(null);
export function ServicesProvider({ services, children }: { services: ApplicationServices; children: ReactNode }) {
  return <ServicesContext.Provider value={services}><LocaleProvider locale={services.locale}>
    <LayersProvider manager={services.layers}>{children}</LayersProvider>
  </LocaleProvider></ServicesContext.Provider>;
}
export function useServices(): ApplicationServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('Application views require a ServicesProvider');
  return services;
}

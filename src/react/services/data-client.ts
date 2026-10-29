import { DataKey, DataManifest, manifestPath } from '../../app/core/data-manifest';
import { Locale } from '../../app/core/i18n';
import { Store } from '../state/store';
import { setSkillDescriptions } from '../../app/skills';

export class DescriptionStore extends Store<number> {
  private descriptions: Record<string, string> = {};
  constructor() { super(0); }
  get version(): number { return this.getSnapshot(); }
  get(id: number | string | undefined): string | undefined { return id == null ? undefined : this.descriptions[id]; }
  setDescriptions(descriptions: Record<string, string>): void {
    const custom = Object.fromEntries(Object.entries(this.descriptions).filter(([id]) => Number(id) >= 1_000_000_000_000));
    this.descriptions = { ...descriptions, ...custom };
    this.set(this.getSnapshot() + 1);
  }
  upsert(id: number, description: string): void {
    this.descriptions[id] = description;
    this.set(this.getSnapshot() + 1);
  }
}

/**
 * The item text that is not Portuguese, per language.
 *
 * Portuguese is deliberately absent: its names are already in items-core and its
 * descriptions in items-desc, so it is the one language that costs no extra request.
 */
const LOCALE_ITEM_TEXT: Partial<Record<Locale, { names: DataKey; desc: DataKey }>> = {
  es: { names: 'itemNamesEs', desc: 'itemsDescEs' },
  en: { names: 'itemNamesEn', desc: 'itemsDescEn' },
};

interface BootData {
  manifest?: DataManifest;
  inFlight?: Partial<Record<DataKey, Promise<unknown>>>;
}

/** One promise per artifact, including promises started by the production HTML. */
export class DataClient {
  private manifest?: Promise<DataManifest>;
  private descriptionsLoad?: Promise<void>;
  /** Which language `descriptionsLoad` is for, so a switch starts a new one. */
  private descriptionsLocale?: Locale;
  private skillDescriptionsLoad?: Promise<void>;
  private readonly pending = new Map<DataKey, Promise<unknown>>();
  constructor(
    private readonly boot: BootData,
    readonly descriptions = new DescriptionStore(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private async json<T>(url: string): Promise<T> {
    const response = await this.fetcher.call(globalThis, url);
    if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
  private getManifest(): Promise<DataManifest> {
    if (!this.manifest) {
      const pending = this.boot.manifest ? Promise.resolve(this.boot.manifest) : this.json<DataManifest>('assets/data-manifest.json');
      this.manifest = pending;
      void pending.catch(() => { if (this.manifest === pending) this.manifest = undefined; });
    }
    return this.manifest;
  }
  load<T>(key: DataKey): Promise<T> {
    if (!this.pending.has(key)) {
      const load = this.boot.inFlight?.[key] ?? this.getManifest().then(manifest => this.json(manifestPath(manifest, key)));
      this.pending.set(key, load);
      void load.catch(() => { if (this.pending.get(key) === load) this.pending.delete(key); });
    }
    return this.pending.get(key) as Promise<T>;
  }
  /**
   * Descriptions wait for core items before consuming bandwidth.
   *
   * Memoised per language rather than once: a reader who switches needs the other
   * file, and one who switches back needs the store repopulated even though the fetch
   * itself is still cached by `load`. The guard before publishing is what keeps a
   * slow response for a language that was since abandoned from overwriting the one
   * now on screen.
   */
  loadDescriptions(locale: Locale): Promise<void> {
    if (this.descriptionsLocale === locale && this.descriptionsLoad) return this.descriptionsLoad;
    const key = LOCALE_ITEM_TEXT[locale]?.desc ?? 'itemsDesc';
    const pending = this.load('itemsCore').then(() => this.load<Record<string, string>>(key))
      .then(descriptions => { if (this.descriptionsLocale === locale) this.descriptions.setDescriptions(descriptions); });
    this.descriptionsLocale = locale;
    this.descriptionsLoad = pending;
    void pending.catch(() => {
      if (this.descriptionsLoad === pending) { this.descriptionsLoad = undefined; this.descriptionsLocale = undefined; }
    });
    return pending;
  }

  /**
   * The item names for `locale`, keyed like items-core, or nothing for Portuguese.
   *
   * An empty map is the honest answer for Portuguese and for any name the client spells
   * the same in both languages: the caller lays this over items-core, so a key that is
   * not here means the name already in items-core was right.
   */
  loadItemNames(locale: Locale): Promise<Record<string, string>> {
    const key = LOCALE_ITEM_TEXT[locale]?.names;
    return key ? this.load<Record<string, string>>(key) : Promise.resolve({});
  }
  loadSkillDescriptions(): Promise<void> {
    if (!this.skillDescriptionsLoad) {
      const pending = this.load<Record<number, string>>('skillDescriptions').then(descriptions => {
        setSkillDescriptions(descriptions);
        // The existing description subscription also refreshes skill tooltips and details.
        this.descriptions.set(this.descriptions.getSnapshot() + 1);
      });
      this.skillDescriptionsLoad = pending;
      void pending.catch(() => { if (this.skillDescriptionsLoad === pending) this.skillDescriptionsLoad = undefined; });
    }
    return this.skillDescriptionsLoad;
  }
}

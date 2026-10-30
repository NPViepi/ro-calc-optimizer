import { beforeEach, describe, expect, it } from 'vitest';
import { Locale } from '../../app/core/i18n';
import { ptBR } from '../../app/i18n/pt-br';
import { LocaleEnvironment, LocalePreferences } from './locale';

class FakeStorage {
  readonly entries = new Map<string, string>();
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
}

function fakeEnvironment(): LocaleEnvironment & { documentLanguage?: Locale } {
  return {
    documentLanguage: undefined,
    setDocumentLanguage(locale) { this.documentLanguage = locale; },
  };
}

describe('LocalePreferences', () => {
  let storage: FakeStorage;
  beforeEach(() => { storage = new FakeStorage(); });

  it('opens in Portuguese when nothing was chosen yet', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    expect(preferences.locale).toBe('pt-BR');
    expect(storage.getItem('ro-locale')).toBeNull();
  });

  it('reopens on the stored choice', async () => {
    storage.setItem('ro-locale', 'en');
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    expect(preferences.locale).toBe('en');
  });

  it('ignores a stored value that is not a shipped locale', async () => {
    storage.setItem('ro-locale', 'klingon');
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    expect(preferences.locale).toBe('pt-BR');
  });

  it('renders Portuguese before a translated catalog arrives, never raw keys', () => {
    storage.setItem('ro-locale', 'es');
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    expect(preferences.getSnapshot().catalog['itemSearch.title']).toBe(ptBR['itemSearch.title']);
  });

  it('publishes locale and catalog together, so no render sees one without the other', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    const seen: { locale: Locale; title: string | undefined }[] = [];
    preferences.subscribe(() => {
      const state = preferences.getSnapshot();
      seen.push({ locale: state.locale, title: state.catalog['itemSearch.title'] });
    });
    await preferences.select('es');
    expect(seen).toEqual([{ locale: 'es', title: 'Buscar objetos' }]);
  });

  it('remembers the choice and announces it on the document', async () => {
    const environment = fakeEnvironment();
    const preferences = new LocalePreferences(storage, environment);
    await preferences.ready;
    await preferences.select('en');
    expect(storage.getItem('ro-locale')).toBe('en');
    expect(environment.documentLanguage).toBe('en');
    expect(preferences.getSnapshot().catalog['itemSearch.title']).toBe('Search items');
  });

  it('republishes nothing when the chosen locale is already active', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    let published = 0;
    preferences.subscribe(() => { published += 1; });
    await preferences.select('pt-BR');
    expect(published).toBe(0);
  });

  it('records a choice of the language already on screen', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    await preferences.select('pt-BR');
    expect(storage.getItem('ro-locale')).toBe('pt-BR');
  });

  describe('chosen', () => {
    it('is false on a first visit', () => {
      expect(new LocalePreferences(storage, fakeEnvironment()).chosen).toBe(false);
    });

    it('separates a deliberate Portuguese from the default one', async () => {
      const preferences = new LocalePreferences(storage, fakeEnvironment());
      await preferences.ready;
      expect(preferences.locale).toBe('pt-BR');
      expect(preferences.chosen).toBe(false);
      await preferences.select('pt-BR');
      expect(preferences.locale).toBe('pt-BR');
      expect(preferences.chosen).toBe(true);
    });

    it('stays false for a stored value that is not a shipped locale', () => {
      storage.setItem('ro-locale', 'klingon');
      expect(new LocalePreferences(storage, fakeEnvironment()).chosen).toBe(false);
    });

    it('is true on a later visit', async () => {
      storage.setItem('ro-locale', 'es');
      const preferences = new LocalePreferences(storage, fakeEnvironment());
      await preferences.ready;
      expect(preferences.chosen).toBe(true);
    });
  });

  it('lets the last selection win when two are made in a row', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    await Promise.all([preferences.select('es'), preferences.select('en')]);
    expect(preferences.locale).toBe('en');
    expect(preferences.getSnapshot().catalog['itemSearch.title']).toBe('Search items');
  });

  it('publishes nothing after dispose', async () => {
    const preferences = new LocalePreferences(storage, fakeEnvironment());
    await preferences.ready;
    preferences.dispose();
    await preferences.select('es');
    expect(preferences.locale).toBe('pt-BR');
  });
});

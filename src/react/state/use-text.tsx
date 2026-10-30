import { Fragment, ReactNode, createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { Locale, TextParams, textRuns, translate } from '../../app/core/i18n';
import { TextKey } from '../../app/i18n';
import { LocalePreferences } from '../services/locale';

/** Translates a key into the language the reader chose. Keys are typed by `pt-br.ts`. */
export type Text = (key: TextKey, params?: TextParams) => string;

/** Same lookup, with the `*emphasis*` in the entry rendered as `<b>`. */
export type RichText = (key: TextKey, params?: TextParams) => ReactNode;

interface LocaleContextValue {
  locale: Locale;
  t: Text;
  rich: RichText;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Subscribes to the chosen language once, here, and hands the whole tree one `t`.
 *
 * Deliberately not read off `useServices`, even though `services.locale` is reachable
 * there: a hook that subscribed per component would register a listener and build a
 * closure for every `Select`, `Table` and `Dialog` on screen, and give each a `t` of
 * its own identity — so no two consumers could share a memo keyed on it.
 */
export function LocaleProvider({ locale, children }: { locale: LocalePreferences; children: ReactNode }) {
  const state = useSyncExternalStore(locale.subscribe, locale.getSnapshot);
  const value = useMemo<LocaleContextValue>(() => {
    const t: Text = (key, params) => translate(state.catalog, key, params);
    return {
      locale: state.locale,
      t,
      rich: (key, params) => textRuns(t(key, params)).map((run, index) =>
        run.emphasis
          ? <b key={index}>{run.text}</b>
          : run.code
            ? <code key={index}>{run.text}</code>
            : <Fragment key={index}>{run.text}</Fragment>),
    };
  }, [state]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const value = useContext(LocaleContext);
  // Loud on purpose, like `useServices`. A subtree mounted outside the provider would
  // otherwise render Portuguese to a Spanish reader and look like a missing
  // translation rather than the wiring bug it is.
  if (!value) throw new Error('Views that read text require a LocaleProvider');
  return value;
}

/** The chosen language, for the selector and for locale-aware formatting. */
export function useLocale(): Locale {
  return useLocaleContext().locale;
}

export function useText(): Text {
  return useLocaleContext().t;
}

/**
 * For the sentences that carry bold in the middle of a clause. Same catalog, same
 * keys — `textRuns` is what turns the `*…*` in the entry back into `<b>` and the
 * `` `…` `` into `<code>`.
 */
export function useRichText(): RichText {
  return useLocaleContext().rich;
}

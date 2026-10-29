/**
 * The i18n primitive: a locale, a catalog, and a lookup.
 *
 * Framework-free like the rest of `core` — the catalogs and the React layer both read
 * it, and `check-source.mjs` forbids a framework import here. Hand-written rather than
 * a dependency because the app needs two things: key lookup and `{name}` interpolation.
 * A library would add a loader, ICU plurals and a locale detector that nothing here
 * would call.
 */

/** Every locale the UI ships. pt-BR is first because it is the source. */
export const LOCALES = ['pt-BR', 'es', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * What each language calls itself, never translated.
 *
 * Deliberately not catalog keys: someone who opens the simulator in a language they
 * don't read has to find their own in the list, so the name must not follow the
 * language currently on screen. Keeping them here also means the three catalogs
 * cannot drift into "fixing" `Español` into `Spanish`.
 */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Português', es: 'Español', en: 'English',
};

/**
 * "Choose your language", in each of them.
 *
 * The first-run dialog has to ask before it knows what the reader reads, so the
 * question is printed three times instead of translated once. It lives beside
 * {@link LOCALE_NAMES} for the same reason those do: a catalog entry would follow the
 * language currently on screen, which is the one thing the reader has not chosen yet.
 */
export const LOCALE_PROMPTS: Readonly<Record<Locale, string>> = {
  'pt-BR': 'Escolha seu idioma', es: 'Elige tu idioma', en: 'Choose your language',
};

/**
 * The source locale, and what the app opens in until someone picks otherwise.
 *
 * Its catalog is the one every key is written in first, it is bundled with the app
 * rather than loaded, and `loadCatalog` lays every translation over it — so a key a
 * translation has not reached yet shows up in Portuguese instead of as a key.
 *
 * The app deliberately does NOT read `navigator.language` yet. While most of the
 * interface is still only in Portuguese, opening in English for an English browser
 * reads as a broken translation rather than an absent one. Detection belongs in the
 * PR that finishes the interface, not before it.
 */
export const DEFAULT_LOCALE: Locale = 'pt-BR';

/**
 * A key→text map. Values are optional because a translated catalog is allowed to be
 * incomplete; `loadCatalog` is what turns a gap back into the pt-BR text.
 */
export type Catalog = Readonly<Record<string, string | undefined>>;

/** Interpolation values for the `{name}` placeholders in a catalog entry. */
export type TextParams = Readonly<Record<string, string | number>>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Fills `{name}` placeholders. An unknown name is left as written rather than
 * replaced with `undefined`: a caller that forgot a parameter should show a visible
 * `{level}` in the UI, not silently print the word "undefined" to a user.
 *
 * Exported because a few components take a template as a prop instead of a key
 * (`Table`'s `currentPageReportTemplate`), and those have to fill it the same way.
 */
export function fill(template: string, params: TextParams): string {
  return template.replace(PLACEHOLDER, (placeholder, name) => {
    const value = params[name];
    return value == null ? placeholder : String(value);
  });
}

/**
 * Looks `key` up in `catalog` and interpolates `params`.
 *
 * Returns the key itself when the catalog has not got it. That is deliberately ugly
 * and deliberately not a throw: a missing key is a text bug, and taking the page down
 * over one would be worse than showing it. The typed `TextKey` in `src/app/i18n`
 * keeps it from happening in the first place, and `loadCatalog` guarantees every
 * catalog carries the full pt-BR key set underneath.
 */
export function translate(catalog: Catalog, key: string, params?: TextParams): string {
  const template = catalog[key];
  if (template == null) return key;
  return params ? fill(template, params) : template;
}

/** A stretch of a sentence, and whether the catalog asked for it to stand out. */
export interface TextRun {
  readonly text: string;
  readonly emphasis: boolean;
  /** Set only on a run the catalog marked as code, so a plain run stays two fields. */
  readonly code?: boolean;
}

const MARKUP = /\*([^*]+)\*|`([^`]+)`/g;

/**
 * Splits a catalog entry on the `*emphasis*` written into it.
 *
 * Several sentences in this interface put a word or a number in bold in the middle of
 * a clause. Shipping them as "text before", `<b>`, "text after" would hand each
 * translation three fragments and no way to reorder them — and Spanish and English do
 * reorder them. So the whole sentence stays one catalog entry, with the emphasis
 * marked inside it, and the view rebuilds the markup from these runs.
 *
 * A lone `*` has no pair and is left alone, which is why `*** ATK da mão esquerda` is
 * still printed as written.
 *
 * Backticks mark a code run the same way, for the script documentation in the custom
 * item studio: its sentences name JSON keys and literal values in the middle of a
 * clause, and those keep the monospace run instead of becoming separate entries.
 */
export function textRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let index = 0;
  for (const match of text.matchAll(MARKUP)) {
    if (match.index > index) runs.push({ text: text.slice(index, match.index), emphasis: false });
    runs.push(match[1] == null
      ? { text: match[2], emphasis: false, code: true }
      : { text: match[1], emphasis: true });
    index = match.index + match[0].length;
  }
  if (index < text.length) runs.push({ text: text.slice(index), emphasis: false });
  return runs;
}

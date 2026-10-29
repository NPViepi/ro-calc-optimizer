import { DEFAULT_LOCALE, Locale } from '../app/core/i18n';

/**
 * One published release, as `history.json` stores it.
 *
 * `logs` is pt-BR, the language the notes are written in. `logs_es` and `logs_en` are
 * its translations, one line each; they are optional because releases published
 * before the notes became trilingual have only Portuguese. `release-notes.mjs`
 * requires all three of every new fragment, so the gap cannot grow.
 */
export interface ReleaseEntry {
  v: string;
  date: string;
  logs: string[];
  logs_es?: string[];
  logs_en?: string[];
}

/**
 * The notes to show a reader of `locale`.
 *
 * Falls back to Portuguese entry by entry, the same deal the text catalogs make: an
 * old release nobody translated reads in pt-BR rather than vanishing from the list.
 */
export function entryLogs(entry: ReleaseEntry, locale: Locale): readonly string[] {
  if (locale === DEFAULT_LOCALE) return entry.logs;
  return (locale === 'es' ? entry.logs_es : entry.logs_en) ?? entry.logs;
}

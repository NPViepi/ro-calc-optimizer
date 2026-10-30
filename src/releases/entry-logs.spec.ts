import { describe, expect, it } from 'vitest';
import { ReleaseEntry, entryLogs } from './entry-logs';

const translated: ReleaseEntry = {
  v: '0.1.188-beta', date: '28-10-2026',
  logs: ['Adicionado o seletor de idioma.'],
  logs_es: ['Agregado el selector de idioma.'],
  logs_en: ['Added the language selector.'],
};

/** A release from before the notes became trilingual. */
const portugueseOnly: ReleaseEntry = {
  v: '0.1.100-beta', date: '01-01-2026',
  logs: ['Corrigido o cálculo de ASPD.'],
};

describe('entryLogs', () => {
  it('gives each language its own notes', () => {
    expect(entryLogs(translated, 'pt-BR')).toEqual(['Adicionado o seletor de idioma.']);
    expect(entryLogs(translated, 'es')).toEqual(['Agregado el selector de idioma.']);
    expect(entryLogs(translated, 'en')).toEqual(['Added the language selector.']);
  });

  it('falls back to Portuguese for a release published before the translations', () => {
    expect(entryLogs(portugueseOnly, 'es')).toEqual(['Corrigido o cálculo de ASPD.']);
    expect(entryLogs(portugueseOnly, 'en')).toEqual(['Corrigido o cálculo de ASPD.']);
  });

  it('falls back per entry, so one translated release does not hide an older one', () => {
    const shown = [translated, portugueseOnly].map(entry => entryLogs(entry, 'en'));
    expect(shown).toEqual([['Added the language selector.'], ['Corrigido o cálculo de ASPD.']]);
  });
});

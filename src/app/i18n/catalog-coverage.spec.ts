import { describe, expect, it } from 'vitest';
import { LOCALES } from '../core/i18n';
import { TranslatedCatalog, loadCatalog } from '.';
import { catalog as es } from './es';
import { catalog as en } from './en';
import { ptBR } from './pt-br';

/**
 * `TranslatedCatalog` is `Partial` so a key added mid-PR falls back to Portuguese
 * instead of breaking the page. This spec is the other half of that deal: a key is
 * allowed to be missing at runtime, not allowed to ship missing. Add a key to
 * `pt-br.ts` and these fail until `es.ts` and `en.ts` carry it too.
 *
 * The catalogs are imported directly rather than through `loadCatalog`, which lays
 * every translation over pt-BR — going through it would make each assertion below
 * pass by construction.
 *
 * It deliberately does not assert that a translation *differs* from the source:
 * Resultados, Equipar, Carta de Arma and Pet are each the right word in more than
 * one of these languages, so that check is a list of exceptions, not a defect test.
 */
const sourceKeys = Object.keys(ptBR);
const translated: [string, TranslatedCatalog][] = [['es', es], ['en', en]];
const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

describe('translated catalogs', () => {
  it('ships a catalog for every locale but the source one', () => {
    expect(LOCALES.filter(locale => locale !== 'pt-BR')).toEqual(translated.map(([locale]) => locale));
  });

  it.each(translated)('%s covers every key pt-BR defines', (_locale, catalog) => {
    expect(sourceKeys.filter(key => catalog[key] == null)).toEqual([]);
  });

  it.each(translated)('%s defines nothing pt-BR does not', (_locale, catalog) => {
    expect(Object.keys(catalog).filter(key => !(key in ptBR))).toEqual([]);
  });

  // A translation that drops `{n}` ships a sentence missing its number, which no
  // coverage check would notice: the key is there and the text reads fine.
  it.each(translated)('%s keeps the placeholders of every entry it translates', (_locale, catalog) => {
    const dropped = sourceKeys.filter(key =>
      catalog[key] != null && String(placeholders(ptBR[key])) !== String(placeholders(catalog[key])));
    expect(dropped).toEqual([]);
  });
});

describe('loadCatalog', () => {
  it('lays a translation over pt-BR, so a gap resolves to Portuguese and not to a key', async () => {
    const catalog = await loadCatalog('es');
    expect(Object.keys(ptBR).filter(key => catalog[key] == null)).toEqual([]);
    expect(catalog['itemSearch.title']).toBe(es['itemSearch.title']);
  });

  it('hands back the bundled catalog for the source locale', async () => {
    expect(await loadCatalog('pt-BR')).toBe(ptBR);
  });
});

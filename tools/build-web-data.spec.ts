/**
 * Trava as invariantes dos artefatos derivados por tools/build-web-data.mjs.
 *
 * O gerador é um .mjs sem dependências, então ele reimplementa a regra do
 * canGradeItem em vez de importar o TypeScript. Estas specs são o que mantém as
 * duas cópias em sincronia — e, mais importante, o que impede que uma poda de
 * campo silenciosamente quebre o casamento por nome dos conjuntos ou os
 * dropdowns de encantamento.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ItemTypeId } from 'src/app/constants/item.const';
import { canGradeItem as canGradeItemTs } from 'src/app/utils/can-grade';
import { buildItems, buildLocaleText, canGradeItem, latamEntry } from './build-web-data.mjs';

const DATA_DIR = join(process.cwd(), 'src/assets/demo/data');
const readJson = (file: string) => JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));

const rawItems: Record<string, any> = readJson('item.json');
const latam: Record<string, any> = readJson('latam-items.json');
const latamEn: Record<string, any> = readJson('latam-items-en.json');
const { core, desc } = buildItems(rawItems, latam, {});
const en = buildLocaleText(rawItems, latam, latamEn);

const keys = Object.keys(rawItems);

describe('build-web-data: items-core', () => {
  it('mantém todos os registros do item.json', () => {
    expect(Object.keys(core)).toHaveLength(keys.length);
    expect(Object.keys(core).sort()).toEqual(keys.sort());
  });

  it('reproduz o canGradeItem do TypeScript para todo item', () => {
    const divergentes = keys.filter((k) => !!core[k].canGrade !== canGradeItemTs(rawItems[k]));
    expect(divergentes).toEqual([]);
  });

  it('a regra local do gerador é a mesma do src/app/utils/can-grade.ts', () => {
    const divergentes = keys.filter((k) => canGradeItem(rawItems[k]) !== canGradeItemTs(rawItems[k]));
    expect(divergentes).toEqual([]);
  });

  it('marca presentInLatam pelo conjunto de chaves do LATAM', () => {
    const divergentes = keys.filter(
      (k) => !!core[k].presentInLatam !== (!!latamEntry(latam, k, rawItems[k]) || !!rawItems[k].preRelease),
    );
    expect(divergentes).toEqual([]);
  });

  it('lets preRelease force presentInLatam on for items LATAM has not shipped', () => {
    // The only hand-authored source of presentInLatam. Without it these records stay
    // out of every dropdown, since the flag is otherwise derived from latam-items.json
    // — which is regenerated from ragassets and cannot be hand-edited.
    const preRelease = keys.filter((k) => rawItems[k].preRelease);
    expect(preRelease.length).toBeGreaterThan(0);
    expect(preRelease.every((k) => core[k].presentInLatam === true)).toBe(true);
    expect(preRelease.every((k) => core[k].preRelease === true)).toBe(true);
  });

  it('preserva o nome em inglês em enName — os scripts de conjunto casam por ele', () => {
    // calculator.ts casa EQUIP[...] / POS_SPECIFIC[...] / REFINE_NAME[...] com
    // `enName ?? name`. Se essa identidade quebrar, combos param de disparar em
    // silêncio, sem erro em lugar nenhum.
    const divergentes = keys.filter((k) => (core[k].enName ?? core[k].name) !== rawItems[k].name);
    expect(divergentes).toEqual([]);
  });

  it('usa o nome pt-BR quando o item existe no LATAM', () => {
    const comNomePt = keys.filter((k) => {
      const pt = latamEntry(latam, k, rawItems[k]);
      return pt?.name && pt.name !== rawItems[k].name;
    });
    expect(comNomePt.length).toBeGreaterThan(3000);
    expect(comNomePt.every((k) => core[k].name === latamEntry(latam, k, rawItems[k]).name)).toBe(true);
  });

  it('resolve o overlay LATAM pelas chaves-alias do item 4807', () => {
    // item.json tem 9.555 chaves para 9.553 ids: o encantamento de ASPD+1 é
    // listado três vezes para aparecer em vários pickers de encante de traje.
    for (const alias of ['4807', '48079999', '480799999']) {
      expect(rawItems[alias].id).toBe(4807);
      expect(core[alias].presentInLatam).toBe(true);
    }
  });

  it('não perde nenhum encantamento', () => {
    // mapEnchant filtra itemTypeId === ENCHANT sem olhar presentInLatam, então
    // podar registros fora do LATAM esvaziaria dropdowns de equipamento comum.
    const encantes = keys.filter((k) => rawItems[k].itemTypeId === ItemTypeId.ENCHANT);
    expect(encantes.length).toBeGreaterThan(2000);
    expect(encantes.every((k) => core[k].itemTypeId === ItemTypeId.ENCHANT)).toBe(true);
  });

  it('preserva script intacto — as chaves são indexadas dinamicamente', () => {
    const comScript = keys.filter((k) => rawItems[k].script);
    expect(comScript.length).toBeGreaterThan(7000);
    const divergentes = comScript.filter((k) => JSON.stringify(core[k].script) !== JSON.stringify(rawItems[k].script));
    expect(divergentes).toEqual([]);
  });

  it('remove só os campos que o browser não lê', () => {
    for (const field of ['description', 'unidName', 'resName']) {
      expect(keys.some((k) => field in core[k])).toBe(false);
    }
  });

  it('preserva todos os demais campos do registro original', () => {
    const removidos = new Set(['description', 'unidName', 'resName', 'canGrade', 'presentInLatam', 'name']);
    const divergentes: string[] = [];
    for (const k of keys) {
      for (const [field, value] of Object.entries(rawItems[k])) {
        if (removidos.has(field)) continue;
        if (JSON.stringify(core[k][field]) !== JSON.stringify(value)) divergentes.push(`${k}.${field}`);
      }
    }
    expect(divergentes).toEqual([]);
  });
});

describe('build-web-data: items-desc', () => {
  it('cobre exatamente os itens do LATAM que têm descrição, mais os pré-lançamento', () => {
    const esperado = keys.filter((k) => latamEntry(latam, k, rawItems[k])?.description || rawItems[k].preRelease);
    expect(Object.keys(desc).sort()).toEqual(esperado.sort());
  });

  it('traz a descrição pt-BR, não a do item.json', () => {
    const doLatam = Object.keys(desc).filter((k) => latamEntry(latam, k, rawItems[k])?.description);
    const amostra = doLatam.slice(0, 500);
    expect(amostra.every((k) => desc[k] === latamEntry(latam, k, rawItems[k]).description)).toBe(true);
  });

  it('ships the iRO English description for preRelease items, without --all-desc', () => {
    // There is no pt-BR text for them yet, so item.json's own description is the only
    // one there is and it must not wait for the --all-desc opt-in.
    const preRelease = keys.filter((k) => rawItems[k].preRelease);
    expect(preRelease.every((k) => desc[k] === rawItems[k].description)).toBe(true);
  });

  it('still withholds the description of ordinary non-LATAM items', () => {
    const forasteiros = keys.filter((k) => !latamEntry(latam, k, rawItems[k]) && !rawItems[k].preRelease);
    expect(forasteiros.length).toBeGreaterThan(100);
    expect(forasteiros.some((k) => k in desc)).toBe(false);
  });
});

describe('build-web-data: items-name-<locale> / items-desc-<locale>', () => {
  it('never widens the item universe past what items-core offers', () => {
    const outsiders = Object.keys(en.names)
      .filter((k) => !latamEntry(latam, k, rawItems[k]) && !rawItems[k].preRelease);
    expect(outsiders).toEqual([]);
  });

  it('is keyed exactly like items-core, so the overlay lays straight over it', () => {
    expect(Object.keys(en.names).filter((k) => core[k] === undefined)).toEqual([]);
    expect(Object.keys(en.desc).filter((k) => core[k] === undefined)).toEqual([]);
  });

  it('leaves out every name the client spells the way items-core already does', () => {
    expect(Object.keys(en.names).filter((k) => en.names[k] === core[k].name)).toEqual([]);
  });

  it('carries the client English name, not the Portuguese one', () => {
    const sample = Object.keys(en.names).slice(0, 500);
    const wrong = sample.filter((k) => en.names[k] !== (latamEn[rawItems[k].id] ?? latamEn[k]).name);
    expect(wrong).toEqual([]);
  });

  it('translates the bulk of the catalogue rather than a handful of rows', () => {
    // A near-empty overlay would mean the source table or the key rule broke, and an
    // English reader would quietly go on reading Portuguese.
    expect(Object.keys(en.names).length).toBeGreaterThan(5_000);
  });

  it('describes every item items-desc describes', () => {
    // It is fetched INSTEAD of items-desc, so a key missing here is an item whose
    // tooltip comes up empty — worse than one that comes up in Portuguese.
    expect(Object.keys(desc).filter((k) => !en.desc[k])).toEqual([]);
  });

  it('falls back to the text items-desc shows when the client has none', () => {
    // The pre-release items have no client row in any language: their English
    // description from item.json is the only one there is.
    const preRelease = Object.keys(desc).filter((k) => rawItems[k].preRelease);
    expect(preRelease.length).toBeGreaterThan(100);
    expect(preRelease.filter((k) => en.desc[k] !== rawItems[k].description)).toEqual([]);
  });
});

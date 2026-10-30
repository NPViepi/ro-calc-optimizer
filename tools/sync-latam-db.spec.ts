/**
 * Trava os três transforms que reconstroem os arquivos derivados do cliente a
 * partir das tabelas /raw do ragassets (tools/sync-latam-db.mjs).
 *
 * Aqui não há rede: as entradas são fatias reais de `items.json` e `jobs.json`
 * congeladas em `__fixtures__/`, escolhidas para cobrir cada regra que a
 * migração precisou preservar exatamente — as duas gerações do arquivo têm de
 * sair byte a byte iguais, então cada detalhe abaixo é uma decisão, não um
 * acaso.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildItemViews, buildLatamClasses, buildLatamItems, buildLocaleItems, SLOT_BIT } from './sync-latam-db.mjs';

const FIXTURES = join(process.cwd(), 'tools/__fixtures__');
const readFixture = (file: string) => JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'));

const rawItems = readFixture('raw-items.json');
const rawJobs = readFixture('raw-jobs.json');

const latamItems = buildLatamItems(rawItems);
const itemViews = buildItemViews(rawItems);

describe('sync-latam-db: latam-items.json', () => {
  it('ignora os itens sem nome — a chave é o sinal de "existe no LATAM"', () => {
    // 1174 tem sprite (view 49) mas nenhum nome de exibição; RoService usa a
    // presença da chave para marcar `presentInLatam`, então incluí-lo faria o
    // simulador anunciar como jogável um item que o cliente não sabe nomear.
    expect(rawItems.find((it: any) => it.id === 1174).name).toBeNull();
    expect(latamItems[1174]).toBeUndefined();
    expect(Object.keys(latamItems)).toHaveLength(rawItems.filter((it: any) => it.name).length);
  });

  it('cai no resourceName quando não há aegisName', () => {
    // O aegisName real só existe para os itens que o itemmoveinfov5.txt cobre;
    // para o resto sobra o nome do recurso do cliente (em coreano, mesmo).
    expect(latamItems[1292].aegisName).toBe('Upg_Katar'); // aegisName do item_db
    expect(latamItems[501].aegisName).toBe('빨간포션'); // fallback
  });

  it('omite slots quando é 0 e mantém quando é maior', () => {
    expect('slots' in latamItems[501]).toBe(false);
    expect(latamItems[1101].slots).toBe(3);
    expect(latamItems[2225].slots).toBe(1);
  });

  it('omite description vazia', () => {
    expect('description' in latamItems[583]).toBe(false);
    expect(latamItems[501].description).toBe(rawItems.find((it: any) => it.id === 501).description);
  });

});

describe('sync-latam-db: item-views.json', () => {
  it('mantém os itens sem nome que o latam-items descarta', () => {
    // A paper-doll desenha por id: não ter nome de exibição não diz nada sobre
    // o sprite existir. É por isso que os dois arquivos não têm o mesmo escopo.
    expect(itemViews[1174]).toEqual([49, 0]);
    expect(latamItems[1174]).toBeUndefined();
  });

  it('ignora os itens sem sprite', () => {
    expect(itemViews[501]).toBeUndefined(); // view 0
    expect(Object.keys(itemViews)).toHaveLength(rawItems.filter((it: any) => it.view > 0).length);
  });

  it('soma as posições visuais na máscara de bits', () => {
    expect(SLOT_BIT).toEqual({ top: 1, mid: 2, low: 4, garment: 8 });
    expect(itemViews[1101]).toEqual([2, 0]); // arma: sprite, nenhuma posição de cabeça
    expect(itemViews[2218]).toEqual([8, SLOT_BIT.low]);
    expect(itemViews[2224]).toEqual([1, SLOT_BIT.top | SLOT_BIT.mid]);
    expect(itemViews[2264]).toEqual([51, SLOT_BIT.top | SLOT_BIT.mid | SLOT_BIT.low]);
    expect(itemViews[20502]).toEqual([12, SLOT_BIT.garment]);
  });
});

describe('sync-latam-db: latam-classes.json', () => {
  it('fica só com as classes que têm ícone no cliente', () => {
    // Sem ícone = classe não lançada no LATAM; a UI esconde essas.
    expect(buildLatamClasses(rawJobs)).toEqual([0, 4308]);
    expect(rawJobs.find((j: any) => j.id === 22).hasIcon).toBe(false);
  });
});

describe('sync-latam-db: contrato das tabelas /raw', () => {
  it('chegam ordenadas por id — nenhum transform reordena', () => {
    // Os três arquivos gerados herdam esta ordem, e são conferidos por diff a
    // cada atualização de cliente: se a fonte parar de vir ordenada, uma
    // mudança de dez itens vira um diff de catorze mil.
    for (const table of [rawItems, rawJobs]) {
      const ids = table.map((row: any) => row.id);
      expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
    }
  });
});

describe('sync-latam-db: latam-items-<locale>.json', () => {
  const localeItems = buildLocaleItems(rawItems);

  it('keeps the same rows the Portuguese table keeps', () => {
    // Both run the "no name, no row" rule, which is what lets build-web-data pair them
    // up by key without deciding all over again which items exist on LATAM.
    expect(Object.keys(localeItems)).toEqual(Object.keys(latamItems));
  });

  it('carries the text and nothing else', () => {
    // Slots and the aegis name are not language. Repeating them would add megabytes to
    // the repository and give a client update two places to disagree with itself.
    for (const entry of Object.values(localeItems) as any[]) {
      expect(Object.keys(entry).sort()).toEqual(
        entry.description === undefined ? ['name'] : ['description', 'name'],
      );
    }
  });

  it('omits the description rather than writing an empty one', () => {
    const noDescription = rawItems.filter((it: any) => it.name && !it.description);
    expect(noDescription.length).toBeGreaterThan(0);
    for (const it of noDescription) expect(localeItems[it.id]).not.toHaveProperty('description');
  });

  it('inherits the id order of the /raw table, like the others', () => {
    // These files are reviewed by diff after every client update; a reordering would
    // bury the real changes under fourteen thousand fake ones.
    const ids = rawItems.filter((it: any) => it.name).map((it: any) => String(it.id));
    expect(Object.keys(localeItems)).toEqual(ids);
  });
});

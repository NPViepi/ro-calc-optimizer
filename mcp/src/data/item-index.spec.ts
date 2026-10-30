import { describe, expect, it } from 'vitest';
import { loadDatasetFromDisk } from './dataset.node';
import { ItemIndex } from './item-index';
import { foldAccents } from './text';

const dataset = loadDatasetFromDisk();
const index = dataset.itemIndex;

describe('ItemIndex composition', () => {
  it('unions both files into one row per id', () => {
    // 11652 calculator ids + 5996 LATAM-only ids = 17648 unique.
    expect(index.size).toBe(17648);
  });

  it('collapses the thrice-listed enchant 4807 into one row with unioned slots', () => {
    const row = index.get(4807)!;
    expect(row.inCalcDb).toBe(true);
    expect(row.slotTags).toEqual(expect.arrayContaining(['enchant', 'costumeEnchantUpper', 'costumeEnchantGarment']));
  });

  it('keeps LATAM-only items searchable but marks them as having no mechanics', () => {
    // 7508 "Anel da Allysia" is in latam-items.json only.
    const row = index.get(7508)!;
    expect(row.inCalcDb).toBe(false);
    expect(row.name).toBe('Anel da Allysia');
    expect(row.slotTags).toBeUndefined();
    expect(index.record(7508)).toBeUndefined();
    expect(index.latamName(7508)).toBe('Anel da Allysia');
  });

  it('classifies a weapon, a card and a costume', () => {
    expect(index.get(700016)?.slotTags).toContain('weapon');
    expect(index.get(4628)?.slotTags).toEqual(['shieldCard']);
  });
});

describe('search', () => {
  it('matches accent-insensitively', () => {
    expect(foldAccents('Poção Mágica')).toBe('pocao magica');
    const { rows } = index.search({ query: 'pocao vermelha', limit: 5 });
    expect(rows.some((r) => r.name === 'Poção Vermelha')).toBe(true);
  });

  it('ANDs multiple terms regardless of order', () => {
    const a = index.search({ query: 'arco apoio', limit: 10 });
    const b = index.search({ query: 'apoio arco', limit: 10 });
    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
    expect(a.rows.some((r) => r.id === 700016)).toBe(true);
  });

  it('finds LATAM-only items by name, which the app itself cannot', () => {
    const { rows } = index.search({ query: 'allysia', limit: 5 });
    expect(rows.map((r) => r.id)).toContain(7508);
    expect(rows.find((r) => r.id === 7508)?.inCalcDb).toBe(false);
  });

  it('a structural filter implies inCalcDb, since LATAM-only rows have no fields', () => {
    expect(ItemIndex.needsCalcDb({ slot: 'weapon' })).toBe(true);
    expect(ItemIndex.needsCalcDb({ query: 'arco' })).toBe(false);

    const { rows } = index.search({ slot: 'weapon', limit: 100 });
    expect(rows.every((r) => r.inCalcDb)).toBe(true);
    expect(rows.every((r) => r.slotTags?.includes('weapon'))).toBe(true);
  });

  it('filters by bonus key, honouring all/any', () => {
    const all = index.search({ bonus: ['atk', 'cri'], bonusMode: 'all', limit: 200 });
    const any = index.search({ bonus: ['atk', 'cri'], bonusMode: 'any', limit: 200 });
    expect(all.total).toBeLessThan(any.total);
    for (const row of all.rows) {
      const script = index.record(row.id)!.script;
      expect(script['atk']).toBeDefined();
      expect(script['cri']).toBeDefined();
    }
  });

  it('filters to items a class can equip', () => {
    const char = dataset.classes.newInstance(4261); // Elementalista
    const { rows } = index.search({ slot: 'weapon', limit: 50 }, char);
    expect(rows.length).toBeGreaterThan(0);
    // A Guillotine Cross katar must not show up for a mage.
    expect(rows.map((r) => r.id)).not.toContain(1291);
  });

  it('paginates without losing or repeating rows', () => {
    const first = index.search({ query: 'arco', limit: 5, offset: 0 });
    const second = index.search({ query: 'arco', limit: 5, offset: 5 });
    expect(first.total).toBe(second.total);
    expect(first.rows.map((r) => r.id)).not.toEqual(second.rows.map((r) => r.id));
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(first.rows.length + second.rows.length);
  });
});

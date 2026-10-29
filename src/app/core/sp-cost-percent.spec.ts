import { readFileSync } from 'node:fs';
import { createRawTotalBonus } from 'src/app/utils/create-raw-total-bonus';
import { ITEM_BONUS_LABELS } from './bonus-key-label';
import { ITEM_DB, wornBonus } from './__tests__/worn-bonus';

/**
 * `spCostPercent` — "Custo de SP das habilidades ±N%", swept across the item database.
 *
 * Display only, like the rest of the sustain family: the calculator models damage dealt
 * and has no SP pool to spend, so nothing reads it (healing-stats.spec.ts holds the line
 * with a damage-unchanged guard). It is the one key of that family that keeps the
 * CLIENT'S OWN SIGN, because the line runs both ways — 4148 Carta Faraó gives -30%, 4128
 * Carta Besouro-Ladrão Dourado gives +100%. Negating the store would make half the
 * records read backwards.
 *
 * The sweep below is the point of this file. 109 of the 111 records whose pt-BR description
 * carries the line now declare it; the other 2 are listed in NOT_ENCODED with the reason,
 * so the gap is a decision on the record rather than something that quietly rots.
 *
 * The eight whose clause is gated on a set's summed refine live in
 * sp-cost-combo-refine.spec.ts, which drives each of them through the engine.
 */

const latam: Record<string, any> = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8'));
const clean = (s: string) => (s ?? '').replace(/\^[0-9a-fA-F]{6}/g, '');
/** Whitespace-tolerant: 24112 writes "das habilidades  +40%" with two spaces. */
const LINE = /Custo de SP das habilidades\s+([+-])\s*(\d+)%/g;

const valuesIn = (description: string) =>
  [...clean(description).matchAll(LINE)].map((m) => Number(`${m[1]}${m[2]}`));

/** The value an entry yields once its conditions are stripped. */
const valueOf = (entry: string) =>
  entry.includes('===') ? Number(entry.split('===').pop())
  : entry.includes('---') ? Number(entry.split('---').pop())
  : Number(entry);

/**
 * Records that carry the line and deliberately do NOT declare the key. Each needs a
 * condition the grammar has no token for, or names a partner the calculator cannot equip.
 * Shrink this list, never grow it to silence a failure.
 */
const NOT_ENCODED: Record<number, string> = {
  2004: 'a linha está sob "Efeito:", um proc temporário (0,1% ao atacar magicamente)',
  460181: 'a linha está no bloco [Efeito], um proc de 3% por 5 segundos',
};

/**
 * Records whose encoding deliberately has MORE entries than the description has
 * occurrences, because one clause is a bounded ladder written as one threshold per rung.
 * The positional check below skips them; sp-cost-combo-refine.spec.ts asserts the ladder.
 */
const LADDERS: Record<number, string> = {
  22037: '"A cada refino a partir do +8 até o +13" vira seis limiares de -1, como em 19249 Spell Circuit',
};

/** Every record in the calculator whose pt-BR description carries the line. */
const carriers = Object.keys(ITEM_DB)
  .filter((id) => latam[id] && LINE.test(clean(latam[id].description)) && (LINE.lastIndex = 0) === 0)
  .map(Number)
  .sort((a, b) => a - b);

describe('spCostPercent is wired as a display-only stat', () => {
  it('starts at zero on a bare bonus sheet', () => {
    expect(createRawTotalBonus().spCostPercent).toBe(0);
  });

  it('has a pt-BR label, so the item panel can name it', () => {
    expect(ITEM_BONUS_LABELS['spCostPercent']).toBe('Custo de SP das habilidades');
  });
});

describe('the sweep', () => {
  it('finds the records the client says carry the line', () => {
    expect(carriers.length).toBe(111); // Includes as dez cartas de Issgard (300359-300381).
  });

  it('declares the key on every carrier except the listed exceptions', () => {
    const missing = carriers.filter((id) => !ITEM_DB[id].script?.spCostPercent && !NOT_ENCODED[id]);
    expect(missing.map((id) => `${id} ${latam[id].name}`)).toEqual([]);
  });

  it('keeps the exception list honest — every entry still carries the line and still has no key', () => {
    for (const id of Object.keys(NOT_ENCODED).map(Number)) {
      expect(carriers, `${id} não carrega mais a linha`).toContain(id);
      expect(ITEM_DB[id].script?.spCostPercent, `${id} já foi codificado — tire-o de NOT_ENCODED`).toBeUndefined();
    }
  });

  it('expands a description line into several entries only where LADDERS says so', () => {
    for (const id of Object.keys(LADDERS).map(Number)) {
      const entries: string[] = ITEM_DB[id].script?.spCostPercent;
      expect(entries, `${id} deixou de ser codificado`).toBeDefined();
      expect(entries.length).toBeGreaterThan(valuesIn(latam[id].description).length);
    }
  });

  it('matches the description number for number, in order, on every encoded record', () => {
    const wrong: string[] = [];
    for (const id of carriers) {
      const entries: string[] = ITEM_DB[id].script?.spCostPercent;
      if (!entries || LADDERS[id]) continue;
      const got = entries.map(valueOf);
      const want = valuesIn(latam[id].description);
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        wrong.push(`${id} ${latam[id].name}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never points a set clause at an item the calculator cannot equip', () => {
    const dangling: string[] = [];
    for (const id of carriers) {
      for (const entry of (ITEM_DB[id].script?.spCostPercent ?? []) as string[]) {
        for (const m of entry.matchAll(/EQUIP_ID\[([\d|&]+)\]/g)) {
          for (const partner of m[1].split(/[|&]+/).filter(Boolean)) {
            if (!ITEM_DB[partner]) dangling.push(`${id} -> EQUIP_ID[${partner}]`);
          }
        }
      }
    }
    expect(dangling).toEqual([]);
  });
});

describe('the values reach the engine', () => {
  it('4148 Carta Faraó: -30 flat, through a slotted host', () => {
    // 2124 Escudo — a plain slotted shield, so the number is the card's alone.
    expect(wornBonus({ shield: 2124, shieldCard: 4148 })['spCostPercent']).toBe(-30);
  });

  it('4128 Carta Besouro-Ladrão Dourado: +100, the sign the client prints', () => {
    expect(wornBonus({ shield: 2124, shieldCard: 4128 })['spCostPercent']).toBe(100);
  });

  it('15074 Manto Mágico de Geffen: -10 flat, -15 from +7', () => {
    expect(wornBonus({ garment: 15074, garmentRefine: 6 })['spCostPercent']).toBe(-10);
    expect(wornBonus({ garment: 15074, garmentRefine: 7 })['spCostPercent']).toBe(-15);
  });

  it('20782 Sobrepeliz Esmeralda I: -1 for every 2 refines', () => {
    expect(wornBonus({ garment: 20782, garmentRefine: 1 })['spCostPercent'] ?? 0).toBe(0);
    expect(wornBonus({ garment: 20782, garmentRefine: 9 })['spCostPercent']).toBe(-4);
  });

  it('2727 Xale do Arqueiro: -25 only with [Asas de Ícaro] 2726', () => {
    expect(wornBonus({ garment: 2727 })['spCostPercent'] ?? 0).toBe(0);
    expect(wornBonus({ garment: 2727, accRight: 2726 })['spCostPercent']).toBe(-25);
  });

  it('5123 Chapéu de Ulle: -10 only with [Bênção de Odin] 2353 and base DES 70', () => {
    // Waited on 2353 having a record, which it got with the classic armors on 15/09/2026.
    expect(wornBonus({ headUpper: 5123, stats: { dex: 90 } })['spCostPercent'] ?? 0).toBe(0);
    expect(wornBonus({ headUpper: 5123, armor: 2353, stats: { dex: 69 } })['spCostPercent'] ?? 0).toBe(0);
    expect(wornBonus({ headUpper: 5123, armor: 2353, stats: { dex: 70 } })['spCostPercent']).toBe(-10);
  });

  it('5442 Gravata Azul: the [Candura] set pays with either generation, 5040 or 18607', () => {
    expect(wornBonus({ headUpper: 5442 })['spCostPercent'] ?? 0).toBe(0);
    for (const candura of [5040, 18607]) {
      const set = wornBonus({ headUpper: 5442, headMiddle: candura });
      expect(set['spCostPercent'], `${candura}`).toBe(5);
      expect(set['aspdPercent'], `${candura}`).toBe(3);
      expect(set['vct'], `${candura}`).toBe(3);
    }
  });

  it('sums across pieces, as an ordinary bonus key does', () => {
    const both = wornBonus({ shield: 2124, shieldCard: 4148, garment: 15074, garmentRefine: 7 });
    expect(both['spCostPercent']).toBe(-45); // -30 + -15
  });
});

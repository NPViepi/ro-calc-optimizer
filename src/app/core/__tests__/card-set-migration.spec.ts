import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardDelta, ITEMS } from './card-set-doll';
import { CARDS_WITH_A_SET, classOf, lineUpsFor, scenarioKey, setClausesOf } from './card-set-scenarios';

/**
 * The behavioural baseline for moving the card family off `EQUIP[<nome>]`.
 *
 * `EQUIP[<nome>]` matches a combo partner by its English display name. It is the legacy form
 * (docs/item-json.md §5) and it fails in two directions: a pt-BR rename or an `[Apoio]`-style
 * suffix silently stops the bonus paying, and the client re-issues items under new ids
 * keeping the old English name — so one clause fires for every generation, and rewriting it
 * to a SINGLE id silently drops the others. Nothing errors either way; the set just stops
 * paying for whoever holds the id nobody wrote down.
 *
 * So the rewrite is not trusted, it is measured. `card-set-baseline.json` was written from
 * the database as it stood BEFORE the migration and holds two things per card:
 *
 *   scenarios  what the card grants worn alone with no partner at all, and worn with each
 *              line-up that satisfies a clause — one per alternative of every `||` group, so
 *              a partner generation that exists is a doll that actually ran;
 *   clauses    every set clause as {key, partner ids, the rest of the entry}. The numbers
 *              cannot see this half: a clause naming one generation of a re-issued partner
 *              measures the same as one naming both, because the doll only ever wears the id
 *              that IS named.
 *
 * Regenerate the fixture ONLY to add cards, never to accept a difference:
 *
 *     UPDATE_CARD_SET_BASELINE=1 npx vitest run src/app/core/__tests__/card-set-migration.spec.ts
 *
 * Same method as costume-enchant-combo-migration.spec.ts, which migrated the Visual-enchant
 * stones (159 records, 330 clauses).
 *
 * Reviewed description corrections for incoming PvE damage update only four records:
 * 27111's small-size combo is physical-only; 27264 adds its printed physical
 * resistances/vulnerabilities; 300122/300123 add their printed Pitaya combo.
 * See docs/damage-taken.md and monster-damage-taken.spec.ts for the independent checks.
 *
 * The client text of 28/10/2026 rewrote "consumo de SP ao usar habilidades +7%" as the
 * canonical "Custo de SP das habilidades +7%", which sp-cost-percent.spec.ts then found on
 * ten Issgard cards that had never declared it. 300361, 300362 and 300381 have a set, so
 * the baseline was regenerated to add their `spCostPercent` — a display-only stat gained,
 * nothing the migration dropped.
 *
 * 27265 (Fanático das Trevas) gained its printed "-30% contra Fogo e Sagrado" in an audit
 * of card penalties the records had dropped (card-penalties.spec.ts); the baseline was
 * regenerated to add those four keys, and its set clauses are unchanged.
 */

const BASELINE = 'src/app/core/__tests__/card-set-baseline.json';

type Granted = Record<string, number> | 'unwearable';

interface CardBaseline {
  scenarios: Record<string, Granted>;
  clauses: { key: string; groups: number[][]; tail: string }[];
}

/** An entry minus its partner token — the condition and value that must survive the rewrite. */
const tailOf = (entry: string) => entry.replace(/EQUIP(_ID)?\[[^\]]*]/, '');

function measure(): Record<string, CardBaseline> {
  const out: Record<string, CardBaseline> = {};

  for (const card of CARDS_WITH_A_SET) {
    const scenarios: Record<string, Granted> = { [scenarioKey([])]: cardDelta(card, []) ?? 'unwearable' };
    const clauses: CardBaseline['clauses'] = [];

    for (const clause of setClausesOf(card)) {
      clauses.push({ key: clause.key, groups: clause.groups, tail: tailOf(clause.entry) });
      const { make, label } = classOf(clause);

      for (const lineUp of lineUpsFor(clause)) {
        if (!lineUp.length || lineUp.some((id) => !ITEMS[id])) continue;
        scenarios[scenarioKey(lineUp, label)] = cardDelta(card, lineUp, make) ?? 'unwearable';
      }
    }

    out[card] = { scenarios, clauses };
  }

  return out;
}

const measured = measure();

if (process.env.UPDATE_CARD_SET_BASELINE) {
  describe('regenerating the baseline', () => {
    it('writes it', () => {
      writeFileSync(BASELINE, `${JSON.stringify(measured, null, 1)}\n`);
      expect(Object.keys(measured).length).toBeGreaterThan(0);
    });
  });
}

const baseline: Record<string, CardBaseline> = JSON.parse(readFileSync(BASELINE, 'utf8'));

describe('the card sets, measured', () => {
  it('covers every card that carries a set', () => {
    expect(Object.keys(measured).sort()).toEqual(Object.keys(baseline).sort());
  });

  it('grants exactly what it granted before the rewrite', () => {
    // One assertion over the whole fixture rather than a per-card loop: the shape of a
    // difference matters more than the first card that happens to show it.
    const scenariosOf = (source: Record<string, CardBaseline>) =>
      Object.fromEntries(Object.entries(source).map(([card, entry]) => [card, entry.scenarios]));

    expect(scenariosOf(measured)).toEqual(scenariosOf(baseline));
  });
});

describe('the card sets, structurally', () => {
  it('keeps every clause pointing at the same partners, whatever form it is written in', () => {
    // The half the numbers cannot check. A clause is the same clause when it sits under the
    // same bonus key, requires the same ids, and carries the same condition and value after
    // the partner token — which is exactly what a name -> id rewrite must not change.
    const shapeOf = (source: Record<string, CardBaseline>) =>
      Object.fromEntries(
        Object.entries(source).map(([card, entry]) => [
          card,
          entry.clauses.map((c) => `${c.key} ${c.groups.map((g) => [...g].sort((a, b) => a - b).join('||')).join('&&')} ${c.tail}`).sort(),
        ]),
      );

    expect(shapeOf(measured)).toEqual(shapeOf(baseline));
  });

  it('names a partner the database actually holds', () => {
    const unresolved: string[] = [];

    for (const card of CARDS_WITH_A_SET) {
      for (const clause of setClausesOf(card)) {
        clause.groups.forEach((group, index) => {
          if (!group.length) unresolved.push(`${card} "${clause.entry}" group ${index + 1} resolves to nothing`);
          for (const id of group) if (!ITEMS[id]) unresolved.push(`${card} "${clause.entry}" names ${id}, absent from item.json`);
        });
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('names every partner by id, with none of the family left on the display name', () => {
    // Not a ratchet: the card family was migrated whole — 434 clauses on 201 records — so a
    // new card writing `EQUIP[<nome>]` is a regression, not a leftover. The wider ratchet
    // over the rest of item.json lives in item-script-keys.spec.ts.
    const onName = CARDS_WITH_A_SET.filter((card) => setClausesOf(card).some((clause) => clause.form === 'name'));

    expect(onName).toEqual([]);
  });
});

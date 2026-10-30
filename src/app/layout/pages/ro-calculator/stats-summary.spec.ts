import { describe, expect, it } from 'vitest';
import { translate } from '../../../core/i18n';
import { DEFAULT_CATALOG } from '../../../i18n';
import { buildStatsSummary, statOriginFor, StatsSummaryOptions, SummaryRow } from './stats-summary';

/** The component's own cast/delay formatter, in the shape the builder receives it:
 *  a stored reduction of +72 reads as the "-72%" effect it applies. */
const bonusValueText = (key: string, value: number): string => (key === 'fct' ? `${-value}`.replace('.', ',') : `${-value}%`);

/** Every key is sourced, so the builder marks every keyed row clickable; the tests that
 *  care about clickability say so themselves. */
const OPTS: StatsSummaryOptions = {
  // The real catalog rather than a stub: every label the cases below name is the one the
  // panel prints, so a renamed entry fails here instead of silently changing the panel.
  text: (key, params) => translate(DEFAULT_CATALOG, key, params),
  bonusValueText,
  canBreakdown: () => true,
};

/** A totalSummary skeleton carrying only what the panel reads, with the design's numbers. */
function summary(over: any = {}) {
  const calc = {
    totalStatusAtk: 821,
    totalMasteryAtk: 0,
    totalEquipAtk: 884,
    totalStatusMatk: 371,
    totalAspd: 193,
    hitPerSecs: 7.14,
    totalHit: 705,
    totalPerfectHit: 14,
    totalCri: 106,
    criRangeBonus: 0,
    maxHp: 81714,
    maxSp: 5677,
    softDef: 203,
    def: 378,
    softMdef: 271,
    mdef: 20,
    res: 9,
    mres: 10,
    totalFlee: 509,
    totalPerfectDodge: 10,
    dex2int1: 539,
    to530: 0,
    ...(over.calc || {}),
  };

  return {
    atk: 0, atkPercent: 0, matk: 179, matkPercent: 0,
    melee: 7, range: 427, criDmg: 130,
    acd: 72, fct: 0.5, vct: 37,
    weapon: { baseWeaponAtk: 0, refineBonus: 0, baseWeaponMatk: 0 },
    dmg: { pAtk: 61, sMatk: 26, cRate: 8 },
    ...over,
    calc,
  };
}

const allRows = (view: ReturnType<typeof buildStatsSummary>): SummaryRow[] => view.columns.flat().flatMap((g) => g.rows);

const row = (view: ReturnType<typeof buildStatsSummary>, label: string): SummaryRow => {
  const found = allRows(view).find((r) => r.label === label);
  if (!found) throw new Error(`no row labelled "${label}"`);
  return found;
};

describe('buildStatsSummary — the values', () => {
  it('reads ATQ and ATQM as the status window does, "base + equipamento"', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(row(view, 'Alt+Q ATQ').text).toBe('821 + 884');
    expect(row(view, 'Alt+Q ATQM').text).toBe('371 + 179');
    // A headline figure prints its own name, where the rows below put the label in a
    // column of its own — `label` stays the plain one, for the breakdown dialog's title.
    expect(view.headline[0]).toMatchObject({ label: 'ATQ', text: 'ATQ 1.705' });
    expect(view.headline[1]).toMatchObject({ label: 'ATQM', text: 'ATQM 550' });
  });

  it('groups thousands in pt-BR and marks percentages', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(row(view, 'HP máx.').text).toBe('81.714');
    expect(row(view, 'À distância').text).toBe('427%');
  });

  it('prints the cast/delay stats as the negative effect they apply', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(row(view, 'Pós-conjuração').text).toBe('-72%');
    expect(row(view, 'Conj. Fixa').text).toBe('-0,5s');
  });

  it('keeps TEN and TENM as two rows, each with its own breakdown key', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(row(view, 'TEN')).toMatchObject({ text: '9', keys: ['res'] });
    expect(row(view, 'TENM')).toMatchObject({ text: '10', keys: ['mres'] });
  });

  it('leaves DES2 INT1 unclickable — it is a formula, not a sum of equipment', () => {
    expect(row(buildStatsSummary(summary(), null, OPTS), 'DES2 INT1').keys).toEqual([]);
  });

  it('only counts the points still missing when there are any', () => {
    expect(row(buildStatsSummary(summary(), null, OPTS), 'DES2 INT1').suffix).toBeUndefined();

    const short = buildStatsSummary(summary({ calc: { dex2int1: 500, to530: 30 } }), null, OPTS);
    expect(row(short, 'DES2 INT1').suffix).toBe('( faltam 30 )');
  });

  // The note is also what gates the "*" marker beside the value — a row carries both or
  // neither, so there is one field rather than two that could disagree.
  it('explains Crítico only when the build has CRIT à distância to explain', () => {
    expect(row(buildStatsSummary(summary(), null, OPTS), 'Crítico').note).toBeUndefined();

    const ranged = row(buildStatsSummary(summary({ calc: { criRangeBonus: 20 } }), null, OPTS), 'Crítico');
    expect(ranged.note).toContain('CRIT à distância +20');
  });

  // The hover text is the row's own label rather than a second string written beside it,
  // so the two can't drift. It names every value, clickable or not: one that opens nothing
  // still benefits from being named, and in the compared column the label is the only thing
  // that says which row a bare "→ 664 -9" belongs to.
  it('names every value after its own label, whether or not it opens anything', () => {
    const view = buildStatsSummary(summary(), summary(), OPTS);

    expect(row(view, 'Precisão')).toMatchObject({ tooltip: 'Precisão', compareTooltip: 'Precisão (comparação)' });
    // DES2 INT1 is a pure DES/INT formula — no sources, so no click, but still a name.
    expect(row(view, 'DES2 INT1')).toMatchObject({ clickable: false, tooltip: 'DES2 INT1', compareTooltip: 'DES2 INT1 (comparação)' });

    const inert = buildStatsSummary(summary(), summary(), { ...OPTS, canBreakdown: () => false });
    expect(row(inert, 'Precisão')).toMatchObject({ clickable: false, tooltip: 'Precisão' });
  });

  // The hits/s figure prints its unit where the others print a name, and it opens the
  // golpes/s curve rather than a breakdown — so it is clickable with no keys at all.
  it('names the hits/s figure after the curve it opens', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { hitPerSecs: 6.25 } }), OPTS);
    const rate = view.headline[3];

    expect(rate).toMatchObject({ kind: 'rate', keys: [], clickable: true, tooltip: 'Golpes por segundo' });
    expect(rate.compareTooltip).toBe('Golpes por segundo (comparação)');
  });
});

describe('buildStatsSummary — the groups', () => {
  // The pairing is what balances the three columns; regroup them and the panel grows
  // taller than the two input cells it sits beside. Back at the 8 / 8 / 7 it was designed
  // at: the sustain family briefly took five rows in this column, and now the four
  // healing/regen ones sit behind the Recursos link (see `sustain` below) and the
  // reflected-damage one behind the Defesa one (./reduction-breakdown).
  it('pairs the groups into three columns of roughly equal depth', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(view.columns.map((col) => col.map((g) => g.title))).toEqual([
      ['Ataque', 'Conjuração'],
      ['Mágico', 'Precisão e crítico'],
      ['Defesa', 'Recursos'],
    ]);
    expect(view.columns.map((col) => col.reduce((n, g) => n + g.rows.length, 0))).toEqual([8, 8, 7]);
  });

  it('hangs the Redução de dano link off the Defesa header', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(view.columns.flat().filter((g) => g.showReduction).map((g) => g.title)).toEqual(['Defesa']);
    // The reflected-damage resistance is a row of that popover now, not of the group.
    expect(allRows(view).some((r) => r.keys.includes('reduceDamageReturn'))).toBe(false);
  });

  // The four sustain stats are display-only and read 0% on most builds, so they sit behind
  // the Recursos header's "Cura e regen." link rather than in the grid. They are not rows
  // of any group — a copy left in the grid is exactly what this change removed.
  it('hangs the sustain rows off the Recursos header instead of the grid', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(view.columns.flat().filter((g) => g.showSustain).map((g) => g.title)).toEqual(['Recursos']);
    expect(view.sustain.map((r) => r.label)).toEqual(['Regen. HP', 'Regen. SP', 'Cura recebida', 'Efetividade de cura']);
    expect(allRows(view).some((r) => view.sustain.some((sr) => sr.label === r.label))).toBe(false);
  });

  it('builds the sustain rows as full rows — value, breakdown keys and a comparison', () => {
    const view = buildStatsSummary(summary({ healPower: 30 }), summary({ healPower: 12 }), OPTS);
    const healPower = view.sustain.find((r) => r.label === 'Efetividade de cura');

    expect(healPower.text).toBe('30%');
    expect(healPower.keys).toEqual(['healPower']);
    expect(healPower.clickable).toBe(true);
    expect(healPower.compare).toEqual({ text: '12%', deltaText: '-18', deltaClass: 'compare_lower' });
  });
});

describe('buildStatsSummary — the comparison cell', () => {
  it('says nothing at all without a compared build', () => {
    const view = buildStatsSummary(summary(), null, OPTS);

    expect(allRows(view).every((r) => r.compare === null)).toBe(true);
    expect(view.headline.every((h) => h.compare === null)).toBe(true);
  });

  it('says nothing on a row the swap did not move', () => {
    const view = buildStatsSummary(summary(), summary(), OPTS);

    expect(allRows(view).every((r) => r.compare === null)).toBe(true);
  });

  it('repeats the "A + B" shape instead of collapsing to the total', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { totalEquipAtk: 932 } }), OPTS);

    expect(row(view, 'Alt+Q ATQ').compare).toEqual({ text: '821 + 932', deltaText: '+48', deltaClass: 'compare_greater' });
  });

  it('takes the delta on the sum of an "A + B" row', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { totalFlee: 494 } }), OPTS);

    expect(row(view, 'Esquiva').compare).toEqual({ text: '494 + 10', deltaText: '-15', deltaClass: 'compare_lower' });
  });

  it('colours by benefit, not by sign — losing HP is red', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { maxHp: 80900 } }), OPTS);

    expect(row(view, 'HP máx.').compare).toEqual({ text: '80.900', deltaText: '-814', deltaClass: 'compare_lower' });
  });

  it('colours a deeper cast reduction green, even though the number went down', () => {
    // -72% -> -77% is five more points of Pós-conjuração reduction: a gain.
    const better = buildStatsSummary(summary(), summary({ acd: 77 }), OPTS);
    expect(row(better, 'Pós-conjuração').compare).toEqual({ text: '-77%', deltaText: '-5', deltaClass: 'compare_greater' });

    const worse = buildStatsSummary(summary(), summary({ acd: 60 }), OPTS);
    expect(row(worse, 'Pós-conjuração').compare).toEqual({ text: '-60%', deltaText: '+12', deltaClass: 'compare_lower' });
  });

  it('keeps the decimal on Conj. Fixa, which is seconds and not points', () => {
    const view = buildStatsSummary(summary(), summary({ fct: 0.8 }), OPTS);

    expect(row(view, 'Conj. Fixa').compare).toEqual({ text: '-0,8s', deltaText: '-0,3', deltaClass: 'compare_greater' });
  });

  it('compares the headline figures too, and leaves the rate its number without a delta', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { totalEquipAtk: 932, hitPerSecs: 6.5 } }), OPTS);

    expect(view.headline[0].compare).toEqual({ text: '1.753', deltaText: '+48', deltaClass: 'compare_greater' });
    expect(view.headline[3]).toMatchObject({ kind: 'rate', compare: { text: '6,5 hits/s', deltaText: '' } });
  });

  it('registers a hundredth of a hit per second — the rate is printed to two decimals', () => {
    const view = buildStatsSummary(summary(), summary({ calc: { hitPerSecs: 7.15 } }), OPTS);

    expect(view.headline[3].compare?.deltaClass).toBe('compare_greater');
  });
});

/**
 * `statOriginFor` is what makes a value clickable when no equipment sources it, and what
 * supplies the "everything the gear does not account for" row in the breakdown dialog.
 */
describe('stat origins', () => {
  it('matches on the whole key list, not on one of its keys', () => {
    expect(statOriginFor(['flee', 'perfectDodge'])).toBeTruthy();
    // A caller asking for `flee` alone is not the Esquiva row and must not borrow its label.
    expect(statOriginFor(['flee'])).toBeNull();
    expect(statOriginFor(['perfectDodge', 'flee'])).toBeNull();
  });

  it('has no origin for the purely equipment-sourced values', () => {
    // Nothing but gear grants these, so an empty dialog is the honest answer and the value
    // stays unclickable when no source contributes.
    for (const keys of [['melee'], ['range'], ['matkPercent'], ['criDmg'], ['acd'], ['vct']]) {
      expect(statOriginFor(keys)).toBeNull();
    }
  });

  it('reads the total off the row itself, so it cannot drift from what the panel prints', () => {
    const cur = summary();

    // The fixture's own numbers, as the panel reads them: Precisão is calc.totalHit,
    // Esquiva is totalFlee+totalPerfectDodge, HP máx. is calc.maxHp, DEF is softDef+def.
    expect(statOriginFor(['hit'])!.total(cur)).toBe(705);
    expect(statOriginFor(['flee', 'perfectDodge'])!.total(cur)).toBe(519);
    expect(statOriginFor(['hp', 'hpPercent'])!.total(cur)).toBe(81714);
    expect(statOriginFor(['def'])!.total(cur)).toBe(581);
    expect(statOriginFor(['atk'])!.total(cur)).toBe(1705);
  });

  it('survives a half-built summary rather than printing NaN', () => {
    for (const keys of [['hit'], ['atk'], ['matk'], ['hp', 'hpPercent'], ['res']]) {
      expect(statOriginFor(keys)!.total(undefined)).toBe(0);
      expect(statOriginFor(keys)!.total({})).toBe(0);
    }
  });

  /**
   * `sumKeys` exists for the keys that do not add as points. Subtracting a `hpPercent` of 5
   * from a 5.085 HP pool as if it were 5 HP would misprice the base by exactly that much.
   */
  it('excludes the multiplying keys from the equipment sum', () => {
    expect(statOriginFor(['hp', 'hpPercent'])!.sumKeys).toEqual(['hp']);
    expect(statOriginFor(['sp', 'spPercent'])!.sumKeys).toEqual(['sp']);
    expect(statOriginFor(['aspd', 'aspdPercent', 'skillAspd', 'skillAspdPercent'])!.sumKeys).toEqual(['aspd']);
    // criRange is not summed into the crit rate at all — it counts only on the ranged basic
    // attack, which is why the Crítico row carries a "*" instead of adding it in.
    expect(statOriginFor(['cri', 'criRange'])!.sumKeys).toEqual(['cri']);
  });
});

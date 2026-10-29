import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getEnchants } from 'src/app/constants/enchant_item/_enchant_table';
import { createMainModel } from 'src/app/utils';
import { equipStatusOf, makeCalculator } from './make-calculator';

/**
 * Brotos Temporais — the six lower headgears of the Temporal sets (420017 FOR, 420018
 * DES, 420019 AGI, 420020 SOR, 420021 VIT, 420022 INT). None of them had a row in the
 * enchant table, so their three sockets offered nothing; the 28 enchants the table rolls
 * were missing from item.json too.
 *
 * The pool is the "Encantamentos Aleatórios" table on browiki's Brotos Temporais
 * template, which collapses the repeated rows into a generic "Atributo +N" (slot 4) and
 * "Talento +N" (slot 2). Its percentages say both stand for the whole family: slot 4's
 * 12,46 + 3,50 + 0,70 = 16,66% is a sixth of the roll, and slot 2's (9,50 + 0,50) × 10
 * entries is all of it — which only closes if every sprout offers all six of each.
 *
 * @see https://browiki.org/wiki/Predefini%C3%A7%C3%A3o:Brotos_Temporais
 */

const db = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const latam = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8'));

const SPROUTS: [number, string][] = [
  [420017, 'Tree_Of_Sprout_STR'],
  [420018, 'Tree_Of_Sprout_DEX'],
  [420019, 'Tree_Of_Sprout_AGI'],
  [420020, 'Tree_Of_Sprout_LUK'],
  [420021, 'Tree_Of_Sprout_VIT'],
  [420022, 'Tree_Of_Sprout_INT'],
];

/** Slot 4 — "Atributo +1/+2/+3", i.e. every base stat at all three tiers. */
const SLOT_4 = [
  'FOR +1', 'FOR +2', 'FOR +3', 'INT +1', 'INT +2', 'INT +3', 'DES +1', 'DES +2', 'DES +3',
  'AGI +1', 'AGI +2', 'AGI +3', 'VIT +1', 'VIT +2', 'VIT +3', 'SOR +1', 'SOR +2', 'SOR +3',
];

/** Slot 3 — the flat pool, plus the tier-2 forms the wiki gives in its upgrade table. */
const SLOT_3 = [
  'SP máx. +3%', 'HP máx. +3%', 'Músculo 1', 'Intelecto 1', 'Pedra de Encantamento 1', 'Anti-Atraso 1',
  'HP máx. +5%', 'SP máx. +5%', 'Músculo 2', 'Intelecto 2', 'Pedra de Encantamento 2', 'Anti-Atraso 2',
];

/**
 * Slot 2 — "Talento +N" is all six talentos; the other four are named outright.
 *
 * 311088 is the T.CRÍT +1 enchant — its own description still reads "T.CRÍT +1." — but the
 * client table of 28/10/2026 labels it "Flor Invernal (FOR)", which is 311092's name. The
 * mislabel is upstream in the client and latam-items.json mirrors the client as it is.
 */
const SLOT_2 = [
  'POD +1', 'STA +1', 'SAB +1', 'FEI +1', 'CON +1', 'CRV +1', 'Flor Invernal (FOR)', 'C.Mais +1', 'P.ATQ +1', 'S.ATQM +1',
  'POD +2', 'STA +2', 'SAB +2', 'FEI +2', 'CON +2', 'CRV +2', 'T.CRÍT +2', 'C.Mais +2', 'P.ATQ +2', 'S.ATQM +2',
];

/** aegisName -> the pt-BR name the dropdown shows, so a failure reads like the wiki. */
const NAME_BY_AEGIS = new Map<string, string>(
  Object.entries(db).map(([id, item]: [string, any]) => [item.aegisName, latam[id]?.name ?? item.name]),
);

const optionNames = (aegisNames: string[]) =>
  aegisNames.map((a) => NAME_BY_AEGIS.get(a) ?? `<${a} missing from item.json>`);

/** The bonus one enchant contributes, isolated: the sprout with it minus the sprout alone. */
function deltaOf(enchantId: number, slot: 1 | 2 | 3): Record<string, number> {
  const run = (withEnchant: boolean) => {
    const items: any = { 420017: { ...db[420017] } };
    if (withEnchant) items[enchantId] = { ...db[enchantId] };

    const model = createMainModel();
    model.level = 200;
    model.headLower = 420017;
    if (withEnchant) model[`headLowerEnchant${slot}`] = enchantId;

    return equipStatusOf(makeCalculator(items), model);
  };

  const withEnchant = run(true);
  const without = run(false);
  const delta: Record<string, number> = {};
  for (const key of new Set([...Object.keys(withEnchant), ...Object.keys(without)])) {
    delta[key] = (withEnchant[key] || 0) - (without[key] || 0);
  }

  return delta;
}

describe('Brotos Temporais — encantamentos', () => {
  it.each(SPROUTS)('%i has the three sockets the NPC fills', (_id, aegisName) => {
    // enchants is [_, slot2, slot3, slot4] — game socket numbering, descending.
    const [, ...sockets] = getEnchants(aegisName) || [];

    expect(sockets).toHaveLength(3);
    for (const socket of sockets) expect(socket?.length).toBeGreaterThan(0);
  });

  it.each(SPROUTS)('%i offers the wiki table in every socket', (_id, aegisName) => {
    const [, slot2, slot3, slot4] = getEnchants(aegisName) as string[][];

    expect(optionNames(slot2).sort()).toEqual([...SLOT_2].sort());
    expect(optionNames(slot3).sort()).toEqual([...SLOT_3].sort());
    expect(optionNames(slot4).sort()).toEqual([...SLOT_4].sort());
  });

  /**
   * Order is part of the deliverable, not an accident of how the lists were written: the
   * dropdown runs tier by tier, so every +1 comes before any +2. Grouping a stat with its
   * own upgrades (FOR +1, FOR +2, FOR +3, AGI +1, …) is what `BaseState._1_3` does and is
   * why slot 4 does not use it.
   */
  it.each(SPROUTS)('%i lists every socket tier by tier, all the +1 before any +2', (_id, aegisName) => {
    const [, ...sockets] = getEnchants(aegisName) as string[][];

    for (const socket of sockets) {
      const tiers = optionNames(socket).map((name) => Number(/(\d)$/.exec(name)?.[1] ?? 1));
      expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    }
  });

  it('runs the six stats and the six talentos in the same status-window order', () => {
    const [, slot2, , slot4] = getEnchants('Tree_Of_Sprout_STR') as string[][];

    expect(optionNames(slot4).slice(0, 6)).toEqual(['FOR +1', 'AGI +1', 'VIT +1', 'INT +1', 'DES +1', 'SOR +1']);
    expect(optionNames(slot2).slice(0, 6)).toEqual(['POD +1', 'STA +1', 'SAB +1', 'FEI +1', 'CON +1', 'CRV +1']);
  });

  it('gives every sprout the same table — the wiki lists one row for the six', () => {
    const [first] = SPROUTS;
    const reference = getEnchants(first[1]);

    for (const [, aegisName] of SPROUTS.slice(1)) expect(getEnchants(aegisName)).toEqual(reference);
  });
});

describe('Brotos Temporais — efeito de cada encanto', () => {
  // Slot 2: "POD +1." and the rest are flat one-liners, so the delta is the number itself.
  it.each([
    [311076, 'pow', 1], [311077, 'pow', 2],
    [311082, 'sta', 1], [311083, 'sta', 2],
    [311078, 'wis', 1], [311079, 'wis', 2],
    [311080, 'spl', 1], [311081, 'spl', 2],
    [311086, 'con', 1], [311087, 'con', 2],
    [311084, 'crt', 1], [311085, 'crt', 2],
    [311088, 'cRate', 1], [311089, 'cRate', 2],
    [311090, 'hplus', 1], [311091, 'hplus', 2],
    [310982, 'pAtk', 1], [310983, 'pAtk', 2],
    [310984, 'sMatk', 1], [310985, 'sMatk', 2],
  ] as [number, string, number][])('%i gives %s +%i', (id, key, value) => {
    expect(deltaOf(id, 1)[key]).toBe(value);
  });

  // Slot 3: "Dano físico +N%" is atkPercent, "Dano mágico +N%" is matkPercent.
  it.each([
    [310986, 'atkPercent', 3], [310987, 'atkPercent', 5],
    [310988, 'matkPercent', 3], [310989, 'matkPercent', 5],
    [310990, 'hpPercent', 3], [310991, 'hpPercent', 5],
    [310992, 'spPercent', 3], [310993, 'spPercent', 5],
  ] as [number, string, number][])('%i gives %s +%i', (id, key, value) => {
    expect(deltaOf(id, 2)[key]).toBe(value);
  });

  it('rolls the slot-4 stat straight into the base stat', () => {
    expect(deltaOf(4702, 3)['str']).toBe(3); // FOR +3
    expect(deltaOf(4702, 3)['agi']).toBe(0);
  });

  it('does not give a slot its neighbours bonus', () => {
    // POD +1 sits in slot 2 only; putting it nowhere leaves the sprout at zero.
    const bare = deltaOf(311076, 1);
    expect(bare['str']).toBe(0);
    expect(bare['pAtk']).toBe(0);
  });
});

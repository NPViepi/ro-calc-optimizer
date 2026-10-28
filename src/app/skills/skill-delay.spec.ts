import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from '../jobs/_character-base.abstract';
import { CLASS_CTOR_BY_ID } from '../jobs/_class-list';
import { SKILL_ID_BY_NAME } from './index';

/**
 * Every attack skill's cast and delay numbers must be the ones the client shows in its
 * own "Informação de Conjuração / Espera" window.
 *
 * `src/assets/demo/data/skill-delay.json` is that window, mirrored from the ragassets
 * `skills.json` feed by `tools/build-skill-delays.mjs` (milliseconds; see that file for
 * the column mapping). Regenerate it after a client update and run this spec: a diff
 * here is the client having retuned a skill, not a bug in the test.
 *
 * The engine keeps the same four numbers in seconds on `AtkSkillModel`, per level:
 * `fct` (fixa), `vct` (variável), `acd` (pós) and `cd` (recarga).
 */
type DelayRow = { maxLevel: number; fct: number | number[]; vct: number | number[]; acd: number | number[]; cd: number | number[]; };

const TABLE: Record<string, DelayRow> = JSON.parse(readFileSync('src/assets/demo/data/skill-delay.json', 'utf8'));

const FIELDS = ['fct', 'vct', 'acd', 'cd'] as const;
type Field = (typeof FIELDS)[number];

/**
 * Skills the calculator deliberately models with delays other than the client's, and
 * why. Nothing else may diverge — add an entry here only with a reason that survives
 * being read out loud, never to silence a failure.
 */
const EXCEPTIONS: Record<string, { fields: Field[]; why: string; }> = {
  // The client's 30/60/90/120/150s curve is the cooldown of *summoning* the servants.
  // This entry is one servant's hit, which the summon then fires off on its own, so the
  // summon cooldown is not the rate at which this damage lands.
  'Servant Weapon': { fields: ['cd'], why: 'client cd is the summon cooldown, not the per-hit rate modelled here' },
};

/**
 * Skills the client ships with no delay row at all (`delay: null` in the feed), plus
 * ids the feed does not know. They cannot be checked; keep the list closed so a new
 * one has to be looked at rather than quietly skipped.
 */
const NO_CLIENT_ROW = new Set([
  51, // Esconderijo (Hiding): entrada de rotação sem dano, e o cliente não traz a linha
  214, // Ataque Surpresa (Sightless Mind)
  2239, // Bomba Relógio (Bomb Cluster): no client delay row
  2243, // Investida de Worg (Wug Strike)
  2308, // Toque do Oblívio (Banishing Point)
  2593, // Chute Solar (Blaze Kick)
  6001, // Dragonic Breath — a preview skill LATAM has not received, so the client has no row
]);

const at = (value: number | number[], level: number): number => (Array.isArray(value) ? value[level - 1] : value);
const resolve = (value: AtkSkillModel[Field], level: number): number =>
  (typeof value === 'function' ? value(level) : value) ?? 0;

/** The levels a skill can actually be calculated at: its default plus any `levelList`. */
const selectableLevels = (skill: AtkSkillModel): number[] => {
  const parse = (value: string) => Number(String(value).split('==')[1]);
  const levels = new Set([parse(skill.value), ...(skill.levelList ?? []).map((entry) => parse(entry.value))]);

  return [...levels].filter((level) => Number.isFinite(level) && level >= 1);
};

/**
 * One entry per (class, skill, level) the calculator offers. Deliberately NOT deduped by
 * skill name: a skill can be defined more than once — in two job files (Heaven's Drive
 * lives in both HighWizard and SuperNovice) or twice in one class (Meteor Storm Buster's
 * "Queda" and "Explosão" parts) — and each copy carries its own delay numbers. Checking
 * one copy per name would let the others drift.
 */
const atkSkillLevels = () => {
  const rows: { classId: string; skill: AtkSkillModel; level: number; }[] = [];

  for (const [classId, Ctor] of Object.entries(CLASS_CTOR_BY_ID)) {
    for (const skill of new Ctor().atkSkills) {
      for (const level of selectableLevels(skill)) rows.push({ classId, skill, level });
    }
  }

  return rows;
};

const ROWS = atkSkillLevels();

describe('atk skill cast/delay values', () => {
  it('covers every attack skill the calculator offers', () => {
    expect(ROWS.length).toBeGreaterThan(200);
  });

  it('only skips skills the client has no delay row for', () => {
    const unexpected = ROWS.filter(({ skill }) => {
      const id = SKILL_ID_BY_NAME[skill.name];

      return !TABLE[id] && !NO_CLIENT_ROW.has(id);
    }).map(({ skill }) => `${skill.name} (id ${SKILL_ID_BY_NAME[skill.name] ?? 'not in the catalog'})`);

    expect([...new Set(unexpected)]).toEqual([]);
  });

  it('never selects a level above the client cap', () => {
    const over = ROWS.filter(({ skill, level }) => {
      const row = TABLE[SKILL_ID_BY_NAME[skill.name]];

      return row && level > row.maxLevel;
    }).map(({ skill, level }) => `${skill.name} Lv${level} > ${TABLE[SKILL_ID_BY_NAME[skill.name]].maxLevel}`);

    expect(over).toEqual([]);
  });

  it('matches the client conjuração/espera table', () => {
    const wrong: string[] = [];

    for (const { classId, skill, level } of ROWS) {
      const id = SKILL_ID_BY_NAME[skill.name];
      const row = TABLE[id];
      if (!row || level > row.maxLevel) continue;

      const exempt = EXCEPTIONS[skill.name]?.fields ?? [];
      for (const field of FIELDS) {
        if (exempt.includes(field)) continue;

        const ours = resolve(skill[field], level);
        const client = at(row[field], level) / 1000;
        if (Math.abs(ours - client) > 1e-9) {
          wrong.push(`[${classId}] ${skill.name} (id ${id}) Lv${level} ${field}: ${ours} should be ${client}`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});

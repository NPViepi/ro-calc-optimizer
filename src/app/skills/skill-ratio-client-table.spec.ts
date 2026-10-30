/**
 * The ratio counterpart of `skill-delay.spec.ts`: every attack the rebalance reference
 * covers, checked level by level against the per-level ATQ/ATQM table the client prints in
 * its own skill description (`skill-meta.generated.ts`, client of 28/10/2026).
 *
 * The client table is the source of truth, as `review-rrf-class` §8 has it for cast and
 * delay: **fix the job file or the patch, not the expectation**. Two numbers reached the
 * engine from the class articles and only the client caught them — Colisão Astral's flat
 * term and Arremessar Escudo's per-level step — and this spec is what would have caught
 * them earlier. A genuine divergence goes in `EXCEPTIONS` with the reason.
 *
 * Skills whose description prints no ATQ column, or prints it per weapon or per state
 * instead of per level, are counted rather than checked; `NO_TABLE` pins that count so a
 * client that starts publishing one shows up here.
 */
import { describe, expect, it } from 'vitest';
import * as Jobs from '../jobs';
import { AtkSkillFormulaInput, CharacterBase } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { ElementType } from '../constants/element-type.const';
import { REBALANCE_2022_REFERENCE } from './rebalance-2022-reference';
import { SKILL_META } from './index';

/** Divergences that are not engine bugs. Each one needs a reason, never a silent edit. */
const EXCEPTIONS: Record<string, string> = {
  // The engine multiplies by target size (×1,5 / ×1,3 / ×1,2); the client prints the ratio
  // before that factor, so the Medium stub below reads 30% high at every level.
  'Spiral Pierce Max': 'client prints the ratio before the target-size factor',
  // The client's own table is 270 / 340 / 610 / 780 / 950, and every level but Nv2 fits
  // 100 + 170 × Nv. 340 breaks that progression by exactly 100, so it is a client typo and
  // the engine keeps 440. Revisit if a recording ever lands on 340.
  'Storm Slash': 'client Nv2 (340%) breaks its own +170 progression — treated as a typo',
};

/** Attacks whose description publishes no per-level ATQ column to compare against. */
const NO_TABLE = 48;

const plain = (text?: string) => (text ?? '').replace(/\^[0-9a-fA-F]{6}/g, '');
const num = (text: string) => Number(text.replace(/\./g, '').replace(',', '.'));

/**
 * The client prints `Nível l ATQ l <other columns>` and then one `[Nv n]` line per level.
 * Read the column the header names, so cells like "7x7 células" are never taken as ratios.
 */
function clientTable(name: string): Map<number, number> | null {
  const lines = plain(SKILL_META[name]?.description).split('\n');
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index].split(' l ').map((part) => part.trim());
    if (header[0] !== 'Nível') continue;
    const column = header.findIndex((part) => part === 'ATQ' || part === 'ATQM');
    if (column < 1) continue;
    const table = new Map<number, number>();
    for (let next = index + 1; next < lines.length; next++) {
      const row = lines[next].match(/^\[Nv\.? ?(\d+)\]:? ?(.*)$/);
      if (!row) break;
      const percent = (row[2].split(' l ')[column - 1] ?? '').trim().match(/^([\d.]+(?:,\d+)?)%$/);
      if (percent) table.set(Number(row[1]), num(percent[1]));
    }
    if (table.size) return table;
  }
  return null;
}

function job(name: ClassName): CharacterBase {
  const cls = new Jobs[name]() as CharacterBase;
  cls.setLearnSkills({ activeSkillIds: cls.activeSkills.map(() => 0), passiveSkillIds: cls.passiveSkills.map(() => 0) }).getSkillBonusAndName();
  return cls;
}

/**
 * Base level 100 so `scale` is the identity, every trait and mastery at zero, and no
 * stack — which is what the client's table describes.
 */
function input(level: number): AtkSkillFormulaInput {
  return { skillLevel: level, model: { level: 100 }, status: { totalPow: 0, totalSpl: 0, totalCon: 0 }, stack: 0,
    skills: { isActive: () => false, activeLevel: () => 0, learnedLevel: () => 0 },
    monster: { size: 'm', data: { level: 100 }, isRace: () => false, isElement: () => false },
    weapon: { data: { weight: 0, baseWeaponLevel: 4 }, isType: () => false, isSubType: () => false },
    equipmentBonus: { shield: {} }, totalBonus: {}, maxHp: 0, maxSp: 0, ammoElement: ElementType.Fire,
  } as unknown as AtkSkillFormulaInput;
}

describe('baseline skill ratios against the client table', () => {
  const checked: string[] = [];
  const untabled: string[] = [];

  for (const group of REBALANCE_2022_REFERENCE) {
    for (const [name, reference] of Object.entries(group.skills)) {
      const table = clientTable(name);
      if (!table) { untabled.push(name); continue; }
      checked.push(name);
      const label = EXCEPTIONS[name] ? `${name} (diverges: ${EXCEPTIONS[name]})` : name;

      it(`${group.classes[0]} — ${label}`, () => {
        const skill = job(group.classes[0]).getAtkSkills().find((entry) => entry.name === name);
        expect(skill, name).toBeDefined();
        const diffs: string[] = [];
        for (const [level, want] of table) {
          if (level > reference.maxLevel) continue;
          const got = Math.round(skill!.formula(input(level)));
          if (Math.abs(got - want) >= 1) diffs.push(`Nv${level}: cliente ${want}, motor ${got}`);
        }
        if (EXCEPTIONS[name]) expect(diffs.length, `${name} no longer diverges — drop its EXCEPTIONS entry`).toBeGreaterThan(0);
        else expect(diffs, name).toEqual([]);
      });
    }
  }

  it('covers the whole reference and pins how many attacks publish no table', () => {
    expect(checked.length + untabled.length).toBe(148);
    expect(untabled).toHaveLength(NO_TABLE);
    // Every exception must name a skill this spec actually checks.
    expect(Object.keys(EXCEPTIONS).filter((name) => !checked.includes(name))).toEqual([]);
  });
});

/**
 * The load-bearing spec: the MCP facade must reproduce the component's `prepare()`
 * exactly, or agents get different damage than the website for the same build.
 *
 * It re-derives the absolute, replay-validated integers asserted by
 * `src/app/jobs/ElementalMaster.poison-replay.spec.ts` — but drives them through
 * `resolveBuild` → `solve` → `projectResult` instead of hand-assembling a model.
 * Anything that drifts (a missing job bonus, a skipped derivation step, a different
 * option/buff path) moves these numbers.
 *
 * See that spec for the replay sources and the EXTRA_INT explanation.
 */
import { describe, expect, it } from 'vitest';
import { defaultAtkSkill } from 'src/app/core/rotation';
import { loadDatasetFromDisk } from '../data/dataset.node';
import { BuildInput, resolveBuild } from './build-input';
import { projectResult } from './project';
import { solve } from './solve';

const dataset = loadDatasetFromDisk();
const DUMMY_NEUTRAL = 21077;

/** +3 INT the recordings carry and the model cannot account for — see the source spec. */
const EXTRA_INT = 3;

const POISON_REPLAY = {
  class: 4261,
  level: 230,
  jobLevel: 47,
  stats: { str: 1, agi: 1, vit: 120, int: 130 + EXTRA_INT, dex: 1, luk: 1, spl: 100 },
} satisfies BuildInput;

const EM_SKILLS_REPLAY = {
  class: 4261,
  level: 239,
  jobLevel: 50,
  stats: { str: 4, agi: 96, vit: 120, int: 125 + EXTRA_INT, dex: 120, luk: 43, spl: 100 },
} satisfies BuildInput;

function damageOf(base: BuildInput, atkSkill: string, extra: Partial<BuildInput> = {}): number {
  const rb = resolveBuild({ ...base, ...extra, atkSkill }, dataset);
  // Both recordings predate the 28/10/2026 client, so they measure the pre-rebalance
  // formulas. `BuildInput` carries no version, so an agent always gets today's numbers;
  // pinning it here keeps the parity check comparing like with like.
  (rb.model as any).skillFormulaVersion = 'pre-rebalance';
  const calc = solve(rb, dataset, dataset.monsters[DUMMY_NEUTRAL]);
  const out = projectResult(calc, rb);
  return out['damage'].skill.max;
}

describe('facade parity — Elemental Master poison replay, absolute damage', () => {
  it('Maldição de Jormungand Lv5, clean tick → 16449', () => {
    expect(damageOf(POISON_REPLAY, 'Killing Cloud==5')).toBe(16449);
  });

  it('Implosão Tóxica Lv5, clean → 68309', () => {
    expect(damageOf(POISON_REPLAY, 'Poison Burst==5')).toBe(68309);
  });

  it('Maldição de Jormungand Lv5 tick under [Infecção] → 20571', () => {
    // Delivered as the real Infecção buff (job-buffs.ts → { infection: 25 } at Lv5),
    // which is how a user would set it — the source spec injects the same value as a
    // raw option script instead, so this also proves the two paths agree.
    expect(damageOf(POISON_REPLAY, 'Killing Cloud==5', { skills: { buffs: { Infection: 5 } } })).toBe(20571);
  });

  it('Implosão Tóxica Lv5 under [Infecção] → 117700', () => {
    expect(damageOf(POISON_REPLAY, 'Poison Burst==5', { skills: { buffs: { Infection: 5 } } })).toBe(117700);
  });
});

describe('facade parity — earlier EM-skill replay', () => {
  it('Diamond Storm Lv5 (5 displayed hits) → 191585', () => {
    expect(damageOf(EM_SKILLS_REPLAY, 'Diamond Storm==5')).toBe(191585);
  });

  it('Conflagration Lv5, per tick → 71823', () => {
    expect(damageOf(EM_SKILLS_REPLAY, 'Conflagration==5')).toBe(71823);
  });
});

describe('facade derivation', () => {
  it('applies the job-level stat bonuses (omitting them yields NaN accuracy)', () => {
    const rb = resolveBuild({ ...POISON_REPLAY, atkSkill: 'Poison Burst==5' }, dataset);
    const m = rb.model as any;
    // job 47 ElementalMaster: INT +13 (the replay's totalInt 146 = 130 base + 13 job
    // + 3 EXTRA_INT), plus the trait bonuses that feed the hit formula.
    expect(m.jobInt).toBe(13);
    expect(m.jobSpl).toBe(8);
    expect(m.jobCon).toBe(5);
  });

  it('clamps an out-of-range level to the app default rather than trusting the input', () => {
    const rb = resolveBuild({ class: 4261, level: 999, jobLevel: 1 }, dataset);
    expect((rb.model as any).level).toBe(200);
  });

  it('falls back to the class default when the attack skill is unknown', () => {
    const rb = resolveBuild({ class: 4261, atkSkill: 'Not A Real Skill==9' }, dataset);
    expect((rb.model as any).selectedAtkSkill).toBe(defaultAtkSkill(rb.char.atkSkills));
  });

  it('rejects a class that is not released on LATAM', () => {
    expect(() => resolveBuild({ class: 999999 }, dataset)).toThrow(/não existe|não está disponível/);
  });

  it('warns about a gear id the calculator has no record for', () => {
    // 7508 "Anel da Allysia" exists in latam-items.json but not in item.json.
    const rb = resolveBuild({ class: 4261, gear: { accLeft: 7508 } }, dataset);
    expect(rb.warnings.join(' ')).toMatch(/7508.*Allysia.*não está no banco/);
  });
});

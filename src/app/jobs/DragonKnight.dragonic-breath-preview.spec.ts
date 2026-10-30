import { describe, expect, it } from 'vitest';
import { SKILL_META } from 'src/app/skills';
import { DragonKnight } from './DragonKnight';

/**
 * Dragonic Breath (DK_DRAGONIC_BREATH, 6001) — added on 14/09/2026 as a preview from
 * irowiki (https://irowiki.org/wiki/Dragonic_Breath), and a LATAM skill since the
 * 28/10/2026 client, which ships its pt-BR name, its description and its delay row.
 * The client's per-level table is what the ratio test below checks; the HP/SP/POW terms
 * are still irowiki's, because the client names them without numbers.
 */

const skillOf = (dk: DragonKnight) => dk.atkSkills.find((s) => s.name === 'Dragonic Breath');

function formula(level: number, opts: { aura?: boolean } = {}) {
  const dk: any = new DragonKnight();
  const activeIds = dk.activeSkills.map((a: any) => (a.name === 'Dragonic Aura' && opts.aura ? 10 : 0));
  dk.setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: dk.passiveSkills.map(() => 0) }).getSkillBonusAndName();

  return skillOf(dk).formula({
    model: { level: 250 },
    skillLevel: level,
    maxHp: 400_000,
    maxSp: 16_000,
    status: { totalPow: 120 },
  } as any);
}

describe('Dragonic Breath (preview)', () => {
  it('is on the Dragon Knight with every level and the iRO cast times', () => {
    const skill = skillOf(new DragonKnight());
    expect(skill.levelList.map((l) => l.value)).toEqual(Array.from({ length: 10 }, (_, i) => `Dragonic Breath==${i + 1}`));
    expect(skill.levelList.every((l) => l.label.startsWith('Dragonic Breath'))).toBe(true);
    expect([skill.fct, skill.vct, skill.acd, skill.cd]).toEqual([0.5, 2, 0.15, 0.5]);
    expect([skill.isIgnoreDef, skill.isIgnoreSDef]).toEqual([true, true]);
  });

  it('carries the client pt-BR name and description, not an invented one', () => {
    const meta = SKILL_META['Dragonic Breath'];
    expect(meta.id).toBe(6001);
    expect(meta.label).toBe('Baforada Draconiana');
    expect(meta.description).toContain('Baforada Draconiana');
  });

  it('takes every base percentage from the client table', () => {
    // The client prints one "[Nv n]: X%" line per level; Nv2 is where irowiki was wrong.
    const table = [...SKILL_META['Dragonic Breath'].description.matchAll(/\[Nv (\d+)\]: \^[0-9a-f]{6}([\d.]+)%/g)];
    expect(table).toHaveLength(10);
    for (const [, level, percent] of table) {
      const base = Number(percent.replace('.', ''));
      // The formula adds the HP/SP and POW terms on top, so strip them back out.
      expect(formula(Number(level)) / 2.5 - (2700 * Number(level) + 840)).toBeCloseTo(base, 6);
    }
  });

  it('follows the irowiki ratio, outside and inside the Aura Draconiana state', () => {
    // Nv 10: (3550 + (400000 × 0,00625 + 16000 × 0,0125) × 10 + 7 × 120) × 250 ÷ 100
    expect(formula(10)).toBeCloseTo((3550 + (2500 + 200) * 10 + 840) * 2.5, 6);
    // with the Aura: 0,00875 and 0,0175
    expect(formula(10, { aura: true })).toBeCloseTo((3550 + (3500 + 280) * 10 + 840) * 2.5, 6);
    // Nv 1 takes the first base value
    expect(formula(1)).toBeCloseTo((400 + 2700 + 840) * 2.5, 6);
    // Nv 2 is the client's 750, not irowiki's 700
    expect(formula(2)).toBeCloseTo((750 + 2700 * 2 + 840) * 2.5, 6);
  });
});

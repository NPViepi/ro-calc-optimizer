import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from './_character-base.abstract';
import { ArchMage } from './ArchMage';

/**
 * Colisão Astral (Astral Strike, 5230) — card uNxr9odhRfpodrfPFvJA, "Faltam algumas
 * skills de dano do magus".
 *
 * The skill sat commented out in ArchMage.ts with a draft formula. Two sources agree on
 * what it should be and they are both pinned here.
 *
 * The client's own table has two damage columns, `ATQM` and `ATQM (Bônus)`: 500% and
 * 1.100% per level, the second one against Morto-vivo and Dragão. bROWiki prints the same
 * table with a third column for the meteors, at 200% per level per fall, and adds the
 * detail the client leaves out — the meteors fall every 0,3 s for 15 seconds.
 *
 * What is *not* pinned by a source is that 15 s figure: only the wiki carries it. If it
 * turns out to be shorter, the meteor count is what changes, and this spec with it.
 *
 * @see https://browiki.org/wiki/Colis%C3%A3o_Astral
 */

const found = new ArchMage().atkSkills.find((entry) => entry.name === 'Astral Strike');
expect(found, 'Astral Strike is missing from the ArchMage catalog').toBeDefined();
const skill = (): AtkSkillModel => found!;

/** The formula inputs these two parts actually read. */
const input = (over: { skillLevel: number; totalSpl?: number; baseLevel?: number; undeadOrDragon?: boolean }) =>
  ({
    model: { level: over.baseLevel ?? 100 },
    skillLevel: over.skillLevel,
    status: { totalSpl: over.totalSpl ?? 0 },
    monster: { isRace: (...races: string[]) => !!over.undeadOrDragon && races.includes('undead') },
  }) as any;

describe('Colisão Astral', () => {
  it('keeps the client cast, delay and recarga', () => {
    // skill-delay.json row 5230: fct 1500, vct 4000, acd 500, cd 6000 (ms).
    expect(skill()).toMatchObject({ fct: 1.5, vct: 4, acd: 0.5, cd: 6, isMatk: true });
  });

  it('offers every level the client caps it at', () => {
    expect(skill().levelList).toHaveLength(10);
    expect(skill().value).toBe('Astral Strike==10');
  });

  describe('asteroide', () => {
    it.each([
      [1, 500], [2, 1000], [5, 2500], [10, 5000],
    ])('hits for the client ATQM column at Nv %i', (level, expected) => {
      expect(skill().formula(input({ skillLevel: level }))).toBe(expected);
    });

    it.each([
      [1, 1100], [2, 2200], [5, 5500], [10, 11000],
    ])('hits for the ATQM (Bônus) column against Morto-vivo and Dragão at Nv %i', (level, expected) => {
      expect(skill().formula(input({ skillLevel: level, undeadOrDragon: true }))).toBe(expected);
    });

    it('adds 10 x FEI and scales by base level', () => {
      // Nv10 on a level 200 character with 150 de FEI: (5.000 + 1.500) x 2.
      expect(skill().formula(input({ skillLevel: 10, totalSpl: 150, baseLevel: 200 }))).toBe(13000);
    });
  });

  describe('meteoritos', () => {
    it('falls 50 times — one every 0,3 s while the passage is open for 15 s', () => {
      expect(skill().part2).toMatchObject({ label: 'Meteoritos', damageRepeat: 50, isMatk: true, isIncludeMain: false });
    });

    it.each([
      [1, 200], [5, 1000], [10, 2000],
    ])('hits for the wiki meteor column at Nv %i', (level, expected) => {
      expect(skill().part2!.formula(input({ skillLevel: level }))).toBe(expected);
    });

    it('gets no race bonus — that one is the asteroid\'s alone', () => {
      expect(skill().part2!.formula(input({ skillLevel: 10, undeadOrDragon: true })))
        .toBe(skill().part2!.formula(input({ skillLevel: 10 })));
    });

    it('adds 10 x FEI per fall and scales by base level', () => {
      expect(skill().part2!.formula(input({ skillLevel: 10, totalSpl: 150, baseLevel: 200 }))).toBe(7000);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { ElementType } from '../constants';
import { AtkSkillModel } from './_character-base.abstract';
import { SpiritHandler } from './SpiritHandler';

/**
 * Spirit Handler (Guia Espiritual) 4th-job attack-skill validation.
 *
 * Ground truth: the LATAM 2nd-version skill tables published by Sigma the Fallen,
 *   https://sigmathefallen.blogspot.com/2025/02/spirit-handler-2nd-version.html
 * LATAM ships the 2nd version of the Expanded 4th-class rebalance, which is what the
 * `[V2]` labels in SpiritHandler.ts mark. No replay exists for this class yet, so these
 * assertions encode the published formulas rather than observed damage packets.
 *
 * Every attack skill has an "enhanced" branch that fires when the matching passive is
 * learned — Commune with Chulho for the three physical claw skills, Commune with Hyunrok
 * for the two magic skills — raising the base/per-level/mastery coefficients. Both
 * branches are pinned. The Mystical Creature Mastery passive adds a flat coefficient
 * term (NOT multiplied by skill level).
 *
 * Assertions lock the skill *ratio*, floored, because the server int-casts the
 * coefficient — deliberately plain Math.floor, not the repo's float helper.
 */

const BASE_LEVEL = 250;
const TOTAL_POW = 100;
const TOTAL_SPL = 100;
const MCM = 10; // Mystical Creature Mastery
const SKILL_LV = 7; // every Spirit Handler attack skill maxes at Lv7

type Learned = [string, number][];

const stubBonuses = (learned: Learned, used: Learned = []) =>
  ({
    activeSkillNames: new Set<string>(),
    equipAtks: {},
    masteryAtks: {},
    learnedSkillMap: new Map<string, number>(learned),
    usedSkillMap: new Map<string, number>(used),
  } as any);

const sh = (learned: Learned, used: Learned = []): SpiritHandler => {
  const c = new SpiritHandler();
  (c as any).bonuses = stubBonuses(learned, used);
  return c;
};

const findSkill = (char: SpiritHandler, name: string): AtkSkillModel => {
  const skill = char.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`atk skill not found: ${name}`);
  return skill;
};

const ratioOf = (char: SpiritHandler, name: string) =>
  Math.floor(
    findSkill(char, name).formula({
      model: { level: BASE_LEVEL },
      skillLevel: SKILL_LV,
      status: { totalPow: TOTAL_POW, totalSpl: TOTAL_SPL },
    } as any),
  );

// (base + skillLv * perLv + MCM * mcmPerLv + stat * statMul) * baseLv/100
const phys = (base: number, perLv: number, mcmPerLv: number, powMul: number) =>
  Math.floor((base + SKILL_LV * perLv + MCM * mcmPerLv + TOTAL_POW * powMul) * (BASE_LEVEL / 100));
const mag = (base: number, perLv: number, mcmPerLv: number, splMul: number) =>
  Math.floor((base + SKILL_LV * perLv + MCM * mcmPerLv + TOTAL_SPL * splMul) * (BASE_LEVEL / 100));

const MCM_ONLY: Learned = [['Mystical Creature Mastery', MCM]];
const withChulho: Learned = [['Commune with Chulho', 1], ['Mystical Creature Mastery', MCM]];
const withHyunrok: Learned = [['Commune with Hyunrok', 1], ['Mystical Creature Mastery', MCM]];

describe('Spirit Handler physical claws @ base 250, POW 100, Mystical Creature Mastery 10', () => {
  describe('without Commune with Chulho', () => {
    it('Chulho Sonic Claw Lv7 matches the published formula', () => {
      // (400 + SkillLv x 750 + MCM x 50 + POW x 5) x baseLv/100
      expect(ratioOf(sh(MCM_ONLY), 'Chulho Sonic Claw')).toBe(phys(400, 750, 50, 5));
    });
    it('Howling of Chulho Lv7 matches the published formula', () => {
      // (600 + SkillLv x 1050 + MCM x 50 + POW x 5) x baseLv/100
      expect(ratioOf(sh(MCM_ONLY), 'Howling of Chulho')).toBe(phys(600, 1050, 50, 5));
    });
    it('Hogogong Strike Lv7 matches the published per-hit formula', () => {
      // (180 + SkillLv x 200 + MCM x 10 + POW x 5) x baseLv/100
      expect(ratioOf(sh(MCM_ONLY), 'Hogogong Strike')).toBe(phys(180, 200, 10, 5));
    });
  });

  describe('with Commune with Chulho (enhanced)', () => {
    it('Chulho Sonic Claw Lv7 uses the enhanced coefficients', () => {
      // (500 + SkillLv x 850 + MCM x 100 + POW x 5) x baseLv/100
      expect(ratioOf(sh(withChulho), 'Chulho Sonic Claw')).toBe(phys(500, 850, 100, 5));
    });
    it('Howling of Chulho Lv7 uses the enhanced coefficients', () => {
      // (700 + SkillLv x 1150 + MCM x 100 + POW x 5) x baseLv/100
      expect(ratioOf(sh(withChulho), 'Howling of Chulho')).toBe(phys(700, 1150, 100, 5));
    });
    it('Hogogong Strike Lv7 uses the enhanced coefficients', () => {
      // (250 + SkillLv x 350 + MCM x 20 + POW x 5) x baseLv/100
      expect(ratioOf(sh(withChulho), 'Hogogong Strike')).toBe(phys(250, 350, 20, 5));
    });
    it('enhanced Commune damage strictly exceeds the base branch', () => {
      for (const name of ['Chulho Sonic Claw', 'Howling of Chulho', 'Hogogong Strike']) {
        expect(ratioOf(sh(withChulho), name)).toBeGreaterThan(ratioOf(sh(MCM_ONLY), name));
      }
    });
  });
});

describe('Spirit Handler Hyunrok magic @ base 250, SPL 100, Mystical Creature Mastery 10', () => {
  describe('without Commune with Hyunrok', () => {
    it('Hyunrok Breeze Lv7 matches the published per-hit formula', () => {
      // (600 + SkillLv x 600 + MCM x 20 + SPL x 5) x baseLv/100
      expect(ratioOf(sh(MCM_ONLY), 'Hyunrok Breeze')).toBe(mag(600, 600, 20, 5));
    });
    it('Hyunrok Cannon Lv7 matches the published formula', () => {
      // (700 + SkillLv x 950 + MCM x 50 + SPL x 5) x baseLv/100
      expect(ratioOf(sh(MCM_ONLY), 'Hyunrok Cannon')).toBe(mag(700, 950, 50, 5));
    });
  });

  describe('with Commune with Hyunrok (enhanced)', () => {
    it('Hyunrok Breeze Lv7 uses the enhanced coefficients', () => {
      // (700 + SkillLv x 800 + MCM x 40 + SPL x 5) x baseLv/100
      expect(ratioOf(sh(withHyunrok), 'Hyunrok Breeze')).toBe(mag(700, 800, 40, 5));
    });
    it('Hyunrok Cannon Lv7 uses the enhanced coefficients', () => {
      // (800 + SkillLv x 1100 + MCM x 75 + SPL x 5) x baseLv/100
      expect(ratioOf(sh(withHyunrok), 'Hyunrok Cannon')).toBe(mag(800, 1100, 75, 5));
    });
  });

  it('the Hyunrok skills are magic and the Chulho claws are physical', () => {
    for (const name of ['Hyunrok Breeze', 'Hyunrok Cannon']) {
      expect(findSkill(sh(MCM_ONLY), name).isMatk, `${name} should be MATK`).toBe(true);
    }
    for (const name of ['Chulho Sonic Claw', 'Howling of Chulho', 'Hogogong Strike']) {
      expect(findSkill(sh(MCM_ONLY), name).isMatk, `${name} should be physical`).toBeFalsy();
    }
  });

  it('Hyunrok damage takes the element chosen by Colors of Hyunrok', () => {
    // Colors of Hyunrok: 1 Water, 4 Fire, 7 Neutral; unset -> Neutral.
    const water = findSkill(sh(MCM_ONLY, [['Colors of Hynrok', 1]]), 'Hyunrok Breeze');
    const fire = findSkill(sh(MCM_ONLY, [['Colors of Hynrok', 4]]), 'Hyunrok Cannon');
    const unset = findSkill(sh(MCM_ONLY), 'Hyunrok Breeze');
    expect(water.getElement!()).toBe(ElementType.Water);
    expect(fire.getElement!()).toBe(ElementType.Fire);
    expect(unset.getElement!()).toBe(ElementType.Neutral);
  });
});

describe('Spirit Handler hit counts (2nd version)', () => {
  it('Chulho Sonic Claw is one hit shown as two', () => {
    expect(findSkill(sh(MCM_ONLY), 'Chulho Sonic Claw').hit).toBe(2);
  });

  it('Hogogong Strike deals three hits', () => {
    expect(findSkill(sh(MCM_ONLY), 'Hogogong Strike').hit).toBe(3);
  });

  it('Hyunrok Breeze deals its field damage over 16 continuous hits', () => {
    expect(findSkill(sh(MCM_ONLY), 'Hyunrok Breeze').totalHit).toBe(16);
  });
});

describe('Spirit Handler cast/cooldown metadata', () => {
  // Published as "variable cast / fixed cast | cooldown | global cooldown"; the model
  // stores vct = variable, fct = fixed, cd = cooldown, acd = after-cast delay, all in
  // seconds. Level-dependent values are pinned at Lv7 (Chulho Sonic Claw's cooldown is
  // 1.3 - Lv x 0.15 -> 0.25 at Lv7).
  //
  // First written from the "2nd version" blog tables; Hogogong Strike's cooldown and
  // Hyunrok Cannon's after-cast delay disagreed with the client and now follow it.
  // The authority is skills/skill-delay.spec.ts.
  const cases: { name: string; acd: number; vct: number; fct: number; cd: number }[] = [
    { name: 'Chulho Sonic Claw', acd: 0.5, vct: 0, fct: 0, cd: 0.25 },
    { name: 'Howling of Chulho', acd: 0, vct: 0, fct: 1, cd: 1 },
    { name: 'Hogogong Strike', acd: 0, vct: 0, fct: 1, cd: 0.35 },
    { name: 'Hyunrok Breeze', acd: 0.5, vct: 3, fct: 1.5, cd: 4.5 },
    { name: 'Hyunrok Cannon', acd: 0, vct: 2, fct: 1.5, cd: 0.3 },
  ];

  it.each(cases)('$name has acd $acd, vct $vct, fct $fct, cd $cd', ({ name, acd, vct, fct, cd }) => {
    const skill = findSkill(sh(MCM_ONLY), name);
    expect({ acd: skill.acd, vct: skill.vct, fct: skill.fct, cd: skill.cd }).toEqual({ acd, vct, fct, cd });
  });
});

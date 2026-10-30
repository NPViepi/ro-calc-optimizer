import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from './_character-base.abstract';
import { NightWatch } from './NightWatch';

/**
 * Night Watch (Guerrilheiro) 4th-job attack-skill validation.
 *
 * Ground truth: the pt-BR **client** skill descriptions (skill-meta.generated.ts),
 * cross-checked against five LATAM replays — see NightWatch.replay.spec.ts, which
 * validates the same coefficients end-to-end against real damage packets.
 *
 * These tables used to come from Sigma the Fallen's "Night Watch (2nd version)" blog
 * post. The replays showed that post to be stale for six of the seven attack skills
 * (only The Vigilante at Night matched), so the `[V2]` labels are gone and the numbers
 * below are the client's. Each client row is linear in the skill level, which is why
 * they collapse to `base + perLv x Lv + aim x aimPerLv x Lv`.
 *
 * Night Watch is the most weapon-sensitive job in the calc: nearly every skill
 * branches on the gun subtype (Gatling Gun / Shotgun / Rifle / Revolver / Grenade
 * Launcher), changing both the coefficient and the hit count. The gun tree also
 * scales with the Aiming Count stack built by Intensive Aim (max 10), held in the
 * private state-only skill `_NightWatch_Aiming Count`; the grenade tree scales with
 * the Grenade Mastery passive instead and ignores aiming entirely.
 *
 * Assertions lock the skill *ratio* (%ATK), floored, because the server int-casts
 * the coefficient — deliberately plain Math.floor, not the repo's float helper.
 */

const BASE_LEVEL = 250;
const TOTAL_CON = 100;
const GRENADE_MASTERY = 10;
const AIM = 10; // Intensive Aim caps the aiming count at 10

type GunSubType = 'Gatling Gun' | 'Shotgun' | 'Rifle' | 'Revolver' | 'Grenade Launcher';

const stubBonuses = (aiming: number) =>
  ({
    activeSkillNames: new Set<string>(),
    equipAtks: {},
    masteryAtks: {},
    learnedSkillMap: new Map<string, number>([['Grenade Mastery', GRENADE_MASTERY]]),
    usedSkillMap: new Map<string, number>([['_NightWatch_Aiming Count', aiming]]),
  } as any);

const nw = (aiming = AIM): NightWatch => {
  const c = new NightWatch();
  (c as any).bonuses = stubBonuses(aiming);
  return c;
};

const findSkill = (char: NightWatch, name: string): AtkSkillModel => {
  const skill = char.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`atk skill not found: ${name}`);
  return skill;
};

// A weapon whose isSubType() answers true only for the given gun subtype.
const gun = (subType: GunSubType) => ({
  isSubType: (...s: string[]) => s.includes(subType),
  isType: (...t: string[]) => t.includes('gun'),
  data: {},
});

const ratioOf = (char: NightWatch, name: string, skillLevel: number, subType: GunSubType) =>
  Math.floor(
    findSkill(char, name).formula({
      model: { level: BASE_LEVEL },
      skillLevel,
      status: { totalCon: TOTAL_CON },
      weapon: gun(subType),
    } as any),
  );

const hitsOf = (char: NightWatch, name: string, subType: GunSubType) => {
  const { totalHit } = findSkill(char, name);
  return typeof totalHit === 'function' ? (totalHit as any)({ weapon: gun(subType) }) : totalHit;
};

// (base + skillLv * (perLv + aim * aimPerLv) + CON * conMul) * baseLv/100
const gunRatio = (base: number, perLv: number, aimPerLv: number, conMul: number, skillLevel: number, aiming = AIM) =>
  Math.floor((base + skillLevel * (perLv + aiming * aimPerLv) + TOTAL_CON * conMul) * (BASE_LEVEL / 100));

describe('Night Watch gun ratios @ base 250, CON 100, aiming count 10', () => {
  describe('The Vigilante at Night (id 5405)', () => {
    // Gatling: ((SkillLv x (300 + aim x 100)) + CON x 2) x baseLv/100 — no flat base
    it('Lv5 with a Gatling Gun matches the published formula', () => {
      expect(ratioOf(nw(), 'The Vigilante at Night', 5, 'Gatling Gun')).toBe(gunRatio(0, 300, 100, 2, 5));
    });

    // Shotgun: (800 + (SkillLv x (700 + aim x 200)) + CON x 3) x baseLv/100
    it('Lv5 with a Shotgun matches the published formula (CON x 3, not x 5)', () => {
      expect(ratioOf(nw(), 'The Vigilante at Night', 5, 'Shotgun')).toBe(gunRatio(800, 700, 200, 3, 5));
    });

    it('hits 7 times with a Gatling Gun and 4 with a Shotgun', () => {
      expect(hitsOf(nw(), 'The Vigilante at Night', 'Gatling Gun')).toBe(7);
      expect(hitsOf(nw(), 'The Vigilante at Night', 'Shotgun')).toBe(4);
    });

    it('scales with the aiming count', () => {
      expect(ratioOf(nw(0), 'The Vigilante at Night', 5, 'Shotgun')).toBe(gunRatio(800, 700, 200, 3, 5, 0));
      expect(ratioOf(nw(10), 'The Vigilante at Night', 5, 'Shotgun')).toBeGreaterThan(
        ratioOf(nw(0), 'The Vigilante at Night', 5, 'Shotgun'),
      );
    });
  });

  describe('Only One Bullet (id 5406)', () => {
    // Rifle:   ( 500 + (SkillLv x ( 850 + aim x 250)) + CON x 3) x baseLv/100  (client Lv1 1350 -> Lv5 4750)
    // Handgun: (1500 + (SkillLv x (1000 + aim x 250)) + CON x 3) x baseLv/100  (client Lv1 2500 -> Lv5 6500)
    it('Lv5 with a Rifle matches the published formula', () => {
      expect(ratioOf(nw(), 'Only One Bullet', 5, 'Rifle')).toBe(gunRatio(500, 850, 250, 3, 5));
    });

    it('Lv5 with a Revolver (handgun) matches the published formula', () => {
      expect(ratioOf(nw(), 'Only One Bullet', 5, 'Revolver')).toBe(gunRatio(1500, 1000, 250, 3, 5));
    });
  });

  describe('Spiral Shooting (id 5407)', () => {
    // Grenade Launcher: (1000 + (SkillLv x (1000 + aim x 150)) + CON x 3), 2 hits  (client Lv1 2000 -> Lv5 6000)
    // Rifle:            ( 400 + (SkillLv x ( 900 + aim x 150)) + CON x 3), 1 hit   (client Lv1 1300 -> Lv5 4900)
    it('Lv5 with a Grenade Launcher matches the published formula', () => {
      expect(ratioOf(nw(), 'Spiral Shooting', 5, 'Grenade Launcher')).toBe(gunRatio(1000, 1000, 150, 3, 5));
    });

    it('Lv5 with a Rifle matches the published formula', () => {
      expect(ratioOf(nw(), 'Spiral Shooting', 5, 'Rifle')).toBe(gunRatio(400, 900, 150, 3, 5));
    });

    it('hits twice with a Grenade Launcher and once with a Rifle', () => {
      expect(hitsOf(nw(), 'Spiral Shooting', 'Grenade Launcher')).toBe(2);
      expect(hitsOf(nw(), 'Spiral Shooting', 'Rifle')).toBe(1);
    });
  });

  describe('Magazine for One (id 5408)', () => {
    // Gatling: (200 + (SkillLv x (300 + aim x 50)) + CON x 2), 10 hits  (client Lv1 500 -> Lv5 1700)
    // Handgun: (100 + (SkillLv x (400 + aim x 50)) + CON x 2),  6 hits  (client Lv1 500 -> Lv5 2100)
    it('Lv5 with a Gatling Gun matches the published formula', () => {
      expect(ratioOf(nw(), 'Magazine for One', 5, 'Gatling Gun')).toBe(gunRatio(200, 300, 50, 2, 5));
    });

    it('Lv5 with a Revolver (handgun) matches the published formula', () => {
      expect(ratioOf(nw(), 'Magazine for One', 5, 'Revolver')).toBe(gunRatio(100, 400, 50, 2, 5));
    });

    it('hits 10 times with a Gatling Gun and 6 with a handgun', () => {
      expect(hitsOf(nw(), 'Magazine for One', 'Gatling Gun')).toBe(10);
      expect(hitsOf(nw(), 'Magazine for One', 'Revolver')).toBe(6);
    });
  });

  describe('Wild Fire (id 5409)', () => {
    // Shotgun:          (500 + (SkillLv x (1500 + aim x 500)) + CON x 3)  (client Lv1 2000 -> Lv5 8000)
    // Grenade Launcher: (500 + (SkillLv x (1300 + aim x 500)) + CON x 3)  (client Lv1 1800 -> Lv5 7000)
    it('Lv5 with a Shotgun matches the published formula', () => {
      expect(ratioOf(nw(), 'Wild Fire', 5, 'Shotgun')).toBe(gunRatio(500, 1500, 500, 3, 5));
    });

    it('Lv5 with a Grenade Launcher matches the published formula', () => {
      expect(ratioOf(nw(), 'Wild Fire', 5, 'Grenade Launcher')).toBe(gunRatio(500, 1300, 500, 3, 5));
    });
  });
});

describe('Night Watch grenade ratios @ base 250, CON 100, Grenade Mastery 10', () => {
  // The grenade tree ignores the aiming count entirely.
  const grenade = (base: number, perLv: number, masteryMul: number, conMul: number, skillLevel: number) =>
    Math.floor(
      (base + skillLevel * perLv + GRENADE_MASTERY * masteryMul + TOTAL_CON * conMul) * (BASE_LEVEL / 100),
    );

  it('Basic Grenade Lv5 matches the published formula', () => {
    // (1000 + (SkillLv x 900) + (Grenade Mastery x 50) + CON x 5) x baseLv/100  (client Lv1 1900 -> Lv5 5500)
    expect(ratioOf(nw(), 'Basic Grenade', 5, 'Grenade Launcher')).toBe(grenade(1000, 900, 50, 5, 5));
  });

  it('Hasty Fire in the Hole Lv5 matches the published per-hit formula', () => {
    // (1500 + (SkillLv x 900) + (Grenade Mastery x 20) + CON x 3) x baseLv/100  (client Lv1 2400 -> Lv5 6000)
    expect(ratioOf(nw(), 'Hasty Fire in the Hole', 5, 'Grenade Launcher')).toBe(grenade(1500, 900, 20, 3, 5));
  });

  it('is unaffected by the aiming count', () => {
    for (const name of ['Basic Grenade', 'Hasty Fire in the Hole']) {
      expect(ratioOf(nw(0), name, 5, 'Grenade Launcher')).toBe(ratioOf(nw(10), name, 5, 'Grenade Launcher'));
    }
  });

  it('Hasty Fire in the Hole lands 3 hits', () => {
    expect(hitsOf(nw(), 'Hasty Fire in the Hole', 'Grenade Launcher')).toBe(3);
  });
});

describe('Night Watch cast/cooldown metadata', () => {
  // Published as "cast | cooldown"; the model stores vct = variable, fct = fixed,
  // cd = cooldown, all in seconds. Every Night Watch skill is fixed-cast only.
  //
  // First written from the "2nd version" blog tables; only Magazine for One's cooldown
  // disagreed with the client and now follows it (0.75s, not 0.5s). The authority is
  // skills/skill-delay.spec.ts.
  const cases: { name: string; vct: number; fct: number; cd: number }[] = [
    { name: 'The Vigilante at Night', vct: 0, fct: 1.5, cd: 0.5 },
    { name: 'Only One Bullet', vct: 0, fct: 1, cd: 0.3 },
    { name: 'Spiral Shooting', vct: 0, fct: 1.5, cd: 0.5 },
    { name: 'Magazine for One', vct: 0, fct: 1, cd: 0.5 },
    { name: 'Wild Fire', vct: 0, fct: 1, cd: 0.5 },
    { name: 'Basic Grenade', vct: 0, fct: 1, cd: 0.3 },
    { name: 'Hasty Fire in the Hole', vct: 0, fct: 1, cd: 1 },
  ];

  it.each(cases)('$name has vct $vct, fct $fct, cd $cd', ({ name, vct, fct, cd }) => {
    const skill = findSkill(nw(), name);
    expect({ vct: skill.vct, fct: skill.fct, cd: skill.cd }).toEqual({ vct, fct, cd });
  });
});

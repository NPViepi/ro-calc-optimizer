import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from './_character-base.abstract';
import { Shinkiro } from './Shinkiro';
import { Shiranui } from './Shiranui';

/**
 * Shinkiro / Shiranui 4th-job attack-skill validation.
 *
 * Ground truth: the LATAM 2nd-version skill tables published by Sigma the Fallen,
 *   https://sigmathefallen.blogspot.com/2025/02/shinkiro-shiranui-2nd-version.html
 * reached from that blog's "Supplemental Class (2nd version)" selector. LATAM ships
 * the 2nd version of the Expanded 4th-class rebalance, which is what the `[V2]`
 * labels in Shinkiro.ts / Shiranui.ts mark.
 *
 * No replay exists for either class yet — they are only now being surfaced in the UI
 * (the class now ships in the LATAM GRF), so these assertions
 * encode the published formulas rather than observed damage packets.
 *
 * The two are the male/female halves of one job: the blog publishes a single skill
 * table for both, and their `atkSkillList4th` bodies are byte-identical. Every
 * assertion therefore runs against both, and a drift guard at the bottom compares
 * the two definitions field-for-field so the duplicated lists cannot diverge
 * silently (same idea as super-novice-skills.spec.ts).
 *
 * The physical tree is a web of mutual scaling — each skill's coefficient grows
 * with a *sibling* skill's learned level (Shadow Hunting <-> Shadow Dance <->
 * Shadow Flash, Grasp <-> Construct, Distortion <-> Rotation <-> Refraction) — so
 * the fixture pins every one of them. The cannons are magic and scale off Darkening
 * Cannon plus SPL.
 *
 * Assertions lock the skill *ratio*, floored, because the server int-casts the
 * coefficient — deliberately plain Math.floor, not the repo's float helper.
 */

const BASE_LEVEL = 250;
const TOTAL_POW = 100;
const TOTAL_SPL = 100;
// Every cross-skill scaling term is pinned at 10 so a single constant drives them.
const SIBLING_LV = 10;

type Twin = Shinkiro | Shiranui;

const SIBLING_SKILLS = [
  'Shadow Hunting',
  'Shadow Dance',
  'Shadow Flash',
  'Huuma Shuriken - Grasp',
  'Huuma Shuriken - Construct',
  'Kunai - Distortion',
  'Kunai - Rotation',
  'Kunai - Refraction',
  'Darkening Cannon',
];

const stubBonuses = () =>
  ({
    activeSkillNames: new Set<string>(),
    equipAtks: {},
    masteryAtks: {},
    learnedSkillMap: new Map<string, number>(SIBLING_SKILLS.map((s) => [s, SIBLING_LV])),
    usedSkillMap: new Map<string, number>(),
  } as any);

const twins: [string, () => Twin][] = [
  ['Shinkiro', () => new Shinkiro()],
  ['Shiranui', () => new Shiranui()],
];

const build = (make: () => Twin): Twin => {
  const c = make();
  (c as any).bonuses = stubBonuses();
  return c;
};

const findSkill = (char: Twin, name: string): AtkSkillModel => {
  const skill = char.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`atk skill not found: ${name}`);
  return skill;
};

/** A delay field is either a constant or a per-level curve; these read it either way. */
type Delay = AtkSkillModel['cd'];
const at10 = (value: Delay) => (typeof value === 'function' ? value(10) : value);
const curve = (value: Delay) => Array.from({ length: 10 }, (_, i) => (typeof value === 'function' ? value(i + 1) : value));

const ratioOf = (char: Twin, name: string, skillLevel: number) =>
  Math.floor(
    findSkill(char, name).formula({
      model: { level: BASE_LEVEL },
      skillLevel,
      status: { totalPow: TOTAL_POW, totalSpl: TOTAL_SPL },
    } as any),
  );

// (base + skillLv * (perLv + sibling * siblingMul) + stat * statMul) * baseLv/100
const ratio = (base: number, perLv: number, siblingMul: number, statMul: number, skillLevel: number, stat = TOTAL_POW) =>
  Math.floor((base + skillLevel * (perLv + SIBLING_LV * siblingMul) + stat * statMul) * (BASE_LEVEL / 100));

describe.each(twins)('%s atk-skill ratios @ base 250, POW/SPL 100, sibling skills 10', (_name, make) => {
  const char = () => build(make);

  describe('physical tree', () => {
    // [skill, base, perLv, siblingMul, powMul, testedLevel]
    const physical: [string, number, number, number, number, number][] = [
      // (500 + (Lv x (400 + Shadow Flash Lv x 5)) + POW x 3)
      ['Shadow Hunting', 500, 400, 5, 3, 10],
      // (400 + (Lv x (550 + Shadow Hunting Lv x 50)) + POW x 4)
      ['Shadow Dance', 400, 550, 50, 4, 10],
      // (1700 + (Lv x (800 + Shadow Dance Lv x 100)) + POW x 5) — matches the pt-BR
      // client description (ATQ 2.500%..9.700%) and the in-game replay; see
      // Shinkiro.shadow-flash-replay.spec.ts.
      ['Shadow Flash', 1700, 800, 100, 5, 10],
      // (700 + (Lv x (200 + Construct Lv x 5)) + POW x 3) per hit
      ['Huuma Shuriken - Grasp', 700, 200, 5, 3, 10],
      // (300 + (Lv x (600 + Refraction Lv x 10)) + POW x 3)
      ['Kunai - Distortion', 300, 600, 10, 3, 10],
      // (800 + (Lv x (700 + Distortion Lv x 70)) + POW x 4) per hit — max Lv 5
      ['Kunai - Rotation', 800, 700, 70, 4, 5],
      // (200 + (Lv x (360 + Rotation Lv x 10)) + POW x 5) per hit
      ['Kunai - Refraction', 200, 360, 10, 5, 10],
    ];

    it.each(physical)('%s matches the published formula', (name, base, perLv, siblingMul, powMul, lv) => {
      expect(ratioOf(char(), name, lv)).toBe(ratio(base, perLv, siblingMul, powMul, lv));
    });

    it('Huuma Shuriken - Construct sums its primary and secondary coefficients', () => {
      // Primary:   (600 + (Lv x (400 + Grasp Lv x 30)) + POW x 5)
      // Secondary: (800 + (Lv x (600 + Grasp Lv x 30)) + POW x 5)
      const primary = (600 + 10 * (400 + SIBLING_LV * 30) + TOTAL_POW * 5) * (BASE_LEVEL / 100);
      const secondary = (800 + 10 * (600 + SIBLING_LV * 30) + TOTAL_POW * 5) * (BASE_LEVEL / 100);
      expect(ratioOf(char(), 'Huuma Shuriken - Construct', 10)).toBe(Math.floor(primary + secondary));
    });

    it('leaves the physical tree unmarked as magic', () => {
      for (const [name] of physical) {
        expect(findSkill(char(), name).isMatk, `${name} should be physical`).toBeFalsy();
      }
    });
  });

  describe('cannon (magic) tree', () => {
    // [skill, base, perLv, Darkening-scaling, splMul]
    const cannons: [string, number, number, number, number][] = [
      // (850 + (Lv x (1250 + Darkening Lv x 70)) + SPL x 5)
      ['Red Flame Cannon', 850, 1250, 70, 5],
      // (250 + (Lv x (550 + Darkening Lv x 40)) + SPL x 5)
      ['Cold Blooded Cannon', 250, 550, 40, 5],
      // (600 + (Lv x (1300 + Darkening Lv x 70)) + SPL x 5)
      ['Thundering Cannon', 600, 1300, 70, 5],
      // (300 + (Lv x (400 + Darkening Lv x 15)) + SPL x 5)
      ['Golden Dragon Cannon', 300, 400, 15, 5],
      // (450 + (Lv x 950) + SPL x 5) — Darkening itself has no sibling term
      ['Darkening Cannon', 450, 950, 0, 5],
    ];

    it.each(cannons)('%s Lv10 matches the published formula', (name, base, perLv, siblingMul, splMul) => {
      expect(ratioOf(char(), name, 10)).toBe(ratio(base, perLv, siblingMul, splMul, 10, TOTAL_SPL));
    });

    it('marks every cannon as magic', () => {
      for (const [name] of cannons) {
        expect(findSkill(char(), name).isMatk, `${name} should be MATK`).toBe(true);
      }
    });
  });

  describe('hit counts', () => {
    // "N continuous" hits multiply damage -> totalHit. A "(N displays)" note is
    // only the on-screen split -> hit (see _character-base.abstract.ts:499).
    const continuous: [string, number][] = [
      ['Huuma Shuriken - Grasp', 20],
      ['Kunai - Rotation', 4],
      ['Kunai - Refraction', 8],
    ];

    it.each(continuous)('%s lands %i real hits', (name, hits) => {
      expect(findSkill(char(), name).totalHit).toBe(hits);
    });
  });

  describe('cast/cooldown metadata', () => {
    // Published as "variable cast / fixed cast | cooldown"; the model stores
    // vct = variable, fct = fixed, cd = cooldown, all in seconds.
    //
    // These were first written from the "2nd version" blog tables, which disagreed with
    // the client for the whole cannon tree and for Shadow Dance / Shadow Flash. They now
    // carry the client's own numbers; the authority is skills/skill-delay.spec.ts.
    // The client table of 28/10/2026 dropped Shadow Dance's and Shadow Flash's variable
    // cast to zero, so the descending curve they used to carry is gone; these cases pin
    // every skill at its own Lv10.
    const cases: { name: string; vct: number; fct: number; cd: number }[] = [
      { name: 'Shadow Hunting', vct: 0, fct: 0, cd: 0.3 },
      { name: 'Shadow Dance', vct: 0, fct: 0, cd: 0.5 },
      { name: 'Shadow Flash', vct: 0, fct: 0, cd: 0.5 },
      { name: 'Huuma Shuriken - Grasp', vct: 1.2, fct: 1, cd: 1 },
      { name: 'Huuma Shuriken - Construct', vct: 1.2, fct: 1, cd: 1 },
      { name: 'Kunai - Distortion', vct: 0.2, fct: 0, cd: 0.35 },
      { name: 'Kunai - Rotation', vct: 0, fct: 0, cd: 2 },
      { name: 'Kunai - Refraction', vct: 1.5, fct: 0.5, cd: 2 },
      { name: 'Red Flame Cannon', vct: 2, fct: 1, cd: 0.7 },
      { name: 'Cold Blooded Cannon', vct: 3, fct: 1, cd: 0.5 },
      { name: 'Thundering Cannon', vct: 2, fct: 1, cd: 0.7 },
      { name: 'Golden Dragon Cannon', vct: 3, fct: 1, cd: 0.3 },
      { name: 'Darkening Cannon', vct: 3, fct: 1, cd: 0.5 },
    ];

    it.each(cases)('$name has vct $vct, fct $fct, cd $cd', ({ name, vct, fct, cd }) => {
      const skill = findSkill(char(), name);
      expect({ vct: at10(skill.vct), fct: at10(skill.fct), cd: at10(skill.cd) }).toEqual({ vct, fct, cd });
    });
  });
});

describe('Shinkiro and Shiranui share one skill table', () => {
  // The blog publishes a single table for the pair and the two job files duplicate
  // it verbatim. Compare the 4th-job entries field-for-field so an edit to one is
  // never silently left out of the other.
  const fourthJobSkillsOf = (char: Twin) =>
    char.atkSkills.filter((s) => s.label?.startsWith('[V2]')).map((s) => ({
      name: s.name,
      value: s.value,
      // Delays that follow the client's per-level curve are functions, and two instances
      // build two distinct closures — compare the curve they produce, not the closure.
      acd: curve(s.acd),
      fct: curve(s.fct),
      vct: curve(s.vct),
      cd: curve(s.cd),
      hit: s.hit,
      totalHit: typeof s.totalHit === 'function' ? 'fn' : s.totalHit,
      isMatk: s.isMatk,
      element: s.element,
      // ratios are compared through the formulas, evaluated identically below
      ratio: Math.floor(
        s.formula({
          model: { level: BASE_LEVEL },
          skillLevel: 5,
          status: { totalPow: TOTAL_POW, totalSpl: TOTAL_SPL },
        } as any),
      ),
    }));

  it('exposes the same 4th-job atk skills with identical stats and ratios', () => {
    const shinkiro = fourthJobSkillsOf(build(() => new Shinkiro()));
    const shiranui = fourthJobSkillsOf(build(() => new Shiranui()));

    expect(shinkiro.length).toBeGreaterThan(0);
    expect(shiranui).toEqual(shinkiro);
  });
});

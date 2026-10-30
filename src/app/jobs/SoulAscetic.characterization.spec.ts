import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from './_character-base.abstract';
import { SoulAscetic } from './SoulAscetic';

/**
 * Soul Ascetic (Asceta das Almas) 4th-job attack-skill validation.
 *
 * Ground truth: the client's own per-level tables, in `SKILL_META[...].description`.
 *
 * This spec used to encode the "2nd version" tables published by Sigma the Fallen, on the
 * reasoning that LATAM ships that rebalance. It does not match: the blog puts Talismã do
 * Dragão Lv1 at `250 + 1.450` where the client's row says `900`, and
 * `SoulAscetic.exorcismo-replay.spec.ts` sides with the client — the five Lv1 talisman
 * casts in that recording put the Dragão ratio at 3.216-3.743 against the 4.961 the blog's
 * table produced. Every damage column below is now the client's. See
 * [[sigma-v2-vs-client-tables]], which is the same trap the Guarda Noturno tree fell into.
 *
 * The second column of each client table is the **[Mandala das Feras]** state, not Talismã
 * dos Elementos — the calc had the enhanced branch gated on the wrong buff. Talismã dos
 * Elementos is only "+4% de dano contra as propriedades Água, Vento, Terra, Fogo e Neutro",
 * which is modelled as an element bonus and never touches a ratio.
 *
 * Every skill here is magic (isMatk). Exorcism of Malicious Soul instead scales with the
 * soul gauge and is enhanced by Totem of Tutelary (or the target's Assombração, not
 * modelled); both of its branches are confirmed to the unit by the replay.
 *
 * Assertions lock the skill *ratio* (%MATK), floored, because the server int-casts the
 * coefficient — deliberately plain Math.floor, not the repo's float helper.
 */

const BASE_LEVEL = 250;
const TOTAL_SPL = 100;
const TALISMAN_MASTERY = 10;
const SOUL_MASTERY = 10;

/** The chain Dragão → Tigre → Fênix → Jabuti, i.e. Leste → Oeste → Sul → Norte. */
const BLESSING = { BlueDragon: 1, WhiteTiger: 2, RedPhoenix: 3, BlackTortoise: 4, AllFour: 5 } as const;

const stubBonuses = (opts: { active?: string[]; used?: Record<string, number> } = {}) =>
  ({
    activeSkillNames: new Set<string>(opts.active ?? []),
    equipAtks: {},
    masteryAtks: {},
    learnedSkillMap: new Map<string, number>([
      ['Talisman Mastery', TALISMAN_MASTERY],
      ['Soul Mastery', SOUL_MASTERY],
    ]),
    usedSkillMap: new Map<string, number>(Object.entries(opts.used ?? {})),
  } as any);

const soul = (opts: { active?: string[]; used?: Record<string, number> } = {}): SoulAscetic => {
  const c = new SoulAscetic();
  (c as any).bonuses = stubBonuses(opts);
  return c;
};

const findSkill = (char: SoulAscetic, name: string): AtkSkillModel => {
  const skill = char.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`atk skill not found: ${name}`);
  return skill;
};

const ratioOf = (char: SoulAscetic, name: string, skillLevel: number) =>
  Math.floor(
    findSkill(char, name).formula({
      model: { level: BASE_LEVEL },
      skillLevel,
      status: { totalSpl: TOTAL_SPL },
    } as any),
  );

/**
 * `(flat + perLv × Lv + Perícia com Talismãs × 15 × Lv + FEI × 5) × NívelBase/100`.
 *
 * The FEI leg is the one term the client never states. `× 5` is the blog's figure, kept
 * deliberately: the replay bounds it at FEI × 5,5..6,2 for a Lv1 talisman, which is close
 * but probably low, and five single casts through a rolling weapon MATK cannot do better.
 * A bare-handed recording settles it — see the note on `talismanTail` in SoulAscetic.ts.
 */
const talisman = (flat: number, perLv: number, skillLevel: number) =>
  Math.floor(
    (flat + perLv * skillLevel + TALISMAN_MASTERY * 15 * skillLevel + TOTAL_SPL * 5) * (BASE_LEVEL / 100),
  );

/** Talismã do Ceifeiro and Mandala das Feras read "Nv. de Perícia e Maestria" instead. */
const bothMasteries = (flat: number, perLv: number, per: number, skillLevel: number) =>
  Math.floor(
    (flat + perLv * skillLevel + (TALISMAN_MASTERY + SOUL_MASTERY) * per * skillLevel + TOTAL_SPL * 5) *
      (BASE_LEVEL / 100),
  );

const MANDALA = '_SoulAscetic_Mandala';
const FIVE_ELEMENTS = 'Talisman of Five Elements';

describe('Soul Ascetic talisman ratios @ base 250, SPL 100, Talisman Mastery 10', () => {
  // Each entry: [skill, plain flat, plain perLv, Mandala flat, Mandala perLv]
  const talismans: [string, number, number, number, number][] = [
    ['Talisman of Blue Dragon', 0, 900, 0, 1350],
    ['Talisman of White Tiger', 0, 700, 0, 1000],
    ['Talisman of Red Phoenix', 1500, 600, 2000, 900],
    ['Talisman of Black Tortoise', 2000, 900, 2000, 1350],
  ];

  describe.each(talismans)('%s', (name, flat, perLv, mandalaFlat, mandalaPerLv) => {
    it('Lv5 outside [Mandala das Feras] uses the plain column', () => {
      expect(ratioOf(soul(), name, 5)).toBe(talisman(flat, perLv, 5));
    });

    it('Lv5 inside [Mandala das Feras] uses the second column', () => {
      expect(ratioOf(soul({ active: [MANDALA] }), name, 5)).toBe(talisman(mandalaFlat, mandalaPerLv, 5));
    });

    it('the Mandala column is a strict upgrade', () => {
      expect(ratioOf(soul({ active: [MANDALA] }), name, 5)).toBeGreaterThan(ratioOf(soul(), name, 5));
    });

    it('Lv1 scales down correctly on the plain column', () => {
      expect(ratioOf(soul(), name, 1)).toBe(talisman(flat, perLv, 1));
    });

    // The bug this spec used to enshrine: Talismã dos Elementos is an element bonus, and
    // the client gates the second column on [Mandala das Feras].
    it('Talisman of Five Elements does not touch the ratio', () => {
      expect(ratioOf(soul({ active: [FIVE_ELEMENTS] }), name, 5)).toBe(ratioOf(soul(), name, 5));
    });
  });

  describe('Talisman of Soul Stealing', () => {
    // 1.500% / 2.000% / 2.500% / 3.000% / 3.500%, plus (Perícia + Maestria) x 7 per level.
    it('Lv5 matches the client table', () => {
      expect(ratioOf(soul(), 'Talisman of Soul Stealing', 5)).toBe(bothMasteries(1000, 500, 7, 5));
    });

    it('Lv1 scales down correctly', () => {
      expect(ratioOf(soul(), 'Talisman of Soul Stealing', 1)).toBe(bothMasteries(1000, 500, 7, 1));
    });

    it('has no Mandala column', () => {
      expect(ratioOf(soul({ active: [MANDALA] }), 'Talisman of Soul Stealing', 5)).toBe(
        ratioOf(soul(), 'Talisman of Soul Stealing', 5),
      );
    });
  });

  describe('Talisman of Four Bearing God', () => {
    // 200% per level, per hit; Mandala buys hits rather than damage.
    it('Lv5 matches the client table', () => {
      expect(ratioOf(soul(), 'Talisman of Four Bearing God', 5)).toBe(talisman(0, 200, 5));
    });

    it('has no Mandala damage column', () => {
      expect(ratioOf(soul({ active: [MANDALA] }), 'Talisman of Four Bearing God', 5)).toBe(
        ratioOf(soul(), 'Talisman of Four Bearing God', 5),
      );
    });

    // "O número de ataques aumenta com o número de Feras Divinas que abençoaram você",
    // and 7 flat under Mandala. The replay lands the four-blessing case at `count` 5.
    const hitCases: [string, number | undefined, number][] = [
      ['no blessing', undefined, 1],
      ['Blue Dragon', BLESSING.BlueDragon, 2],
      ['White Tiger', BLESSING.WhiteTiger, 3],
      ['Red Phoenix', BLESSING.RedPhoenix, 4],
      ['Black Tortoise', BLESSING.BlackTortoise, 5],
      ['all four beasts', BLESSING.AllFour, 5],
    ];

    it.each(hitCases)('hits %s times with %s blessing', (_label, blessing, hits) => {
      const char = soul({ used: blessing ? { _SoulAscetic_Blessing: blessing } : {} });
      const totalHit = findSkill(char, 'Talisman of Four Bearing God').totalHit as () => number;
      expect(totalHit()).toBe(hits);
    });

    it('goes to 7 hits under [Mandala das Feras], whatever the blessing', () => {
      const char = soul({ active: [MANDALA], used: { _SoulAscetic_Blessing: BLESSING.BlueDragon } });
      const totalHit = findSkill(char, 'Talisman of Four Bearing God').totalHit as () => number;
      expect(totalHit()).toBe(7);
    });
  });
});

describe('Mandala of the Beasts (id 5431)', () => {
  // 1.500 per level per hit, plus (Perícia + Maestria) x 15 per level; five hits.
  it('Lv5 matches the client table', () => {
    expect(ratioOf(soul(), 'Mandala of the Beasts', 5)).toBe(bothMasteries(0, 1500, 15, 5));
  });

  it('Lv1 scales down correctly', () => {
    expect(ratioOf(soul(), 'Mandala of the Beasts', 1)).toBe(bothMasteries(0, 1500, 15, 1));
  });

  /**
   * OPEN. The one Mandala cast on record (13.775.920 at `count` 5, full gear) implies a
   * total ratio of 106.050-123.440, where five hits of the table above give 95.040 — 11-30%
   * short. Two readings close it and one recording cannot separate them: a FEI term that
   * scales with skill level (FEI × 5 × Lv would land mid-interval), or Mandala's own +25
   * S.ATQM applying to the hit that grants it rather than only afterwards. Left on the
   * tree's flat `FEI × 5` until a bare-handed recording says which.
   */
  it('hits five times', () => {
    expect(findSkill(soul(), 'Mandala of the Beasts').totalHit).toBe(5);
  });
});

describe('Exorcism of Malicious Soul (id 5425)', () => {
  // normal:   ((skillLv x 150) + (Soul Mastery x 2) + SPL) x almas x baseLv/100
  // enhanced: ((skillLv x 250) + (Soul Mastery x 2) + SPL) x almas x baseLv/100
  //           when the target stands in Totem of Tutelary (or carries Assombração).
  //
  // Both branches are confirmed to the unit by the bare window of
  // `sa-exorcismo-gear-states.rrf`: 560.685 and 890.905 are 1349/849 apart.
  const exorcism = (perLv: number, skillLevel: number, souls: number) =>
    Math.floor((perLv * skillLevel + SOUL_MASTERY * 2 + TOTAL_SPL) * souls * (BASE_LEVEL / 100));

  const withSouls = (souls: number, active: string[] = []) => soul({ active, used: { 'Total Soul': souls } });

  it('Lv5 without Totem of Tutelary uses the 150 coefficient', () => {
    expect(ratioOf(withSouls(5), 'Exorcism of Malicious Soul', 5)).toBe(exorcism(150, 5, 5));
  });

  it('Lv5 inside Totem of Tutelary uses the enhanced 250 coefficient', () => {
    expect(ratioOf(withSouls(5, ['Totem of Tutelary']), 'Exorcism of Malicious Soul', 5)).toBe(exorcism(250, 5, 5));
  });

  it('Totem of Tutelary enhances rather than weakens the skill', () => {
    expect(ratioOf(withSouls(5, ['Totem of Tutelary']), 'Exorcism of Malicious Soul', 5)).toBeGreaterThan(
      ratioOf(withSouls(5), 'Exorcism of Malicious Soul', 5),
    );
  });

  it('scales linearly with accumulated Soul Energy', () => {
    const one = ratioOf(withSouls(1), 'Exorcism of Malicious Soul', 5);
    const five = ratioOf(withSouls(5), 'Exorcism of Malicious Soul', 5);
    expect(five).toBe(one * 5);
  });
});

describe('Soul Ascetic cast/cooldown metadata', () => {
  // Published as "variable cast / fixed cast | cooldown"; the model stores
  // vct = variable, fct = fixed, cd = cooldown, all in seconds.
  //
  // The authority is skills/skill-delay.spec.ts, which holds every one of these against
  // the client's own Conjuração/Espera window.
  const cases: { name: string; vct: number; fct: number; cd: number }[] = [
    { name: 'Exorcism of Malicious Soul', vct: 3, fct: 1.5, cd: 1 },
    { name: 'Talisman of Soul Stealing', vct: 3, fct: 1.5, cd: 1 },
    { name: 'Talisman of Blue Dragon', vct: 1, fct: 1.5, cd: 0.3 },
    { name: 'Talisman of White Tiger', vct: 1, fct: 1.5, cd: 0.4 },
    { name: 'Talisman of Red Phoenix', vct: 1, fct: 1.5, cd: 0.45 },
    { name: 'Talisman of Black Tortoise', vct: 1, fct: 1.5, cd: 0.7 },
    { name: 'Talisman of Four Bearing God', vct: 2, fct: 1.5, cd: 1 },
    { name: 'Mandala of the Beasts', vct: 2, fct: 1.5, cd: 5 },
  ];

  it.each(cases)('$name has vct $vct, fct $fct, cd $cd', ({ name, vct, fct, cd }) => {
    const skill = findSkill(soul(), name);
    expect({ vct: skill.vct, fct: skill.fct, cd: skill.cd }).toEqual({ vct, fct, cd });
  });

  it('every Soul Ascetic atk skill is magic', () => {
    const own = [
      'Exorcism of Malicious Soul',
      'Talisman of Soul Stealing',
      'Talisman of Blue Dragon',
      'Talisman of White Tiger',
      'Talisman of Red Phoenix',
      'Talisman of Black Tortoise',
      'Talisman of Four Bearing God',
      'Mandala of the Beasts',
    ];
    for (const name of own) expect(findSkill(soul(), name).isMatk, name).toBe(true);
  });
});

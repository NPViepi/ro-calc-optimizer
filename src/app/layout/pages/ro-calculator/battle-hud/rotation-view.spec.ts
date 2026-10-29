import { describe, expect, it } from 'vitest';
import { BASIC_ATTACK_VALUE } from '../../../../core/rotation';
import { buildRotationView, computeRotationTimeToKill, RotationSkillMeta, toScheduleStep } from './rotation-view';

/** A solved getTotalSummary() with just the fields the rotation view reads. */
const summaryOf = (over: {
  castPeriod?: number;
  hitPeriod?: number;
  reducedAcd?: number;
  reducedCd?: number;
  dmgType?: string;
  propertySkill?: string;
  perHit?: number;
  hits?: number;
  requireTxt?: string;
  basicDps?: number;
  hitPerSecs?: number;
  hp?: number;
  canCri?: boolean;
  criRate?: number;
  criDmg?: number;
  basicMin?: number;
  basicMax?: number;
  basicCriMin?: number;
  basicCriMax?: number;
  basicCriRate?: number;
  critMin?: number;
  critMax?: number;
  noCriMin?: number;
  noCriMax?: number;
}) => ({
  calcSkill: {
    castPeriod: over.castPeriod ?? 0,
    hitPeriod: over.hitPeriod ?? (over.castPeriod ?? 0) + Math.max(over.reducedAcd ?? 0, over.reducedCd ?? 0),
    reducedAcd: over.reducedAcd ?? 0,
    reducedCd: over.reducedCd ?? 0,
    dmgType: over.dmgType ?? 'Melee',
    propertySkill: over.propertySkill ?? 'Neutral',
  },
  calc: { hitPerSecs: over.hitPerSecs ?? 2.38 },
  monster: { hp: over.hp ?? 1_000_000 },
  propertyAtk: 'Neutral',
  dmg: {
    requireTxt: over.requireTxt ?? '',
    // buildDpsSteps reads these; min === max keeps the per-use damage exact.
    skillDpsInputMin: over.perHit ?? 1000,
    skillDpsInputMax: over.perHit ?? 1000,
    skillDpsInputCriDmg: over.criDmg ?? 0,
    skillDpsInputHitsPerSec: 1,
    skillCanCri: over.canCri ?? false,
    skillCriRateToMonster: over.criRate ?? 0,
    // The rolls the row prints, per use. Default to the flat per-hit figure so the existing
    // cases keep their single reading.
    // For a crit-capable skill the engine's skillMin/MaxDamage ARE the crit roll, and the
    // no-crit one rides its own pair of fields.
    skillMinDamage: over.critMin ?? (over.canCri ? over.criDmg ?? 0 : over.perHit ?? 1000),
    skillMaxDamage: over.critMax ?? (over.canCri ? over.criDmg ?? 0 : over.perHit ?? 1000),
    skillMinDamageNoCri: over.noCriMin ?? over.perHit ?? 1000,
    skillMaxDamageNoCri: over.noCriMax ?? over.perHit ?? 1000,
    skillAccuracy: 100,
    skillTotalHit: over.hits ?? 1,
    skillPropertyMultiplier: 1,
    basicDps: over.basicDps ?? 4760, // 2000 per use at 2,38 hits/s
    // The two legs damage-calculator.ts averages into basicDps.
    basicMinDamage: over.basicMin ?? 0,
    basicMaxDamage: over.basicMax ?? 0,
    criMinDamage: over.basicCriMin ?? 0,
    criMaxDamage: over.basicCriMax ?? 0,
    criRateToMonster: over.basicCriRate ?? 0,
  },
});

const atkSkills: RotationSkillMeta[] = [
  { value: 'Solar Kick==7', label: 'Chute Solar Nv7', icon: 2593 },
  { value: 'Sunset Blast==5', label: 'Entardecer Nv5', icon: 5466, levelList: [{ label: 'Entardecer Nv5', value: 'Sunset Blast==5' }] },
];

describe('toScheduleStep', () => {
  it('keys a skill by name, so its levels share one recarga', () => {
    const step = toScheduleStep({ value: 'Solar Kick==7', summary: summaryOf({ reducedAcd: 0.3, reducedCd: 0.5 }), damage: 10 });

    expect(step.key).toBe('Solar Kick');
    expect(step).toMatchObject({ cast: 0, acd: 0.3, cd: 0.5, damage: 10 });
  });

  it('zeroes pós and recarga for a channelled (hitEveryNSec) skill', () => {
    // calc-skill-aspd forces blockPeriod to 0 for those; the channel time is the cast.
    const summary = summaryOf({ castPeriod: 0.6, hitPeriod: 0.6, reducedAcd: 0.5, reducedCd: 1.0 });
    const step = toScheduleStep({ value: 'Gates of Hell==10', summary, damage: 5 });

    expect(step).toMatchObject({ cast: 0.6, acd: 0, cd: 0 });
  });

  it('makes ataque básico a step that blocks nothing', () => {
    const step = toScheduleStep({ value: BASIC_ATTACK_VALUE, summary: summaryOf({}), damage: 7 });

    expect(step).toMatchObject({ key: BASIC_ATTACK_VALUE, cast: 0, acd: 0, cd: 0, damage: 7 });
  });
});

describe('buildRotationView', () => {
  it('offers only the skill’s valid accumulation counts and reads the saved choice', () => {
    const value = 'Eternal Slash==5';
    const summary = summaryOf({ perHit: 4500, hits: 4 });
    const result = buildRotationView({
      rotation: [value],
      summaryByValue: new Map([[value, summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills: [{ value, label: 'Talho Eterno Nv5', minStack: 1, maxStack: 5, defaultStack: 1 }],
      skillStacks: { 'Eternal Slash': 4 },
    });
    expect(result.entries[0].stackOptions.map((option) => option.value)).toEqual([1, 2, 3, 4, 5]);
    expect(result.entries[0].stackCount).toBe(4);
    expect(result.entries[0].damage).toBe(18_000);
  });
  it('cala as leituras de dano de uma habilidade que não bate', () => {
    // Esconderijo e Infiltrar entram na rotação pelo tempo que ocupam, não pelo dano
    // (cards bLnU1DLpGeA2vxQ794I4 e FPpmOoKCq7KzPxV4NUZ3). A linha lia "0" ao lado de um
    // elemento neutro e de um "Sem crít.", três números sobre um golpe que não acontece.
    const value = 'Hiding==1';
    const summary = summaryOf({ perHit: 4500, hits: 1 });
    const utility = buildRotationView({
      rotation: [value],
      summaryByValue: new Map([[value, summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills: [{ value, label: 'Esconderijo Nv1', isUtility: true }],
    });

    expect(utility.entries[0]).toMatchObject({ showsDamage: false, damage: 0, damageRanges: [], requireTxt: '' });

    // Sem a marca, a mesma habilidade volta a relatar o que a cadeia devolveu.
    const offensive = buildRotationView({
      rotation: [value],
      summaryByValue: new Map([[value, summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills: [{ value, label: 'Esconderijo Nv1' }],
    });

    expect(offensive.entries[0]).toMatchObject({ showsDamage: true, damage: 4500 });
  });
  it('keeps separate accumulation and damage for repeated rotation tiles', () => {
    const value = 'Eternal Slash==5';
    const first = summaryOf({ perHit: 4500, hits: 1 });
    const second = summaryOf({ perHit: 4500, hits: 4 });
    const result = buildRotationView({
      rotation: [value, value],
      summaryByValue: new Map([[value, first]]),
      summaryByIndex: new Map([[0, first], [1, second]]),
      baseSummary: first,
      hasSelectedChances: false,
      atkSkills: [{ value, label: 'Talho Eterno Nv5', minStack: 1, maxStack: 5, defaultStack: 1 }],
      skillStacks: { 'Eternal Slash': 5 },
      rotationStacks: [1, 4],
    });
    expect(result.entries.map((entry) => entry.stackCount)).toEqual([1, 4]);
    expect(result.entries.map((entry) => entry.damage)).toEqual([4500, 18_000]);
  });
  const base = summaryOf({ reducedAcd: 0.3, reducedCd: 0.5, perHit: 1000, hits: 3 });
  const summaryByValue = new Map<string, any>([
    ['Solar Kick==7', summaryOf({ reducedAcd: 0.3, reducedCd: 0.5, perHit: 1000, hits: 3 })],
    ['Sunset Blast==5', summaryOf({ reducedAcd: 0.5, reducedCd: 0.7, perHit: 4000, hits: 2, dmgType: 'Range' })],
  ]);

  const view = buildRotationView({
    rotation: ['Solar Kick==7', 'Sunset Blast==5', 'Solar Kick==7', BASIC_ATTACK_VALUE],
    summaryByValue,
    baseSummary: base,
    hasSelectedChances: false,
    atkSkills,
  });

  it('sums every hit into one per-use damage figure', () => {
    // 3 hits x 1000, not a per-hit number: the design dropped the old "N x min-max".
    expect(view.entries[0].damage).toBeCloseTo(3000, 5);
    expect(view.entries[1].damage).toBeCloseTo(8000, 5);
  });

  it('uses the effected damage once an Efeito is ticked', () => {
    // Ticking an Efeito only moves effected*; reading the base inputs left every row
    // (and so the cycle DPS) frozen while the hero figure moved.
    const withProc = summaryOf({ reducedAcd: 0.3, reducedCd: 0.5, perHit: 1000, hits: 3 });
    withProc.dmg = {
      ...withProc.dmg,
      effectedSkillDpsInputMin: 1500,
      effectedSkillDpsInputMax: 1500,
      effectedSkillDpsInputCriDmg: 0,
      effectedSkillDpsInputHitsPerSec: 1,
      effectedSkillCriRateToMonster: 0,
      effectedSkillAccuracy: 100,
      effectedSkillTotalHit: 3,
    };
    const args = { rotation: ['Solar Kick==7'], summaryByValue: new Map([['Solar Kick==7', withProc]]), baseSummary: withProc, atkSkills };

    expect(buildRotationView({ ...args, hasSelectedChances: false }).entries[0].damage).toBeCloseTo(3000, 5);
    expect(buildRotationView({ ...args, hasSelectedChances: true }).entries[0].damage).toBeCloseTo(4500, 5);
  });

  it('keeps the base damage when the effected pass produced nothing', () => {
    // A build with a chance ticked that this skill's own pass never fired.
    const view2 = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', base]]),
      baseSummary: base,
      hasSelectedChances: true,
      atkSkills,
    });

    expect(view2.entries[0].damage).toBeCloseTo(3000, 5);
  });

  it('recovers ataque básico damage from the engine\'s own DPS', () => {
    expect(view.entries[3].damage).toBeCloseTo(2000, 5); // 4760 / 2,38
    expect(view.entries[3].isBasic).toBe(true);
    expect(view.entries[3].name).toBe('Ataque básico');
  });

  it('labels a row from the catalog, without the level suffix', () => {
    expect(view.entries[0].name).toBe('Chute Solar');
    expect(view.entries[0].levelLabel).toBe('Nv7');
    expect(view.entries[0].icon).toBe(2593);
    expect(view.entries[1].dmgTypeLabel).toBe('À distância');
  });

  it('offers a level picker only where the catalog declares one', () => {
    expect(view.entries[0].levelList).toEqual([]);
    expect(view.entries[1].levelList).toHaveLength(1);
  });

  it('numbers repeats so the second use can say "2ª vez"', () => {
    expect(view.entries[0].occurrence).toBe(0);
    expect(view.entries[2].occurrence).toBe(1);
    // ...and a repeat reuses the same solve, since damage does not depend on position.
    expect(view.entries[2].damage).toBeCloseTo(view.entries[0].damage, 5);
  });

  it('flags a magic row, which has no crit reading worth stating', () => {
    // Magic never crits, so "Sem crít." on a magic row describes the damage type rather
    // than the skill; the row leaves it out. A physical skill that cannot crit still says so.
    const magic = summaryOf({ dmgType: 'Magical' });
    const melee = summaryOf({ dmgType: 'Melee' });
    const view3 = buildRotationView({
      rotation: ['Solar Kick==7', 'Sunset Blast==5'],
      summaryByValue: new Map([['Solar Kick==7', magic], ['Sunset Blast==5', melee]]),
      baseSummary: melee,
      hasSelectedChances: false,
      atkSkills,
    });

    expect(view3.entries[0]).toMatchObject({ isMagic: true, canCrit: false });
    expect(view3.entries[1]).toMatchObject({ isMagic: false, canCrit: false });
  });

  it('never calls ataque básico magic, whatever the build is holding', () => {
    expect(view.entries[3]).toMatchObject({ isBasic: true, isMagic: false });
  });

  it('states the crit reading on every entry', () => {
    // The design requires it explicitly: silence would read as missing data.
    expect(view.entries.every((e) => typeof e.canCrit === 'boolean')).toBe(true);
  });

  it('flags a crit that depends on the character state', () => {
    // A catalog entry whose `canCri` is a *function* is state-dependent by definition —
    // the only honest signal available, since no skill declares which state it needs.
    const atkSkillsWithConditional = [
      { value: 'Sunset Blast==5', label: 'Entardecer Nv5', canCri: () => true },
      { value: 'Solar Kick==7', label: 'Chute Solar Nv7', canCri: true },
    ];
    const crit = buildRotationView({
      rotation: ['Sunset Blast==5', 'Solar Kick==7'],
      summaryByValue: new Map([
        ['Sunset Blast==5', { ...summaryOf({}), dmg: { ...summaryOf({}).dmg, skillCanCri: true, skillCriRateToMonster: 42.5 } }],
        ['Solar Kick==7', { ...summaryOf({}), dmg: { ...summaryOf({}).dmg, skillCanCri: false, skillCriRateToMonster: 0 } }],
      ]),
      baseSummary: base,
      hasSelectedChances: false,
      atkSkills: atkSkillsWithConditional,
    });

    expect(crit.entries[0]).toMatchObject({ canCrit: true, critRate: 42.5, critConditional: true });
    expect(crit.entries[1]).toMatchObject({ canCrit: false, critConditional: false });
  });

  it('splits contributions to exactly 100%', () => {
    expect(view.entries.reduce((sum, e) => sum + e.contributionPercent, 0)).toBeCloseTo(100, 5);
  });

  it('derives the cycle and a time to kill', () => {
    expect(view.cycle.cycleDuration).toBeGreaterThan(0);
    expect(view.aspdPeriod).toBeCloseTo(1 / 2.38, 5);
    expect(view.ttk?.seconds).toBeGreaterThan(0);
    expect(view.cyclesToKill).toBeGreaterThan(0);
  });

  it('zeroes a skill the build cannot cast and lists it as blocked', () => {
    const blockedView = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', summaryOf({ requireTxt: 'twohandSword', perHit: 9999 })]]),
      baseSummary: base,
      hasSelectedChances: false,
      atkSkills,
    });

    expect(blockedView.entries[0].damage).toBe(0);
    expect(blockedView.blocked).toEqual([{ name: 'Chute Solar', requireTxt: 'twohandSword' }]);
  });

  it('reports no time to kill against an immune target', () => {
    const immune = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', summaryOf({ perHit: 0, hits: 0 })]]),
      baseSummary: summaryOf({ perHit: 0, hits: 0, basicDps: 0 }),
      hasSelectedChances: false,
      atkSkills,
    });

    expect(immune.cycle.sustainedDps).toBe(0);
    expect(immune.ttk).toBeNull();
    expect(immune.cyclesToKill).toBe(0);
  });

  it('handles an empty rotation', () => {
    const empty = buildRotationView({
      rotation: [],
      summaryByValue,
      baseSummary: base,
      hasSelectedChances: false,
      atkSkills,
    });

    expect(empty.entries).toEqual([]);
    expect(empty.cycle.sustainedDps).toBe(0);
    expect(empty.ttk).toBeNull();
  });
});

describe('stall reporting', () => {
  // A one-entry rotation waits on its own recarga by definition: the skill repeats on its
  // own timer and that wait *is* the cycle. Flagging it put "Recarga não fecha — faltam
  // 59,53s" in red under a perfectly normal Firmamento rotation.
  it('never stalls a one-entry rotation on its own recarga', () => {
    const long = summaryOf({ castPeriod: 1, reducedCd: 60, perHit: 1000, hits: 1 });
    const view = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', long]]),
      baseSummary: long,
      hasSelectedChances: false,
      atkSkills,
    });

    expect(view.entries[0].lane.cdWait).toBeGreaterThan(1);
    expect(view.entries[0].stalled).toBe(false);
  });

  it('still stalls the entry a multi-skill rotation really waits on', () => {
    // B is quick, so coming back round to A leaves A's own 10s recarga still running.
    const slow = summaryOf({ castPeriod: 0.2, reducedAcd: 0.2, reducedCd: 10, perHit: 1000, hits: 1 });
    const quick = summaryOf({ castPeriod: 0.2, reducedAcd: 0.2, reducedCd: 0.2, perHit: 1000, hits: 1 });
    const view = buildRotationView({
      rotation: ['Solar Kick==7', 'Sunset Blast==5'],
      summaryByValue: new Map([['Solar Kick==7', slow], ['Sunset Blast==5', quick]]),
      baseSummary: slow,
      hasSelectedChances: false,
      atkSkills,
    });

    expect(view.entries[0].stalled).toBe(true);
    expect(view.entries[1].stalled).toBe(false);
  });
});

describe('crit-weighted rows', () => {
  const viewFor = (over: { canCri?: boolean; criRate?: number }) => {
    const summary = summaryOf({ perHit: 1_114_048, hits: 1, criDmg: 1_760_192, ...over });
    return buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills,
    });
  };

  it('flags a row whose damage is a mean of two outcomes', () => {
    const entry = viewFor({ canCri: true, criRate: 38 }).entries[0];

    expect(entry.critWeighted).toBe(true);
    // 0,62 x 1.114.048 + 0,38 x 1.760.192 — neither of the two numbers the card headlines.
    expect(entry.damage).toBe(1_359_582);
  });

  it('carries the two rolls the mean sits between', () => {
    const entry = viewFor({ canCri: true, criRate: 38 }).entries[0];

    expect(entry.damageRanges.map((r) => [r.kind, r.min, r.max])).toEqual([
      ['nocri', 1_114_048, 1_114_048],
      ['cri', 1_760_192, 1_760_192],
    ]);
    expect(entry.hasDamageSpread).toBe(true);
    // 0,62 x 1.114.048 + 0,38 x 1.760.192 - neither of the two the card headlines.
    expect(entry.damage).toBe(1_359_582);
  });

  it('shows each roll as the span it is, not as a point on it', () => {
    const summary = summaryOf({
      perHit: 1000,
      hits: 1,
      criDmg: 2000,
      canCri: true,
      criRate: 50,
      noCriMin: 900,
      noCriMax: 1100,
      critMin: 1800,
      critMax: 2200,
    });
    const entry = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills,
    }).entries[0];

    expect(entry.damageRanges).toEqual([
      { kind: 'nocri', label: 'sem crít.', min: 900, max: 1100 },
      { kind: 'cri', label: 'crít.', min: 1800, max: 2200 },
    ]);
  });

  it('splits ataque básico into the same two rolls the engine averaged', () => {
    const summary = summaryOf({ basicMin: 1400, basicMax: 1600, basicCriMin: 2900, basicCriMax: 3100, basicCriRate: 40 });
    const entry = buildRotationView({
      rotation: [BASIC_ATTACK_VALUE],
      summaryByValue: new Map(),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills,
    }).entries[0];

    expect(entry.damageRanges).toEqual([
      { kind: 'nocri', label: 'sem crít.', min: 1400, max: 1600 },
      { kind: 'cri', label: 'crít.', min: 2900, max: 3100 },
    ]);
  });

  it('shows one roll, and no mean to explain, when the damage never varies', () => {
    // Three copies of one number is not a reading. The row's figure then opens the formula
    // itself rather than an average of a single value.
    const flat = viewFor({ canCri: false, criRate: 0 }).entries[0];

    expect(flat.damageRanges).toEqual([{ kind: 'flat', label: 'dano', min: 1_114_048, max: 1_114_048 }]);
    expect(flat.hasDamageSpread).toBe(false);
  });

  it('shows the min-max roll of a skill that cannot crit', () => {
    const summary = summaryOf({ perHit: 1000, hits: 1, critMin: 900, critMax: 1100 });
    const entry = buildRotationView({
      rotation: ['Solar Kick==7'],
      summaryByValue: new Map([['Solar Kick==7', summary]]),
      baseSummary: summary,
      hasSelectedChances: false,
      atkSkills,
    }).entries[0];

    expect(entry.damageRanges).toEqual([{ kind: 'flat', label: 'dano', min: 900, max: 1100 }]);
    expect(entry.hasDamageSpread).toBe(true);
  });

  it('names only the crit roll when every single use crits', () => {
    // The no-crit figures are rolls the build never takes; printing them would be a lie.
    const every = viewFor({ canCri: true, criRate: 100 }).entries[0];

    expect(every.damageRanges.map((r) => r.kind)).toEqual(['cri']);
  });
});

describe('computeRotationTimeToKill', () => {
  // Firmamento: one 58,7M cast against a 23,6M target, on a 61s cycle. Dividing HP by the
  // sustained DPS smeared that burst over the whole minute and answered "24,6s" next to
  // "1 uso" — the target is already dead when the first cast lands.
  const burstCycle = (over: { damage?: number; castEnd?: number; cycleDuration?: number } = {}) =>
    ({
      lanes: [{ start: 0, castEnd: over.castEnd ?? 1, posEnd: 1, recEnd: 61, aspdWait: 0, cdWait: 0, damage: over.damage ?? 58_722_564, contributionPercent: 100 }],
      cycleDuration: over.cycleDuration ?? 61,
      damagePerCycle: over.damage ?? 58_722_564,
      sustainedDps: (over.damage ?? 58_722_564) / (over.cycleDuration ?? 61),
    } as any);

  it('kills the target when the blow that finishes it lands', () => {
    const ttk = computeRotationTimeToKill(23_600_000, burstCycle())!;

    expect(ttk.seconds).toBeCloseTo(1, 5);
  });

  it('carries the running total across cycles', () => {
    // Three casts needed, so the kill lands on the third cycle, not the first.
    const ttk = computeRotationTimeToKill(3 * 58_722_564, burstCycle())!;

    expect(ttk.seconds).toBeCloseTo(2 * 61 + 1, 5);
  });

  it('reports nothing when nothing can die', () => {
    expect(computeRotationTimeToKill(0, burstCycle())).toBeNull();
    expect(computeRotationTimeToKill(1000, burstCycle({ damage: 0 }))).toBeNull();
  });
});

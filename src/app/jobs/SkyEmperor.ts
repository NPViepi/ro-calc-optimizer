import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { EquipmentSummaryModel } from '../models/equipment-summary.model';
import { AdditionalBonusInput } from '../models/info-for-class.model';
import { addBonus, genSkillList } from '../utils';
import { StarEmperor } from './StarEmperor';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 0, 1, 0],
  2: [2, 0, 0, 0, 1, 0],
  3: [2, 1, 0, 1, 1, 0],
  4: [3, 2, 0, 1, 2, 0],
  5: [4, 2, 0, 2, 2, 0],
  6: [5, 2, 0, 2, 2, 0],
  7: [6, 2, 0, 2, 3, 0],
  8: [6, 2, 0, 2, 4, 0],
  9: [6, 3, 1, 2, 4, 0],
  10: [6, 3, 1, 2, 5, 0],
  11: [6, 3, 2, 3, 5, 0],
  12: [7, 3, 2, 3, 5, 1],
  13: [8, 3, 3, 3, 5, 1],
  14: [8, 3, 3, 3, 5, 1],
  15: [8, 3, 3, 3, 5, 1],
  16: [9, 3, 3, 3, 5, 1],
  17: [10, 4, 3, 3, 5, 1],
  18: [10, 4, 3, 3, 5, 1],
  19: [10, 4, 3, 3, 5, 1],
  20: [11, 4, 3, 3, 5, 1],
  21: [11, 4, 3, 3, 6, 1],
  22: [11, 5, 3, 3, 6, 1],
  23: [11, 6, 3, 3, 6, 1],
  24: [12, 6, 3, 3, 7, 1],
  25: [12, 7, 3, 3, 7, 1],
  26: [12, 7, 3, 3, 8, 2],
  27: [12, 7, 3, 3, 8, 2],
  28: [12, 8, 3, 3, 8, 2],
  29: [12, 8, 4, 3, 9, 2],
  30: [12, 8, 4, 3, 9, 3],
  31: [12, 9, 5, 3, 9, 3],
  32: [12, 10, 5, 3, 9, 3],
  33: [12, 10, 6, 3, 9, 3],
  34: [12, 10, 6, 3, 9, 3],
  35: [12, 10, 6, 3, 9, 3],
  36: [12, 10, 6, 3, 9, 3],
  37: [12, 10, 6, 3, 9, 3],
  38: [12, 10, 6, 3, 9, 3],
  39: [12, 10, 6, 3, 9, 3],
  40: [12, 10, 6, 3, 9, 3],
  41: [12, 10, 6, 3, 9, 3],
  42: [12, 10, 6, 3, 9, 3],
  43: [12, 10, 6, 3, 9, 3],
  44: [12, 10, 6, 3, 9, 3],
  45: [12, 10, 6, 3, 9, 3],
  46: [12, 10, 6, 3, 9, 3],
  47: [12, 10, 6, 3, 9, 3],
  48: [12, 10, 6, 3, 9, 3],
  49: [12, 10, 6, 3, 9, 3],
  50: [12, 10, 6, 3, 9, 3],
  51: [12, 10, 6, 3, 9, 3],
  52: [12, 10, 6, 3, 9, 3],
  53: [12, 10, 6, 3, 9, 3],
  54: [12, 10, 6, 3, 9, 3],
  55: [12, 10, 6, 3, 9, 3],
  56: [12, 10, 6, 3, 9, 3],
  57: [12, 10, 6, 3, 9, 3],
  58: [12, 10, 6, 3, 9, 3],
  59: [12, 10, 6, 3, 9, 3],
  60: [12, 10, 6, 3, 9, 3],
  61: [12, 10, 6, 3, 9, 3],
  62: [12, 10, 6, 3, 9, 3],
  63: [12, 10, 6, 3, 9, 3],
  64: [12, 10, 6, 3, 9, 3],
  65: [12, 10, 6, 3, 9, 3],
  66: [12, 10, 6, 3, 9, 3],
  67: [12, 10, 6, 3, 9, 3],
  68: [12, 10, 6, 3, 9, 3],
  69: [12, 10, 6, 3, 9, 3],
  70: [12, 10, 6, 3, 9, 3],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 0, 0],
  3: [1, 0, 0, 0, 0, 0],
  4: [1, 0, 0, 0, 0, 0],
  5: [2, 0, 0, 0, 0, 0],
  6: [2, 0, 0, 0, 0, 0],
  7: [2, 0, 0, 0, 0, 0],
  8: [2, 0, 0, 0, 0, 1],
  9: [2, 0, 0, 0, 0, 1],
  10: [2, 0, 0, 0, 0, 1],
  11: [2, 0, 0, 0, 0, 1],
  12: [2, 0, 0, 0, 0, 1],
  13: [2, 0, 0, 0, 0, 1],
  14: [2, 0, 0, 0, 0, 2],
  15: [2, 0, 1, 0, 0, 2],
  16: [2, 0, 1, 0, 0, 2],
  17: [2, 0, 1, 0, 0, 2],
  18: [2, 1, 1, 0, 0, 2],
  19: [3, 1, 1, 0, 0, 2],
  20: [3, 1, 1, 0, 0, 2],
  21: [3, 1, 1, 0, 0, 2],
  22: [3, 1, 1, 0, 0, 2],
  23: [3, 1, 1, 0, 0, 2],
  24: [3, 1, 1, 0, 0, 2],
  25: [3, 1, 1, 0, 0, 2],
  26: [3, 1, 1, 0, 0, 2],
  27: [3, 1, 1, 0, 1, 2],
  28: [4, 1, 1, 0, 1, 2],
  29: [4, 1, 1, 0, 1, 2],
  30: [4, 1, 1, 0, 2, 2],
  31: [4, 1, 1, 0, 2, 2],
  32: [4, 1, 1, 0, 2, 2],
  33: [4, 2, 1, 0, 2, 2],
  34: [5, 2, 1, 0, 2, 2],
  35: [5, 3, 1, 0, 3, 2],
  36: [6, 3, 1, 0, 3, 2],
  37: [6, 3, 1, 0, 4, 2],
  38: [6, 3, 1, 0, 4, 3],
  39: [6, 4, 1, 0, 4, 3],
  40: [7, 4, 1, 0, 4, 3],
  41: [8, 4, 1, 0, 4, 3],
  42: [8, 5, 1, 0, 4, 4],
  43: [8, 6, 1, 0, 4, 4],
  44: [9, 6, 1, 0, 4, 4],
  45: [9, 7, 1, 0, 4, 5],
  46: [9, 7, 1, 0, 4, 6],
  47: [10, 7, 2, 0, 4, 6],
  48: [10, 8, 2, 0, 4, 6],
  49: [10, 8, 2, 0, 5, 6],
  50: [11, 8, 2, 0, 5, 7],
  51: [11, 8, 2, 0, 5, 7],
  52: [11, 8, 2, 0, 5, 7],
  53: [11, 8, 2, 0, 5, 7],
  54: [11, 8, 2, 0, 5, 7],
  55: [11, 8, 2, 0, 5, 7],
  56: [11, 8, 2, 0, 5, 7],
  57: [11, 8, 2, 0, 5, 7],
  58: [11, 8, 2, 0, 5, 7],
  59: [11, 8, 2, 0, 5, 7],
  60: [11, 8, 2, 0, 5, 7],
  61: [11, 8, 2, 0, 5, 7],
  62: [11, 8, 2, 0, 5, 7],
  63: [11, 8, 2, 0, 5, 7],
  64: [11, 8, 2, 0, 5, 7],
  65: [11, 8, 2, 0, 5, 7],
  66: [11, 8, 2, 0, 5, 7],
  67: [11, 8, 2, 0, 5, 7],
  68: [11, 8, 2, 0, 5, 7],
  69: [11, 8, 2, 0, 5, 7],
  70: [11, 8, 2, 0, 5, 7],
};

/**
 * Celestial Space — the single state that Amanhecer/Anoitecer cycle through, plus Elo
 * Celestial. The six sun/moon states are mutually exclusive, and Elo Celestial cancels
 * all of them, so the whole thing fits in one selector.
 */
const CelestialSpace = {
  Sunrise: 1,
  Noon: 2,
  Sunset: 3,
  Moonrise: 4,
  Midnight: 5,
  Moonset: 6,
  /** Elo Celestial: libera as quatro habilidades de estado no efeito máximo. */
  Unity: 7,
} as const;

export class SkyEmperor extends StarEmperor {
  protected override CLASS_NAME = ClassName.SkyEmperor;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.SkyEmperor];

  /** Estado atual do Espaço Celeste (0 = nenhum). */
  private celestialSpace(): number {
    return this.activeSkillLv('_SkyEmperor_Celestial_Space');
  }

  /** The requested state, or Elo Celestial, which unlocks the maximum effect of all four. */
  private isCelestialSpace(space: number): boolean {
    const current = this.celestialSpace();

    return current === space || current === CelestialSpace.Unity;
  }

  /**
   * Per-level values: the CLIENT's OWN description (data.grf, skilldescript.lub), with
   * browiki.org agreeing, validated packet by packet against an in-game recording — see
   * SkyEmperor.replay.spec.ts.
   *
   * Do NOT swap these for the Sigma blog tables (neither the "[V2]" ones that used to be
   * here, nor the "3rd version" ones from Feb 2026). Neither reproduces the recording:
   * for the V3 ones there is no ATK at all, at any soft DEF, that closes the six packets.
   */
  private readonly atkSkillList4th: AtkSkillModel[] = [
    {
      /**
       * Amanhecer (5465) — the sun-side state opener: the 1st cast sets [Nascer do Sol],
       * the 2nd [Meio-Dia], the 3rd [Pôr do Sol]. Single-target, and the damage does not
       * depend on the state.
       *
       * The per-level table and the "Nv. de Maestria" column are the client's own
       * (900/1.300/1.700/2.100/2.500 and x5..x25). **The POD coefficient is the one number
       * this class has no measurement for**: no recording in the repo casts Amanhecer. It
       * is set to POD x 3 by symmetry with Anoitecer, its moon-side twin, whose x 3 IS
       * measured to the unit (see the sibling entry). The blast skills use POD x 5, so if
       * a recording ever contradicts this, this is the line to change.
       */
      name: 'Rising Sun',
      label: 'Rising Sun Lv5',
      value: 'Rising Sun==5',
      levelList: [1, 2, 3, 4, 5].map((lv) => ({ label: `Rising Sun Nv${lv}`, value: `Rising Sun==${lv}` })),
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 0.5,
      isMelee: true,
      hit: 2,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (500 + skillLevel * (400 + skillBonusLv * 5) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      /**
       * Anoitecer (5468) — the moon-side state opener: the 1st cast sets [Nascer da Lua],
       * the 2nd [Meia-Noite], the 3rd [Pôr da Lua]. Area of effect, and the damage does
       * not depend on the state — the recording prints the same 135.776 in all three.
       *
       * Measured on Zonnor's recording (see SkyEmperor.moon-states.spec.ts): naked at
       * base 238 with POD 111 and Maestria Celestial 10, the packet fixes the ratio at
       * exactly 3.053, i.e. a base of 1.283. The client's table gives 900 at Lv1 and the
       * mastery column x5 gives 50, so the remaining 333 is POD 111 x 3 to the unit —
       * POD x 5 would need a base of 728 and is arithmetically impossible here.
       *
       * No critical: the client text carries none of the "possibilidade do ataque ser
       * crítico" line its sibling blasts have, and all 28 packets in the recording are
       * ordinary hits.
       */
      name: 'Rising Moon',
      label: 'Rising Moon Lv5',
      value: 'Rising Moon==5',
      levelList: [1, 2, 3, 4, 5].map((lv) => ({ label: `Rising Moon Nv${lv}`, value: `Rising Moon==${lv}` })),
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 0.5,
      isMelee: true,
      hit: 2,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (600 + skillLevel * (300 + skillBonusLv * 5) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Noon Blast',
      label: 'Noon Blast Lv5',
      value: 'Noon Blast==5',
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 0.7,
      isMelee: true,
      hit: 2,
      canCri: () => this.isCelestialSpace(CelestialSpace.Noon),
      criDmgPercentage: 0.5,
      baseCriPercentage: 1,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (1500 + skillLevel * (900 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Sunset Blast',
      label: 'Sunset Blast Lv5',
      value: 'Sunset Blast==5',
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 0.3,
      isMelee: true,
      hit: 2,
      canCri: () => this.isCelestialSpace(CelestialSpace.Sunset),
      criDmgPercentage: 0.5,
      baseCriPercentage: 1,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (900 + skillLevel * (300 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Midnight Kick',
      label: 'Midnight Kick Lv5',
      value: 'Midnight Kick==5',
      acd: 0,
      fct: 0.5,
      vct: 1,
      cd: 0.7,
      isMelee: true,
      hit: 2,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        if (this.isCelestialSpace(CelestialSpace.Midnight)) {
          return (1500 + skillLevel * (1200 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
        }

        return (500 + skillLevel * (1000 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Dawn Break',
      label: 'Dawn Break Lv5',
      value: 'Dawn Break==5',
      acd: 0,
      fct: 0.5,
      vct: 1,
      cd: 0.3,
      isMelee: true,
      hit: 2,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        if (this.isCelestialSpace(CelestialSpace.Moonset)) {
          return (300 + skillLevel * (600 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
        }

        return (300 + skillLevel * (400 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Twinkling Galaxy',
      label: 'Twinkling Galaxy Lv5 (1 estrela)',
      value: 'Twinkling Galaxy==5',
      // Unlike the others, Constelação is usually kept at a low level (it is just the
      // enabler for Explosão Galática), so all five levels are selectable.
      levelList: [
        { label: 'Twinkling Galaxy Nv1 (1 estrela)', value: 'Twinkling Galaxy==1' },
        { label: 'Twinkling Galaxy Nv2 (1 estrela)', value: 'Twinkling Galaxy==2' },
        { label: 'Twinkling Galaxy Nv3 (1 estrela)', value: 'Twinkling Galaxy==3' },
        { label: 'Twinkling Galaxy Nv4 (1 estrela)', value: 'Twinkling Galaxy==4' },
        { label: 'Twinkling Galaxy Nv5 (1 estrela)', value: 'Twinkling Galaxy==5' },
      ],
      acd: 0,
      fct: 0.5,
      vct: 1,
      cd: 5,
      isMelee: true,
      hit: 3,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (200 + skillLevel * (400 + skillBonusLv * 3) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Star Burst',
      label: 'Star Burst Lv5 (1 estrela)',
      value: 'Star Burst==5',
      acd: 0.5,
      fct: 0.5,
      vct: 0,
      cd: 1,
      isMelee: true,
      hit: 2,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (500 + skillLevel * (400 + skillBonusLv * 5) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Star Cannon',
      label: 'Star Cannon Lv5 (1 estrela)',
      value: 'Star Cannon==5',
      acd: 0,
      fct: 0.5,
      vct: 0,
      cd: 5,
      isMelee: true,
      hit: 3,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Sky Mastery');

        return (200 + skillLevel * (500 + skillBonusLv * 5) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'All in the Sky',
      label: 'All in the Sky Lv10',
      value: 'All in the Sky==10',
      // The four times below now come from the client's own Conjuração/Espera table, which
      // the ragassets feed ships and skill-delay.spec.ts holds this class to; they used to
      // be unmeasured, and the feed agrees with what was here. The damage is validated
      // separately — see SkyEmperor.firmamento.spec.ts and SkyEmperor.moon-states.spec.ts.
      // The ATK-per-level table still comes from the client alone: the three external
      // sources disagree with each other, and with LATAM, on it.
      acd: 0,
      fct: 1,
      vct: 0,
      cd: 2,
      isMelee: true,
      // 3 FULL hits against DemiHuman/Demon — not one packet split for display the way
      // the sibling skills use `hit`. The recording only solves as 3 × the whole damage,
      // and divine-pride labels the table column "ATK per Hit". Any other race: 1 hit.
      totalHit: ({ monster }: AtkSkillFormulaInput) =>
        monster.race === 'demihuman' || monster.race === 'demon' ? 3 : 1,
      canCri: () => true,
      criDmgPercentage: 0.5,
      baseCriPercentage: 1,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;

        // No Sky Mastery term, deliberately. This skill's client table is the only one
        // in the class without the "Nv. Maestria" column that produces the sibling
        // skills' `skillLevel * mastery * 5`, and the recording agrees: with Sky Mastery
        // at 10, the only integer that fits is 2000×Lv + POW×10. The description's
        // "affected by Sky Mastery" line is boilerplate repeated across the whole class.
        return (skillLevel * 2000 + totalPow * 10) * (baseLevel / 100);
      },
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      name: '_SkyEmperor_Celestial_Space',
      label: 'Espaço Celeste',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Nascer do Sol', value: CelestialSpace.Sunrise, isUse: true },
        { label: 'Meio-Dia', value: CelestialSpace.Noon, isUse: true },
        { label: 'Pôr do Sol', value: CelestialSpace.Sunset, isUse: true },
        { label: 'Nascer da Lua', value: CelestialSpace.Moonrise, isUse: true },
        { label: 'Meia-Noite', value: CelestialSpace.Midnight, isUse: true },
        { label: 'Pôr da Lua', value: CelestialSpace.Moonset, isUse: true },
        { label: 'Elo Celestial', value: CelestialSpace.Unity, isUse: true },
      ]
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      name: 'Sky Mastery',
      label: 'Sky Mastery',
      inputType: 'dropdown',
      dropdown: genSkillList(10)
    },
    {
      name: 'War Book Mastery',
      label: 'War Book Mastery',
      inputType: 'dropdown',
      dropdown: genSkillList(10)
    },
  ];

  constructor() {
    super();

    this.inheritSkills({
      activeSkillList: this.activeSkillList4th,
      atkSkillList: this.atkSkillList4th,
      passiveSkillList: this.passiveSkillList4th,
      classNames: this.classNames4th,
    });
  }

  override setAdditionalBonus(params: AdditionalBonusInput): EquipmentSummaryModel {
    super.setAdditionalBonus(params);

    const { totalBonus, weapon } = params;

    const warMastLv = this.learnLv('War Book Mastery');
    if (warMastLv > 0 && weapon.isType('book')) {
      addBonus(totalBonus, 'pAtk', warMastLv + 2);
      addBonus(totalBonus, 'hit', warMastLv * 3);
    }

    return totalBonus;
  }
}

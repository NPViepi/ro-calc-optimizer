import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { ElementType } from '../constants';
import { genSkillList } from '../utils';
import { Kagerou } from './Kagerou';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

/**
 * Job and trait bonuses — irowiki.org/wiki/Shinkiro#Job_&_Talent_Bonuses.
 *
 * The wiki publishes the *job level at which each stat reaches +N*; these two tables are
 * that expanded per level. Thresholds (STR/AGI/VIT/INT/DEX/LUK):
 *   FOR 1,4,7,12,13,16,17,19,22,39   AGI 5,8,17,20,22,27,32   VIT 11,13,24,28,32
 *   INT 1,3,9,11,56,59               DES 2,5,7,9,15,18,21,24,26,56   SOR 6,23,29
 * and (POW/STA/WIS/SPL/CON/CRT):
 *   POD 3,27,31,33,36,39,41,42,47,50   STA 14,33,35,38,40,42,44,45   SAB 15,34,47
 *   FEI —   CON 25,29,35,37,48   CRV 10,30,43,44,46,49
 *
 * Checked against the Centelha das Trevas replay (Shinkiro.shadow-flash-replay.spec.ts):
 * at job level 46 they give STR +10 / DEX +9 / LUK +3 / POW +8 / CON +4, which reproduce
 * exactly the base ATK 277, the P.ATK 2 and the C.Rate 35 the client reported in the
 * recording. The previous tables (STR +12 / POW +9) gave 284 and 3.
 *
 * Caveats about the source, to resolve if anyone confirms in game:
 * - iROwiki's own summary box says AGI +8 / VIT +6 / CON +6 / CRT +7 at maximum, while the
 *   threshold table above stops at +7 / +5 / +5 / +6. We kept the table (the more specific
 *   data). For AGI and CRT the missing threshold is probably Shiranui's (28 and 36), which
 *   would change CRT to +6 between job levels 36 and 48;
 * - the SPL row on the Shinkiro page is a copy of the CON one. The Shiranui page has an
 *   empty SPL row and both summaries say SPL +0, so SPL stays 0 at every level.
 */
const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 1, 0, 0],
  2: [1, 0, 0, 1, 1, 0],
  3: [1, 0, 0, 2, 1, 0],
  4: [2, 0, 0, 2, 1, 0],
  5: [2, 1, 0, 2, 2, 0],
  6: [2, 1, 0, 2, 2, 1],
  7: [3, 1, 0, 2, 3, 1],
  8: [3, 2, 0, 2, 3, 1],
  9: [3, 2, 0, 3, 4, 1],
  10: [3, 2, 0, 3, 4, 1],
  11: [3, 2, 1, 4, 4, 1],
  12: [4, 2, 1, 4, 4, 1],
  13: [5, 2, 2, 4, 4, 1],
  14: [5, 2, 2, 4, 4, 1],
  15: [5, 2, 2, 4, 5, 1],
  16: [6, 2, 2, 4, 5, 1],
  17: [7, 3, 2, 4, 5, 1],
  18: [7, 3, 2, 4, 6, 1],
  19: [8, 3, 2, 4, 6, 1],
  20: [8, 4, 2, 4, 6, 1],
  21: [8, 4, 2, 4, 7, 1],
  22: [9, 5, 2, 4, 7, 1],
  23: [9, 5, 2, 4, 7, 2],
  24: [9, 5, 3, 4, 8, 2],
  25: [9, 5, 3, 4, 8, 2],
  26: [9, 5, 3, 4, 9, 2],
  27: [9, 6, 3, 4, 9, 2],
  28: [9, 6, 4, 4, 9, 2],
  29: [9, 6, 4, 4, 9, 3],
  30: [9, 6, 4, 4, 9, 3],
  31: [9, 6, 4, 4, 9, 3],
  32: [9, 7, 5, 4, 9, 3],
  33: [9, 7, 5, 4, 9, 3],
  34: [9, 7, 5, 4, 9, 3],
  35: [9, 7, 5, 4, 9, 3],
  36: [9, 7, 5, 4, 9, 3],
  37: [9, 7, 5, 4, 9, 3],
  38: [9, 7, 5, 4, 9, 3],
  39: [10, 7, 5, 4, 9, 3],
  40: [10, 7, 5, 4, 9, 3],
  41: [10, 7, 5, 4, 9, 3],
  42: [10, 7, 5, 4, 9, 3],
  43: [10, 7, 5, 4, 9, 3],
  44: [10, 7, 5, 4, 9, 3],
  45: [10, 7, 5, 4, 9, 3],
  46: [10, 7, 5, 4, 9, 3],
  47: [10, 7, 5, 4, 9, 3],
  48: [10, 7, 5, 4, 9, 3],
  49: [10, 7, 5, 4, 9, 3],
  50: [10, 7, 5, 4, 9, 3],
  51: [10, 7, 5, 4, 9, 3],
  52: [10, 7, 5, 4, 9, 3],
  53: [10, 7, 5, 4, 9, 3],
  54: [10, 7, 5, 4, 9, 3],
  55: [10, 7, 5, 4, 9, 3],
  56: [10, 7, 5, 5, 10, 3],
  57: [10, 7, 5, 5, 10, 3],
  58: [10, 7, 5, 5, 10, 3],
  59: [10, 7, 5, 6, 10, 3],
  60: [10, 7, 5, 6, 10, 3],
  61: [10, 7, 5, 6, 10, 3],
  62: [10, 7, 5, 6, 10, 3],
  63: [10, 7, 5, 6, 10, 3],
  64: [10, 7, 5, 6, 10, 3],
  65: [10, 7, 5, 6, 10, 3],
  66: [10, 7, 5, 6, 10, 3],
  67: [10, 7, 5, 6, 10, 3],
  68: [10, 7, 5, 6, 10, 3],
  69: [10, 7, 5, 6, 10, 3],
  70: [10, 7, 5, 6, 10, 3],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 0, 0],
  3: [1, 0, 0, 0, 0, 0],
  4: [1, 0, 0, 0, 0, 0],
  5: [1, 0, 0, 0, 0, 0],
  6: [1, 0, 0, 0, 0, 0],
  7: [1, 0, 0, 0, 0, 0],
  8: [1, 0, 0, 0, 0, 0],
  9: [1, 0, 0, 0, 0, 0],
  10: [1, 0, 0, 0, 0, 1],
  11: [1, 0, 0, 0, 0, 1],
  12: [1, 0, 0, 0, 0, 1],
  13: [1, 0, 0, 0, 0, 1],
  14: [1, 1, 0, 0, 0, 1],
  15: [1, 1, 1, 0, 0, 1],
  16: [1, 1, 1, 0, 0, 1],
  17: [1, 1, 1, 0, 0, 1],
  18: [1, 1, 1, 0, 0, 1],
  19: [1, 1, 1, 0, 0, 1],
  20: [1, 1, 1, 0, 0, 1],
  21: [1, 1, 1, 0, 0, 1],
  22: [1, 1, 1, 0, 0, 1],
  23: [1, 1, 1, 0, 0, 1],
  24: [1, 1, 1, 0, 0, 1],
  25: [1, 1, 1, 0, 1, 1],
  26: [1, 1, 1, 0, 1, 1],
  27: [2, 1, 1, 0, 1, 1],
  28: [2, 1, 1, 0, 1, 1],
  29: [2, 1, 1, 0, 2, 1],
  30: [2, 1, 1, 0, 2, 2],
  31: [3, 1, 1, 0, 2, 2],
  32: [3, 1, 1, 0, 2, 2],
  33: [4, 2, 1, 0, 2, 2],
  34: [4, 2, 2, 0, 2, 2],
  35: [4, 3, 2, 0, 3, 2],
  36: [5, 3, 2, 0, 3, 2],
  37: [5, 3, 2, 0, 4, 2],
  38: [5, 4, 2, 0, 4, 2],
  39: [6, 4, 2, 0, 4, 2],
  40: [6, 5, 2, 0, 4, 2],
  41: [7, 5, 2, 0, 4, 2],
  42: [8, 6, 2, 0, 4, 2],
  43: [8, 6, 2, 0, 4, 3],
  44: [8, 7, 2, 0, 4, 4],
  45: [8, 8, 2, 0, 4, 4],
  46: [8, 8, 2, 0, 4, 5],
  47: [9, 8, 3, 0, 4, 5],
  48: [9, 8, 3, 0, 5, 5],
  49: [9, 8, 3, 0, 5, 6],
  50: [10, 8, 3, 0, 5, 6],
  51: [10, 8, 3, 0, 5, 6],
  52: [10, 8, 3, 0, 5, 6],
  53: [10, 8, 3, 0, 5, 6],
  54: [10, 8, 3, 0, 5, 6],
  55: [10, 8, 3, 0, 5, 6],
  56: [10, 8, 3, 0, 5, 6],
  57: [10, 8, 3, 0, 5, 6],
  58: [10, 8, 3, 0, 5, 6],
  59: [10, 8, 3, 0, 5, 6],
  60: [10, 8, 3, 0, 5, 6],
  61: [10, 8, 3, 0, 5, 6],
  62: [10, 8, 3, 0, 5, 6],
  63: [10, 8, 3, 0, 5, 6],
  64: [10, 8, 3, 0, 5, 6],
  65: [10, 8, 3, 0, 5, 6],
  66: [10, 8, 3, 0, 5, 6],
  67: [10, 8, 3, 0, 5, 6],
  68: [10, 8, 3, 0, 5, 6],
  69: [10, 8, 3, 0, 5, 6],
  70: [10, 8, 3, 0, 5, 6],
};

export class Shinkiro extends Kagerou {
  protected override CLASS_NAME = ClassName.Shinkiro;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.Shinkiro];
  private readonly atkSkillList4th: AtkSkillModel[] = [
    {
      name: 'Shadow Hunting',
      label: '[V2] Shadow Hunting Lv10',
      value: 'Shadow Hunting==10',
      acd: 0.15,
      fct: 0,
      vct: 0,
      cd: 0.3,
      isMelee: true,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Shadow Flash');

        return (500 + skillLevel * (400 + skillBonusLv * 5) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Shadow Dance',
      label: '[V2] Shadow Dance Lv10',
      value: 'Shadow Dance==10',
      acd: 0.25,
      fct: 0,
      vct: 0,
      cd: 0.5,
      isMelee: true,
      hit: 5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Shadow Hunting');

        return (400 + skillLevel * (550 + skillBonusLv * 50) + totalPow * 4) * (baseLevel / 100);
      },
    },
    {
      name: 'Shadow Flash',
      label: '[V2] Shadow Flash Lv10',
      value: 'Shadow Flash==10',
      acd: 0.25,
      fct: 0,
      vct: 0,
      cd: 0.5,
      isMelee: true,
      // Lands as 4 displayed hits and *can crit*, both confirmed against the in-game
      // replays in Shinkiro.shadow-flash-replay.spec.ts. Neither the in-game description
      // nor bROWiki mentions the critical, but the recordings are unambiguous: 41% of the
      // casts come out at exactly criMultiplier (1,40 + T.Crít 35%) times the others.
      hit: 4,
      canCri: true,
      // Skill criticals take only half of the *equipment* "Dano Crítico +N%" — the rule
      // every other can-crit 4th-job skill here follows, measured in game on the Night
      // Watch recording (NightWatch.replay.spec.ts: a pet's crit damage +1% lands as
      // ×1.005). The replays above have no gear, so they pin the base 1,40 + T.Crít leg
      // and say nothing about this one. See Shinkiro.shadow-flash-crit-damage.spec.ts.
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Shadow Dance');

        // ATK 1,700 + Lv × 800, + Dança das Trevas Lv × 100 per skill level (the pt-BR
        // client description and browiki.org/wiki/Centelha_das_Trevas).
        return (1700 + skillLevel * (800 + skillBonusLv * 100) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Huuma Shuriken - Grasp',
      label: '[V2] Huuma Shuriken - Grasp Lv10',
      value: 'Huuma Shuriken - Grasp==10',
      acd: 0,
      fct: 1,
      vct: 1.2,
      cd: 1,
      totalHit: 20,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Huuma Shuriken - Construct');

        return (700 + skillLevel * (200 + skillBonusLv * 5) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Huuma Shuriken - Construct',
      label: '[V2] Huuma Shuriken - Construct Lv10',
      value: 'Huuma Shuriken - Construct==10',
      acd: 0,
      fct: 1,
      vct: 1.2,
      cd: 1,
      hit: 9,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Huuma Shuriken - Grasp');
        const primary = (600 + skillLevel * (400 + skillBonusLv * 30) + totalPow * 5) * (baseLevel / 100);
        const secondary = (800 + skillLevel * (600 + skillBonusLv * 30) + totalPow * 5) * (baseLevel / 100);

        return primary + secondary;
      },
    },
    {
      name: 'Kunai - Distortion',
      label: '[V2] Kunai - Distortion Lv10',
      value: 'Kunai - Distortion==10',
      acd: 0.5,
      fct: 0,
      vct: 0.2,
      cd: 0.35,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Kunai - Refraction');

        return (300 + skillLevel * (600 + skillBonusLv * 10) + totalPow * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Kunai - Rotation',
      label: '[V2] Kunai - Rotation Lv5',
      value: 'Kunai - Rotation==5',
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 2,
      totalHit: 4,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Kunai - Distortion');

        return (800 + skillLevel * (700 + skillBonusLv * 70) + totalPow * 4) * (baseLevel / 100);
      },
    },
    {
      name: 'Kunai - Refraction',
      label: '[V2] Kunai - Refraction Lv10',
      value: 'Kunai - Refraction==10',
      acd: 0.5,
      fct: 0.5,
      vct: 1.5,
      cd: 2,
      totalHit: 8,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Kunai - Rotation');

        return (200 + skillLevel * (360 + skillBonusLv * 10) + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Red Flame Cannon',
      label: '[V2] Red Flame Cannon Lv10',
      value: 'Red Flame Cannon==10',
      acd: 0,
      fct: 1,
      vct: 2,
      cd: 0.7,
      element: ElementType.Fire,
      isMatk: true,
      hit: 3,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Darkening Cannon');

        return (850 + skillLevel * (1250 + skillBonusLv * 70) + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Cold Blooded Cannon',
      label: '[V2] Cold Blooded Cannon Lv10',
      value: 'Cold Blooded Cannon==10',
      acd: 0,
      fct: 1,
      vct: 3,
      cd: 0.5,
      element: ElementType.Water,
      isMatk: true,
      hit: 6,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Darkening Cannon');

        return (250 + skillLevel * (550 + skillBonusLv * 40) + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Thundering Cannon',
      label: '[V2] Thundering Cannon Lv10',
      value: 'Thundering Cannon==10',
      acd: 0,
      fct: 1,
      vct: 2,
      cd: 0.7,
      element: ElementType.Wind,
      isMatk: true,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Darkening Cannon');

        return (600 + skillLevel * (1300 + skillBonusLv * 70) + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Golden Dragon Cannon',
      label: '[V2] Golden Dragon Cannon Lv10',
      value: 'Golden Dragon Cannon==10',
      acd: 0,
      fct: 1,
      vct: 3,
      cd: 0.3,
      element: ElementType.Earth,
      isMatk: true,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const skillBonusLv = this.learnLv('Darkening Cannon');

        return (300 + skillLevel * (400 + skillBonusLv * 15) + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Darkening Cannon',
      label: '[V2] Darkening Cannon Lv10',
      value: 'Darkening Cannon==10',
      acd: 0,
      fct: 1,
      vct: 3,
      cd: 0.5,
      element: ElementType.Dark,
      isMatk: true,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;

        return (450 + skillLevel * (950) + totalSpl * 5) * (baseLevel / 100);
      },
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      name: 'Shadow Hunting',
      label: 'Shadow Hunting',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Shadow Dance',
      label: 'Shadow Dance',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Shadow Flash',
      label: 'Shadow Flash',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Huuma Shuriken - Construct',
      label: 'Huuma - Construct',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Huuma Shuriken - Grasp',
      label: 'Huuma - Grasp',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Kunai - Distortion',
      label: 'Kunai - Distortion',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Kunai - Rotation',
      label: 'Kunai - Rotation',
      inputType: 'dropdown',
      dropdown: genSkillList(5),
    },
    {
      name: 'Kunai - Refraction',
      label: 'Kunai - Refraction',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
    },
    {
      name: 'Darkening Cannon',
      label: 'Darkening Cannon',
      inputType: 'dropdown',
      dropdown: genSkillList(10),
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
}

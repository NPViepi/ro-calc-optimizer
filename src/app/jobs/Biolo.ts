import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { ElementType } from '../constants';
import { Genetic } from './Genetic';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';
import { genBioloMonsterSkillList } from './summons';

const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 1, 0, 0],
  2: [0, 0, 0, 2, 0, 0],
  3: [0, 0, 0, 2, 1, 0],
  4: [0, 0, 0, 2, 1, 0],
  5: [0, 0, 1, 2, 1, 0],
  6: [0, 0, 1, 2, 1, 0],
  7: [0, 0, 1, 2, 2, 0],
  8: [0, 0, 2, 3, 2, 0],
  9: [0, 1, 2, 3, 2, 0],
  10: [0, 1, 2, 3, 2, 0],
  11: [0, 1, 3, 3, 2, 0],
  12: [0, 1, 3, 3, 2, 0],
  13: [0, 1, 3, 4, 2, 0],
  14: [0, 1, 3, 4, 3, 0],
  15: [0, 1, 3, 4, 3, 0],
  16: [0, 1, 4, 4, 3, 0],
  17: [0, 1, 4, 4, 3, 1],
  18: [1, 1, 4, 4, 3, 1],
  19: [1, 1, 5, 4, 3, 1],
  20: [1, 1, 5, 4, 4, 1],
  21: [1, 2, 5, 4, 4, 1],
  22: [1, 2, 5, 4, 4, 1],
  23: [1, 2, 5, 4, 4, 1],
  24: [1, 2, 5, 5, 4, 1],
  25: [1, 2, 6, 5, 4, 1],
  26: [1, 2, 7, 5, 4, 1],
  27: [1, 2, 7, 5, 4, 1],
  28: [1, 2, 7, 5, 4, 1],
  29: [1, 2, 7, 5, 5, 1],
  30: [1, 3, 7, 5, 5, 1],
  31: [1, 3, 7, 5, 5, 1],
  32: [1, 3, 7, 5, 5, 2],
  33: [1, 3, 7, 5, 5, 2],
  34: [1, 3, 7, 5, 5, 2],
  35: [2, 3, 7, 6, 5, 2],
  36: [3, 3, 7, 7, 5, 2],
  37: [3, 3, 7, 8, 6, 2],
  38: [3, 3, 7, 8, 6, 2],
  39: [3, 3, 7, 8, 6, 2],
  40: [3, 4, 7, 8, 7, 2],
  41: [4, 5, 7, 8, 7, 2],
  42: [4, 5, 8, 9, 7, 2],
  43: [4, 5, 8, 9, 7, 3],
  44: [4, 5, 8, 9, 8, 3],
  45: [4, 5, 8, 10, 8, 3],
  46: [4, 5, 8, 11, 8, 3],
  47: [4, 5, 8, 11, 8, 3],
  48: [4, 6, 8, 12, 8, 3],
  49: [4, 6, 8, 12, 8, 4],
  50: [5, 6, 8, 12, 8, 4],
  51: [5, 6, 8, 12, 8, 4],
  52: [5, 6, 8, 12, 8, 4],
  53: [5, 6, 8, 12, 8, 4],
  54: [5, 6, 8, 12, 8, 4],
  55: [5, 6, 8, 12, 8, 4],
  56: [5, 6, 8, 12, 8, 4],
  57: [5, 6, 8, 12, 8, 4],
  58: [5, 6, 8, 12, 8, 4],
  59: [5, 6, 8, 12, 8, 4],
  60: [5, 6, 8, 12, 8, 4],
  61: [5, 6, 8, 12, 8, 4],
  62: [5, 6, 8, 12, 8, 4],
  63: [5, 6, 8, 12, 8, 4],
  64: [5, 6, 8, 12, 8, 4],
  65: [5, 6, 8, 12, 8, 4],
  66: [5, 6, 8, 12, 8, 4],
  67: [5, 6, 8, 12, 8, 4],
  68: [5, 6, 8, 12, 8, 4],
  69: [5, 6, 8, 12, 8, 4],
  70: [5, 6, 8, 12, 8, 4],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 0, 1],
  3: [0, 0, 0, 0, 0, 1],
  4: [0, 1, 0, 1, 0, 1],
  5: [0, 1, 0, 1, 0, 1],
  6: [0, 1, 0, 2, 1, 1],
  7: [0, 1, 0, 2, 1, 1],
  8: [0, 1, 0, 2, 1, 1],
  9: [0, 1, 0, 2, 1, 1],
  10: [0, 1, 1, 2, 1, 1],
  11: [0, 1, 1, 2, 2, 1],
  12: [0, 1, 1, 2, 2, 2],
  13: [0, 1, 1, 2, 2, 2],
  14: [0, 1, 1, 2, 2, 2],
  15: [0, 1, 1, 3, 2, 3],
  16: [0, 1, 1, 3, 2, 3],
  17: [0, 1, 1, 3, 2, 3],
  18: [1, 1, 1, 3, 2, 3],
  19: [1, 1, 1, 3, 3, 3],
  20: [1, 1, 1, 3, 3, 3],
  21: [2, 1, 1, 3, 3, 3],
  22: [2, 1, 1, 3, 4, 3],
  23: [2, 2, 1, 3, 4, 3],
  24: [2, 2, 1, 3, 4, 4],
  25: [3, 2, 1, 3, 4, 4],
  26: [3, 2, 1, 3, 4, 4],
  27: [4, 2, 2, 3, 4, 4],
  28: [4, 2, 2, 3, 4, 5],
  29: [4, 2, 2, 3, 4, 6],
  30: [4, 2, 2, 3, 4, 6],
  31: [4, 2, 2, 3, 5, 6],
  32: [4, 2, 2, 3, 5, 7],
  33: [5, 2, 2, 3, 5, 7],
  34: [5, 2, 2, 4, 5, 7],
  35: [5, 2, 2, 4, 5, 7],
  36: [5, 2, 2, 4, 5, 7],
  37: [5, 2, 2, 4, 5, 7],
  38: [6, 2, 2, 4, 5, 7],
  39: [6, 2, 3, 4, 5, 8],
  40: [6, 2, 3, 4, 5, 8],
  41: [6, 2, 3, 4, 5, 8],
  42: [6, 2, 3, 4, 5, 8],
  43: [6, 2, 4, 4, 5, 8],
  44: [6, 2, 4, 4, 5, 9],
  45: [6, 2, 4, 4, 5, 9],
  46: [6, 2, 4, 4, 5, 9],
  47: [6, 2, 4, 4, 6, 9],
  48: [6, 2, 4, 4, 6, 9],
  49: [6, 3, 4, 4, 6, 9],
  50: [6, 3, 4, 4, 6, 10],
  51: [6, 3, 4, 4, 6, 11],
  52: [6, 4, 4, 4, 6, 11],
  53: [7, 4, 4, 4, 6, 12],
  54: [7, 4, 4, 4, 6, 12],
  55: [7, 4, 4, 4, 7, 12],
  56: [7, 5, 4, 4, 7, 12],
  57: [7, 5, 4, 4, 7, 12],
  58: [7, 5, 4, 4, 7, 12],
  59: [8, 5, 4, 4, 7, 12],
  60: [8, 5, 4, 4, 7, 12],
  61: [8, 5, 4, 4, 7, 12],
  62: [8, 5, 4, 4, 7, 12],
  63: [8, 5, 4, 4, 7, 12],
  64: [8, 5, 4, 4, 7, 12],
  65: [8, 5, 4, 4, 7, 12],
  66: [8, 5, 4, 4, 7, 12],
  67: [8, 5, 4, 4, 7, 12],
  68: [8, 5, 4, 4, 7, 12],
  69: [8, 5, 4, 4, 7, 12],
  70: [8, 5, 4, 4, 7, 12],
};

export class Biolo extends Genetic {
  protected override CLASS_NAME = ClassName.Biolo;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.Biolo];

  // Acidified Zone (2nd version): one ranged-physical skill per element, 5 hits.
  // Base ratio = lv*400 + POW*(1 + Bionic Pharmacy lv). Research Report multiplies the
  // whole thing x1.5; if RR is up AND the target is Formless/Plant, the POW part is also
  // x1.5 (so x1.5 inside and x1.5 overall). Each consumes its matching Acid Bottle.
  private acidifiedZoneFormula = (input: AtkSkillFormulaInput): number => {
    const { model, skillLevel, status, monster } = input;
    const { totalPow } = status;
    const baseLevel = model.level;
    const bionicLv = this.learnLv('Bionic Pharmacy');

    const researchReport = this.isSkillActive('Research Report');
    const powMult = researchReport && monster.isRace('formless', 'plant') ? 1.5 : 1;
    const overallMult = researchReport ? 1.5 : 1;
    const powPart = totalPow * (1 + bionicLv) * powMult;

    return (skillLevel * 400 + powPart) * (baseLevel / 100) * overallMult;
  };

  private acidifiedZone(name: AtkSkillModel['name'], element: ElementType): AtkSkillModel {
    return {
      name,
      label: `[V2] ${name} Lv5`,
      value: `${name}==5`,
      acd: 0.15,
      fct: 0.5,
      vct: 1,
      cd: 0.5,
      element,
      totalHit: 5,
      formula: this.acidifiedZoneFormula,
    };
  }

  private readonly atkSkillList4th: AtkSkillModel[] = [
    this.acidifiedZone('Acidified Zone Earth', ElementType.Earth),
    this.acidifiedZone('Acidified Zone Wind', ElementType.Wind),
    this.acidifiedZone('Acidified Zone Fire', ElementType.Fire),
    this.acidifiedZone('Acidified Zone Water', ElementType.Water),
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      name: '_Biolo_Monster_List',
      label: 'Invocação',
      inputType: 'dropdown',
      dropdown: genBioloMonsterSkillList(),
    },
    {
      name: 'Research Report',
      label: 'Research Report',
      inputType: 'selectButton',
      dropdown: [
        { label: 'Sim', value: 1, isUse: true },
        { label: 'Não', value: 0, isUse: false },
      ],
    },
    {
      // Tempering (MH_TEMPERING, skill 8045): self-buff granting P.Atk, +1 per level
      // (Lv 1 = +6 … Lv 10 = +15). divine-pride.net/database/skill/8045
      name: 'Tempering',
      label: 'Tempering',
      icon: 8045,
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Nv 1', value: 1, isUse: true, bonus: { pAtk: 6 } },
        { label: 'Nv 2', value: 2, isUse: true, bonus: { pAtk: 7 } },
        { label: 'Nv 3', value: 3, isUse: true, bonus: { pAtk: 8 } },
        { label: 'Nv 4', value: 4, isUse: true, bonus: { pAtk: 9 } },
        { label: 'Nv 5', value: 5, isUse: true, bonus: { pAtk: 10 } },
        { label: 'Nv 6', value: 6, isUse: true, bonus: { pAtk: 11 } },
        { label: 'Nv 7', value: 7, isUse: true, bonus: { pAtk: 12 } },
        { label: 'Nv 8', value: 8, isUse: true, bonus: { pAtk: 13 } },
        { label: 'Nv 9', value: 9, isUse: true, bonus: { pAtk: 14 } },
        { label: 'Nv 10', value: 10, isUse: true, bonus: { pAtk: 15 } },
      ],
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      name: 'Bionic Pharmacy',
      label: 'Bionic Pharmacy',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Nv 1', value: 1, isUse: true },
        { label: 'Nv 2', value: 2, isUse: true },
        { label: 'Nv 3', value: 3, isUse: true },
        { label: 'Nv 4', value: 4, isUse: true },
        { label: 'Nv 5', value: 5, isUse: true },
      ],
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

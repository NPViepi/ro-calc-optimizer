import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { ElementType, WeaponSubTypeName } from '../constants';
import { EquipmentSummaryModel } from '../models/equipment-summary.model';
import { ClassAutoCastDefinition } from '../models/auto-cast.model';
import { AdditionalBonusInput } from '../models/info-for-class.model';
import { addBonus, genSkillList, genSkillListWithLabel } from '../utils';
import { Rebellion } from './Rebellion';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

/**
 * Every Night Watch attack skill exposes its levels: the recordings that validate the
 * formulas (NightWatch.replay.spec.ts) were made with the skills at Lv1, and a real build
 * rarely maxes all of them.
 */
const levelList = (name: string, maxLv: number) =>
  Array.from({ length: maxLv }, (_, i) => ({ label: `${name} Nv${i + 1}`, value: `${name}==${i + 1}` }));

// rAthena battle.cpp: SC_AUTO_FIRING_LAUNCHER rolls each learned grenade skill separately.
const AUTO_FIRING_RATES = [
  { name: 'Basic Grenade', label: 'Arremessar Explosivo', id: 5410, rates: [0, 6, 7, 8, 9, 10] },
  { name: 'Hasty Fire in the Hole', label: 'Explosão Gradual', id: 5411, rates: [0, 0, 0, 3, 5, 7] },
  { name: 'Grenade Dropping', label: 'Detonação Total', id: 5412, rates: [0, 0, 0, 0, 0, 3] },
] as const;

const NIGHT_WATCH_AUTO_CASTS: ClassAutoCastDefinition[] = [{
  key: 'auto-firing-launcher',
  resolve: ({ skillState }) => {
    const level = skillState.activeLevel('Auto Firing Launcher');
    const sources = AUTO_FIRING_RATES.flatMap(({ name, label, id, rates }) => {
      const chance = rates[level] ?? 0;
      const skillLevel = skillState.learnedLevel(name);
      if (!chance || !skillLevel || id === 5412) return [];
      return [{
        key: `auto-firing-launcher-${id}`, kind: 'passive' as const, skillId: id,
        skillLevel, chance, trigger: 'physical-attack' as const,
        sourceName: 'Disparo Automático', enablingSkillId: 5413,
        chanceBreakdown: [
          { label: 'Disparo Automático', value: `Nv. ${level}` },
          { label, value: `Nv. ${skillLevel} · ${chance}%` },
        ],
      }];
    });
    const blocked = AUTO_FIRING_RATES.flatMap(({ name, label, id, rates }) => {
      const requiredLevel = rates.findIndex((chance) => chance > 0);
      const reasons = [
        ...(level < requiredLevel ? [`Selecione Disparo Automático Nv. ${requiredLevel} ou maior em Habilidades`] : []),
        ...(!skillState.learnedLevel(name) ? [`Aprenda ${label} em Habilidades`] : []),
      ];
      if (id === 5412 && !reasons.length) {
        reasons.push('Chance de 3% confirmada; o dano depende da posição aleatória das granadas e ainda não pode ser calculado.');
      }
      return reasons.length ? [{ key: `auto-firing-launcher-${id}`, name: label, icon: id, reason: reasons.join(' · ') }] : [];
    });
    return { sources, blocked };
  },
}];

/**
 * Job bonus (STR/AGI/VIT/INT/DEX/LUK) — irowiki.org/wiki/Night_Watch, "Job & Talent
 * Bonuses" section. That table lists, per stat, the job levels at which it reaches +1,
 * +2, +3...; here it is expanded per level.
 * Checked line by line in NightWatch.job-bonus.spec.ts.
 */
const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 0, 0, 0],
  2: [2, 1, 0, 0, 0, 1],
  3: [2, 1, 1, 0, 0, 1],
  4: [2, 1, 1, 1, 0, 2],
  5: [2, 1, 2, 2, 0, 2],
  6: [2, 1, 3, 2, 1, 2],
  7: [2, 1, 3, 2, 2, 2],
  8: [2, 2, 3, 2, 2, 2],
  9: [2, 2, 3, 2, 2, 3],
  10: [2, 2, 3, 2, 2, 4],
  11: [2, 2, 3, 2, 3, 4],
  12: [2, 3, 3, 2, 4, 4],
  13: [2, 4, 3, 2, 4, 5],
  14: [2, 4, 3, 3, 5, 5],
  15: [2, 4, 3, 3, 5, 6],
  16: [2, 4, 4, 4, 5, 6],
  17: [2, 4, 4, 5, 5, 6],
  18: [2, 4, 4, 5, 6, 6],
  19: [2, 4, 4, 6, 7, 6],
  20: [2, 5, 5, 6, 7, 6],
  21: [2, 5, 5, 6, 8, 6],
  22: [2, 5, 5, 6, 9, 6],
  23: [2, 6, 5, 6, 9, 6],
  24: [2, 7, 5, 6, 9, 6],
  25: [2, 7, 5, 6, 9, 7],
  26: [2, 7, 5, 7, 9, 7],
  27: [2, 7, 5, 7, 10, 7],
  28: [2, 7, 5, 7, 10, 7],
  29: [2, 7, 6, 7, 10, 7],
  30: [3, 7, 6, 8, 10, 7],
  31: [3, 7, 6, 8, 11, 7],
  32: [3, 8, 6, 8, 11, 7],
  33: [3, 8, 6, 8, 11, 7],
  34: [3, 8, 6, 8, 11, 7],
  35: [3, 8, 6, 8, 11, 7],
  36: [3, 8, 6, 8, 11, 7],
  37: [3, 8, 6, 8, 11, 7],
  38: [3, 8, 6, 8, 11, 7],
  39: [3, 8, 6, 8, 11, 7],
  40: [3, 8, 6, 8, 11, 7],
  41: [3, 8, 6, 8, 11, 7],
  42: [3, 8, 6, 8, 11, 7],
  43: [3, 8, 6, 8, 11, 7],
  44: [3, 8, 6, 8, 11, 7],
  45: [3, 8, 6, 8, 11, 7],
  46: [3, 8, 6, 8, 11, 7],
  47: [3, 8, 6, 8, 11, 7],
  48: [3, 8, 6, 8, 11, 7],
  49: [3, 8, 6, 8, 11, 7],
  50: [3, 8, 6, 8, 11, 7],
  51: [3, 8, 6, 8, 11, 7],
  52: [3, 8, 6, 8, 11, 7],
  53: [3, 8, 6, 8, 11, 7],
  54: [3, 8, 6, 8, 11, 7],
  55: [3, 8, 6, 8, 11, 7],
  56: [3, 8, 6, 8, 11, 7],
  57: [3, 8, 6, 8, 11, 7],
  58: [3, 8, 6, 8, 11, 7],
  59: [3, 8, 6, 8, 11, 7],
  60: [3, 8, 6, 8, 11, 7],
  61: [3, 8, 6, 8, 11, 7],
  62: [3, 8, 6, 8, 11, 7],
  63: [3, 8, 6, 8, 11, 7],
  64: [3, 8, 6, 8, 11, 7],
  65: [3, 8, 6, 8, 11, 7],
  66: [3, 8, 6, 8, 11, 7],
  67: [3, 8, 6, 8, 11, 7],
  68: [3, 8, 6, 8, 11, 7],
  69: [3, 8, 6, 8, 11, 7],
  70: [3, 8, 6, 8, 11, 7],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 1, 0, 0, 0, 0],
  2: [0, 1, 0, 0, 0, 0],
  3: [0, 1, 0, 0, 0, 0],
  4: [0, 1, 0, 0, 0, 0],
  5: [0, 1, 0, 0, 0, 0],
  6: [0, 1, 0, 0, 0, 0],
  7: [1, 1, 0, 0, 0, 0],
  8: [1, 1, 0, 0, 0, 0],
  9: [1, 1, 0, 0, 0, 0],
  10: [1, 1, 1, 0, 0, 0],
  11: [1, 1, 1, 0, 0, 0],
  12: [1, 1, 1, 0, 0, 0],
  13: [1, 1, 1, 0, 0, 0],
  14: [1, 1, 1, 0, 0, 0],
  15: [1, 2, 1, 0, 0, 0],
  16: [1, 2, 1, 0, 0, 0],
  17: [1, 2, 1, 0, 0, 0],
  18: [1, 2, 1, 0, 0, 0],
  19: [1, 2, 1, 0, 0, 0],
  20: [1, 2, 1, 0, 0, 0],
  21: [2, 2, 1, 0, 0, 0],
  22: [2, 2, 2, 0, 0, 0],
  23: [3, 2, 2, 0, 0, 0],
  24: [3, 2, 2, 0, 0, 0],
  25: [3, 2, 2, 0, 0, 0],
  26: [3, 2, 2, 0, 1, 0],
  27: [3, 2, 2, 0, 1, 1],
  28: [3, 2, 2, 0, 2, 1],
  29: [3, 2, 2, 0, 2, 1],
  30: [3, 2, 2, 0, 2, 1],
  31: [3, 2, 2, 0, 3, 1],
  32: [4, 2, 2, 0, 3, 1],
  33: [4, 3, 2, 0, 3, 2],
  34: [4, 3, 2, 0, 3, 3],
  35: [5, 3, 2, 0, 3, 3],
  36: [5, 3, 2, 0, 4, 4],
  37: [5, 3, 2, 0, 4, 4],
  38: [5, 3, 3, 0, 5, 4],
  39: [5, 3, 3, 0, 5, 4],
  40: [6, 3, 3, 0, 5, 4],
  41: [6, 4, 3, 0, 6, 4],
  42: [6, 5, 3, 0, 6, 4],
  43: [6, 5, 3, 0, 6, 5],
  44: [7, 5, 3, 0, 6, 5],
  45: [7, 5, 3, 0, 7, 5],
  46: [8, 6, 3, 0, 7, 5],
  47: [8, 6, 3, 0, 8, 5],
  48: [8, 6, 4, 0, 8, 5],
  49: [8, 6, 4, 0, 9, 5],
  50: [9, 6, 4, 0, 9, 5],
  51: [9, 6, 4, 0, 10, 5],
  52: [9, 6, 4, 0, 10, 5],
  53: [10, 6, 4, 0, 11, 5],
  54: [10, 6, 5, 0, 11, 5],
  55: [11, 6, 5, 0, 11, 5],
  56: [11, 6, 6, 0, 11, 5],
  57: [11, 6, 6, 0, 11, 5],
  58: [11, 6, 6, 0, 11, 5],
  59: [11, 6, 6, 0, 11, 6],
  60: [11, 6, 6, 0, 11, 6],
  61: [11, 6, 6, 0, 11, 6],
  62: [11, 6, 6, 0, 11, 6],
  63: [11, 6, 6, 0, 11, 6],
  64: [11, 6, 6, 0, 11, 6],
  65: [11, 6, 6, 0, 11, 6],
  66: [11, 6, 6, 0, 11, 6],
  67: [11, 6, 6, 0, 11, 6],
  68: [11, 6, 6, 0, 11, 6],
  69: [11, 6, 6, 0, 11, 6],
  70: [11, 6, 6, 0, 11, 6],
};

export class NightWatch extends Rebellion {
  protected override CLASS_NAME = ClassName.NightWatch;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.NightWatch];
  /**
   * The per-level percentages come from the **client description**
   * (skill-meta.generated.ts), not the Sigma blog: the `[V2]` tables were out of date on
   * six of the seven skills — only Vigília Noturna matched. Each client row is linear in
   * the level, so the formula is `base + perLevel × Lv + aim × perAim × Lv`, and the CON
   * term (which the description mentions without a number) is the one the recordings
   * measured. Validated in NightWatch.replay.spec.ts.
   */
  private readonly atkSkillList4th: AtkSkillModel[] = [
    {
      name: 'The Vigilante at Night',
      label: 'The Vigilante at Night Lv5',
      value: 'The Vigilante at Night==5',
      levelList: levelList('The Vigilante at Night', 5),
      acd: 1,
      fct: 1.5,
      vct: 0,
      cd: 0.5,
      isIgnoreDef: ({ weapon }) => weapon.isSubType('Gatling Gun'),
      totalHit: ({ weapon }) => weapon.isSubType('Gatling Gun') ? 7 : 4,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponSubTypeName[] = ['Gatling Gun', 'Shotgun'];
        if (requires.some(subT => weapon.isSubType(subT))) return '';

        return requires.join(', ');
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalCon } = status;
        const baseLevel = model.level;

        const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count');

        if (weapon.isSubType('Gatling Gun')) {
          return (skillLevel * (300 + aimningCnt * 100) + totalCon * 2) * (baseLevel / 100);
        }

        return (800 + skillLevel * (700 + aimningCnt * 200) + totalCon * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Only One Bullet',
      label: 'Only One Bullet Lv5',
      value: 'Only One Bullet==5',
      levelList: levelList('Only One Bullet', 5),
      acd: 0.5,
      fct: 1,
      vct: 0,
      cd: 0.3,
      isIgnoreDef: ({ weapon }) => weapon.isSubType('Revolver'),
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponSubTypeName[] = ['Rifle', 'Revolver'];
        if (requires.some(subT => weapon.isSubType(subT))) return '';

        return requires.join(', ');
      },
      canCri: ({ weapon }) => weapon.isSubType('Rifle'),
      baseCriPercentage: 1,
      criDmgPercentage: 0.5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalCon } = status;
        const baseLevel = model.level;
        const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count');

        if (weapon.isSubType('Revolver')) {
          return (1500 + skillLevel * (1000 + aimningCnt * 250) + totalCon * 3) * (baseLevel / 100);
        }

        return (500 + skillLevel * (850 + aimningCnt * 250) + totalCon * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Spiral Shooting',
      label: 'Spiral Shooting Lv5',
      value: 'Spiral Shooting==5',
      levelList: levelList('Spiral Shooting', 5),
      acd: 1,
      fct: 1.5,
      vct: 0,
      cd: 0.5,
      canCri: ({ weapon }) => weapon.isSubType('Rifle'),
      baseCriPercentage: 1,
      criDmgPercentage: 0.5,
      totalHit: ({ weapon }) => weapon.isSubType('Grenade Launcher') ? 2 : 1,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponSubTypeName[] = ['Grenade Launcher', 'Rifle'];
        if (requires.some(subT => weapon.isSubType(subT))) return '';

        return requires.join(', ');
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalCon } = status;
        const baseLevel = model.level;
        const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count');

        if (weapon.isSubType('Rifle')) {
          return (400 + skillLevel * (900 + aimningCnt * 150) + totalCon * 3) * (baseLevel / 100);
        }

        return (1000 + skillLevel * (1000 + aimningCnt * 150) + totalCon * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Magazine for One',
      label: 'Magazine for One Lv5',
      value: 'Magazine for One==5',
      levelList: levelList('Magazine for One', 5),
      acd: 1,
      fct: 1,
      vct: 0,
      cd: 0.5,
      canCri: ({ weapon }) => weapon.isSubType('Revolver'),
      criDmgPercentage: 0.5,
      totalHit: ({ weapon }) => weapon.isSubType('Gatling Gun') ? 10 : 6,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponSubTypeName[] = ['Gatling Gun', 'Revolver'];
        if (requires.some(subT => weapon.isSubType(subT))) return '';

        return requires.join(', ');
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalCon } = status;
        const baseLevel = model.level;
        const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count');

        if (weapon.isSubType('Revolver')) {
          return (100 + skillLevel * (400 + aimningCnt * 50) + totalCon * 2) * (baseLevel / 100);
        }

        return (200 + skillLevel * (300 + aimningCnt * 50) + totalCon * 2) * (baseLevel / 100);
      },
    },
    {
      name: 'Wild Fire',
      label: 'Wild Fire Lv5',
      value: 'Wild Fire==5',
      levelList: levelList('Wild Fire', 5),
      acd: 1,
      fct: 1,
      vct: 0,
      cd: 0.5,
      hit: 3,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponSubTypeName[] = ['Shotgun', 'Grenade Launcher'];
        if (requires.some(subT => weapon.isSubType(subT))) return '';

        return requires.join(', ');
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalCon } = status;
        const baseLevel = model.level;
        const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count');

        if (weapon.isSubType('Shotgun')) {
          return (500 + skillLevel * (1500 + aimningCnt * 500) + totalCon * 3) * (baseLevel / 100);
        }

        return (500 + skillLevel * (1300 + aimningCnt * 500) + totalCon * 3) * (baseLevel / 100);
      },
    },
    {
      name: 'Basic Grenade',
      label: 'Basic Grenade Lv5',
      value: 'Basic Grenade==5',
      levelList: levelList('Basic Grenade', 5),
      acd: 0,
      fct: 1,
      vct: 0,
      cd: 0.3,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, } = input;
        const { totalCon } = status;
        const baseLevel = model.level;

        const grenadeMaster = this.learnLv('Grenade Mastery');

        return (1000 + skillLevel * 900 + grenadeMaster * 50 + totalCon * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Hasty Fire in the Hole',
      label: 'Hasty Fire in the Hole Lv5',
      value: 'Hasty Fire in the Hole==5',
      levelList: levelList('Hasty Fire in the Hole', 5),
      acd: 0,
      fct: 1,
      vct: 0,
      cd: 1,
      totalHit: 3,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, } = input;
        const { totalCon } = status;
        const baseLevel = model.level;

        const grenadeMaster = this.learnLv('Grenade Mastery');

        return (1500 + skillLevel * 900 + grenadeMaster * 20 + totalCon * 3) * (baseLevel / 100);
      },
    },
    // {
    //   name: 'Grenade Dropping',
    //   label: 'Grenade Dropping Lv5',
    //   value: 'Grenade Dropping==5',
    //   acd: 0,
    //   fct: 1,
    //   vct: 0,
    //   cd: 4.5,
    //   isIgnoreDef: ({weapon}) => weapon.isSubType('Gatling Gun'),
    //   totalHit: ({weapon}) => weapon.isSubType('Gatling Gun') ? 7 : 4,
    //   verifyItemFn: ({weapon}) => {
    //     const requires: WeaponSubTypeName[] = ['Gatling Gun', 'Shotgun']
    //     if (requires.some(subT => weapon.isSubType(subT))) return ''

    //     return requires.join(', ')
    //   },
    //   formula: (input: AtkSkillFormulaInput): number => {
    //     const { model, skillLevel, status, weapon } = input;
    //     const { totalCon } = status;
    //     const baseLevel = model.level;

    //     const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count')

    //     if (weapon.isSubType('Gatling Gun')) {
    //       return (300*skillLevel+ aimningCnt*skillLevel* 100+totalCon*5) * (baseLevel / 100);
    //     }

    //     return (800 +700*skillLevel+ aimningCnt*skillLevel* 200+totalCon*5) * (baseLevel / 100);
    //   },
    // },
    // {
    //   name: 'Mission Bombard',
    //   label: 'Mission Bombard Lv10',
    //   value: 'Mission Bombard==10',
    //   acd: 1,
    //   fct: 1,
    //   vct: 0,
    //   cd: 10,
    //   formula: (input: AtkSkillFormulaInput): number => {
    //     const { model, skillLevel, status } = input;
    //     const { totalCon } = status;
    //     const baseLevel = model.level;

    //     const grenadeMaster = this.learnLv('Grenade Mastery')

    //     return (5000 + 1800 * skillLevel + grenadeMaster * 100 + totalCon * 5) * (baseLevel / 100);
    //   },
    //   secondaryDmgInput: {
    //     label: 'Bomb',
    //     isIncludeMain: false,
    //     totalHit: 10,
    //     formula: (input: AtkSkillFormulaInput): number => {
    //       const { model, skillLevel, status } = input;
    //       const { totalCon } = status;
    //       const baseLevel = model.level;

    //       const grenadeMaster = this.learnLv('Grenade Mastery')

    //       return (800 + 200 * skillLevel + grenadeMaster * 30 + totalCon * 5) * (baseLevel / 100);
    //     },
    //   }
    // },
    // {
    //   name: 'Wild Shot',
    //   label: 'Wild Shot Lv5',
    //   value: 'Wild Shot==5',
    //   acd: 1,
    //   fct: 1,
    //   vct: 0,
    //   cd: 0.5,
    // canCri: true,
    //   criDmgPercentage: 0.5,
    //   totalHit: 7,
    //   verifyItemFn: ({weapon}) => {
    //     const requires: WeaponSubTypeName[] = ['Gatling Gun', 'Shotgun']
    //     if (requires.some(subT => weapon.isSubType(subT))) return ''

    //     return requires.join(', ')
    //   },
    //   formula: (input: AtkSkillFormulaInput): number => {
    //     const { model, skillLevel, status, weapon } = input;
    //     const { totalCon } = status;
    //     const baseLevel = model.level;

    //     const aimningCnt = this.activeSkillLv('_NightWatch_Aiming Count')

    //     if (weapon.isSubType('Gatling Gun')) {
    //       return (300*skillLevel+ aimningCnt*skillLevel* 100+totalCon*5) * (baseLevel / 100);
    //     }

    //     return (800 +700*skillLevel+ aimningCnt*skillLevel* 200+totalCon*5) * (baseLevel / 100);
    //   },
    // },
    // {
    //   name: 'Midnight Fallen',
    //   label: 'Midnight Fallen Lv5',
    //   value: 'Midnight Fallen==5',
    //   acd: 1,
    //   fct: 1.5,
    //   vct: 0,
    //   cd: 1.5,
    //   isIgnoreDef: true,
    //   totalHit: 3,
    //   verifyItemFn: ({weapon}) => {
    //     const requires: WeaponSubTypeName[] = ['Shotgun', 'Gatling Gun', 'Grenade Launcher']
    //     if (requires.some(subT => weapon.isSubType(subT))) return ''

    //     return requires.join(', ')
    //   },
    //   formula: (input: AtkSkillFormulaInput): number => {
    //     const { model, skillLevel, status, weapon } = input;
    //     const { totalCon } = status;
    //     const baseLevel = model.level;
    //     const hiddenCardBonusMap: Partial<Record<WeaponSubTypeName, number>> = {
    //       Shotgun: 400,
    //       "Gatling Gun": 200,
    //       "Grenade Launcher": 340,
    //     }

    //     const hiddenCardBonus = this.isSkillActive('Hidden Card') ? hiddenCardBonusMap[weapon.data.subTypeName] : 0


    //     return (2400+800*skillLevel+hiddenCardBonus*skillLevel) * (baseLevel / 100);
    //   },
    // },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      name: 'Auto Firing Launcher',
      label: 'Disparo Automático',
      inputType: 'dropdown',
      dropdown: genSkillList(5),
    },
    {
      name: 'Hidden Card',
      label: 'Hidden Card',
      inputType: 'dropdown',
      dropdown: genSkillList(10, lv => ({ range: lv * 10, pAtk: lv * 3 }))
    },
    {
      name: 'Intensive Aim',
      label: 'Intensive Aim',
      inputType: 'selectButton',
      isEquipAtk: true,
      dropdown: [
        { label: 'Sim', value: 1, isUse: true, bonus: { atk: 150, hit: 250, cri: 30 } },
        { label: 'Não', value: 0, isUse: false, },
      ]
    },
    {
      name: 'Grenade Fragment',
      label: 'Grenade Fragment',
      inputType: 'dropdown',
      dropdown: genSkillListWithLabel(6
        , lv => `${['-', 'Water', 'Wind', 'Earth', 'Fire', 'Dark', 'Holy'][lv]}`
        , lv => ({ propertyAtk: [0, ElementType.Water, ElementType.Wind, ElementType.Earth, ElementType.Fire, ElementType.Dark, ElementType.Holy][lv] })
      )
    },
    {
      name: '_NightWatch_Aiming Count',
      // "Pontos de Foco" is what the client calls the counter: Mira Focalizada "acumula
      // 1 ponto a cada 0,5 segundo até um máximo de 10 pontos de foco", and the skill
      // formulas talk about "(Pts. x250)%". It is not a real skill — it is a calculator
      // selector — so it has no id or icon in the catalog.
      label: 'Pontos de Foco',
      inputType: 'dropdown',
      dropdown: genSkillListWithLabel(10, lv => (`${lv}`))
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    ...AUTO_FIRING_RATES.map(({ name, label }) => ({
      name,
      label,
      inputType: 'dropdown' as const,
      dropdown: genSkillList(5),
    })),
    {
      name: 'PFI',
      label: 'P.F.I.',
      inputType: 'dropdown',
      dropdown: genSkillList(10)
    },
    {
      name: 'Grenade Mastery',
      label: 'Grenade Mastery',
      inputType: 'dropdown',
      dropdown: genSkillList(10, lv => ({ con: lv }))
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
    this.inheritAutoCasts(NIGHT_WATCH_AUTO_CASTS);
  }

  override setAdditionalBonus(params: AdditionalBonusInput): EquipmentSummaryModel {
    super.setAdditionalBonus(params);

    const { totalBonus, weapon } = params;

    const pfiLv = this.learnLv('PFI');
    if (pfiLv > 0 && weapon.isType('gun')) {
      addBonus(totalBonus, 'pAtk', pfiLv + 2);
    }

    return totalBonus;
  }
}

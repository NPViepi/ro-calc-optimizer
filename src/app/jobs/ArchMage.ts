import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { ElementType } from '../constants';
import { SKILL_NAME } from '../constants/skill-name';
import { EquipmentSummaryModel } from '../models/equipment-summary.model';
import { AdditionalBonusInput } from '../models/info-for-class.model';
import { DamageFormulaCalc } from '../models/damage-summary.model';
import { SKILL_ID_BY_NAME } from '../skills';
import { SOUL_VULCAN_STRIKE } from '../skills/shared-skills';
import { addBonus, floor, formatCalcNumber, genSkillList } from '../utils';
import { Warlock } from './Warlock';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

/** Every level of a skill, for the level picker in the UI. The label has to keep the
 *  English skill name as its prefix — setClassSkill() swaps that prefix for the pt-BR
 *  one and preserves whatever follows. */
const levelList = (name: string, maxLv: number) =>
  Array.from({ length: maxLv }, (_, i) => ({ label: `${name} Nv${i + 1}`, value: `${name}==${i + 1}` }));

/** Meteoritos de Colisão Astral: um a cada 0,3 s durante os 15 s que a passagem fica aberta. */
const ASTRAL_STRIKE_METEORS = 15 / 0.3;

/** What each Potencializar Magia level does to Cacos de Gelo, for the ratio breakdown. */
const CRYSTAL_IMPACT_CLIMAX_EFFECT: Record<number, string> = {
  1: 'a habilidade deixa de causar dano e ativa [Geleira]',
  2: 'o 1º caco atinge duas vezes',
  3: 'dano do 1º caco +50%',
  4: 'dano do 1º caco -50%, do 2º caco +150%',
  5: 'só aumenta a área',
};

const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 1, 0, 0],
  2: [0, 0, 0, 1, 1, 0],
  3: [0, 0, 0, 1, 1, 0],
  4: [0, 0, 1, 1, 1, 0],
  5: [0, 0, 2, 2, 1, 0],
  6: [0, 0, 2, 2, 1, 1],
  7: [0, 0, 2, 2, 1, 1],
  8: [0, 1, 2, 2, 1, 1],
  9: [1, 2, 2, 2, 1, 1],
  10: [1, 2, 2, 2, 1, 1],
  11: [1, 2, 2, 3, 1, 1],
  12: [1, 2, 3, 4, 1, 1],
  13: [1, 2, 3, 4, 2, 1],
  14: [1, 2, 3, 4, 2, 1],
  15: [1, 2, 3, 4, 2, 2],
  16: [1, 3, 3, 5, 2, 2],
  17: [1, 3, 3, 5, 2, 2],
  18: [1, 3, 3, 6, 3, 2],
  19: [1, 3, 3, 7, 3, 2],
  20: [1, 3, 4, 8, 3, 2],
  21: [1, 3, 4, 8, 3, 3],
  22: [1, 3, 4, 8, 3, 3],
  23: [1, 4, 4, 8, 3, 3],
  24: [1, 4, 4, 8, 4, 3],
  25: [1, 4, 4, 9, 5, 3],
  26: [1, 4, 4, 10, 5, 3],
  27: [1, 4, 4, 10, 5, 3],
  28: [1, 5, 4, 10, 5, 3],
  29: [1, 5, 4, 10, 5, 4],
  30: [1, 5, 4, 10, 5, 4],
  31: [1, 6, 4, 10, 6, 4],
  32: [1, 6, 4, 10, 7, 4],
  33: [1, 6, 4, 10, 7, 4],
  34: [1, 6, 4, 11, 7, 4],
  35: [1, 6, 4, 12, 7, 4],
  36: [1, 6, 4, 12, 7, 4],
  37: [1, 6, 5, 12, 7, 4],
  38: [1, 7, 5, 13, 7, 4],
  39: [1, 7, 5, 13, 8, 4],
  40: [1, 7, 6, 13, 8, 4],
  41: [1, 7, 7, 13, 8, 4],
  42: [1, 7, 7, 13, 8, 4],
  43: [1, 7, 8, 13, 8, 4],
  44: [1, 7, 8, 14, 8, 4],
  45: [1, 7, 8, 14, 8, 4],
  46: [1, 7, 8, 15, 8, 4],
  47: [1, 7, 8, 15, 8, 4],
  48: [1, 7, 8, 15, 8, 4],
  49: [1, 7, 8, 15, 8, 4],
  50: [1, 7, 8, 15, 8, 4],
  51: [1, 7, 8, 15, 8, 4],
  52: [1, 7, 8, 15, 8, 4],
  53: [1, 7, 8, 15, 8, 4],
  54: [1, 7, 8, 15, 8, 4],
  55: [1, 7, 8, 15, 8, 4],
  56: [1, 7, 8, 15, 8, 4],
  57: [1, 7, 8, 15, 8, 4],
  58: [1, 7, 8, 15, 8, 4],
  59: [1, 7, 8, 15, 8, 4],
  60: [1, 7, 8, 15, 8, 4],
  61: [1, 7, 8, 15, 8, 4],
  62: [1, 7, 8, 15, 8, 4],
  63: [1, 7, 8, 15, 8, 4],
  64: [1, 7, 8, 15, 8, 4],
  65: [1, 7, 8, 15, 8, 4],
  66: [1, 7, 8, 15, 8, 4],
  67: [1, 7, 8, 15, 8, 4],
  68: [1, 7, 8, 15, 8, 4],
  69: [1, 7, 8, 15, 8, 4],
  70: [1, 7, 8, 15, 8, 4],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 1, 0, 0],
  2: [0, 0, 0, 1, 0, 0],
  3: [0, 0, 1, 1, 0, 0],
  4: [0, 0, 1, 2, 0, 0],
  5: [0, 0, 1, 2, 0, 0],
  6: [0, 0, 1, 2, 0, 0],
  7: [0, 0, 2, 2, 1, 0],
  8: [0, 0, 2, 2, 1, 0],
  9: [0, 0, 2, 2, 1, 0],
  10: [0, 0, 3, 2, 1, 0],
  11: [0, 0, 3, 2, 1, 0],
  12: [0, 0, 3, 2, 1, 0],
  13: [0, 0, 3, 3, 1, 0],
  14: [0, 1, 3, 3, 2, 0],
  15: [0, 1, 3, 3, 2, 0],
  16: [0, 1, 3, 3, 2, 0],
  17: [0, 2, 3, 3, 2, 0],
  18: [0, 2, 3, 3, 2, 0],
  19: [0, 2, 3, 3, 2, 0],
  20: [0, 2, 3, 3, 2, 0],
  21: [0, 2, 3, 4, 2, 0],
  22: [0, 2, 3, 4, 3, 0],
  23: [0, 3, 3, 4, 3, 0],
  24: [0, 3, 3, 4, 3, 0],
  25: [0, 3, 3, 4, 3, 0],
  26: [0, 3, 3, 5, 3, 0],
  27: [0, 3, 3, 5, 4, 0],
  28: [0, 3, 3, 5, 4, 0],
  29: [0, 3, 3, 6, 4, 0],
  30: [0, 3, 3, 6, 4, 1],
  31: [0, 3, 3, 6, 4, 1],
  32: [0, 3, 3, 6, 4, 1],
  33: [0, 3, 3, 6, 5, 1],
  34: [0, 3, 3, 6, 6, 1],
  35: [0, 3, 3, 6, 6, 1],
  36: [0, 3, 3, 7, 6, 1],
  37: [0, 3, 3, 8, 6, 1],
  38: [0, 3, 3, 8, 6, 1],
  39: [0, 3, 3, 8, 6, 1],
  40: [0, 3, 3, 8, 6, 1],
  41: [0, 4, 3, 8, 6, 1],
  42: [0, 4, 3, 8, 7, 1],
  43: [0, 4, 3, 9, 7, 1],
  44: [0, 5, 3, 9, 7, 1],
  45: [0, 5, 4, 9, 7, 1],
  46: [0, 5, 4, 10, 7, 1],
  47: [0, 5, 4, 11, 7, 1],
  48: [0, 6, 5, 11, 7, 1],
  49: [0, 6, 5, 11, 8, 1],
  50: [0, 7, 6, 11, 8, 1],
  51: [0, 7, 6, 11, 8, 1],
  52: [0, 7, 6, 12, 8, 1],
  53: [0, 7, 6, 12, 9, 1],
  54: [0, 8, 7, 12, 9, 1],
  55: [0, 8, 7, 13, 9, 1],
  56: [0, 8, 7, 13, 9, 1],
  57: [0, 8, 8, 13, 9, 1],
  58: [0, 8, 8, 13, 9, 1],
  59: [0, 8, 8, 14, 9, 1],
  60: [0, 8, 8, 14, 9, 1],
  61: [0, 8, 8, 14, 9, 1],
  62: [0, 8, 8, 14, 9, 1],
  63: [0, 8, 8, 14, 9, 1],
  64: [0, 8, 8, 14, 9, 1],
  65: [0, 8, 8, 14, 9, 1],
  66: [0, 8, 8, 14, 9, 1],
  67: [0, 8, 8, 14, 9, 1],
  68: [0, 8, 8, 14, 9, 1],
  69: [0, 8, 8, 14, 9, 1],
  70: [0, 8, 8, 14, 9, 1],
};

export class ArchMage extends Warlock {
  protected override CLASS_NAME = ClassName.ArchMage;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.ArchMage];
  private readonly atkSkillList4th: AtkSkillModel[] = [
    SOUL_VULCAN_STRIKE,
    {
      name: 'Mystery Illusion',
      label: '[V3] Mystery Illusion Lv5',
      value: 'Mystery Illusion==5',
      acd: 1,
      fct: 1.5,
      vct: 4,
      cd: 4,
      isMatk: true,
      element: ElementType.Dark,
      totalHit: ({ skillLevel }) => [0, 7, 7, 10, 10, 13][skillLevel],
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 500 + totalSpl * 5) * (baseLevel / 100);
      }
    },
    {
      name: 'Floral Flare Road',
      label: '[V3] Floral Flare Road Lv5',
      value: 'Floral Flare Road==5',
      acd: 0.5,
      fct: 1.5,
      vct: 3,
      cd: 5,
      isMatk: true,
      element: ElementType.Fire,
      // Ten ground ticks; each packet already contains both displayed hits.
      totalHit: 10,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 200 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Rain of Crystal',
      label: '[V3] Rain of Crystal Lv5',
      value: 'Rain of Crystal==5',
      acd: 0.5,
      fct: 1.5,
      vct: 3,
      cd: 5,
      isMatk: true,
      element: ElementType.Water,
      // Eight ground ticks; each packet already contains both displayed hits.
      totalHit: 8,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 150 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Tornado Storm',
      label: '[V3] Tornado Storm Lv5',
      value: 'Tornado Storm==5',
      acd: 0.5,
      fct: 1.5,
      vct: 3,
      cd: 5,
      isMatk: true,
      element: ElementType.Wind,
      totalHit: 10,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 90 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Stratum Tremor',
      label: '[V3] Stratum Tremor Lv5',
      value: 'Stratum Tremor==5',
      acd: 0.5,
      fct: 1.5,
      vct: 3,
      cd: 4,
      isMatk: true,
      element: ElementType.Earth,
      // Four seconds at 0.4 s per tick; the two displayed hits share one packet.
      totalHit: 10,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 250 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Crimson Arrow',
      label: '[V3] Crimson Arrow Lv5',
      value: 'Crimson Arrow==5',
      acd: 0.5,
      fct: 1.5,
      vct: 4,
      cd: 0.3,
      isMatk: true,
      element: ElementType.Fire,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;
        return floor((skillLevel * 300 + totalSpl * 3) * (baseLevel / 100));
      },
      // The arrow and its explosion are separate server packets (5235 and 5236).
      // LATAM's explosion still uses 400% per level: Pazzolino's bare Magus replay
      // records 95,362 exactly here, versus 132,700 with the wiki's 600% per level.
      // Climax doubles only the explosion packet, at every Climax level.
      part2: {
        label: 'Explosão',
        isIncludeMain: false,
        element: ElementType.Fire,
        isMatk: true,
        isMelee: false,
        hit: 2,
        formula: (input: AtkSkillFormulaInput): number => {
          const { model, skillLevel, status } = input;
          const { totalSpl } = status;
          const { level: baseLevel } = model;
          return floor((skillLevel * 400 + totalSpl * 5) * (baseLevel / 100))
            * (this.isSkillActive('Climax') ? 2 : 1);
        },
      },
    },
    {
      name: 'Frozen Slash',
      label: '[V3] Frozen Slash Lv5',
      value: 'Frozen Slash==5',
      acd: 0.5,
      fct: 1.5,
      vct: 4,
      cd: 0.3,
      isMatk: true,
      element: ElementType.Water,
      hit: 3,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;
        if (this.isSkillActive('Climax')) {
          return (skillLevel * 850 + totalSpl * 5) * (baseLevel / 100);
        }

        return (skillLevel * 600 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Storm Cannon',
      label: '[V3] Storm Cannon Lv5',
      value: 'Storm Cannon==5',
      acd: 0.5,
      fct: 1.5,
      vct: 4,
      cd: 0.3,
      isMatk: true,
      element: ElementType.Wind,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;
        if (this.isSkillActive('Climax')) {
          return (skillLevel * 850 + totalSpl * 5) * (baseLevel / 100);
        }

        return (skillLevel * 600 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Rock Down',
      label: '[V3] Rock Down Lv5',
      value: 'Rock Down==5',
      acd: 0.5,
      fct: 1.5,
      vct: 4,
      cd: 0.3,
      isMatk: true,
      element: ElementType.Earth,
      hit: 5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;
        if (this.isSkillActive('Climax')) {
          return (skillLevel * 850 + totalSpl * 5) * (baseLevel / 100);
        }

        return (skillLevel * 600 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'All Bloom',
      label: '[V3] All Bloom Lv5',
      value: 'All Bloom==5',
      levelList: levelList('All Bloom', 5),
      acd: 1,
      fct: 1.5,
      vct: 4,
      cd: 6,
      isMatk: true,
      element: ElementType.Fire,
      // (Skill level x 4) flowers land randomly within the garden. Potencializar Magia Nv2
      // doubles them (at -50%, see setAdditionalBonus) and Nv4 stops the damage in favour
      // of [Pólen] on the target — the debuff toggle in constants/job-buffs.ts.
      totalHit: ({ skillLevel }) => skillLevel * 4 * (this.activeSkillLv('Climax') === 2 ? 2 : 1),
      formula: (input: AtkSkillFormulaInput): number => {
        if (this.activeSkillLv('Climax') === 4) return 0;

        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 100 + totalSpl * 5) * (baseLevel / 100);
      },
      // Potencializar Magia Nv5: once every flower has gone off, the garden burns at once
      // for "7.000% do ATQM" — a flat percentage the client gives no base-level or FEI term
      // for, at every level of Florescer.
      part2: {
        label: 'Queima do Jardim',
        isIncludeMain: false,
        element: ElementType.Fire,
        isMatk: true,
        isMelee: false,
        hit: 1,
        formula: (): number => (this.activeSkillLv('Climax') === 5 ? 7000 : 0),
      },
    },
    {
      name: 'Violent Quake',
      label: '[V3] Violent Quake Lv5',
      value: 'Violent Quake==5',
      levelList: levelList('Violent Quake', 5),
      acd: 1,
      fct: 1.5,
      vct: 4,
      cd: 6,
      isMatk: true,
      element: ElementType.Earth,
      // (Skill level x 4) pillars rise randomly within the area. Potencializar Magia Nv1
      // doubles them (at -50%, see setAdditionalBonus) and Nv4 stops the damage in favour
      // of [Empalamento] on the target — the debuff toggle in constants/job-buffs.ts.
      totalHit: ({ skillLevel }) => skillLevel * 4 * (this.activeSkillLv('Climax') === 1 ? 2 : 1),
      formula: (input: AtkSkillFormulaInput): number => {
        if (this.activeSkillLv('Climax') === 4) return 0;

        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 120 + totalSpl * 5) * (baseLevel / 100);
      },
    },
    {
      // Tufão Destrutivo (AG_DESTRUCTIVE_HURRICANE 5215) — one Wind hit on everything
      // around the caster, 1.600% a level on the client table. Potencializar Magia Nv1
      // adds a second hit of 500% ATQM regardless of the skill level (part2), Nv3 and Nv5
      // raise the damage (setAdditionalBonus), and Nv4 stops it in favour of [Zéfiro] on
      // the caster — the Zephyr toggle below. browiki.org/wiki/Tufão_Destrutivo
      name: 'Destructive Hurricane',
      label: '[V3] Destructive Hurricane Lv5',
      value: 'Destructive Hurricane==5',
      levelList: levelList('Destructive Hurricane', 5),
      acd: 1,
      fct: 1.5,
      vct: 4,
      cd: 6,
      isMatk: true,
      element: ElementType.Wind,
      formula: (input: AtkSkillFormulaInput): number => {
        if (this.activeSkillLv('Climax') === 4) return 0;

        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 1600 + totalSpl * 5) * (baseLevel / 100);
      },
      part2: {
        label: 'Golpe Adicional',
        isIncludeMain: false,
        element: ElementType.Wind,
        isMatk: true,
        isMelee: false,
        hit: 1,
        formula: (): number => (this.activeSkillLv('Climax') === 1 ? 500 : 0),
      },
    },
    {
      name: 'Crystal Impact',
      label: '[V3] Crystal Impact Lv5',
      value: 'Crystal Impact==5',
      levelList: levelList('Crystal Impact', 5),
      acd: 1,
      fct: 1.5,
      vct: 4,
      cd: 6,
      isMatk: true,
      element: ElementType.Water,
      // Two Water shards, each carrying the full ratio: the first lands at once, the
      // second a fraction of a second later. Climax reweights them per level, so the
      // second shard is a `part2` rather than a hit count on the first.
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;

        return (skillLevel * 800 + totalSpl * 5) * (baseLevel / 100) * this.crystalImpactClimaxFactor(1);
      },
      ratioCalc: (input: AtkSkillFormulaInput) => this.crystalImpactRatioCalc(1, input),
      part2: {
        label: '2º Caco',
        isIncludeMain: false,
        element: ElementType.Water,
        isMatk: true,
        isMelee: false,
        hit: 1,
        formula: (input: AtkSkillFormulaInput): number => {
          const { model, skillLevel, status } = input;
          const { totalSpl } = status;
          const { level: baseLevel } = model;

          return (skillLevel * 800 + totalSpl * 5) * (baseLevel / 100) * this.crystalImpactClimaxFactor(2);
        },
        ratioCalc: (input: AtkSkillFormulaInput) => this.crystalImpactRatioCalc(2, input),
      },
    },
    {
      /**
       * Colisão Astral — o asteroide cai uma vez e abre passagem para meteoritos que
       * atingem o alvo a cada 0,3 segundo por 15 segundos, ou seja 50 quedas.
       *
       * A tabela do cliente tem duas colunas de dano, ATQM e ATQM (Bônus): 500% e 1.100%
       * por nível, a segunda contra Morto-vivo e Dragão — daí o +600. O bROWiki publica a
       * mesma tabela com uma coluna a mais, a dos meteoritos, a 200% por nível por queda.
       * As duas partes somam (10 x FEI) e escalam pelo nível de base.
       *
       * Os 15 segundos vêm só do wiki; o cliente diz "a cada 0,3 segundo" e não diz por
       * quanto tempo. Se a duração mudar, é {@link ASTRAL_STRIKE_METEORS} que muda.
       *
       * @see https://browiki.org/wiki/Colis%C3%A3o_Astral
       */
      name: 'Astral Strike',
      label: '[V2] Astral Strike Lv10',
      value: 'Astral Strike==10',
      levelList: levelList('Astral Strike', 10),
      acd: 0.5,
      fct: 1.5,
      vct: 4,
      cd: 60,
      isMatk: true,
      element: ElementType.Neutral,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, monster } = input;
        const { totalSpl } = status;
        const { level: baseLevel } = model;
        const raceBonus = monster.isRace('undead', 'dragon') ? 600 : 0;

        return floor((skillLevel * (500 + raceBonus) + totalSpl * 10) * (baseLevel / 100));
      },
      part2: {
        label: 'Meteoritos',
        isIncludeMain: false,
        element: ElementType.Neutral,
        isMatk: true,
        isMelee: false,
        hit: 1,
        // Cada meteorito é um impacto à parte e come a DEFM do alvo sozinho, então são
        // 50 pacotes repetidos, não um pacote de 50 golpes.
        damageRepeat: ASTRAL_STRIKE_METEORS,
        formula: (input: AtkSkillFormulaInput): number => {
          const { model, skillLevel, status } = input;
          const { totalSpl } = status;
          const { level: baseLevel } = model;

          return floor((skillLevel * 200 + totalSpl * 10) * (baseLevel / 100));
        },
      },
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      name: 'Climax',
      label: 'Climax',
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
    {
      // Zéfiro — what Tufão Destrutivo leaves on the caster under Potencializar Magia Nv4,
      // for 15 minutes, so it outlives the Climax level that granted it and stays a toggle
      // of its own: "ATQM +100 e dano mágico de propriedade Vento +30%".
      name: 'Zephyr',
      label: 'Zéfiro',
      inputType: 'selectButton',
      dropdown: [
        { label: 'Sim', value: 1, isUse: true, bonus: { matk: 100, m_my_element_wind: 30 } },
        { label: 'Não', value: 0, isUse: false },
      ],
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      name: 'Two hand Staff Mastery',
      label: 'Two hand Staff Mastery',
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

  /**
   * Per-shard damage factor Potencializar Magia (Climax) applies to Cacos de Gelo.
   *
   * Lv1 suppresses the damage outright — the cast grants the party the Geleira state
   * instead. Lv2 makes the first shard strike twice, Lv3 and Lv4 reweight the two
   * shards, and Lv5 only widens the area. The client description omits the Lv1 clause;
   * the "Potencializar Magia" and "Cacos de Gelo" pages on bROWiki both carry it, and
   * every sibling skill states the same clause on its own no-damage level.
   */
  private crystalImpactClimaxFactor(shard: 1 | 2): number {
    switch (this.activeSkillLv('Climax')) {
      case 1:
        return 0;
      case 2:
        return shard === 1 ? 2 : 1;
      case 3:
        return shard === 1 ? 1.5 : 1;
      case 4:
        return shard === 1 ? 0.5 : 2.5;
      default:
        return 1;
    }
  }

  /**
   * The "Hab. Base" chip's account of a Cacos de Gelo shard, so the percentage in the
   * chain can be traced back to the client table and the Potencializar Magia level that
   * reshaped it. Returns undefined when Climax is not up: the ratio is then the table
   * value and the row would say nothing the label does not.
   */
  private crystalImpactRatioCalc(shard: 1 | 2, input: AtkSkillFormulaInput): DamageFormulaCalc | undefined {
    const climaxLv = this.activeSkillLv('Climax');
    if (!climaxLv) return undefined;

    const { skillLevel, status } = input;
    const table = skillLevel * 800;
    const base = table + status.totalSpl * 5;
    const factor = this.crystalImpactClimaxFactor(shard);
    const shardName = shard === 1 ? '1º caco' : '2º caco';
    const effect = CRYSTAL_IMPACT_CLIMAX_EFFECT[climaxLv];
    const fmt = formatCalcNumber;

    return {
      rows: [
        { label: `Cacos de Gelo Nv ${skillLevel} (tabela do cliente)`, display: `${fmt(table)}%` },
        { label: `FEI ${status.totalSpl} × 5`, display: `${fmt(base)}%` },
        { label: `Potencializar Magia Nv ${climaxLv}: ${effect}`, display: `× ${fmt(factor)}` },
        { label: `Hab. Base (${shardName})`, display: `${fmt(base * factor)}%`, emphasis: true },
      ],
      note: `A ${shardName} é a única metade que a Potencializar Magia Nv ${climaxLv} mexe desta forma; a outra segue a tabela.`,
      link: { label: 'Cacos de Gelo no bROWiki', url: 'https://browiki.org/wiki/Cacos_de_Gelo' },
    };
  }

  override setAdditionalBonus(params: AdditionalBonusInput): EquipmentSummaryModel {
    super.setAdditionalBonus(params);

    const { totalBonus, weapon } = params;

    const tHandStaffLv = this.learnLv('Two hand Staff Mastery');
    if (tHandStaffLv > 0 && weapon.isType('twohandRod')) {
      addBonus(totalBonus, 'sMatk', tHandStaffLv * 2);
    }

    // The damage steps Potencializar Magia puts on Florescer, Pilares de Pedra and Tufão
    // Destrutivo. bROWiki says each "é cumulativo com equipamentos de efeitos semelhantes",
    // so they join the gear's "Dano de [habilidade] +N%" rather than scaling the ratio —
    // keyed by skill id, which is what getSkillBonus reads back.
    const climaxSkillBonus: Record<number, [SKILL_NAME, number][]> = params.model.skillFormulaVersion === 'rebalance-2026-02' ? {
      1: [['Violent Quake', -50]],
      3: [['All Bloom', 300], ['Violent Quake', 200], ['Destructive Hurricane', 150]],
      5: [['Destructive Hurricane', -20]],
    } : params.model.skillFormulaVersion === 'rebalance-2022-06' ? {
      1: [['Violent Quake', -50]],
      3: [['All Bloom', 300], ['Violent Quake', 200], ['Destructive Hurricane', 200]],
      5: [['Destructive Hurricane', 50]],
    } : {
      1: [['Violent Quake', -50]],
      2: [['All Bloom', -50]],
      3: [['All Bloom', 100], ['Violent Quake', 100], ['Destructive Hurricane', 100]],
      5: [['Destructive Hurricane', 70]],
    };
    for (const [skillName, bonus] of climaxSkillBonus[this.activeSkillLv('Climax')] ?? []) {
      addBonus(totalBonus, SKILL_ID_BY_NAME[skillName] as any, bonus);
    }

    return totalBonus;
  }
}

import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { ElementType } from '../constants';
import { genSkillList } from '../utils';
import { Oboro } from './Oboro';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

/** The level picker's entries, in the shape the class catalog wants them: the English
 *  skill name as the prefix, which setClassSkill() swaps for the pt-BR one. */
const levelList = (name: string, maxLv: number) =>
  Array.from({ length: maxLv }, (_, i) => ({ label: `${name} Nv${i + 1}`, value: `${name}==${i + 1}` }));

/**
 * Job and trait bonuses — irowiki.org/wiki/Shiranui#Job_&_Talent_Bonuses.
 *
 * Same source and same format as the Shinkiro table (see the comment in Shinkiro.ts); the
 * wiki publishes the *job level at which each stat reaches +N* and these tables are that
 * expanded per level. Thresholds (STR/AGI/VIT/INT/DEX/LUK):
 *   FOR 1,4,13,16,56,59   AGI 5,8,17,20,22,27,28,32   VIT 11,13,24,26,32,57
 *   INT 1,3,7,9,11,12,16,19,22,39   DES 2,5,7,9,15,18,21,24,26,28   SOR 6,23,29
 * and (POW/STA/WIS/SPL/CON/CRT):
 *   POD 33,42,47   STA 14,33,36,38,40,42,44,45   SAB 3,15,27,31,34,36,39,41,47,50
 *   FEI —   CON 25,29,35,37,48   CRV 10,30,36,43,44,46,49
 *
 * The previous tables were swapped relative to the sister class: they gave POW +11 /
 * WIS +2 at maximum, when Shiranui is precisely the WIS half (POW +3 / WIS +10). The trait
 * table was, byte for byte, the same as Shinkiro's.
 *
 * Caveat about the source: iROwiki's summary says CON +6 at maximum and the threshold
 * table stops at +5 (the remaining threshold sits above the simulator's job-50 ceiling, so
 * it changes nothing here). There is no Shiranui recording to check against — Shinkiro is
 * the one that was validated, in Shinkiro.shadow-flash-replay.spec.ts.
 */
const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 1, 0, 0],
  2: [1, 0, 0, 1, 1, 0],
  3: [1, 0, 0, 2, 1, 0],
  4: [2, 0, 0, 2, 1, 0],
  5: [2, 1, 0, 2, 2, 0],
  6: [2, 1, 0, 2, 2, 1],
  7: [2, 1, 0, 3, 3, 1],
  8: [2, 2, 0, 3, 3, 1],
  9: [2, 2, 0, 4, 4, 1],
  10: [2, 2, 0, 4, 4, 1],
  11: [2, 2, 1, 5, 4, 1],
  12: [2, 2, 1, 6, 4, 1],
  13: [3, 2, 2, 6, 4, 1],
  14: [3, 2, 2, 6, 4, 1],
  15: [3, 2, 2, 6, 5, 1],
  16: [4, 2, 2, 7, 5, 1],
  17: [4, 3, 2, 7, 5, 1],
  18: [4, 3, 2, 7, 6, 1],
  19: [4, 3, 2, 8, 6, 1],
  20: [4, 4, 2, 8, 6, 1],
  21: [4, 4, 2, 8, 7, 1],
  22: [4, 5, 2, 9, 7, 1],
  23: [4, 5, 2, 9, 7, 2],
  24: [4, 5, 3, 9, 8, 2],
  25: [4, 5, 3, 9, 8, 2],
  26: [4, 5, 4, 9, 9, 2],
  27: [4, 6, 4, 9, 9, 2],
  28: [4, 7, 4, 9, 10, 2],
  29: [4, 7, 4, 9, 10, 3],
  30: [4, 7, 4, 9, 10, 3],
  31: [4, 7, 4, 9, 10, 3],
  32: [4, 8, 5, 9, 10, 3],
  33: [4, 8, 5, 9, 10, 3],
  34: [4, 8, 5, 9, 10, 3],
  35: [4, 8, 5, 9, 10, 3],
  36: [4, 8, 5, 9, 10, 3],
  37: [4, 8, 5, 9, 10, 3],
  38: [4, 8, 5, 9, 10, 3],
  39: [4, 8, 5, 10, 10, 3],
  40: [4, 8, 5, 10, 10, 3],
  41: [4, 8, 5, 10, 10, 3],
  42: [4, 8, 5, 10, 10, 3],
  43: [4, 8, 5, 10, 10, 3],
  44: [4, 8, 5, 10, 10, 3],
  45: [4, 8, 5, 10, 10, 3],
  46: [4, 8, 5, 10, 10, 3],
  47: [4, 8, 5, 10, 10, 3],
  48: [4, 8, 5, 10, 10, 3],
  49: [4, 8, 5, 10, 10, 3],
  50: [4, 8, 5, 10, 10, 3],
  51: [4, 8, 5, 10, 10, 3],
  52: [4, 8, 5, 10, 10, 3],
  53: [4, 8, 5, 10, 10, 3],
  54: [4, 8, 5, 10, 10, 3],
  55: [4, 8, 5, 10, 10, 3],
  56: [5, 8, 5, 10, 10, 3],
  57: [5, 8, 6, 10, 10, 3],
  58: [5, 8, 6, 10, 10, 3],
  59: [6, 8, 6, 10, 10, 3],
  60: [6, 8, 6, 10, 10, 3],
  61: [6, 8, 6, 10, 10, 3],
  62: [6, 8, 6, 10, 10, 3],
  63: [6, 8, 6, 10, 10, 3],
  64: [6, 8, 6, 10, 10, 3],
  65: [6, 8, 6, 10, 10, 3],
  66: [6, 8, 6, 10, 10, 3],
  67: [6, 8, 6, 10, 10, 3],
  68: [6, 8, 6, 10, 10, 3],
  69: [6, 8, 6, 10, 10, 3],
  70: [6, 8, 6, 10, 10, 3],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 0, 0],
  3: [0, 0, 1, 0, 0, 0],
  4: [0, 0, 1, 0, 0, 0],
  5: [0, 0, 1, 0, 0, 0],
  6: [0, 0, 1, 0, 0, 0],
  7: [0, 0, 1, 0, 0, 0],
  8: [0, 0, 1, 0, 0, 0],
  9: [0, 0, 1, 0, 0, 0],
  10: [0, 0, 1, 0, 0, 1],
  11: [0, 0, 1, 0, 0, 1],
  12: [0, 0, 1, 0, 0, 1],
  13: [0, 0, 1, 0, 0, 1],
  14: [0, 1, 1, 0, 0, 1],
  15: [0, 1, 2, 0, 0, 1],
  16: [0, 1, 2, 0, 0, 1],
  17: [0, 1, 2, 0, 0, 1],
  18: [0, 1, 2, 0, 0, 1],
  19: [0, 1, 2, 0, 0, 1],
  20: [0, 1, 2, 0, 0, 1],
  21: [0, 1, 2, 0, 0, 1],
  22: [0, 1, 2, 0, 0, 1],
  23: [0, 1, 2, 0, 0, 1],
  24: [0, 1, 2, 0, 0, 1],
  25: [0, 1, 2, 0, 1, 1],
  26: [0, 1, 2, 0, 1, 1],
  27: [0, 1, 3, 0, 1, 1],
  28: [0, 1, 3, 0, 1, 1],
  29: [0, 1, 3, 0, 2, 1],
  30: [0, 1, 3, 0, 2, 2],
  31: [0, 1, 4, 0, 2, 2],
  32: [0, 1, 4, 0, 2, 2],
  33: [1, 2, 4, 0, 2, 2],
  34: [1, 2, 5, 0, 2, 2],
  35: [1, 2, 5, 0, 3, 2],
  36: [1, 3, 6, 0, 3, 3],
  37: [1, 3, 6, 0, 4, 3],
  38: [1, 4, 6, 0, 4, 3],
  39: [1, 4, 7, 0, 4, 3],
  40: [1, 5, 7, 0, 4, 3],
  41: [1, 5, 8, 0, 4, 3],
  42: [2, 6, 8, 0, 4, 3],
  43: [2, 6, 8, 0, 4, 4],
  44: [2, 7, 8, 0, 4, 5],
  45: [2, 8, 8, 0, 4, 5],
  46: [2, 8, 8, 0, 4, 6],
  47: [3, 8, 9, 0, 4, 6],
  48: [3, 8, 9, 0, 5, 6],
  49: [3, 8, 9, 0, 5, 7],
  50: [3, 8, 10, 0, 5, 7],
  51: [3, 8, 10, 0, 5, 7],
  52: [3, 8, 10, 0, 5, 7],
  53: [3, 8, 10, 0, 5, 7],
  54: [3, 8, 10, 0, 5, 7],
  55: [3, 8, 10, 0, 5, 7],
  56: [3, 8, 10, 0, 5, 7],
  57: [3, 8, 10, 0, 5, 7],
  58: [3, 8, 10, 0, 5, 7],
  59: [3, 8, 10, 0, 5, 7],
  60: [3, 8, 10, 0, 5, 7],
  61: [3, 8, 10, 0, 5, 7],
  62: [3, 8, 10, 0, 5, 7],
  63: [3, 8, 10, 0, 5, 7],
  64: [3, 8, 10, 0, 5, 7],
  65: [3, 8, 10, 0, 5, 7],
  66: [3, 8, 10, 0, 5, 7],
  67: [3, 8, 10, 0, 5, 7],
  68: [3, 8, 10, 0, 5, 7],
  69: [3, 8, 10, 0, 5, 7],
  70: [3, 8, 10, 0, 5, 7],
};

export class Shiranui extends Oboro {
  protected override CLASS_NAME = ClassName.Shiranui;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.Shiranui];
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
      acd: 0.5,
      fct: 0,
      vct: (lv) => [1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1][lv - 1],
      cd: 1,
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
      fct: 0.5,
      vct: 1,
      cd: 1,
      isMelee: true,
      // Same skill as Shinkiro's — 4 displayed hits and can crit. See
      // Shinkiro.shadow-flash-replay.spec.ts for the in-game evidence.
      hit: 4,
      canCri: true,
      // Half of the equipment "Dano Crítico +N%", same as Shinkiro's copy — see the note
      // there and Shinkiro.shadow-flash-crit-damage.spec.ts, which holds both classes.
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
      acd: 0.5,
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
      acd: 0.5,
      fct: 1.5,
      vct: 2,
      cd: 1,
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
      acd: 0.5,
      fct: 1.5,
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
      acd: 0.5,
      fct: 1.5,
      vct: 2,
      cd: 1,
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
      acd: 0.5,
      fct: 1.5,
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
      acd: 0.5,
      fct: 1.5,
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
    {
      /**
       * Kunai do Pesadelo — ultimate do Shiranui, nível único. 15.000% de ATQ mais
       * (POD x 10), escalando pelo nível de base, numa área de 13x13 ao redor do usuário.
       * A propriedade é a da Kunai equipada, então a habilidade não fixa elemento.
       *
       * Contra alvos em [Pesadelo] o dano é 1,5x e o estado é consumido.
       *
       * @see https://browiki.org/wiki/Kunai_do_Pesadelo
       */
      name: 'Kunai - Nightmare',
      label: '[V2] Kunai - Nightmare Lv1',
      value: 'Kunai - Nightmare==1',
      acd: 0.5,
      fct: 0.5,
      vct: 2,
      cd: 5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;

        return (15000 + totalPow * 10) * (baseLevel / 100) * this.nightmareMultiplier();
      },
    },
    {
      /**
       * Mahou do Pesadelo — a contraparte mágica, 12.000% de ATQM mais (FEI x 10),
       * propriedade Sombrio, área de 11x11 ao redor do usuário.
       *
       * O cliente e o bROWiki divergem no bônus contra [Pesadelo]: o cliente diz "1,5
       * vezes mais dano", igual à Kunai do Pesadelo, e o wiki diz um acréscimo de 12.000%
       * de dano mágico de propriedade Fogo. Fica o que o cliente do LATAM descreve, que é
       * o que o jogador lê e o que vale para as duas ultimates.
       *
       * @see https://browiki.org/wiki/Mahou_do_Pesadelo
       */
      name: 'Dark Dragon - Nightmare',
      label: '[V2] Dark Dragon - Nightmare Lv1',
      value: 'Dark Dragon - Nightmare==1',
      acd: 0.5,
      fct: 1.5,
      vct: 2,
      cd: 5,
      element: ElementType.Dark,
      isMatk: true,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;

        return (12000 + totalSpl * 10) * (baseLevel / 100) * this.nightmareMultiplier();
      },
    },
    {
      /**
       * Infiltrar (SS_SHIMIRU, 5477) na rotação — card FPpmOoKCq7KzPxV4NUZ3, reportado
       * por .Neblina, que quer medir o auto-cast que a habilidade dispara e lembra que
       * ela tem só 0,5 s de recarga no Nv 5.
       *
       * Entra sem dano de propósito. O bROWiki publica 700% de ATQ por nível, mas o
       * cliente do LATAM não traz descrição nenhuma para a 5477, e a tabela de dano do
       * simulador sai do cliente. Os tempos, esses sim, o cliente publica: recarga de
       * 1,5 s a 0,5 s, nada de conjuração nem de pós-conjuração. Quando a descrição
       * chegar, muda a `formula` **e** sai o `isUtility`: as duas marcas juntas são o que
       * diz que esta entrada não pontua.
       *
       * O cliente também não traz nome em pt-BR para a 5477, então o catálogo cai no nome
       * em inglês e o seletor mostra "Infiltration".
       */
      name: 'Infiltration',
      label: 'Infiltration Lv5',
      value: 'Infiltration==5',
      levelList: levelList('Infiltration', 5),
      isUtility: true,
      acd: 0,
      fct: 0,
      vct: 0,
      cd: (skillLevel: number) => 1.75 - skillLevel * 0.25,
      formula: (): number => 0,
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      /**
       * O estado [Pesadelo] no alvo, não a habilidade que o aplica. As duas ultimates do
       * Pesadelo causam 1,5x de dano contra quem está nesse estado e o consomem.
       *
       * É um marcador interno sem id, como `_ElementalMaster_spirit`: um nome que o
       * catálogo resolve guarda o rótulo do cliente, e seis habilidades infligem o estado
       * — não há uma entrada no catálogo que signifique "o alvo está em [Pesadelo]".
       *
       * O `icon` é lido duas vezes pela tela: desenha a figura e, por `buffTooltip`,
       * escolhe a descrição do balão. Aponta para Mahou da Escuridão (5492), que é como a linha Mahou, a metade SAB da dupla,
       * põe o alvo em [Pesadelo] — mesma ideia do `_Meister_Rush`, que empresta o ícone
       * de Avanço Sísmico para explicar o estado [Avanço].
       */
      name: '_Nightmare_target',
      label: 'Alvo em [Pesadelo]',
      icon: 5492, // Mahou da Escuridão (5492)
      inputType: 'selectButton',
      dropdown: [
        { label: 'Sim', value: 1, isUse: true },
        { label: 'Não', value: 0, isUse: false },
      ],
    },
  ];
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

  /** 1,5x contra alvos em [Pesadelo], que as duas ultimates do Pesadelo compartilham. */
  private nightmareMultiplier(): number {
    return this.isSkillActive('_Nightmare_target') ? 1.5 : 1;
  }

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

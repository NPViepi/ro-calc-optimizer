import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { WeaponTypeName } from '../constants';
import { ClassAutoCastDefinition } from '../models/auto-cast.model';
import { RuneKnight } from './RuneKnight';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';
import type { AdditionalBonusInput } from '../models/info-for-class.model';
import { isLatamBaseline } from '../skills/skill-formula-version';

const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 1, 0],
  3: [1, 1, 0, 0, 1, 0],
  4: [1, 1, 0, 0, 2, 0],
  5: [1, 2, 1, 0, 2, 0],
  6: [1, 2, 1, 0, 2, 0],
  7: [1, 2, 1, 0, 2, 1],
  8: [1, 2, 1, 1, 2, 1],
  9: [2, 2, 1, 1, 2, 1],
  10: [2, 2, 1, 1, 3, 1],
  11: [2, 2, 1, 2, 3, 1],
  12: [2, 3, 1, 2, 3, 1],
  13: [2, 3, 1, 2, 3, 1],
  14: [2, 3, 2, 2, 3, 2],
  15: [2, 3, 2, 2, 3, 2],
  16: [3, 3, 2, 2, 3, 2],
  17: [3, 3, 2, 2, 4, 2],
  18: [3, 3, 2, 3, 4, 2],
  19: [3, 4, 3, 3, 4, 2],
  20: [3, 4, 3, 3, 4, 2],
  21: [3, 4, 3, 3, 4, 3],
  22: [3, 4, 3, 3, 4, 3],
  23: [3, 5, 3, 3, 5, 3],
  24: [4, 5, 3, 3, 5, 3],
  25: [4, 5, 4, 3, 5, 3],
  26: [4, 5, 4, 4, 5, 3],
  27: [4, 5, 4, 4, 6, 3],
  28: [4, 5, 4, 4, 6, 4],
  29: [4, 5, 4, 4, 6, 4],
  30: [5, 5, 4, 4, 6, 4],
  31: [5, 5, 4, 5, 6, 5],
  32: [5, 5, 5, 5, 6, 5],
  33: [5, 6, 5, 5, 6, 5],
  34: [5, 6, 5, 5, 6, 5],
  35: [5, 6, 5, 5, 7, 5],
  36: [6, 6, 5, 5, 7, 5],
  37: [6, 6, 5, 6, 7, 5],
  38: [6, 7, 5, 6, 7, 5],
  39: [6, 7, 5, 6, 7, 5],
  40: [6, 7, 5, 6, 7, 6],
  41: [6, 7, 5, 6, 7, 6],
  42: [6, 7, 6, 6, 7, 6],
  43: [6, 7, 6, 7, 7, 6],
  44: [6, 7, 6, 7, 8, 6],
  45: [6, 7, 6, 7, 8, 6],
  46: [6, 7, 6, 7, 8, 6],
  47: [6, 7, 6, 8, 8, 6],
  48: [6, 7, 6, 8, 8, 6],
  49: [6, 8, 6, 8, 8, 6],
  50: [6, 8, 7, 8, 8, 6],
  51: [6, 8, 7, 8, 8, 6],
  52: [6, 8, 7, 8, 8, 6],
  53: [6, 8, 7, 8, 8, 6],
  54: [6, 8, 7, 8, 8, 6],
  55: [6, 8, 7, 8, 8, 6],
  56: [6, 8, 7, 8, 8, 6],
  57: [6, 8, 7, 8, 8, 6],
  58: [6, 8, 7, 8, 8, 6],
  59: [6, 8, 7, 8, 8, 6],
  60: [6, 8, 7, 8, 8, 6],
  61: [6, 8, 7, 8, 8, 6],
  62: [6, 8, 7, 8, 8, 6],
  63: [6, 8, 7, 8, 8, 6],
  64: [6, 8, 7, 8, 8, 6],
  65: [6, 8, 7, 8, 8, 6],
  66: [6, 8, 7, 8, 8, 6],
  67: [6, 8, 7, 8, 8, 6],
  68: [6, 8, 7, 8, 8, 6],
  69: [6, 8, 7, 8, 8, 6],
  70: [6, 8, 7, 8, 8, 6],
};

const TraitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [1, 0, 0, 0, 0, 0],
  2: [1, 0, 0, 1, 0, 0],
  3: [1, 0, 0, 1, 0, 1],
  4: [1, 0, 0, 1, 0, 1],
  5: [1, 0, 0, 1, 1, 1],
  6: [1, 0, 0, 1, 1, 1],
  7: [1, 0, 0, 2, 1, 1],
  8: [1, 1, 0, 2, 1, 1],
  9: [1, 1, 0, 2, 1, 2],
  10: [1, 1, 0, 2, 1, 2],
  11: [1, 1, 0, 2, 2, 2],
  12: [1, 1, 0, 2, 2, 2],
  13: [1, 1, 0, 2, 2, 2],
  14: [1, 1, 0, 2, 2, 2],
  15: [1, 1, 0, 2, 2, 2],
  16: [2, 1, 0, 2, 2, 2],
  17: [2, 1, 0, 2, 2, 2],
  18: [2, 1, 0, 2, 3, 2],
  19: [2, 1, 0, 2, 3, 2],
  20: [2, 1, 0, 3, 3, 2],
  21: [2, 1, 0, 3, 3, 2],
  22: [2, 2, 0, 3, 3, 2],
  23: [2, 2, 0, 3, 3, 2],
  24: [2, 2, 0, 4, 3, 2],
  25: [2, 2, 0, 4, 3, 3],
  26: [3, 2, 0, 4, 3, 3],
  27: [3, 2, 0, 4, 3, 3],
  28: [3, 2, 0, 4, 3, 3],
  29: [4, 2, 0, 4, 4, 3],
  30: [4, 2, 0, 4, 4, 3],
  31: [4, 2, 0, 4, 4, 3],
  32: [4, 2, 1, 4, 4, 3],
  33: [4, 2, 1, 4, 4, 3],
  34: [4, 2, 1, 4, 4, 4],
  35: [4, 2, 1, 4, 5, 4],
  36: [5, 2, 1, 4, 5, 4],
  37: [5, 3, 1, 4, 5, 4],
  38: [5, 3, 1, 4, 5, 4],
  39: [5, 3, 1, 5, 5, 4],
  40: [5, 4, 1, 5, 5, 4],
  41: [5, 4, 1, 5, 5, 4],
  42: [5, 4, 1, 5, 5, 5],
  43: [6, 4, 1, 5, 5, 5],
  44: [6, 4, 2, 5, 5, 5],
  45: [6, 5, 2, 5, 5, 5],
  46: [7, 5, 2, 5, 6, 5],
  47: [7, 5, 3, 5, 6, 5],
  48: [7, 5, 3, 5, 6, 5],
  49: [7, 5, 3, 5, 6, 6],
  50: [8, 5, 3, 5, 6, 6],
  51: [8, 5, 3, 5, 6, 7],
  52: [9, 5, 3, 5, 6, 7],
  53: [9, 5, 3, 5, 6, 7],
  54: [10, 5, 3, 5, 6, 8],
  55: [10, 6, 3, 5, 6, 8],
  56: [10, 7, 3, 5, 6, 8],
  57: [10, 7, 3, 5, 6, 8],
  58: [10, 7, 3, 5, 7, 8],
  59: [10, 7, 3, 5, 7, 8],
  60: [10, 7, 3, 5, 7, 8],
  61: [10, 7, 3, 5, 7, 8],
  62: [10, 7, 3, 5, 7, 8],
  63: [10, 7, 3, 5, 7, 8],
  64: [10, 7, 3, 5, 7, 8],
  65: [10, 7, 3, 5, 7, 8],
  66: [10, 7, 3, 5, 7, 8],
  67: [10, 7, 3, 5, 7, 8],
  68: [10, 7, 3, 5, 7, 8],
  69: [10, 7, 3, 5, 7, 8],
  70: [10, 7, 3, 5, 7, 8],
};

/**
 * Dragonic Breath's base ATQ% per level, from the client's own table (28/10/2026).
 * irowiki had 700 at Nv2; the client says 750, and every other level agrees.
 */
const DRAGONIC_BREATH_BASE = [400, 750, 1100, 1450, 1800, 2150, 2500, 2850, 3200, 3550];

// https://browiki.org/wiki/Espada_Alada — basic melee attacks consume one sword.
const SERVANT_WEAPON_AUTO_CAST: ClassAutoCastDefinition = {
  key: 'servant-weapon',
  resolve: ({ skillState, skillById }) => {
    const level = skillState.activeLevel('Servant Weapon');
    if (!level) return {
      blocked: [{ key: 'servant-weapon', name: 'Espada Alada', icon: 5201,
        reason: 'Selecione o nível de Espada Alada em Habilidades.' }],
    };
    const skill = skillById(5201);
    if (!skill) return {};
    const interval = 3.5 - level * 0.5;
    return { sources: [{
      key: 'servant-weapon', kind: 'passive', skillId: 5201, enablingSkillId: 5201,
      skillLevel: level, chance: level * 3, trigger: 'melee-physical-attack',
      sourceName: 'Espada Alada', skillData: skill,
      maxActivationsPerSecond: 1 / interval,
      chanceBreakdown: [
        { label: 'Espada Alada', value: `Nv. ${level} · ${level * 3}% por ataque básico corpo a corpo` },
        { label: 'Regeneração', value: `1 espada a cada ${String(interval).replace('.', ',')} s` },
        { label: 'DPS sustentado', value: 'Estimativa limitada pela regeneração; reserva inicial de 5 espadas não incluída.' },
      ],
    }] };
  },
};

export class DragonKnight extends RuneKnight {
  protected override CLASS_NAME = ClassName.DragonKnight;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = TraitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.DragonKnight];

  private readonly atkSkillList4th: AtkSkillModel[] = [
    {
      name: 'Servant Weapon',
      label: '[V2] Servant Weapon Lv5',
      value: 'Servant Weapon==5',
      acd: 0,
      fct: 0,
      vct: 0,
      cd: 0,
      canCri: true,
      criDmgPercentage: 0.5,
      baseCriPercentage: 1,
      isMelee: true,
      totalHit: 1,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;

        return (200 + skillLevel * 50 + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Hack and Slasher',
      label: '[V2] Hack and Slasher Lv10',
      value: 'Hack and Slasher==10',
      acd: 0.25,
      fct: 0,
      vct: 0,
      cd: 0.7,
      totalHit: 2,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponTypeName[] = ['twohandSword', 'twohandSpear'];
        if (requires.some(wType => weapon.isType(wType))) return '';

        return requires.join(', ');
      },
      isMelee: (weaponType) => {
        return weaponType === 'twohandSword';
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;

        return (500 + skillLevel * 250 + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Storm Slash',
      label: '[V2] Storm Slash Lv5',
      value: 'Storm Slash==5',
      acd: 0.5,
      fct: 0,
      vct: 0,
      cd: 0.3,
      canCri: true,
      baseCriPercentage: 1,
      criDmgPercentage: 0.5,
      isMelee: true,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponTypeName[] = ['twohandSword', 'twohandAxe'];
        if (requires.some(wType => weapon.isType(wType))) return '';

        return requires.join(', ');
      },
      totalHit: ({ skillLevel }) => skillLevel,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalPow } = status;
        const baseLevel = model.level;

        return (skillLevel * 120 + totalPow * 5) * (baseLevel / 100);
      },
    },
    {
      name: 'Madness Crusher',
      label: '[V2] Madness Crusher Lv5',
      value: 'Madness Crusher==5',
      acd: 0.5,
      fct: 0.5,
      vct: 0,
      cd: 0.35,
      verifyItemFn: ({ weapon }) => {
        const requires: WeaponTypeName[] = ['twohandSword', 'twohandSpear'];
        if (requires.some(wType => weapon.isType(wType))) return '';

        return requires.join(', ');
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status, weapon } = input;
        const { totalPow } = status;
        const baseLevel = model.level;
        const { weight, baseWeaponLevel } = weapon.data;

        return (skillLevel * 600 + totalPow * 5 + weight * baseWeaponLevel) * (baseLevel / 100);
      },
    },
    // Dragonic Breath (DK_DRAGONIC_BREATH, 6001) arrived with the 28/10/2026 client, which
    // ships its pt-BR name ("Baforada Draconiana"), its description and its delay row. It
    // had been removed on 17/08/2026 because LATAM did not have it and its pt-BR label had
    // been invented ("Sopro Draconiano", card Os9aJKTI1icMvZqAOsup), then came back on
    // 14/09/2026 as a preview under its English name. The client's table now confirms the
    // irowiki transcription at every level but Nv2 (750, not 700) and confirms these four
    // delay fields exactly. The HP/SP/POW terms are still irowiki's: the client names them
    // without numbers, and no recording has checked them.
    // https://irowiki.org/wiki/Dragonic_Breath
    {
      name: 'Dragonic Breath',
      label: 'Dragonic Breath Lv10',
      value: 'Dragonic Breath==10',
      levelList: Array.from({ length: 10 }, (_, i) => ({ label: `Dragonic Breath Nv${i + 1}`, value: `Dragonic Breath==${i + 1}` })),
      acd: 0.15,
      fct: 0.5,
      vct: 2,
      cd: 0.5,
      hit: 2,
      isIgnoreDef: true,
      isIgnoreSDef: true,
      // ATQ% = [base + (HP máx. × 0,00625 + SP máx. × 0,0125) × nv + 7 × POD] × nv. base ÷ 100,
      // with 0,00875 / 0,0175 while the Aura Draconiana state is up.
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, maxHp, maxSp, status } = input;
        const base = DRAGONIC_BREATH_BASE[skillLevel - 1] ?? 0;
        const [hpRate, spRate] = this.isSkillActive('Dragonic Aura') ? [0.00875, 0.0175] : [0.00625, 0.0125];

        return ((base + (maxHp * hpRate + maxSp * spRate) * skillLevel + 7 * status.totalPow) * model.level) / 100;
      },
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      // https://browiki.org/wiki/Determina%C3%A7%C3%A3o — the skill does not affect abilities.
      label: 'Determinação',
      name: 'Vigor',
      inputType: 'selectButton',
      dropdown: [
        { label: 'Sim', value: 10, isUse: true, bonus: { flatBasicDmg: 200, vigorBasicRaceDmg: 50 } },
        { label: 'Não', value: 0, isUse: false },
      ],
    },
    {
      label: 'Dragonic Aura 10',
      name: 'Dragonic Aura',
      inputType: 'selectButton',
      dropdown: [
        // Its +100% to the two breaths is getDragonBreathAuraMultiplier below, not a bonus key:
        // the breaths read item bonuses by skill id, and a name-keyed bonus here reached them
        // only because nothing else did.
        { label: 'Sim', value: 10, isUse: true },
        { label: 'Não', value: 0, isUse: false },
      ],
    },
    {
      name: 'Servant Weapon',
      label: 'Espada Alada',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        ...[5, 4, 3, 2, 1].map((level) => ({ label: `Nv ${level}`, value: level, isUse: true })),
      ],
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      label: 'Dragonic Aura',
      name: 'Dragonic Aura',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Nv 10', value: 10, isUse: true },
      ],
    },
  ];

  /** Aura Draconiana Nv 10: Sopro do Dragão and Bafo do Dragão +100% (irowiki, 10% per level). */
  protected override getDragonBreathAuraMultiplier(): number {
    return this.isSkillActive('Dragonic Aura') ? 2 : 1;
  }

  override setAdditionalBonus(params: AdditionalBonusInput) {
    super.setAdditionalBonus(params);
    if (isLatamBaseline(params.model.skillFormulaVersion) && this.isSkillActive('Vigor')) {
      // The existing control selects Nv10; the third rebalance raises 200/50 to 250/100.
      params.totalBonus.flatBasicDmg = (params.totalBonus.flatBasicDmg || 0) + 50;
      params.totalBonus.vigorBasicRaceDmg = (params.totalBonus.vigorBasicRaceDmg || 0) + 50;
    }
    return params.totalBonus;
  }

  constructor() {
    super();

    this.inheritSkills({
      activeSkillList: this.activeSkillList4th,
      atkSkillList: this.atkSkillList4th,
      passiveSkillList: this.passiveSkillList4th,
      classNames: this.classNames4th,
    });
    this.inheritAutoCasts([SERVANT_WEAPON_AUTO_CAST]);
  }
}

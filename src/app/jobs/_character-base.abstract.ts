import { environment } from 'src/environments/environment';
import { AspdPotionFixBonus } from '../constants';
import { ElementType } from '../constants/element-type.const';
import { SKILL_NAME } from '../constants/skill-name';
import { WeaponTypeName } from '../constants/weapon-type-mapper';
import { Weapon } from '../domain';
import { DamageFormulaCalc } from '../models/damage-summary.model';
import { ClassAutoCastDefinition } from '../models/auto-cast.model';
import { EquipmentSummaryModel } from '../models/equipment-summary.model';
import { AdditionalBonusInput, InfoForClass, SkillRef, SkillStateCtx } from '../models/info-for-class.model';
import { ASPD_CAP, sortSkill } from '../utils';
import { AspdTable } from './_aspd-table';
import { ClassName } from './_class-name';
import { rebalancedSkillCatalog } from '../skills/rebalance-2026';
import type { SkillFormulaVersion } from '../skills/skill-formula-version';
import { previewSkillsForClass, previewBuffsForClass, applyPreviewBuffs } from '../skills/preview-275';
import { preview285SkillsForClass, preview285BuffsForClass, preview285PassivesForClass, PREVIEW_285_AUTOCAST } from '../skills/preview-285';

export interface AtkSkillFormulaInput extends InfoForClass {
  skillLevel: number;
  maxHp: number;
  maxSp: number;
  currentHp?: number;
  currentSp?: number;
  stack?: number;
  /** The character's total P.ATQ, as the status window shows it — POD and CON, the
   *  weapon's grade and every item. `totalBonus.pAtk` is only the item share of it. */
  pAtk?: number;
}

export interface DefForCalcModel {
  reducedHardDef: number;
  dmgReductionByHardDef: number;
  finalDmgReduction: number;
  finalSoftDef: number;
}

export interface AtkSkillModel {
  preview?: boolean;
  previewVersion?: string;
  previewDescription?: string;
  label: string;
  name: SKILL_NAME;
  value: string;
  /** Optional disambiguator appended to the (localized) picker label as " (suffix)".
   *  Use when a skill has several atk entries under one name — e.g. a ground skill's
   *  initial burst vs its continuous field — so they don't collapse to the same pt-BR
   *  name (the element-based dedup can't split same-element variants). */
  labelSuffix?: string;
  /** ragassets skill-icon id, attached at runtime from the LATAM skill map. */
  icon?: number;
  values?: string[];
  acd: number | ((skillLevel: number) => number);
  fct: number | ((skillLevel: number) => number);
  vct: number | ((skillLevel: number) => number);
  cd: number | ((skillLevel: number) => number);
  levelList?: { label: string; value: any; }[];
  formula: (input: AtkSkillFormulaInput) => number;
  /** Adjust this skill's final hit chance, without changing basic attacks. */
  accuracy?: (input: AtkSkillFormulaInput & { accuracy: number }) => number;
  /** Flat skill damage added after the ATK ratio, before defenses and skill bonuses. */
  flatDamage?: (input: AtkSkillFormulaInput) => number;
  /** "How the ratio was produced", for a skill whose ratio is reshaped by class state
   *  rather than being a flat table read-off — Cacos de Gelo under Potencializar Magia
   *  is the case. Fills `calc` on the graph's "Hab. Base" stage, which otherwise prints
   *  a bare percentage with nothing behind it. The same mechanism as
   *  CharacterBase.getFinalAtkCalc, one stage further down the chain. */
  ratioCalc?: (input: AtkSkillFormulaInput) => DamageFormulaCalc | undefined;
  customFormula?: (
    input: AtkSkillFormulaInput & {
      baseSkillDamage: number;
      sizePenalty: number;
      propertyMultiplier: number;
    } & DefForCalcModel,
  ) => number;
  part2?: {
    damageRepeat?: number | ((input: AtkSkillFormulaInput) => number);
    label: string;
    /** Omitted when the additional packet inherits the main attack's element. */
    element?: ElementType;
    isIncludeMain: boolean;
    hit: number;
    isMatk: boolean;
    isMelee: boolean;
    formula: (input: AtkSkillFormulaInput) => number;
    ratioCalc?: (input: AtkSkillFormulaInput) => DamageFormulaCalc | undefined;
  };
  finalDmgFormula?: (input: AtkSkillFormulaInput & { damage: number; }) => number;
  /** Explains a finalDmgFormula adjustment in the damage graph when the skill has one. */
  finalDmgCalc?: (input: AtkSkillFormulaInput & { damageBefore: number; damageAfter: number }) => DamageFormulaCalc;
  maxStack?: number;
  minStack?: number;
  defaultStack?: number;
  canCri?: boolean | ((input: AtkSkillFormulaInput) => boolean);
  baseCri?: number;
  forceCri?: boolean;
  /**
   * 0.3 => baseCri * 0.3
   */
  baseCriPercentage?: number;
  /**
   * 0.3 => criDmg * 0.3
   */
  criDmgPercentage?: number;
  /**
   * Will be round down
   */
  hit?: number;
  hitByLevel?: (skillLevel: number) => number;
  totalHit?: number | ((parmas: AtkSkillFormulaInput) => number);
  /** Apply defenses to each packet before aggregating multipart casts. */
  damageRepeat?: number | ((input: AtkSkillFormulaInput) => number);
  hitEveryNSec?: number;
  isMatk?: boolean;
  isMelee?: boolean | ((weaponType: WeaponTypeName, input?: AtkSkillFormulaInput) => boolean);
  /** No published timing data: damage per use is available, DPS is not. */
  timingUnknown?: boolean;
  /**
   * The skill is not held back by VelAtq: its own pós-conjuração paces it, and the
   * attack motion never gets a say. Off by default, because the cap is right for almost
   * every skill — set it only where a report says the skill spams past the ASPD floor.
   *
   * Read in two places that have to agree: `damage-calculator.ts`'s single-skill DPS and
   * `rotation-schedule.ts`'s start-to-start floor.
   */
  ignoreAspdFloor?: boolean;
  /**
   * A skill that belongs in a rotation but deals no damage — Esconderijo, Infiltrar.
   * It is here, among the attack skills, because the rotation needs exactly what an
   * `AtkSkillModel` carries: the client's fct/vct/acd/cd, a level list and a `value` the
   * share token already speaks. What it must not do is show up in the single-skill
   * "Resumo de Batalha (antigo)" picker, which asks "how much does this skill hit for".
   */
  isUtility?: boolean;
  isDevMode?: boolean;
  isIgnoreDef?: boolean | ((parmas: AtkSkillFormulaInput) => boolean);
  isIgnoreSDef?: boolean | ((parmas: AtkSkillFormulaInput) => boolean);
  isIgnoreRes?: boolean | ((parmas: AtkSkillFormulaInput) => boolean);
  isHDefToSDef?: boolean;
  isHit100?: boolean;
  treatedAsSkillNameFn?: (skillValue: string) => string;
  isExcludeCannanball?: boolean;
  isSudoElement?: boolean;
  verifyItemFn?: ((parmas: AtkSkillFormulaInput) => string);
  currentHpFn?: (maxHp: number) => number;
  currentSpFn?: (maxSp: number) => number;
  /**
   * For DPS calucation
   * undefined = 1, 0.2 = 20 %
   */
  autoSpellChance?: number;
  element?: ElementType;
  getElement?: (skillValue: string, input?: InfoForClass) => ElementType;
  secondaryDmgInput?: Omit<AtkSkillModel, 'secondaryDmg' | 'part2' | 'acd' | 'vct' | 'cd' | 'fct' | 'name' | 'value'> & { isIncludeMain: boolean; };
}
[];

export interface SkillModel {
  label: string;
  value: number;
  /**
   * Determine whether the level is using skill or not
   */
  isUse: boolean;
  skillLv?: number;
  bonus?: any;
  /** ragassets skill-icon id shown next to this option in the dropdown (optional). */
  icon?: number;
}

export interface ActiveSkillModel {
  preview?: boolean;
  previewVersion?: string;
  previewDescription?: string;
  isEquipAtk?: boolean;
  isMasteryAtk?: boolean;
  inputType: 'dropdown' | 'selectButton';
  label: string;
  isDebuff?: boolean;
  name: SKILL_NAME;
  dropdown: SkillModel[];
  isDevMode?: boolean;
  /** ragassets skill-icon id, attached at runtime from the LATAM skill map. */
  icon?: number;
  /** ragassets icon namespace for `icon` (default 'skill'). Some toggles use an
   *  'item' icon instead — e.g. the rune toggles show the rune-stone item icon. */
  iconType?: 'item' | 'job' | 'skill';
  /** buffs sharing an exclusiveGroup are mutually exclusive — turning one on
   *  turns the others off (e.g. the Soul Reaper "Espírito" souls). */
  exclusiveGroup?: string;
  /** Classes that may keep multiple members of this exclusive group active. */
  allowCoexistIn?: ClassName[];
}
export type PassiveSkillModel = ActiveSkillModel;

export interface AspdInput {
  weapon: Weapon;
  weapon2: Weapon;
  isEquipShield?: boolean;
  aspd: number;
  aspdPercent: number;
  totalAgi: number;
  totalDex: number;
  potionAspds: number[];
  potionAspdPercent: number;
  skillAspd: number;
  skillAspdPercent: number;
  decreaseSkillAspdPercent: number;
}

export abstract class CharacterBase {
  private allClass = 'all';

  protected abstract readonly CLASS_NAME: ClassName;
  protected minMaxLevel: [number, number] = [99, 200];
  protected maxJob = 70;
  /**
   * str, agi, vit, int, dex, luk
   */
  protected abstract readonly JobBonusTable: Record<number, [number, number, number, number, number, number]>;
  protected TraitBonusTable: Record<number, [number, number, number, number, number, number]> = {};

  protected abstract initialStatusPoint: number;
  protected _initialTraitPoint = 0;
  protected abstract classNames: ClassName[];
  protected abstract _atkSkillList: AtkSkillModel[];
  protected abstract _activeSkillList: ActiveSkillModel[];
  protected abstract _passiveSkillList: PassiveSkillModel[];
  protected readonly _autoCastDefinitions: ClassAutoCastDefinition[] = [];

  protected learnSkillMap = new Map<string, number>();
  protected activeSkillIds: number[] = [];
  protected activeBonus = new Map<string, Record<string, number>>();
  protected passiveSkillIds: number[] = [];
  protected passiveBonus = new Map<string, Record<string, number>>();
  protected bonuses: {
    activeSkillNames: Set<string>;
    equipAtks: Record<string, number>;
    masteryAtks: Record<string, number>;
    learnedSkillMap: Map<string, number>;
    usedSkillMap: Map<string, number>;
  };

  /**
   * For item bonus condition
   */
  get className() {
    return this.CLASS_NAME;
  }

  /**
   * For suitable item
   */
  get classNameSet() {
    return new Set([this.allClass, ...this.classNames]);
  }

  get isExpandedClass() {
    return [
      ClassName.Novice,
      ClassName.SuperNovice,
      ClassName.HyperNovice,

      ClassName.Doram,
      ClassName.SpiritHandler,

      ClassName.Taekwondo,
      ClassName.SoulLinker,
      ClassName.SoulReaper,
      ClassName.SoulAscetic,

      ClassName.StarGladiator,
      ClassName.StarEmperor,
      ClassName.SkyEmperor,

      ClassName.Gunslinger,
      ClassName.Rebellion,
      ClassName.NightWatch,

      ClassName.Ninja,
      ClassName.Oboro,
      ClassName.Shiranui,
      ClassName.Kagerou,
      ClassName.Shinkiro,
    ].includes(this.className);
  }

  get atkSkills() {
    const skills: AtkSkillModel[] = [...this._atkSkillList];

    if (environment.production) {
      return skills.filter((a) => !a.isDevMode);
    }

    return skills;
  }

  getAtkSkills(version?: SkillFormulaVersion): AtkSkillModel[] {
    return rebalancedSkillCatalog([...this.atkSkills, ...previewSkillsForClass(this.className), ...preview285SkillsForClass(this.className)], this.className, version).map(applyPreviewBuffs);
  }

  get passiveSkills() {
    const sortedSkill = this._passiveSkillList.map((a) => {
      if (a.inputType === 'selectButton') return a;

      const sortedDropdown = a.dropdown.sort(sortSkill);

      return {
        ...a,
        dropdown: [...sortedDropdown],
      };
    });

    if (environment.production) {
      return sortedSkill.filter((a) => !a.isDevMode);
    }

    return sortedSkill;
  }

  get activeSkills() {
    const sortedSkill = this._activeSkillList.map((a) => {
      if (a.inputType === 'selectButton') return a;
      const sortedDropdown = a.dropdown.sort(sortSkill);

      return {
        ...a,
        dropdown: [...sortedDropdown],
      };
    });

    if (environment.production) {
      return sortedSkill.filter((a) => !a.isDevMode);
    }

    return sortedSkill;
  }

  /** Auto-cast mechanics declared by this job and inherited job generations. */
  get autoCastDefinitions(): readonly ClassAutoCastDefinition[] {
    return this._autoCastDefinitions;
  }

  get initialStatPoint() {
    return this.initialStatusPoint;
  }

  get initialTraitPoint() {
    return this._initialTraitPoint;
  }

  get minMaxLevelCap() {
    return {
      minMaxLevel: this.minMaxLevel,
      maxJob: this.maxJob,
    };
  }

  get maxBaseStat() { return 130; }

  get maxAspd() { return ASPD_CAP; }

  get excludedJobLevels(): number[] { return [66, 67, 68, 69]; }

  /** Older positional saves may precede newly appended class controls. */
  matchesSavedSkillCount(kind: 'active' | 'passive', count: number | undefined): boolean {
    return count === (kind === 'active' ? this.activeSkills : this.passiveSkills).length;
  }

  protected learnLv(skillName: SKILL_NAME) {
    return this.bonuses.learnedSkillMap.get(skillName) || 0;
  }

  protected isSkillActive(skillName: SKILL_NAME) {
    return this.bonuses.activeSkillNames.has(skillName);
  }

  protected activeSkillLv(skillName: SKILL_NAME) {
    return this.bonuses.usedSkillMap.get(skillName) || 0;
  }

  /** Cross-skill state passed into damage formulas, so a (standalone) skill
   *  definition can read another skill's state without a `this` reference. Backed
   *  by the same name-keyed bonus maps as isSkillActive/activeSkillLv/learnLv. */
  get skillState(): SkillStateCtx {
    const nameOf = (s: SkillRef): SKILL_NAME => (typeof s === 'string' ? s : s.name);
    return {
      isActive: (s) => this.bonuses?.activeSkillNames.has(nameOf(s)) ?? false,
      activeLevel: (s) => this.bonuses?.usedSkillMap.get(nameOf(s)) || 0,
      learnedLevel: (s) => this.bonuses?.learnedSkillMap.get(nameOf(s)) || 0,
    };
  }

  setLearnSkills(a: { activeSkillIds: number[]; passiveSkillIds: number[]; }) {
    const { activeSkillIds, passiveSkillIds } = a;
    this.activeSkillIds = [...activeSkillIds];
    this.passiveSkillIds = [...passiveSkillIds];

    this.passiveSkillIds.forEach((skillLvl, idx) => {
      this.learnSkillMap.set(this.passiveSkills[idx].name, skillLvl);
    });

    return this;
  }

  getSkillBonusAndName() {
    const equipAtks: Record<string, any> = {};
    const masteryAtks: Record<string, any> = {};
    const activeSkillNames = new Set<string>();
    const learnedSkillMap = new Map<string, number>();
    const usedSkillMap = new Map<string, number>();

    this.activeBonus.clear();
    this.passiveBonus.clear();

    this.activeSkills.forEach((skill, index) => {
      const { bonus, isUse, skillLv, value } = skill.dropdown.find((x) => x.value === this.activeSkillIds[index]) ?? {};
      if (!isUse) return;

      usedSkillMap.set(skill.name, skillLv ?? Number(value));
      activeSkillNames.add(skill.name);
      if (!bonus) return;

      this.activeBonus.set(skill.name, bonus);
      const { isMasteryAtk } = skill;
      if (isMasteryAtk) {
        masteryAtks[skill.name] = bonus;
      } else {
        equipAtks[skill.name] = bonus;
      }
    });

    this.passiveSkills.forEach((skill, index) => {
      const { bonus, isUse, value, skillLv } = (skill.dropdown as any[]).find((x) => x.value === this.passiveSkillIds[index]) ?? {};
      if (!isUse) return;

      learnedSkillMap.set(skill.name, skillLv ?? Number(value));
      if (!bonus) return;

      this.passiveBonus.set(skill.name, bonus);
      const { isMasteryAtk } = skill;
      if (isMasteryAtk) {
        masteryAtks[skill.name] = bonus;
      } else {
        equipAtks[skill.name] = bonus;
      }
    });

    this.bonuses = { activeSkillNames, equipAtks, masteryAtks, learnedSkillMap, usedSkillMap };

    return { activeSkillNames, equipAtks, masteryAtks, learnedSkillMap, usedSkillMap };
  }

  private calcBaseAspd(weaponSubType: string): { baseAspd: number; shieldPenalty: number; } {
    const data = AspdTable[this.className] || { base: 156, shield: 0 };

    return {
      baseAspd: data.base + (data[weaponSubType] || 0),
      shieldPenalty: data.shield,
    };
  }

  private calcLeftWeaponAspd(weaponSubType: string) {
    if (!weaponSubType) return 0;

    return AspdTable[this.className]?.[`left-${weaponSubType}`] || 0;
  }

  protected getDynimicBonusFromSkill(prefix: string): Record<string, number> {
    const totalBonus = {};
    const addBonus = (key: string, val: number) => {
      if (totalBonus[key]) {
        totalBonus[key] += val;
      } else {
        totalBonus[key] = val;
      }
    };

    for (const bonus of [...this.passiveBonus.values(), ...this.activeBonus.values()]) {
      for (const [attr, val] of Object.entries(bonus)) {
        if (attr.startsWith(prefix)) {
          const actualAttr = attr.replace(prefix, '');
          addBonus(actualAttr, val);
        }
      }
    }

    return totalBonus;
  }

  protected getMasteryAtkByMonsterRace(race: string) {
    const allBonus = { ...(this.bonuses?.masteryAtks || {}), ...(this.bonuses?.equipAtks || {}) };

    const attrAtk = `x_race_${race}_atk`; // Demon Bane ex: x_race_demon_atk
    let totalAtk = 0;

    for (const [, bonus] of Object.entries(allBonus)) {
      totalAtk += bonus[attrAtk] || 0;
    }

    return { totalAtk };
  }

  protected getMasteryAtkByMonsterElement(element: string) {
    const allBonus = { ...(this.bonuses?.masteryAtks || {}), ...(this.bonuses?.equipAtks || {}) };

    const attrAtk = `x_element_${element}_atk`; // Demon Bane ex: x_element_undead_atk
    let totalAtk = 0;

    for (const [, bonus] of Object.entries(allBonus)) {
      totalAtk += bonus[attrAtk] || 0;
    }

    return { totalAtk };
  }

  protected calcHiddenMasteryAtk(_: InfoForClass, x?: { prefix?: string; suffix?: string; }) {
    const allBonus = { ...(this.bonuses?.masteryAtks || {}), ...(this.bonuses?.equipAtks || {}) };

    let attrAtk = 'x_atk';
    let attrMatk = 'x_matk';
    if (x?.prefix) {
      attrAtk = `${x.prefix}_atk`;
      attrMatk = `${x.prefix}_matk`;
    }
    if (x?.suffix) {
      attrAtk = `${attrAtk}_${x.suffix}`;
      attrMatk = `${attrMatk}_${x.suffix}`;
    }

    let totalAtk = 0;
    let totalMatk = 0;
    for (const [, bonus] of Object.entries(allBonus)) {
      totalAtk += bonus[attrAtk] || 0;
      totalMatk += bonus[attrMatk] || 0;
    }

    return { totalAtk, totalMatk };
  }

  calcAspd(a: AspdInput): number {
    const { weapon, weapon2, isEquipShield, aspd, aspdPercent, totalAgi, totalDex, potionAspds, skillAspd } = a;
    const aspdByPotion = potionAspds.reduce((total, potionAspd) => total + (AspdPotionFixBonus.get(potionAspd) || 0), 0);

    const isAllowShield = weapon.isAllowShield();

    const { rangeType, subTypeName } = weapon.data;
    const { baseAspd, shieldPenalty } = this.calcBaseAspd(subTypeName);
    const leftWeapon = isAllowShield ? this.calcLeftWeaponAspd(weapon2?.data?.subTypeName) : 0;
    const isRange = rangeType === 'range';
    const statAspd = Math.sqrt((totalAgi * totalAgi) / 2 + (totalDex * totalDex) / (isRange ? 7 : 5)) / 4;
    const potionSkillAspd = ((aspdByPotion + skillAspd) * totalAgi) / 200;
    const rawCalcAspd = Math.floor(statAspd + potionSkillAspd + ((isAllowShield && isEquipShield) ? shieldPenalty : 0));

    const baseAspd2 = Math.floor((baseAspd + leftWeapon + rawCalcAspd) * (100 - a.decreaseSkillAspdPercent) * 0.01);
    // `195 - baseAspd2` is the room a percentage bonus has to work in, so it is a distance
    // and never negative: a build whose base VelAtq already sits past 195 has none left.
    // Unclamped, the product goes negative and scales with the bonus, so gear that ADDS
    // attack speed SUBTRACTED VelAtq — 281 AGI on a katar read 193 at +50% and 192 at
    // +115%, which is how a Cenere card on a +11 Manto Replicador came out slower than no
    // card at all (tracker n6vaoExfL7IRa7yRsDWb). Above the ceiling the bonus is simply
    // worth nothing, which is what the clamp says.
    const equip = Math.floor(Math.max(0, 195 - baseAspd2) * (aspdPercent * 0.01));
    const final = Math.min(baseAspd2 + equip + aspd, this.maxAspd);

    // console.log({
    //   weapon,
    //   totalAgi,
    //   totalDex,
    //   baseAspd,
    //   aspd,
    //   aspdPercent,
    //   shieldPenalty,
    //   statAspd,
    //   potionSkillAspd,
    //   skillAspd,
    //   rawCalcAspd,
    //   baseAspd2,
    //   equip,
    //   final,
    // });

    return final;
  }

  calcSkillDmgByTotalHit(params: { finalDamage: number; skill: AtkSkillModel; info: InfoForClass; }): number {
    const { finalDamage, skill } = params;
    const skillHit = skill?.hit || 1;
    if (skillHit > 1) {
      return Math.floor(finalDamage / skillHit) * skillHit;
    }

    return finalDamage;
  }

  isAllowTraitStat() {
    return !!this.TraitBonusTable[50];
  }

  getJobBonusStatus(jobLevel: number) {
    const [str, agi, vit, int, dex, luk] = this.JobBonusTable[jobLevel] || [0, 0, 0, 0, 0, 0];
    const [pow, sta, wis, spl, con, crt] = this.TraitBonusTable[jobLevel] || [0, 0, 0, 0, 0, 0];

    return {
      str,
      agi,
      vit,
      int,
      dex,
      luk,
      pow,
      sta,
      wis,
      spl,
      con,
      crt,
    };
  }

  /**
   * Not show in screen
   * @param info
   * @returns mastery atk
   */
  getMasteryAtk(_: InfoForClass) {
    return 0;
  }

  getMasteryMatk(_: InfoForClass) {
    return 0;
  }

  getUiMasteryAtk(_: InfoForClass) {
    return 0;
  }

  getAdditionalDmg(_: InfoForClass) {
    return 0;
  }

  getAdditionalBasicDmg(_: InfoForClass) {
    return 0;
  }

  modifyFinalAtk(currentAtk: number, _: InfoForClass) {
    return currentAtk;
  }

  /**
   * Derivation of what {@link modifyFinalAtk} just did, for the damage graph's
   * "ATQ (ajuste de classe)" step.
   *
   * Undefined means "nothing worth spelling out": the default is a no-op, and a class
   * whose override is a single multiplier is already legible from the step's own
   * before/after pair. Override it where the adjustment is a chain the reader cannot
   * reconstruct from two numbers — the Taekwon line multiplies by Kihop and then by one
   * of three Fúrias, each with a formula of its own (see StarEmperor).
   *
   * The rows run from the incoming ATQ to the result and end on the emphasised total,
   * so the step's own dialog can show them verbatim; the "Adicional" chip reframes the
   * same rows between its "Valor anterior" and "Adicional" (see synthesizeChips).
   */
  getFinalAtkCalc(_currentAtk: number, _: InfoForClass): DamageFormulaCalc | undefined {
    return undefined;
  }

  setAdditionalBonus(params: AdditionalBonusInput): EquipmentSummaryModel {
    return params.totalBonus;
  }

  /**
   * Companion to the `totalBonus[attr] -= ...` a job writes when one effect supersedes
   * another (RO's "these two don't stack" rules). That subtraction keeps the *damage*
   * right, but the bonus-breakdown modal reads the per-source map instead, so without
   * this the modal keeps listing the superseded skill's full contribution — e.g. a
   * Windhawk with Ventos Sinistros + Ilimitar showed both at +350% when only one applies.
   *
   * Zeroes the entry rather than deleting it so the source still resolves for any other
   * attribute it carries. Safe to call when the skill contributed nothing.
   */
  protected clearSupersededBonusSource(params: AdditionalBonusInput, sourceName: string, attr: string): void {
    const source = params.bonusSources?.[sourceName];
    if (source && source[attr]) source[attr] = 0;
  }

  protected inheritSkills(params: { atkSkillList: AtkSkillModel[]; activeSkillList: ActiveSkillModel[]; passiveSkillList: ActiveSkillModel[]; classNames: ClassName[]; }) {
    const { activeSkillList, atkSkillList, classNames, passiveSkillList } = params;

    this._atkSkillList.push(...atkSkillList);
    this._activeSkillList.push(...activeSkillList);
    this._passiveSkillList.push(...passiveSkillList);
    this.classNames.push(...classNames);
    // Only the final fourth-job inheritance step adds these. Earlier generations
    // keep their catalogs, and the extra buff slots default to off in old saves.
    for (const className of classNames) {
      this._activeSkillList.push(...previewBuffsForClass(className));
      this._activeSkillList.push(...preview285BuffsForClass(className));
      this._passiveSkillList.push(...preview285PassivesForClass(className));
      if (className === ClassName.ElementalMaster) this.inheritAutoCasts([PREVIEW_285_AUTOCAST]);
    }
  }

  protected inheritAutoCasts(definitions: readonly ClassAutoCastDefinition[]): void {
    this._autoCastDefinitions.push(...definitions);
  }
}

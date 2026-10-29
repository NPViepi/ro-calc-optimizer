import {
  AllowAmmoMapper,
  ClassAmmoMapper,
  DEFAULT_PET_LOYALTY,
  readLoyaltyCondition,
  selectLoyaltyLines,
  ElementType,
  ItemSubTypeId,
  ItemTypeEnum,
  MainItemTypeSet,
  MainItemWithRelations,
  WeaponAmmoMapper,
} from 'src/app/constants';
import { SKILL_NAME } from 'src/app/constants/skill-name';
import { Monster, Weapon } from 'src/app/domain';
import { AtkSkillModel, CharacterBase, Doram } from 'src/app/jobs';
import { resolveSkillById, SKILL_ID_BY_NAME } from 'src/app/skills';
import { DEFAULT_PVP_CONTEXT, pickDefenderBonus, PlayerTargetProfile, PvpContext, PvpMode, woeFleeMultiplier } from './pvp';
import { bonusKeyLabel } from 'src/app/core/bonus-key-label';
import { createRawTotalBonus, floor, HEAD_SLOTS, isNumber, round } from 'src/app/utils';
import { ChanceModel } from 'src/app/models/chance-model';
import { BasicAspdModel, BasicDamageSummaryModel, MiscModel, SkillAspdModel, SkillDamageSummaryModel } from 'src/app/models/damage-summary.model';
import { EquipmentSummaryModel } from 'src/app/models/equipment-summary.model';
import { HpSpTable } from 'src/app/models/hp-sp-table.model';
import { AdditionalBonusInput } from 'src/app/models/info-for-class.model';
import { ItemModel, itemAutoCastEffectScripts, itemAutoCastPendingScripts, itemAutoCastScripts, itemBonusScriptEntries } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { MonsterModel } from 'src/app/models/monster.model';
import { StatusSummary } from 'src/app/models/status-summary.model';
import { ClassAutoCastDefinition, ItemAutoCastScript, ResolvedItemAutoCast, ResolvedItemAutoCastPending } from 'src/app/models/auto-cast.model';
import { DamageCalculator } from './damage-calculator';
import { isEventRunning, readUntilCondition } from './event-window';
import { HpSpCalculator } from './hp-sp-calculator';
import { ensureCustomAttachment } from './custom-attachments';
import { isCustomItem } from './custom-items';

// const getItem = (id: number) => items[id] as ItemModel;
const refinableItemTypes = [
  ItemTypeEnum.weapon,
  ItemTypeEnum.leftWeapon,
  ItemTypeEnum.headUpper,
  ItemTypeEnum.shield,
  ItemTypeEnum.armor,
  ItemTypeEnum.garment,
  ItemTypeEnum.boot,
  ItemTypeEnum.accLeft,
  ItemTypeEnum.accRight,

  ItemTypeEnum.shadowWeapon,
  ItemTypeEnum.shadowArmor,
  ItemTypeEnum.shadowBoot,
  ItemTypeEnum.shadowEarring,
  ItemTypeEnum.shadowPendant,
  ItemTypeEnum.shadowShield,
];
/** DEF a refine step is worth, per refine level: +1 each through +4, +2 through +8, and so
 *  on. Stored cumulatively (index = refine, so [0] is 0), because every reader wants the
 *  running total for a refine rather than the individual steps. */
const REFINE_DEF_BY_LEVEL = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5].reduce(
  (cumulative, step) => [...cumulative, cumulative[cumulative.length - 1] + step],
  [0],
);
/** Cumulative refine DEF, clamped at both ends (a refine can be undefined or over the table). */
const defByRefine = (refine: number): number =>
  REFINE_DEF_BY_LEVEL[Math.min(Math.max(Number(refine) || 0, 0), REFINE_DEF_BY_LEVEL.length - 1)];

const mainStatuses: (keyof EquipmentSummaryModel)[] = ['str', 'dex', 'int', 'agi', 'luk', 'vit'];
const traitStatuses: (keyof EquipmentSummaryModel)[] = ['pow', 'sta', 'wis', 'spl', 'con', 'crt'];

interface ValidationResult {
  isValid: boolean;
  isEndValidate?: boolean;
  restCondition: string;
}

/** Everything the "Resumo de atributos" panel reads that a ticked proc can move — see
 *  `Calculator.effectedState`. Both passes are assembled into this one shape, so a figure
 *  added to the panel cannot be wired to the base pass and forgotten on the effected one:
 *  it has to be filled in on both, or it does not compile. */
interface CharacterSheetModel {
  totalBonus: EquipmentSummaryModel;
  misc: MiscModel;
  skillFrequency: SkillAspdModel;
  basicAspd: BasicAspdModel;
  basicCriRate: number;
  criRangeBonus: number;
  maxHp: number;
  maxSp: number;
  defenses: DefenseSummary;
}

/** The defence block calcAllDefs solves — kept whole rather than unpacked into fields,
 *  so the same formulas can be run a second time against a ticked proc's bonuses and the two
 *  results stay interchangeable. */
interface DefenseSummary {
  def: number;
  softDef: number;
  mdef: number;
  softMdef: number;
  res: number;
  mres: number;
}

export class Calculator {
  private readonly DEFAULT_PERFECT_HIT = 5;

  private items!: Record<number, ItemModel>;

  private model: Partial<MainModel> = {
    class: undefined,
    level: 1,
    jobLevel: 1,
    str: 1,
    jobStr: undefined,
    agi: 1,
    jobAgi: undefined,
    vit: 1,
    jobVit: undefined,
    int: 1,
    jobInt: undefined,
    dex: 1,
    jobDex: undefined,
    luk: 1,
    jobLuk: undefined,
    propertyAtk: undefined,

    weapon: undefined,
    weaponRefine: undefined,
    weaponCard1: undefined,
    weaponCard2: undefined,
    weaponCard3: undefined,
    weaponEnchant1: undefined,
    weaponEnchant2: undefined,
    weaponEnchant3: undefined,

    ammo: undefined,

    headUpper: undefined,
    headUpperRefine: undefined,
    headUpperCard: undefined,
    headUpperEnchant1: undefined,
    headUpperEnchant2: undefined,
    headUpperEnchant3: undefined,
    headMiddle: undefined,
    headMiddleCard: undefined,
    headMiddleEnchant1: undefined,
    headMiddleEnchant2: undefined,
    headMiddleEnchant3: undefined,
    headLower: undefined,
    headLowerCard: undefined,
    headLowerEnchant1: undefined,
    headLowerEnchant2: undefined,
    headLowerEnchant3: undefined,

    armor: undefined,
    armorRefine: undefined,
    armorCard: undefined,
    armorEnchant1: undefined,
    armorEnchant2: undefined,
    armorEnchant3: undefined,
    shield: undefined,
    shieldRefine: undefined,
    shieldCard: undefined,
    shieldEnchant1: undefined,
    shieldEnchant2: undefined,
    shieldEnchant3: undefined,
    garment: undefined,
    garmentRefine: undefined,
    garmentCard: undefined,
    garmentEnchant1: undefined,
    garmentEnchant2: undefined,
    garmentEnchant3: undefined,
    boot: undefined,
    bootRefine: undefined,
    bootCard: undefined,
    bootEnchant1: undefined,
    bootEnchant2: undefined,
    bootEnchant3: undefined,

    accLeft: undefined,
    accLeftRefine: undefined,
    accLeftCard: undefined,
    accLeftEnchant1: undefined,
    accLeftEnchant2: undefined,
    accLeftEnchant3: undefined,
    accRight: undefined,
    accRightRefine: undefined,
    accRightCard: undefined,
    accRightEnchant1: undefined,
    accRightEnchant2: undefined,
    accRightEnchant3: undefined,

    pet: undefined,
  };
  private equipItem = new Map<ItemTypeEnum, ItemModel>();
  private equipItemName = new Map<ItemTypeEnum, string>();
  private equipItemNameSet = new Set<string>();
  /** Ids of the currently-equipped items — backs the `EQUIP_ID[...]` combo
   *  condition (id matching survives display-name changes like pt-BR localization). */
  private equipItemIdSet = new Set<number>();
  private mapRefine = new Map<ItemTypeEnum, number>();
  private mapGrade = new Map<ItemTypeEnum, string>();
  private mapItemNameRefine = new Map<string, number>();
  private usedSkillNames = new Set<string>();
  private learnedSkillMap = new Map<string, number>();
  /** Id-keyed mirrors of the name-keyed skill state above — back the `SKILL_ID[...]`
   *  / `ACTIVE_SKILL_ID[...]` conditions (id matching survives skill-name changes,
   *  same rationale as `equipItemIdSet`). Several names can share one id, so the
   *  learned map keeps the highest level among them. */
  private learnedSkillIdMap = new Map<number, number>();
  private usedSkillIdSet = new Set<number>();
  private equipAtkSkillBonus: Record<string, Record<string, any>> = {};
  private buffMasteryAtkBonus: Record<string, Record<string, any>> = {};
  private buffEquipAtkBonus: Record<string, Record<string, any>> = {};
  private masteryAtkSkillBonus: Record<string, any> = {};
  private consumableBonuses: any[] = [];
  private aspdPotion: number = undefined;
  private _resolvedItemAutoCasts: ResolvedItemAutoCast[] = [];
  private _resolvedItemAutoCastPending: ResolvedItemAutoCastPending[] = [];

  private skillName: SKILL_NAME = '' as any;
  private allStatus = createRawTotalBonus();
  private totalEquipStatus = createRawTotalBonus();
  private pvpContext: PvpContext = { ...DEFAULT_PVP_CONTEXT };
  private equipStatus: Partial<Record<ItemTypeEnum, EquipmentSummaryModel>> = {
    weapon: { ...this.allStatus },
    weaponCard1: { ...this.allStatus },
    weaponCard2: { ...this.allStatus },
    weaponCard3: { ...this.allStatus },
    weaponCard4: { ...this.allStatus },
    weaponEnchant1: { ...this.allStatus },
    weaponEnchant2: { ...this.allStatus },
    weaponEnchant3: { ...this.allStatus },
    ammo: { ...this.allStatus },
    headUpper: { ...this.allStatus },
    headUpperRefine: { ...this.allStatus },
    headUpperCard: { ...this.allStatus },
    headUpperEnchant1: { ...this.allStatus },
    headUpperEnchant2: { ...this.allStatus },
    headUpperEnchant3: { ...this.allStatus },
    headMiddle: { ...this.allStatus },
    headMiddleCard: { ...this.allStatus },
    headMiddleEnchant1: { ...this.allStatus },
    headMiddleEnchant2: { ...this.allStatus },
    headMiddleEnchant3: { ...this.allStatus },
    headLower: { ...this.allStatus },
    headLowerCard: { ...this.allStatus },
    headLowerEnchant1: { ...this.allStatus },
    headLowerEnchant2: { ...this.allStatus },
    headLowerEnchant3: { ...this.allStatus },
    armor: { ...this.allStatus },
    armorRefine: { ...this.allStatus },
    armorCard: { ...this.allStatus },
    armorEnchant1: { ...this.allStatus },
    armorEnchant2: { ...this.allStatus },
    armorEnchant3: { ...this.allStatus },
    shield: { ...this.allStatus },
    shieldRefine: { ...this.allStatus },
    shieldCard: { ...this.allStatus },
    shieldEnchant1: { ...this.allStatus },
    shieldEnchant2: { ...this.allStatus },
    shieldEnchant3: { ...this.allStatus },
    garment: { ...this.allStatus },
    garmentRefine: { ...this.allStatus },
    garmentCard: { ...this.allStatus },
    garmentEnchant1: { ...this.allStatus },
    garmentEnchant2: { ...this.allStatus },
    garmentEnchant3: { ...this.allStatus },
    boot: { ...this.allStatus },
    bootRefine: { ...this.allStatus },
    bootCard: { ...this.allStatus },
    bootEnchant1: { ...this.allStatus },
    bootEnchant2: { ...this.allStatus },
    bootEnchant3: { ...this.allStatus },
    accLeft: { ...this.allStatus },
    accLeftCard: { ...this.allStatus },
    accLeftEnchant1: { ...this.allStatus },
    accLeftEnchant2: { ...this.allStatus },
    accLeftEnchant3: { ...this.allStatus },
    accRight: { ...this.allStatus },
    accRightCard: { ...this.allStatus },
    accRightEnchant1: { ...this.allStatus },
    accRightEnchant2: { ...this.allStatus },
    accRightEnchant3: { ...this.allStatus },
  };
  private extraOptions: Record<string, number>[] = [];
  private weaponData = new Weapon();
  private leftWeaponData = new Weapon();
  private monster = new Monster();

  private hpSpCalculator = new HpSpCalculator();

  private _class: CharacterBase;
  private dmgCalculator = new DamageCalculator();
  private propertyBasicAtk = ElementType.Neutral;
  private propertyWindmind: ElementType;
  /** "Propriedade da arma muda para X" from a party buff (Insígnia Nv2): an endow, like the element picker. */
  private propertyBuffEndow: ElementType;
  private baseEquipmentStat: Record<string, number> = {};
  private finalMultipliers = [] as number[];

  private maxHp = 0;
  private maxSp = 0;

  private defenses: DefenseSummary = { def: 0, softDef: 0, mdef: 0, softMdef: 0, res: 0, mres: 0 };

  private damageSummary = {} as BasicDamageSummaryModel & Partial<SkillDamageSummaryModel>;
  private miscSummary = {} as MiscModel;
  private basicAspd = { hitsPerSec: 0, totalAspd: 0 } as BasicAspdModel;

  private selectedChanceList = [] as string[];
  private _chanceList = [] as ChanceModel[];
  /**
   * The character sheet as it stands while the ticked "Efeitos" (procs) are running.
   * `recalcExtraBonus` already solves that pass to get the effected damage; the panel
   * reads the same state, so a ticked +200 DES shows up in DES, in DES2 INT1 and in the
   * casting window instead of only inside the damage number. Null while nothing is
   * ticked. The base damage figures are deliberately NOT part of it — the damage panel
   * shows base and effected side by side ("Sem efeitos"), so those keep their own pair.
   */
  private effectedState: CharacterSheetModel | null = null;
  private equipCombo = new Set<string>();

  private skillFrequency: SkillAspdModel = {
    cd: 0,
    reducedCd: 0,
    vct: 0,
    reducedVct: 0,
    fct: 0,
    reducedFct: 0,
    acd: 0,
    reducedAcd: 0,
    skillLevel: 0,
    clientFct: 0,
    clientVct: 0,
    clientAcd: 0,
    clientCd: 0,
    castPeriod: 0,
    hitPeriod: 0,
    totalHitPerSec: 0,
    sumDex2Int1: 0,
    vctByStat: 0,
    vctSkill: 0,
  };

  private possiblyDamages: any[] = [];

  get chanceList() {
    return this._chanceList;
  }

  setMasterItems(items: any) {
    this.items = items;

    return this;
  }

  /** What `UNTIL[...]` event bonuses are judged against; the real time unless a spec pins it. */
  private now: () => Date = () => new Date();

  /** Pins the clock, so a recording made during an event keeps its event bonuses after it ends. */
  setClock(now: () => Date) {
    this.now = now;

    return this;
  }

  private getItem(id: number) {
    // Without the item DB this reads through undefined and reports only the id it was
    // looking for, from deep inside setWeapon — naming neither the calculator nor the
    // setup that was skipped. Every instance must be seeded before a model is loaded.
    if (!this.items) throw new Error(`Calculator: setMasterItems() was never called, so item ${id} cannot be resolved.`);

    return this.items[id];
  }

  private isUsedSkill(skillName: string) {
    return this.usedSkillNames.has(skillName);
  }

  /** Learned level of a skill by its in-game id (0 if not learned) — the id-based
   *  counterpart of `learnedSkillMap.get(name)`, used by the `SKILL_ID[...]` tokens. */
  private learnedSkillLevelById(skillId: number) {
    return this.learnedSkillIdMap.get(skillId) ?? 0;
  }

  /** Whether an active/used skill is in play, matched by in-game id (the id-based
   *  counterpart of `isUsedSkill`), used by the `ACTIVE_SKILL_ID[...]` token. */
  private isUsedSkillId(skillId: number) {
    return this.usedSkillIdSet.has(skillId);
  }

  private get additionalBonusInput(): AdditionalBonusInput {
    return {
      model: this.model,
      monster: this.monster,
      totalBonus: this.totalEquipStatus,
      weapon: this.weaponData,
      skillName: this.skillName,
      ammoElement: this.equipItem.get(ItemTypeEnum.ammo)?.propertyAtk,
      // Live reference (not a copy) to the per-skill bonus map getItemSummary() feeds
      // the bonus-breakdown modal. A job that cancels a superseded bonus needs to clear
      // it here too, or the modal keeps listing a contribution the damage never got —
      // see CharacterBase.clearSupersededBonusSource.
      bonusSources: this.equipAtkSkillBonus,
    };
  }

  private isEquipItem(itemName: string) {
    return this.equipItemNameSet.has(itemName);
  }

  private isEquipItemId(itemId: number) {
    return this.equipItemIdSet.has(itemId);
  }

  isAllowAmmo() {
    const cName = this._class.className;

    return AllowAmmoMapper[this.weaponData.data?.typeName] || ClassAmmoMapper[cName] != null;
  }

  isAllowShield() {
    // if (!this.weaponData.data?.typeName && !environment.production) {
    //   switch (this._class.className) {
    //     case ClassName.Warlock:
    //       return true;
    //   }

    //   return false;
    // }

    return this.weaponData.isAllowShield();
  }

  getAmmoSubTypeId() {
    const cName = this._class.className;

    return WeaponAmmoMapper[this.weaponData.data?.typeName] || ClassAmmoMapper[cName];
  }

  private getChanceBonus() {
    return this._chanceList.filter((c) => this.selectedChanceList.includes(c.name)).map((c) => c.bonus);
  }

  private toPercent(n: number) {
    return n * 0.01;
  }

  setClass(c: CharacterBase) {
    this._class = c;

    return this;
  }

  /** The class skill catalog used by configurable auto-cast selectors. */
  get atkSkills(): AtkSkillModel[] {
    return this._class?.getAtkSkills(this.model.skillFormulaVersion) ?? [];
  }

  /** Learned/active levels after the controller has prepared the current build. */
  get skillState() {
    return this._class.skillState;
  }

  /** Final build stats used by class auto-cast chance formulas. */
  get status(): StatusSummary {
    return this.dmgCalculator.status;
  }

  /** Equipped records, including cards and enchants loaded into their relation slots. */
  get equippedItems(): ItemModel[] {
    return [...this.equipItem.values()].filter((item): item is ItemModel => !!item);
  }

  get autoCastDefinitions(): readonly ClassAutoCastDefinition[] {
    return this._class?.autoCastDefinitions ?? [];
  }

  get resolvedItemAutoCasts(): readonly ResolvedItemAutoCast[] {
    return this._resolvedItemAutoCasts;
  }

  getGrantedSkillLevel(skillId: number): number {
    return this.totalEquipStatus[`enable_skill__${skillId}`] ?? 0;
  }

  get resolvedItemAutoCastPending(): readonly ResolvedItemAutoCastPending[] {
    return this._resolvedItemAutoCastPending;
  }

  /**
   * @param relieveLevel the target's Aliviar level (0 = off). Ignored for a monster that
   *   does not cast Aliviar — see Monster.setData.
   */
  setMonster(monster: MonsterModel, relieveLevel = 0) {
    this.monster.setData(monster, relieveLevel);
    // Leaving PVP: the vs-monster path must never carry a stale PVP context.
    this.pvpContext = { ...DEFAULT_PVP_CONTEXT };

    return this;
  }

  /**
   * Configure the target as another player (PVP). The profile carries the
   * target's already-computed defenses (see docs/pvp.md); `mode` selects the
   * castle reduction layer. The attacker's own race (player_human/doram) is
   * derived from the equipped class for the defender's subrace_* lookup.
   */
  setPlayerTarget(profile: PlayerTargetProfile, mode: PvpMode) {
    const effectiveFlee = Math.round(profile.flee * woeFleeMultiplier(mode));
    this.monster.setPlayerTargetData(profile, effectiveFlee);
    const attackerRace = this._class instanceof Doram ? 'player_doram' : 'player_human';
    this.pvpContext = { mode, attackerRace, defenderBonus: profile.defenderBonus };

    return this;
  }

  setModel(model: any) {
    this.model = { ...model };

    return this;
  }

  /** Override the accumulation used for one rotation solve without changing saved build state. */
  setSkillStacks(stacks?: Record<string, number>) {
    this.model.skillStacks = stacks;
    return this;
  }

  setWeapon(params: { itemId: number; refine: number; grade?: string; }) {
    const { itemId, refine, grade } = params;

    const itemData = this.getItem(itemId);
    this.equipItem.set(ItemTypeEnum.weapon, itemData);
    if (itemData) {
      this.equipItemName.set(ItemTypeEnum.weapon, this.matchName(itemData));
    } else {
      this.equipItemName.delete(ItemTypeEnum.weapon);
    }

    this.mapRefine.set(ItemTypeEnum.weapon, refine);
    this.mapGrade.set(ItemTypeEnum.weapon, grade);
    this.weaponData.set({ itemData, refineLevel: refine, grade });

    return this;
  }

  setItem(params: { itemType: ItemTypeEnum; itemId: number; refine?: number; grade?: string; }) {
    const { itemId, itemType, refine, grade } = params;
    const itemData = this.getItem(itemId);
    this.equipItem.set(itemType, itemData);
    if (itemData) {
      this.equipItemName.set(itemType, this.matchName(itemData));
    } else {
      this.equipItemName.delete(itemType);
    }

    if (refine != null) {
      this.mapRefine.set(itemType, refine);
    }

    if (grade != null) {
      this.mapGrade.set(itemType, grade);
    }

    return this;
  }

  setUsedSkillNames(usedSkillNames: Set<string>) {
    this.usedSkillNames = usedSkillNames;

    this.usedSkillIdSet = new Set<number>();
    for (const name of usedSkillNames) {
      const id = SKILL_ID_BY_NAME[name];
      if (id !== undefined) this.usedSkillIdSet.add(id);
    }

    return this;
  }

  setLearnedSkills(learnedSkillMap: Map<string, number>) {
    this.learnedSkillMap = learnedSkillMap;

    this.learnedSkillIdMap = new Map<number, number>();
    for (const [name, level] of learnedSkillMap) {
      const id = SKILL_ID_BY_NAME[name];
      if (id === undefined) continue;
      this.learnedSkillIdMap.set(id, Math.max(this.learnedSkillIdMap.get(id) ?? 0, level));
    }

    return this;
  }

  setOffensiveSkill(skillValue: string) {
    const [, _skillName] = skillValue?.match(/(.+)==(\d+)/) ?? [];
    this.skillName = _skillName as SKILL_NAME;

    return this;
  }

  setEquipAtkSkillAtk(equipSkillBonus: Record<string, any>) {
    // Copy each skill's bonus map, not just the outer record: the values handed in are
    // the *skill catalog's own* dropdown `bonus` objects (see _character-base.abstract.ts
    // getSkillBonusAndName -> `equipAtks[skill.name] = bonus`, whose source is a const
    // like no-limit-fn.ts's `{ range: 350 }`). A shallow spread would leave those shared,
    // so anything writing to this map — e.g. CharacterBase.clearSupersededBonusSource
    // zeroing a superseded bonus — would permanently edit the catalog for the whole
    // session, silently deleting that skill's bonus from every later calculation.
    this.equipAtkSkillBonus = Object.fromEntries(Object.entries(equipSkillBonus).map(([skillName, bonus]) => [skillName, { ...bonus }]));

    return this;
  }

  setBuffBonus(params: { masteryAtk: Record<string, any>; equipAtk: Record<string, any>; }) {
    const { masteryAtk, equipAtk } = params;
    this.buffEquipAtkBonus = { ...equipAtk };
    this.buffMasteryAtkBonus = { ...masteryAtk };

    return this;
  }

  setMasterySkillAtk(masterySkillBonus: Record<string, any>) {
    this.masteryAtkSkillBonus = { ...masterySkillBonus };

    return this;
  }

  setConsumables(consumableBonuses: any[]) {
    this.consumableBonuses = [...consumableBonuses];

    return this;
  }

  setAspdPotion(aspdPotion: number) {
    this.aspdPotion = aspdPotion;

    return this;
  }

  setExtraOptions(extraOptions: any[]) {
    this.extraOptions = extraOptions;

    return this;
  }

  setSelectedChances(selectedChances: string[]) {
    this.selectedChanceList = [...selectedChances.filter((name) => this._chanceList.some((c) => c.name === name))];

    return this;
  }

  isChanceSelected(name: string): boolean {
    return this.selectedChanceList.includes(name);
  }

  loadItemFromModel(model: any) {
    if (!this.items) throw new Error('Chame setMasterItems antes de loadItemFromModel.');
    this.model = { ...model };
    this.weaponData.set({ itemData: {} as any, refineLevel: 0, grade: '' });
    this.leftWeaponData.set({ itemData: {} as any, refineLevel: 0, grade: '' });
    this.equipItem.clear();
    this.equipItemName.clear();
    this.mapGrade.clear();

    this.mapRefine.clear();
    this.mapItemNameRefine.clear();

    const items = Object.entries(MainItemWithRelations) as [ItemTypeEnum, ItemTypeEnum[]][];

    // A head gear that spans several positions (a Middle+Lower mask) is ONE physical item,
    // but producers legitimately write its id into every slot it covers: replay import
    // fans out the equipped bitmask that way, and share links saved before the UI enforced
    // occupancy can too. Equipping it once per slot would apply its whole script twice and
    // double-count `REFINE[headMiddle,headLower==N]` style conditions, so keep the first
    // slot and drop the repeats. Two different head gears are unaffected — only a repeated
    // id is collapsed, and no two head slots can legitimately hold the same item.
    const seenHeadGear = new Set<number>();

    for (const [mainItemType, itemRelations] of items) {
      const itemId = model[mainItemType];
      if (!isNumber(itemId)) continue;

      if (HEAD_SLOTS.includes(mainItemType)) {
        if (seenHeadGear.has(itemId)) continue;
        seenHeadGear.add(itemId);
      }

      const parent = this.items[itemId];
      const custom = isCustomItem(parent) ? ensureCustomAttachment(model, mainItemType, parent) : undefined;
      const refine = custom?.refine ?? model[`${mainItemType}Refine`];
      const grade = custom?.grade ?? model[`${mainItemType}Grade`];
      // console.log({itemId, refine, itemRelations})
      if (mainItemType === ItemTypeEnum.weapon) {
        this.setWeapon({ itemId, refine, grade });
      } else {
        // console.log({ mainItemType, refine });
        this.setItem({ itemType: mainItemType, itemId, refine, grade });
      }

      if (mainItemType === ItemTypeEnum.leftWeapon && itemId) {
        this.leftWeaponData.set({ itemData: this.items[itemId], refineLevel: refine, grade });
      }

      if (custom) {
        // The sidecar is the only attachment source for a custom parent. Legacy
        // card/enchant fields must never contribute alongside it.
        custom.cards.forEach((id, index) => {
          if (id) this.setItem({ itemType: `${mainItemType}CustomCard${index + 1}` as ItemTypeEnum, itemId: id, refine, grade });
        });
        custom.enchants.forEach((id, index) => {
          if (id) this.setItem({ itemType: `${mainItemType}CustomEnchant${index + 1}` as ItemTypeEnum, itemId: id, refine, grade });
        });
        continue;
      }
      for (const itemRelation of itemRelations) {
        const itemId2 = this.equipItem.get(mainItemType) ? model[itemRelation] : 0;
        if (!isNumber(itemId2)) continue;

        this.setItem({ itemType: itemRelation, itemId: itemId2 });
      }
    }

    this.equipItemNameSet = new Set(this.equipItemName.values());
    this.equipItemIdSet = new Set([...this.equipItem.values()].map((it) => it?.id).filter((id): id is number => !!id));
    for (const [itemType, itemName] of this.equipItemName) {
      this.mapItemNameRefine.set(itemName, this.mapRefine.get(itemType));
    }

    return this;
  }

  private calcPropertyAtkType() {
    const weaponEle = this.weaponData?.data?.propertyAtk;
    const buff = this.model.propertyAtk;
    const windmind = this.propertyWindmind;
    const buffEndow = this.propertyBuffEndow;
    const ammo = this.equipItem.get(ItemTypeEnum.ammo)?.propertyAtk;

    this.propertyBasicAtk = windmind ?? buff ?? buffEndow ?? ammo ?? weaponEle ?? ElementType.Neutral;
  }

  calcAllAtk() {
    this.calcPropertyAtkType();

    this.dmgCalculator
      .setArgs({
        equipStatus: this.equipStatus as any,
        totalEquipStatus: this.totalEquipStatus,
        model: this.model,
        equipAtkSkillBonus: this.equipAtkSkillBonus,
        buffMasteryAtkBonus: this.buffMasteryAtkBonus,
        masteryAtkSkillBonus: this.masteryAtkSkillBonus,
        finalMultipliers: this.finalMultipliers,
        _class: this._class,
        monster: this.monster,
        weaponData: this.weaponData,
        aspdPotion: this.aspdPotion,
        buffEndow: this.propertyBuffEndow,
        leftWeaponData: this.leftWeaponData,
        pvp: this.pvpContext,
      })
      .setAmmoPropertyAtk(this.equipItem.get(ItemTypeEnum.ammo)?.propertyAtk);

    return this;
  }

  private calcConstantBonus(itemRefine: number, miniScript: string) {
    const [condition, bonus] = miniScript.split('===');
    const conditionNum = Number(condition);
    if (conditionNum && itemRefine < conditionNum) return 0;

    const bonusNum = Number(bonus);
    if (conditionNum && bonusNum) {
      return bonusNum;
    }

    const [statusCondition, value] = condition.split(':');
    if (statusCondition && value) {
      const passCondition = this.model[statusCondition] >= Number(value);
      if (passCondition) return Number(bonus);

      return 0;
    }

    // 50(90 วินาที)
    const actualBonus = this.getActualBonus(bonus);
    if (isNumber(actualBonus)) return actualBonus;

    return 0;
  }

  private getActualBonus(bonusScript: string) {
    if (bonusScript.includes('(')) {
      const end = bonusScript.indexOf('(');

      return Number(bonusScript.substring(0, end));
    }

    return Number(bonusScript);
  }

  private calcStepBonus(itemRefine: number, lineScript: string) {
    const [condition, bonus] = lineScript.split('---');
    const conditionNum = Number(condition);
    const bonusNum = Number(bonus);
    const calc = (actual: number, cond: number) => floor(actual / cond) * bonusNum;
    const refineFrom = condition.match(/^REFINE_FROM\[(\d+)]$/);
    if (refineFrom) return Math.max(0, itemRefine - Number(refineFrom[1]) + 1) * bonusNum;
    // console.log({ lineScript, conditionNum, bonusNum });
    if (conditionNum && bonusNum) {
      return floor(itemRefine / conditionNum) * bonusNum;
    }

    // LEARN_SKILL[Snake Eyes==]1---2
    const [, skillName, skillLv] = condition.match(/LEARN_SKILL\[(.+?)==(\d+)]/) ?? [];
    if (skillName) {
      const learned = this.learnedSkillMap.get(skillName) || 0;
      return calc(learned, Number(skillLv));
    }

    // SKILL_ID[4==2]---1  — id form of LEARN_SKILL above (scale by learned level).
    // Lookbehind keeps it from matching the SKILL_ID[ tail inside ACTIVE_SKILL_ID[.
    const [, scaleSkillId, scaleSkillLv] = condition.match(/(?<!ACTIVE_)SKILL_ID\[(\d+)==(\d+)]/) ?? [];
    if (scaleSkillId) {
      const learned = this.learnedSkillLevelById(Number(scaleSkillId));
      return calc(learned, Number(scaleSkillLv));
    }

    // level:1(125)---1
    // level:1(1-125)---1
    // jobLevel:5(1-30)----1  — same shape on the job level, for "a cada 5 níveis de classe
    // até o 30: todos os talentos -1" (Colar de Ampulheta, 490087).
    // str:10(1-50)----5  — and on a base stat, for "a cada 10 de FOR base até o 50: ATQ -5"
    // (Carta Gemaring, 4662).
    const [, rangedStatus, everyBaseLv, range] = condition.match(/(level|jobLevel|str|int|dex|agi|vit|luk):(-*\d+)\((.+)\)/) ?? [];
    if (everyBaseLv && range) {
      const [min, max = 999] = range.split('-').map(Number);
      const everyNum = Number(everyBaseLv);
      const cap = Math.min(max, this.model[rangedStatus]);

      return calc(cap - min + 1, everyNum);
    }

    // dex:10---1
    const [, status, statusCond] = condition.match(/(level|jobLevel|str|int|dex|agi|vit|luk):(-*\d+)/) ?? [];
    // console.log({ status, statusCond });
    if (status) {
      const myStatus = this.model[status];
      return calc(myStatus, Number(statusCond));
    }

    // SUM[str,luk==80]---6
    const [, sumOf, sumCond] = condition.match(/SUM\[(\D+)==(\d+)]/) ?? [];
    if (sumOf) {
      const sum = sumOf.split(',').reduce((total, stat) => total + (this.model[stat] || 0), 0);
      return calc(sum, Number(sumCond));
    }

    // REFINE[boot==1]---2
    // REFINE[shadowWeapon,shadowArmor==1(30)]---1  — the optional (N) caps the summed
    // refine, for sets worded "a cada refino de cada peça do conjunto (até o +30)".
    // Same shape as the `level:1(1-125)---1` cap above.
    const [, refineCombo, refineCond, refineCap] = condition.match(/^REFINE\[(\D*?)=*=*(\d+)(?:\((\d+)\))?]/) ?? [];
    // console.log({ condition, refineCombo, refineCond });
    if (refineCombo) {
      const totalRefine = refineCombo
        .split(',')
        .map((itemType) => this.mapRefine.get(itemType as ItemTypeEnum))
        .reduce((sum, cur) => sum + (cur || 0), 0);

      return calc(refineCap ? Math.min(totalRefine, Number(refineCap)) : totalRefine, Number(refineCond));
    }

    // REFINE_NAME[Judgment Slasher,Repent Slasher==3]---5
    const [, itemNames, refineCond2] = condition.match(/^REFINE_NAME\[(\D+)==(\d+)?]/) ?? [];
    if (refineCond2) {
      const totalRefine = itemNames
        .split(',')
        .map((itemName) => this.mapItemNameRefine.get(itemName))
        .reduce((sum, cur) => sum + (cur || 0), 0);

      return calc(totalRefine, Number(refineCond2));
    }

    // GVALUE[weapon==1]---2
    const [, itemPosition, gradeRate] = condition.match(/GVALUE\[(\D+)==(\d+)]/) ?? [];
    if (itemPosition && gradeRate) {
      const grade = this.getGradeValue(this.mapGrade.get(itemPosition as any));

      return calc(grade, Number(gradeRate));
    }

    return 0;
  }

  private getGradeValue(grade: string) {
    const x = {
      d: 1,
      D: 1,
      c: 2,
      C: 2,
      b: 3,
      B: 3,
      a: 4,
      A: 4,
    };

    return x[grade] || 0;
  }

  private isValidGrade(itemGrade: string, targetGrade: string): boolean {
    if (!itemGrade || !targetGrade) return false;

    return this.getGradeValue(itemGrade) >= this.getGradeValue(targetGrade);
  }

  private validateCondition(params: { itemType: ItemTypeEnum; itemRefine: number; script: string; }): ValidationResult {
    const { itemRefine, itemType, script } = params;
    let restCondition = script;
    const mainStatusRegex = /^(str|int|dex|agi|vit|luk|level):(\d+)&&(\d+===.+)/;
    const [, status, statusCondition, raw] = restCondition.match(mainStatusRegex) ?? [];
    if (status) {
      const isPass = this.model[status] >= Number(statusCondition);

      return { isValid: isPass, restCondition: raw };
    }

    // UNTIL[2026-10-12]===50 — a "[Durante o Evento]" bonus, paid through that São Paulo day.
    const until = readUntilCondition(restCondition);
    if (until) {
      const isValid = isEventRunning(until.lastDay, this.now());
      if (!isValid) return { isValid, restCondition };

      restCondition = restCondition.replace(until.clause, '');
      if (restCondition.startsWith('===')) return { isValid, restCondition: restCondition.replace('===', '') };
    }

    // WEAPON_LEVEL
    const [toRemoveA, wLevel] = restCondition.match(/WEAPON_LEVEL\[(\d+)]/) ?? [];
    if (wLevel) {
      const wLv = Number(wLevel);
      const weaponLvl = (itemType || '').toLowerCase().startsWith('left') ? this.leftWeaponData?.data?.baseWeaponLevel : this.weaponData.data.baseWeaponLevel;
      const isValid = weaponLvl === wLv;
      if (!isValid) return { isValid, restCondition };

      restCondition = restCondition.replace(toRemoveA, '');
      if (restCondition.startsWith('===')) return { isValid, restCondition: restCondition.replace('===', '') };
    }

    // LOYALTY[3]===4  — the pet intimacy tier (see PetLoyalty).
    // A tier applies at that intimacy **and above**, so an egg that names only "Na Lealdade
    // Normal" keeps paying at Alta. The tiers still replace one another rather than
    // stacking; that half is enforced earlier, by selectLoyaltyLines in calcItemStatus,
    // which leaves at most one tier line per bonus. Without that narrowing this `>=` would
    // sum every tier at or below the pet's and quadruple the bonus. Only the eggs use this
    // condition; for everything else in item.json the match fails and the script goes
    // through unchanged.
    const loyalty = readLoyaltyCondition(restCondition);
    if (loyalty) {
      const isValid = (this.model.petLoyalty ?? DEFAULT_PET_LOYALTY) >= loyalty.tier;
      if (!isValid) return { isValid, restCondition };

      restCondition = restCondition.replace(loyalty.clause, '');
      if (restCondition.startsWith('===')) return { isValid, restCondition: restCondition.replace('===', '') };
    }

    // WEAPON_TYPE[bow]5
    const [toRemoveB, wType] = restCondition.match(/WEAPON_TYPE\[(\D+)]/) ?? [];
    if (wType) {
      const isValid = wType.split('||').includes(this.weaponData.data.typeName);
      if (!isValid) return { isValid, restCondition };

      restCondition = restCondition.replace(toRemoveB, '');
      if (restCondition.startsWith('===')) return { isValid, restCondition: restCondition.replace('===', '') };
    }

    if (restCondition.includes('GRADE')) {
      // GRADE[armor==A]===5
      // EQUIP[Time Dimensions Rune Crown (Abyss Chaser)]GRADE[weapon==A]GRADE[headUpper==A]REFINE[weapon,headUpper==1]---1
      for (let index = 0; index < 2; index++) {
        const [toRemoveGrade, conditionGrade] = restCondition.match(/GRADE\[(\D+?)]/) ?? [];
        if (!conditionGrade) break;

        const [rawitemType, targetGrade] = conditionGrade.split('==') ?? [];
        const tarGetitemType = rawitemType === 'me' ? itemType.replace(/Enchant\d/, '') : rawitemType;
        // console.log({ restCondition, itemType, tarGetitemType, rawitemType, targetGrade })
        const itemGrade = this.mapGrade.get(tarGetitemType as ItemTypeEnum);
        const isValid = this.isValidGrade(itemGrade, targetGrade);
        if (!isValid) return { isValid, restCondition };

        restCondition = restCondition.replace(toRemoveGrade, '');
        if (restCondition.startsWith('===')) return { isValid, restCondition: restCondition.replace('===', '') };

        if (!restCondition.includes('GRADE[')) break;
      }

      // EQUIP[Time Gap Kurojin (B)&&Time Dimensions Rune Crown (Shinkiro & Shiranui)]GRADES[weapon==A&&leftWeapon==A&&headUpper==A]===0.7
      const [toRemoveGrade, conditionGrades] = restCondition.match(/GRADES\[(\D+?)]/) ?? [];
      if (conditionGrades) {
        for (const conditionGrade of conditionGrades.split('&&')) {
          const [rawitemType, targetGrade] = conditionGrade.split('==') ?? [];
          const tarGetitemType = rawitemType === 'me' ? itemType.replace(/Enchant\d/, '') : rawitemType;
          // console.log({ restCondition, itemType, tarGetitemType, rawitemType, targetGrade })
          const itemGrade = this.mapGrade.get(tarGetitemType as ItemTypeEnum);
          const isValid = this.isValidGrade(itemGrade, targetGrade);
          if (!isValid) return { isValid, restCondition };
        }

        restCondition = restCondition.replace(toRemoveGrade, '');
        if (restCondition.startsWith('===')) return { isValid: true, restCondition: restCondition.replace('===', '') };
      }
    }

    // [weaponType=Pistol]20
    const [_, wSubTypeName] = restCondition.match(/^\[weaponType=(.+?)\]/) ?? [];
    if (wSubTypeName) {
      const subTypeName = this.weaponData?.data?.subTypeName;
      if (wSubTypeName !== subTypeName) return { isValid: false, restCondition };
      restCondition = restCondition.replace(`[weaponType=${wSubTypeName}]`, '');

      return { isValid: true, restCondition };
    }

    // SUM[str,luk==80]---6
    const [, toRemove3, statStr, sumCond] = restCondition.match(/(SUM\[(\D+)==(\d+)])[^-]/) ?? [];
    if (statStr && sumCond) {
      const totalStat = statStr.split(',').reduce((total, stat) => total + (this.model[stat] || 0), 0);
      const cond = Number(sumCond);
      if (totalStat < cond) return { isValid: false, restCondition };

      restCondition = restCondition.replace(toRemove3, '');
    }

    // USED[Mechanic]20
    const [toRemove, usedByClass] = restCondition.match(/USED\[(.+?)\]/) ?? [];
    if (usedByClass) {
      const cName = this._class.className.replace(' ', '');
      const isUsed = usedByClass.split('||').some((className) => className === cName || className === this._class.className || this._class.classNameSet.has(className));
      if (!isUsed) return { isValid: false, restCondition };

      restCondition = restCondition.replace(toRemove, '');
    }

    // LEARN_SKILL[Meow Meow==5]2
    const [_raw, toRemove_, learnCond] = restCondition.match(/(LEARN_SKILL\[(.+?)\]=?=?=?)-?\d+/) ?? [];
    if (learnCond) {
      const [skillName, skillLv] = learnCond.split('==');
      const isPass = this.learnedSkillMap.get(skillName) >= Number(skillLv);
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(toRemove_, '');
    }

    // SKILL_ID[2418==5]1  — id form of LEARN_SKILL gating above. The lookbehind
    // stops this from matching the SKILL_ID[ tail inside ACTIVE_SKILL_ID[.
    const [, skillIdRemove, skillIdCond] = restCondition.match(/((?<!ACTIVE_)SKILL_ID\[(.+?)\]=?=?=?)-?\d+/) ?? [];
    if (skillIdCond) {
      const [skillId, skillLv] = skillIdCond.split('==');
      const isPass = this.learnedSkillLevelById(Number(skillId)) >= Number(skillLv);
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(skillIdRemove, '');
    }

    // LEARN_SKILL2[Illusion - Shadow==5]SUM[level==4]---2
    const [_raw2, toRemove2_, learnCond2] = restCondition.match(/(LEARN_SKILL2\[(.+?)\]=?=?=?)/) ?? [];
    if (learnCond2) {
      const [skillName, skillLv] = learnCond2.split('==');
      const isPass = this.learnedSkillMap.get(skillName) >= Number(skillLv);
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(toRemove2_, '');
    }

    // SKILL_ID2[2255==5]SUM[level==4]---2  — id form of LEARN_SKILL2 gating above
    const [, skillId2Remove, skillId2Cond] = restCondition.match(/(SKILL_ID2\[(.+?)\]=?=?=?)/) ?? [];
    if (skillId2Cond) {
      const [skillId, skillLv] = skillId2Cond.split('==');
      const isPass = this.learnedSkillLevelById(Number(skillId)) >= Number(skillLv);
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(skillId2Remove, '');
    }

    // LEVEL[130]2---1
    // LEVEL[1-129]2---1
    const [toRemove2, lvCond] = restCondition.match(/LEVEL\[(.+?)\]/) ?? [];
    if (lvCond) {
      const [minLv, maxLv = 999] = lvCond.split('-').map(Number);
      const isPass = minLv <= this.model.level && this.model.level <= maxLv;
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(toRemove2, '');
    }

    // ACTIVE_SKILL_ID[2479]9===50  — id form of ACTIVE_SKILL gating below
    const [unusedActId, actSkillId] = restCondition.match(/ACTIVE_SKILL_ID\[(\d+)]/) ?? [];
    if (actSkillId) {
      if (!this.isUsedSkillId(Number(actSkillId))) return { isValid: false, restCondition };

      restCondition = restCondition.replace(unusedActId, '');
    }

    // ACTIVE_SKILL[Platinum Altar]9===50(90 วินาที)
    const [unused2, actSkillName] = restCondition.match(/ACTIVE_SKILL\[(.+)]/) ?? [];
    if (actSkillName) {
      // console.log({ script, unused2, actSkillName });
      const isUsed = this.isUsedSkill(actSkillName);

      if (!isUsed) return { isValid: false, restCondition };

      restCondition = restCondition.replace(unused2, '');
    }

    for (let i = 1; i <= 3; i++) {
      const [unused, itemType, refineCond] = restCondition.match(/XREFINEX\[(\D*?)=*=*(\d+)]/) ?? [];
      if (itemType) {
        const refine = this.mapRefine.get(itemType as ItemTypeEnum);
        if (refine >= Number(refineCond)) {
          restCondition = restCondition.replace(unused, '');
          continue;
        }

        return { isValid: false, restCondition };
      }

      break;
    }

    // POS[accRight]50
    const [unusedPos, position] = restCondition.match(/POS\[(\D+?)]/) ?? [];
    if (position) {
      if (position !== itemType) return { isValid: false, restCondition };
      restCondition = restCondition.replace(unusedPos, '');
      if (restCondition.startsWith('===')) return { isValid: true, restCondition };
    }

    // ITEM_LV[me==2]===8
    const [unusedItemLv, itemLvCondition] = restCondition.match(/ITEM_LV\[(.+?)]/) ?? [];
    if (itemLvCondition) {
      const [rawitemType, itemLv] = itemLvCondition.split('==');
      const targetItemType = rawitemType === 'me' ? itemType.replace(/Enchant\d|Card.*/, '') : rawitemType;
      const targetItem = this.equipItem.get(targetItemType as ItemTypeEnum);
      if (targetItem?.itemLevel !== Number(itemLv)) return { isValid: false, restCondition };
      restCondition = restCondition.replace(unusedItemLv, '');
      if (restCondition.startsWith('===')) return { isValid: true, restCondition };
    }

    // MONSTER_ID[20801||20802] — bonuses against explicitly listed targets.
    const monsterIds = restCondition.match(/^MONSTER_ID\[([\d|]+)]/);
    if (monsterIds) {
      if (!monsterIds[1].split('||').some((id) => Number(id) === this.monster.id)) {
        return { isValid: false, restCondition };
      }
      return this.validateCondition({ itemType, itemRefine, script: restCondition.slice(monsterIds[0].length) });
    }

    // SPAWN[tur_d03_i||tur_d04_i]
    const [unusedSp, rawSpawn] = restCondition.match(/SPAWN\[(.+?)]/) ?? [];
    if (rawSpawn) {
      const spawns = rawSpawn.split('||');
      const monSpawns = this.monster.spawn.split(',');
      const isPass = spawns.some((sp) => monSpawns.includes(sp));
      // console.log({ rawSpawn, monSpawns, spawns, isPass, unusedSp });
      if (!isPass) return { isValid: false, restCondition };

      restCondition = restCondition.replace(unusedSp, '');
    }

    // EQUIP[Poenitentia Sol]POS_SPECIFIC[weapon==Poenitentia Sol]REFINE[weapon==2]---4
    const [unusedPos2, position2] = restCondition.match(/POS_SPECIFIC\[(\D+?)]/) ?? [];
    if (position2) {
      const [_position, _itemName] = position2.split('==');
      if (this.matchName(this.equipItem.get(_position as any)) !== _itemName) return { isValid: false, restCondition };

      restCondition = restCondition.replace(unusedPos2, '');
      if (restCondition.startsWith('===')) return { isValid: true, restCondition };
    }

    // EQUIP_ID[480062]50  — combo bonus matched by partner item id instead of
    // display name (survives pt-BR renaming and bracketed names). Same grammar as
    // EQUIP[]: `&&` = all required, `||` = any-of. The remaining condition (an
    // optional `===`, REFINE[...], or a bare value) is handled by recursing.
    const [unusedEquipId, idCondition] = restCondition.match(/^EQUIP_ID\[([\d|&]+)]/) ?? [];
    if (idCondition) {
      const valid = idCondition
        .split('&&')
        .filter(Boolean)
        .every((group) => group.split('||').some((id) => this.isEquipItemId(Number(id))));
      if (!valid) return { isValid: false, restCondition };

      restCondition = restCondition.replace(unusedEquipId, '');
      if (restCondition.startsWith('===')) restCondition = restCondition.replace('===', '');
      return this.validateCondition({ itemType, itemRefine, script: restCondition });
    }

    // AMMO_SUBTYPE[1024]... — an auto-cast can require a broad ammunition family
    // without naming one particular arrow.
    const [unusedAmmoSubtype, ammoSubtype] = restCondition.match(/^AMMO_SUBTYPE\[(\d+)]/) ?? [];
    if (ammoSubtype) {
      if (this.equipItem.get(ItemTypeEnum.ammo)?.itemSubTypeId !== Number(ammoSubtype)) {
        return { isValid: false, restCondition };
      }
      restCondition = restCondition.replace(unusedAmmoSubtype, '');
      if (restCondition.startsWith('===')) restCondition = restCondition.replace('===', '');
      return this.validateCondition({ itemType, itemRefine, script: restCondition });
    }

    // EQUIP[Bear's Power]===50
    const [setCondition, itemSet] = restCondition.match(/^EQUIP\[(.+?)]/) ?? [];
    if (itemSet) {
      const itemSets = itemSet.split('&&').filter(Boolean);
      // console.log({ itemRefine, itemSet, itemSets });
      const valid = itemSets.every((item) => {
        const res = item.split('||').some((_item) => this.isEquipItem(_item));

        return res;
      });
      if (!valid) return { isValid: false, restCondition };

      restCondition = restCondition.replace(setCondition, '');
      if (restCondition.startsWith('===')) restCondition = restCondition.replace('===', '');
      return this.validateCondition({ itemType, itemRefine, script: restCondition });
    }

    // REFINE[headUpper,garment==22] — slot-based sum
    // The optional `(N)` cap is only meaningful for the `---` step form (calcStepBonus
    // applies it); it is accepted here so the condition still parses and hands off below.
    const [unusedSlot, slotNames, slotRefineCond] = restCondition.match(/^REFINE\[(\D+?)==(\d+)(?:\(\d+\))?]/) ?? [];
    if (slotNames) {
      if (restCondition.includes(`${unusedSlot}---`)) return { isValid: true, restCondition };
      const totalRefine = slotNames
        .split(',')
        .map((slot) => this.mapRefine.get(slot as ItemTypeEnum))
        .reduce((sum, cur) => sum + (cur || 0), 0);
      // console.log({ totalRefine, refineCond });
      if (totalRefine < Number(slotRefineCond)) return { isValid: false, restCondition };
      restCondition = restCondition.replace(unusedSlot, '');
      if (restCondition.startsWith('===')) restCondition = restCondition.replace('===', '');
      return this.validateCondition({ itemType, itemRefine, script: restCondition });
    }

    // REFINE[11]
    const [, unused, refineCond] = restCondition.match(/(REFINE\[(\d+)?])[^-]/) ?? [];
    // console.log({ restCondition, unused, refineCond })
    if (refineCond && itemRefine >= Number(refineCond)) {
      restCondition = restCondition.replace(unused, '');
      if (restCondition.startsWith('===')) {
        restCondition = restCondition.replace('===', '');
      }
      return this.validateCondition({ itemType, itemRefine, script: restCondition });
    } else if (refineCond) {
      return { isValid: false, restCondition };
    }

    return {
      isValid: true,
      restCondition: restCondition,
    };
  }

  private updateBaseEquipStat(attr: string, lineScript: string | number) {
    const n = Number(lineScript);
    if (Number.isSafeInteger(n)) {
      this.baseEquipmentStat[attr] = n + (this.baseEquipmentStat[attr] || 0);
    }
  }

  private isAreadyCalcCombo(params: { item: ItemModel; attr: string; lineScript: string; }) {
    const { item, attr, lineScript } = params;
    if (lineScript.startsWith('EQUIP[') || lineScript.startsWith('EQUIP_ID[')) {
      const comboFix = `${item.id}-${attr}-${lineScript}`;
      if (this.equipCombo.has(comboFix)) {
        return true;
      }

      this.equipCombo.add(comboFix);
    }

    return false;
  }

  private calcScriptEntryValue(params: { itemType: ItemTypeEnum; itemRefine: number; lineScript: string; }): number {
    const { itemType, itemRefine, lineScript } = params;
    const { isValid, restCondition } = this.validateCondition({ itemType, itemRefine, script: lineScript });
    if (!isValid) return 0;
    if (restCondition.includes('===')) return this.calcConstantBonus(itemRefine, restCondition);
    if (restCondition.includes('---')) return this.calcStepBonus(itemRefine, restCondition);

    const value = Number(restCondition);
    return Number.isFinite(value) ? value : 0;
  }

  private resolveItemAutoCasts(params: { itemType: ItemTypeEnum; itemRefine: number; item: ItemModel; }): void {
    const { item, itemRefine, itemType } = params;
    const definitions = itemAutoCastScripts(item.script);
    if (definitions.length === 0) return;

    definitions.forEach((definition: ItemAutoCastScript, index) => {
      const chance = selectLoyaltyLines(definition.chance, this.model.petLoyalty ?? DEFAULT_PET_LOYALTY).reduce((sum, lineScript) => (
        sum + this.calcScriptEntryValue({ itemType, itemRefine, lineScript })
      ), 0);
      let skillLevel = definition.skillLevel.reduce((highest, lineScript) => Math.max(
        highest,
        this.calcScriptEntryValue({ itemType, itemRefine, lineScript }),
      ), 0);
      if (definition.skillLevelMode === 'highest-learned') {
        skillLevel = Math.max(skillLevel, this.learnedSkillLevelById(definition.skillId));
      } else if (definition.skillLevelMode === 'learned-only') {
        skillLevel = this.learnedSkillLevelById(definition.skillId);
      }
      if (chance <= 0 || skillLevel <= 0) return;

      this._resolvedItemAutoCasts.push({
        key: `item-${item.id}-${index}-${definition.skillId}`,
        itemId: item.id,
        itemName: item.name,
        skillId: definition.skillId,
        skillLevel,
        chance,
        trigger: definition.trigger,
        requiredEffect: definition.requiredEffect,
      });
    });
  }

  private resolveItemAutoCastPending(item: ItemModel): void {
    itemAutoCastPendingScripts(item.script).forEach((definition, index) => {
      this._resolvedItemAutoCastPending.push({
        key: `item-pending-${item.id}-${index}`,
        itemId: item.id,
        itemName: item.name,
        skillName: definition.skillName,
        skillId: definition.skillId,
        reason: definition.reason,
      });
    });
  }

  private calcItemStatus(params: { itemType: ItemTypeEnum; itemRefine: number; item: ItemModel; }) {
    const { item, itemRefine, itemType } = params;
    const total: Record<string, number> = {};
    const chance = {} as Record<string, number>;
    const addChance = (attr: string, val: number) => {
      if (chance[attr]) {
        chance[attr] += val;
      } else {
        chance[attr] = val;
      }
    };

    // console.log({ itemRefine, script });
    for (const [attr, bonusScripts] of itemBonusScriptEntries(item.script)) {
      if (MainItemTypeSet.has(itemType)) {
        this.updateBaseEquipStat(attr, bonusScripts[0]);
      }

      // Pet eggs spell a bonus out once per tier; only the highest one the pet has
      // reached counts, so the rest are dropped before the sum. A no-op for every other
      // item, none of which carry a LOYALTY condition.
      const applicable = selectLoyaltyLines(bonusScripts, this.model.petLoyalty ?? DEFAULT_PET_LOYALTY);

      total[attr] = applicable.reduce((sum, lineScript) => {
        if (this.isAreadyCalcCombo({ item, attr, lineScript })) {
          return sum;
        }

        return sum + this.calcScriptEntryValue({ itemType, itemRefine, lineScript });
      }, 0);

      if (attr.startsWith('chance__') && isNumber(total[attr]) && total[attr] !== 0) {
        const actualAttr = attr.replace('chance__', '');
        // console.log({ actualAttr, t: total[attr] });
        addChance(actualAttr, total[attr]);
      }
    }

    const chances = Object.keys(chance);
    if (Object.keys(chances).length > 0) {
      this._chanceList.push({
        name: item.name,
        label: `${item.name}`,
        label2: `[ ${chances.map((c) => `${resolveSkillById(Number(c))?.name ?? bonusKeyLabel(c)} ${c.startsWith('cd__') ? '-' : '+'}${chance[c]}`).join(', ')} ]`,
        bonus: chance,
        itemId: item.id,
      });
    }

    for (const effect of itemAutoCastEffectScripts(item.script)) {
      if (itemRefine < (effect.minimumRefine ?? 0)) continue;
      if (effect.requiredEquippedItemIds?.length && !effect.requiredEquippedItemIds.some((id) => this.isEquipItemId(id))) continue;
      const shieldRefine = this.model.shieldRefine ?? 0;
      const duration = effect.durationSeconds + (effect.durationPerShieldRefineEvery
        ? Math.floor(shieldRefine / effect.durationPerShieldRefineEvery) : 0);
      const rate = effect.chance + itemRefine * (effect.chancePerRefine ?? 0);
      const bonus = { ...effect.bonus };
      for (const [key, value] of Object.entries(effect.bonusPerRefine ?? {})) {
        bonus[key] = (bonus[key] ?? 0) + value * itemRefine;
      }
      const activation = effect.activationSkillId
        ? `Ao usar ${resolveSkillById(effect.activationSkillId)?.name ?? effect.activationSkillId}`
        : `${rate.toLocaleString('pt-BR')}% por ataque ${effect.trigger === 'physical-or-magical' ? 'físico ou mágico' : 'físico'}`;
      const existing = this._chanceList.find((entry) => entry.itemId === item.id && entry.name === item.name);
      const entry = {
        name: effect.name,
        label: effect.label,
        label2: `[ ${activation} · ${duration} segundos${effect.note ? ` · ${effect.note}` : ''} ]`,
        bonus: { ...(existing?.bonus ?? {}), ...bonus },
        itemId: item.id,
      };
      if (existing) Object.assign(existing, entry);
      else this._chanceList.push(entry);
    }

    return total;
  }

  /** Uses the same expression parser as a simulation for the creator's live preview. */
  evaluateItemScript(itemType: ItemTypeEnum, item: ItemModel, refine = 0): Record<string, number> {
    return this.calcItemStatus({ itemType, itemRefine: refine, item });
  }

  /** Inspect one clause with the same conditions and arithmetic used by the live build. */
  evaluateItemRule(itemType: ItemTypeEnum, lineScript: string, refine = 0): { active: boolean; value: number } {
    const result = this.validateCondition({ itemType, itemRefine: refine, script: lineScript });
    const value = result.isValid ? this.calcScriptEntryValue({ itemType, itemRefine: refine, lineScript }) : 0;
    return { active: result.isValid && value !== 0, value };
  }

  private removeItemSlotName(itemName: string) {
    return itemName.replace(/\[\d]$/, '').trim();
  }

  /**
   * Name an item is matched by in script conditions (EQUIP[...], POS_SPECIFIC[...],
   * REFINE_NAME[...]). Those are authored with the original English display name, so
   * we match against `enName` (preserved by the LATAM overlay before it swaps in the
   * pt-BR `name`) and fall back to `name` for items that aren't localized.
   */
  private matchName(item: { name: string; enName?: string } | undefined) {
    if (!item) return '';
    return this.removeItemSlotName(item.enName ?? item.name);
  }

  /**
   * Sometime it should get from base item
   * like card should get refine from it's own
   *
   * A slot whose refine was never picked holds `undefined` (that is the model
   * factory's default, and a share link drops the field entirely), so the lookup
   * has to land on 0 rather than hand `undefined` to the arithmetic in
   * `calcStepBonus` — `floor(undefined / 3)` is NaN, and a NaN bonus used to wipe
   * out every point already collected for that key. See `updateTotalStatus`.
   *
   * @param itemType
   * @returns refine level
   */
  private getRefineLevelByItemType(itemType: ItemTypeEnum) {
    const parent = [...this.mapRefine.keys()]
      .filter((slot) => itemType === slot || itemType.startsWith(`${slot}Custom`) || refinableItemTypes.includes(slot) && itemType.startsWith(slot))
      .sort((a, b) => b.length - a.length)[0];
    return parent ? this.mapRefine.get(parent) ?? 0 : 0;
  }

  private calcStatBoost(boostPercent: number, stat: 'agi' | 'dex'): number {
    const { agi, jobAgi, dex, jobDex } = this.model;
    let base = 0;
    if (stat === 'agi') {
      base = agi + jobAgi + (this.baseEquipmentStat['agi'] || 0);
    } else if (stat === 'dex') {
      base = dex + jobDex + (this.baseEquipmentStat['dex'] || 0);
    }

    return floor(base * (Number(boostPercent) / 100));
  }

  prepareAllItemBonus() {
    const weapon = this.equipItem.get(ItemTypeEnum.weapon);
    const baseMatk = isCustomItem(weapon) ? 0 : Number(weapon?.script?.['matk']?.[0]) || 0;

    this.totalEquipStatus = { ...this.allStatus, matk: 0 - baseMatk, perfectHit: this.DEFAULT_PERFECT_HIT };
    this.equipStatus = {} as any;
    this.propertyBasicAtk = ElementType.Neutral;
    this.propertyWindmind = undefined;
    this.propertyBuffEndow = undefined;
    this._chanceList = [];
    this._resolvedItemAutoCasts = [];
    this._resolvedItemAutoCastPending = [];
    this.equipCombo.clear();
    const resolvedAutoCastItems = new Set<number>();

    // Bonuses add across pieces, except the two families that do not: `fctPercent`, and
    // `enable_skill__<id>`, whose value is the level an item GRANTS a skill at ("Habilita
    // [Meteoro Escarlate] nv.5"). Two items granting the same skill do not stack into a
    // higher level — the best grant wins.
    const isMaxSemantics = (attr: string) => attr === 'fctPercent' || attr.startsWith('enable_skill__');

    const updateTotalStatus = (attr: keyof EquipmentSummaryModel, value: number) => {
      // A clause the parser cannot turn into a number arrives here as NaN, and NaN is
      // falsy: the `if` below then took the "nothing collected yet" branch and *assigned*
      // the next piece's bonus, throwing away everything summed so far. One unrefined
      // boot with a "a cada 3 refinos" line cost a real build 127% of Dano crítico that
      // way, and the same NaN blanked its HP and SP. A clause that does not evaluate
      // contributes nothing — it never gets to reset the total.
      if (typeof value === 'number' && !Number.isFinite(value)) return;

      if (this.totalEquipStatus[attr]) {
        if (isMaxSemantics(attr)) {
          this.totalEquipStatus[attr] = Math.max(this.totalEquipStatus[attr], value);
        } else {
          this.totalEquipStatus[attr] += value;
        }
      } else {
        this.totalEquipStatus[attr] = value;
      }
    };

    this.equipStatus['extra'] = { ...this.allStatus };
    for (const scripts of this.extraOptions) {
      for (const [attr, value] of Object.entries(scripts)) {
        if (this.equipStatus['extra'][attr]) {
          this.equipStatus['extra'][attr] += value;
        } else {
          this.equipStatus['extra'][attr] = value;
        }

        updateTotalStatus(attr as any, value);
      }
    }

    this.baseEquipmentStat = {};
    this.finalMultipliers = [];
    for (const [itemType, itemData] of this.equipItem) {
      this.equipStatus[itemType] = { ...this.allStatus };
      if (!itemData) {
        continue;
      }

      if (itemType === ItemTypeEnum.ammo) {
        if (itemData.itemSubTypeId === ItemSubTypeId.Cannonball) {
          this.equipStatus[itemType].atk = 0;
          updateTotalStatus('cannonballAtk', itemData.attack);
          continue;
        }

        this.equipStatus[itemType].atk = itemData.attack;
      } else if (itemType === ItemTypeEnum.leftWeapon) {
        // this.equipStatus[itemType].atk = itemData.attack;
      } else if (itemType !== ItemTypeEnum.weapon && itemData.attack) {
        this.equipStatus[itemType].atk = itemData.attack;
        updateTotalStatus('atk', itemData.attack);
      }

      if (itemData.defense) {
        this.equipStatus[itemType].baseDef = itemData.defense;
        updateTotalStatus('def', itemData.defense);
      }

      // console.log({ itemType, itemData });
      const refine = this.getRefineLevelByItemType(itemType);
      if (MainItemTypeSet.has(itemType)) {
        this.equipStatus[itemType].refine = refine;
        this.equipStatus[itemType].weight = itemData.weight;
      }

      if (!resolvedAutoCastItems.has(itemData.id)) {
        resolvedAutoCastItems.add(itemData.id);
        this.resolveItemAutoCasts({ itemType, itemRefine: refine, item: itemData });
        this.resolveItemAutoCastPending(itemData);
      }
      const calculatedItem = this.calcItemStatus({ itemType, itemRefine: refine, item: itemData });
      for (const [attr, value] of Object.entries(calculatedItem)) {
        this.equipStatus[itemType][attr] = value;

        updateTotalStatus(attr as any, value);
      }
    }

    for (const [skillName, scripts] of Object.entries(this.equipAtkSkillBonus)) {
      for (const [attr, value] of Object.entries(scripts)) {
        if (attr === 'propertyAtk') {
          this.propertyWindmind = value as any;
          continue;
        }

        let val = Number(value);
        if (attr === 'atk') val = 0;
        if (attr === 'final') {
          this.finalMultipliers.push(val);
          continue;
        }

        this.equipStatus[skillName] = { ...this.allStatus, [attr]: val };

        updateTotalStatus(attr as any, val);

        this.updateBaseEquipStat(attr, val);
      }
    }
    for (const [skillName, scripts] of Object.entries(this.masteryAtkSkillBonus)) {
      for (const [attr, value] of Object.entries(scripts)) {
        if (attr === 'propertyAtk') {
          this.propertyWindmind = value as any;
          continue;
        }

        const val = Number(value);
        if (attr === 'atk') continue;
        if (attr === 'matk') continue;

        this.equipStatus[skillName] = { ...this.allStatus, [attr]: val };

        updateTotalStatus(attr as any, val);

        this.updateBaseEquipStat(attr, val);
      }
    }

    for (const [buffName, scripts] of Object.entries(this.buffEquipAtkBonus)) {
      for (const [attr, value] of Object.entries(scripts)) {
        if (attr === 'propertyAtk') {
          this.propertyBuffEndow = value as any;
          continue;
        }
        const val = Number(value);
        // if (attr === 'atk' || attr === 'matk') val = 0;

        this.equipStatus[buffName] = { ...this.allStatus, [attr]: val };

        updateTotalStatus(attr as any, value);
      }
    }
    for (const [buffName, scripts] of Object.entries(this.buffMasteryAtkBonus)) {
      for (const [attr, value] of Object.entries(scripts)) {
        const val = Number(value);
        if (attr === 'atk' || attr === 'matk') continue;

        this.equipStatus[buffName] = { ...this.allStatus, [attr]: val };

        updateTotalStatus(attr as any, value);
      }
    }

    const consumableBonus: Record<string, number> = {};
    for (const cons of this.consumableBonuses) {
      const effective = cons?.__customItem
        ? this.calcItemStatus({ itemType: 'consumable' as ItemTypeEnum, itemRefine: 0, item: cons.__customItem })
        : cons;
      for (const [attr, value] of Object.entries(effective ?? {})) {
        const valNum = Number(value);
        if (mainStatuses.includes(attr as any) && consumableBonus[attr]) {
          consumableBonus[attr] = Math.max(consumableBonus[attr], valNum);
          continue;
        }

        if (consumableBonus[attr]) {
          consumableBonus[attr] += valNum;
        } else {
          consumableBonus[attr] = valNum;
        }
      }
    }
    const consumAllStat = consumableBonus['allStatus'] || 0;
    for (const [attr, value] of Object.entries(consumableBonus)) {
      let newVal = value;
      // stat +20 can stack with other
      if (mainStatuses.includes(attr as any) && newVal !== 20) {
        newVal = Math.max(value - consumAllStat, 0);
      }

      updateTotalStatus(attr as any, newVal);
    }

    const allStatus = this.totalEquipStatus.allStatus ?? 0;
    for (const status of mainStatuses) {
      updateTotalStatus(status as any, allStatus);
    }

    const allTrait = this.totalEquipStatus.allTrait ?? 0;
    for (const status of traitStatuses) {
      updateTotalStatus(status as any, allTrait);
    }

    if (this.totalEquipStatus['agiBoost'] > 0) {
      const boost = this.totalEquipStatus['agiBoost'];
      this.totalEquipStatus.agi += this.calcStatBoost(Number(boost), 'agi');
    }
    if (this.totalEquipStatus['dexBoost'] > 0) {
      const boost = this.totalEquipStatus['dexBoost'];
      this.totalEquipStatus.dex += this.calcStatBoost(Number(boost), 'dex');
    }

    if (this.weaponData.data.typeName === 'bow') {
      this.totalEquipStatus.range += this.totalEquipStatus.bowRange || 0;
    }

    this._class.setAdditionalBonus(this.additionalBonusInput);

    // fix floating point
    for (const [attr, val] of Object.entries(this.totalEquipStatus)) {
      if (isNumber(val) && val !== 0) {
        this.totalEquipStatus[attr] = round(val, 2);
        if (val !== this.totalEquipStatus[attr]) {
          console.log({ attr, val, newVal: this.totalEquipStatus[attr] });
        }
      }
    }

    return this;
  }

  calculateAllDamages(skillValue: string) {
    const { basicDmg, misc, skillDmg, skillAspd, basicAspd } = this.dmgCalculator
      .setExtraBonus([])
      .calculateAllDamages({ skillValue, propertyAtk: this.propertyBasicAtk, maxHp: this.maxHp, maxSp: this.maxSp });

    this.damageSummary = {
      ...basicDmg,
      ...(skillDmg || {}),
    };

    this.skillFrequency = skillAspd || ({} as any);
    this.miscSummary = misc;
    this.basicAspd = basicAspd;

    // Always resolve effected* (compare mode feeds the same selectedChances into
    // every build, including ones that don't carry the chance's source item — see
    // recalcExtraBonus's own build-has-no-match fallback below).
    this.recalcExtraBonus(skillValue);

    return this;
  }

  setHpSpTable(hpSpTable: HpSpTable) {
    this.hpSpCalculator.setHpSpTable(hpSpTable);

    return this;
  }

  calculateHpSp(params: { isUseHpL: boolean; }) {
    const { maxHp, maxSp } = this.hpSpCalculator
      .setClass(this._class)
      .setAllInfo(this.dmgCalculator.infoForClass)
      .setBonusFlag(params)
      .calculate()
      .getTotalSummary();

    this.maxHp = maxHp;
    this.maxSp = maxSp;

    return this;
  }

  recalcExtraBonus(skillValue: string) {
    const c = this.getChanceBonus();
    if (c.length === 0) {
      this.selectedChanceList = [];
      this.effectedState = null;
      // Compare mode applies the same selectedChances to every build (see
      // ro-calculator.component.ts prepare()/refreshChanceList()), so a chance
      // whose source item this build doesn't carry lands here. effected* must
      // fall back to this build's own base damage — not stay unset — or the UI
      // renders a bare 0 (no fallback exists for the main/non-compare column)
      // and the diff-percent calc divides by an undefined max, producing NaN%.
      this.damageSummary = {
        ...this.damageSummary,
        effectedBasicDamageMin: this.damageSummary.basicMinDamage,
        effectedBasicDamageMax: this.damageSummary.basicMaxDamage,
        effectedBasicCriDamageMin: this.damageSummary.criMinDamage,
        effectedBasicCriDamageMax: this.damageSummary.criMaxDamage,
        effectedBasicDps: this.damageSummary.basicDps,
        effectedBasicHitsPerSec: this.basicAspd?.hitsPerSec || 0,

        effectedSkillDamageMin: this.damageSummary.skillMinDamage || 0,
        effectedSkillDamageMax: this.damageSummary.skillMaxDamage || 0,
        effectedSkillDps: this.damageSummary.skillDps || 0,
        effectedSkillHitsPerSec: this.skillFrequency?.totalHitPerSec || 0,

        // Same verbatim calcDmgDps() inputs as skillDpsInput*, for the effected pass.
        // The rotation panel needs damage-per-use, which it recomputes from these;
        // deriving it from the already-floored effectedSkillDps instead would bake in
        // the engine's DPS truncation (docs/combo.md §3).
        effectedSkillDpsInputMin: this.damageSummary.skillDpsInputMin || 0,
        effectedSkillDpsInputMax: this.damageSummary.skillDpsInputMax || 0,
        effectedSkillDpsInputCriDmg: this.damageSummary.skillDpsInputCriDmg || 0,
        effectedSkillDpsInputHitsPerSec: this.damageSummary.skillDpsInputHitsPerSec || 0,
        effectedSkillCriRateToMonster: this.damageSummary.skillCriRateToMonster || 0,
        effectedSkillAccuracy: this.damageSummary.skillAccuracy || 0,
        effectedSkillTotalHit: this.damageSummary.skillTotalHit || 0,

        // The formula panel falls back the same way every figure above does.
        effectedSkillFormulaGraph: this.damageSummary.skillFormulaGraph,
        effectedSkillFormulaGraphNoCri: this.damageSummary.skillFormulaGraphNoCri,
      };
      return this;
    }

    const calc = this.dmgCalculator.setExtraBonus(c);
    const { maxHp, maxSp } = this.hpSpCalculator.setAllInfo(calc.infoForClass)
      .calculate()
      .getTotalSummary();

    const { basicDmg, misc, skillDmg, basicAspd, skillAspd } = calc
      .calculateAllDamages({ skillValue, propertyAtk: this.propertyBasicAtk, maxHp, maxSp });
    // console.log(skillDmg);

    // The same pass, kept for the character sheet. Without it the panel showed only the
    // half of the proc that leaks through `atkSummaryForUI` (a lazy getter over the
    // calculator this line just left in its effected state): ATQ Status moved, DES,
    // DES2 INT1 and the casting window did not — the bug glenhari reported as "a
    // marcação de instinto não reduz a conj. variável" (tracker k74xfIkeTP75HuunmKY9).
    this.effectedState = {
      totalBonus: calc.totalBonus,
      misc,
      skillFrequency: skillAspd ?? this.skillFrequency,
      basicAspd,
      basicCriRate: basicDmg.basicCriRate,
      criRangeBonus: basicDmg.criRangeBonus,
      maxHp,
      maxSp,
      defenses: this.computeDefenses(calc.totalBonus, calc.status),
    };

    this.damageSummary = {
      ...this.damageSummary,
      effectedBasicDamageMin: basicDmg.basicMinDamage,
      effectedBasicDamageMax: basicDmg.basicMaxDamage,
      effectedBasicCriDamageMin: basicDmg.criMinDamage,
      effectedBasicCriDamageMax: basicDmg.criMaxDamage,
      effectedBasicDps: basicDmg.basicDps,
      effectedBasicHitsPerSec: basicAspd.hitsPerSec,

      effectedSkillDamageMin: skillDmg?.skillMinDamage || 0,
      effectedSkillDamageMax: skillDmg?.skillMaxDamage || 0,
      effectedSkillDps: skillDmg?.skillDps || 0,
      effectedSkillHitsPerSec: skillAspd?.totalHitPerSec || 0,

      // See the no-chance branch above: the rotation recomputes damage-per-use from
      // these rather than un-flooring effectedSkillDps.
      effectedSkillDpsInputMin: skillDmg?.skillDpsInputMin || 0,
      effectedSkillDpsInputMax: skillDmg?.skillDpsInputMax || 0,
      effectedSkillDpsInputCriDmg: skillDmg?.skillDpsInputCriDmg || 0,
      effectedSkillDpsInputHitsPerSec: skillDmg?.skillDpsInputHitsPerSec || 0,
      effectedSkillCriRateToMonster: skillDmg?.skillCriRateToMonster || 0,
      effectedSkillAccuracy: skillDmg?.skillAccuracy || 0,
      effectedSkillTotalHit: skillDmg?.skillTotalHit || 0,

      // The proc's stats reach every row of the derivation (a +STR/+LUK proc moves ATQ
      // Status and, for the primary stat, ATQ da Arma), so the panel has to explain the
      // pass whose number it sits under -- keeping the base graph here made the two
      // Botas Desconhecidas print an identical ATQ Base while their damage differed.
      effectedSkillFormulaGraph: skillDmg?.skillFormulaGraph,
      effectedSkillFormulaGraphNoCri: skillDmg?.skillFormulaGraphNoCri,
    };

    return this;
  }

  calcDmgWithExtraBonus(params: { skillValue: string; isUseHpL: boolean; }): BasicDamageSummaryModel & SkillDamageSummaryModel {
    this.calcAllAtk();

    const c = this.getChanceBonus();
    const calculator = this.dmgCalculator.setExtraBonus(c);
    const { maxHp, maxSp } = this.hpSpCalculator
      .setClass(this._class)
      .setAllInfo(calculator.infoForClass)
      .setBonusFlag(params)
      .calculate()
      .getTotalSummary();

    const { skillValue } = params;
    const { basicDmg, skillDmg } = calculator.calculateAllDamages({
      skillValue,
      propertyAtk: this.propertyBasicAtk,
      maxHp,
      maxSp,
    });

    return {
      ...basicDmg,
      ...skillDmg,
    };
  }

  /**
   * Solve one auto-cast with the build and target already prepared. Casting cadence is
   * deliberately ignored by callers: this returns damage for one activation, using the
   * same formula path as Batalha and the currently selected Efeitos.
   */
  solveAutoCast(skillValue: string, skillData?: AtkSkillModel): BasicDamageSummaryModel & SkillDamageSummaryModel {
    this.calcAllAtk();

    const calculator = this.dmgCalculator.setExtraBonus(this.getChanceBonus());
    const { maxHp, maxSp } = this.hpSpCalculator
      .setClass(this._class)
      .setAllInfo(calculator.infoForClass)
      .calculate()
      .getTotalSummary();
    const { basicDmg, skillDmg } = calculator.calculateAllDamages({
      skillValue,
      skillData,
      propertyAtk: this.propertyBasicAtk,
      maxHp,
      maxSp,
    });

    return { ...basicDmg, ...skillDmg };
  }

  private getObjSummary(obj: EquipmentSummaryModel, isRemoveFields = false) {
    const summary = {};
    const removableFiels = new Set(['weight', 'baseDef', 'refine']);
    for (const [key, value] of Object.entries(obj)) {
      if (isRemoveFields && removableFiels.has(key)) continue;

      if (value !== 0 && value != null) {
        summary[key] = value;
      }
    }

    return summary;
  }

  calcAllDefs() {
    this.defenses = this.computeDefenses(this.totalEquipStatus, this.dmgCalculator.status);

    return this;
  }

  /** The defence formulas, over an explicit bonus map and status block so the panel can
   *  run them a second time with a ticked proc's bonuses folded in (see effectedState). */
  private computeDefenses(bonus: EquipmentSummaryModel, status: StatusSummary): DefenseSummary {
    const { level } = this.model;
    const { def = 0, defPercent = 0, softDef = 0, softDefPercent = 0, res = 0, mres = 0 } = bonus;
    const { totalVit, totalAgi, totalSta, totalWis } = status;

    const rawSoftDef = floor(totalVit / 2 + totalAgi / 5 + level / 2);
    const finalSoftDef = floor((rawSoftDef + softDef) * this.toPercent(100 + softDefPercent));

    const { headUpperRefine, armorRefine, shieldRefine, garmentRefine, bootRefine } = this.model;

    const { headUpper, armor, shield, garment, boot } = this.model;
    const { additionalDef, bonusRes } = [
      [headUpper, headUpperRefine],
      [armor, armorRefine],
      [shield, shieldRefine],
      [garment, garmentRefine],
      [boot, bootRefine],
    ]
      .filter(([id]) => this.getItem(id)?.itemLevel === 2)
      .reduce(
        ({ additionalDef, bonusRes }, [_, refine]) => {
          return {
            additionalDef: additionalDef + round(defByRefine(refine) * 0.2, 0),
            bonusRes: bonusRes + refine * 2,
          };
        },
        { additionalDef: 0, bonusRes: 0 },
      );

    const refines = [headUpperRefine, armorRefine, shieldRefine, garmentRefine, bootRefine].filter((a) => Number(a) > 0);
    const bonusDefByRefine = refines.reduce((sum, refine) => sum + defByRefine(refine), 0);

    const { totalDex, totalInt } = status;
    const { mdef = 0, mdefPercent = 0, softMdef = 0, softMdefPercent = 0 } = bonus;
    const rawSoftMdef = floor(totalInt + totalVit / 5 + totalDex / 5 + level / 4);

    return {
      def: floor((def + bonusDefByRefine) * this.toPercent(100 + defPercent)) + additionalDef,
      softDef: finalSoftDef,
      mdef: floor(mdef * this.toPercent(100 + mdefPercent)),
      softMdef: floor((rawSoftMdef + softMdef) * this.toPercent(100 + softMdefPercent)),
      res: res + totalSta + floor(totalSta / 3) * 5 + bonusRes,
      mres: mres + totalWis + floor(totalWis / 3) * 5 + bonusRes,
    };
  }

  getMonsterSummary() {
    return {
      monster: { ...this.monster.data }
    };
  }

  /**
   * Turn THIS fully-solved build into a PVP target profile — the bridge from a
   * saved simulation to an enemy player (see docs/pvp.md §3). Reads the build's
   * own computed defenses (player formulas via calcAllDefs / HpSpCalculator), its
   * flee, and the defender-reduction bonuses its gear grants. Call after a full
   * solve (e.g. via CalculatorController.runChain against any monster).
   */
  getAsPlayerTarget(name: string): PlayerTargetProfile {
    const s = this.dmgCalculator.status;
    return {
      name,
      level: this.model.level ?? 1,
      hp: this.maxHp,
      ...this.defenses,
      flee: (this.miscSummary as any)?.totalFlee ?? 0,
      str: s.totalStr,
      agi: s.totalAgi,
      dex: s.totalDex,
      vit: s.totalVit,
      int: s.totalInt,
      luk: s.totalLuk,
      isDoram: this._class instanceof Doram,
      defenderBonus: pickDefenderBonus(this.totalEquipStatus as unknown as Record<string, number>),
    };
  }

  /** The current build's own defender-side reductions (subrace_/subele_/…), for the
   *  "Redução de dano" popover. Same extraction getAsPlayerTarget caches per target,
   *  plus `reduceDamageReturn` — not a defender key (it never enters the PVP math, and
   *  adding it to that namespace would route its breakdown at the target's gear), but the
   *  popover lists it as one more thing the build takes less of. */
  getDefenderBonus() {
    const bonus = this.totalEquipStatus as unknown as Record<string, number>;

    return { ...pickDefenderBonus(bonus), reduceDamageReturn: bonus['reduceDamageReturn'] || 0 };
  }

  getTotalSummary() {
    const { baseWeaponAtk = 0, refineBonus = 0 } = this.leftWeaponData?.data || {};
    const { totalBuffAtk, totalEquipAtk, totalHideMasteryAtk, totalMasteryAtk, totalStatusAtk, totalStatusMatk } = this.dmgCalculator.atkSummaryForUI;
    const leftWeaponAtk = baseWeaponAtk + refineBonus;

    // With an effect ticked, every figure describing the character is the effected one —
    // the ATQ rows above already are, because atkSummaryForUI reads the calculator
    // recalcExtraBonus left in that state. The `dmg` block below stays base: the damage
    // panel prints base and effected as a pair and needs both.
    //
    // One choice, made once. Picking per figure is how the panel ended up half effected
    // in the first place, and the annotation is what forces a new row to answer it: a
    // field added to CharacterSheetModel has to be filled in here too.
    const sheet: CharacterSheetModel = this.effectedState ?? {
      totalBonus: this.totalEquipStatus,
      misc: this.miscSummary,
      skillFrequency: this.skillFrequency,
      basicAspd: this.basicAspd,
      basicCriRate: this.damageSummary.basicCriRate,
      criRangeBonus: this.damageSummary.criRangeBonus,
      maxHp: this.maxHp,
      maxSp: this.maxSp,
      defenses: this.defenses,
    };

    return {
      ...this.getObjSummary(sheet.totalBonus),
      monster: { ...this.monster.data },
      propertyAtk: this.propertyBasicAtk,
      incomingDamage: this.monster.attackProfile ? {
        attacker: this.monster.attackProfile,
        defender: {
          hp: sheet.maxHp,
          ...sheet.defenses,
          bonus: pickDefenderBonus(sheet.totalBonus as unknown as Record<string, number>),
          armorElement: this.getItem(this.model.armorCard)?.armorElement ?? this.getItem(this.model.armor)?.armorElement ?? ElementType.Neutral,
        },
      } : null,
      weapon: this.weaponData.data,
      calcSkill: {
        dmgType: this.damageSummary.dmgType,
        baseSkillDamage: this.damageSummary.baseSkillDamage,
        dps: this.damageSummary.skillDps,
        totalHits: this.damageSummary.skillTotalHit,
        propertySkill: this.damageSummary.skillPropertyAtk,
        accuracy: this.damageSummary.skillAccuracy,
        totalPene: this.damageSummary.skillTotalPene,
        ...sheet.skillFrequency,
      },
      calc: {
        // display on stat summary
        maxHp: sheet.maxHp,
        maxSp: sheet.maxSp,
        dex2int1: sheet.skillFrequency.sumDex2Int1 || 0,
        to530: 530 - (sheet.skillFrequency.sumDex2Int1 || 0),
        ...sheet.defenses,
        totalAspd: sheet.basicAspd.totalAspd,
        // The character's final AGI (base + job + equip + buffs) — the same value
        // the ASPD formula scales potion/skill bonuses by (× AGI / 200).
        totalAgi: this.dmgCalculator.status.totalAgi,
        hitPerSecs: sheet.basicAspd.hitsPerSec,
        totalCri: sheet.basicCriRate,
        // Not added to totalCri on purpose — it only counts on the ranged basic attack.
        // The summary shows it as a "*" beside the value; the breakdown says why.
        criRangeBonus: sheet.criRangeBonus,
        ...sheet.misc,
        hitRate: sheet.misc.accuracy,
        dps: this.damageSummary.basicDps,
        leftWeaponRefineBonus: refineBonus,

        totalStatusAtk: totalStatusAtk,
        totalEquipAtk: totalEquipAtk + leftWeaponAtk,
        ammuAtk: this.equipStatus.ammo?.atk || 0,
        totalMasteryAtk: totalMasteryAtk,
        totalHideMasteryAtk: totalHideMasteryAtk,
        totalBuffAtk: totalBuffAtk,

        totalStatusMatk: totalStatusMatk,
      },
      dmg: {
        ...this.damageSummary,
      },
      equipments: [...this.equipItemNameSet.keys()],
    };
  }

  getItemSummary() {
    const obj = {};
    for (const [itemType, itemData] of this.equipItem) {
      if (!itemData || !itemType) continue;

      obj[itemType] = this.getObjSummary(this.equipStatus[itemType], true);
    }

    return {
      ...obj,
      ...this.equipAtkSkillBonus,
      ...this.masteryAtkSkillBonus,
      // job buffs (Bênção, Aumentar Agilidade, …) — name-keyed numeric maps, so the
      // bonus-breakdown modal can attribute their contribution like any other source
      ...this.buffEquipAtkBonus,
      ...this.buffMasteryAtkBonus,
      ...{ extra: this.getObjSummary(this.equipStatus['extra']) },
      consumableBonuses: this.consumableBonuses,
    };
  }

  getModelSummary() {
    return this.getObjSummary(this.model as any);
  }

  getPossiblyDamages() {
    return this.possiblyDamages;
  }
}

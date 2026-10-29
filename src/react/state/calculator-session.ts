import { Store } from '../state/store';
import { normalizeClassLimits } from '../../app/core/class-limits';
import { normalizeSkillFormulaVersion, SkillFormulaVersion } from '../../app/skills/skill-formula-version';
import { Lifetime } from '../state/lifetime';
import { Events, Disposable, listenDebounced } from '../services/events';
import { Messages as MessageService, Confirmations as ConfirmationService } from '../services/notifications';
import { CalculatorData as RoService, DescriptionStore as ItemDescriptionStore, ItemShop as ItemShopService,
  SlotColorPreferences as SlotColorPickerService, CalculatorLayout as LayoutService, CustomItems as CustomItemLibraryService,
  CustomStudioHandle } from '../services/calculator-services';
interface SelectItemGroup { label: string; value?: unknown; items: any[]; }
import { prepareCompareEquipment } from '../../app/core/compare-equipment';
import { IconName } from 'src/app/ui/icon-names';
import { PresetModel } from 'src/app/api-services/models/preset-model';
import { SKILL_ID_BY_NAME, resolveSkillMeta } from 'src/app/skills';
import { BUFF_BONUS_LABELS, bonusKeyLabel, resolveSkillKey } from 'src/app/core/bonus-key-label';
import { AllowedCompareItemTypes } from 'src/app/app-config';
import {
  AllowLeftWeaponMapper,
  AspdPotionFixBonus,
  AspdPotionList,
  AspdPotionList2,
  ACC_SIDE_PREFIX,
  CardPosition,
  ElementConverterList,
  EnchantTable,
  ExtraOptionTable,
  FoodStatList,
  HeadGearLocation,
  ItemOptionMap,
  ItemOptionNumber,
  ItemOptionTable,
  ItemSubTypeId,
  ItemTypeEnum,
  ItemTypeId,
  JobBuffs,
  maxRelieveLevelForMonster,
  normalizeMonsterRelieveLevel,
  hasRelieve,
  relieveReductionPercent,
  MainItemWithRelations,
  PetLoyalty,
  PetLoyaltyList,
  getMonsterGroupName,
} from 'src/app/constants';
import { isEquipmentEnchant } from 'src/app/constants/enchant_item';
import { ActiveSkillModel, AtkSkillModel, CharacterBase, ClassIdBySpriteJob, ClassName, PassiveSkillModel, SkillModel } from 'src/app/jobs';
import {
  createBaseHPSPOptionList,
  createExtraOptionList,
  createMainModel,
  createNumberDropdownList,
  formatSignedNumber,
  getHeadGearLocations,
  HEAD_SLOTS,
  itemDescPopoverHtml,
  prettyItemDesc,
  resolveHeadSlotOccupancy,
  skillDescHtml,
  toDropdownList,
  toRawOptionTxtList,
  toUpsertPresetModel,
} from 'src/app/utils';
import { importReplayBuffer, ReplayImportSummary } from '../../app/replay/replay-to-model';
import { makeBuffGate } from '../../app/replay/skill-status.map';
import { MainModel } from '../../app/models/main.model';
import { environment } from 'src/environments/environment';
import { getClassDropdownList } from '../../app/jobs/_class-list';
import { HIDDEN_CLASS_IDS } from '../../app/jobs/hidden-classes';
import { racePtBr, sizePtBr, elementPtBr } from '../../app/constants/monster-i18n';
import { ChanceModel } from '../../app/models/chance-model';
import { DamageFormulaCalc } from '../../app/models/damage-summary.model';
import { DropdownModel, ItemDropdownModel } from '../../app/models/dropdown.model';
import { HpSpTable } from '../../app/models/hp-sp-table.model';
import { ItemListModel } from '../../app/models/item-list.model';
import { ItemModel, itemBonusScriptEntries } from '../../app/models/item.model';
import { MonsterModel } from '../../app/models/monster.model';
import { BETELGEUSE_HP_OPTIONS, normalizeBetelgeuseHp, withBetelgeuseHp } from '../../app/constants/betelgeuse-hp';
import { BaseStateCalculator } from 'src/app/core/base-state-calculator';
import { Calculator } from 'src/app/core/calculator';
import { resolveOffHandEviction } from 'src/app/core/off-hand-slots';
import { applyGuaranaCandy, CalcChainInput, CalculatorController, collectAspdPotionSources, collectBuffBonuses, collectChanceSources, collectConsumables, withoutWeaponlessTalismans } from 'src/app/core/calculator-controller';
import { customOptionScripts, ensureCustomAttachment } from 'src/app/core/custom-attachments';
import { CalcStorage } from 'src/app/core/calc-storage';
import { ElementType } from 'src/app/constants/element-type.const';
import { CompareState, STATS_COMPARE_KEYS, copyStatsFields } from 'src/app/core/compare-state';
import { buildComparisonFromImport } from 'src/app/core/import-comparison';
import { normalizeSavedModel } from 'src/app/core/saved-model';
import { parseShareInput } from 'src/app/core/share-link-input';
import { ClassSwitchLoss, applyClassSwitch, findClassSwitchLosses, hasBuildToKeep, slotEquipFilter } from 'src/app/core/class-switch';
import { canUsedByClass } from 'src/app/utils/can-used-by-class';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { SlotListBag } from '../../app/layout/pages/ro-calculator/equipment-grid/slot-list-bag.model';
import { compactRotationForShare, defaultAtkSkill, firstRealSkill, isBasicAttack, isOffensiveSkill, pruneRotationForClass } from 'src/app/core/rotation';
import { RotationScheduleStep } from 'src/app/core/rotation-schedule';
import { optimizeRotation } from 'src/app/core/rotation-optimize';
import { buildRotationView, RotationView, toScheduleStep } from '../../app/layout/pages/ro-calculator/battle-hud/rotation-view';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import {
  AtkTypeDataModel,
  ElementDataModel,
  RaceDataModel,
  RESIST_REDUCTION_KEYS,
  SkillMultiplierModel,
  buildAtkTypeTable,
  buildElementTable,
  buildMonsterTypeTables,
  buildRaceTables,
  buildSizeTable,
  buildSkillMultiplierTable,
} from 'src/app/core/summary-tables';
import { SavedSimulation, SavedSimulationStore } from 'src/app/core/saved-simulations';
import { isDefenderKey, PlayerTargetProfile, PvpMode } from 'src/app/core/pvp';
import { buildReductionCategories, collectContributingKeys, ReductionCategory, ReductionRow, reductionRowClickable as reductionRowClickableFn, sourcesContributeAnyKey } from '../../app/layout/pages/ro-calculator/reduction-breakdown';
import { buildStatsSummary, statOriginFor, StatsSummaryView, SummaryHeadline, SummaryRow } from '../../app/layout/pages/ro-calculator/stats-summary';
import { encodeBuild, decodeShared } from 'src/app/core/share-codec';
import { shareEntryHref } from 'src/app/core/share-entry';
import { buildSharePath, readShareToken, SHARE_PATH_PREFIX } from 'src/app/core/share-path';
import { buildCharSpriteUrl, bareJobSprite } from 'src/app/domain/char-sprite-url';
import { AutoCastSimulation, buildAutoCastSimulation } from 'src/app/core/auto-cast';
import { CustomItemDefinition, customDefinitionsForBuild, customItemDescriptionHtml, isCustomItem, validateCustomItems } from 'src/app/core/custom-items';
import { shortenUrl } from 'src/app/core/shorten-url';
import { decodeCustomBundle } from 'src/app/core/custom-item-library';

type ImportMode = 'replace' | 'compare';

/**
 * A build read by the import dialog, waiting for the user to choose how to apply it.
 * One flat shape (the project builds with strict:false, which never narrows a union):
 * the replay fields are null for a link, and `preset` is null for a replay.
 */
interface PendingImport {
  source: 'replay' | 'link';
  model: MainModel;
  /** The link's sparse build, as loadItemSet takes it. */
  preset?: Record<string, any> | null;
  summary?: ReplayImportSummary | null;
  learnedSkills?: Record<number, number> | null;
  activeStatuses?: number[] | null;
}

interface MonsterSelectItemGroup extends SelectItemGroup {
  items: any[];
}

const Characters = getClassDropdownList();
const compareItemNames = new Intl.Collator('pt-BR').compare;

interface ClassModel extends Partial<Record<ItemTypeEnum, number>> {
  rawOptionTxts: string[];
  customAttachments?: MainModel['customAttachments'];
  autoCastSelections?: MainModel['autoCastSelections'];
  weaponGrade?: any;
  leftWeaponGrade?: any;
  shieldGrade?: any;
  headUpperGrade?: any;
  headMiddleGrade?: any;
  headLowerGrade?: any;
  armorGrade?: any;
  garmentGrade?: any;
  bootGrade?: any;
  accLeftGrade?: any;
  accRightGrade?: any;
  /** Not a slot id: the pet's loyalty tier, which travels with `pet` when it is compared. */
  petLoyalty?: PetLoyalty;
  /** Not a slot id either: the weapon's element converter, which travels with `weapon`. */
  propertyAtk?: ElementType;
}

export class CalculatorSession extends Store<number> {
  private readonly lifetime = new Lifetime();
  private readonly chanceSettled = new Events<any>();
  publish(): void { if (this.lifetime.active) this.set(this.getSnapshot() + 1); }
  action<T>(callback: () => T): T {
    const result = callback(); this.publish();
    if (result instanceof Promise) void result.finally((_event?: unknown) => this.publish()).catch((_event?: unknown) => undefined);
    return result;
  }
  customStudio?: CustomStudioHandle;
  private sharedCustomItems: CustomItemDefinition[] = [];
  private hiddenCustomIds = new Set<number>();
  updateItemEvent = new Events<any>();
  updateCompareEvent = new Events<any>();
  updateChanceEvent = new Events<any>();
  isCalculatingEvent = new Events<any>();

  monsterDataMap: Record<number, MonsterModel> = {};
  hpSpTable: HpSpTable;
  items!: Record<number, ItemModel>;
  mapEnchant!: Map<string, ItemModel>;
  enchants: DropdownModel[] = [];
  skillBuffs = JobBuffs;

  isInProcessingPreset = false;

  /**
   * One single indicator for the whole boot: download the data, build the preset and
   * run the first calculation. It used to be three loading screens in a row (splash,
   * the ui-blockUI mask, each panel's spinner), which gave the impression the page was
   * loading several times over.
   *
   * It only switches off once both ends finish — the ngOnInit chain and the initial
   * calculation — because they complete out of order: the calculation is triggered at
   * the end of loadItemSet but runs later, behind two debounces.
   */
  isBooting = true;
  private bootChainDone = false;

  /**
   * Takes index.html's #ro-splash off screen. It lives outside <app-root> so it can
   * survive Angular's bootstrap, so it goes away by explicit removal, exactly once — it
   * is the same element since the first paint, with no change of owner in between.
   */
  private hideBootSplash() {
    const el = document.getElementById('ro-splash');
    if (!el) return;
    el.classList.add('ro-splash--hide');
    // On a timer, not transitionend: a background tab composites no frames, so the
    // transition never runs and the event never arrives. Scrolling is released together
    // with the removal, not at the start of the fade, so the bar cannot appear mid-fade.
    setTimeout((_event?: unknown) => {
      el.remove();
      document.documentElement.classList.remove('ro-booting');
    }, 250);
  }

  private finishBoot() {
    if (!this.isBooting) return;
    this.isBooting = false;
  }

  private viewMounted = false;
  /** Called after React commits the complete editor, including overlay references. */
  viewReady(): void {
    if (this.isBooting || this.viewMounted || !this.lifetime.active) return;
    this.viewMounted = true;
    this.hideBootSplash();
    if (this.importedCustomLink) this.customStudio?.openLibrary();
    // Let the calculator paint and the splash fade before optional prose competes
    // for bandwidth, JSON parsing or a full view refresh.
    if (this.lifetime.active) {
      this.lifetime.watch(this.lifetime.wait(0.3).then(() => {
        this.lifetime.check();
        this.loadDescriptions();
      }), () => undefined, () => undefined);
    }
  }

  private loadDescriptions(): void {
    this.allSubs.push(this.lifetime.watch(this.roService.getItemDescriptions(), () => {
      if (this.selectedItemDesc || this.selectedCompareItemDesc) {
        this.onSelectItemDescription(!!this.selectedCompareItemDesc);
      }
    }, () => this.publish()));
    this.allSubs.push(this.lifetime.watch(this.roService.getSkillDescriptions(), () => undefined, () => this.publish()));
  }

  // --- Save / preview / share simulations (browser localStorage) ----------
  private savedSimStore = new SavedSimulationStore(localStorage);
  /** item id -> [sprite view id (ClassNum), visual-slot mask], for the paper-doll. */
  private itemViews: Record<string, [number, number]> = {};
  savedSims: SavedSimulation[] = [];
  showSavesDialog = false;
  showSaveDialog = false;
  saveName = '';

  // --- PVP -----------------------------------------------------------------
  /** Mode selector for the PVP tab (open PVP / normal castle / TE castle). */
  pvpMode: PvpMode = 'pvp';
  pvpModeOptions = [
    {
      label: 'PVP',
      value: 'pvp' as PvpMode,
      tooltip: 'PVP aberto: dano cheio (1:1). Valem só as defesas e reduções do próprio alvo — sem a redução da guerra. A esquiva do alvo é a normal.',
    },
    {
      label: 'WOE',
      value: 'woe' as PvpMode,
      tooltip: 'Guerra do Emperium: o ataque básico corpo a corpo cai para 10% (−90%), o ataque básico à distância para 5% (−95%) e as habilidades para 10% (−90%). A esquiva do alvo cai 20%.',
    },
    {
      label: 'WOE TE',
      value: 'woe-te' as PvpMode,
      tooltip: 'Guerra TE: mesmos valores da guerra normal desde a atualização de 18/08 — corpo a corpo 10% (−90%), à distância 5% (−95%) e habilidades 10% (−90%). A esquiva do alvo cai 20%.',
    },
  ];
  /** Saved sims usable as PVP targets (those carrying a cached targetProfile). */
  pvpTargets: SavedSimulation[] = [];
  selectedPvpTargetId: string | null = null;
  /** The solved attacker-vs-target summary that feeds the PVP battle HUD. */
  pvpSummary: any = null;
  /** The compared build against the same PVP target; null when not comparing. */
  pvpSummary2: any = null;
  /** "Redução de dano" popover data: the current build's own reductions (main stats,
   *  mode-independent) and the selected PVP target's reductions (HUD, with the WoE
   *  layer for the active mode). Recomputed on each calculate()/calculatePvp(). */
  selfReductionCategories: ReductionCategory[] = [];
  targetReductionCategories: ReductionCategory[] = [];
  /** The target build's own per-item bonus sources, so the HUD popover drills into
   *  the OPPONENT's gear. Captured per selected target (keyed by id). Public so the
   *  PVP HUD can bind it as reductionSources. */
  pvpTargetSources: Record<string, any> = {};
  /** The target build's slot→itemId map, so the HUD drill-down names the OPPONENT's
   *  gear (not the attacker's item in the same slot). */
  pvpTargetItemMap = new Map<string, number>();
  private pvpTargetSourcesId: string | null = null;
  showShareDialog = false;
  shareUrl = '';
  shareShortening = false;

  env = environment;
  model = createMainModel();
  model2: ClassModel = { rawOptionTxts: [] };

  baseHpOptions = createBaseHPSPOptionList('BaseHP') as any;
  baseSpOptions = createBaseHPSPOptionList('BaseSP') as any;
  refineList = createNumberDropdownList({ from: 0, to: 18 });
  shadowRefineList = createNumberDropdownList({ from: 0, to: 10 });
  mainStatusList = createNumberDropdownList({ from: 1, to: 130 });
  traitStatusList = createNumberDropdownList({ from: 0, to: 100 });
  levelList = [];
  jobList = [];
  propertyAtkList = ElementConverterList;

  optionList: any[] = createExtraOptionList();
  itemList: ItemListModel = {} as any;

  weaponList: DropdownModel[] = [];
  leftWeaponList: DropdownModel[] = [];
  weaponCardList: DropdownModel[] = [];
  weaponEnchant0List: DropdownModel[] = [];
  leftWeaponEnchant0List: DropdownModel[] = [];
  ammoList: DropdownModel[] = [];
  headUpperList: DropdownModel[] = [];
  headMiddleList: DropdownModel[] = [];
  headLowerList: DropdownModel[] = [];
  headCardList: DropdownModel[] = [];
  armorList: DropdownModel[] = [];
  armorCardList: DropdownModel[] = [];
  shieldList: DropdownModel[] = [];
  shieldCardList: DropdownModel[] = [];
  garmentList: DropdownModel[] = [];
  garmentCardList: DropdownModel[] = [];
  bootList: DropdownModel[] = [];
  bootCardList: DropdownModel[] = [];
  accList: DropdownModel[] = [];
  accCardList: DropdownModel[] = [];
  accLeftList: DropdownModel[] = [];
  accLeftCardList: DropdownModel[] = [];
  accRightList: DropdownModel[] = [];
  accRightCardList: DropdownModel[] = [];
  petList: DropdownModel[] = [];
  readonly petLoyaltyList = PetLoyaltyList;

  costumeUpperList: DropdownModel[] = [];
  costumeMiddleList: DropdownModel[] = [];
  costumeLowerList: DropdownModel[] = [];
  costumeGarmentList: DropdownModel[] = [];

  costumeEnhUpperList: DropdownModel[] = [];
  costumeEnhMiddleList: DropdownModel[] = [];
  costumeEnhLowerList: DropdownModel[] = [];
  costumeEnhGarmentList: DropdownModel[] = [];
  costumeEnhGarment2List: DropdownModel[] = [];
  costumeEnhGarment4List: DropdownModel[] = [];

  shadowWeaponList: DropdownModel[] = [];
  shadowArmorList: DropdownModel[] = [];
  shadowShieldList: DropdownModel[] = [];
  shadowBootList: DropdownModel[] = [];
  shadowEarringList: DropdownModel[] = [];
  shadowPendantList: DropdownModel[] = [];

  characterList = Characters;
  selectedCharacter: CharacterBase;
  isShowSelectableSkillLevel = true;
  atkSkills: AtkSkillModel[] = [];
  passiveSkills: PassiveSkillModel[] = [];
  activeSkills: ActiveSkillModel[] = [];
  consumableList: DropdownModel[] = [];
  consumableList2: DropdownModel[][] = FoodStatList;
  aspdPotionList: DropdownModel[] = [];
  aspdPotionList2: DropdownModel[] = AspdPotionList2;

  totalPoints = 0;
  availablePoints = 0;
  appropriateLevel = 0;

  isAllowTraitStat = false;
  totalTraitPoints = 0;
  availableTraitPoints = 0;
  /** The compared build's remaining points, while stats are compared. */
  availablePoints2 = 0;
  availableTraitPoints2 = 0;
  appropriateLevelForTrait = 0;

  /** The "(Nv N)" the Atributos line used to print inline: the base level this spread first
   *  becomes affordable at. The compact box has no room for it, so it rides in the tooltip.
   *  Past the level cap the answer is "never", which is what the old "x" stood for. */
  get pointsHint(): string {
    if (!this.appropriateLevel) return '';

    return this.appropriateLevel > 200 ? 'Estes atributos não cabem em nenhum nível' : `Estes atributos cabem a partir do Nv ${this.appropriateLevel}`;
  }

  /** Same for Talentos, which the old line capped at 300 rather than 200. */
  get traitPointsHint(): string {
    if (!this.appropriateLevelForTrait) return '';

    return this.appropriateLevelForTrait > 300 ? 'Estes talentos não cabem em nenhum nível' : `Estes talentos cabem a partir do Nv ${this.appropriateLevelForTrait}`;
  }

  // Declared above the target fields on purpose: class fields initialise in source order,
  // and `relieveLevel` below seeds itself from it.
  private calcStorage = new CalcStorage(localStorage);

  /** UI-only preference; it is deliberately separate from saved/shareable builds. */
  rightAccordionActiveIndices = this.readRightAccordionActiveIndices();


  groupMonsterList: MonsterSelectItemGroup[] = [];
  monsterList: DropdownModel[] = [];
  selectedMonsterName = '';
  selectedMonster = Number(localStorage.getItem('monster')) || 21067;
  betelgeuseHp = normalizeBetelgeuseHp(Number(localStorage.getItem('betelgeuseHp')));
  readonly betelgeuseHpOptions = BETELGEUSE_HP_OPTIONS;

  get selectedMonsterModel(): MonsterModel {
    return withBetelgeuseHp(this.monsterDataMap[this.selectedMonster], this.betelgeuseHp);
  }

  onBetelgeuseHpChange() {
    this.betelgeuseHp = normalizeBetelgeuseHp(this.betelgeuseHp);
    localStorage.setItem('betelgeuseHp', String(this.betelgeuseHp));
    this.updateItemEvent.next(1);
  }
  readonly autoCastIssuesReportUrl = `${environment.issuesUrl}/novo?projeto=simulador`;

  openAutoCastFormulaReport(): void {
    this.layoutService.openHelpImprove();
  }
  /**
   * Aliviar level for the current target (0 = off). Only the monsters that cast it offer
   * the picker; see constants/monster-relieve. Target state like `selectedMonster`, so it
   * is persisted the same way and is not part of the saved build.
   */
  relieveLevel = normalizeMonsterRelieveLevel(this.selectedMonster, this.calcStorage.readRelieveLevel());
  /** Levels the Aliviar picker offers, each labelled with the reduction it applies. */
  get relieveLevelOptions(): DropdownModel[] {
    return [
      { label: 'Desativado', value: 0 },
      ...Array.from({ length: maxRelieveLevelForMonster(this.selectedMonster) }, (_, i) => ({
        label: `Nv. ${i + 1} — ${relieveReductionPercent(i + 1)}%`,
        value: i + 1,
      })),
    ];
  }
  isShowMonsterEle = false;
  allSelectedMonsterIds: number[];

  chanceList = [] as ChanceModel[];
  /** The compared build's own "Efeitos" list; empty unless comparing. */
  chanceList2 = [] as ChanceModel[];
  /** Procs ticked on the compared build. Separate from selectedChances: the two builds
   *  carry different gear, so a proc can exist on one side only. */
  selectedChances2 = [] as string[];
  selectedChances = [] as string[];

  isCalculating = false;
  /** The rotation as the panel sees it: per-entry damage/timing plus the solved cycle. */
  rotationView: RotationView | null = null;
  rotationView2: RotationView | null = null;
  rotationViewPvp: RotationView | null = null;
  /** The compared build's PVP rotation, positionally aligned with rotationViewPvp. */
  rotationViewPvp2: RotationView | null = null;
  autoCastSimulation: AutoCastSimulation | null = null;
  autoCastSimulation2: AutoCastSimulation | null = null;
  /** The chain input prepare() last built, reused by the rotation pass. */
  private lastChainInput: CalcChainInput | null = null;

  private calculator = new Calculator();
  private calculator2 = new Calculator();
  private calculatorPvp = new Calculator();
  /** The compared build's PVP pass — its own instance, like calculator2 for the monster panel. */
  private calculatorPvp2 = new Calculator();
  private controller = new CalculatorController();
  private stateCalculator = new BaseStateCalculator();

  possiblyDamages: DropdownModel[];
  itemSummary: any;
  itemSummary2: any;
  /** Full per-source bonus breakdown (every equip slot/card/enchant + skills) from
   *  the last calc; powers the "which items contribute to this value" modal. Public so
   *  the reduction popover template can pass it as the self drill-down source map. */
  bonusBreakdownSources: Record<string, any> = {};
  /** Every bonus key that at least one source contributes to (non-zero) in the last
   *  calc. A summary value is only worth a breakdown — and thus only clickable — when
   *  one of its keys is here; base/trait-derived stats (no item source) are excluded. */
  private bonusBreakdownKeys = new Set<string>();
  isShowBonusBreakdown = false;
  isShowAspdCurve = false;
  aspdCurveTitle = 'Golpes por segundo';
  bonusBreakdownTitle = '';
  /** A caveat about the value itself, shown above the source rows — for a bonus whose rows
   *  alone would read as if it applied everywhere (CRIT à distância counts on the basic
   *  attack only). Empty for the ordinary case. */
  bonusBreakdownNote = '';
  bonusBreakdownValueClass = 'summary_damage';
  bonusBreakdownRows: { label: string; icon?: number; iconType: 'item' | 'skill'; value: number; display: string; tooltip?: string }[] = [];
  /** Per-source hover explanations (e.g. the AGI-scaled ASPD-potion formula), keyed by source key. */
  bonusBreakdownTooltips: Record<string, string> = {};
  /** Derivation of the clicked damage-graph node, when it has one — see showBonusBreakdown. */
  bonusBreakdownCalc: DamageFormulaCalc | null = null;
  modelSummary: any;
  totalSummary: any;

  elementTable: ElementDataModel[];
  raceTable: RaceDataModel[];
  peneRaceTable: RaceDataModel[];
  sizeTable: RaceDataModel[];
  classTable: RaceDataModel[];
  atkTypeTable: AtkTypeDataModel[];
  peneClassTable: RaceDataModel[];
  skillMultiplierTable: SkillMultiplierModel[];

  /** The "Resumo de atributos" panel, shaped by ./stats-summary — headline figures plus
   *  three columns of grouped rows, each already carrying its comparison cell. */
  statsSummary: StatsSummaryView = { headline: [], columns: [], sustain: [] };

  /**
   * Model 2
   */
  totalSummary2: any;
  compareItemSummaryModel: any;
  /** The compare build's equivalents of bonusBreakdownSources / bonusBreakdownTooltips,
   *  so clicking a "→ simulado" value opens the breakdown against the compared build. */
  private bonusBreakdownSources2: Record<string, any> = {};
  private bonusBreakdownTooltips2: Record<string, string> = {};
  /** bonusBreakdownKeys for the compared build — a "→ simulado" value is only clickable
   *  when the *compared* gear sources it. Reading the main build's set instead would open
   *  an empty dialog on exactly the swap that removed the last source of a bonus. */
  private bonusBreakdownKeys2 = new Set<string>();
  selectedCompareItemDesc: ItemTypeEnum;
  private equipCompareItemIdItemTypeMap = new Map<ItemTypeEnum, number>();
  equipCompareItems: DropdownModel[] = [];

  private equipItemMap = new Map<ItemTypeEnum, number>();
  private equipItemIdItemTypeMap = new Map<ItemTypeEnum, number>();
  equipItems: DropdownModel[] = [];
  itemSlotsMap: Partial<Record<ItemTypeEnum, number>> = {};
  selectedItemDesc: ItemTypeEnum;
  itemId = 0;
  itemBonus = {};
  /** Visual rows for the item-bonus panel (replaces the raw JSON dump): each stat/skill
   *  bonus as a labelled row, skill-named bonuses carrying their pt-BR skill icon. */
  itemBonusRows: { label: string; icon?: number; display: string; isSkill: boolean; note?: string }[] = [];
  itemDescription = '';

  /** LATAM shops are split per server; the market link below points at whichever is
   *  selected. State + link logic live in ItemShopService so the search dialog shares it. */
  get shopServerOptions() {
    return this.itemShop.serverOptions;
  }
  get selectedShopServer(): string {
    return this.itemShop.server;
  }
  set selectedShopServer(value: string) {
    this.itemShop.server = value;
  }
  /** memoised pt-BR item descriptions (HTML) for the consumable hover popovers */
  private itemDescCache = new Map<number, string>();
  private itemDescVersion = -1;

  itemOptionNumber = ItemOptionNumber;

  private allSubs: Disposable[] = [];

  hiddenMap = { ammu: true, shield: true };
  /**
   * Bumped whenever a debounced pass has finished rewriting the models, so the equipment
   * grid's OnPush cards notice. `model` and `model2` are mutated in place — a preset load,
   * a replay import, a share link or a head-slot eviction changes their contents without
   * changing their identity, and nothing else would tell the cards to redraw.
   */
  equipRevision = 0;
  /**
   * Head slots swallowed by a multi-slot item worn elsewhere -> that item's name. A
   * Middle+Lower mask fills both positions in game, so only one of the two pickers stays
   * live and the other shows what is already sitting there.
   */
  headSlotOccupiedBy: Partial<Record<ItemTypeEnum, string>> = {};
  isAllowLeftWeaponByClass = false;
  showLeftWeapon = false;

  /**
   * True when the off-hand weapon row belongs on screen: a main weapon is equipped, the
   * class dual wields with a weapon that leaves the hand free, and no shield is holding
   * it. The compare row follows the main one — and so does whether a compared off-hand
   * weapon counts, since prepare() feeds this same flag to resolveOffHandEviction. A
   * comparison the user cannot see must not move the numbers either.
   */
  get isLeftWeaponShown(): boolean {
    return !!this.model.weapon && this.showLeftWeapon && !this.model.shield;
  }

  isEnableCompare = false;
  /** Whether `model2` carries its own level, job level, stats and traits. */
  isCompareStats = false;
  /** Whether Auto-conjuração itself keeps comparison mode active. */
  isCompareAutoCast = false;
  /** Viewport anchor captured before Auto-conjuração comparison changes the layout. */
  private pendingAutoCastCompareScroll: { anchor: HTMLElement; top: number } | null = null;
  /** Which build the level band and the attribute grid are editing while stats are compared. */
  statsSide: 'main' | 'compare' = 'main';
  showCompareItemMap = {} as any;
  compareItemNames = [] as ItemTypeEnum[];
  compareItemList: (keyof typeof ItemTypeEnum)[] = [...AllowedCompareItemTypes];

  /**
   * The option lists the equipment grid reads, addressed by the names the slot
   * descriptors carry (`weaponList`, `accLeftCardList`, `costumeEnhGarment2List`, …).
   * They are all fields of this component already, so the grid takes the component itself
   * rather than forty @Input bindings that would each have to be kept in step.
   */
  get slotLists(): SlotListBag {
    return this as unknown as SlotListBag;
  }

  equipableItems: (DropdownModel & { id: number; position: string; })[] = [];
  offensiveSkills: (DropdownModel & { icon?: number })[] = [];

  // --- Class switch modal ---
  /** The class the screen is actually loaded with. The picker's ngModel runs ahead of it:
   *  the dialog needs somewhere to go back to when the switch is cancelled. */
  private loadedClassId: number = this.model.class;
  /** Set while a confirmed close is in flight, so its `onHide` is not read as a cancel. */
  private classSwitchConfirmed = false;
  showClassSwitch = false;
  /** The switch the dialog is asking about; null whenever the dialog is closed. */
  pendingClassSwitch: { fromLabel: string; toLabel: string; fromClass: number; losses: ClassSwitchLoss[] } | null = null;

  // --- Replay (.rrf) import modal ---
  showReplayImport = false;
  replayDragOver = false;
  replayBusy = false;
  /** Text of the "paste a share link" field in the import dialog. */
  importLinkText = '';
  /** A build that was read and is waiting for the user to pick how to apply it. */
  pendingImport: PendingImport | null = null;
  private resolvePendingImport: ((mode: ImportMode | null) => void) | null = null;

  onClassChangedSubject = new Events<boolean>();
  onClassChanged$ = this.onClassChangedSubject;

  constructor(
    private roService: RoService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private readonly itemShop: ItemShopService,
    private readonly itemDescriptionStore: ItemDescriptionStore,
    private readonly slotColorPicker: SlotColorPickerService,
    private readonly layoutService: LayoutService,
    private readonly customLibrary: CustomItemLibraryService,
  ) {
    super(0);
    const unsubscribe = this.layoutService.previews.subscribe(() => this.action(() => {
      if (!this.items || !this.selectedCharacter) return;
      this.setItemList();
      this.setItemDropdownList();
      this.setAmmoDropdownList();
      this.setClassSkill();
      this.setDefaultSkill();
      this.updateItemEvent.next(true);
    }));
    this.allSubs.push({ unsubscribe });
  }

  get showPreviews(): boolean { return this.layoutService.previews.getSnapshot(); }
  isSkillVisible(skill: { preview?: boolean }): boolean { return this.showPreviews || !skill.preview; }

  private started = false;
  start() {
    if (this.started) return;
    this.started = true;
    this.initSlotColourPrefs();
    // A share link (/s/<token>/ or the legacy ?b=...) wins over the local autosave;
    // falls back to it when absent.
    const shared = this.consumeSharedBuild();
    this.sharedCustomItems = shared?.items ?? [];
    this.lifetime.watch((async () => { try { const result = await this.initData(); this.lifetime.check();
await ((_event?: unknown) => {
          this.importCustomItemFromUrl();
          return this.loadItemSet(shared?.preset ?? localStorage.getItem('ro-set'));
        })(); this.lifetime.check(); } finally { ((_event?: unknown) => {
          this.bootChainDone = true;
          if (!this.isCalculating) this.finishBoot();
        })(); this.publish(); } })(), {
        next: () => {
          // Restore the comparison the link carried, or — for the autosave path — the one
          // that was active before the refresh. Either way a `null` clears any active
          // comparison, matching how loading a saved sim behaves.
          this.restoreCompareState(shared ? shared.compare : this.calcStorage.readCompareState());
          if (shared) {
            this.messageService.add({ severity: 'success', summary: 'Simulação carregada', detail: 'Carregada a partir do link compartilhado.' });
          }
        },
        error: (err) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: 'Falha ao carregar os dados',
            detail: 'Não foi possível baixar a base de itens. Recarregue a página.',
            life: 10000,
          });
        },
      }, () => this.publish());

    this.allSubs.push(this.lifetime.watch(this.roService.getItemViews(), (views) => (this.itemViews = views || {}), () => this.publish()));
    this.allSubs.push(this.layoutService.customItemsOpen.subscribe((_event?: unknown) => this.customStudio?.openLibrary()));
    this.allSubs.push(this.layoutService.customItemCreate.subscribe((request) =>
      this.customStudio?.openCreate(request.kind, { slot: request.slot, compare: request.compare })));
    this.allSubs.push(this.layoutService.customItemEdit.subscribe((id) => this.openEditCustomItem(id)));

    const isCalcSubs = listenDebounced(this.isCalculatingEvent, 100, value => { ((_event?: unknown) => {
      this.isCalculating = false;
      // End of the first calculation: the screen has numbers, so the boot is over.
      if (this.bootChainDone) this.finishBoot();
    })(value); this.publish(); }, value => {  this.publish(); });
    this.allSubs.push(isCalcSubs);

    const itemChanges = new Set<ItemTypeEnum>();
    // let n = 0;
    const updateItemSubs = listenDebounced(this.updateItemEvent, 250, value => { ((_event?: unknown) => {
        this.hiddenMap = {
          ammu: !this.calculator.isAllowAmmo(),
          shield: !this.calculator.isAllowShield(),
        };
        if (this.hiddenMap.ammu && this.model.ammo) {
          this.model.ammo = undefined;
          this.onSelectItem(ItemTypeEnum.ammo);
          return;
        }
        if (this.hiddenMap.shield && this.model.shield) {
          this.model.shield = undefined;
          this.onSelectItem(ItemTypeEnum.shield);
          this.onClearItem(ItemTypeEnum.shield);
          return;
        }

        this.showLeftWeapon = this.isAllowLeftWeaponByClass && !this.hiddenMap.shield;
        if (this.model.leftWeapon && !this.showLeftWeapon) {
          this.model.leftWeapon = undefined;
          this.onSelectItem(ItemTypeEnum.leftWeapon);
          this.onClearItem(ItemTypeEnum.leftWeapon);
          return;
        }

        // Same clear-and-bail idiom as the two rules above: emptying a slot re-fires
        // updateItemEvent, and the next pass sees a build with no overlap left.
        if (this.refreshHeadSlotOccupancy(itemChanges)) {
          return;
        }

        if (itemChanges.has(ItemTypeEnum.weapon)) {
          this.setAmmoDropdownList();
        }
        // The compare pipeline is the only thing that rebuilds showCompareItemMap and the
        // compare item list, and an item change can turn the off-hand row on or off. Re-run
        // it when the two disagree, so a row that just went away stops being compared — and
        // one that came back starts again. Self-correcting, so it settles in one pass.
        if (this.compareItemNames?.includes(ItemTypeEnum.leftWeapon) && !!this.showCompareItemMap.leftWeapon !== this.isLeftWeaponShown) {
          this.updateCompareEvent.next(1);
        }
        this.calculate();
        this.calcCompare();
        this.saveCurrentStateItemset();
        this.resetItemDescription();
        this.onSelectItemDescription(Boolean(this.selectedCompareItemDesc));
        this.applySummaryTables();

        this.refreshChanceList();

        this.equipRevision += 1;
        this.isCalculatingEvent.next(false);
        itemChanges.clear();
      })(value); this.publish(); }, value => { ((itemChange: ItemTypeEnum) => {
          this.isCalculating = true;
          // console.log('updateItemSubs ', ++n);
          itemChanges.add(itemChange);
        })(value); this.publish(); });
    this.allSubs.push(updateItemSubs);

    const x = listenDebounced(this.updateCompareEvent, 250, value => { ((_event?: unknown) => {
        const comparison = prepareCompareEquipment({
          source: this.model2,
          itemNames: this.compareItemNames || [],
          itemOrder: this.compareItemList,
          items: this.items,
          leftWeaponShown: this.isLeftWeaponShown,
          compareStats: this.isCompareStats,
        });
        const model2 = comparison.model as ClassModel;
        const equipItemIdItemTypeMap2 = comparison.equipped;
        this.showCompareItemMap = comparison.offered;
        if (this.isCompareStats) this.applyJobBonus(model2, model2['jobLevel']);
        this.equipCompareItemIdItemTypeMap = equipItemIdItemTypeMap2;
        this.equipCompareItems = this.buildEquipItemList(this.equipCompareItemIdItemTypeMap, model2);
        if (!this.equipCompareItemIdItemTypeMap.has(this.selectedCompareItemDesc)) {
          this.selectedCompareItemDesc = undefined;
        }
        // console.log('model2', { ...model2 })
        if (this.isEnableCompare) {
          this.model2 = model2;
          this.calcCompare();
        } else {
          this.resetModel2();
          this.totalSummary2 = undefined;
          this.bonusBreakdownKeys2 = new Set<string>();
          // Drop the PVP tab's comparison too, or turning it off leaves a stale
          // "→ simulado" column behind over there.
          this.pvpSummary2 = null;
          this.rotationViewPvp2 = null;
        }
        // Rebuild the summary tables so the "Bônus de Habilidade / Multiplicadores"
        // cells pick up (or drop) the compared build's "main → simulado" arrows.
        this.applySummaryTables();
        // Refresh the Efeitos list so an activation that only exists on the item being
        // compared (e.g. its card's Instinto) shows up alongside the main build's.
        this.refreshChanceList();
        this.onSelectItemDescription(this.isEnableCompare && Boolean(this.selectedCompareItemDesc));

        // Persist the comparison alongside the autosave so it survives a refresh.
        this.calcStorage.writeCompareState(this.currentCompareState());

        this.equipRevision += 1;
        this.isCalculatingEvent.next(false);
        this.restoreAutoCastCompareScroll();
      })(value); this.publish(); }, value => { ((_event?: unknown) => (this.isCalculating = true))(value); this.publish(); });
    this.allSubs.push(x);

    // Ticking an Efeito used to take a fast path: setSelectedChances(...) +
    // recalcExtraBonus(selectedAtkSkill) on the main calculator, for that one skill.
    // A rotation has N skills to refresh (and the compare column has its own list), so
    // that shortcut cannot produce a correct panel any more — re-solve properly instead.
    // The full pass costs about what the old one did once the multi-monster loop is
    // taken out of the same tick, and it also retires the stale-`effected*` hazard the
    // fast path created (see pickHeroDamage in battle-hud.logic.ts).
    const cObs = ((_event?: unknown) => { this.allSubs.push(listenDebounced(this.chanceSettled, 100, value => { ((_event?: unknown) => {
        this.isCalculatingEvent.next(false);
      })(value); this.publish(); })); return listenDebounced(this.updateChanceEvent, 300, (value) => { ((_event?: unknown) => {
          this.calculate();
          if (this.isEnableCompare) this.calcCompare();
          this.applySummaryTables();
        })(value); this.publish();
          this.chanceSettled.next(value); }, value => { ((_event?: unknown) => (this.isCalculating = true))(value); this.publish(); }); })();
    this.allSubs.push(cObs);
  }

  dispose(): void {
    this.resolvePendingImport?.(null);
    this.lifetime.dispose();
    // Safety net: the splash is not part of the template, so leaving the screen mid-boot
    // would leave it hanging over the app.
    this.finishBoot();
    this.hideBootSplash();
    for (const ob of this.allSubs) {
      ob?.unsubscribe();
    }
  }

  private initData() {
    return (async () => { try { const result = await Promise.all([
      this.roService.getItems<Record<number, ItemModel>>(),
      this.roService.getMonsters<Record<number, MonsterModel>>(),
      this.roService.getHpSpTable<HpSpTable>(),
      this.roService.getLatamClasses(),
    ]); this.lifetime.check();
(([items, monsters, hpSpTable, latamClasses]) => {
        if (this.sharedCustomItems.length) {
          const checked = validateCustomItems(this.sharedCustomItems, items);
          if (checked.errors.length) {
            this.messageService.add({ severity: 'error', summary: 'Itens do link inválidos', detail: checked.errors[0].message });
            this.sharedCustomItems = [];
          } else this.sharedCustomItems = checked.items;
        }
        const autosave = ((_event?: unknown) => { try { return JSON.parse(localStorage.getItem('ro-set') ?? '{}').__customItems ?? []; } catch { return []; } })();
        const fallbacks: CustomItemDefinition[] = [
          ...this.savedSimStore.list().flatMap((save) => save.customItems ?? []), ...autosave,
        ].filter(isCustomItem);
        const localIds = new Set(this.customLibrary.items.map((item) => item.id));
        for (const item of fallbacks) if (!localIds.has(item.id)) this.hiddenCustomIds.add(item.id);
        this.items = { ...items, ...Object.fromEntries(fallbacks.map((item) => [item.id, item])),
          ...Object.fromEntries(this.customLibrary.items.map((item) => [item.id, item])),
          ...Object.fromEntries(this.sharedCustomItems.map((item) => [item.id, item])) };
        for (const item of Object.values(this.items).filter(isCustomItem)) {
          this.customLibrary.registerRuntime(item);
          this.itemDescriptionStore.upsert(item.id, customItemDescriptionHtml(item));
        }
        this.monsterDataMap = monsters;
        this.hpSpTable = hpSpTable;

        // Show only classes released on LATAM (job icon present in the client GRF),
        // minus the few we keep hidden because the calc doesn't model them yet (4308).
        const latamClassSet = new Set(latamClasses);
        this.characterList = Characters.filter(
          (c) => latamClassSet.has(c.icon) && !HIDDEN_CLASS_IDS.has(c.icon),
        );

        this.selectedMonsterName = this.monsterDataMap[this.selectedMonster]?.name;

        // Seeded from one list on purpose: three separate statements are how the PVP
        // compare calculator was added without one, which made every compare pass in the
        // PVP tab die inside setWeapon. A new instance is one entry away from working.
        for (const calc of [this.calculator, this.calculator2, this.calculatorPvp, this.calculatorPvp2]) {
          calc.setMasterItems(this.items).setHpSpTable(hpSpTable);
        }
        this.refreshPvpTargets();

        const ens = [] as DropdownModel[];
        this.mapEnchant = new Map(
          Object.values(this.items)
            .filter(isEquipmentEnchant)
            .map((item) => {
              ens.push({
                label: item.name,
                value: item.id,
              });

              return [item.aegisName, item];
            }),
        );
        this.enchants = ens;

        if (!this.env.production) {
          const enchants = EnchantTable.flatMap((a) => a.enchants)
            .filter(Boolean)
            .flat();
          const allEnchantSet = new Set(enchants);
          console.log({ allEnchantSet });
          for (const enchtName of allEnchantSet.values()) {
            if (!this.mapEnchant.has(enchtName)) {
              console.log('not found in data.json', { enchtName });
            }
          }
        }

        this.setMonsterDropdownList();
        this.setItemList();
      })(result); } finally {  this.publish(); } })();
  }

  private importedCustomLink = false;

  private importCustomItemFromUrl(): void {
    try {
      const url = new URL(shareEntryHref());
      const hashQuery = url.hash.includes('?') ? url.hash.slice(url.hash.indexOf('?') + 1) : '';
      const token = new URLSearchParams(hashQuery).get('customItem');
      if (!token) return;
      const incoming = decodeCustomBundle(token, this.items);
      const installed = this.customLibrary.library.import(incoming, this.items);
      this.customLibrary.refresh();
      for (const item of installed) this.addCustomRuntimeItem(item);
      this.setItemList();
      this.importedCustomLink = true;
      url.hash = '#/';
      history.replaceState(history.state, '', url.href);
      this.messageService.add({ severity: 'success', summary: 'Itens importados', detail: `${installed.length} item(ns) adicionados aos Meus itens.` });
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Falha ao importar item', detail: error instanceof Error ? error.message : 'Link inválido.' });
    }
  }

  private addCustomRuntimeItem(item: CustomItemDefinition): void {
    this.items[item.id] = item;
    this.customLibrary.registerRuntime(item);
    this.itemDescriptionStore.upsert(item.id, customItemDescriptionHtml(item));
    if (item.itemTypeId === ItemTypeId.ENCHANT) {
      this.mapEnchant?.set(item.aegisName, item);
      this.enchants = [...this.enchants.filter((row) => row.value !== item.id), { label: item.name, value: item.id }];
    }
  }

  onCustomItemSaved(event: { item: CustomItemDefinition; context?: { slot: string; compare: boolean } }): void {
    const { item, context } = event;
    this.hiddenCustomIds.delete(item.id);
    this.addCustomRuntimeItem(item);
    this.savedSimStore.invalidateProfilesForItem(item.id);
    this.setItemList();
    if (this.selectedCharacter) this.setItemDropdownList();
    if (context?.slot) {
      const target = context.compare ? this.model2 : this.model;
      const custom = context.slot.match(/^custom:([^:]+):(card|enchant):(\d+)$/);
      if (context.slot === 'consumables') {
        this.model.consumables = [...new Set([...(this.model.consumables ?? []), item.id])];
        this.onConsumableChange();
      } else if (custom) {
        const state = (target as MainModel).customAttachments?.[custom[1]];
        if (state) state[custom[2] === 'card' ? 'cards' : 'enchants'][Number(custom[3])] = item.id;
        if (context.compare) this.updateCompareEvent.next(1); else this.updateItemEvent.next(custom[1] as ItemTypeEnum);
      } else {
        target[context.slot] = item.id;
        if (!context.compare) this.onSelectItem(context.slot, item.id, Number(target[`${context.slot}Refine`]) || 0);
        else this.updateCompareEvent.next(1);
      }
    } else {
      this.updateItemEvent.next(item.kind as ItemTypeEnum);
    }
    this.refreshPvpTargets();
  }

  onCustomItemDeleted(id: number): void {
    this.hiddenCustomIds.add(id);
    this.setItemList();
    if (this.selectedCharacter) this.setItemDropdownList();
    this.updateItemEvent.next(ItemTypeEnum.weapon);
  }

  openCreateConsumable(): void {
    this.customStudio?.openCreate('consumable', { slot: 'consumables', compare: false });
  }

  editCustomConsumable(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.openEditCustomItem(id);
  }

  private openEditCustomItem(id: number): void {
    const item = this.customLibrary.items.find((entry) => entry.id === id) ?? this.items[id];
    if (item?.custom) this.customStudio?.edit(item as CustomItemDefinition);
  }

  private prepare(calculator: Calculator, compareModel?: any, pvpTarget?: PlayerTargetProfile, pvpMode?: PvpMode) {
    const { activeSkills, passiveSkills, selectedAtkSkill } = this.model;
    const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = this.selectedCharacter
      .setLearnSkills({
        activeSkillIds: activeSkills,
        passiveSkillIds: passiveSkills,
      })
      .getSkillBonusAndName();
    const hasWeapon = !!(this.model.weapon || this.model.leftWeapon);
    const equippedAtks = withoutWeaponlessTalismans(equipAtks, hasWeapon);

    const { scripts: consumeData, usedHpL } = collectConsumables(this.model, this.items);
    const { aspdPotion, buffBonuses } = applyGuaranaCandy({
      consumables: this.model.consumables,
      aspdPotion: this.model.aspdPotion,
      buffDefs: this.skillBuffs,
      selectedBuffValues: this.model.skillBuffs,
      activeSkillNames,
      buffBonuses: collectBuffBonuses(this.skillBuffs, this.model.skillBuffs, activeSkillNames, hasWeapon),
    });
    const { equipAtk: buffEquips, masteryAtk: buffMasterys } = buffBonuses;

    const calc = calculator.setClass(this.selectedCharacter);
    const rawOptionTxts = [...this.model.rawOptionTxts];
    const isShadowOption = {
      [ItemTypeEnum.shadowWeapon]: true,
      [ItemTypeEnum.shadowArmor]: true,
      [ItemTypeEnum.shadowShield]: true,
      [ItemTypeEnum.shadowBoot]: true,
      [ItemTypeEnum.shadowEarring]: true,
      [ItemTypeEnum.shadowPendant]: true,
    };
    if (compareModel) {
      const model2 = this.resolveCompareHeadSlots({
        ...this.model,
        ...compareModel,
        customAttachments: { ...this.model.customAttachments, ...compareModel.customAttachments },
      });
      calc.loadItemFromModel(model2);

      // if compare the item, should get options from its.
      if (this.compareItemNames?.includes(ItemTypeEnum.weapon)) {
        const itemId = this.model2[ItemTypeEnum.weapon];
        for (let slot = ItemOptionNumber.W_Left_1; slot <= ItemOptionNumber.W_Left_3; slot++) {
          if (!itemId) {
            this.model2.rawOptionTxts[slot] = null;
          }
          rawOptionTxts[slot] = this.model2.rawOptionTxts[slot];
        }

        const isAllowShield = calc.isAllowShield();
        for (let slot = ItemOptionNumber.W_Right_1; slot <= ItemOptionNumber.W_Right_3; slot++) {
          if (!itemId || !isAllowShield) {
            this.model2.rawOptionTxts[slot] = null;
            rawOptionTxts[slot] = this.model2.rawOptionTxts[slot];
          }
        }
      }

      // One hand, three claimants — a shield, an off-hand weapon, or the second half of a
      // two-handed one. The merged model can end up holding two of them; core decides who
      // keeps the hand, and the losers are emptied here.
      const evictedSlots = resolveOffHandEviction({
        isWeaponTwoHanded: !calc.isAllowShield(),
        canWieldOffHandWeapon: this.isLeftWeaponShown,
        hasShield: !!model2[ItemTypeEnum.shield],
        hasLeftWeapon: !!model2[ItemTypeEnum.leftWeapon],
        comparedSlots: this.compareItemNames ?? [],
      });
      if (evictedSlots.length > 0) {
        this.evictFromCompareOffHand(calc, model2, rawOptionTxts, evictedSlots);
      }

      if (this.compareItemNames?.includes(ItemTypeEnum.leftWeapon)) {
        // The off-hand weapon's random options live in the W_Right slots (the names are
        // the client's, and they are the mirror of the main weapon's W_Left ones).
        const itemId = model2[ItemTypeEnum.leftWeapon];
        for (let slot = ItemOptionNumber.W_Right_1; slot <= ItemOptionNumber.W_Right_3; slot++) {
          if (!itemId) {
            this.model2.rawOptionTxts[slot] = null;
          }
          rawOptionTxts[slot] = this.model2.rawOptionTxts[slot];
        }
      }

      for (const [_itemType, slotNumbers] of ItemOptionTable) {
        if (this.compareItemNames?.includes(_itemType)) {
          const itemId = this.model2[_itemType];

          if (isShadowOption[_itemType]) {
            // Shadow gear can carry up to two options (SD_*_1 / SD_*_2); mirror
            // the primary path (toRawOptionTxtList) and copy/clear every slot.
            for (const slot of slotNumbers) {
              if (!itemId) this.model2.rawOptionTxts[slot] = null;
              rawOptionTxts[slot] = this.model2.rawOptionTxts[slot];
            }
            continue;
          }

          for (const slot of slotNumbers) {
            rawOptionTxts[slot] = this.model2.rawOptionTxts[slot];
          }

          let totalItemOptionSlot = 0;
          if (itemId) {
            const aegisName = this.items[itemId]?.aegisName;
            totalItemOptionSlot = ExtraOptionTable[aegisName] || 0;
          }

          for (const [index, slot] of slotNumbers.entries()) {
            if (totalItemOptionSlot <= index) {
              rawOptionTxts[slot] = null;
              this.model2.rawOptionTxts[slot] = null;
            }
          }
        }
      }
    } else {
      // clean if the itemType not allow to have options
      this.model.rawOptionTxts = toRawOptionTxtList(this.model, this.items);

      calc.loadItemFromModel(this.model);
    }

    const chainInput: CalcChainInput = {
      monster: this.selectedMonsterModel,
      relieveLevel: this.relieveLevel,
      playerTarget: pvpTarget,
      pvpMode,
      equipAtks: equippedAtks,
      masteryAtks,
      buffEquips,
      buffMasterys,
      consumeData,
      aspdPotion,
      extraOptionScripts: parseOptionScripts([
        ...(!compareModel ? this.model.rawOptionTxts : rawOptionTxts),
        ...customOptionScripts(compareModel ? this.model2 : this.model),
      ]),
      activeSkillNames,
      learnedSkillMap,
      selectedAtkSkill,
      // Each build ticks its own procs; the compare column is not the main one.
      selectedChances: compareModel ? this.selectedChances2 : this.selectedChances,
      usedHpL,
    };

    this.controller.runChain(calc, chainInput);
    // Stashed for the rotation pass, which re-solves this same loaded calculator once
    // per distinct skill. Read immediately by the caller — prepare() is synchronous and
    // never interleaves, so a single slot is enough.
    this.lastChainInput = chainInput;

    return calc;
  }

  /**
   * Take one or more slots off the compared build's off hand: empty them in `model2`,
   * drop their random options from both the compare model and the option list the pass
   * runs on, and re-load the calculator.
   *
   * Going through the model — rather than `setItem(undefined)` — is what makes the
   * eviction stick. Clearing a slot that way unregisters its scripts, but an off-hand
   * weapon's own ATQ and its dual-wield VelAtq are read from `leftWeaponData`, and the
   * shield's VelAtq penalty from `model.shield`, neither of which `setItem` touches;
   * only `loadItemFromModel` writes them. `loadItemFromModel` also skips an absent
   * slot's cards and enchants outright, so emptying the main field is enough.
   */
  private evictFromCompareOffHand(calc: Calculator, model2: any, rawOptionTxts: string[], itemTypes: ItemTypeEnum[]) {
    for (const itemType of itemTypes) {
      model2[itemType] = null;

      for (const slot of ItemOptionMap.get(itemType) ?? []) {
        rawOptionTxts[slot] = null;
        this.model2.rawOptionTxts[slot] = null;
      }
    }

    calc.loadItemFromModel(model2);
  }

  /**
   * Solve each distinct skill and accumulation pair on an already-prepared calculator
   * and build the panel's view model.
   *
   * Ataque básico needs no pass at all — its numbers live in
   * `dmg.basic*` / `calc.hitPerSecs`, which no offensive skill affects.
   */
  private solveRotation(calc: Calculator, input: CalcChainInput, baseSummary: any): RotationView {
    const summaryByValue = new Map<string, any>();
    const summaryByIndex = new Map<number, any>();
    const solved = new Map<string, any>();
    const originalStacks = this.model.skillStacks;

    for (const [index, value] of (this.model.rotation ?? []).entries()) {
      if (isBasicAttack(value)) continue;
      const name = value.split('==')[0];
      const stack = this.model.rotationStacks?.[index];
      const cacheKey = `${value}:${Number.isFinite(stack) ? stack : originalStacks?.[name] ?? ''}`;
      if (solved.has(cacheKey)) {
        summaryByIndex.set(index, solved.get(cacheKey));
        continue;
      }
      calc.setSkillStacks(Number.isFinite(stack)
        ? { ...(originalStacks ?? {}), [name]: stack }
        : originalStacks);
      const summary = this.controller.solveSkill(calc, input, value).getTotalSummary();
      summaryByIndex.set(index, summary);
      solved.set(cacheKey, summary);
      if (!summaryByValue.has(value)) summaryByValue.set(value, summary);
    }

    // Leave the calculator on the skill the rest of the app expects to find it on.
    calc.setSkillStacks(originalStacks);
    this.controller.solveSkill(calc, input, input.selectedAtkSkill);

    return buildRotationView({
      rotation: this.model.rotation ?? [],
      summaryByValue,
      baseSummary,
      // This build's own ticked procs, not the main build's: prepare() already picks
      // selectedChances2 for the compared build, so reading `this.selectedChances` here
      // meant a proc ticked only on the comparison never reached its rows.
      hasSelectedChances: (input.selectedChances?.length ?? 0) > 0,
      atkSkills: this.atkSkills,
      skillStacks: this.model.skillStacks,
      rotationStacks: this.model.rotationStacks,
      summaryByIndex,
    });
  }

  /** Applies a new rotation order/content from the panel and recalculates. */
  onRotationChange(change: { rotation: string[]; stacks: number[] }) {
    this.model.rotation = change.rotation;
    this.model.rotationStacks = change.stacks;
    this.syncRotationMirror();
    this.updateItemEvent.next(true);
  }

  onSkillFormulaVersionChange(version: SkillFormulaVersion) {
    this.model.skillFormulaVersion = this.showPreviews ? normalizeSkillFormulaVersion(version) : 'current';
    this.setClassSkill();
    const rotation = this.model.rotation ?? [];
    const kept = rotation.flatMap((value, index) => pruneRotationForClass([value], this.atkSkills).length ? [index] : []);
    this.model.rotation = kept.map(index => rotation[index]);
    if (this.model.rotationStacks) this.model.rotationStacks = kept.map(index => this.model.rotationStacks[index]);
    this.syncRotationMirror();
    if (!pruneRotationForClass([this.model.selectedAtkSkill], this.atkSkills).length) {
      this.model.selectedAtkSkill = defaultAtkSkill(this.atkSkills);
    }
    this.updateItemEvent.next(true);
  }

  onSkillStackChange(change: { index: number; stack: number }) {
    const name = this.model.rotation?.[change.index]?.split('==')[0];
    const skill = this.atkSkills.find((entry) => entry.name === name);
    if (!skill?.maxStack || !Number.isInteger(change.stack)) return;
    const stack = Math.max(skill.minStack ?? 0, Math.min(skill.maxStack, change.stack));
    const stacks = [...(this.model.rotationStacks ?? [])];
    stacks[change.index] = stack;
    this.model.rotationStacks = stacks;
    this.updateItemEvent.next(true);
  }

  /**
   * Reorder for the shortest cycle. Damage per cycle is permutation-invariant, so this
   * is purely about the recarga stalls — see core/rotation-optimize.ts.
   */
  onOptimizeRotation() {
    if (this.rotationView?.timingUnknown) {
      this.messageService.add({ severity: 'info', summary: 'Prévia', detail: 'Os tempos destas habilidades ainda não estão disponíveis para calcular ou otimizar o DPS.' });
      return;
    }
    const cycle = this.rotationView?.cycle;
    if (!cycle) return;

    const stepByValue = new Map<string, RotationScheduleStep>();
    for (const entry of this.rotationView.entries) {
      if (stepByValue.has(entry.value)) continue;
      stepByValue.set(entry.value, toScheduleStep({ value: entry.value, summary: entry.summary, damage: entry.damage }));
    }

    const result = optimizeRotation({
      rotation: this.model.rotation ?? [],
      stepByValue,
      aspdPeriod: this.rotationView.aspdPeriod,
    });

    if (!result.changed) {
      this.messageService.add({ severity: 'info', summary: 'Otimizar', detail: 'Já está na melhor ordem que encontrei.' });
      return;
    }

    // Snapshot for the undo — the old panel only ever diagnosed, this one rewrites the
    // user's rotation, so the change has to be reversible in one click.
    const previous = (this.model.rotation ?? []).slice();
    const previousStacks = [...(this.model.rotationStacks ?? [])];
    const stacksByValue = new Map<string, number[]>();
    previous.forEach((value, index) => {
      const stacks = stacksByValue.get(value) ?? [];
      stacks.push(previousStacks[index]);
      stacksByValue.set(value, stacks);
    });
    const gain = result.dpsBefore > 0 ? ((result.dpsAfter - result.dpsBefore) / result.dpsBefore) * 100 : 0;
    const fmt = (v: number) => v.toFixed(2).replace('.', ',');

    this.onRotationChange({
      rotation: result.order,
      stacks: result.order.map((value) => stacksByValue.get(value)?.shift() ?? NaN),
    });
    this.messageService.add({
      key: 'rotation-optimize',
      severity: 'success',
      summary: 'Ordem otimizada',
      detail: `Ciclo ${fmt(result.cycleBefore)}s → ${fmt(result.cycleAfter)}s (+${gain.toFixed(1).replace('.', ',')}% de DPS).`,
      life: 8000,
      data: { previous, previousStacks },
    });
  }

  /** Undo for the optimiser toast. */
  undoOptimize(previous: string[], previousStacks: number[]) {
    this.messageService.clear('rotation-optimize');
    this.onRotationChange({ rotation: previous, stacks: previousStacks });
  }

  private calculate() {
    const calc = this.prepare(this.calculator);

    this.totalSummary = calc.getTotalSummary();
    this.autoCastSimulation = buildAutoCastSimulation({
      calc,
      model: this.model,
      summary: this.totalSummary,
      hasSelectedEffects: this.selectedChances.length > 0,
    });
    this.pruneAutoCastSelections(this.autoCastSimulation);
    this.rotationView = this.lastChainInput ? this.solveRotation(calc, this.lastChainInput, this.totalSummary) : null;
    const modelSummary = calc.getModelSummary() as any;
    this.modelSummary = { ...modelSummary, rawOptionTxts: modelSummary.rawOptionTxts.filter(Boolean) };
    const x = calc.getItemSummary();
    // engine sources (equips, skills, buffs) + per-consumable maps + the selected
    // ASPD potions (display-only), so the breakdown modal can attribute
    // consumables/buffs/skills/potions alongside item slots
    // Potions apply a flat ASPD bonus scaled by the character's final AGI (× AGI /
    // 200) — feed that same AGI so the breakdown shows the real value, not nominal.
    const potionBreakdown = collectAspdPotionSources(this.model, AspdPotionFixBonus, this.totalSummary?.calc?.totalAgi ?? 0);
    this.bonusBreakdownSources = {
      ...x,
      ...collectConsumables(this.model, this.items).sources,
      ...potionBreakdown.sources,
      // A ticked proc is part of the sheet the panel is showing, so it has to be part of
      // the breakdown behind it too — see collectChanceSources.
      ...collectChanceSources(calc.chanceList, this.selectedChances),
    };
    this.bonusBreakdownTooltips = potionBreakdown.tooltips;
    this.bonusBreakdownKeys = collectContributingKeys(this.bonusBreakdownSources);
    // "Redução de dano" popover for the main stats — the build's own gear reductions
    // against anything, not just a player attacker (no castle layer; mode-independent),
    // hence the 'self' scope. See docs/pvp.md §4.
    this.selfReductionCategories = buildReductionCategories(this.calculator.getDefenderBonus(), 'pvp', 'self');
    const splitNumber = Object.keys(x).length / 2;
    const part1 = Object.entries(x).filter((a, index) => {
      return index < splitNumber;
    });
    const part2 = Object.entries(x).filter((a, index) => {
      return index >= splitNumber;
    });
    this.itemSummary = part1.reduce((total, [key, value]) => {
      total[key] = value;
      return total;
    }, {});
    this.itemSummary2 = part2.reduce((total, [key, value]) => {
      total[key] = value;
      return total;
    }, {});
    // this.possiblyDamages = calc.getPossiblyDamages().map((a) => ({ label: `${a}`, value: a }));

    // Keep the PVP tab live as the attacker build changes.
    if (this.selectedPvpTargetId) this.calculatePvp();
  }

  private calcCompare() {
    if (this.compareItemNames?.length > 0 || this.isCompareStats || this.isCompareAutoCast) {
      const m2 = JSON.parse(JSON.stringify(this.model2));
      const calc2 = this.prepare(this.calculator2, m2);
      this.totalSummary2 = calc2.getTotalSummary();
      this.autoCastSimulation2 = buildAutoCastSimulation({
        calc: calc2,
        model: { ...this.model, ...m2 },
        summary: this.totalSummary2,
        hasSelectedEffects: this.selectedChances2.length > 0,
      });
      this.pruneAutoCastSelections(this.autoCastSimulation2, this.model2);
      this.rotationView2 = this.lastChainInput ? this.solveRotation(calc2, this.lastChainInput, this.totalSummary2) : null;
      this.compareItemSummaryModel = calc2.getItemSummary();
      // Mirror calculate()'s bonusBreakdownSources for the compared build, so a click on a
      // "→ simulado" summary value drills into the compare column's own gear. Consumables and
      // ASPD potions are global toggles (only on the main MainModel, shared by both columns),
      // so reuse those from this.model — but scale the potions by the compare build's AGI.
      const potion2 = collectAspdPotionSources(this.model, AspdPotionFixBonus, this.totalSummary2?.calc?.totalAgi ?? 0);
      this.bonusBreakdownSources2 = {
        ...this.compareItemSummaryModel,
        ...collectConsumables(this.model, this.items).sources,
        ...potion2.sources,
        ...collectChanceSources(calc2.chanceList, this.selectedChances2),
      };
      this.bonusBreakdownTooltips2 = potion2.tooltips;
      this.bonusBreakdownKeys2 = collectContributingKeys(this.bonusBreakdownSources2);

      // The PVP tab's comparison column reads model2, which is only settled here.
      // calculate() already solved PVP, but it ran before this — and enabling the
      // comparison at all never goes through calculate(), so without this the PVP panel
      // keeps its single-build result until something else happens to recalculate.
      //
      // Guarded because this is the compare pipeline's subscriber: it clears the loading
      // overlay as its last statement, so anything thrown here would strand the spinner
      // and unsubscribe the comparison control entirely.
      if (this.selectedPvpTargetId) {
        try {
          this.calculatePvp();
        } catch (err) {
          console.error('Falha ao atualizar o PVP após a comparação', err);
        }
      }
    }
  }

  onAutoCastSelectionChange(change: { key: string; skillId?: number; side: 'current' | 'compare' }): void {
    const target = change.side === 'compare' ? this.model2 : this.model;
    target.autoCastSelections = { ...(target.autoCastSelections ?? {}), [change.key]: change.skillId };
    if (!change.skillId) delete target.autoCastSelections[change.key];
    (change.side === 'compare' ? this.updateCompareEvent : this.updateItemEvent).next(1);
  }

  private pruneAutoCastSelections(simulation: AutoCastSimulation, target: Partial<MainModel> = this.model): void {
    const slots = new Map(simulation.slots.map((slot) => [slot.key, new Set(slot.options.map((option) => option.value))]));
    for (const [key, skillId] of Object.entries(target.autoCastSelections ?? {})) {
      if (!slots.get(key as any)?.has(Number(skillId))) delete target.autoCastSelections[key];
    }
  }

  /** Rebuild the toggleable Efeitos (item activations) list: the main build's chances
   *  plus — while comparing — the compare build's, so an activation that only exists on
   *  the item being compared still appears (deduped by name). A compare-only chance,
   *  when toggled on, applies to the compare column (calc2 filters it back in) and is a
   *  no-op on the main column. Prunes selections that no longer have a matching chance. */
  /**
   * Rebuild the "Efeitos" lists — one per build, no longer one shared list.
   *
   * The two builds carry different gear, so they offer different procs; the design's
   * comparison mode shows both rows and lets each be ticked on its own. Each list is
   * also a *union over the rotation's steps*: `prepareAllItemBonus()` rebuilds
   * `_chanceList` on every pass and item conditions can read the skill name, so a proc
   * offered for step 1 may be absent for step 3. A proc that applies to only some steps
   * is simply a no-op on the others — the same tolerance `recalcExtraBonus` already has.
   */
  private refreshChanceList() {
    this.chanceList = this.calculator.chanceList.slice();
    this.chanceList2 = this.isEnableCompare ? this.calculator2.chanceList.slice() : [];

    this.selectedChances = this.selectedChances.filter((name) => this.chanceList.some((c) => c.name === name));
    this.selectedChances2 = this.selectedChances2.filter((name) => this.chanceList2.some((c) => c.name === name));
  }

  /**
   * Recompute every "Bônus de Habilidade / Multiplicadores" summary table from
   * the latest engine output. The shaping logic lives in `core/summary-tables`;
   * this just wires the pure builders to the bound view fields.
   */
  private applySummaryTables(): void {
    // While comparing, feed the compared build's summary so each table row carries a
    // `*2` value and the misc-detail template can render the "main → simulado" arrow.
    const cmp = this.isComparing ? this.totalSummary2 : undefined;
    this.elementTable = buildElementTable(this.totalSummary, cmp, this.monsterDataMap[this.selectedMonster]?.stats?.class === 1);
    ({ raceTable: this.raceTable, peneRaceTable: this.peneRaceTable } = buildRaceTables(this.totalSummary, cmp));
    this.sizeTable = buildSizeTable(this.totalSummary, cmp);
    ({ classTable: this.classTable, peneClassTable: this.peneClassTable } = buildMonsterTypeTables(this.totalSummary, cmp));
    this.atkTypeTable = buildAtkTypeTable(this.totalSummary, cmp);
    this.skillMultiplierTable = buildSkillMultiplierTable(this.totalSummary, (key) => resolveSkillKey(key), cmp);
    this.statsSummary = buildStatsSummary(this.totalSummary, cmp ?? null, {
      bonusValueText: (key, value) => this.bonusValueText(key, value),
      canBreakdown: (keys, compare) => this.canBreakdown(keys, compare),
    });
  }

  /** True when a compare build is active and its summary has been computed — gates
   *  the "main → simulado" arrows in the "Bônus de Habilidade / Multiplicadores" tables. */
  get isComparing(): boolean {
    return this.isEnableCompare && !!this.totalSummary2;
  }

  /** The skill panel groups every target-side effect together without changing the
   * source arrays: the template keeps each row's original index for its model binding. */
  get hasSkillDebuffs(): boolean {
    return this.skillBuffs.some((skill) => skill.isDebuff && this.isSkillVisible(skill)) || this.activeSkills.some((skill) => skill.isDebuff && this.isSkillVisible(skill));
  }

  /** Class-specific active effects stay separate from target-side debuffs. */
  get hasActiveSkillEffects(): boolean {
    return this.activeSkills.some((skill) => !skill.isDebuff && this.isSkillVisible(skill));
  }

  private resetModel() {
    const { class: _class, level, jobLevel } = this.model;
    this.model = { ...createMainModel(), class: _class, level, jobLevel };
    this.resetModel2();
  }

  private resetModel2() {
    this.model2 = { rawOptionTxts: [] };
  }

  private waitConfirm(message: string, icon?: IconName) {
    return new Promise((res) => {
      this.confirmationService.confirm({
        message: message,
        header: 'Confirmação',
        icon: icon || 'exclamation-triangle',
        accept: () => {
          res(true);
        },
        reject: () => {
          console.log('reject confirm');
          res(false);
        },
      });
    });
  }

  private setModelByJSONString(savedModel: string | any) {
    const savedData = typeof savedModel === 'string' ? JSON.parse(savedModel || '{}') : savedModel;
    this.model = normalizeSavedModel(savedData);
  }

  /**
   * Keep `selectedAtkSkill` pointing at the rotation's first real skill. Call after any
   * rotation mutation — add, remove, reorder, level change, optimise, class change.
   * An all-basic rotation has no skill to mirror and keeps the previous value, because
   * the engine always needs some valid skill string to solve against.
   */
  private syncRotationMirror() {
    const mirrored = firstRealSkill(this.model.rotation);
    if (mirrored) this.model.selectedAtkSkill = mirrored;
  }

  loadItemSet(presetStrOrModel: string | PresetModel, isSetMinLevel = false) {
    this.isInProcessingPreset = true;

    this.setModelByJSONString(presetStrOrModel);

    this.model.selectedAtkSkill = this.model.selectedAtkSkill || defaultAtkSkill(this.atkSkills);
    const selectedAtkSkill = this.model.selectedAtkSkill;

    const { level, jobLevel, ...bkModel } = this.model;

    this.setClassInstant();
    this.setSkillModelArray();
    this.setClassSkill();
    this.setClassMinMaxLvl();

    return (async () => { try { const result = await this.lifetime.wait(); this.lifetime.check();
await ((_event?: unknown) => {
        this.setClassLvl({ currentLvl: level, currentJob: jobLevel, isSetMinLevel });
        this.setJobBonus();
        return this.lifetime.wait();
      })(); this.lifetime.check();
await ((_event?: unknown) => {
        this.setAspdPotionList();
        this.setDefaultSkill(selectedAtkSkill);
        this.setItemDropdownList();
        return this.lifetime.wait();
      })(); this.lifetime.check();
await ((_event?: unknown) => {
        try {
          this.model.shield = bkModel.shield;
          this.model.shieldCard = bkModel.shieldCard;
          this.model.shieldGrade = bkModel.shieldGrade;
          this.model.shieldRefine = bkModel.shieldRefine;
          this.model.shieldEnchant1 = bkModel.shieldEnchant1;
          this.model.shieldEnchant2 = bkModel.shieldEnchant2;
          this.model.shieldEnchant3 = bkModel.shieldEnchant3;

          for (const itemType of Object.keys(MainItemWithRelations) as ItemTypeEnum[]) {
            const refine = this.model[`${itemType}Refine`];
            const itemId = this.model[itemType];
            this.onSelectItem(itemType, itemId, refine);
            // console.log('Set Main Item', { itemType, itemId, refine });
            for (const relatedItemType of MainItemWithRelations[itemType] ?? []) {
              // console.log({ relatedItemType, val: this.model[relatedItemType] });
              this.onSelectItem(relatedItemType, this.model[relatedItemType], refine);
            }
          }
          this.onBaseStatusChange();
        } catch (error) {
          console.error(error);
        }

        // One macrotask hop is enough for the overlay to repaint before the final
        // calculation; the original 1 s was an arbitrary margin and the single largest
        // fixed cost of the initial load.
        return this.lifetime.wait(0.05);
      })(); this.lifetime.check(); } finally { ((_event?: unknown) => {
        this.isInProcessingPreset = false;
      })(); this.publish(); } })();
  }

  /**
   * Hand the colour panel the two values that belong to this browser — the names given to
   * the colours, and whether the button has been found — and write them back whenever it
   * says they moved. Neither is part of the build: a shared link carries which colour a
   * slot wears, never what the person who shared it calls that colour.
   */
  private initSlotColourPrefs(): void {
    this.slotColorPicker.initLocal(this.calcStorage.readSlotColorLabels(), !this.calcStorage.readSlotColorSeen());

    this.allSubs.push(
      this.slotColorPicker.localChange.subscribe((_event?: unknown) => {
        this.calcStorage.writeSlotColorLabels(this.slotColorPicker.labels);
        if (!this.slotColorPicker.hintPending) this.calcStorage.markSlotColorSeen();
      }),
    );
  }

  private saveCurrentStateItemset() {
    const preset = toUpsertPresetModel(this.model, this.selectedCharacter) as Record<string, any>;
    preset['__customItems'] = customDefinitionsForBuild([preset], this.items);
    localStorage.setItem('ro-set', JSON.stringify(preset));
  }

  // --- Save / preview / share simulations ---------------------------------
  /** The current build in the same preset shape the autosave / replay import use. */
  private currentPreset(): PresetModel {
    return toUpsertPresetModel(this.model, this.selectedCharacter) as unknown as PresetModel;
  }

  /**
   * A slot's highlight changed. Cosmetic, so nothing is re-solved — but it belongs to
   * the build, so the autosave has to catch up before the tab is closed.
   */
  onSlotColorChange(): void {
    this.saveCurrentStateItemset();
  }

  /**
   * A JSON-safe snapshot of the active "comparar slot" comparison, or `null` when
   * nothing is being compared. Shared by the autosave (survive-refresh) and the
   * named saves (restore-on-load).
   */
  private currentCompareState(): CompareState | null {
    if (!this.compareItemNames?.length && !this.isCompareStats && !this.isCompareAutoCast) return null;
    const state: CompareState = {
      itemNames: [...(this.compareItemNames ?? [])],
      model2: JSON.parse(JSON.stringify(this.model2 ?? { rawOptionTxts: [] })),
    };
    if (this.isCompareStats) state.stats = true;
    if (this.isCompareAutoCast) state.autoCast = true;
    return state;
  }

  /**
   * Apply a stored comparison to the live state and recompute. A `null` state
   * clears any active comparison — so loading a sim saved without one drops the
   * current comparison too. Slots no longer comparable are dropped.
   */
  private restoreCompareState(state: CompareState | null): void {
    // Against compareSlotsForClass(), not the full list: a share link or a saved sim can
    // carry an off-hand comparison into a class that has no off hand, and a comparison
    // with no card behind it would be counted without ever being shown.
    const offeredSlots = this.compareSlotsForClass();
    const names = (state?.itemNames ?? []).filter((n) =>
      offeredSlots.includes(n as keyof typeof ItemTypeEnum),
    ) as ItemTypeEnum[];
    this.model2 = state ? ({ rawOptionTxts: [], ...state.model2 } as ClassModel) : { rawOptionTxts: [] };
    this.compareItemNames = names;
    this.isCompareStats = !!state?.stats;
    this.isCompareAutoCast = !!state?.autoCast;
    // A share token drops zero-valued fields, so a stats comparison can arrive without
    // some of its keys; restore them as the explicit 0 they were.
    if (this.isCompareStats) copyStatsFields(this.model2, this.model2);
    else this.statsSide = 'main';
    this.isEnableCompare = names.length > 0 || this.isCompareStats || this.isCompareAutoCast;
    this.updateAvailablePoints();
    this.equipRevision += 1;
    this.updateCompareEvent.next(1);
  }

  /** Display label for a class id, for the preview cards / save name prefill. */
  classLabel(classId: number): string {
    return Characters.find((c) => c.value === classId)?.label ?? '';
  }

  openSaveDialog(): void {
    const label = this.classLabel(this.model.class) || 'Simulação';
    this.saveName = `${label} Nv ${this.model.level}`;
    this.showSaveDialog = true;
  }

  async confirmSave(): Promise<void> {
    const name = (this.saveName || '').trim();
    if (!name) {
      this.messageService.add({ severity: 'warn', summary: 'Nome obrigatório', detail: 'Dê um nome à simulação.' });
      return;
    }
    if (this.savedSimStore.nameExists(name)) {
      const ok = await this.waitConfirm(`Já existe uma simulação chamada "${name}". Substituir?`);
      if (!ok) return;
    }
    // Cache the build's PVP defensive profile from the already-solved calculator
    // so it can be picked as an enemy target without re-solving (docs/pvp.md §3).
    let targetProfile: PlayerTargetProfile | undefined;
    try {
      targetProfile = this.calculator.getAsPlayerTarget(name);
    } catch (err) {
      console.error('Falha ao computar o perfil de alvo PVP', err);
    }
    const preset = this.currentPreset();
    this.savedSimStore.upsert(name, preset, targetProfile, this.currentCompareState(),
      customDefinitionsForBuild([preset, this.currentCompareState()?.model2 ?? {}], this.items));
    this.refreshPvpTargets();
    this.showSaveDialog = false;
    this.messageService.add({ severity: 'success', summary: 'Simulação salva', detail: name });
  }

  openSavesDialog(): void {
    this.savedSims = this.savedSimStore.list();
    this.showSavesDialog = true;
  }

  async loadSavedSim(sim: SavedSimulation): Promise<void> {
    const ok = await this.waitConfirm('Isso vai substituir a simulação atual. Continuar?');
    if (!ok) return;
    this.lifetime.watch(this.loadItemSet(sim.preset), {
      complete: () => {
        // Restore (or clear) the comparison the sim was saved with.
        this.restoreCompareState(sim.compare ?? null);
        this.showSavesDialog = false;
        this.onBaseStatusChange();
        this.messageService.add({ severity: 'success', summary: 'Simulação carregada', detail: sim.name });
      },
      error: (err) => {
        console.error(err);
        this.messageService.add({ severity: 'error', summary: 'Falha ao carregar', detail: 'Erro ao aplicar a simulação.' });
      },
    }, () => this.publish());
  }

  async deleteSavedSim(sim: SavedSimulation, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.waitConfirm(`Excluir a simulação "${sim.name}"?`);
    if (!ok) return;
    this.savedSimStore.remove(sim.id);
    this.savedSims = this.savedSimStore.list();
    // Keep the PVP target list in sync — refreshPvpTargets clears the selection
    // and the HUD if the deleted sim was the current target.
    this.refreshPvpTargets();
    this.messageService.add({ severity: 'info', summary: 'Simulação excluída', detail: sim.name });
  }

  /**
   * Empties every field and starts over, after a confirmation.
   *
   * Two buttons reach it: "Nova simulação" inside the Simulações dialog and "Limpar" in
   * the band, which is the same reset made findable from the page itself. Closing the
   * dialog is left in for both — the flag is already false for the band's entry point,
   * and a second write to it costs nothing.
   */
  private async resetBuild(summary: string, detail: string): Promise<void> {
    const ok = await this.waitConfirm('Isso vai limpar a simulação atual e começar do zero. Continuar?');
    if (!ok) return;
    this.lifetime.watch(this.loadItemSet(createMainModel() as any), {
      complete: () => {
        this.restoreCompareState(null);
        this.showSavesDialog = false;
        this.onBaseStatusChange();
        this.messageService.add({ severity: 'success', summary, detail });
      },
    }, () => this.publish());
  }

  newSimulation(): Promise<void> {
    return this.resetBuild('Nova simulação', 'Tudo foi limpo.');
  }

  clearAll(): Promise<void> {
    return this.resetBuild('Simulação limpa', 'Todos os campos voltaram ao padrão.');
  }

  // --- PVP ------------------------------------------------------------------
  /** Every saved sim is a possible PVP target. Ones saved before profiles were
   *  cached get their profile solved on demand when selected (buildProfileFromPreset). */
  refreshPvpTargets(): void {
    this.pvpTargets = this.savedSimStore.list();
    if (this.selectedPvpTargetId && !this.pvpTargets.some((t) => t.id === this.selectedPvpTargetId)) {
      this.selectedPvpTargetId = null;
      this.pvpSummary = null;
      this.pvpSummary2 = null;
      this.rotationViewPvp2 = null;
    }
  }

  /** Solve an old saved sim on demand to produce its PVP target profile (for sims
   *  saved before profiles were cached). Mirrors prepare()'s non-compare solve,
   *  but for the preset's OWN class/build on the throwaway calculatorPvp — so the
   *  main build is untouched. Returns null if the class/build can't be resolved. */
  private buildProfileFromPreset(sim: SavedSimulation): PlayerTargetProfile | null {
    try {
      const classInstance = Characters.find((c) => c.value === Number(sim.preset.class))?.['instant'] as CharacterBase;
      if (!classInstance) return null;
      const model = { ...createMainModel(), ...sim.preset } as any;
      const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = classInstance
        .setLearnSkills({ activeSkillIds: model.activeSkills ?? [], passiveSkillIds: model.passiveSkills ?? [] })
        .getSkillBonusAndName();
      const hasWeapon = !!(model.weapon || model.leftWeapon);
      const equippedAtks = withoutWeaponlessTalismans(equipAtks, hasWeapon);
      const { scripts: consumeData, usedHpL } = collectConsumables(model, this.items);
      const { aspdPotion, buffBonuses } = applyGuaranaCandy({
        consumables: model.consumables,
        aspdPotion: model.aspdPotion,
        buffDefs: this.skillBuffs,
        selectedBuffValues: model.skillBuffs,
        activeSkillNames,
        buffBonuses: collectBuffBonuses(this.skillBuffs, model.skillBuffs, activeSkillNames, hasWeapon),
      });
      const { equipAtk: buffEquips, masteryAtk: buffMasterys } = buffBonuses;
      model.rawOptionTxts = toRawOptionTxtList(model, this.items);
      this.calculatorPvp.setClass(classInstance).loadItemFromModel(model);
      this.controller.runChain(this.calculatorPvp, {
        monster: this.selectedMonsterModel,
        relieveLevel: this.relieveLevel,
        equipAtks: equippedAtks, masteryAtks, buffEquips, buffMasterys, consumeData, aspdPotion,
        extraOptionScripts: parseOptionScripts([...model.rawOptionTxts, ...customOptionScripts(model)]),
        activeSkillNames, learnedSkillMap,
        selectedAtkSkill: model.selectedAtkSkill, selectedChances: [], usedHpL,
      });
      // Capture the target's own defender-side sources + slot→id map so the HUD
      // reduction drill-down lists and names the OPPONENT's gear.
      this.pvpTargetSources = this.pickDefenderSources(this.calculatorPvp.getItemSummary());
      this.pvpTargetItemMap = new Map<string, number>();
      for (const slot of Object.values(ItemTypeEnum)) {
        const id = (model as any)[slot];
        if (typeof id === 'number' && id > 0) this.pvpTargetItemMap.set(slot, id);
      }
      return this.calculatorPvp.getAsPlayerTarget(sim.name);
    } catch (err) {
      console.error('Falha ao solver o alvo PVP', err);
      this.pvpTargetSources = {};
      this.pvpTargetItemMap = new Map<string, number>();
      return null;
    }
  }

  get selectedPvpTarget(): SavedSimulation | undefined {
    return this.pvpTargets.find((t) => t.id === this.selectedPvpTargetId);
  }

  /** Paper-doll URL for the selected PVP target (its saved build's appearance). */
  get pvpTargetSpriteUrl(): string | null {
    const t = this.selectedPvpTarget;
    return t ? this.charSpriteUrl(t.preset) : null;
  }

  /** Bare-job fallback if the composed target paper-doll fails to load. */
  get pvpTargetFallbackSprite(): string | null {
    const t = this.selectedPvpTarget;
    return t ? bareJobSprite(t.classId) : null;
  }

  /** Recompute the PVP damage for the current attacker build vs the selected
   *  target + mode. Uses a dedicated calculator so the main build is untouched. */
  calculatePvp(): void {
    const sim = this.selectedPvpTarget;
    if (!sim) {
      this.pvpSummary = null;
      this.pvpSummary2 = null;
      this.rotationViewPvp2 = null;
      this.targetReductionCategories = [];
      return;
    }
    // Solve the target build once per selected target — even when a cached profile
    // exists — so we capture its per-item bonus sources (pvpTargetSources) for the
    // reduction popover's drill-down. On attacker-only changes (same target) this is
    // skipped. buildProfileFromPreset caches pvpTargetSources as a side effect.
    let profile = sim.targetProfile;
    if (this.pvpTargetSourcesId !== sim.id || !profile) {
      const solved = this.buildProfileFromPreset(sim);
      this.pvpTargetSourcesId = sim.id;
      if (solved && !profile) {
        // Old sim without a cached profile — persist it WITHOUT re-timestamping.
        this.savedSimStore.setTargetProfile(sim.id, solved);
        sim.targetProfile = solved;
        profile = solved;
      }
      if (!solved) this.pvpTargetSources = {};
    }
    if (!profile) {
      this.pvpSummary = null;
      this.pvpSummary2 = null;
      this.rotationViewPvp2 = null;
      this.targetReductionCategories = [];
      this.messageService.add({ severity: 'warn', summary: 'Não foi possível carregar o alvo', detail: 'Abra essa simulação e salve de novo.' });
      return;
    }
    this.targetReductionCategories = buildReductionCategories(profile.defenderBonus, this.pvpMode);
    // buildProfileFromPreset above may have left the shared class instance /
    // calculatorPvp in the target's state — prepare() re-sets both to the attacker.
    const calc = this.prepare(this.calculatorPvp, undefined, profile, this.pvpMode);
    this.pvpSummary = calc.getTotalSummary();
    // The PVP panel reads the same rotation, solved against the player target.
    this.rotationViewPvp = this.lastChainInput ? this.solveRotation(calc, this.lastChainInput, this.pvpSummary) : null;

    // The compared build against the same target, exactly as calcCompare() does it for
    // the monster panel. Solved after the main pass so each rotation reads the chain
    // input its own prepare() produced — including that build's own Efeitos.
    if (this.isEnableCompare && (this.compareItemNames?.length > 0 || this.isCompareStats)) {
      // Guarded like buildProfileFromPreset: this runs inside the compare pipeline's
      // subscriber, whose last statement clears the loading overlay. An exception here
      // would skip that AND kill the subscription — the panel would sit on the spinner
      // for good and the comparison control would stop responding. A failed compare pass
      // costs the "→ simulado" column; it must never cost the app.
      try {
        const m2 = JSON.parse(JSON.stringify(this.model2));
        const calc2 = this.prepare(this.calculatorPvp2, m2, profile, this.pvpMode);
        this.pvpSummary2 = calc2.getTotalSummary();
        this.rotationViewPvp2 = this.lastChainInput ? this.solveRotation(calc2, this.lastChainInput, this.pvpSummary2) : null;
      } catch (err) {
        console.error('Falha ao solver a comparação no PVP', err);
        this.pvpSummary2 = null;
        this.rotationViewPvp2 = null;
      }
    } else {
      this.pvpSummary2 = null;
      this.rotationViewPvp2 = null;
    }
  }

  openShareDialog(): void {
    this.shareUrl = this.buildShareUrl();
    this.showShareDialog = true;
    void this.shortenShareUrl();
  }

  /** Swap the embedded-build URL for a short link; keep the long URL if the shortener is unreachable. */
  private async shortenShareUrl(): Promise<void> {
    const longUrl = this.shareUrl;
    this.shareShortening = true;
    try {
      // Only swap if the dialog still shows the URL we shortened (it may have been reopened with a new build).
      const shortUrl = await shortenUrl(longUrl, environment.shortenerUrl);
      if (this.shareUrl === longUrl) this.shareUrl = shortUrl;
    } finally {
      this.shareShortening = false;
      this.publish();
    }
  }

  async copyShareUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl);
      this.messageService.add({ severity: 'success', summary: 'Link copiado', detail: 'Cole para compartilhar a simulação.' });
    } catch (error) {
      console.error(error);
      this.messageService.add({ severity: 'warn', summary: 'Copie manualmente', detail: 'Selecione o link e copie.' });
    }
  }

  /** Full paper-doll URL (job + equipped headgears/garment) for a saved-sim card. */
  charSpriteUrl(preset: PresetModel): string {
    return buildCharSpriteUrl(preset as unknown as Record<string, any>, this.itemViews);
  }

  /** (error) handler for the paper-doll <img>: degrade to the bare job sprite, then hide. */
  onCharSpriteError(event: Event, classId: number): void {
    const img = event.target as HTMLImageElement;
    const fallback = bareJobSprite(classId);
    if (fallback && img.src !== fallback) img.src = fallback;
    else img.style.visibility = 'hidden';
  }

  private buildShareUrl(): string {
    // Drop a rotation that is just [selectedAtkSkill]: decoding rebuilds it, so a
    // single-skill build's token stays exactly what it was before rotations existed.
    const preset = compactRotationForShare(this.currentPreset() as unknown as Record<string, any>);
    const definitions = customDefinitionsForBuild([preset, this.currentCompareState()?.model2 ?? {}], this.items);
    const token = encodeBuild(preset, this.currentCompareState(), definitions);
    // A real path, not a #fragment: the fragment never reaches a server, so no crawler
    // could tell one shared build from another and every preview looked the same.
    // `origin` alone, never `pathname` — opening the dialog while already on a share
    // path would otherwise nest one token inside another.
    return `${window.location.origin}${buildSharePath(token)}`;
  }

  /** Read & consume a shared build from the URL — the canonical /s/<token>/ path or
   *  the legacy ?b=... query — then clean the URL so a refresh/copy doesn't re-apply
   *  or leak the token. `readShareToken` reads it raw, never via URLSearchParams. */
  private consumeSharedBuild(): { preset: PresetModel; compare: CompareState | null; items: CustomItemDefinition[] } | null {
    try {
      // The URL the page was opened with — not the live one, which the router has
      // already rewritten to '#/' by now (see share-entry.ts).
      const token = readShareToken(shareEntryHref());
      if (!token) return null;
      const shared = decodeShared(token);
      this.stripSharedBuildFromUrl();
      if (!shared) return null;
      return { preset: shared.preset as PresetModel, compare: shared.compare, items: shared.items ?? [] };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private stripSharedBuildFromUrl(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('b');
      let hash = url.hash;
      if (hash.includes('?')) {
        const path = hash.slice(0, hash.indexOf('?'));
        const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));
        params.delete('b');
        const rest = params.toString();
        hash = rest ? `${path}?${rest}` : path;
      }
      url.hash = hash;
      // A /s/<token>/ link is a share entry point, not a route: once the build is
      // loaded the address bar should read like any other visit, so the token can't
      // be re-applied over edits by a refresh.
      if (url.pathname.startsWith(SHARE_PATH_PREFIX)) url.pathname = '/';
      // Keep whatever state the router put there. Replacing it with null drops
      // Angular's navigationId, which scrollPositionRestoration then reads back.
      window.history.replaceState(window.history.state, '', url.toString());
    } catch (error) {
      console.error(error);
    }
  }

  // --- Import build from a Ragnarok replay (.rrf) -------------------------
  openReplayImport() {
    this.showReplayImport = true;
  }

  onReplayDragOver(event: DragEvent) {
    event.preventDefault();
    this.replayDragOver = true;
  }

  onReplayDragLeave(event: DragEvent) {
    event.preventDefault();
    this.replayDragOver = false;
  }

  onReplayDrop(event: DragEvent) {
    event.preventDefault();
    this.replayDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.importReplay(file);
  }

  onReplayInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.importReplay(file);
    input.value = ''; // allow re-picking the same file
  }

  /**
   * Map a replay's learned skill tree (client skill id → level) onto the model's
   * skill panels. Keyed by skill name through the LATAM skill map (name → id), so
   * only skills the calculator knows about are set; the rest stay at 0.
   * setSkillModelArray() (run inside loadItemSet) applies these maps to the actual
   * dropdowns, which is what produces the passive-skill stat bonuses.
   */
  private applyLearnedSkills(model: MainModel, learnedSkills: Record<number, number>, activeStatuses: number[] = []) {
    const char = this.characterList.find((c) => c.value === model.class)?.['instant'] as CharacterBase | undefined;
    if (!char) return;

    // A buff/effect skill is only imported if its EFST status was actually up
    // during the replay — learning it doesn't switch it on. Unmapped skills (whose
    // active state we can't confirm) are skipped too.
    const gate = makeBuffGate(activeStatuses);

    // Resolve the dropdown value that represents a given learned level. Most
    // skills use the level as the value; the skillLv/closest fallbacks cover the
    // few whose option values aren't the plain level (toggles, bonus amounts).
    const pick = (dropdown: SkillModel[] = [], level: number): number => {
      if (!level) return 0;
      const byLv = dropdown.find((o) => o.skillLv === level);
      if (byLv) return byLv.value;
      const byVal = dropdown.find((o) => o.value === level);
      if (byVal) return byVal.value;
      const ranked = dropdown
        .filter((o) => o.isUse !== false)
        .map((o) => ({ value: o.value, lv: o.skillLv ?? o.value }))
        .filter((o) => typeof o.lv === 'number' && o.lv <= level)
        .sort((a, b) => b.lv - a.lv);
      return ranked.length ? ranked[0].value : 0;
    };

    // `gate` (when given) blocks a skill unless its buff was actually up in the
    // replay. The passive "Aprenda para ganhar bônus" list is NOT gated: those
    // entries just carry the *learned* level (e.g. endow feeds learnLv('Frost
    // Weapon') into damage formulas), which applies whether or not the buff was up.
    const build = (skills: { name: string; dropdown: SkillModel[] }[], gate?: (name: string) => boolean) => {
      const out: Record<string, number> = {};
      for (const s of skills) {
        const id = SKILL_ID_BY_NAME[s.name];
        const level = id ? learnedSkills[id] : 0;
        if (!level) continue;
        if (gate && !gate(s.name)) continue;
        const value = pick(s.dropdown, level);
        if (value) out[s.name] = value;
      }
      return out;
    };

    model.passiveSkillMap = { ...model.passiveSkillMap, ...build(char.passiveSkills) };
    model.activeSkillMap = { ...model.activeSkillMap, ...build(char.activeSkills, gate) };
    model.skillBuffMap = { ...model.skillBuffMap, ...build(this.skillBuffs, gate) };
  }

  async importReplay(file: File) {
    if (this.replayBusy) return;
    this.replayBusy = true;
    let imported: PendingImport;
    try {
      const buf = await file.arrayBuffer();
      if (!this.lifetime.active) return;
      const { model, summary, learnedSkills, activeStatuses } = importReplayBuffer(buf, this.items);
      // The replay carries the real sprite/job id (e.g. 4073 Royal Guard); the
      // calc models classes by internal id (11), so translate it back so the
      // class dropdown + icon select the right class.
      model.class = ClassIdBySpriteJob[model.class] ?? model.class;
      imported = { source: 'replay', model, summary, learnedSkills, activeStatuses };
    } catch (e) {
      this.replayBusy = false;
      console.error(e);
      this.messageService.add({ severity: 'error', summary: 'Arquivo inválido', detail: 'Não foi possível ler o arquivo .rrf.' });
      return;
    }
    await this.offerImport(imported);
  }

  /** Import from the dialog's link field: a share URL, a short link or a bare token. */
  async importShareLink() {
    if (this.replayBusy) return;
    const input = parseShareInput(this.importLinkText, environment.shortenerUrl);
    if (!input) {
      this.messageService.add({ severity: 'error', summary: 'Link inválido', detail: 'Cole um link de simulação do simulador.' });
      return;
    }

    this.replayBusy = true;
    let token: string | null = input.kind === 'token' ? input.token : null;
    if (input.kind === 'short') {
      try {
        const res = await fetch(`${environment.shortenerUrl}/api/links/${encodeURIComponent(input.slug)}`);
        if (res.ok) {
          const { url } = await res.json();
          const resolved = parseShareInput(url, environment.shortenerUrl);
          token = resolved?.kind === 'token' ? resolved.token : null;
        }
      } catch (e) {
        console.error(e);
      }
      if (!token) {
        this.replayBusy = false;
        this.messageService.add({ severity: 'error', summary: 'Link curto não encontrado', detail: 'Não foi possível abrir este link curto.' });
        return;
      }
    }

    // The link's own comparison, if it carries one, is not imported: the build is.
    const preset = decodeShared(token)?.preset;
    if (!preset) {
      this.replayBusy = false;
      this.messageService.add({ severity: 'error', summary: 'Link inválido', detail: 'O link não contém uma simulação válida.' });
      return;
    }
    await this.offerImport({ source: 'link', model: normalizeSavedModel(preset), preset });
  }

  /**
   * The step shared by both import sources: check the class, ask how to apply the
   * build, and apply it.
   */
  private async offerImport(imported: PendingImport) {
    const { model } = imported;
    // The calculator only carries the advanced LATAM classes; bail out cleanly
    // (keeping the current build) if the build's class isn't one of them.
    if (!this.characterList?.some((c) => c.value === model.class)) {
      this.replayBusy = false;
      const who = imported.source === 'replay' ? `${imported.summary.player || 'personagem'}, ` : '';
      this.messageService.add({
        severity: 'warn',
        summary: 'Classe indisponível',
        detail: `A classe desta build (${who}job ${model.class}) não está disponível na calculadora.`,
        life: 7000,
      });
      return;
    }

    const mode = await this.chooseImportMode(imported);
    if (!this.lifetime.active) return;
    if (!mode) {
      this.replayBusy = false;
      return;
    }
    if (mode === 'compare') {
      this.applyImportAsComparison(imported);
    } else if (imported.source === 'replay') {
      this.applyReplayImport(imported);
    } else {
      this.applyLinkImport(imported);
    }
  }

  /** Swap the dialog to its choice step and wait for a button. `null` means cancelled. */
  private chooseImportMode(imported: PendingImport): Promise<ImportMode | null> {
    this.resolvePendingImport?.(null);
    this.pendingImport = imported;
    this.showReplayImport = true;
    this.publish();
    return new Promise((resolve) => {
      this.resolvePendingImport = (mode) => {
        this.resolvePendingImport = null;
        this.pendingImport = null;
        resolve(mode);
      };
    });
  }

  /** Whether the pending import may become a comparison: only a build of the class on screen. */
  get canImportAsComparison(): boolean {
    return !!this.pendingImport && this.pendingImport.model.class === this.model.class;
  }

  get pendingImportClassLabel(): string {
    return this.pendingImport ? this.classLabel(this.pendingImport.model.class) : '';
  }

  get pendingImportEquipCount(): number {
    if (!this.pendingImport) return 0;
    const m = this.pendingImport.model as unknown as Record<string, any>;
    return this.compareItemList.filter((slot) => !!m[slot]).length;
  }

  pickImportMode(mode: ImportMode | null) {
    this.resolvePendingImport?.(mode);
  }

  /** Closing the dialog while a build waits for a choice is a cancel. */
  onImportDialogHide() {
    this.resolvePendingImport?.(null);
    this.importLinkText = '';
  }

  private applyImportAsComparison(imported: PendingImport) {
    const state = buildComparisonFromImport(imported.model, this.compareSlotsForClass());
    this.restoreCompareState(state);
    this.statsSide = 'main';
    this.replayBusy = false;
    this.showReplayImport = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Importado como comparação',
      detail:
        `${this.importSourceLabel(imported)}: equipamentos, nível, atributos e talentos entraram como comparação. ` +
        'Habilidades e buffs continuam os da simulação atual.',
      life: 9000,
    });
  }

  private importSourceLabel(imported: PendingImport): string {
    if (imported.source === 'replay') return imported.summary.player || 'Replay';
    return 'Link';
  }

  private applyLinkImport(imported: PendingImport) {
    this.lifetime.watch(this.loadItemSet(imported.preset as any), {
      complete: () => {
        this.restoreCompareState(null);
        this.replayBusy = false;
        this.showReplayImport = false;
        this.messageService.add({ severity: 'success', summary: 'Link importado', detail: 'A simulação do link substituiu a atual.', life: 6000 });
      },
      error: (err) => {
        this.replayBusy = false;
        console.error(err);
        this.messageService.add({ severity: 'error', summary: 'Falha ao importar', detail: 'Erro ao aplicar o link.' });
      },
    }, () => this.publish());
  }

  private applyReplayImport(imported: PendingImport) {
    const { model, summary, learnedSkills, activeStatuses } = imported;
    try {
      // Map the replay's learned skill tree onto the model's skill panels before
      // loadItemSet — setSkillModelArray() (run inside it) applies these maps.
      this.applyLearnedSkills(model, learnedSkills, activeStatuses);
      this.lifetime.watch(this.loadItemSet(model as any), {
        complete: () => {
          // Switching to a class with a different level range can leave the
          // level/job dropdowns holding a momentarily out-of-range value; re-assert
          // the replay's levels and recompute once everything has settled.
          if (summary.baseLevel) this.model.level = summary.baseLevel;
          if (summary.jobLevel) this.model.jobLevel = summary.jobLevel;
          this.onBaseStatusChange();
          this.replayBusy = false;
          this.showReplayImport = false;
          const skipped = summary.skippedItems.length;
          const detail =
            `${summary.player || 'Personagem'} — nível ${summary.baseLevel}, ${summary.equippedCount} equipamentos` +
            (summary.appliedOptions ? `, ${summary.appliedOptions} bônus aleatórios` : '') +
            (summary.learnedSkillCount ? `, ${summary.learnedSkillCount} habilidades` : '') +
            (summary.traits ? ', talentos' : '') +
            (skipped ? `, ${skipped} ignorado(s) (fora do banco de dados)` : '') + '.';
          this.messageService.add({ severity: 'success', summary: 'Replay importado', detail, life: 9000 });
          // The traits ride on a packet the server only sends on a map load, so a
          // recording that never changed map arrives without them — say so, and only
          // then. On a class that has no traits at all there is nothing to warn about.
          if (!summary.traits && this.isAllowTraitStat) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Talentos',
              detail:
                '⚠️ Esta gravação não trouxe os talentos (POD/STA/SAB/FEI/CON/CRV) — ajuste-os manualmente. ' +
                'Eles só entram no arquivo quando o personagem troca de mapa durante a gravação.',
              life: 9000,
            });
          }
        },
        error: (err) => {
          this.replayBusy = false;
          console.error(err);
          this.messageService.add({ severity: 'error', summary: 'Falha ao importar', detail: 'Erro ao aplicar o replay.' });
        },
      }, () => this.publish());
    } catch (e) {
      this.replayBusy = false;
      console.error(e);
      this.messageService.add({ severity: 'error', summary: 'Falha ao importar', detail: 'Erro ao aplicar o replay.' });
    }
  }

  private resetItemDescription() {
    const map = new Map<ItemTypeEnum, number>();

    for (const [itemType, relations] of Object.entries(MainItemWithRelations)) {
      const itemId = this.equipItemMap.get(itemType as any);
      if (itemId) {
        map.set(itemType as any, itemId);
      }

      for (const itemType2 of relations) {
        const itemId = this.equipItemMap.get(itemType2 as any);
        if (itemId) {
          map.set(itemType2 as any, itemId);
        }
      }
    }

    this.equipItemIdItemTypeMap = map;
    this.equipItems = this.buildEquipItemList(map, this.model);

    if (!map.has(this.selectedItemDesc)) {
      this.selectedItemDesc = undefined;
    }
  }

  private buildEquipItemList(itemMap: Map<ItemTypeEnum, number>, model: typeof this.model | typeof this.model2) {
    const customRelations = new Set(Object.entries(MainItemWithRelations)
      .filter(([slot]) => isCustomItem(this.items[model[slot]]))
      .flatMap(([, relations]) => relations));
    const entries = [...itemMap.entries()];
    const list: DropdownModel[] = [];
    // Keep the selection lookup in sync with the visible rows, including custom sockets.
    itemMap.clear();
    const append = (itemType: ItemTypeEnum, id: number, label = this.items[id]?.name) => {
      if (!this.items[id]) return;
      itemMap.set(itemType, id);
      list.push({ label, value: itemType, id });
    };

    for (const [itemType, id] of entries) {
      if (!this.items[id] || !model[itemType] || customRelations.has(itemType)) continue;
      const grade = model[`${itemType}Grade`];
      const prefixGrade = grade && typeof grade === 'string' ? ` [${grade}] ` : '';

      const refine = model[`${itemType}Refine`];
      const prefixRefine = refine && refine > 0 ? ` +${refine} ` : '';

      append(itemType, id, `${prefixRefine}${prefixGrade}${this.items[id].name}`);
      if (!isCustomItem(this.items[id])) continue;

      const attachments = ensureCustomAttachment(model, itemType, this.items[id]);
      // Match Calculator.loadItemFromModel so selecting a socket resolves its bonuses.
      attachments.cards.forEach((cardId, index) => append(`${itemType}CustomCard${index + 1}` as ItemTypeEnum, cardId));
      attachments.enchants.forEach((enchantId, index) => append(`${itemType}CustomEnchant${index + 1}` as ItemTypeEnum, enchantId));
    }
    return list;
  }

  /** pt-BR label of the currently selected class (same lookup as the class picker),
   *  used for the item-search dialog title. Falls back to '' before a class is set. */
  get selectedClassLabel(): string {
    return Characters.find((a) => a.value === this.model.class)?.label ?? '';
  }

  /** The class instance behind a picker id, falling back to the first class in the list. */
  private classInstanceOf(classId: number): CharacterBase {
    return Characters.find((a) => a.value === classId)?.instant ?? Characters[0].instant;
  }

  private setClassInstant() {
    this.selectedCharacter = this.classInstanceOf(this.model.class);
    this.loadedClassId = this.model.class;
    this.calculator.setClass(this.selectedCharacter);
    this.isAllowTraitStat = this.selectedCharacter.isAllowTraitStat();
    this.mainStatusList = createNumberDropdownList({ from: 1, to: this.selectedCharacter.maxBaseStat });
    this.isAllowLeftWeaponByClass = AllowLeftWeaponMapper[this.selectedCharacter.className] || false;
  }

  /**
   * The slots a comparison may hold for the current class. Only the Assassin and the
   * Kagerou/Oboro lines put a weapon in the off hand (see AllowLeftWeaponMapper for the
   * bROWiki wording), so for everyone else that card never appears and a comparison on it
   * would be counted without ever being shown.
   */
  private compareSlotsForClass(): (keyof typeof ItemTypeEnum)[] {
    return this.compareItemList.filter((slot) => (slot as string) !== ItemTypeEnum.leftWeapon || this.isAllowLeftWeaponByClass);
  }

  /** Resolve a calc skill name to its LATAM { id, pt-BR name } from the static
   *  Skill Catalog (src/app/skills). Names without an in-game id (internal markers
   *  / skills missing from the client map) return undefined and keep their English
   *  label with no icon, matching the previous behavior. */
  private resolveSkill(name: string): { id: number; name: string; iconType?: 'item' | 'skill' } | undefined {
    const meta = resolveSkillMeta(name);
    if (!meta || meta.id === undefined) return undefined;
    return { id: meta.id, name: meta.label ?? name, iconType: meta.iconType };
  }

  private setClassSkill() {
    if (!this.showPreviews) {
      this.model.skillFormulaVersion = 'current';
      // Keep positional skill arrays intact; hidden buffs must not affect LATAM damage.
      for (const [definitions, values, map] of [
        [this.selectedCharacter.activeSkills, this.model.activeSkills, this.model.activeSkillMap],
        [this.selectedCharacter.passiveSkills, this.model.passiveSkills, this.model.passiveSkillMap],
        [JobBuffs, this.model.skillBuffs, this.model.skillBuffMap],
      ] as const) {
        definitions.forEach((skill, index) => {
          if (!(skill as ActiveSkillModel).preview) return;
          if (values) values[index] = 0;
          if (map) map[skill.name] = 0;
        });
      }
    }
    // Overlay pt-BR skill names + ragassets skill-icon id (from the GRF skill map)
    // on every skill panel. Skills missing from the map keep their English label
    // and render no icon (the template guards on `icon`).
    const localize = <T extends { name: string }>(skill: T) => {
      const pt = this.resolveSkill(skill.name);
      const base = pt ? { ...skill, label: (skill as any).preview && !(skill as any).labelSuffix ? (skill as any).label : pt.name, icon: pt.id, iconType: pt.iconType } : skill;
      // A skill whose level-list entries are really *other* skills (Fist Spell
      // casts Fire/Cold/Lightning Bolt) exposes a `treatedAsSkillNameFn`. Relabel
      // each entry with the underlying bolt's pt-BR name + icon so the picker drops
      // the repeated parent prefix ("Punho Arcano ... (Lanças de Fogo)" -> "Lanças de Fogo").
      const treatedFn = (skill as any).treatedAsSkillNameFn;
      const levelList = (skill as any).levelList;
      if (typeof treatedFn === 'function' && Array.isArray(levelList)) {
        return {
          ...base,
          levelList: levelList.map((entry: { label: string; value: string }) => {
            const treatedName = treatedFn(entry.value)?.split('==')[0];
            const ptEntry = treatedName ? this.resolveSkill(treatedName) : undefined;
            return ptEntry ? { ...entry, label: ptEntry.name, icon: ptEntry.id, iconType: ptEntry.iconType } : entry;
          }),
        };
      }
      // The level picker is a cascade: the chosen entry is what stays visible once it
      // closes, so it has to carry the skill name — in pt-BR, like the group above it.
      // The entries are written in English in the class ("Wild Fire Lv1"); here only the
      // prefix is swapped, preserving the rest of the label (e.g. Constelação's
      // "(1 estrela)").
      if (pt && Array.isArray(levelList)) {
        return {
          ...base,
          levelList: levelList.map((entry: { label: string; value: string }) =>
            entry.label.startsWith(skill.name) ? { ...entry, label: pt.name + entry.label.slice(skill.name.length) } : entry,
          ),
        };
      }
      return base;
    };
    // Buffs keep their curated (already pt-BR) labels — only attach the icon id.
    // A buff may pin its own `icon` (e.g. a generic buff that shouldn't use the
    // skill-map icon); that explicit id wins over the resolved one.
    const attachIcon = <T extends { name: string; icon?: number }>(skill: T) => {
      const pt = this.resolveSkill(skill.name);
      return pt ? { ...skill, icon: skill.icon ?? pt.id } : skill;
    };
    this.skillBuffs = JobBuffs.map(attachIcon);
    this.activeSkills = this.selectedCharacter.activeSkills.map(localize);
    this.passiveSkills = this.selectedCharacter.passiveSkills.map(localize);
    // Atk skills can repeat the same name with different fixed properties (e.g. Adoramus
    // cast as Holy vs Neutral). After localizing the bare skill name, disambiguate any
    // repeated name by appending its element, so the picker reads "Adoramus - Sagrado".
    const catalog = this.selectedCharacter.getAtkSkills(this.model.skillFormulaVersion).filter(skill => this.isSkillVisible(skill));
    const localizedAtkSkills = catalog.map(localize);
    const seenLabel = new Set<string>();
    const dupLabels = new Set<string>();
    for (const s of localizedAtkSkills) {
      if (seenLabel.has(s.label)) dupLabels.add(s.label);
      seenLabel.add(s.label);
    }
    this.atkSkills = localizedAtkSkills.map((s) => {
      // An explicit labelSuffix always wins — it disambiguates same-name/same-element
      // variants (e.g. a ground skill's Inicial burst vs its Contínuo field) that the
      // element-based fallback below can't tell apart.
      if ((s as any).labelSuffix) return { ...s, label: `${s.label} (${(s as any).labelSuffix})` };
      return dupLabels.has(s.label) && s.element ? { ...s, label: `${s.label} - ${elementPtBr(s.element)}` } : s;
    });
    // Utility entries (Esconderijo, Infiltrar) exist for the rotation only: the old
    // single-skill panel asks "how much does this skill hit for", which they never answer.
    this.offensiveSkills = [...new Set(catalog.filter(isOffensiveSkill).map((a) => a.name)).values()].map((name) => {
      const pt = this.resolveSkill(name);
      return { label: (pt?.name ?? name) + (catalog.some(s => s.name === name && s.preview) ? ' (Prévia)' : ''), value: name, icon: pt?.id };
    });
    this.isShowSelectableSkillLevel = catalog.some((a) => a.levelList?.length > 0);
  }

  private setClassMinMaxLvl() {
    const {
      minMaxLevel: [min, max],
      maxJob,
    } = this.selectedCharacter.minMaxLevelCap;

    this.levelList = createNumberDropdownList({ from: min, to: max });
    this.jobList = createNumberDropdownList({ from: 1, to: maxJob, excludingNumbers: this.selectedCharacter.excludedJobLevels });
  }

  private setClassLvl(params: { currentLvl: number; currentJob: number; isSetMinLevel?: boolean; }) {
    const { currentJob, currentLvl, isSetMinLevel = false } = params;
    const {
      minMaxLevel: [min],
    } = this.selectedCharacter.minMaxLevelCap;

    this.model.level = isSetMinLevel ? min : currentLvl;
    this.model.jobLevel = isSetMinLevel ? 1 : currentJob;

    normalizeClassLimits(this.model, this.selectedCharacter);
  }

  private setDefaultSkill(selectedSkill?: string) {
    const fallbackAtkSkill = defaultAtkSkill(this.atkSkills);
    const selectedAtkSkill = this.model.selectedAtkSkill || selectedSkill;
    if (!selectedAtkSkill) {
      this.model.selectedAtkSkill = fallbackAtkSkill;
      return;
    }

    const selectedValidSkill = this.atkSkills.find((a) => a.value === selectedAtkSkill || (Array.isArray(a.values) && a.values?.includes(selectedAtkSkill)));
    const selectedValidSkill2 = this.atkSkills.find(
      (a) => Array.isArray(a.levelList) && a.levelList.length > 0 && a.levelList.find((lv) => lv.value === selectedAtkSkill),
    );
    if (selectedValidSkill?.value) {
      this.model.selectedAtkSkill = selectedValidSkill.value;
    } else if (selectedValidSkill2?.value) {
      this.model.selectedAtkSkill = selectedAtkSkill;
    } else {
      this.model.selectedAtkSkill = fallbackAtkSkill;
    }

    this.setDefaultRotation();
  }

  /**
   * Bring the rotation in line with the class that is now loaded: drop entries this
   * class cannot cast (a class switch, or a share link built on another class) and
   * reseed an empty one from the skill `setDefaultSkill` just settled on.
   *
   * Runs after `selectedAtkSkill` is validated, then hands authority back to the
   * rotation — from here on the mirror follows the rotation, not the other way round.
   */
  private setDefaultRotation() {
    const rotation = this.model.rotation ?? [];
    const keptIndices = rotation.flatMap((skill, index) =>
      pruneRotationForClass([skill], this.atkSkills).length ? [index] : []);
    this.model.rotation = keptIndices.map((index) => rotation[index]);
    if (this.model.rotationStacks) {
      this.model.rotationStacks = keptIndices.map((index) => this.model.rotationStacks[index]);
    }
    if (!this.model.rotation.length && this.model.selectedAtkSkill) {
      this.model.rotation = [this.model.selectedAtkSkill];
    }

    this.syncRotationMirror();
  }

  private setAspdPotionList() {
    this.aspdPotionList = AspdPotionList.filter(({ value }) => {
      switch (value) {
        case 645:
          return true;
        case 656:
          return true;
        case 657: {
          const usable = [
            ClassName.RuneKnight,
            ClassName.DragonKnight,
            ClassName.RoyalGuard,
            ClassName.ImperialGuard,
            ClassName.Genetic,
            ClassName.Biolo,
            ClassName.Mechanic,
            ClassName.Meister,
            ClassName.ShadowChaser,
            ClassName.AbyssChaser,
            ClassName.Warlock,
            ClassName.ArchMage,
            ClassName.Rebellion,
            ClassName.NightWatch,
            ClassName.SoulReaper,
            ClassName.SoulAscetic,
            ClassName.StarEmperor,
            ClassName.SkyEmperor,
          ];

          return usable.includes(this.selectedCharacter.className);
        }
      }

      return true;
    });

    // A build carried across a class switch can arrive holding a potion this class cannot
    // drink. The listbox would show nothing selected while the bonus still applied.
    if (this.model.aspdPotion && !this.aspdPotionList.some(({ value }) => value === this.model.aspdPotion)) {
      this.model.aspdPotion = undefined;
    }
  }

  private setSkillModelArray() {
    const { activeSkills, passiveSkills } = this.selectedCharacter;
    let { skillBuffMap, activeSkillMap, passiveSkillMap } = this.model;
    if (!skillBuffMap || typeof skillBuffMap !== 'object') skillBuffMap = {};
    if (!activeSkillMap || typeof activeSkillMap !== 'object') activeSkillMap = {};
    if (!passiveSkillMap || typeof passiveSkillMap !== 'object') passiveSkillMap = {};

    const isEqualBuffLenght = this.selectedCharacter.matchesSavedSkillCount('passive', this.model.passiveSkills?.length);
    const legacyInsignia = Number(skillBuffMap['_Sorcerer_Insignia_Target']);
    this.model.skillBuffs = this.skillBuffs.map((skill, i) => {
      const legacyIndex = /^_Sorcerer_Insignia_Target_(\d)$/.exec(skill.name)?.[1];
      const savedVal = skillBuffMap[skill.name]
        ?? (legacyIndex ? Number(legacyIndex) === legacyInsignia ? 1 : 0 : isEqualBuffLenght ? this.model.skillBuffs[i] : 0);
      const found = skill.dropdown.find((a) => a.value === savedVal);

      return found ? savedVal : 0;
    });

    const isEqualActiveLenght = this.selectedCharacter.matchesSavedSkillCount('active', this.model.activeSkills?.length);
    this.model.activeSkills = activeSkills.map((skill, i) => {
      const savedVal = activeSkillMap[skill.name] ?? (isEqualActiveLenght ? this.model.activeSkills[i] : 0);
      const found = skill.dropdown.find((a) => a.value === savedVal);

      return found ? savedVal : 0;
    });

    const isEqualPassiveLenght = this.selectedCharacter.matchesSavedSkillCount('passive', this.model.passiveSkills?.length);
    this.model.passiveSkills = passiveSkills.map((skill, i) => {
      const savedVal = passiveSkillMap[skill.name] ?? (isEqualPassiveLenght ? this.model.passiveSkills[i] : 0);
      const found = skill.dropdown.find((a) => a.value === savedVal);

      return found ? savedVal : 0;
    });
  }

  private setJobBonus() {
    this.applyJobBonus(this.model, this.model.jobLevel);
  }

  /** Write the class's job bonus for `jobLevel` into `target` (the main model or model2). */
  private applyJobBonus(target: Record<string, any>, jobLevel: number) {
    const { str, agi, vit, int, dex, luk, pow, sta, wis, spl, con, crt } = this.selectedCharacter.getJobBonusStatus(jobLevel);
    target['jobStr'] = str;
    target['jobAgi'] = agi;
    target['jobVit'] = vit;
    target['jobInt'] = int;
    target['jobDex'] = dex;
    target['jobLuk'] = luk;

    target['jobPow'] = pow;
    target['jobSta'] = sta;
    target['jobWis'] = wis;
    target['jobSpl'] = spl;
    target['jobCon'] = con;
    target['jobCrt'] = crt;
  }

  private setMonsterDropdownList() {
    const groupMap = new Map<string, MonsterSelectItemGroup>();
    const monsters: DropdownModel[] = [];
    const rawMonsters = Object.values(this.monsterDataMap).sort((a, b) => {
      // Sort by level, then by name with NATURAL numeric ordering so leveled
      // targets like "Miragem de Amdarais - Nível 1..10" read 1,2,…,10 instead
      // of the lexicographic 1,10,2,… (or the scrambled order the old
      // equal-level comparator produced).
      if (a.stats.level !== b.stats.level) return a.stats.level - b.stats.level;
      return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
    const classMap = {
      0: 'Normal',
      1: 'Boss',
    };

    for (const mon of rawMonsters) {
      const { id, name, spawn, stats } = mon;
      const { level, health, mvp, class: _class, elementShortName, raceName, scaleName } = stats;

      // Grouping is id- and map-driven (see constants/monster-spawn-mapper), so the
      // monster's real spawn — used by SPAWN[] item bonuses — stays intact.
      const spawnMap = getMonsterGroupName({ id, spawn, mvp, class: _class });
      const group = groupMap.get(spawnMap);
      const monster: DropdownModel = {
        label: `${level} ${name} (${racePtBr(raceName)} ${sizePtBr(scaleName).at(0)})`,
        name,
        value: id,
        level,
        elementName: elementShortName,
        raceName,
        className: classMap[_class],
        mvp,
        scaleName: scaleName.at(0),
        health,
        groups: spawnMap.trim().split(','),
        searchVal: `${spawnMap} ${id}`,
      };

      monsters.push(monster);

      if (group) {
        group.items.push(monster);
      } else {
        groupMap.set(spawnMap, {
          label: spawnMap,
          items: [monster],
        });
      }
    }

    this.monsterList = monsters;
    this.groupMonsterList = [...groupMap.values()].sort((a, b) => {
      return a.label > b.label ? 1 : -1;
    });
  }

  private setItemList() {
    this.enchants = [...(this.mapEnchant?.values() ?? [])]
      .filter(item => this.showPreviews || !item.preRelease)
      .map(item => ({ label: item.name, value: item.id, preRelease: item.preRelease }));
    const weaponList: ItemModel[] = [];
    const leftWeaponList: ItemModel[] = [];
    const weaponCardList: ItemModel[] = [];
    const ammoList: ItemModel[] = [];
    const headUpperList = [];
    const headMiddleList = [];
    const headLowerList = [];
    const headCardList = [];
    const armorList = [];
    const armorCardList = [];
    const shieldList = [];
    const shieldCardList = [];
    const garmentList = [];
    const garmentCardList = [];
    const bootList = [];
    const bootCardList = [];
    const accList = [];
    const accCardList = [];
    const accLeftList = [];
    const accLeftCardList = [];
    const accRightList = [];
    const accRightCardList = [];
    const petList = [];

    const costumeUpperList = [];
    const costumeMiddleList = [];
    const costumeLowerList = [];
    const costumeGarmentList = [];
    const costumeEnhUpperList = [];
    const costumeEnhMiddleList = [];
    const costumeEnhLowerList = [];
    const costumeEnhGarmentList = [];
    const costumeEnhGarment2List = [];
    const costumeEnhGarment4List = [];

    const shadowArmorList = [];
    const shadowShieldList = [];
    const shadowBootList = [];
    const shadowEarringList = [];
    const shadowPendantList = [];
    const shadowWeaponList = [];

    const consumableList: ItemModel[] = [];

    // Only show items that exist on the LATAM server (flagged by RoService from
    // the GRF extract). Non-LATAM items stay in the map for id lookups but are
    // hidden from the selection dropdowns.
    const sortedItems = Object.values(this.items)
      .filter((item: any) => item.presentInLatam && !this.hiddenCustomIds.has(item.id) && (this.showPreviews || !item.preRelease))
      .sort((a, b) => Number(!!(b as any).custom) - Number(!!(a as any).custom) || compareItemNames(a.name, b.name));
    for (const item of sortedItems) {
      const { itemTypeId, itemSubTypeId, compositionPos } = item;

      switch (itemTypeId) {
        case ItemTypeId.WEAPON:
          // if (!item.name.startsWith('Furious')) continue;
          weaponList.push(item);

          if (itemSubTypeId === 256 || itemSubTypeId === 257 || (item as any).kind === 'leftWeapon') {
            leftWeaponList.push(item);
          }
          continue;
        case ItemTypeId.CONSUMABLE:
          consumableList.push(item);
          continue;
        case ItemTypeId.AMMO:
          ammoList.push(item);
          continue;
      }

      switch (itemSubTypeId) {
        // A head gear is offered in every slot it occupies — a Middle+Lower mask shows up
        // under both Meio and Baixo, and picking it in one marks the other as occupied
        // (see refreshHeadSlotOccupancy). Which one the player chooses matters: only
        // headUpper/headMiddle carry a card socket, so a masks's slot is unreachable if
        // the calculator confines it to Baixo.
        case ItemSubTypeId.Upper:
          for (const slot of getHeadGearLocations(item)) {
            if (slot === HeadGearLocation.Middle) headMiddleList.push(item);
            else if (slot === HeadGearLocation.Lower) headLowerList.push(item);
            else headUpperList.push(item);
          }
          continue;
        case ItemSubTypeId.Shield:
          shieldList.push(item);
          continue;
        case ItemSubTypeId.Armor:
          armorList.push(item);
          continue;
        case ItemSubTypeId.Garment:
          garmentList.push(item);
          continue;
        case ItemSubTypeId.Boot:
          bootList.push(item);
          continue;
        case ItemSubTypeId.Acc_L:
          accLeftList.push(item);
          accList.push(item);
          continue;
        case ItemSubTypeId.Acc_R:
          accRightList.push(item);
          accList.push(item);
          continue;
        case ItemSubTypeId.Acc:
          accRightList.push(item);
          accLeftList.push(item);
          accList.push(item);
          continue;
        case ItemSubTypeId.Pet:
          petList.push(item);
          continue;
        case ItemSubTypeId.ShadowArmor:
          shadowArmorList.push(item);
          continue;
        case ItemSubTypeId.ShadowShield:
          shadowShieldList.push(item);
          continue;
        case ItemSubTypeId.ShadowBoot:
          shadowBootList.push(item);
          continue;
        case ItemSubTypeId.ShadowEarring:
          shadowEarringList.push(item);
          continue;
        case ItemSubTypeId.ShadowPendant:
          shadowPendantList.push(item);
          continue;
        case ItemSubTypeId.ShadowWeapon:
          shadowWeaponList.push(item);
          continue;
        // Same multi-slot rule as real head gear above; the costume family has its own
        // three slots, and 85 of these span more than one of them.
        case ItemSubTypeId.CostumeUpper:
        case ItemSubTypeId.CostumeMiddle:
        case ItemSubTypeId.CostumeLower:
          for (const slot of getHeadGearLocations(item)) {
            if (slot === HeadGearLocation.Middle) costumeMiddleList.push(item);
            else if (slot === HeadGearLocation.Lower) costumeLowerList.push(item);
            else costumeUpperList.push(item);
          }
          continue;
        case ItemSubTypeId.CostumeGarment:
          costumeGarmentList.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhUpper:
          costumeEnhUpperList.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhMiddle:
          costumeEnhMiddleList.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhLower:
          costumeEnhLowerList.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhGarment:
          costumeEnhGarmentList.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhGarment2:
          costumeEnhGarment2List.push(item);
          continue;
        case ItemSubTypeId.CostumeEnhGarment4:
          costumeEnhGarment4List.push(item);
          continue;
      }

      if (itemTypeId === ItemTypeId.CARD) {
        if ((item as any).custom && compositionPos == null) {
          weaponCardList.push(item); headCardList.push(item); shieldCardList.push(item);
          armorCardList.push(item); garmentCardList.push(item); bootCardList.push(item);
          accLeftCardList.push(item); accRightCardList.push(item); accCardList.push(item);
          continue;
        }
        switch (compositionPos) {
          case CardPosition.Weapon:
            weaponCardList.push(item);
            continue;
          case CardPosition.Head:
            headCardList.push(item);
            continue;
          case CardPosition.Shield:
            shieldCardList.push(item);
            continue;
          case CardPosition.Armor:
            armorCardList.push(item);
            continue;
          case CardPosition.Garment:
            garmentCardList.push(item);
            continue;
          case CardPosition.Boot:
            bootCardList.push(item);
            continue;
          case CardPosition.AccL:
            accLeftCardList.push({
              ...item,
              name: `${ACC_SIDE_PREFIX.left} ${item.name}`,
              isHilight: true,
            });
            accCardList.push(item);
            continue;
          case CardPosition.AccR:
            accRightCardList.push({
              ...item,
              name: `${ACC_SIDE_PREFIX.right} ${item.name}`,
              isHilight: true,
            });
            accCardList.push(item);
            continue;
          case CardPosition.Acc:
            accLeftCardList.push(item);
            accRightCardList.push(item);
            accCardList.push(item);
            continue;
          case CardPosition.All:
            // Fits any slot's card socket (e.g. Essências de Morroc): offer it in
            // every card picker.
            weaponCardList.push(item);
            headCardList.push(item);
            shieldCardList.push(item);
            armorCardList.push(item);
            garmentCardList.push(item);
            bootCardList.push(item);
            accLeftCardList.push(item);
            accRightCardList.push(item);
            accCardList.push(item);
            continue;
        }
      }
    }

    this.itemList.weaponList = toDropdownList(weaponList, 'name', 'id');
    this.itemList.leftWeaponList = toDropdownList(leftWeaponList, 'name', 'id');
    this.itemList.weaponCardList = toDropdownList(weaponCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.ammoList = toDropdownList(ammoList, 'name', 'id', 'propertyAtk');
    this.itemList.headUpperList = toDropdownList(headUpperList, 'name', 'id');
    this.itemList.headMiddleList = toDropdownList(headMiddleList, 'name', 'id');
    this.itemList.headLowerList = toDropdownList(headLowerList, 'name', 'id');
    this.itemList.headCardList = toDropdownList(headCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.armorList = toDropdownList(armorList, 'name', 'id');
    this.itemList.armorCardList = toDropdownList(armorCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.shieldList = toDropdownList(shieldList, 'name', 'id');
    this.itemList.shieldCardList = toDropdownList(shieldCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.garmentList = toDropdownList(garmentList, 'name', 'id');
    this.itemList.garmentCardList = toDropdownList(garmentCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.bootList = toDropdownList(bootList, 'name', 'id');
    this.itemList.bootCardList = toDropdownList(bootCardList, 'name', 'id', undefined, ['cardPrefix']);
    this.itemList.accList = toDropdownList(accList, 'name', 'id');
    this.itemList.accCardList = toDropdownList(accCardList, 'name', 'id');
    this.itemList.accLeftList = toDropdownList(accLeftList, 'name', 'id');
    this.itemList.accLeftCardList = toDropdownList(accLeftCardList, 'name', 'id', undefined, ['cardPrefix', 'isHilight']);
    this.itemList.accRightList = toDropdownList(accRightList, 'name', 'id');
    this.itemList.accRightCardList = toDropdownList(accRightCardList, 'name', 'id', undefined, ['cardPrefix', 'isHilight']);
    this.itemList.petList = petList.map((a) => ({ label: a.name, value: a.id }));

    this.itemList.costumeUpperList = toDropdownList(costumeUpperList, 'name', 'id');
    this.itemList.costumeMiddleList = toDropdownList(costumeMiddleList, 'name', 'id');
    this.itemList.costumeLowerList = toDropdownList(costumeLowerList, 'name', 'id');
    this.itemList.costumeGarmentList = toDropdownList(costumeGarmentList, 'name', 'id');

    this.itemList.costumeEnhUpperList = toDropdownList(costumeEnhUpperList, 'name', 'id');
    this.itemList.costumeEnhMiddleList = toDropdownList(costumeEnhMiddleList, 'name', 'id');
    this.itemList.costumeEnhLowerList = toDropdownList(costumeEnhLowerList, 'name', 'id');
    this.itemList.costumeEnhGarmentList = toDropdownList(costumeEnhGarmentList, 'name', 'id');
    this.itemList.costumeEnhGarment2List = toDropdownList(costumeEnhGarment2List, 'name', 'id');
    this.itemList.costumeEnhGarment4List = toDropdownList(costumeEnhGarment4List, 'name', 'id');

    this.itemList.shadowArmorList = toDropdownList(shadowArmorList, 'name', 'id');
    this.itemList.shadowShieldList = toDropdownList(shadowShieldList, 'name', 'id');
    this.itemList.shadowBootList = toDropdownList(shadowBootList, 'name', 'id');
    this.itemList.shadowEarringList = toDropdownList(shadowEarringList, 'name', 'id');
    this.itemList.shadowPendantList = toDropdownList(shadowPendantList, 'name', 'id');
    this.itemList.shadowWeaponList = toDropdownList(shadowWeaponList, 'name', 'id');

    this.consumableList = toDropdownList(consumableList.sort((a, b) => Number(!!b.custom) - Number(!!a.custom) || a.id - b.id), 'name', 'id');

    if (!this.env.production) {
      for (const wea of weaponList) {
        if (!wea.itemLevel) {
          console.log('invalid weapon, ID' + wea.id);
        }
      }
    }
  }

  private setItemDropdownList() {
    const cClass = this.selectedCharacter;
    // The rules themselves live in core/class-switch.ts, because the class dialog has to
    // answer the same question in the other direction — which equipped items the class
    // being switched to cannot wear. Two copies of the Super Novice exemptions would drift,
    // and the dialog would name a different set than the dropdowns then offer.
    const itemOf = (a: ItemDropdownModel) => this.items[a.value as number];
    const onlyMe = canUsedByClass<ItemDropdownModel>(cClass);
    const onlySuperNoviceWeapon = slotEquipFilter('weapon', cClass, itemOf);
    const onlySuperNoviceHeadGear = slotEquipFilter('headGear', cClass, itemOf);

    this.weaponList = this.itemList.weaponList.filter(onlySuperNoviceWeapon);
    this.leftWeaponList = this.itemList.leftWeaponList.filter(onlySuperNoviceWeapon);
    this.weaponCardList = this.itemList.weaponCardList.map((a) => a);
    // this.ammoList = this.itemList.ammoList.filter(onlyMe);
    this.headUpperList = this.itemList.headUpperList.filter(onlySuperNoviceHeadGear);
    this.headMiddleList = this.itemList.headMiddleList.filter(onlySuperNoviceHeadGear);
    this.headLowerList = this.itemList.headLowerList.filter(onlySuperNoviceHeadGear);
    this.headCardList = this.itemList.headCardList.map((a) => a);
    this.armorList = this.itemList.armorList.filter(onlyMe);
    this.armorCardList = this.itemList.armorCardList.map((a) => a);
    this.shieldList = this.itemList.shieldList.filter(onlyMe);
    this.shieldCardList = this.itemList.shieldCardList.map((a) => a);
    this.garmentList = this.itemList.garmentList.filter(onlyMe);
    this.garmentCardList = this.itemList.garmentCardList.map((a) => a);
    this.bootList = this.itemList.bootList.filter(onlyMe);
    this.bootCardList = this.itemList.bootCardList.map((a) => a);
    this.accList = this.itemList.accList.filter(onlyMe);
    this.accCardList = this.itemList.accCardList.map((a) => a);
    this.accLeftList = this.itemList.accLeftList.filter(onlyMe);
    this.accLeftCardList = this.itemList.accLeftCardList.map((a) => a);
    this.accRightList = this.itemList.accRightList.filter(onlyMe);
    this.accRightCardList = this.itemList.accRightCardList.map((a) => a);
    this.petList = this.itemList.petList.map((a) => a);

    this.costumeUpperList = this.itemList.costumeUpperList.filter(onlyMe);
    this.costumeMiddleList = this.itemList.costumeMiddleList.filter(onlyMe);
    this.costumeLowerList = this.itemList.costumeLowerList.filter(onlyMe);
    this.costumeGarmentList = this.itemList.costumeGarmentList.filter(onlyMe);

    this.costumeEnhUpperList = this.itemList.costumeEnhUpperList.map((a) => a);
    this.costumeEnhMiddleList = this.itemList.costumeEnhMiddleList.map((a) => a);
    this.costumeEnhLowerList = this.itemList.costumeEnhLowerList.map((a) => a);
    this.costumeEnhGarmentList = this.itemList.costumeEnhGarmentList.map((a) => a);
    this.costumeEnhGarment2List = this.itemList.costumeEnhGarment2List.map((a) => a);
    this.costumeEnhGarment4List = this.itemList.costumeEnhGarment4List.map((a) => a);

    this.shadowArmorList = this.itemList.shadowArmorList.filter(onlyMe);
    this.shadowShieldList = this.itemList.shadowShieldList.filter(onlyMe);
    this.shadowBootList = this.itemList.shadowBootList.filter(onlyMe);
    this.shadowEarringList = this.itemList.shadowEarringList.filter(onlyMe);
    this.shadowPendantList = this.itemList.shadowPendantList.filter(onlyMe);
    this.shadowWeaponList = this.itemList.shadowWeaponList.filter(onlyMe);

    this.setEquipableItems();
    this.onClassChangedSubject.next(true);
  }

  private setEquipableItems() {
    const items = [
      { position: 'weaponList', values: this.weaponList },
      { position: 'ammoList', values: this.ammoList ?? [] },
      { position: 'weaponCardList', values: this.weaponCardList },
      { position: 'headUpperList', values: this.headUpperList },
      { position: 'headMiddleList', values: this.headMiddleList },
      { position: 'headLowerList', values: this.headLowerList },
      { position: 'headCardList', values: this.headCardList },
      { position: 'armorList', values: this.armorList },
      { position: 'armorCardList', values: this.armorCardList },
      { position: 'shieldList', values: this.shieldList },
      { position: 'shieldCardList', values: this.shieldCardList },
      { position: 'garmentList', values: this.garmentList },
      { position: 'garmentCardList', values: this.garmentCardList },
      { position: 'bootList', values: this.bootList },
      { position: 'bootCardList', values: this.bootCardList },
      { position: 'accList', values: this.accList },
      { position: 'accCardList', values: this.accCardList },

      { position: 'enchants', values: this.enchants },
      // { position: 'accLeftCardList', values: this.accLeftCardList },
      // { position: 'accRightList', values: this.accRightList },
      // { position: 'accRightCardList', values: this.accRightCardList },
      { position: 'petList', values: this.petList },
      { position: 'costumeList', values: this.costumeUpperList },
      { position: 'costumeList', values: this.costumeMiddleList },
      { position: 'costumeList', values: this.costumeLowerList },
      { position: 'costumeList', values: this.costumeGarmentList },
      { position: 'costumeList', values: this.costumeEnhUpperList },
      { position: 'costumeList', values: this.costumeEnhMiddleList },
      { position: 'costumeList', values: this.costumeEnhLowerList },
      { position: 'costumeList', values: this.costumeEnhGarmentList },
      { position: 'costumeList', values: this.costumeEnhGarment2List },
      { position: 'costumeList', values: this.costumeEnhGarment4List },
      { position: 'shadowArmorList', values: this.shadowArmorList },
      { position: 'shadowShieldList', values: this.shadowShieldList },
      { position: 'shadowBootList', values: this.shadowBootList },
      { position: 'shadowEarringList', values: this.shadowEarringList },
      { position: 'shadowPendantList', values: this.shadowPendantList },
      { position: 'shadowWeaponList', values: this.shadowWeaponList },
    ];

    this.equipableItems = items.flatMap((a) => {
      return a.values.map((value) => {
        return {
          label: value.label,
          id: value.value as number,
          value: value.value,
          position: a.position,
        };
      });
    });
  }

  private setAmmoDropdownList() {
    const myAmmoId = this.calculator.getAmmoSubTypeId();
    // const isMC = this.selectedCharacter.className === ClassName.Mechanic;
    const onlyMyAmmo = (a: DropdownModel) => {
      const ammo = this.items[a.value];
      if (!ammo) return false;

      // const onlyMC = ammo.aegisName?.includes('Cannon_Ball');

      // if (isMC && onlyMC) {
      //   return true;
      // }

      return ammo.itemSubTypeId === myAmmoId;
    };

    this.ammoList = this.itemList.ammoList.filter(onlyMyAmmo);
    this.equipableItems = this.equipableItems.filter(row => row.position !== 'ammoList').concat(
      this.ammoList.map(option => ({ ...option, id: Number(option.value), position: 'ammoList' })),
    );
  }

  private updateAvailablePoints() {
    const main = this.computePoints(this.model);
    this.availablePoints = main.availablePoint;
    this.appropriateLevel = main.appropriateLevel;

    if (this.isAllowTraitStat) {
      this.availableTraitPoints = main.availableTraitPoint;
      this.appropriateLevelForTrait = main.appropriateLevelForTrait;
    } else {
      this.availableTraitPoints = 0;
      this.appropriateLevelForTrait = 0;
    }

    if (this.isCompareStats) {
      const cmp = this.computePoints(this.model2);
      this.availablePoints2 = cmp.availablePoint;
      this.availableTraitPoints2 = this.isAllowTraitStat ? cmp.availableTraitPoint : 0;
    }
  }

  private computePoints(m: Record<string, any>) {
    const { str, agi, vit, int, dex, luk, pow, sta, wis, spl, con, crt } = m;
    return this.stateCalculator
      .setLevel(m['level'])
      .setClass(this.selectedCharacter)
      .setMainStatusLevels([str, agi, vit, int, dex, luk])
      .setTraitStatusLevels([pow, sta, wis, spl, con, crt])
      .calculate().summary;
  }


  onSelectItem(itemType: string, itemId = 0, refine = 0) {
    // console.log({ itemType, itemId, refine })
    this.equipItemMap.set(itemType as ItemTypeEnum, itemId);

    // if (!itemType.startsWith('weapon')) {
    //   this.updateItemEvent.next(itemType);
    //   return;
    // }

    // if (this.isMainItem(itemType)) {
    //   this.itemSlotsMap[itemType] = this.items[itemId]?.slots || 0;
    //   this.setEnchantList(itemId, itemType);
    //   this.clearCard(itemType);
    // }
    // if (this.isOptionableItem(itemType)) {
    //   const itemAegisName = this.items[itemId]?.aegisName;
    //   this.itemTotalOptionMap[itemType] = ExtraOptionTable[itemAegisName] || 0;
    // }

    // in order to check is the weapon allow to hold shield or left weapon or not
    if (itemType === ItemTypeEnum.weapon) {
      this.calculator.setWeapon({ itemId, refine });
    }

    this.updateItemEvent.next(itemType);
  }

  onSelectGrade(itemType: string, _itemId: number, _grade: string) {
    this.updateItemEvent.next(itemType);
  }

  onClearItem(itemType: string) {
    if (this.model[`${itemType}Refine`] > 0) {
      this.model[`${itemType}Refine`] = 0;
    }
    if (this.model[`${itemType}Grade`]) {
      this.model[`${itemType}Grade`] = '';
    }

    // The slot's own Bônus Aleatórios go with its item. From the descriptor rather than a
    // literal index range: this runs for the eviction paths too (a two-handed weapon
    // dropping the shield, a shield dropping the off-hand), which used to leave the
    // evicted slot's options behind in the autosave and the share link.
    for (const index of SLOTS_BY_KEY.get(itemType as ItemTypeEnum)?.optionIndexes ?? []) {
      this.model.rawOptionTxts[index] = undefined;
    }

    if (itemType === ItemTypeEnum.weapon) {
      this.model.propertyAtk = undefined;
      this.model.ammo = undefined;
      this.onClearItem(ItemTypeEnum.leftWeapon);
    }

    const relatedItems = MainItemWithRelations[itemType as ItemTypeEnum] || [];
    for (const _itemType of relatedItems) {
      if (this.model[_itemType]) {
        this.model[_itemType] = undefined;
        this.onSelectItem(_itemType);
      }
    }

    this.updateItemEvent.next(itemType);
  }

  /** The head gear (real and costume) a build is wearing, keyed by the slot holding it. */
  private collectHeadGear(model: Record<string, any>) {
    const equipped: Partial<Record<ItemTypeEnum, ItemModel>> = {};
    for (const slot of HEAD_SLOTS) {
      const item = this.items[model[slot]];
      if (item) equipped[slot] = item;
    }

    return equipped;
  }

  /**
   * Applies the multi-slot head gear rule to the main build: mark the slots a spanning
   * item takes over, and empty whatever collides with it.
   *
   * Returns true when something was cleared, so the caller can bail out and let the
   * follow-up event recalculate against the settled build.
   */
  private refreshHeadSlotOccupancy(changed: ReadonlySet<ItemTypeEnum>): boolean {
    const equipped = this.collectHeadGear(this.model);
    const { occupiedBy, toClear } = resolveHeadSlotOccupancy(equipped, changed);

    this.headSlotOccupiedBy = Object.fromEntries(
      Object.entries(occupiedBy).map(([slot, holder]) => [slot, equipped[holder]?.name]),
    );

    for (const slot of toClear) {
      this.model[slot] = undefined;
      this.onSelectItem(slot);
      this.onClearItem(slot);
    }

    return toClear.length > 0;
  }

  /**
   * Same rule for a comparison build. It inherits every slot the comparison does not
   * override, so swapping a hat into Meio can land on top of a mask the main build wears
   * in Baixo — that has to resolve here or the mask's bonuses get counted twice. The
   * compared slots win, since they are what the player is asking about.
   */
  private resolveCompareHeadSlots<T extends Record<string, any>>(model: T): T {
    const { toClear } = resolveHeadSlotOccupancy(this.collectHeadGear(model), new Set(this.compareItemNames));
    if (!toClear.length) return model;

    const resolved = { ...model };
    for (const slot of toClear) {
      resolved[slot as keyof T] = null;
      for (const related of MainItemWithRelations[slot] ?? []) {
        resolved[related as keyof T] = null;
      }
    }

    return resolved;
  }

  // --- Level / stats / traits comparison ---------------------------------

  /** The build the level band and the attribute grid are bound to. */
  get statsModel(): Record<string, any> {
    return this.isEditingCompareStats ? this.model2 : this.model;
  }

  get isEditingCompareStats(): boolean {
    return this.isCompareStats && this.statsSide === 'compare';
  }

  /** The other side's base value for a field, for the "a → b" hint; null when not comparing. */
  otherStatsValue(key: string): number | null {
    if (!this.isCompareStats) return null;
    const other = this.isEditingCompareStats ? this.model : this.model2;
    return Number(other?.[key]) || 0;
  }

  /** The other value as display text, or null when it matches the side being edited. */
  otherStatsText(key: string): string | null {
    const other = this.otherStatsValue(key);
    if (other == null || other === (Number(this.statsModel[key]) || 0)) return null;
    return String(other);
  }

  /** pt-BR name of the side the amber hints belong to. */
  get statsOtherLabel(): string {
    return this.isEditingCompareStats ? 'Principal' : 'Comparação';
  }

  /** The compared build's job bonus for a stat: its own while stats are compared, the main build's otherwise. */
  compareJobBonus(key: string): number {
    const source = this.isCompareStats ? this.model2 : this.model;
    return Number(source?.[key]) || 0;
  }

  toggleStatsCompare() {
    if (this.isCompareStats) {
      this.isCompareStats = false;
      this.statsSide = 'main';
      for (const key of STATS_COMPARE_KEYS) delete this.model2[key];
    } else {
      // Seeded from the build on screen, like a compared slot: the comparison starts
      // identical and only moves when a value is changed.
      copyStatsFields(this.model, this.model2);
      this.isCompareStats = true;
      this.statsSide = 'compare';
    }
    this.updateAvailablePoints();
    this.onListItemComparingChange();
  }

  toggleAutoCastCompare(scrollPosition?: { anchor: HTMLElement; top: number }): void {
    this.pendingAutoCastCompareScroll = scrollPosition ?? null;
    this.isCompareAutoCast = !this.isCompareAutoCast;
    if (this.isCompareAutoCast && !Object.keys(this.model2.autoCastSelections ?? {}).length) {
      this.model2.autoCastSelections = { ...(this.model.autoCastSelections ?? {}) };
    }
    this.isEnableCompare = this.compareItemNames.length > 0 || this.isCompareStats || this.isCompareAutoCast;
    this.updateCompareEvent.next(1);
    requestAnimationFrame((_event?: unknown) => this.restoreAutoCastCompareScroll(false));
  }

  /**
   * Keep the clicked control at the same viewport position both after Angular's immediate
   * layout update and after the debounced comparison calculation finishes rendering.
   */
  private restoreAutoCastCompareScroll(clearPending = true): void {
    const position = this.pendingAutoCastCompareScroll;
    if (!position) return;
    if (clearPending) this.pendingAutoCastCompareScroll = null;
    requestAnimationFrame((_event?: unknown) => {
      const anchor = position.anchor.isConnected
        ? position.anchor
        : document.querySelector<HTMLElement>('.auto-source-compare-toggle');
      if (!anchor) return;
      window.scrollBy({ top: anchor.getBoundingClientRect().top - position.top, behavior: 'auto' });
    });
  }

  onStatsLevelChange() {
    if (this.isEditingCompareStats) this.onCompareStatsChange();
    else this.onBaseStatusChange();
  }

  onStatsJobLevelChange() {
    if (this.isEditingCompareStats) this.onCompareStatsChange();
    else this.onJobLevelChange();
  }

  onStatsBaseChange() {
    if (this.isEditingCompareStats) this.onCompareStatsChange();
    else this.onBaseStatusChange();
  }

  private onCompareStatsChange() {
    this.updateAvailablePoints();
    this.updateCompareEvent.next(1);
  }

  onJobLevelChange() {
    this.setJobBonus();
    this.updateItemEvent.next(1);
  }

  onBaseStatusChange() {
    this.updateAvailablePoints();
    this.updateItemEvent.next(1);
  }

  onConsumableChange() {
    this.updateItemEvent.next(1);
  }

  onSkillClassChange(i?: number) {
    // turning on an active skill in an exclusive group (e.g. the Inquisitor Faiths)
    // turns the rest of that group off — mirrors onSkillBuffChange for the souls.
    if (i != null) {
      const changed = this.activeSkills[i];
      const group = changed?.exclusiveGroup;
      const allowsCoexistence = changed?.allowCoexistIn?.includes(this.selectedCharacter.className);
      if (group && !allowsCoexistence) {
        const selected = changed.dropdown.find((d) => d.value === this.model.activeSkills[i]);
        if (selected?.isUse) {
          this.activeSkills.forEach((skill, j) => {
            if (j !== i && skill.exclusiveGroup === group) {
              this.model.activeSkills[j] = skill.dropdown.find((d) => !d.isUse)?.value ?? 0;
            }
          });
        }
      }
    }
    this.updateItemEvent.next(1);
  }

  onSkillBuffChange(i: number) {
    const changed = this.skillBuffs[i];
    const group = changed?.exclusiveGroup;
    // turning on a buff in an exclusive group (e.g. the souls) turns the rest off
    if (group) {
      const selected = changed.dropdown.find((d) => d.value === this.model.skillBuffs[i]);
      if (selected?.isUse) {
        this.skillBuffs.forEach((buff, j) => {
          if (j !== i && buff.exclusiveGroup === group) {
            this.model.skillBuffs[j] = buff.dropdown.find((d) => !d.isUse)?.value ?? 0;
          }
        });
      }
    }
    this.updateItemEvent.next(1);
  }

  private readRightAccordionActiveIndices(): number[] {
    try {
      const parsed = JSON.parse(localStorage.getItem('ro-right-accordion-active') ?? '');
      if (!Array.isArray(parsed)) return [3];
      return [...new Set(parsed.filter((index): index is number => Number.isInteger(index) && index >= 0 && index <= 9))].sort((a, b) => a - b);
    } catch {
      return [3];
    }
  }

  private persistRightAccordionActiveIndices(): void {
    localStorage.setItem('ro-right-accordion-active', JSON.stringify(this.rightAccordionActiveIndices));
  }

  onRightAccordionOpen(event: { index: number }): void {
    if (!this.rightAccordionActiveIndices.includes(event.index)) {
      this.rightAccordionActiveIndices = [...this.rightAccordionActiveIndices, event.index].sort((a, b) => a - b);
      this.persistRightAccordionActiveIndices();
    }
  }

  onRightAccordionClose(event: { index: number }): void {
    this.rightAccordionActiveIndices = this.rightAccordionActiveIndices.filter((index) => index !== event.index);
    this.persistRightAccordionActiveIndices();
  }

  onMonsterChange() {
    this.relieveLevel = normalizeMonsterRelieveLevel(this.selectedMonster, this.relieveLevel);
    this.calcStorage.writeRelieveLevel(this.relieveLevel);
    localStorage.setItem('monster', this.selectedMonster.toString());
    this.selectedMonsterName = this.monsterDataMap?.[this.selectedMonster]?.name;
    this.updateItemEvent.next(1);
  }

  /** Whether the current target casts Aliviar, and so whether the level picker shows. */
  get isRelieveTarget(): boolean {
    return hasRelieve(this.selectedMonster);
  }

  onRelieveLevelChange() {
    this.calcStorage.writeRelieveLevel(this.relieveLevel);
    this.updateItemEvent.next(1);
  }

  onSelectItemDescription(isCompareItem = false) {
    let selectedType: ItemTypeEnum;
    let bonus: any;
    let itemId: number;

    // console.log({ isCompareItem, selectedType: this.selectedCompareItemDesc });

    if (isCompareItem) {
      selectedType = this.selectedCompareItemDesc;
      bonus = this.compareItemSummaryModel?.[selectedType] || {};
      itemId = this.equipCompareItemIdItemTypeMap.get(selectedType);

      this.selectedItemDesc = undefined;
    } else {
      selectedType = this.selectedItemDesc;
      bonus = this.itemSummary?.[selectedType] || this.itemSummary2?.[selectedType] || {};
      itemId = this.equipItemIdItemTypeMap.get(selectedType);

      this.selectedCompareItemDesc = undefined;
    }

    this.itemId = itemId;
    this.itemBonus = bonus; //{ script, bonus };
    this.itemBonusRows = this.buildItemBonusRows(bonus);
    // The solved summary drops inactive target bonuses. Keep their refine-adjusted
    // values visible in the description, clearly marked as inactive, without changing
    // the bonus map used by the simulation or its breakdowns.
    if (selectedType && this.items?.[itemId]) {
      const calculator = isCompareItem ? this.calculator2 : this.calculator;
      const model = isCompareItem ? { ...this.model, ...this.model2 } : this.model;
      const parent = selectedType.replace(/Enchant\d|Card.*/, '');
      const refine = model[`${parent}Refine`] ?? 0;
      for (const [key, lines] of itemBonusScriptEntries(this.items[itemId].script)) {
        if (bonus[key]) continue;
        const value = lines.reduce((sum, line) => {
          const condition = line.match(/^MONSTER_ID\[[\d|]+]/);
          return condition ? sum + calculator.evaluateItemRule(selectedType, line.slice(condition[0].length), refine).value : sum;
        }, 0);
        if (!value) continue;
        const [row] = this.buildItemBonusRows({ [key]: value });
        this.itemBonusRows.push({ ...row, note: 'Inativo para o alvo selecionado. Aplica-se aos monstros listados na descrição.' });
      }
    }
    this.itemDescription = prettyItemDesc(this.itemDescriptionStore.get(itemId));
  }

  /** Turn a flat item-bonus summary ({ key: value }) into display rows. Skill-named
   *  keys resolve to their pt-BR skill (icon + name, value shown as a % skill-damage
   *  bonus); every other key gets a localized stat label. Skills are grouped last so
   *  the icon column reads cleanly — mirrors the visual bonus lists used elsewhere. */
  private buildItemBonusRows(bonus: Record<string, any>): { label: string; icon?: number; display: string; isSkill: boolean }[] {
    const fmt = (v: number) => (v > 0 ? `+${v}` : `${v}`);
    const rows = Object.entries(bonus || {}).map(([key, value]) => {
      const skill = resolveSkillKey(key);
      if (skill) {
        const display = typeof value === 'number' ? `${fmt(value)}%` : `${value}`;
        return { label: skill.name, icon: skill.id, display, isSkill: true };
      }
      const display = typeof value === 'number' ? this.bonusValueText(key, value) : `${value}`;
      return { label: bonusKeyLabel(key), display, isSkill: false };
    });
    return [...rows.filter((r) => !r.isSkill), ...rows.filter((r) => r.isSkill)];
  }

  onSelectShopServer() {
    // The ItemShopService setter persists the choice; nothing else to do here.
  }

  /** Divine Pride database page for the currently inspected item. */
  get divinePrideItemUrl(): string {
    return this.itemShop.divinePrideItemUrl(this.itemId);
  }

  /** GnJoy LATAM market (buy orders) search for the inspected item on the selected server. */
  get marketItemUrl(): string {
    return this.itemShop.marketItemUrl(this.items[this.itemId]?.name);
  }

  /** pt-BR description (HTML) for a consumable's hover popover, memoised. */
  itemDescTooltip(id: number): string {
    if (!id || !this.items) return '';

    // See ItemDescriptionStore: the descriptions arrive after the item map.
    if (this.itemDescVersion !== this.itemDescriptionStore.version) {
      this.itemDescCache.clear();
      this.itemDescVersion = this.itemDescriptionStore.version;
    }

    const cached = this.itemDescCache.get(id);
    if (cached !== undefined) return cached;
    const html = itemDescPopoverHtml(this.items[id], this.itemDescriptionStore.get(id));
    this.itemDescCache.set(id, html);
    return html;
  }

  private buffTooltipCache = new Map<string, string>();
  private buffTooltipVersion = -1;

  /** Popover for a single dropdown option that is itself a skill — the summons behind
   *  "Espírito Elemental", whose group label names no skill of its own. Empty when the
   *  option carries no skill icon, so the dropdown shows no box at all rather than an empty one. */
  skillOptionTooltip(option: { icon?: number }): string {
    return skillDescHtml(option?.icon);
  }

  /** Buff label popover: the real pt-BR client skill description when available,
   *  otherwise an effect summary derived from the buff's bonuses.
   *
   *  `selectedValue` is passed by the active-skill pickers. When the options are
   *  themselves skills, the group label ("Espírito Elemental") describes nothing on its
   *  own, so the popover follows whichever summon is selected. The cache key has to carry
   *  that value, or the first selection would stick for the rest of the session. */
  buffTooltip(buff: { name: string; label: string; icon?: number; isDebuff?: boolean; preview?: boolean; previewVersion?: string; previewDescription?: string; dropdown: any[] }, selectedValue?: number): string {
    // A fallback rendered during startup must not outlive the deferred skill prose.
    if (this.buffTooltipVersion !== this.itemDescriptionStore.version) {
      this.buffTooltipCache.clear();
      this.buffTooltipVersion = this.itemDescriptionStore.version;
    }
    // O ícone entra na chave porque é ele que escolhe a descrição logo abaixo: duas classes
    // podem trazer o mesmo marcador com ícones diferentes — `_Nightmare_target` aponta para
    // Kunai Distorcida no Shinkiro e para Mahou da Escuridão no Shiranui — e sem ele a
    // primeira classe aberta ditaria o balão da outra pelo resto da sessão.
    const cacheKey = `${buff.name}:${selectedValue ?? ''}:${buff.preview ?? false}:${buff.icon ?? ''}`;
    const cached = this.buffTooltipCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // The selected option's own skill wins; otherwise the group's own icon (a picker
    // like Domínio Elemental, whose levels are modes of one skill).
    const selected = selectedValue === undefined ? undefined : (buff.dropdown || []).find((d) => d.value === selectedValue);
    const desc = buff.preview && buff.previewDescription ? '' : skillDescHtml(selected?.icon ?? buff.icon ?? SKILL_ID_BY_NAME[buff.name]);

    let html: string;
    if (desc) {
      // the client description already opens with the skill name
      const debuff = buff.isDebuff ? `<div style="color:#b00000">Debuff no monstro</div>` : '';
      html = `${debuff}${desc}`;
    } else {
      // fallback: summarise what the calc applies, one line per usable level
      const fmt = (v: any) => (typeof v === 'number' ? (v > 0 ? `+${v}` : `${v}`) : v);
      const lines = (buff.dropdown || [])
        .filter((d) => d.isUse && d.bonus && Object.keys(d.bonus).length)
        .map((d) => {
          const parts = Object.entries(d.bonus).map(([k, v]) => `${buff.preview ? ({ hp: 'Max HP', pAtk: 'P.Atk', sMatk: 'S.Matk', flee: 'Flee', hit: 'HIT', nonCriticalDamage: 'Non-critical physical damage %', criDmg: 'Critical damage %', melee: 'Melee physical damage %', range: 'Ranged physical damage %' }[k] ?? bonusKeyLabel(k)) : BUFF_BONUS_LABELS[k] ?? bonusKeyLabel(k)} ${fmt(v)}`);
          return `<div>${d.label}: ${parts.join(', ')}</div>`;
        });
      const title = `<div class="item_desc_title"><b>${buff.label}</b></div>`;
      const debuff = buff.isDebuff ? `<div style="color:#b00000">Debuff no monstro</div>` : '';
      html = `${title}${debuff}${buff.previewDescription ? `<div>${prettyItemDesc(buff.previewDescription)}</div>` : ''}${lines.length ? lines.join('') : buff.preview ? '' : '<div>—</div>'}`;
    }
    if (buff.preview && !desc) html += `<div>Preview kRO ${buff.previewVersion ?? '275/60'}. Unannounced coefficients and timings are provisional and may change.</div>`;

    this.buffTooltipCache.set(cacheKey, html);
    return html;
  }

  /** Reuses the buff popover for anything that names a skill but carries no dropdown: the
   *  multiplier rows in <app-misc-detail>/<app-battle-hud> (which label via `displayName`)
   *  and the "Resumo de Batalha" skill picker (which labels via `label`). With no dropdown
   *  buffTooltip falls through to the pt-BR client description.
   *  Arrow property, not a prototype method — it is passed by reference as an @Input. */
  skillTooltip = (skill: { name?: string; label?: string; displayName?: string; icon?: number; preview?: boolean; previewVersion?: string; previewDescription?: string }): string =>
    this.buffTooltip({
      name: skill?.name,
      label: skill?.label || skill?.displayName || skill?.name,
      icon: skill?.icon,
      preview: skill?.preview,
      previewVersion: skill?.previewVersion,
      previewDescription: skill?.previewDescription,
      dropdown: [],
    });

  /** Open the breakdown modal for a clicked summary value: list every source
   *  (equip slot/card/enchant + skill) whose contribution to `keys` is non-zero. */
  /** True when at least one equipped source contributes to `keys`; drives whether a
   *  summary value renders as clickable (no point opening an empty breakdown).
   *  Arrow property (not a prototype method) because it's also passed by reference
   *  into <app-battle-hud>'s canBreakdownFn input — same reason as skillTooltip. */
  canBreakdown = (keys: string[], compare = false): boolean => {
    // A pure defender-reduction lookup (the PVP reduction graph nodes) is sourced by
    // the TARGET's gear, not the attacker's — check the target map. There is no compared
    // target, so that branch belongs to the main column alone.
    if (!compare && this.isAllDefenderKeys(keys)) return sourcesContributeAnyKey(this.pvpTargetSources, keys);
    // A value with a known non-equipment origin (Precisão, Esquiva, HP máx., P.ATQ…)
    // always has something to say even with no equipment behind it: showBonusBreakdown
    // adds the origin's own row for whatever the equipment does not account for. Without
    // this they render inert whenever the value comes purely from attributes — which is
    // precisely when the reader most wants to be told so.
    // `compare` asks the same of the compared build, so a "→ simulado" value can't offer a
    // click opening an empty dialog on exactly the swap that removed a bonus's last source.
    const sourced = compare ? this.bonusBreakdownKeys2 : this.bonusBreakdownKeys;

    return keys.some((k) => sourced.has(k)) || !!statOriginFor(keys);
  };

  /** buildStatsSummary returns fresh objects on every calculation, so without these the
   *  default identity differ tears down and rebuilds the panel's ~120 nodes (and their
   *  keyActivate directives) each time. Labels and titles are unique within their list. */
  trackByIndex = (index: number): number => index;
  trackByLabel = (_: number, item: { label: string }): string => item.label;
  trackByTitle = (_: number, group: { title: string }): string => group.title;

  /** A summary value was clicked. The rate opens the golpes/s curve; every other value
   *  opens its bonus breakdown, against the current build or the compared one. Values with
   *  no sources (DES2 INT1 is a pure DES/INT formula) aren't clickable in the first place,
   *  and the row already carries that answer — see `clickable` in ./stats-summary. */
  onSummaryClick(row: SummaryRow | SummaryHeadline, compare = false): void {
    if ((row as SummaryHeadline).kind === 'rate') return this.showAspdCurve(compare);
    if (!(compare ? row.compareClickable : row.clickable)) return;

    this.showBonusBreakdown({
      label: row.bdLabel || row.label,
      keys: row.keys,
      valueClass: row.valueClass,
      note: row.note,
      compare,
    });
  }

  /** All keys are defender-reduction keys (subrace_/subele_/…) — such a lookup is
   *  always target-sourced (these keys only exist on a player target). */
  private isAllDefenderKeys(keys: string[]): boolean {
    return keys.length > 0 && keys.every(isDefenderKey);
  }

  private readonly mainStats = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk']);

  /** Every source key that feeds a base/trait stat total: the stat itself, the skill
   *  flat boost (`<stat>Boost`, e.g. Improve Concentration's agiBoost), and the all-stat
   *  bonus (`allStatus` for main stats, `allTrait` for traits). */
  statBreakdownKeys(stat: string): string[] {
    return [stat, `${stat}Boost`, this.mainStats.has(stat) ? 'allStatus' : 'allTrait'];
  }

  /** A bonus key whose value is a percentage (so it renders with a trailing "%"): the
   *  `*Percent` keys, the structured `p_/m_/pene_` damage keys, the cast/delay reduction
   *  percents (acd/vct/…, incl. per-skill `vct__`/`acd__`/`fctPercent__` combos), and a
   *  few named ones. */
  private isPercentKey(k: string): boolean {
    return (
      /Percent$/.test(k) ||
      /^(p|m)_/.test(k) ||
      /^pene_/.test(k) ||
      isDefenderKey(k) ||
      /^(vct|acd|fctPercent)__/.test(k) ||
      ['range', 'melee', 'criDmg', 'cri', 'criRange', 'perfectHit', 'acd', 'vct', 'vct_inc', 'vctBySkill', 'oratio', 'infection', 'intoxication', 'bitterCold', 'pollen', 'impalement', 'gravitation', 'shadowScar', 'acd_magic_wind', 'movementSpeed', 'statusResist', 'wugSkillRatio'].includes(k) ||
      RESIST_REDUCTION_KEYS.includes(k) ||
      /^insignia_ratio_/.test(k)
    );
  }

  /** A cast/delay/cooldown stat stored as a positive *reduction* magnitude but read as a
   *  negative effect — displayed negated, so a stored +25 renders as "-25%" (Pós-conjuração,
   *  Conj. Variável) or a stored +0.5 as "-0.5" seconds (Conj. Fixa). `vct_inc` is excluded:
   *  it's a cast-time *increase*, so its positive value reads as "+x%". */
  private isReductionKey(k: string): boolean {
    return ['acd', 'vct', 'fct', 'fctPercent', 'vctBySkill', 'acd_magic_wind'].includes(k);
  }

  /** "+12", "-25%", "0%": a leading "+" only for positives (negatives already carry their
   *  own "-"), with an optional trailing "%". */
  private formatSignedValue(value: number, isPercent: boolean): string {
    return `${formatSignedNumber(value)}${isPercent ? '%' : ''}`;
  }

  /** Format a numeric equip/item bonus for display: percent bonuses get a trailing "%"
   *  (matching the breakdown modal); reduction stats (cast/delay) are negated so they read
   *  as the negative effect they apply. Used by the item-description rows and the summary. */
  bonusValueText(key: string, value: number | undefined): string {
    const v = value || 0;
    // `enable_skill__<id>` holds the level the item grants the skill at, not an increment —
    // "+5" would read as a bonus it is not.
    if (key.startsWith('enable_skill__')) return `nv. ${v}`;
    const shown = this.isReductionKey(key) ? -v : v;
    return this.formatSignedValue(shown, this.isPercentKey(key));
  }

  /** Keep only the defender-reduction slice of each source's bonus map (and drop
   *  sources left with nothing) — the target reduction popover never needs the rest. */
  private pickDefenderSources(all: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [src, map] of Object.entries(all || {})) {
      if (!map || typeof map !== 'object') continue;
      const slice: Record<string, number> = {};
      for (const [k, v] of Object.entries(map)) {
        if (typeof v === 'number' && v !== 0 && isDefenderKey(k)) slice[k] = v;
      }
      if (Object.keys(slice).length) out[src] = slice;
    }
    return out;
  }

  /** Whether a reduction row is drillable in a given source map (template binding —
   *  delegates to the shared predicate so self/target stay in lockstep). */
  reductionRowClickable(row: ReductionRow, sources: Record<string, any>): boolean {
    return reductionRowClickableFn(row, sources);
  }

  /** Open the bonus-breakdown modal for a clicked reduction row against the right
   *  source map (self = attacker gear; target = opponent gear). */
  openReductionRow(row: ReductionRow, target: boolean): void {
    if (!row.keys.length) return;
    const sources = target ? this.pvpTargetSources : this.bonusBreakdownSources;
    if (!this.reductionRowClickable(row, sources)) return;
    const itemMap = target ? this.pvpTargetItemMap : this.equipItemIdItemTypeMap;
    this.showBonusBreakdown({ label: `Redução: ${row.label}`, keys: row.keys, valueClass: 'summary_stat_def2', sources, itemMap });
  }

  showBonusBreakdown(event: { label: string; keys: string[]; valueClass: string; note?: string; total?: number; calc?: DamageFormulaCalc; sources?: Record<string, any>; itemMap?: Map<any, number>; compare?: boolean }): void {
    const rows: typeof this.bonusBreakdownRows = [];
    // The summary value being broken down is a reduction (and so shown negated) when every
    // queried key is one — cast/delay stats are always queried alone (e.g. ['acd']).
    const isReduction = event.keys.length > 0 && event.keys.every((k) => this.isReductionKey(k));
    // Defaults to the attacker build's sources/item-map; the PVP reduction popover
    // passes them explicitly, a "→ simulado" compare click resolves against the compared
    // build, and a pure defender-key lookup (the "Redução por equip." graph node, which
    // carries no explicit sources) resolves against the TARGET's gear.
    const targetScoped = !event.sources && !event.compare && this.isAllDefenderKeys(event.keys);
    const sources = event.sources ?? (event.compare ? this.bonusBreakdownSources2 : targetScoped ? this.pvpTargetSources : this.bonusBreakdownSources);
    // The compared build is the main gear with only the compared slots swapped, so its
    // item map is the main one with those slots overridden. `equipCompareItemIdItemTypeMap`
    // alone holds just the swapped slots, which left every row from an untouched slot
    // unresolved and printed as its raw engine key ("headUpperEnchant1", "armorCard"...).
    const compareItemMap = new Map([...this.equipItemIdItemTypeMap, ...this.equipCompareItemIdItemTypeMap]);
    const itemMap = event.itemMap ?? (event.compare ? compareItemMap : targetScoped ? this.pvpTargetItemMap : this.equipItemIdItemTypeMap);
    const tooltips = event.compare ? this.bonusBreakdownTooltips2 : this.bonusBreakdownTooltips;
    // Present when the value carries more than equipment (Precisão, HP máx., ATQ...). Its
    // `sumKeys` narrows what the origin row is the remainder of, so the same walk below
    // both lists the sources and totals the slice that subtracts from the value cleanly.
    const origin = statOriginFor(event.keys);
    const originKeys = new Set(origin?.sumKeys ?? event.keys);
    let originEquipSum = 0;
    for (const [srcKey, bonusMap] of Object.entries(sources || {})) {
      if (!bonusMap || typeof bonusMap !== 'object') continue;
      // A single source can contribute BOTH a flat and a percent bonus for the same
      // summary value — an ASPD enchant is "+1" and "+6%", HP máx is "+1000" and "+5%".
      // Flat and percent are different units and combine differently (the "%" is a
      // diminishing multiplier, not added to the flat), so summing them into one number
      // is wrong and misleading. Keep them apart and show each part in its own unit.
      let flatSum = 0;
      let pctSum = 0;
      for (const k of event.keys) {
        const v = (bonusMap as any)[k];
        if (typeof v === 'number' && v !== 0) {
          if (this.isPercentKey(k)) pctSum += v;
          else flatSum += v;
          if (originKeys.has(k)) originEquipSum += v;
        }
      }
      if (!flatSum && !pctSum) continue;
      const parts: string[] = [];
      if (flatSum) parts.push(this.formatSignedValue(isReduction ? -flatSum : flatSum, false));
      if (pctSum) parts.push(this.formatSignedValue(isReduction ? -pctSum : pctSum, true));
      rows.push({ ...this.resolveBonusSource(srcKey, flatSum + pctSum, itemMap), display: parts.join(' '), tooltip: tooltips[srcKey] });
    }

    // Most of the panel's values are not sums of equipment at all — Precisão is mostly
    // nível+DES+SOR+CON, HP máx. is a class table scaled by VIT, ATQ mixes in the weapon's
    // base and refine. Without this row the dialog's sources would visibly add up to a
    // fraction of the number that was clicked, or to nothing at all. See StatOrigin.
    if (origin) {
      // A damage-graph node passes the value that was actually clicked, which is the one
      // its rows have to add up to; the summary panel passes none, so the origin reads the
      // build's own figure. The compared column reads the compared build — resolving a
      // "→ simulado" value against the main one would print the wrong remainder on exactly
      // the swap the reader is inspecting.
      const total = event.total ?? origin.total(event.compare ? this.totalSummary2 : this.totalSummary);
      const baseAmount = total - originEquipSum;
      if (baseAmount !== 0) {
        const display = this.formatSignedValue(baseAmount, event.keys.every((k) => this.isPercentKey(k)));
        rows.push({ label: origin.label, iconType: 'skill', value: baseAmount, display });
      }
    }

    rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // One naming rule for a compared breakdown, at the single point the summary panel and
    // the Battle HUD both funnel through.
    this.bonusBreakdownTitle = event.compare ? `${event.label} (comparação)` : event.label;
    this.bonusBreakdownNote = event.note ?? '';
    this.bonusBreakdownValueClass = event.valueClass || 'summary_damage';
    this.bonusBreakdownRows = rows;
    // Formula-derived nodes in the damage graph (ATQ Status, ATQ da Arma, the "Adicional"
    // chips) carry their own derivation — the dialog shows it above the equipment rows.
    // A node can have both: e.g. a "%" chip lists the equipment behind the percentage.
    //
    // Rows naming a bonus source arrive keyed by the engine's raw English key (the engine
    // has no access to the pt-BR names or icon ids); resolve them here so they render like
    // the equipment rows below them.
    this.bonusBreakdownCalc = event.calc
      ? {
          ...event.calc,
          rows: event.calc.rows.map((r) => {
            if (!r.sourceKey) return r;
            const resolved = this.resolveBonusSource(r.sourceKey, 0, itemMap);
            return { ...r, label: resolved.label, icon: resolved.icon, iconType: resolved.iconType };
          }),
        }
      : null;
    this.isShowBonusBreakdown = true;
  }

  /** Opens the hits-per-second curve with this build plotted on it. VelAtq is a hyperbola,
   *  so "is +10 VelAtq worth it?" can only be answered against the breakpoint table — see
   *  aspd-curve.logic.
   *
   *  One dialog for both columns: the chart already draws the compared build whenever it
   *  differs, so a click on the "→ simulado" rate opens the same curve and only the title
   *  says which value was clicked. */
  showAspdCurve(compare = false): void {
    this.aspdCurveTitle = compare ? 'Golpes por segundo (comparação)' : 'Golpes por segundo';
    this.isShowAspdCurve = true;
  }

  /** Map a breakdown source key to a display row: an equipped item (slot/card/enchant),
   *  a consumable (`consumable_<id>`), a job buff, a skill (id- or name-keyed), or a
   *  labelled catch-all (extras). */
  private resolveBonusSource(
    srcKey: string,
    value: number,
    itemMap: Map<any, number> = this.equipItemIdItemTypeMap,
  ): { label: string; icon?: number; iconType: 'item' | 'skill'; value: number } {
    // A ticked "Efeito" (proc) — keyed by the item that grants it, so it labels like any
    // other equipment row. Its own miss path, rather than the shared `fallback` tail below:
    // a chance whose item is not loaded still knows its own name (collectChanceSources keys
    // by it), and printing "chance_Instinto" would be worse than printing "Instinto".
    if (srcKey.startsWith('chance_')) {
      const chanceSource = srcKey.slice('chance_'.length);
      const chanceItem = this.items[Number(chanceSource)];

      return chanceItem
        ? { label: chanceItem.name, icon: Number(chanceSource), iconType: 'item', value }
        : { label: chanceSource, iconType: 'item', value };
    }
    if (srcKey.startsWith('consumable_')) {
      const consumableId = Number(srcKey.slice('consumable_'.length));
      if (this.items[consumableId]) {
        return { label: this.items[consumableId].name, icon: consumableId, iconType: 'item', value };
      }
    }
    // A slot key (headUpper/armor/…) resolves against the relevant build's equipment —
    // the PVP target popover passes the target's own slot→id map so its rows name the
    // OPPONENT's gear, not the attacker's item in the same slot.
    const itemId = itemMap.get(srcKey as any);
    if (itemId && this.items[itemId]) {
      return { label: this.items[itemId].name, icon: itemId, iconType: 'item', value };
    }
    const skill = resolveSkillKey(srcKey);
    if (skill) {
      return { label: skill.name, icon: skill.id, iconType: skill.iconType ?? 'skill', value };
    }
    // job buffs carry a curated pt-BR label (and icon, attached by setClassSkill)
    const buff = this.skillBuffs.find((b) => b.name === srcKey);
    if (buff) {
      return { label: buff.label, icon: buff.icon, iconType: 'skill', value };
    }
    // active/passive skill bonuses are keyed by the English skill name
    const namedSkill = this.resolveSkill(srcKey);
    if (namedSkill) {
      return { label: namedSkill.name, icon: namedSkill.id, iconType: namedSkill.iconType ?? 'skill', value };
    }
    const fallback: Record<string, string> = { extra: 'Bônus Aleatórios', consumableBonuses: 'Consumíveis' };
    return { label: fallback[srcKey] ?? srcKey, iconType: 'item', value };
  }

  onLog(inputs) {
    console.log({ inputs, model2: this.model2 });
  }

  onOptionChange() {
    this.updateItemEvent.next(1);
  }

  /**
   * The class picker moved. Nothing is applied yet.
   *
   * A switch used to wipe the build down to class/level/job, which is the whole of the
   * report behind this dialog: someone updating a build to another class lost it. The
   * choice is now the user's, and the items the new class cannot wear are named before
   * either button is pressed. A sheet with nothing on it is switched straight away —
   * there is nothing to ask about.
   *
   * `isChangeByInput` is false on the paths that write the class themselves (preset,
   * share link, replay import): those arrive with a model of their own.
   */
  onClassChange(isChangeByInput = true) {
    if (!isChangeByInput) return;

    const fromClass = this.loadedClassId;
    if (fromClass === this.model.class) return;

    if (!hasBuildToKeep(this.model)) {
      this.applyClassChange(false);
      return;
    }

    const nextClass = this.classInstanceOf(this.model.class);
    this.pendingClassSwitch = {
      fromClass,
      fromLabel: this.classLabel(fromClass),
      toLabel: this.classLabel(this.model.class),
      losses: findClassSwitchLosses({ model: this.model, items: this.items, nextClass }),
    };
    this.showClassSwitch = true;
  }

  /**
   * "Cancelar", the X and Escape all land here: the picker goes back to the class that is
   * actually loaded. Idempotent, because the dialog close event comes back through it.
   */
  cancelClassSwitch() {
    if (this.pendingClassSwitch) this.model.class = this.pendingClassSwitch.fromClass;
    this.pendingClassSwitch = null;
    this.showClassSwitch = false;
  }

  confirmClassSwitch(keepBuild: boolean) {
    const pending = this.pendingClassSwitch;
    if (!pending) return;

    // `onHide` rides the closing animation, so it can land a whole switch later — after
    // the picker has been moved again and the dialog reopened. Swallow the one this close
    // is about, or it would cancel the switch that replaced it.
    this.pendingClassSwitch = null;
    this.classSwitchConfirmed = true;
    this.showClassSwitch = false;

    this.applyClassChange(keepBuild, pending.losses);
  }

  onClassSwitchHide() {
    if (this.classSwitchConfirmed) {
      this.classSwitchConfirmed = false;
      return;
    }

    this.cancelClassSwitch();
  }

  /**
   * Load `model.class`, either on a blank sheet or over the build that is on screen.
   *
   * Keeping it reuses the preset restore path wholesale: the skill maps are keyed by
   * name, so a skill both classes share keeps its level and the rest falls away;
   * `setClassLvl` clamps a level the new class cannot reach; `setDefaultRotation` drops
   * the attacks it cannot cast. All this build has to do first is take off the gear the
   * dialog named and, on a class with no trait table, the trait points that would
   * otherwise keep paying with no field on screen to show them.
   */
  private applyClassChange(keepBuild: boolean, losses: ClassSwitchLoss[] = []) {
    // A class instance accumulates its own bonuses, so the calculator goes with it.
    const resetCalculator = () => {
      this.calculator = new Calculator();
      this.calculator.setMasterItems(this.items).setHpSpTable(this.hpSpTable);
    };

    if (keepBuild) {
      // Built against the class that is still loaded: `toUpsertPresetModel` turns the
      // positional skill arrays into name-keyed maps, which is exactly what lets a shared
      // skill survive the switch.
      // `toUpsertPresetModel` already returns a fresh object, and `applyClassSwitch`
      // another — nothing here writes through to the model on screen.
      const preset = applyClassSwitch(
        toUpsertPresetModel(this.model, this.selectedCharacter) as MainModel,
        losses,
        this.classInstanceOf(this.model.class),
      );

      resetCalculator();
      this.equipItemMap.clear();
      this.resetItemDescription();
      this.onListItemComparingChange(true);

      // loadItemSet raises and lowers isInProcessingPreset itself, and emits once.
      this.lifetime.watch(this.loadItemSet(preset as unknown as PresetModel), () => {
        this.updateItemEvent.next(1);
        this.updateCompareEvent.next(1);
      }, () => this.publish());

      return;
    }

    this.isInProcessingPreset = true;
    const { level, jobLevel } = this.model;

    this.lifetime.watch((async () => { try { const result = await this.lifetime.wait(); this.lifetime.check();
await ((_event?: unknown) => {
          this.resetModel();
          return this.lifetime.wait();
        })(); this.lifetime.check();
await ((_event?: unknown) => {
          resetCalculator();

          this.setClassInstant();
          this.setSkillModelArray();
          this.setClassSkill();
          this.setClassMinMaxLvl();
          return this.lifetime.wait();
        })(); this.lifetime.check();
await ((_event?: unknown) => {
          this.setClassLvl({ currentLvl: level, currentJob: jobLevel });
          this.onListItemComparingChange(true);

          this.updateAvailablePoints();
          this.equipItemMap.clear();
          this.resetItemDescription();

          this.setJobBonus();
          return this.lifetime.wait();
        })(); this.lifetime.check();
await ((_event?: unknown) => {
          this.setAspdPotionList();
          this.setDefaultSkill();
          this.setItemDropdownList();
          this.setAmmoDropdownList();
          // Same reason as loadItemSet: one macrotask hop is enough for the overlay
          // to repaint; the half second was an arbitrary margin.
          return this.lifetime.wait(0.05);
        })(); this.lifetime.check(); } finally { ((_event?: unknown) => (this.isInProcessingPreset = false))(); this.publish(); } })(), () => {
        this.updateItemEvent.next(1);
        this.updateCompareEvent.next(1);
      }, () => this.publish());
  }

  onPropertyAtkChange() {
    this.updateItemEvent.next(1);
  }

  onListItemComparingChange(isClear = false) {
    if (isClear) {
      this.compareItemNames = [];
      this.isCompareStats = false;
      this.isCompareAutoCast = false;
      this.statsSide = 'main';
    }

    this.isEnableCompare = this.compareItemNames.length > 0 || this.isCompareStats || this.isCompareAutoCast;

    this.updateCompareEvent.next(1);
  }

  onCompareItemChange() {
    this.updateCompareEvent.next(1);
  }

  onSelecteChance(_a: any) {
    this.updateChanceEvent.next(1);
  }

  onShowElementalTableClick() {
    this.allSelectedMonsterIds = [this.selectedMonster];
    this.isShowMonsterEle = true;
  }
}

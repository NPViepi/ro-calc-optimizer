import { registerViews } from './render';
import { controllerView } from './controller-view';
import { CalculatorData } from '../services/calculator-services';
import { AppTopBarComponent as AppTopBarViewController } from '../controllers/app.topbar';
import { Content as AppTopBarViewContent } from './content/app.topbar';
import { AutoCastHudComponent as AutoCastHudViewController } from '../controllers/auto-cast-hud';
import { Content as AutoCastHudViewContent } from './content/auto-cast-hud';
import { BattleDamagePopoversComponent as BattleDamagePopoversViewController } from '../controllers/battle-damage-popovers';
import { Content as BattleDamagePopoversViewContent } from './content/battle-damage-popovers';
import { BattleHudComponent as BattleHudViewController } from '../controllers/battle-hud';
import { Content as BattleHudViewContent } from './content/battle-hud';
import { BattleSkillDetailsComponent as BattleSkillDetailsViewController } from '../controllers/battle-skill-details';
import { Content as BattleSkillDetailsViewContent } from './content/battle-skill-details';
import { CustomItemStudioComponent as CustomItemStudioViewController } from '../controllers/custom-item-studio';
import { Content as CustomItemStudioViewContent } from './content/custom-item-studio';
import { ElementalTableComponent as ElementalTableViewController } from '../controllers/elemental-table';
import { Content as ElementalTableViewContent } from './content/elemental-table';
import { EquipmentGridComponent as EquipmentGridViewController } from '../controllers/equipment-grid';
import { Content as EquipmentGridViewContent } from './content/equipment-grid';
import { EquipmentSlotCardComponent as EquipmentSlotCardViewController } from '../controllers/equipment-slot-card';
import { Content as EquipmentSlotCardViewContent } from './content/equipment-slot-card';
import { HelpImproveDialogComponent as HelpImproveDialogViewController } from '../controllers/help-improve-dialog';
import { Content as HelpImproveDialogViewContent } from './content/help-improve-dialog';
import { ItemSearchComponent as ItemSearchViewController } from '../controllers/item-search';
import { Content as ItemSearchViewContent } from './content/item-search';
import { MiscDetailComponent as MiscDetailViewController } from '../controllers/misc-detail';
import { Content as MiscDetailViewContent } from './content/misc-detail';
import { RotationListComponent as RotationListViewController } from '../controllers/rotation-list';
import { Content as RotationListViewContent } from './content/rotation-list';
import { RotationTimelineComponent as RotationTimelineViewController } from '../controllers/rotation-timeline';
import { Content as RotationTimelineViewContent } from './content/rotation-timeline';
export function registerCalculatorViews(): void { registerViews({
"app-topbar": controllerView(services => new AppTopBarViewController(services.layout), [], [], AppTopBarViewContent, "app-topbar"),
"app-auto-cast-hud": controllerView(services => new AutoCastHudViewController(services.data.descriptions), ["simulation","simulation2","model","model2","items","summary","summary2","isComparing","autoCompareEnabled"], ["selectionChange","compareToggle","showBonusBreakdownClick","elementTableClick","skillFormulaVersionChange"], AutoCastHudViewContent, "app-auto-cast-hud"),
"app-battle-damage-popovers": controllerView(services => new BattleDamagePopoversViewController(), [], ["breakdownClick"], BattleDamagePopoversViewContent, "app-battle-damage-popovers"),
"app-battle-hud": controllerView(services => new BattleHudViewController(), ["totalSummary","totalSummary2","isEnableCompare","isCalculating","isInProcessingPreset","selectedChances","chanceList","chanceList2","selectedChances2","model","showLeftWeapon","selectedMonster","selectedMonsterName","compareItemNames","compareStats","spriteUrlOverride","spriteFallbackUrl","canBreakdownFn","reductionCategories","reductionSources","rotationView","rotationView2","rotation","atkSkills","isShowSelectableSkillLevel","isRelieveTarget","relieveLevelOptions","relieveLevel","betelgeuseHp","betelgeuseHpOptions"], ["relieveLevelChange","betelgeuseHpChange","rotationChange","stackChange","optimizeClick","selectedChancesChange","selectedChances2Change","showElementTableClick","showBonusBreakdownClick","reductionRowClick","incomingReductionClick","skillFormulaVersionChange"], BattleHudViewContent, "app-battle-hud"),
"app-battle-skill-details": controllerView(services => new BattleSkillDetailsViewController(), [], ["breakdownClick","elementTableClick"], BattleSkillDetailsViewContent, "app-battle-skill-details"),
"app-custom-item-studio": controllerView(services => new CustomItemStudioViewController(services.customItems, services.itemPicker, services.layout), ["items","currentModel","currentMonster"], ["saved","deleted"], CustomItemStudioViewContent, "app-custom-item-studio"),
"app-elemental-table": controllerView(services => new ElementalTableViewController(), ["monsterMap","groupMonsterList","allSelectedMonsterIds"], [], ElementalTableViewContent, "app-elemental-table"),
"app-equipment-grid": controllerView(services => new EquipmentGridViewController(services.slotColors, services.layout), ["items","mapEnchant","model","model2","lists","compareItemNames","showCompareItemMap","headSlotOccupiedBy","hiddenMap","isLeftWeaponShown","isShieldShown","isCompareShieldShown","revision"], ["selectItem","clearItem","selectGrade","optionChange","propertyAtkChange","compareItemChange","compareSlotsChange","slotColorChange"], EquipmentGridViewContent, "app-equipment-grid"),
"app-equipment-slot-card": controllerView(services => new EquipmentSlotCardViewController(services.itemPicker, services.slotColors, services.layout, services.data.descriptions), ["descriptor","items","lists","model","model2","derivation","compareDerivation","occupiedBy","mainBlockedNote","comparing","showAmmo","color","colorHint","revision"], ["pickField","clearSlot","toggleCompare","clearCompare","swapCompare","pickColor"], EquipmentSlotCardViewContent, "app-equipment-slot-card"),
"app-help-improve": controllerView(services => new HelpImproveDialogViewController(new CalculatorData(services.data), services.replaySubmissions), ["visible","appVersion"], ["visibleChange"], HelpImproveDialogViewContent, "app-help-improve"),
"app-item-search": controllerView(services => new ItemSearchViewController(services.layout, services.itemShop, services.data.descriptions), ["items","selectedCharacter","className","currentLevel","equipableItems","offensiveSkills","onClassChanged"], [], ItemSearchViewContent, "app-item-search"),
"app-misc-detail": controllerView(services => new MiscDetailViewController(), ["elementTable","raceTable","sizeTable","classTable","skillMultiplierTable","atkTypeTable","skillTooltip","isPene","isComparing"], ["valueClick"], MiscDetailViewContent, "app-misc-detail"),
"app-rotation-list": controllerView(services => new RotationListViewController(), ["entries","entries2","isComparing","rotation","atkSkills","isShowSelectableSkillLevel","isInProcessingPreset","damagePerCycle","skillFormulaVersion"], ["rotationChange","stackChange","optimizeClick","clearClick","detailsClick","elementTableClick","critBreakdownClick","damageClick","skillFormulaVersionChange"], RotationListViewContent, "app-rotation-list"),
"app-rotation-timeline": controllerView(services => new RotationTimelineViewController(), ["cycle","entries","cycle2","entries2"], ["iconClick"], RotationTimelineViewContent, "app-rotation-timeline")
}); }

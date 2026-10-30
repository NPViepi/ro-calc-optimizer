import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import type { SkillFormulaVersion } from '../../app/skills/skill-formula-version';
import { AutoCastActivationBreakdown, AutoCastResult, AutoCastSimulation, autoCastActivationBreakdown, basicAttackDamageRanges, basicDpsBreakdown, BasicDpsBreakdown, ConfigurableAutoCastSlot, extraHitOutcomeRate } from '../../app/core/auto-cast';
import { MainModel } from '../../app/models/main.model';
import { BASIC_ATTACK_ICON } from './rotation-list';
import { CritRateBreakdown, CritRateStep } from '../../app/core/crit-rate';
import { CritRateRow, CritRateRowCache } from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';
import { formatNumber } from '../../app/utils/format-number';
import { DescriptionStore as ItemDescriptionStore } from '../services/data-client';
import { itemDescPopoverHtml, skillDescHtml } from '../../app/utils/pretty-item-desc';
import { ItemModel } from '../../app/models/item.model';
import { dmgTypeLabel } from '../../app/utils/dmg-type-label';
import { PopoverHandle as UiPopoverComponent } from '../ui/popover-handle';
import { SelectHandle as UiSelectComponent } from '../ui/select';
import { Translate } from '../../app/i18n';


export class AutoCastHudComponent extends ViewState {
   skillFormulaVersionChange = new Events<SkillFormulaVersion>();
  constructor(
public readonly itemDescriptions: ItemDescriptionStore,
  private readonly text: Translate,
  ) { super();}

   simulation: AutoCastSimulation | null = null;
   simulation2: AutoCastSimulation | null = null;
   model: MainModel;
   model2: Partial<MainModel> = {};
   items: Record<number, ItemModel>;
   summary: any;
   summary2: any;
   isComparing = false;
   autoCompareEnabled = false;
   selectionChange = new Events<{ key: string; skillId?: number; side: 'current' | 'compare' }>();
   compareToggle = new Events<{ anchor: HTMLElement; top: number }>();
   showBonusBreakdownClick = new Events<any>();
   elementTableClick = new Events<void>();

  readonly basicAttackIcon = BASIC_ATTACK_ICON;
  activeSource: any = null;
  activeBranch: 'nocri' | 'cri' | 'flat' = 'flat';
  sourceSide: 'current' | 'compare' = 'current';
  private readonly critRateRowCache = new CritRateRowCache();

  // These view models are rebuilt during change detection. Keep their DOM anchors
  // alive while a popover or tooltip is open, including values nested in each row.
  trackSource(_: number, source: { key: string }): string { return source.key; }
  trackDetail(index: number): number { return index; }
  trackDamageRange(_: number, range: { kind: string }): string { return range.kind; }

  private overlayAnchor(target: EventTarget | null | undefined, event: Event): any {
    const rawAnchor: any = target;
    const candidate = rawAnchor?.nativeElement ?? rawAnchor;
    const explicit = candidate?.nodeType === 3 ? candidate.parentElement : candidate;
    const explicitRect = explicit?.getBoundingClientRect?.();
    if (explicitRect && (explicitRect.width > 0 || explicitRect.height > 0)) return explicit;
    const pathElement = event.composedPath?.().find((node: any) => {
      if (node?.nodeType !== 1 || !node?.getBoundingClientRect) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    });
    return pathElement || event.currentTarget || event.target;
  }

  private sourceAnchor(source: any, kind: string, fallback: any): any {
    const key = source?.key ?? 'basic-attack';
    const selector = `[data-auto-source="${key}"][data-auto-anchor="${kind}"]`;
    return document.querySelector<HTMLElement>(selector) ?? fallback;
  }

  private toggleOverlay(panel: UiPopoverComponent, event: Event, target?: EventTarget | null): void {
    const anchor = this.overlayAnchor(target, event);
    this.publish();
    const showAtAnchor = () => {
      panel?.show(event, anchor);
      if (panel?.container) panel.container.style.visibility = 'hidden';
      requestAnimationFrame(() => panel?.align());
    };
    if (panel?.overlayVisible) {
      panel.hide();
      requestAnimationFrame(showAtAnchor);
    } else {
      showAtAnchor();
    }
  }

  get showingComparisonSources(): boolean { return this.isComparing && this.sourceSide === 'compare' && !!this.simulation2; }
  get displayedSimulation(): AutoCastSimulation | null { return this.showingComparisonSources ? this.simulation2 : this.simulation; }
  private get displayedSummary(): any { return this.showingComparisonSources ? this.summary2 : this.summary; }

  get configurableSlots(): ConfigurableAutoCastSlot[] { return this.displayedSimulation?.slots ?? []; }
  get blockedSources() { return this.displayedSimulation?.blockedSources ?? []; }
  configuredSourceFor(slot: ConfigurableAutoCastSlot): any | null {
    const source = this.displayedSimulation?.sources.find((entry) => entry.source.slot === slot.key);
    return source ? this.uiSource(source) : null;
  }
  slotOptions(slot: ConfigurableAutoCastSlot) { return slot.options; }
  alignSkillPicker(picker: UiSelectComponent): void {
    picker.setPanelWidth(Math.min(336, window.innerWidth - 16), true);
  }
  selectedSkill(slot: ConfigurableAutoCastSlot): number | undefined {
    const selections = this.showingComparisonSources ? this.model2?.autoCastSelections : this.model?.autoCastSelections;
    return selections?.[slot.key];
  }
  setSelectedSkill(slot: ConfigurableAutoCastSlot, skillId?: number): void {
    this.selectionChange.emit({ key: slot.key, skillId: skillId || undefined, side: this.showingComparisonSources ? 'compare' : 'current' });
  }
  toggleComparisonWithoutScroll(event: Event): void {
    event.preventDefault();
    const anchor = event.currentTarget as HTMLElement;
    // Comparison inserts content above this control. Preserve the control's viewport
    // position rather than the document offset, which would still look like a jump.
    this.compareToggle.emit({ anchor, top: anchor.getBoundingClientRect().top });
  }
  get sourceCount(): number {
    return 1 + new Set((this.displayedSimulation?.sources ?? []).map((source) => source.source.key)).size;
  }
  get dpsSources(): any[] {
    const basic = this.basicSource;
    const automatic = (this.displayedSimulation?.sources ?? [])
      .filter((source) => !source.source.slot)
      .map((source) => this.uiSource(source));
    return [...(basic ? [basic] : []), ...automatic];
  }
  private uiSource(source: AutoCastResult): any {
    const currentResult = this.simulation?.sources.find((entry) => entry.source.key === source.source.key);
    const comparisonResult = this.isComparing
      ? this.simulation2?.sources.find((entry) => entry.source.key === source.source.key)
      : undefined;
    return {
      key: source.source.key,
      name: source.name,
      level: `Nv. ${source.source.skillLevel}`,
      isBasic: false,
      icon: source.icon,
      meta: this.sourceMeta(source),
      damageRanges: source.damageRanges,
      damageMin: source.damageRanges[0]?.min ?? 0,
      damageMax: source.damageRanges[0]?.max ?? 0,
      dps: source.dps,
      dps2: undefined,
      currentDps: currentResult?.dps ?? source.dps,
      comparisonDps: comparisonResult?.dps,
      contribution: source.contributionPercent,
      contribution2: undefined,
      info: this.sourceInfo(source),
      result: source,
      result2: comparisonResult,
      currentResult,
      comparisonResult,
      expectedDamagePerActivation: source.expectedDamagePerActivation,
      activationsPerSecond: source.activationsPerSecond,
      triggerAttacksPerSecond: source.triggerAttacksPerSecond,
      summary: source.summary,
      canCrit: source.canCrit,
      criticalRate: source.criticalRate,
      criticalRate2: comparisonResult?.criticalRate,
      critRateBreakdown: currentResult?.summary?.skillCriRateBreakdown ?? source.summary?.skillCriRateBreakdown,
      critRateBreakdown2: comparisonResult?.summary?.skillCriRateBreakdown,
    };
  }
  get basicSource(): any {
    const dmg = this.displayedSummary?.dmg ?? {};
    const sim = this.displayedSimulation;
    if (!sim) return null;
    const critical = sim.criticalRate > 0;
    const damageRanges = basicAttackDamageRanges(dmg, sim.criticalRate);
    return {
      key: 'basic-attack',
      name: this.text('skd.basicAttack'), level: '', isBasic: true, icon: 0,
      meta: [
        { text: this.text('ac.metaEffectiveHit', { rate: sim.effectiveHitRate.toFixed(1).replace('.', ',') }), effectiveHit: true },
        { text: this.text('ac.metaHitsPerSec', { value: sim.basicHitsPerSecond.toFixed(2).replace('.', ',') }) },
        { text: `${sim.criticalRate.toFixed(1).replace('.', ',')}%`, critical: true },
      ],
      damageRanges, dps: sim.basicAttackDps,
      dps2: undefined,
      currentDps: this.simulation?.basicAttackDps ?? sim.basicAttackDps,
      comparisonDps: this.isComparing ? this.simulation2?.basicAttackDps : undefined,
      contribution: sim.totalDps > 0 ? sim.basicAttackDps / sim.totalDps * 100 : 0,
      contribution2: undefined,
      info: this.text('ac.basicInfo'),
      expectedDamagePerActivation: sim.basicHitsPerSecond > 0 ? sim.basicAttackDps / sim.basicHitsPerSecond : 0,
      activationsPerSecond: sim.attacksPerSecond,
      summary: this.displayedSummary?.dmg,
      canCrit: critical,
      criticalRate: sim.criticalRate,
      criticalRate2: undefined,
      critRateBreakdown: dmg.criRateBreakdown,
      critRateBreakdown2: this.isComparing ? this.summary2?.dmg?.criRateBreakdown : undefined,
      currentResult: null,
      comparisonResult: null,
    };
  }
  sourceMeta(source: AutoCastResult, compared?: AutoCastResult): Array<{ text: string; origin?: boolean; chance?: boolean; critical?: boolean; critical2?: number }> {
    const extraHitOutcomes = source.source.extraHitOutcomes;
    if (extraHitOutcomes?.length) {
      return [
        { text: source.source.sourceName, origin: true },
        { text: extraHitOutcomes.map((outcome) => `${(outcome.chance * 100).toFixed(0)}%`).join(' + '), chance: true },
        { text: this.text('ac.metaExtraHitsPerSec', { value: extraHitOutcomeRate(source.triggerAttacksPerSecond, extraHitOutcomes).toFixed(2).replace('.', ',') }) },
        ...(source.canCrit ? [{ text: `${source.criticalRate.toFixed(1).replace('.', ',')}%`, critical: true, critical2: compared?.criticalRate }] : []),
      ];
    }
    return [
      { text: source.source.sourceName, origin: true },
      { text: `${source.source.chance.toFixed(1).replace('.', ',')}%`, chance: true },
      { text: `${source.activationsPerSecond.toFixed(2).replace('.', ',')}/s` },
      ...(source.canCrit ? [{ text: `${source.criticalRate.toFixed(1).replace('.', ',')}%`, critical: true, critical2: compared?.criticalRate }] : []),
    ];
  }
  sourceInfo(source: AutoCastResult): string {
    const limit = source.source.maxActivationsPerSecond;
    return this.text('ac.sourceInfo', { source: source.source.sourceName })
      + (limit == null
        ? ''
        : this.text(source.source.skillId === 5283 ? 'ac.sourceLimitCooldown' : 'ac.sourceLimitResource',
          { limit: limit.toFixed(2).replace('.', ',') }));
  }
  originTooltip(source: any, descriptionVersion?: number): string {
    void descriptionVersion;
    const itemId = source?.result?.source?.sourceItemId;
    if (itemId) return itemDescPopoverHtml({ name: source.result.source.sourceName }, this.itemDescriptions.get(itemId));
    const originSkillId = source?.result?.source?.enablingSkillId
      ?? ({ 'Desejo Arcano': 279, 'Plágio': 225, 'Mimetismo': 2285 } as Record<string, number>)[source?.result?.source?.sourceName];
    return skillDescHtml(originSkillId);
  }
  contributionTooltip(source: any): string {
    const percent = Number(source?.contribution ?? 0).toFixed(1).replace('.', ',');
    const total = Math.round(this.displayedSimulation?.totalDps ?? 0).toLocaleString('pt-BR');
    return this.text('ac.tipContribution', { percent, total });
  }
  openDamage(source: any, branch: 'nocri' | 'cri' | 'flat', event: Event, popovers: any, target?: EventTarget | null): void {
    this.activeSource = source;
    this.activeBranch = branch;
    const usesBasicDamage = source.isBasic || source.result?.source?.kind === 'extra-hit';
    const anchor = this.sourceAnchor(source, `damage-${branch}`, this.overlayAnchor(target, event));
    popovers?.open(event, branch, {
      entry: {
        name: source.name,
        isBasic: usesBasicDamage,
        hasDamageSpread: source.damageRanges?.length > 1 || source.damageRanges?.some((range) => range.min !== range.max),
        critWeighted: source.damageRanges?.length > 1,
      },
      summary: usesBasicDamage ? this.summary : (source.currentResult?.summary ?? source.summary),
      summary2: usesBasicDamage ? this.summary2 : source.comparisonResult?.summary,
      isComparing: this.isComparing && !!(usesBasicDamage ? this.summary2 : source.comparisonResult),
    }, anchor);
  }
  openCrit(source: any, event: Event, panel: any, target?: EventTarget | null): void {
    this.activeSource = source;
    this.toggleOverlay(panel, event, this.sourceAnchor(source, 'crit', this.overlayAnchor(target, event)));
  }
  get critRate(): CritRateBreakdown | null { return this.activeSource?.critRateBreakdown ?? null; }
  get critRateRows(): CritRateRow[] { return this.critRateRowCache.get(this.critRate, this.activeSource?.critRateBreakdown2); }
  trackByCritStep(_: number, row: CritRateRow): string { return row.step.key; }
  critStepText(step: CritRateStep, value: number): string {
    return step.kind === 'multiply' ? `${formatNumber(value * 100, 0, 1)}%` : formatNumber(Math.abs(value), 0, 1);
  }
  isCritBreakdownClickable(step: CritRateStep): boolean { return !!step.keys?.length; }
  openCritBreakdown(step: CritRateStep): void {
    if (!step.keys?.length) return;
    this.showBonusBreakdownClick.emit({ label: step.label, keys: step.keys, valueClass: 'summary_stat_atk' });
  }
  openDps(source: any, event: Event, panel: any, target?: EventTarget | null): void {
    this.activeSource = source;
    this.toggleOverlay(panel, event, this.sourceAnchor(source, 'dps', this.overlayAnchor(target, event)));
  }
  openDetails(source: any, event: Event, panel: any, target?: EventTarget | null): void {
    this.activeSource = source;
    const anchor = this.overlayAnchor(target, event);
    const currentResult = source.currentResult as AutoCastResult | undefined;
    const comparisonResult = source.comparisonResult as AutoCastResult | undefined;
    const summary = source.isBasic ? this.summary : (currentResult?.summary ?? source.summary);
    const autoCastOf = (result: AutoCastResult | undefined) => result ? {
      sourceName: result.source.sourceName,
      triggerLabel: this.triggerLabel(result.source.trigger),
      chance: result.source.chance,
      activationsPerSecond: result.activationsPerSecond,
      expectedDamagePerActivation: result.expectedDamagePerActivation,
      dps: result.dps,
      contribution: result.contributionPercent,
    } : null;
    panel?.open(event, {
      entry: {
        name: source.name,
        levelLabel: source.level,
        icon: source.icon,
        isBasic: source.isBasic,
        // `solveAutoCast()` returns the per-skill damage summary directly, unlike
        // Batalha's full summary where these values live under `calcSkill`.
        dmgTypeLabel: source.isBasic ? undefined : dmgTypeLabel(summary?.dmgType ?? '', this.text),
        element: source.isBasic ? undefined : summary?.skillPropertyAtk,
        propertyMultiplier: source.isBasic ? undefined : summary?.skillPropertyMultiplier,
        hasDamageSpread: source.damageRanges?.length > 1,
        critWeighted: source.damageRanges?.length > 1,
      },
      summary,
      summary2: source.isBasic ? this.summary2 : comparisonResult?.summary,
      isComparing: this.isComparing && !!(source.isBasic ? this.summary2 : comparisonResult),
      autoCast: source.isBasic ? null : autoCastOf(currentResult ?? source.result),
      autoCast2: source.isBasic ? null : autoCastOf(comparisonResult),
    }, anchor);
  }
  private triggerLabel(trigger: string | undefined): string {
    if (trigger === 'physical-attack') return this.text('ac.triggerPhysical');
    if (trigger === 'melee-physical-attack') return this.text('ac.triggerMelee');
    if (trigger === 'magic-attack') return this.text('ac.triggerMagic');
    if (trigger === 'melee-physical-hit') return this.text('ac.triggerMeleeHit');
    if (trigger === 'ranged-physical-hit') return this.text('ac.triggerRangedHit');
    return this.text('ac.triggerPhysicalHit');
  }
  get activeTriggerLabel(): string {
    return this.triggerLabel(this.activeSource?.result?.source?.trigger);
  }
  get activeTriggerRateLabel(): string {
    const trigger = this.activeSource?.result?.source?.trigger;
    if (trigger === 'magic-attack') return this.text('ac.rateMagic');
    return this.text(trigger === 'physical-attack' || trigger === 'melee-physical-attack'
      ? 'ac.rateAttacks' : 'ac.rateEligible');
  }
  get basicDpsSteps(): BasicDpsBreakdown | null {
    const sim = this.simulation;
    if (!this.activeSource?.isBasic || !sim) return null;
    const dmg = this.summary?.dmg ?? {};
    const isEffected = (sim.basicAttackDps !== dmg.basicDps) && (dmg.effectedBasicDps ?? 0) > 0;
    const min = isEffected ? dmg.effectedBasicDamageMin : dmg.basicMinDamage;
    const max = isEffected ? dmg.effectedBasicDamageMax : dmg.basicMaxDamage;
    const criDmg = isEffected ? dmg.effectedBasicCriDamageMin : dmg.criMinDamage;
    return basicDpsBreakdown({
      min: min ?? 0, max: max ?? 0, criDmg: criDmg ?? 0,
      criRate: sim.criticalRate, accuracy: dmg.accuracy ?? 0,
      hitsPerSec: sim.attacksPerSecond,
    });
  }
  get basicCritIsWeighted(): boolean {
    const steps = this.basicDpsSteps;
    return !!steps && steps.criRate > 0 && steps.criRate < 100;
  }
  get basicAlwaysCrit(): boolean { return (this.basicDpsSteps?.criRate ?? 0) >= 100; }
  get autoCastDpsSteps(): AutoCastActivationBreakdown | null {
    if (this.activeSource?.isBasic) return null;
    const dmg = this.activeSource?.currentResult?.summary ?? this.activeSource?.summary;
    if (!dmg || dmg.skillDpsInputMin == null) return null;
    return autoCastActivationBreakdown({
      min: dmg.skillDpsInputMin,
      max: dmg.skillDpsInputMax,
      criDmg: dmg.skillDpsInputCriDmg,
      criRate: dmg.skillCriRateToMonster,
      accuracy: dmg.skillAccuracy,
      totalHit: dmg.skillTotalHit,
    });
  }
  get autoCastCritIsWeighted(): boolean {
    const steps = this.autoCastDpsSteps;
    return !!steps && steps.criRate > 0 && steps.criRate < 100;
  }
  get autoCastAlwaysCrit(): boolean { return (this.autoCastDpsSteps?.criRate ?? 0) >= 100; }
  get fearBreezeDpsRows(): Array<{ totalHits: number; chance: number; extraHits: number; extraHitsPerSecond: number }> {
    const source = this.activeSource?.result;
    const outcomes = source?.source?.extraHitOutcomes ?? [];
    return outcomes.map((outcome) => ({
      totalHits: outcome.totalHits,
      chance: outcome.chance,
      extraHits: outcome.totalHits - 1,
      extraHitsPerSecond: source.triggerAttacksPerSecond * outcome.chance * (outcome.totalHits - 1),
    }));
  }
  get fearBreezeExtraHitsPerSecond(): number {
    return this.fearBreezeDpsRows.reduce((sum, row) => sum + row.extraHitsPerSecond, 0);
  }
  get fearBreezeDamagePerExtraHit(): number {
    const rate = this.fearBreezeExtraHitsPerSecond;
    return rate > 0 ? this.activeSource.dps / rate : 0;
  }
  openEffectiveHit(event: Event, panel: any, target?: EventTarget | null): void {
    this.toggleOverlay(panel, event, this.overlayAnchor(target, event));
  }
  get effectiveHitBreakdown(): { critical: number; normal: number; normalOpportunity: number; normalContribution: number; total: number } | null {
    const sim = this.displayedSimulation;
    if (!sim) return null;
    const critical = Math.min(100, Math.max(0, sim.criticalRate));
    const normal = Math.min(100, Math.max(0, sim.normalHitRate));
    const normalOpportunity = 100 - critical;
    const normalContribution = normalOpportunity * normal / 100;
    return { critical, normal, normalOpportunity, normalContribution, total: critical + normalContribution };
  }
  formatTime(seconds: number | null | undefined): string {
    if (seconds == null || seconds < 0) return '—';
    if (seconds > 86_400) return '> 24h';
    if (seconds < 60) return `${seconds.toFixed(1).replace('.', ',')}s`;
    const whole = Math.ceil(seconds), hours = Math.floor(whole / 3600), minutes = Math.floor((whole % 3600) / 60), secs = whole % 60;
    return hours ? `${hours}h${minutes}m` : `${minutes}m${secs}s`;
  }
}

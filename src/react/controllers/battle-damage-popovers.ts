import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { PopoverHandle as UiPopoverComponent } from '../ui/popover-handle';
import { DamageFormulaCalc, DamageFormulaNode } from '../../app/models/damage-summary.model';
import { buildDpsSteps, buildGraphClusters, DpsSteps, FormulaGraphCluster, isCritWeighted, pickHeroDamage } from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';
import { DamageBranch } from './rotation-list';
import { calcDmgDpsDetailed } from '../../app/utils/calc-dmg-dps';
import { Translate } from '../../app/i18n';

export interface DamagePopoverEntry {
  name: string;
  isBasic: boolean;
  hasDamageSpread: boolean;
  critWeighted?: boolean;
}

export interface DamagePopoverContext {
  entry: DamagePopoverEntry;
  summary: any;
  summary2?: any;
  isComparing?: boolean;
  hasSelectedChances?: boolean;
  hasSelectedChances2?: boolean;
}


export class BattleDamagePopoversComponent extends ViewState {
  constructor(private readonly text: Translate) { super();}

   formulaPanel = new UiPopoverComponent();
   noCriPanel = new UiPopoverComponent();
   meanPanel = new UiPopoverComponent();
   basicPanel = new UiPopoverComponent();

   breakdownClick = new Events<{
    label: string; keys: string[]; valueClass: string; total?: number; calc?: DamageFormulaCalc; compare?: boolean;
  }>();

  context: DamagePopoverContext | null = null;
  basicBranch: 'normal' | 'critical' = 'normal';
  formulaPart: {
    label: string;
    graph: { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] };
    hits: number;
    min: number;
    max: number;
    compare: boolean;
  } | null = null;

  // Stable cluster objects keep the clicked cell in the DOM through pointer events.
  private readonly graphClusterCache = new WeakMap<object, { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] }>();

  private toClusterPair(graph: { min: any; max: any } | null | undefined): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    if (!graph) return null;
    const cached = this.graphClusterCache.get(graph);
    if (cached) return cached;
    const clusters = { min: buildGraphClusters(graph.min), max: buildGraphClusters(graph.max) };
    this.graphClusterCache.set(graph, clusters);
    return clusters;
  }

  open(event: Event, branch: DamageBranch, context: DamagePopoverContext, target?: EventTarget | null): void {
    this.context = context;
    this.formulaPart = null;
    this.basicBranch = branch === 'cri' ? 'critical' : 'normal';
    // Render the new formula before the CDK measures the overlay. Without this, a reused
    // panel is first painted at the previous content's coordinates and visibly jumps.
    this.publish();
    const pathElement = event.composedPath?.().find((node: any) => node?.nodeType === 1);
    const rawAnchor: any = target || pathElement || event.currentTarget || event.target;
    const candidate = rawAnchor?.nativeElement ?? rawAnchor;
    const anchor = candidate?.nodeType === 3 ? candidate.parentElement : candidate;
    const panel = context.entry.isBasic && branch === 'mean'
      ? this.meanPanel
      : context.entry.isBasic
        ? this.basicPanel
      : branch === 'nocri'
        ? this.noCriPanel
        : branch === 'mean' && context.entry.hasDamageSpread
          ? this.meanPanel
          : this.formulaPanel;
    if (panel?.overlayVisible && panel.target === anchor) {
      panel.hide();
      return;
    }
    panel?.show(event, anchor);
    if (panel?.container) panel.container.style.visibility = 'hidden';
    requestAnimationFrame(() => panel?.align());
  }

  get entry(): DamagePopoverEntry | null { return this.context?.entry ?? null; }
  get dmg(): any { return this.context?.summary?.dmg ?? this.context?.summary; }
  get dmg2(): any { return this.context?.summary2?.dmg ?? this.context?.summary2; }
  get isComparing(): boolean { return !!this.context?.isComparing; }

  private effectedGraph(dmg: any, noCri = false): any {
    const selected = noCri ? this.context?.hasSelectedChances : this.context?.hasSelectedChances;
    if (noCri) return (selected && dmg?.effectedSkillFormulaGraphNoCri) || dmg?.skillFormulaGraphNoCri;
    return (selected && dmg?.effectedSkillFormulaGraph) || dmg?.skillFormulaGraph;
  }

  private graphPair(dmg: any, noCri = false, compare = false): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    const selected = compare ? this.context?.hasSelectedChances2 : this.context?.hasSelectedChances;
    const graph = noCri
      ? (selected && dmg?.effectedSkillFormulaGraphNoCri) || dmg?.skillFormulaGraphNoCri
      : (selected && dmg?.effectedSkillFormulaGraph) || dmg?.skillFormulaGraph;
    return this.toClusterPair(graph);
  }

  get formulaGraph() { return this.graphPair(this.dmg); }
  get formulaGraph2() { return this.isComparing ? this.graphPair(this.dmg2, false, true) : null; }
  get noCriGraph() { return this.graphPair(this.dmg, true); }
  get noCriGraph2() { return this.isComparing ? this.graphPair(this.dmg2, true, true) : null; }
  private basicGraphPair(dmg: any, critical: boolean): { min: FormulaGraphCluster[]; max: FormulaGraphCluster[] } | null {
    const graph = critical ? dmg?.basicFormulaGraphCri : dmg?.basicFormulaGraph;
    return this.toClusterPair(graph);
  }
  get basicGraph() { return this.basicGraphPair(this.dmg, this.basicBranch === 'critical'); }
  get basicGraph2() { return this.isComparing ? this.basicGraphPair(this.dmg2, this.basicBranch === 'critical') : null; }
  get basicGraphIsFlat(): boolean {
    return this.basicBranch === 'critical'
      ? this.dmg?.criMinDamage === this.dmg?.criMaxDamage
      : this.dmg?.basicMinDamage === this.dmg?.basicMaxDamage;
  }
  get basicTitle(): string { return this.text(this.basicBranch === 'critical' ? 'pop.howCri' : 'pop.howBasic'); }
  get damageIsFlat(): boolean {
    const hero = pickHeroDamage(this.dmg, !!this.context?.hasSelectedChances);
    return hero.min === hero.max;
  }
  get noCriIsFlat(): boolean { return this.dmg?.skillMinDamageNoCri === this.dmg?.skillMaxDamageNoCri; }
  private basicMean(dmg: any, summary: any): DpsSteps | null {
    if (!dmg) return null;
    const hitsPerSec = summary?.calc?.hitPerSecs || 0;
    const detailed = calcDmgDpsDetailed({
      min: dmg.basicMinDamage || 0,
      max: dmg.basicMaxDamage || 0,
      cri: dmg.criRateToMonster || 0,
      criDmg: dmg.criMinDamage || dmg.criMaxDamage || 0,
      hitsPerSec,
      accRate: dmg.accuracy || 0,
    });
    return {
      avgBasicDamage: detailed.avgBasicDamage,
      criRate: detailed.limitedCriRate,
      accuracy: detailed.limitedAccuracy,
      criDmg: dmg.criMinDamage || dmg.criMaxDamage || 0,
      criPart: detailed.criHit / 100,
      noCriPart: detailed.nonCriHit / 100,
      avgDamagePerHit: detailed.totalDamage,
      hitsPerSec,
      oneHitDps: detailed.oneHitDps,
      totalHit: 1,
      damagePerUse: detailed.totalDamage,
      totalDps: detailed.oneHitDps,
    };
  }
  get mean(): DpsSteps | null {
    return this.entry?.isBasic ? this.basicMean(this.dmg, this.context?.summary) : this.entry?.hasDamageSpread ? buildDpsSteps(this.dmg) : null;
  }
  get mean2(): DpsSteps | null {
    if (!this.isComparing || !this.mean) return null;
    return this.entry?.isBasic ? this.basicMean(this.dmg2, this.context?.summary2) : buildDpsSteps(this.dmg2);
  }
  get weightedCrit(): boolean {
    return this.entry?.isBasic
      ? isCritWeighted((this.dmg?.criRateToMonster ?? 0) > 0, this.dmg?.criRateToMonster)
      : isCritWeighted(this.dmg?.skillCanCri, this.dmg?.skillCriRateToMonster);
  }
  get meanTitle(): string { return this.text(this.weightedCrit ? 'pop.howCriMean' : 'pop.howMean'); }

  isNodeClickable(node: DamageFormulaNode): boolean { return !!node.detail || !!node.calc || !!node.keys?.length; }
  openFormulaNode(node: DamageFormulaNode, compare = false): void {
    if (node.detail) {
      const graph = this.toClusterPair(node.detail.graph);
      if (graph) {
        this.formulaPart = { label: node.label, graph, hits: node.detail.hits,
          min: node.detail.min, max: node.detail.max, compare };
        this.publish();
        this.formulaPanel?.align();
      }
      return;
    }
    this.openBreakdown(node, compare);
  }

  openFormulaDetailOnPointerDown(node: DamageFormulaNode, compare: boolean, event: PointerEvent): void {
    if (!node.detail) return;
    event.preventDefault();
    event.stopPropagation();
    this.openFormulaNode(node, compare);
  }

  closeFormulaPart(): void {
    this.formulaPart = null;
    this.publish();
    this.formulaPanel?.align();
  }

  openBreakdown(node: DamageFormulaNode, compare = false): void {
    if (!node.calc && !node.keys?.length) return;
    this.breakdownClick.emit({
      label: node.label, keys: node.keys ?? [], valueClass: 'summary_stat_matk', total: node.value, calc: node.calc, compare,
    });
  }
}

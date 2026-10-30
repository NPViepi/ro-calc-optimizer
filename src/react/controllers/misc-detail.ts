import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { RESIST_REDUCTION_KEYS_BY_ELE } from 'src/app/core/summary-tables';
import { elementTagClass as elementTagClassFn } from '../../app/layout/pages/ro-calculator/battle-hud/battle-hud.logic';
import { Translate } from 'src/app/i18n';


export class MiscDetailComponent extends ViewState {
   elementTable: any[];
   raceTable: any[];
   sizeTable: any[];
   classTable: any[];
   skillMultiplierTable: any[];
   atkTypeTable: any[] = [];
  /** Resolves the pt-BR skill popover HTML for a multiplier row (see ro-calculator.buffTooltip). */
   skillTooltip?: (skill: any) => string;
  /** These tables show penetration values, so the bonus keys are the `*_pene_*` variants. */
   isPene = false;
  /** When comparing, each row also carries a `<field>2` value from the compared build;
   *  a changed cell renders a "main → simulado" arrow (see showArrow). */
   isComparing = false;
  /** Clicking a value asks the parent to open the "which items contribute" breakdown.
   *  `keys` are the engine summary keys whose sum equals the clicked value;
   *  `valueClass` is the source cell's colour class so the modal matches it. */
   valueClick = new Events<{ label: string; keys: string[]; valueClass: string; compare?: boolean }>();
  elementTagClass = elementTagClassFn;

  constructor(private readonly text: Translate) { super();}

  private static readonly SIZE_SHORT: Record<string, string> = { Small: 's', Medium: 'm', Large: 'l' };
  /** physical bonuses are shown in the ATK (orange) colour, magical in the MATK (blue) colour. */
  private static readonly PHYS = 'summary_stat_atk';
  private static readonly MAGIC = 'summary_stat_matk';

  private fmLabel(displayName: string, kind: 'physical' | 'magical'): string {
    return this.text('misc.kindLabel', { name: displayName, kind: this.text(kind === 'physical' ? 'misc.physical' : 'misc.magical') });
  }

  private toneOf(kind: 'physical' | 'magical'): string {
    return kind === 'physical' ? MiscDetailComponent.PHYS : MiscDetailComponent.MAGIC;
  }

  /** Emit a breakdown request. When `compare`, showBonusBreakdown targets the compared
   *  sources and adds the single shared "(comparação)" suffix to the dialog title. */
  private emitValue(label: string, keys: string[], valueClass: string, compare: boolean): void {
    this.valueClick.emit({ label, keys, valueClass, compare });
  }

  onElementClick(val: any, kind: 'physical' | 'magical' | 'myElement' | 'resist', compare = false): void {
    const e = String(val.name).toLowerCase();
    const name = val.displayName || val.name;
    if (kind === 'physical') return this.emitValue(this.fmLabel(name, 'physical'), ['p_element_all', `p_element_${e}`], this.toneOf('physical'), compare);
    if (kind === 'magical') return this.emitValue(this.fmLabel(name, 'magical'), ['m_element_all', `m_element_${e}`], this.toneOf('magical'), compare);
    // R.R. Elem.: the target elemental-resistance reduction (Oratio/Infecção/Intoxicação), keyed by element.
    if (kind === 'resist') {
      const keys = RESIST_REDUCTION_KEYS_BY_ELE[e] ?? [];
      return this.emitValue(this.text('misc.elementRRLabel', { name }), keys, MiscDetailComponent.MAGIC, compare);
    }
    return this.emitValue(this.text('misc.magicElementLabel', { name }), ['m_my_element_all', `m_my_element_${e}`], MiscDetailComponent.MAGIC, compare);
  }

  onRaceClick(val: any, kind: 'physical' | 'magical', compare = false): void {
    const r = String(val.name).toLowerCase();
    const base = this.isPene ? 'pene_race' : 'race';
    const prefix = `${kind === 'physical' ? 'p' : 'm'}_${base}_`;
    this.emitValue(this.fmLabel(val.displayName || val.name, kind), [`${prefix}all`, `${prefix}${r}`], this.toneOf(kind), compare);
  }

  onClassClick(val: any, kind: 'physical' | 'magical', compare = false): void {
    const c = String(val.name).toLowerCase();
    const base = this.isPene ? 'pene_class' : 'class';
    const prefix = `${kind === 'physical' ? 'p' : 'm'}_${base}_`;
    this.emitValue(this.fmLabel(val.displayName || val.name, kind), [`${prefix}all`, `${prefix}${c}`], this.toneOf(kind), compare);
  }

  onSizeClick(val: any, kind: 'physical' | 'magical', compare = false): void {
    const s = MiscDetailComponent.SIZE_SHORT[val.name as string] ?? String(val.name).toLowerCase();
    const prefix = `${kind === 'physical' ? 'p' : 'm'}_size_`;
    this.emitValue(this.fmLabel(val.displayName || val.name, kind), [`${prefix}all`, `${prefix}${s}`], this.toneOf(kind), compare);
  }

  onAtkTypeClick(val: any, compare = false): void {
    const map: Record<string, string[]> = { Melee: ['melee'], Range: ['range'], MATK: ['matkPercent'] };
    const valueClass = val.name === 'MATK' ? MiscDetailComponent.MAGIC : MiscDetailComponent.PHYS;
    this.emitValue(val.displayName || val.name, map[val.name as string] ?? [], valueClass, compare);
  }

  /** `compare` targets the compared build: the breakdown drills into its items/buffs and
   *  the shared dialog adds "(comparação)" to the title. */
  onSkillClick(val: any, kind: 'value' | 'cd', compare = false): void {
    const name = val.displayName || val.name;
    if (kind === 'cd') return this.valueClick.emit({ label: this.text('misc.cdLabel', { name }), keys: [`cd__${val.name}`], valueClass: 'summary_damage', compare });
    this.valueClick.emit({ label: name, keys: [val.name], valueClass: 'summary_damage', compare });
  }

  /** Every numeric cell in these tables is a percentage bonus, so render the value with a
   *  trailing "%" (negatives keep their sign: "-5%"); a zero/absent value shows "-", matching
   *  the previous `value || '-'` behavior. Not used for the cooldown (CD) column. */
  pct(v: number | undefined): string {
    return v ? `${v}%` : '-';
  }

  /** Show the "main → simulado" arrow for `field` when comparing and the compared
   *  build's `<field>2` value differs from the current one. Handles numeric cells
   *  (default 0) and the skill cooldown string column (default ''). */
  showArrow(val: any, field: string): boolean {
    if (!this.isComparing) return false;
    const sim = val[`${field}2`];
    if (sim === undefined) return false;
    const cur = val[field];
    if (typeof sim === 'string' || typeof cur === 'string') return (cur ?? '') !== (sim ?? '');
    return (cur ?? 0) !== (sim ?? 0);
  }

  get isShowElementTable() {
    return this.elementTable?.length > 0;
  }

  get isShowSizeTable() {
    return this.sizeTable?.length > 0;
  }

  get isShowSkillMultiplierTable() {
    return this.skillMultiplierTable?.length > 0;
  }

  get isShowAtkTypeTable() {
    return this.atkTypeTable?.length > 0;
  }
}

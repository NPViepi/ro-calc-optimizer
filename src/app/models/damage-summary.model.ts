import { CritRateBreakdown } from '../core/crit-rate';
import { ElementType } from '../constants/element-type.const';

export interface BasicDamageSummaryModel {
  basicMinDamage: number;
  basicMaxDamage: number;
  criMinDamage: number;
  criMaxDamage: number;
  sizePenalty: number;
  propertyAtk: ElementType;
  propertyMultiplier: number;
  basicCriRate: number;
  /** "CRIT à distância" already counted into `criRateToMonster` but kept out of
   *  `basicCriRate` — non-zero only with a ranged weapon. Drives the "*" the summary puts
   *  next to the crit value. */
  criRangeBonus: number;
  criRateToMonster: number;
  /** Every term behind `criRateToMonster`, in the order the engine applies them. */
  criRateBreakdown: CritRateBreakdown;
  totalPene: number;
  accuracy: number;
  basicDps: number;
  pAtk: number;
  sMatk: number;
  cRate: number;
  /** Step-by-step graphs for the ordinary and critical basic-attack outcomes. */
  basicFormulaGraph?: { min: DamageFormulaGraph; max: DamageFormulaGraph };
  basicFormulaGraphCri?: { min: DamageFormulaGraph; max: DamageFormulaGraph };
  requireTxt?: string;
}

export enum SkillType {
  MELEE = 'Melee',
  RANGE = 'Range',
  MAGICAL = 'Magical',
}

/** One multiplier/subtraction applied by the engine's per-hit damage formula,
 *  in the exact order it was applied — `value` is the running total right
 *  after this step. See damage-calculator.ts calcPhysicalSkillDamage/calcMagicalSkillDamage. */
export interface DamageFormulaStep {
  label: string;
  value: number;
  /** totalBonus/EquipmentSummaryModel keys this step's multiplier is sourced from —
   *  when present, the UI can offer the same "which equipment affects this" breakdown
   *  the top stat summary already has (ro-calculator.component.ts canBreakdown/showBonusBreakdown).
   *  Omitted for steps driven by the monster itself or by non-equipment class logic. */
  keys?: string[];
}

export interface DamageFormulaTrace {
  min: DamageFormulaStep[];
  max: DamageFormulaStep[];
}

/** One value in the node-graph view of the damage formula. `stage` nodes are the
 *  same running-total mutations as `DamageFormulaStep` (one per multiplier/subtraction
 *  applied by skillFormula, in engine order). `input` nodes are additional, non-chained
 *  quantities that feed a stage — verbatim internal engine values (statusAtk, extraAtk's
 *  sub-parts, etc.), never independently re-derived or re-floored for display. See
 *  damage-calculator.ts buildAtkGraphNodes/buildAtkGroupBSteps and calcPhysicalSkillDamage/
 *  calcMagicalSkillDamage. */
export interface DamageFormulaNode {
  id: string;
  label: string;
  value: number;
  /** A component hit in a combined skill can expose its own complete formula graph. */
  detail?: { graph: { min: DamageFormulaGraph; max: DamageFormulaGraph }; hits: number; min: number; max: number };
  keys?: string[];
  /** ids of the nodes (stage or input) that feed this node */
  inputs: string[];
  kind: 'stage' | 'input';

  /** For a `stage` that applies a percentage multiplier: the bonus expressed as a
   *  percentage (25 for +25%, -30 for a 30% reduction). Drives the synthesized "%" chip,
   *  which sources its equipment breakdown from this same node's `keys` — see
   *  battle-hud.logic.ts buildGraphClusters. Absent on additive/structural stages
   *  (Maestria, contagem de golpes, aura), which get only the "Adicional" chip. */
  percent?: number;

  /** Renders `value` with a `%` suffix instead of as a plain number. */
  unit?: 'percent';

  /** Renders a leading `+` on positive values. Set on the synthesized "%"/"Adicional"
   *  chips, whose whole point is the *change* they represent rather than an absolute. */
  showSign?: boolean;

  /** "How this number was produced", for values that come from a formula rather than
   *  a sum of equipment bonuses (ATQ Status, ATQ da Arma, ATQ Munição, and the
   *  synthesized "Adicional" chips). The equipment-breakdown dialog has nothing to say
   *  about those, so it renders this instead — see ro-calculator.component.ts
   *  showBonusBreakdown. Rows carry verbatim engine values; the last row equals `value`. */
  calc?: DamageFormulaCalc;
}

export interface DamageFormulaCalcRow {
  label: string;
  /** Pre-formatted so the engine keeps control of precision (a raw `value` would let
   *  the template round `2.5` down to `3` and stop reconciling with real damage). */
  display: string;
  /** Set on the resulting/total row so the dialog can visually separate it. */
  emphasis?: boolean;
  /** Raw bonus-source key (an English skill name, an equip slot, `consumable_<id>`…).
   *  The engine only knows these keys — it has no access to the pt-BR names or the icon
   *  ids — so when this is set the dialog resolves it through the same
   *  ro-calculator.component.ts resolveBonusSource() the equipment rows use, and falls
   *  back to `label` when nothing matches. */
  sourceKey?: string;
  /** Short qualifier shown muted after the name, e.g. which race the bonus applies to. */
  hint?: string;
  /** Filled in by the dialog when it resolves `sourceKey` — never set by the engine. */
  icon?: number;
  iconType?: 'item' | 'skill';
}

export interface DamageFormulaCalc {
  rows: DamageFormulaCalcRow[];
  /** Caveat shown under the rows, e.g. that engine floor() rounding can make the
   *  adicional differ slightly from `anterior × %`. */
  note?: string;
  /** Reference for a step whose rule lives outside the simulator, rendered under the
   *  rows as an external link. Set it only where the rows alone leave the reader with a
   *  "where does that number come from" — the class ATQ adjustment points at the
   *  bROWiki page of whichever skill is doing the adjusting. */
  link?: { label: string; url: string };
}

export interface DamageFormulaGraph {
  nodes: DamageFormulaNode[];
}

export interface SkillDamageSummaryModel {
  skillDamageLabel: string;
  skillNoStackDamageLabel: string;
  baseSkillDamage: number;
  dmgType: SkillType;
  isAutoSpell: boolean;
  skillSizePenalty: number;
  skillCanCri: boolean;
  skillPropertyAtk: ElementType;
  skillPropertyMultiplier: number;
  skillTotalPene: number;
  skillTotalPeneLabel: string;
  skillTotalPeneRes: number;
  skillTotalPeneResLabel: string;
  skillMinDamage: number;
  skillMaxDamage: number;
  skillMaxDamageNoCri: number;
  skillMinDamageNoCri: number;
  skillTotalHit: number;
  skillHit: number;
  skillAccuracy: number;
  skillDps: number;
  skillHitKill: number;
  skillCriRateToMonster: number;
  /** Every term behind `skillCriRateToMonster`, including the skill's own flat crit and
   *  the share of the character's crit it applies. */
  skillCriRateBreakdown: CritRateBreakdown;
  skillCriDmgToMonster: number;
  /** Fraction of the character's crit-damage bonus this skill actually applies
   *  (1 = full bonus; e.g. 0.5 for skills like Sonic Blow that only get half). */
  skillCriDmgPercentage: number;
  skillPart2Label: string;
  skillMinDamage2: number;
  skillMaxDamage2: number;
  skillBonusFromEquipment: number;
  isUsedCurrentHP: boolean;
  isUsedCurrentSP: boolean;
  currentHp: number;
  currentSp: number;

  /** Step-by-step trace of the per-hit damage formula that produced skillMinDamage/
   *  skillMaxDamage. Undefined for the handful of skills with a fully custom formula
   *  (customFormula/Fist Spell rewrite) that don't run through the traced code path. */
  skillFormulaTrace?: DamageFormulaTrace;

  /** Same, but for skillMinDamageNoCri/skillMaxDamageNoCri (the "Dano sem crít." row) —
   *  only populated when skillCanCri is true (that's the only case the row is shown). */
  skillFormulaTraceNoCri?: DamageFormulaTrace;

  /** Node-graph view of the same per-hit formula as skillFormulaTrace, with ATK/MATK/
   *  DEF/RES internals broken out as additional `input` nodes. min/max are separate
   *  graphs (see plan: no merged min/max node values). */
  skillFormulaGraph?: { min: DamageFormulaGraph; max: DamageFormulaGraph };

  /** Same, but for the no-crit variant — only populated when skillCanCri is true. */
  skillFormulaGraphNoCri?: { min: DamageFormulaGraph; max: DamageFormulaGraph };

  /** Verbatim inputs to the engine's calcDmgDps() call — see damage-calculator.ts. */
  skillDpsInputMin: number;
  skillDpsInputMax: number;
  skillDpsInputCriDmg: number;
  skillDpsInputHitsPerSec: number;

  maxStack: number;
  noStackMinDamage: number;
  noStackMaxDamage: number;
  noStackMinCriDamage: number;
  noStackMaxCriDamage: number;

  /**
   * Calculated damage including chances bonus
   */
  effectedBasicDamageMin?: number;
  effectedBasicDamageMax?: number;
  effectedBasicCriDamageMin?: number;
  effectedBasicCriDamageMax?: number;
  effectedBasicHitsPerSec?: number;
  effectedBasicDps?: number;
  effectedSkillDamageMin?: number;
  effectedSkillDamageMax?: number;
  effectedSkillHitsPerSec?: number;
  effectedSkillDps?: number;
  /** The effected pass's own calcDmgDps() inputs — the skillDpsInput* counterparts. */
  effectedSkillDpsInputMin?: number;
  effectedSkillDpsInputMax?: number;
  effectedSkillDpsInputCriDmg?: number;
  effectedSkillDpsInputHitsPerSec?: number;
  effectedSkillCriRateToMonster?: number;
  effectedSkillAccuracy?: number;
  effectedSkillTotalHit?: number;
  /** The effected pass's own skillFormulaGraph/skillFormulaGraphNoCri. Without these the
   *  "Como o dano é calculado" panel would keep explaining the base roll while the figure
   *  above it already reads the triggered one — the stats a proc grants (a Bota
   *  Desconhecida's +STR/+LUK) feed ATQ Status and ATQ da Arma, so every row of the
   *  derivation changes when it fires. */
  effectedSkillFormulaGraph?: { min: DamageFormulaGraph; max: DamageFormulaGraph };
  effectedSkillFormulaGraphNoCri?: { min: DamageFormulaGraph; max: DamageFormulaGraph };
}

export interface SkillAspdModel {
  timingUnknown?: boolean;
  /** Mirrors `AtkSkillModel.ignoreAspdFloor`, so the rotation scheduler can read it from
   *  the solved summary without reaching back into the class catalog. */
  ignoreAspdFloor?: boolean;
  cd: number;
  reducedCd: number;
  vct: number;
  sumDex2Int1: number;
  vctByStat: number;
  vctSkill: number;
  reducedVct: number;
  fct: number;
  reducedFct: number;
  acd: number;
  reducedAcd: number;
  /** The level the row below was read at — the game's "Nv." column. */
  skillLevel: number;
  /** The client's own cast/delay row for this skill and level, untouched by any reduction
   *  — the four numbers the game shows in "Informação de Conjuração / Espera". Unlike the
   *  fields above, these survive `releasedSkill`, so the UI can show what is reduced from. */
  clientFct: number;
  clientVct: number;
  clientAcd: number;
  clientCd: number;
  castPeriod: number;
  hitPeriod: number;
  totalHitPerSec: number;
}

export interface BasicAspdModel {
  totalAspd: number;
  hitsPerSec: number;
}

export interface MiscModel {
  totalHit: number;
  totalPerfectHit: number;
  accuracy: number;
  totalFlee: number;
  totalPerfectDodge: number;
}

export interface DamageSummaryModel {
  basicDmg: BasicDamageSummaryModel;
  misc: MiscModel;
  basicAspd: BasicAspdModel;
  skillDmg?: SkillDamageSummaryModel;
  skillAspd?: SkillAspdModel;
}

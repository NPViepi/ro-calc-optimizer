import { TextKey, Translate } from '../../../i18n';
import { formatNumber, formatRate, formatSignedNumber } from '../../../utils';

/**
 * The "Resumo de atributos" panel as data.
 *
 * The panel is a fixed grid of ~20 rows, each needing a label, a formatted value, a
 * breakdown lookup and — while a comparison is active — a third cell with the compared
 * build's value and the delta. Expressing that in the template would mean the same three
 * cells written out twenty times with a comparison branch inside each; expressing it here
 * means the comparison rules (when a cell shows at all, which direction counts as better,
 * what shape the compared value repeats) are written once and testable without a DOM.
 *
 * Pure: it reads two `getTotalSummary()` results and returns strings. The only injected
 * piece is `bonusValueText`, the component's own cast/delay formatter — the reduction rows
 * have to keep printing "-72%" for a stored +72, and that rule lives with the component
 * because the item-description rows share it.
 */

/** Which side of a comparison the reader benefits from. */
export type DeltaClass = 'compare_greater' | 'compare_lower';

export interface CompareCell {
  /** The compared build's value, in the same shape as the current one ("821 + 932"). */
  text: string;
  /** Signed change, e.g. "+48" — no unit, the value cell already carries it. */
  deltaText: string;
  deltaClass: DeltaClass;
}

export interface SummaryRow {
  label: string;
  /** Formatted current value: "821 + 884", "427%", "-72%", "9". */
  text: string;
  /** `summary_stat_*` colour class, also handed to the breakdown dialog. */
  valueClass: string;
  /** Bonus keys the breakdown drills into. Empty means the row is never clickable. */
  keys: string[];
  /** Dialog title when it should differ from the row label. */
  bdLabel?: string;
  /** Line printed above the breakdown's source rows. Doubles as the "*" marker's gate:
   *  the only row that carries one is Crítico, and it carries both or neither. */
  note?: string;
  /** Trailing text outside the value, e.g. DES2 INT1's "( faltam 12 )". */
  suffix?: string;
  compare: CompareCell | null;
  /** Whether each column's value opens a breakdown. Answered here, once per calculation,
   *  rather than by a predicate the template would call twice per row per change-detection
   *  pass — the sources these read are already settled by the time the view is built. */
  clickable: boolean;
  compareClickable: boolean;
  /** What hovering the value names it — the row's own label, so a value and its tooltip
   *  can't drift apart. Set whether or not the value is clickable: a value with no sources
   *  behind it still benefits from being named, and in the compared column the label is the
   *  only thing that says which row a bare "→ 664 -9" belongs to. */
  tooltip: string;
  compareTooltip: string;
}

export interface SummaryGroup {
  title: string;
  rows: SummaryRow[];
  /** Renders the "Redução de dano" link on the group header's right edge. */
  showReduction?: boolean;
  /** Renders the "Cura e regen." link on the group header's right edge. */
  showSustain?: boolean;
}

export interface SummaryHeadline extends SummaryRow {
  /** 'rate' is the hits/s item: it opens the ASPD curve instead of a breakdown. */
  kind: 'stat' | 'rate';
}

export interface StatsSummaryView {
  headline: SummaryHeadline[];
  /** Three columns, each a list of groups. */
  columns: SummaryGroup[][];
  /** The sustain rows, which live behind the Recursos header's link instead of in the
   *  grid. Same shape as any other row — the popover clicks through to the same
   *  breakdown, and a comparison fills the same cell. */
  sustain: SummaryRow[];
}

export interface StatsSummaryOptions {
  /** The chosen language's lookup. Every label below is a key, so the whole panel —
   *  headline, group headers, rows, the origin names the breakdown prints — follows the
   *  language without the view resolving anything itself. */
  text: Translate;
  /** The component's cast/delay formatter (negates reduction stats, adds "%"). */
  bonusValueText: (key: string, value: number) => string;
  /** Whether the build (or the compared one) sources any of these keys — the component
   *  owns the answer, since it owns the bonus-source maps. */
  canBreakdown: (keys: string[], compare: boolean) => boolean;
}

/** A displayed value: the text the cell prints and the single number a delta is taken on. */
interface Displayed {
  text: string;
  total: number;
}

const n = (v: any): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Plain integer, pt-BR grouped: 1705 -> "1.705". */
const num = (v: any): Displayed => ({ text: formatNumber(n(v)), total: n(v) });

/** Percentage: 427 -> "427%". */
const pct = (v: any): Displayed => ({ text: `${formatNumber(n(v))}%`, total: n(v) });

/**
 * The game's own "A + B" reading (ATQ, DEF, Esquiva…). The delta is taken on the sum,
 * because that is the number the reader is comparing — but the text keeps both halves,
 * so a compared row reads "821 + 932" and never collapses to "1.753".
 */
const pair = (a: any, b: any): Displayed => ({ text: `${formatNumber(n(a))} + ${formatNumber(n(b))}`, total: n(a) + n(b) });

/** ATQ's second half: weapon base + refine + mastery + equip, as the status window sums it. */
const weaponAtk = (s: any): number =>
  n(s?.weapon?.baseWeaponAtk) + n(s?.weapon?.refineBonus) + n(s?.calc?.totalMasteryAtk) + n(s?.calc?.totalEquipAtk);

/** ATQM's second half: weapon base + both refine bonuses + equip MATK. */
const weaponMatk = (s: any): number =>
  n(s?.weapon?.baseWeaponMatk) + n(s?.weapon?.refineBonus) + n(s?.calc?.leftWeaponRefineBonus) + n(s?.matk);

/**
 * Where a row's value comes from when it does not come from equipment.
 *
 * The bonus-breakdown dialog can only list *sources* — an item, a card, a buff, a skill.
 * Most of these values are not sums of those: a Precisão of 376 is mostly
 * `175 + nível + DES + SOR/3 + CON×2`, and a build with no gear at all still has one.
 * Listing the equipment alone would either open an empty dialog or, worse, show three rows
 * adding up to a fraction of the number that was clicked.
 *
 * So the rows that have one name it here. The dialog prints it as one more row, valued at
 * whatever the equipment does not account for, and `canBreakdown` treats having an origin
 * as reason enough to make the value clickable — a value that comes purely from attributes
 * is exactly the one whose reader most needs to be told so.
 *
 * It rides on the RowSpec rather than in a table of its own so that the total it is the
 * remainder of is the row's own `read` — one expression, not two that have to agree. A
 * second spelling of "HP máx. is `calc.maxHp`" would leave the panel right and the dialog
 * silently wrong by the difference.
 */
export interface StatOrigin {
  /** How the dialog names the row, as a catalog key — the dialog lives in the session and
   *  resolves it there, so this module stays a pure table of keys and expressions. */
  label: TextKey;
  /**
   * The subset of the row's keys that add *linearly* into its value, so subtracting the
   * equipment's contribution leaves the origin's own. Defaults to every key.
   *
   * The exceptions are the ones that multiply rather than add: `hpPercent` scales the whole
   * HP pool, `aspdPercent` scales the distance to the ASPD ceiling, and `criRange` is not
   * summed into the crit rate at all (it counts only on the ranged basic attack). Summing
   * those in as if they were points would show a remainder that is simply wrong.
   */
  sumKeys?: string[];
}

interface RowSpec {
  /** Absent only on the hits/s headline, whose value carries its own unit. */
  label?: TextKey;
  valueClass: string;
  keys: string[];
  bdLabel?: TextKey;
  read: (s: any, opts: StatsSummaryOptions) => Displayed;
  /** Present when the value carries more than equipment — see StatOrigin. Labels ending in
   *  "e outros" are the ones whose remainder holds more than the attributes named: refine,
   *  ASPD potions, or a percentage that scaled the equipment's own share along with the
   *  base. Naming the dominant term and admitting the rest beats a false claim of purity. */
  origin?: StatOrigin;
  /**
   * Whether a rising value is an improvement. False for the cast/delay rows: they are
   * printed already negated, so -72% -> -77% is a *fall* in the displayed number and a
   * gain for the build.
   */
  greaterIsBetter?: boolean;
  /** Decimals the delta is printed with — the only row that needs any is Conj. Fixa. */
  deltaDecimals?: number;
  note?: (s: any, text: Translate) => string | undefined;
  suffix?: (s: any, text: Translate) => string | undefined;
  /** What the hover text calls this value, when the printed label won't do — only the
   *  hits/s figure, which carries its unit instead of a label. */
  tooltipLabel?: TextKey;
}

/**
 * The comparison cell for one row, or null when there is nothing to say.
 *
 * Nothing to say means either no compared build or an unchanged value — an unchanged row
 * renders no cell at all rather than a muted "→ 705 ±0", so the delta column carries only
 * the rows the swap actually moved.
 */
function compareCell(cur: Displayed, cmp: Displayed | null, greaterIsBetter: boolean, deltaDecimals?: number): CompareCell | null {
  if (!cmp || cmp.total === cur.total) return null;

  const delta = cmp.total - cur.total;
  const better = greaterIsBetter ? delta > 0 : delta < 0;

  return {
    text: cmp.text,
    deltaText: formatSignedNumber(delta, 0, deltaDecimals ?? 0),
    deltaClass: better ? 'compare_greater' : 'compare_lower',
  };
}

function buildRow(spec: RowSpec, cur: any, cmp: any | null, opts: StatsSummaryOptions): SummaryRow {
  const value = spec.read(cur, opts);
  const clickable = spec.keys.length > 0 && opts.canBreakdown(spec.keys, false);
  const compareClickable = spec.keys.length > 0 && opts.canBreakdown(spec.keys, true);
  const label = spec.label ? opts.text(spec.label) : '';
  const tip = spec.tooltipLabel ? opts.text(spec.tooltipLabel) : label;

  return {
    label,
    text: value.text,
    valueClass: spec.valueClass,
    keys: spec.keys,
    bdLabel: spec.bdLabel ? opts.text(spec.bdLabel) : undefined,
    note: spec.note?.(cur, opts.text) || undefined,
    suffix: spec.suffix?.(cur, opts.text) || undefined,
    compare: compareCell(value, cmp ? spec.read(cmp, opts) : null, spec.greaterIsBetter !== false, spec.deltaDecimals),
    clickable,
    compareClickable,
    tooltip: tip,
    compareTooltip: opts.text('cs.compareSuffix', { label: tip }),
  };
}

// --- Row definitions --------------------------------------------------------------
//
// Values are the same expressions the panel has always read off totalSummary; only the
// layout around them changed. Colour classes follow the stat family: orange for the ATQ
// side, blue for ATQM and casting, purple for defence, yellow for HP/SP and DES2 INT1.

const ATTACK_ROWS: RowSpec[] = [
  {
    label: 'ss.atkHotkey',
    valueClass: 'summary_stat_atk',
    keys: ['atk'],
    bdLabel: 'ss.atk',
    read: (s) => pair(s?.calc?.totalStatusAtk, weaponAtk(s)),
    origin: { label: 'ss.originWeaponStats' },
  },
  { label: 'ss.pAtk', valueClass: 'summary_stat_atk2', keys: ['pAtk'], read: (s) => num(s?.dmg?.pAtk), origin: { label: 'ss.originPAtk' } },
  { label: 'taken.melee', valueClass: 'summary_stat_atk', keys: ['melee'], read: (s) => pct(s?.melee) },
  { label: 'taken.ranged', valueClass: 'summary_stat_atk', keys: ['range'], read: (s) => pct(s?.range) },
];

const MAGIC_ROWS: RowSpec[] = [
  {
    label: 'ss.matkHotkey',
    valueClass: 'summary_stat_matk',
    keys: ['matk'],
    bdLabel: 'ss.matk',
    read: (s) => pair(s?.calc?.totalStatusMatk, weaponMatk(s)),
    origin: { label: 'ss.originWeaponStats' },
  },
  { label: 'ss.matkPercent', valueClass: 'summary_stat_matk', keys: ['matkPercent'], read: (s) => pct(s?.matkPercent) },
  { label: 'ss.sMatk', valueClass: 'summary_stat_matk2', keys: ['sMatk'], read: (s) => num(s?.dmg?.sMatk), origin: { label: 'ss.originSMatk' } },
];

// The Crítico value is the crit EVERY attack takes; "CRIT à distância" is not summed into
// it, because it only counts on the ranged basic attack. When the build has some, the
// value carries a "*" and the breakdown says so in full.
const criRangeNote = (s: any, text: Translate): string | undefined =>
  s?.calc?.criRangeBonus ? text('ss.criRangeNote', { bonus: s.calc.criRangeBonus }) : undefined;

const ACCURACY_ROWS: RowSpec[] = [
  { label: 'ss.hit', valueClass: 'summary_stat_atk', keys: ['hit'], read: (s) => num(s?.calc?.totalHit), origin: { label: 'ss.originHit' } },
  {
    label: 'ss.perfectHit',
    valueClass: 'summary_stat_atk',
    keys: ['perfectHit'],
    read: (s) => pct(s?.calc?.totalPerfectHit),
    // Every build starts at DEFAULT_PERFECT_HIT (5), which belongs to no equipped source.
    origin: { label: 'ss.originPerfectHit' },
  },
  {
    label: 'ss.cri',
    valueClass: 'summary_stat_atk',
    keys: ['cri', 'criRange'],
    read: (s) => pct(s?.calc?.totalCri),
    note: criRangeNote,
    // Katar doubles the whole crit rate, the equipment's share included — hence "e arma".
    origin: { label: 'ss.originCri', sumKeys: ['cri'] },
  },
  { label: 'ss.criDmg', valueClass: 'summary_stat_atk', keys: ['criDmg'], read: (s) => pct(s?.criDmg) },
  { label: 'ss.cRate', valueClass: 'summary_stat_atk2', keys: ['cRate'], read: (s) => num(s?.dmg?.cRate), origin: { label: 'ss.originCRate' } },
];

const RESOURCE_ROWS: RowSpec[] = [
  {
    label: 'ss.maxHp',
    valueClass: 'summary_stat_yellow',
    keys: ['hp', 'hpPercent'],
    read: (s) => num(s?.calc?.maxHp),
    origin: { label: 'ss.originHp', sumKeys: ['hp'] },
  },
  {
    label: 'ss.maxSp',
    valueClass: 'summary_stat_yellow',
    keys: ['sp', 'spPercent'],
    read: (s) => num(s?.calc?.maxSp),
    origin: { label: 'ss.originSp', sumKeys: ['sp'] },
  },
];

/**
 * The sustain rows, behind the "Cura e regen." link on the Recursos header rather than in
 * the grid: four rows that read 0% on most builds and that no damage number depends on —
 * the engine never applies any of them (see EquipmentSummaryModel.healReceived and
 * .healPower). Four permanent lines of zeroes at the foot of the tallest column is a poor
 * trade for a figure the reader consults once, when a piece claims to grant it.
 *
 * They read the equipment sum straight and carry no origin: there is no base healing
 * figure for a remainder to be taken against. "Cura recebida" is the heal cast on the
 * character and "Efetividade de cura" the heal it casts — the game words them apart.
 */
const SUSTAIN_ROWS: RowSpec[] = [
  { label: 'ss.hpRegen', valueClass: 'summary_stat_yellow', keys: ['hpRecovRate'], read: (s) => pct(s?.hpRecovRate) },
  { label: 'ss.spRegen', valueClass: 'summary_stat_yellow', keys: ['spRecovRate'], read: (s) => pct(s?.spRecovRate) },
  { label: 'ss.healReceived', valueClass: 'summary_stat_yellow', keys: ['healReceived'], read: (s) => pct(s?.healReceived) },
  { label: 'ss.healPower', valueClass: 'summary_stat_yellow', keys: ['healPower'], read: (s) => pct(s?.healPower) },
];

// TEN / TENM share one line in the game's own window, but they are two independent stats
// with a breakdown each — a single row could only ever carry one delta honestly.
//
// The reflected-damage resistance is not here: it reads 0% on nearly every build, so it
// lives in the "Redução de dano" popover off this group's header, as its last flat-cut
// row (./reduction-breakdown), where a zero costs nothing to hide.
const DEFENCE_ROWS: RowSpec[] = [
  // DEF and DEFM print "50 + 120" and the origin row carries both halves, so its label
  // names them in the same order: an armour's own DEF is not a scripted bonus and can never
  // be listed as a source of its own.
  {
    label: 'ss.def',
    valueClass: 'summary_stat_def',
    keys: ['def'],
    read: (s) => pair(s?.calc?.softDef, s?.calc?.def),
    origin: { label: 'ss.originDef' },
  },
  {
    label: 'ss.mdef',
    valueClass: 'summary_stat_def',
    keys: ['mdef'],
    read: (s) => pair(s?.calc?.softMdef, s?.calc?.mdef),
    origin: { label: 'ss.originMdef' },
  },
  { label: 'ss.res', valueClass: 'summary_stat_def2', keys: ['res'], read: (s) => num(s?.calc?.res), origin: { label: 'ss.originRes' } },
  { label: 'ss.mres', valueClass: 'summary_stat_def2', keys: ['mres'], read: (s) => num(s?.calc?.mres), origin: { label: 'ss.originMres' } },
  {
    label: 'ss.flee',
    valueClass: 'summary_stat_def',
    keys: ['flee', 'perfectDodge'],
    read: (s) => pair(s?.calc?.totalFlee, s?.calc?.totalPerfectDodge),
    origin: { label: 'ss.originFlee' },
  },
];

/** A cast/delay row: the component formats the text (negated, with its unit); the delta is
 *  taken on that same displayed number, so "more negative" reads as the gain it is. */
const castRow = (label: TextKey, key: string, unit = '', deltaDecimals?: number): RowSpec => ({
  label,
  valueClass: 'summary_stat_matk',
  keys: [key],
  greaterIsBetter: false,
  deltaDecimals,
  read: (s, opts) => ({ text: `${opts.bonusValueText(key, n(s?.[key]))}${unit}`, total: -n(s?.[key]) }),
});

const CASTING_ROWS: RowSpec[] = [
  castRow('tl.afterCast', 'acd'),
  castRow('hud.castFixed', 'fct', 's', 3),
  castRow('hud.castVariable', 'vct'),
  {
    // A pure formula over DES/INT — no equipment sources, so no breakdown to open.
    label: 'ss.dex2int1',
    valueClass: 'summary_stat_yellow',
    keys: [],
    read: (s) => num(s?.calc?.dex2int1),
    suffix: (s, text) => (n(s?.calc?.to530) > 0 ? text('ss.dex2int1Missing', { points: formatNumber(n(s.calc.to530)) }) : undefined),
  },
];

type HeadlineSpec = RowSpec & { kind: 'stat' | 'rate'; tooltip?: string };

const HEADLINE_SPECS: HeadlineSpec[] = [
  { kind: 'stat', label: 'ss.atk', valueClass: 'summary_stat_atk', keys: ['atk'], read: (s) => num(n(s?.calc?.totalStatusAtk) + weaponAtk(s)) },
  { kind: 'stat', label: 'ss.matk', valueClass: 'summary_stat_matk', keys: ['matk'], read: (s) => num(n(s?.calc?.totalStatusMatk) + weaponMatk(s)) },
  {
    kind: 'stat',
    label: 'ss.aspd',
    valueClass: 'summary_stat_atk',
    keys: ['aspd', 'aspdPercent', 'skillAspd', 'skillAspdPercent'],
    read: (s) => num(s?.calc?.totalAspd),
    // Only the flat `aspd` is added to the result; `skillAspd` is scaled by AGI and
    // `aspdPercent` by the room left to the cap, so neither can be subtracted as points.
    origin: { label: 'ss.originAspd', sumKeys: ['aspd'] },
  },
  {
    kind: 'rate',
    valueClass: 'summary_highlight',
    keys: [],
    tooltipLabel: 'cs.hitsPerSecond',
    // formatRate is the 0/2 precision this rate is printed at everywhere else (the curve
    // dialog, the cast popover); a compared "7 hits/s" beside "7,14 hits/s" would read as
    // a change that isn't there. The delta is carried in centi-hits so a 0,01 move still
    // registers as one.
    read: (s) => ({ text: `${formatRate(n(s?.calc?.hitPerSecs))} hits/s`, total: Math.round(n(s?.calc?.hitPerSecs) * 100) }),
  },
];

/** Drop the groups a build has no use for, so a column never renders a bare header. */
/**
 * The origins, indexed the way the breakdown dialog asks for them: by the whole key list a
 * click carries (`keys.join('|')`), not by a single key. "Esquiva" asks for `flee` and
 * `perfectDodge` together and "HP máx." for `hp` and `hpPercent`, and the origin belongs to
 * the pair rather than to either half. An exact match also keeps this from firing on some
 * other caller that happens to share one key.
 *
 * Built from the specs above rather than written out again, so the value the origin is the
 * remainder of is the row's own `read` and cannot drift from what the panel prints. The
 * three rows that share a signature with a headline (ATQ, ATQM, Vel.Atq) read the same
 * total either way.
 */
const ORIGIN_BY_KEYS: ReadonlyMap<string, StatOrigin & { total: (s: any) => number }> = new Map(
  [...ATTACK_ROWS, ...MAGIC_ROWS, ...ACCURACY_ROWS, ...RESOURCE_ROWS, ...SUSTAIN_ROWS, ...DEFENCE_ROWS, ...CASTING_ROWS, ...HEADLINE_SPECS]
    .filter((spec) => !!spec.origin)
    .map((spec) => [spec.keys.join('|'), { ...spec.origin!, total: (s: any) => spec.read(s, ORIGIN_READ_OPTS).total }]),
);

/** No row that declares an origin reads `opts` — only the cast/delay rows do, and a
 *  reduction is pure equipment. Passing a stub keeps `read` to one signature. */
const ORIGIN_READ_OPTS = { text: (key: TextKey) => key, bonusValueText: () => '', canBreakdown: () => false } as StatsSummaryOptions;

/** The non-equipment origin of a breakdown lookup, or null when it has none — every value
 *  granted by gear alone (Corpo a corpo, Dano crítico, the cast reductions). */
export function statOriginFor(keys: string[]): (StatOrigin & { total: (s: any) => number }) | null {
  return ORIGIN_BY_KEYS.get(keys.join('|')) ?? null;
}

const groups = (...list: (SummaryGroup | null)[]): SummaryGroup[] => list.filter((g): g is SummaryGroup => !!g);

export function buildStatsSummary(cur: any, cmp: any | null, opts: StatsSummaryOptions): StatsSummaryView {
  const rows = (specs: RowSpec[]) => specs.map((spec) => buildRow(spec, cur, cmp, opts));

  const headline = HEADLINE_SPECS.map((spec): SummaryHeadline => {
    const row = buildRow(spec, cur, cmp, opts);

    return {
      ...row,
      kind: spec.kind,
      // The headline prints its own name — "ATQ 328" — where the rows below put the label
      // in a column of its own. The rate has no name, only the unit inside its value.
      text: spec.label ? `${opts.text(spec.label)} ${row.text}` : row.text,
      // The rate opens the curve rather than a breakdown, so it is clickable regardless of
      // whether any equipment sources it — and then it has a tooltip to promise.
      clickable: spec.kind === 'rate' || row.clickable,
      compareClickable: spec.kind === 'rate' || row.compareClickable,
      tooltip: spec.kind === 'rate' ? opts.text(spec.tooltipLabel!) : row.tooltip,
      compareTooltip: spec.kind === 'rate'
        ? opts.text('cs.compareSuffix', { label: opts.text(spec.tooltipLabel!) })
        : row.compareTooltip,
      // The headline already shouts the figure; the compared one repeats it, but the raw
      // delta belongs to the row below, where it has a column of its own to line up in.
      compare: row.compare ? { ...row.compare, deltaText: spec.kind === 'rate' ? '' : row.compare.deltaText } : null,
    };
  });

  return {
    headline,
    sustain: rows(SUSTAIN_ROWS),
    // Paired so the three columns come out 8 / 8 / 7 rows deep. Ataque with Conjuração
    // rather than with Mágico is what keeps the panel as short as the two input cells
    // beside it — the alternative leaves Defesa+Conjuração nine rows deep and the whole
    // row grows to match.
    columns: [
      groups(
        { title: opts.text('ss.groupAttack'), rows: rows(ATTACK_ROWS) },
        { title: opts.text('ss.groupCasting'), rows: rows(CASTING_ROWS) },
      ),
      groups(
        { title: opts.text('ss.groupMagic'), rows: rows(MAGIC_ROWS) },
        { title: opts.text('ss.groupAccuracy'), rows: rows(ACCURACY_ROWS) },
      ),
      groups(
        { title: opts.text('ss.groupDefence'), rows: rows(DEFENCE_ROWS), showReduction: true },
        { title: opts.text('ss.groupResources'), rows: rows(RESOURCE_ROWS), showSustain: true },
      ),
    ],
  };
}

import { TextKey } from '../i18n';

/**
 * `current` is the LATAM baseline. The 28/10/2026 client moved the fourth-job and
 * expanded-fourth trees onto the 02/06/2022 kRO rebalance: its per-level ATK/MATK tables
 * and its 86 retuned delay rows both reproduce that bundle, where the 31/07/2026 client
 * still printed the pre-rebalance numbers. So the rebalance is the simulator's default,
 * not an opt-in variant.
 *
 * `pre-rebalance` keeps the ratios and timings LATAM ran before that patch. It is what the
 * recordings made up to 09/2026 measured, which is why the replay specs ask for it by name.
 */
export type SkillFormulaVersion = 'current' | 'pre-rebalance' | 'rebalance-2026-02';

/** Display dates are kRO deployments; persisted IDs retain their original names. */
export const SKILL_REBALANCE_REFERENCES: {
  labelKey: TextKey; value: SkillFormulaVersion; references: { labelKey: TextKey; url: string }[];
}[] = [
  { labelKey: 'formula.rebalance2022', value: 'current', references: [
    { labelKey: 'formula.refKro', url: 'https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7600&curpage=1' },
    { labelKey: 'formula.refDivinePride', url: 'https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/13/#comment-11126' },
    { labelKey: 'formula.refSigma', url: 'https://sigmathefallen.blogspot.com/2025/02/' },
  ] },
  { labelKey: 'formula.rebalance2026', value: 'rebalance-2026-02', references: [
    { labelKey: 'formula.refKro', url: 'https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7670&curpage=1' },
    { labelKey: 'formula.refDivinePride', url: 'https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/14/#comment-12421' },
    { labelKey: 'formula.refSigma', url: 'https://sigmathefallen.blogspot.com/2026/02/' },
  ] },
];

/**
 * `current` is listed on its own rather than mapped from the references above: that list
 * now opens with `current` itself, so mapping it would print the baseline twice.
 */
export const SKILL_FORMULA_VERSION_OPTIONS: { labelKey: TextKey; value: SkillFormulaVersion }[] = [
  { labelKey: 'formula.current', value: 'current' },
  { labelKey: 'formula.preRebalance', value: 'pre-rebalance' },
  { labelKey: 'formula.rebalance2026', value: 'rebalance-2026-02' },
];

/**
 * `rebalance-2022-06` was this bundle's ID while it was still a variant. A build saved
 * then asked for exactly what `current` is now, so it keeps the numbers it was saved with.
 */
export function normalizeSkillFormulaVersion(value: unknown): SkillFormulaVersion {
  return value === 'pre-rebalance' || value === 'rebalance-2026-02' ? value : 'current';
}

/** True while the build reads the LATAM baseline, including the model's unset default. */
export function isLatamBaseline(version?: SkillFormulaVersion): boolean {
  return version !== 'pre-rebalance' && version !== 'rebalance-2026-02';
}

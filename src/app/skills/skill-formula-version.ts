import { TextKey } from '../i18n';

export type SkillFormulaVersion = 'current' | 'rebalance-2022-06' | 'rebalance-2026-02';

/** Display dates are kRO deployments; persisted IDs retain their original names. */
export const SKILL_REBALANCE_REFERENCES: {
  labelKey: TextKey; value: SkillFormulaVersion; references: { labelKey: TextKey; url: string }[];
}[] = [
  { labelKey: 'formula.rebalance2022', value: 'rebalance-2022-06', references: [
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

export const SKILL_FORMULA_VERSION_OPTIONS: { labelKey: TextKey; value: SkillFormulaVersion }[] = [
  { labelKey: 'formula.current', value: 'current' },
  ...SKILL_REBALANCE_REFERENCES.map(({ labelKey, value }) => ({ labelKey, value })),
];

export function normalizeSkillFormulaVersion(value: unknown): SkillFormulaVersion {
  return value === 'rebalance-2022-06' || value === 'rebalance-2026-02' ? value : 'current';
}

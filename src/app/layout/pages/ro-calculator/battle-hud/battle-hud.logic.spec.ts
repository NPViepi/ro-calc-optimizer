import { describe, expect, it } from 'vitest';
import {
  buildDpsSteps,
  buildGraphClusters,
  buildOptimizeInfo,
  buildRotationPickerOptions,
  computeCastbar,
  alignCritRateSteps,
  CritRateRowCache,
  computeTimeToKill,
  computeZeroPosWhatIf,
  deltaPercent,
  identifyCastBottleneck,
  isCritWeighted,
  pickBiggerDpsSide,
  pickHeroDamage,
  pickHitsPerSec,
} from './battle-hud.logic';
import { DamageFormulaNode } from '../../../../models/damage-summary.model';
import { DEFAULT_CATALOG, TextKey } from 'src/app/i18n';
import { TextParams, translate } from 'src/app/core/i18n';

/** buildOptimizeInfo names the cast components through a translator; pt-BR is the source catalog. */
const text = (key: TextKey, params?: TextParams) => translate(DEFAULT_CATALOG, key, params);

describe('buildGraphClusters', () => {
  /** The engine-emitted chips only — drops the "%"/"Adicional" chips buildGraphClusters
   *  synthesizes, which have their own tests below. */
  const engineInputs = (cluster: { inputs: DamageFormulaNode[] }) => cluster.inputs.filter((i) => !i.id.endsWith('_pct') && !i.id.endsWith('_delta'));

  it('returns one cluster per stage node, in order', () => {
    const nodes: DamageFormulaNode[] = [
      { id: 'a', label: 'A', value: 10, inputs: [], kind: 'stage' },
      { id: 'b', label: 'B', value: 20, inputs: ['a'], kind: 'stage' },
    ];
    const clusters = buildGraphClusters({ nodes });
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.stage)).toEqual(nodes);
    expect(engineInputs(clusters[0])).toEqual([]);
    expect(engineInputs(clusters[1])).toEqual([]);
  });

  it('attaches an `input`-kind dependency as a chip on the stage that consumes it', () => {
    const statusAtk: DamageFormulaNode = { id: 'statusAtk', label: 'Status', value: 100, inputs: [], kind: 'input' };
    const weaponAtk: DamageFormulaNode = { id: 'weaponAtk', label: 'Arma', value: 50, inputs: [], kind: 'input' };
    const atkBase: DamageFormulaNode = { id: 'atkBase', label: 'Base', value: 50, inputs: ['weaponAtk'], kind: 'stage' };
    const atk: DamageFormulaNode = { id: 'atk', label: 'ATQ', value: 150, inputs: ['statusAtk', 'atkBase'], kind: 'stage' };
    const clusters = buildGraphClusters({ nodes: [statusAtk, weaponAtk, atkBase, atk] });

    expect(clusters).toHaveLength(2);
    // atkBase depends on weaponAtk (input) -> chip; statusAtk isn't one of its inputs
    expect(clusters[0].stage).toBe(atkBase);
    expect(engineInputs(clusters[0])).toEqual([weaponAtk]);
    // atk depends on statusAtk (input) and atkBase (stage, no chip)
    expect(clusters[1].stage).toBe(atk);
    expect(engineInputs(clusters[1])).toEqual([statusAtk]);
  });

  it('never attaches the same input node to two clusters', () => {
    const shared: DamageFormulaNode = { id: 'shared', label: 'Shared', value: 5, inputs: [], kind: 'input' };
    const stageA: DamageFormulaNode = { id: 'stageA', label: 'A', value: 5, inputs: ['shared'], kind: 'stage' };
    const stageB: DamageFormulaNode = { id: 'stageB', label: 'B', value: 5, inputs: ['shared', 'stageA'], kind: 'stage' };
    const clusters = buildGraphClusters({ nodes: [shared, stageA, stageB] });

    expect(engineInputs(clusters[0])).toEqual([shared]);
    expect(engineInputs(clusters[1])).toEqual([]); // already consumed by stageA's cluster
  });

  it('returns an empty array for an undefined/empty graph', () => {
    expect(buildGraphClusters(undefined)).toEqual([]);
    expect(buildGraphClusters({ nodes: [] })).toEqual([]);
  });
});

describe('buildGraphClusters synthesized chips', () => {
  const chain = (...stages: Array<Partial<DamageFormulaNode> & { id: string; value: number }>): DamageFormulaNode[] =>
    stages.map((s, i) => ({ label: s.id, inputs: i ? [stages[i - 1].id] : [], kind: 'stage', ...s } as DamageFormulaNode));

  const chip = (cluster: { inputs: DamageFormulaNode[] }, suffix: '_pct' | '_delta') => cluster.inputs.find((i) => i.id.endsWith(suffix));

  it('adds a "%" chip carrying the stage\'s percent and its source keys', () => {
    const nodes = chain({ id: 'atk', value: 1000 }, { id: 'atkPercentStage', value: 1250, percent: 25, keys: ['atkPercent'] });
    const [, stage] = buildGraphClusters({ nodes });

    expect(chip(stage, '_pct')).toMatchObject({ id: 'atkPercentStage_pct', value: 25, unit: 'percent', keys: ['atkPercent'], kind: 'input' });
  });

  it('strips the percentage the stage label already carries, so chips do not read "Hab. Base 2475% %"', () => {
    const nodes = chain(
      { id: 'atk', value: 100, label: 'ATQ' },
      { id: 'baseSkillDmg', value: 2475, label: 'Hab. Base 2475%', percent: 2375, keys: ['flatDmg'] },
    );
    const [, stage] = buildGraphClusters({ nodes });

    expect(chip(stage, '_pct')!.label).toBe('Hab. Base %');
    expect(chip(stage, '_delta')!.label).toBe('Hab. Base Adicional');
  });

  it('strips a signed percentage too ("ATQ +25%")', () => {
    const nodes = chain({ id: 'atk', value: 100 }, { id: 'atkPercentStage', value: 125, label: 'ATQ +25%', percent: 25, keys: ['atkPercent'] });
    expect(chip(buildGraphClusters({ nodes })[1], '_pct')!.label).toBe('ATQ %');
  });

  it('omits the "%" chip for additive stages that carry no percent', () => {
    const nodes = chain({ id: 'atk', value: 1000 }, { id: 'atkMastery', value: 1100 });
    const [, stage] = buildGraphClusters({ nodes });

    expect(chip(stage, '_pct')).toBeUndefined();
    // ...but the delta chip still shows what the step added
    expect(chip(stage, '_delta')).toMatchObject({ value: 100 });
  });

  it('makes anterior + adicional equal the stage total exactly, even when floor() breaks anterior x %', () => {
    // 1000 * 1.25 = 1250, but the engine floored an intermediate to 1249 — the chip must
    // report the real difference (249), not the 250 the percentage implies.
    const nodes = chain({ id: 'atk', value: 1000 }, { id: 'atkPercentStage', value: 1249, percent: 25, keys: ['atkPercent'] });
    const [prev, stage] = buildGraphClusters({ nodes });

    const delta = chip(stage, '_delta')!;
    expect(delta.value).toBe(249);
    expect(prev.stage.value + delta.value).toBe(stage.stage.value);
    expect(delta.calc?.rows.at(-1)).toEqual({ label: 'Resultado (atkPercentStage)', display: '1.249', emphasis: true });
    expect(delta.calc?.note).toContain('arredonda');
  });

  it("lends a stage's own derivation to its 'Adicional' chip", () => {
    // The class ATQ adjustment (CharacterBase.getFinalAtkCalc) is the case: "anterior +
    // adicional" says nothing about Kihop or which Fúria paid, so the chip borrows the
    // stage's rows and keeps only its own closing total.
    const nodes = chain(
      { id: 'patk', value: 14_041.95, label: 'P.ATQ +95%' },
      {
        id: 'atkClassAdjust',
        value: 69_353,
        label: 'ATQ (ajuste de classe)',
        calc: {
          rows: [
            { label: 'Kihop Nv 5 (+85%)', display: '25.975' },
            { label: '× Fúria Lunar', display: '69.353,25' },
            { label: 'ATQ (ajuste de classe)', display: '69.353', emphasis: true },
          ],
          note: 'Fúria Lunar é a Fúria que alcança este alvo.',
          link: { label: 'Fúria Lunar no bROWiki', url: 'https://browiki.org/wiki/F%C3%BAria_Lunar' },
        },
      },
    );
    const delta = chip(buildGraphClusters({ nodes })[1], '_delta')!;

    expect(delta.calc?.rows.map((r) => r.label)).toEqual([
      'Valor anterior (P.ATQ +95%)',
      'Kihop Nv 5 (+85%)',
      '× Fúria Lunar',
      'Adicional',
      'Resultado (ATQ (ajuste de classe))',
    ]);
    // The stage's own emphasised row is dropped: the chip closes on the same figure.
    expect(delta.calc?.rows.at(-1)).toEqual({ label: 'Resultado (ATQ (ajuste de classe))', display: '69.353', emphasis: true });
    expect(delta.calc?.note).toBe('Fúria Lunar é a Fúria que alcança este alvo.');
    expect(delta.calc?.link?.url).toBe('https://browiki.org/wiki/F%C3%BAria_Lunar');
  });

  it('omits the "Adicional" chip on the first stage and whenever the value did not move', () => {
    const nodes = chain({ id: 'first', value: 1000 }, { id: 'noop', value: 1000, percent: 0, keys: ['x'] });
    const [first, noop] = buildGraphClusters({ nodes });

    expect(chip(first, '_delta')).toBeUndefined(); // nothing precedes it
    expect(chip(noop, '_delta')).toBeUndefined(); // delta is 0
    expect(chip(noop, '_pct')).toBeDefined(); // the % chip is still there
  });

  it('reports a negative adicional for reduction stages', () => {
    const nodes = chain({ id: 'atk', value: 1000 }, { id: 'defReduction', value: 700, percent: -30, keys: ['pene_res'] });
    const [, stage] = buildGraphClusters({ nodes });

    const delta = chip(stage, '_delta')!;
    expect(delta.value).toBe(-300);
    expect(delta.calc?.rows).toContainEqual({ label: 'Adicional', display: '-300' });
    expect(delta.calc?.rows).toContainEqual({ label: 'Multiplicador', display: '-30%' });
  });
});

describe('computeTimeToKill', () => {
  it('divides HP by DPS and keeps tenths for sub-minute fights', () => {
    const r = computeTimeToKill(10_000, 800)!;
    expect(r.seconds).toBeCloseTo(12.5, 5);
    expect(r.text).toBe('12,5s'); // pt-BR decimal separator
  });

  it('switches to min/s past a minute, zero-padding the seconds', () => {
    expect(computeTimeToKill(125_000, 1000)!.text).toBe('2min 05s');
    expect(computeTimeToKill(60_000, 1000)!.text).toBe('1min 00s');
  });

  it('switches to h/min past an hour', () => {
    expect(computeTimeToKill(3_600_000, 1000)!.text).toBe('1h 00min');
    expect(computeTimeToKill(5_000_000, 1000)!.text).toBe('1h 23min');
  });

  it('caps absurd durations rather than printing a precise-looking number', () => {
    // the practice Dummy: 2 billion HP at a modest DPS runs to hundreds of hours
    expect(computeTimeToKill(2_000_000_000, 927)!.text).toBe('> 24h');
  });

  it('returns null when there is nothing to divide (autospell shows no DPS, or no HP)', () => {
    expect(computeTimeToKill(10_000, 0)).toBeNull();
    expect(computeTimeToKill(0, 800)).toBeNull();
    expect(computeTimeToKill(10_000, -5)).toBeNull();
  });
});

describe('computeCastbar', () => {
  it('splits sequential + parallel segment proportions relative to hitPeriod', () => {
    // fixa 0.2 + variável 0.5 + max(pós 2.52, recarga 1.0) = 3.22
    const r = computeCastbar({
      reducedFct: 0.2,
      reducedVct: 0.5,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0.7,
      hitPeriod: 3.22,
      totalHitPerSec: 0.31,
    });
    expect(r.mode).toBe('sequential');
    expect(r.fixed!.percent).toBeCloseTo((0.2 / 3.22) * 100, 5);
    expect(r.variable!.percent).toBeCloseTo((0.5 / 3.22) * 100, 5);
    expect(r.parallel!.blockSeconds).toBe(2.52);
    expect(r.parallel!.blockPercent).toBeCloseTo((2.52 / 3.22) * 100, 5);
    // the three widths must fill the whole bar
    expect(r.fixed!.percent + r.variable!.percent + r.parallel!.blockPercent).toBeCloseTo(100, 5);
  });

  it('picks pós as the parallel winner when it is longer than recarga', () => {
    const r = computeCastbar({
      reducedFct: 0,
      reducedVct: 0,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0,
      hitPeriod: 2.52,
      totalHitPerSec: 0.39,
    });
    expect(r.parallel!.winner).toBe('pos');
    // recharge lane fills proportionally to its share of the winning lane's duration
    expect(r.parallel!.recFillPercent).toBeCloseTo((1.0 / 2.52) * 100, 5);
  });

  it('picks recarga as the parallel winner when it is longer than pós', () => {
    const r = computeCastbar({
      reducedFct: 0,
      reducedVct: 0,
      reducedAcd: 0.5,
      reducedCd: 4,
      castPeriod: 0,
      hitPeriod: 4,
      totalHitPerSec: 0.25,
    });
    expect(r.parallel!.winner).toBe('recarga');
    expect(r.parallel!.recFillPercent).toBe(100);
  });

  it('zero-recarga case: recharge lane fill is 0 and pós alone wins', () => {
    const r = computeCastbar({
      reducedFct: 0.1,
      reducedVct: 0.1,
      reducedAcd: 1.5,
      reducedCd: 0,
      castPeriod: 0.2,
      hitPeriod: 1.7,
      totalHitPerSec: 0.58,
    });
    expect(r.mode).toBe('sequential');
    expect(r.parallel!.winner).toBe('pos');
    expect(r.parallel!.recFillPercent).toBe(0);
  });

  it('falls back to a single segment when hitEveryNSec forces blockPeriod to 0', () => {
    // calcSkillAspd: blockPeriod = hitEveryNSec > 0 ? 0 : ...; castPeriod = hitEveryNSec.
    // reducedAcd/reducedCd may still carry nonzero raw skill values, but must be ignored.
    const r = computeCastbar({
      reducedFct: 0,
      reducedVct: 0,
      reducedAcd: 1, // would normally contribute to the block, but hitEveryNSec forces it out
      reducedCd: 0,
      castPeriod: 0.5,
      hitPeriod: 0.5,
      totalHitPerSec: 2,
    });
    expect(r.mode).toBe('single');
    expect(r.single).toEqual({ seconds: 0.5, percent: 100 });
    expect(r.parallel).toBeUndefined();
  });
});

describe('identifyCastBottleneck', () => {
  it('flags pós as the bottleneck when it is the largest time-costing component', () => {
    expect(identifyCastBottleneck({ reducedFct: 0.2, reducedVct: 0.5, reducedAcd: 2.52, reducedCd: 1.0 })).toBe('pos');
  });

  it('flags recarga as the bottleneck when it outlasts pós', () => {
    expect(identifyCastBottleneck({ reducedFct: 0.1, reducedVct: 0.1, reducedAcd: 0.2, reducedCd: 3 })).toBe('recarga');
  });

  it('flags variável as the bottleneck when the cast itself dominates', () => {
    expect(identifyCastBottleneck({ reducedFct: 0.1, reducedVct: 3, reducedAcd: 0.2, reducedCd: 0 })).toBe('variavel');
  });
});

describe('computeZeroPosWhatIf', () => {
  it('computes the DPS gain from zeroing the after-cast delay (ASPD has headroom, so it never binds)', () => {
    // hitPeriod 3.22 -> newHitPeriod = castPeriod(0.7) + reducedCd(1.0) = 1.7
    const r = computeZeroPosWhatIf({ dps: 17480, hitPeriod: 3.22, castPeriod: 0.7, reducedCd: 1.0, aspdHitsPerSec: 99 })!;
    expect(r.newHitPeriod).toBeCloseTo(1.7, 5);
    expect(r.gainPercent).toBeCloseTo((3.22 / 1.7 - 1) * 100, 5);
    expect(r.newDps).toBeCloseTo(17480 * (3.22 / 1.7), 5);
  });

  it('returns null when the new hit period would be non-positive', () => {
    expect(computeZeroPosWhatIf({ dps: 100, hitPeriod: 1, castPeriod: 0, reducedCd: 0, aspdHitsPerSec: 99 })).toBeNull();
  });

  it('reports zero gain when pós was never the bottleneck (recarga unchanged)', () => {
    const r = computeZeroPosWhatIf({ dps: 500, hitPeriod: 2, castPeriod: 1, reducedCd: 1, aspdHitsPerSec: 99 })!;
    expect(r.newHitPeriod).toBe(2);
    expect(r.gainPercent).toBe(0);
  });

  it('clamps the post-what-if rate at the ASPD ceiling when zeroing pós would otherwise exceed it', () => {
    // castRate = 1/3.22 ≈ 0.3106/s (below the 2/s ASPD ceiling, so the "current" baseline
    // is uncapped). newCastRate = 1/1.7 ≈ 0.588/s — still below 2/s, so ASPD wouldn't
    // bind here either; use a tighter aspdHitsPerSec (0.4) so the new rate is clamped.
    const r = computeZeroPosWhatIf({ dps: 17480, hitPeriod: 3.22, castPeriod: 0.7, reducedCd: 1.0, aspdHitsPerSec: 0.4 })!;
    const castRate = 1 / 3.22;
    const newCastRate = 1 / 1.7;
    expect(newCastRate).toBeGreaterThan(0.4); // sanity: the uncapped new rate would exceed the ceiling
    // effectiveRate = min(castRate, 0.4) = castRate (0.3106 < 0.4); newEffectiveRate clamps to 0.4.
    expect(r.gainPercent).toBeCloseTo((0.4 / castRate - 1) * 100, 5);
    expect(r.newDps).toBeCloseTo(17480 * (0.4 / castRate), 5);
  });
});

describe('buildOptimizeInfo', () => {
  it('bundles bottleneck, per-component hints, and the what-if together (ASPD has headroom)', () => {
    const info = buildOptimizeInfo({
      reducedFct: 0.2,
      reducedVct: 0.5,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0.7,
      hitPeriod: 3.22,
      dps: 17480,
      sumDex2Int1: 985,
      aspdHitsPerSec: 99,
    }, text);
    expect(info.bottleneck).toBe('pos');
    expect(info.components.map((c) => c.key)).toEqual(['fixa', 'variavel', 'pos', 'recarga', 'aspd']);
    expect(info.whatIf).not.toBeNull();
    expect(info.components.find((c) => c.key === 'variavel')!.hint).toContain('985 / 530');
    expect(info.isOptimized).toBe(false);
    const aspd = info.components.find((c) => c.key === 'aspd')!;
    expect(aspd.hideSeconds).toBe(true);
    expect(aspd.doneText).toContain('suporta a conjuração ✓');
  });

  it('flags nothing to improve when fixa/variável/pós are all ~0, ASPD keeps up, and the what-if gain is negligible', () => {
    // castPeriod (fixa+variável) = 0, blockPeriod = max(acd, cd) = recarga = 0.5 -> hitPeriod 0.5.
    // Zeroing pós (already 0) can't change hitPeriod, so the what-if reports 0% gain.
    const info = buildOptimizeInfo({
      reducedFct: 0,
      reducedVct: 0,
      reducedAcd: 0,
      reducedCd: 0.5,
      castPeriod: 0,
      hitPeriod: 0.5,
      dps: 1000,
      sumDex2Int1: 0,
      aspdHitsPerSec: 99,
    }, text);
    expect(info.isOptimized).toBe(true);
    expect(info.headline).toBe('Conjuração já otimizada — nada relevante a melhorar.');
    expect(info.whatIf).toBeNull();
    expect(info.components.find((c) => c.key === 'fixa')!.doneText).toBe('já zerada ✓');
    expect(info.components.find((c) => c.key === 'variavel')!.doneText).toBe('já zerada ✓');
    expect(info.components.find((c) => c.key === 'pos')!.doneText).toBe('já zerada ✓');
    // Recarga is never reducible, so it never gets a "done" checkmark of its own.
    expect(info.components.find((c) => c.key === 'recarga')!.doneText).toBeNull();
  });

  it('shows the stats-met message for variável once DEX*2+INT reaches 530, regardless of leftover seconds', () => {
    const info = buildOptimizeInfo({
      reducedFct: 0.2,
      reducedVct: 0.01,
      reducedAcd: 0.3,
      reducedCd: 0.1,
      castPeriod: 0.21,
      hitPeriod: 0.51,
      dps: 1000,
      sumDex2Int1: 530,
      aspdHitsPerSec: 99,
    }, text);
    const variavel = info.components.find((c) => c.key === 'variavel')!;
    expect(variavel.doneText).toBe('stats já zeram a conjuração variável ✓');
    expect(variavel.hint).toContain('530 / 530');
  });

  it('suppresses the what-if line when the projected DPS gain from zeroing pós is under 1%', () => {
    // Recarga (3.0) and pós (3.02) are nearly tied, so zeroing pós barely moves hitPeriod
    // (3.22 -> 3.2): ~0.625% gain, below the 1% threshold worth surfacing.
    const info = buildOptimizeInfo({
      reducedFct: 0.1,
      reducedVct: 0.1,
      reducedAcd: 3.02,
      reducedCd: 3.0,
      castPeriod: 0.2,
      hitPeriod: 3.22,
      dps: 1000,
      sumDex2Int1: 0,
      aspdHitsPerSec: 99,
    }, text);
    expect(info.whatIf).toBeNull();
  });

  it('ASPD-limited: bottleneck flips to aspd, headline names Vel.Atq, and the zero-pós what-if is suppressed', () => {
    // castRate = 1/3.22 ≈ 0.3106/s; aspdHitsPerSec 0.2/s can't keep up, so ASPD is the real cap
    // even though pós is nominally the largest cast component.
    const info = buildOptimizeInfo({
      reducedFct: 0.2,
      reducedVct: 0.5,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0.7,
      hitPeriod: 3.22,
      dps: 17480,
      sumDex2Int1: 985,
      aspdHitsPerSec: 0.2,
    }, text);
    expect(info.bottleneck).toBe('aspd');
    expect(info.headline).toBe('A Vel.Atq limita a conjuração — aumente a Vel.Atq para ganhar DPS.');
    expect(info.isOptimized).toBe(false);
    const aspd = info.components.find((c) => c.key === 'aspd')!;
    expect(aspd.doneText).toBeNull();
    expect(aspd.hint).toContain('limita a conjuração');
    expect(aspd.hint).toContain('0,31/s'); // pt-BR decimal separator, 2 decimals (fmtRate)
    expect(aspd.hint).toContain('0,2/s');
    // Zeroing pós only raises the cast-mechanics rate, which ASPD still caps at 0.2/s —
    // the effective rate (already 0.2/s) doesn't move, so the what-if gain is ~0%.
    expect(info.whatIf).toBeNull();
  });

  it('ASPD-headroom: aspd component shows the "suporta" checkmark and bottleneck stays a cast component', () => {
    const info = buildOptimizeInfo({
      reducedFct: 0.2,
      reducedVct: 0.5,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0.7,
      hitPeriod: 3.22,
      dps: 17480,
      sumDex2Int1: 985,
      aspdHitsPerSec: 2, // castRate ≈ 0.31/s, well within a 2/s ASPD ceiling
    }, text);
    expect(info.bottleneck).toBe('pos');
    const aspd = info.components.find((c) => c.key === 'aspd')!;
    expect(aspd.doneText).toContain('suporta a conjuração ✓');
    expect(aspd.doneText).toContain('2/s'); // formatRate: no forced decimal on a whole rate
    // The what-if still fires (pós is real, and 2/s headroom doesn't clamp the new rate: 1/1.7 ≈ 0.59/s).
    expect(info.whatIf).not.toBeNull();
    expect(info.whatIf!.gainPercent).toBeCloseTo((3.22 / 1.7 - 1) * 100, 5);
  });

  it('stops blaming ASPD for a rate the old floored ceiling was hiding', () => {
    // Regression for the `floor(50 / (200 - VelAtq))` the engine used to apply. A build
    // at VelAtq 174 really supports 50/26 = 1,92 uses/s, but the floor reported 1/s — so
    // every skill casting between 1 and 1,92/s was told "ASPD limita a conjuração" and
    // sent chasing attack speed it did not need.
    const build = {
      reducedFct: 0,
      reducedVct: 0,
      reducedAcd: 0.2,
      reducedCd: 0.466,
      castPeriod: 0.2,
      hitPeriod: 1 / 1.5, // the cast mechanics allow 1,5 uses/s
      dps: 1000,
      sumDex2Int1: 985,
    };

    expect(buildOptimizeInfo({ ...build, aspdHitsPerSec: 1 }, text).bottleneck).toBe('aspd');

    const fixed = buildOptimizeInfo({ ...build, aspdHitsPerSec: 1.92 }, text);
    expect(fixed.bottleneck).not.toBe('aspd');
    expect(fixed.components.find((c) => c.key === 'aspd')!.doneText).toContain('suporta a conjuração ✓');
  });

  it('what-if capped: zeroing pós would exceed the ASPD rate, so the gain reflects the clamp instead of the raw cast-time ratio', () => {
    // newCastRate = 1/1.7 ≈ 0.588/s would normally give ~89% gain, but aspdHitsPerSec 0.4/s
    // clamps the new effective rate — the surfaced gain must reflect the clamp, not 89%.
    const info = buildOptimizeInfo({
      reducedFct: 0.2,
      reducedVct: 0.5,
      reducedAcd: 2.52,
      reducedCd: 1.0,
      castPeriod: 0.7,
      hitPeriod: 3.22,
      dps: 17480,
      sumDex2Int1: 985,
      aspdHitsPerSec: 0.4,
    }, text);
    const castRate = 1 / 3.22;
    expect(info.whatIf).not.toBeNull();
    expect(info.whatIf!.gainPercent).toBeCloseTo((0.4 / castRate - 1) * 100, 5);
    expect(info.whatIf!.gainPercent).toBeLessThan(((1 / 1.7) / castRate - 1) * 100); // less than the uncapped gain
  });
});

describe('pickBiggerDpsSide', () => {
  it('picks current when it is larger', () => {
    expect(pickBiggerDpsSide(17480, 17040)).toBe('current');
  });

  it('picks simulated when it is larger', () => {
    expect(pickBiggerDpsSide(15000, 17040)).toBe('simulated');
  });

  it('ties when both sides are equal', () => {
    expect(pickBiggerDpsSide(1000, 1000)).toBe('tie');
  });
});

describe('pickHeroDamage', () => {
  it('uses base skill figures when no effected damage is present', () => {
    const r = pickHeroDamage({ skillDps: 1000, skillMinDamage: 100, skillMaxDamage: 200, effectedSkillDamageMin: 0 }, true);
    expect(r).toEqual({ dps: 1000, min: 100, max: 200, effected: false });
  });

  it('switches to effected figures when present and a chance is selected', () => {
    const r = pickHeroDamage(
      {
        skillDps: 1000,
        skillMinDamage: 100,
        skillMaxDamage: 200,
        effectedSkillDps: 1200,
        effectedSkillDamageMin: 150,
        effectedSkillDamageMax: 250,
      },
      true,
    );
    expect(r).toEqual({ dps: 1200, min: 150, max: 250, effected: true });
  });

  it('handles a missing dmg object', () => {
    expect(pickHeroDamage(undefined, true)).toEqual({ dps: 0, min: 0, max: 0, effected: false });
  });

  // Fix 10: unselecting the last Efeito leaves totalSummary.dmg.effectedSkillDamageMin
  // stale (parent pipeline skips the refresh) — hasSelectedChances=false must force the
  // base figures regardless of what's still sitting in the effected fields.
  it('falls back to base figures when no chance is selected, even if effected damage is still present', () => {
    const r = pickHeroDamage(
      {
        skillDps: 1000,
        skillMinDamage: 100,
        skillMaxDamage: 200,
        effectedSkillDps: 1200,
        effectedSkillDamageMin: 150,
        effectedSkillDamageMax: 250,
      },
      false,
    );
    expect(r).toEqual({ dps: 1000, min: 100, max: 200, effected: false });
  });
});

describe('deltaPercent', () => {
  it('computes a positive delta', () => {
    expect(deltaPercent(100, 120)).toBe(20);
  });

  it('computes a negative delta', () => {
    expect(deltaPercent(17480, 17040)).toBeCloseTo(((17040 - 17480) / 17480) * 100, 5);
  });

  it('returns null when current is 0', () => {
    expect(deltaPercent(0, 50)).toBeNull();
  });
});

describe('pickHitsPerSec', () => {
  it('uses the base cast rate when no Efeito is selected', () => {
    expect(pickHitsPerSec({ calcSkill: { totalHitPerSec: 6 }, calc: { hitPerSecs: 10 } }, false)).toBe(6);
  });

  it('prefers the effected rate when an Efeito is selected', () => {
    expect(pickHitsPerSec({ dmg: { effectedSkillHitsPerSec: 7 }, calcSkill: { totalHitPerSec: 6 }, calc: { hitPerSecs: 10 } }, true)).toBe(7);
  });

  it('ignores a stale effected rate when no Efeito is selected', () => {
    expect(pickHitsPerSec({ dmg: { effectedSkillHitsPerSec: 7 }, calcSkill: { totalHitPerSec: 6 }, calc: { hitPerSecs: 10 } }, false)).toBe(6);
  });

  it('caps the rate at what VelAtq (ASPD) actually supports', () => {
    expect(pickHitsPerSec({ calcSkill: { totalHitPerSec: 9 }, calc: { hitPerSecs: 4 } }, false)).toBe(4);
  });

  it('treats a missing ASPD figure as uncapped', () => {
    expect(pickHitsPerSec({ calcSkill: { totalHitPerSec: 9 }, calc: { hitPerSecs: 0 } }, false)).toBe(9);
  });

  it('returns 0 for a missing summary, so the compare side stays blank', () => {
    expect(pickHitsPerSec(undefined, true)).toBe(0);
  });
});

describe('buildRotationPickerOptions', () => {
  /**
   * Ataque básico is offered to every class, unconditionally. It used to follow the app-config
   * "Ocultar Ataque Básico" switch — a 2023 preference about the old summary's basic-attack
   * PANEL — which defaults to on, so a rotation could not include the basic attack at all
   * until someone found and turned that switch off.
   */
  const BASIC = '__basic__';
  const BOWLING_BASH = { label: 'Bowling Bash', value: 'Bowling Bash==10', icon: 62, levelList: [] };
  const MAGNUM_BREAK = { label: 'Magnum Break', value: 'Magnum Break==10', icon: 7, levelList: [] };

  it('offers ataque básico first, ahead of the class skills', () => {
    const options = buildRotationPickerOptions(BASIC, [BOWLING_BASH, MAGNUM_BREAK], text);

    expect(options[0]).toEqual({ label: 'Ataque básico', value: BASIC, isBasic: true });
    expect(options.map((o) => o.value)).toEqual([BASIC, BOWLING_BASH.value, MAGNUM_BREAK.value]);
  });

  it('offers it to a class with no offensive skills at all', () => {
    // The floor of the guarantee: whatever the class, the picker is never empty.
    for (const atkSkills of [[], null, undefined]) {
      const options = buildRotationPickerOptions(BASIC, atkSkills, text);

      expect(options).toHaveLength(1);
      expect(options[0].value).toBe(BASIC);
    }
  });

  it('flags only ataque básico as basic', () => {
    // `isBasic` is what makes the row render the sword icon and read its damage off
    // `dmg.basic*` instead of a skill solve.
    const options = buildRotationPickerOptions(BASIC, [BOWLING_BASH], text);

    expect(options.filter((o) => o.isBasic)).toHaveLength(1);
    expect(options[1].isBasic).toBeUndefined();
  });
});

describe('isCritWeighted', () => {
  it('is true only while the skill crits on some uses but not all', () => {
    expect(isCritWeighted(true, 38)).toBe(true);
    expect(isCritWeighted(true, 0)).toBe(false);
    expect(isCritWeighted(true, 100)).toBe(false);
    expect(isCritWeighted(false, 38)).toBe(false);
  });

  it('treats missing state as not weighted', () => {
    expect(isCritWeighted(undefined, undefined)).toBe(false);
  });
});

describe('buildDpsSteps crit-weighted mean', () => {
  // Centelha das Trevas Nv10 at 38% crit, the case that started this: the card showed
  // 1.760.192 (the crit), the "sem crít." row 1.114.048, and the rotação row 1.359.582 —
  // which is neither of the first two, and had nothing on screen explaining it.
  const dmg = {
    skillDpsInputMin: 1_114_048,
    skillDpsInputMax: 1_114_048,
    skillDpsInputCriDmg: 1_760_192,
    skillDpsInputHitsPerSec: 1,
    skillCriRateToMonster: 38,
    skillAccuracy: 100,
    skillTotalHit: 1,
  };

  it('averages the two outcomes by the crit rate', () => {
    const steps = buildDpsSteps(dmg)!;

    expect(steps.avgDamagePerHit).toBe(1_359_582);
    expect(steps.damagePerUse).toBe(1_359_582);
  });

  it('splits the mean into the two parts that make it up', () => {
    const steps = buildDpsSteps(dmg)!;

    expect(steps.criPart).toBeCloseTo(0.38 * 1_760_192, 2);
    expect(steps.noCriPart).toBeCloseTo(0.62 * 1_114_048, 2);
    // The parts sum to the mean before the engine floors it.
    expect(steps.criPart + steps.noCriPart - steps.avgDamagePerHit).toBeLessThan(1);
  });

  it('sums the mean over every hit for the per-use figure', () => {
    const steps = buildDpsSteps({ ...dmg, skillTotalHit: 3 })!;

    expect(steps.damagePerUse).toBe(3 * 1_359_582);
  });

  it('collapses to the single outcome at 0% and at 100% crit', () => {
    expect(buildDpsSteps({ ...dmg, skillCriRateToMonster: 0 })!.avgDamagePerHit).toBe(1_114_048);
    expect(buildDpsSteps({ ...dmg, skillCriRateToMonster: 100 })!.avgDamagePerHit).toBe(1_760_192);
  });
});

describe('alignCritRateSteps', () => {
  const cur = { steps: [{ key: 'luk', label: 'CRIT por SOR', value: 40, kind: 'add' }, { key: 'total', label: 'Tx. Crítico', value: 99, kind: 'total' }] } as any;

  it('pairs the two builds row by row when the derivation has the same shape', () => {
    const sim = { steps: [{ key: 'luk', value: 45 }, { key: 'total', value: 104 }] } as any;

    expect(alignCritRateSteps(cur, sim).map((r) => r.sim)).toEqual([45, 104]);
  });

  it('drops the comparison when the two are not the same calculation', () => {
    // A katar on one side only: the character crit doubles and the target shield moves ahead
    // of the skill percentage, so pairing by position would mislabel every row.
    const sim = { steps: [{ key: 'luk', value: 45 }, { key: 'katar', value: 2 }, { key: 'total', value: 190 }] } as any;

    expect(alignCritRateSteps(cur, sim).every((r) => r.sim === null)).toBe(true);
  });

  it('has no comparison column with nothing to compare against', () => {
    expect(alignCritRateSteps(cur, null).every((r) => r.sim === null)).toBe(true);
    expect(alignCritRateSteps(null, null)).toEqual([]);
  });
});

describe('CritRateRowCache', () => {
  const cur = { steps: [{ key: 'luk', label: 'CRIT por SOR', value: 40, kind: 'add' }, { key: 'total', label: 'Tx. Crítico', value: 99, kind: 'total' }] } as any;
  const sim = { steps: [{ key: 'luk', value: 45 }, { key: 'total', value: 104 }] } as any;

  // Not an optimisation. The rows feed an *ngFor, which diffs by object identity, and the
  // getter behind them runs on every change-detection pass — including the one the mousedown
  // before a click triggers. Rebuilding the rows there tears the list down and puts the node
  // the user is about to click out of the document before the click can reach it, which is
  // exactly what stopped "CRIT de equipamentos" from opening its sources.
  it('hands back the very same rows while the breakdown is unchanged', () => {
    const cache = new CritRateRowCache();

    expect(cache.get(cur, null)).toBe(cache.get(cur, null));
  });

  it('keeps each row identical too, not just the array', () => {
    const cache = new CritRateRowCache();
    const first = cache.get(cur, null);

    expect(cache.get(cur, null)[0]).toBe(first[0]);
  });

  it('rebuilds once the breakdown is a different object', () => {
    const cache = new CritRateRowCache();
    const first = cache.get(cur, null);
    const next = { steps: [{ key: 'luk', value: 41, kind: 'add', label: 'CRIT por SOR' }] } as any;

    expect(cache.get(next, null)).not.toBe(first);
    expect(cache.get(next, null)[0].step.value).toBe(41);
  });

  it('rebuilds when only the compared build moved', () => {
    const cache = new CritRateRowCache();
    const alone = cache.get(cur, null);

    expect(cache.get(cur, sim)).not.toBe(alone);
    expect(cache.get(cur, sim)[0].sim).toBe(45);
  });

  it('returns what alignCritRateSteps would have', () => {
    expect(new CritRateRowCache().get(cur, sim)).toEqual(alignCritRateSteps(cur, sim));
  });

  it('survives having nothing to align', () => {
    const cache = new CritRateRowCache();

    expect(cache.get(null, null)).toEqual([]);
    expect(cache.get(null, null)).toBe(cache.get(null, null));
  });
});

import { BuildMetrics } from './evaluate';

/**
 * O que o otimizador maximiza.
 * - `avg`/`min`/`max`: dano por uso da skill (média, mínimo ou máximo).
 * - `dps`: dano por segundo, que já desconta conjuração, pós-conjuração e recarga.
 */
export type DamageObjective = 'avg' | 'min' | 'max' | 'dps';

export const OBJECTIVE_LABELS: Record<DamageObjective, string> = {
  avg: 'Dano médio',
  min: 'Dano mínimo',
  max: 'Dano máximo',
  dps: 'DPS',
};

export function damageScore(metrics: BuildMetrics, objective: DamageObjective, constraints?: TimingConstraints): number {
  switch (objective) {
    case 'min': return metrics.damageMin;
    case 'max': return metrics.damageMax;
    case 'dps': return dpsAtTargets(metrics, constraints);
    default: return metrics.damageAvg;
  }
}

/** Compatível com a versão anterior: só a meta de pós. */
export const dpsWithAcdTarget = (metrics: BuildMetrics, target: number | undefined) =>
  dpsAtTargets(metrics, { minAcdPercent: target });

/**
 * DPS sem contar redução além das metas (pós em %, fixa em s, variável em %): o que passa da
 * meta não vale nada, então a busca usa os slots para dano em vez de empilhar redução.
 *
 * O motor calcula `hitPeriod = max(recarga, pós) + variável + fixa` e o DPS proporcional a
 * 1/hitPeriod. Aqui cada tempo com redução acima da meta é refeito como se a redução fosse a
 * meta (mesmas fórmulas de `calc-skill-aspd.ts`), e o DPS é escalado pela razão dos períodos.
 * Skills fora dessa fórmula (que batem a cada N segundos) ficam com o DPS do motor.
 */
export function dpsAtTargets(metrics: BuildMetrics, constraints: TimingConstraints | undefined): number {
  if (!constraints || metrics.timingUnknown || metrics.hitPeriod <= 0) return metrics.dps;
  if (Math.abs(Math.max(metrics.cd, metrics.acd) + metrics.castPeriod - metrics.hitPeriod) > 1e-3) return metrics.dps;
  if (Math.abs(metrics.vct + metrics.fct - metrics.castPeriod) > 1e-3) return metrics.dps;

  let { acd, fct, vct } = metrics;
  const acdTarget = constraints.minAcdPercent;
  if (acdTarget != null && Number.isFinite(acdTarget) && metrics.acdPercent > acdTarget) {
    const unreduced = metrics.acdPercent < 100 && metrics.acd > 0 ? metrics.acd / (1 - metrics.acdPercent / 100) : metrics.baseAcd;
    acd = Math.max(0, unreduced * (1 - Math.min(acdTarget, 100) / 100));
  }
  const fctTarget = constraints.minFctReduction;
  if (fctTarget != null && Number.isFinite(fctTarget) && metrics.fctReduction > fctTarget) {
    fct = Math.max(0, (metrics.baseFct - fctTarget) * metrics.fctFactor);
  }
  const vctTarget = constraints.minVctPercent;
  if (vctTarget != null && Number.isFinite(vctTarget) && metrics.vctPercent > vctTarget) {
    vct = Math.max(0, (metrics.baseVct - metrics.vctFlat) * metrics.vctByStat * Math.max(0, 1 - vctTarget / 100));
  }
  if (acd === metrics.acd && fct === metrics.fct && vct === metrics.vct) return metrics.dps;
  const period = Math.max(metrics.cd, acd) + vct + fct;
  return period > 0 ? metrics.dps * (metrics.hitPeriod / period) : metrics.dps;
}

/**
 * Limites da skill. Tempos em segundos (já reduzidos, como o painel mostra) e a redução de
 * pós-conjuração em %. Ausente = sem limite.
 */
export interface TimingConstraints {
  /** Conjuração variável máxima (s). */
  maxVct?: number;
  /** Conjuração fixa máxima (s). */
  maxFct?: number;
  /** Variável + fixa máxima (s). */
  maxCast?: number;
  /** Pós-conjuração máxima (s). */
  maxAcd?: number;
  /** Recarga máxima (s). */
  maxCd?: number;
  /**
   * Meta de redução de pós-conjuração (%), ex.: 40 = "Pós-conjuração -40%". A build precisa
   * chegar a ela; o que passar não aumenta o DPS usado na comparação (ver `dpsWithAcdTarget`).
   */
  minAcdPercent?: number;
  /** Meta de redução de conjuração fixa (s), ex.: 1 = "Conjuração fixa -1 s". Mesma regra da pós. */
  minFctReduction?: number;
  /** Meta de redução de conjuração variável (%) de equipamentos/buffs (sem DES/INT). Mesma regra. */
  minVctPercent?: number;
  /**
   * Tetos das reduções: a build não pode passar deles. Com meta e teto, a redução fica na faixa
   * [meta, teto] — sem o teto, os itens mais fortes em dano costumam trazer pós a mais e a
   * redução "viaja" para longe da meta.
   */
  maxAcdPercent?: number;
  maxFctReduction?: number;
  maxVctPercent?: number;
}

export type TimingKey = keyof TimingConstraints;

interface ConstraintSpec {
  label: string;
  value: (metrics: BuildMetrics) => number;
  /** `max`: o valor não pode passar do limite. `min`: não pode ficar abaixo. */
  kind: 'max' | 'min';
  unit: 's' | '%';
}

const CONSTRAINTS: Record<TimingKey, ConstraintSpec> = {
  maxVct: { label: 'Conj. variável', value: (m) => m.vct, kind: 'max', unit: 's' },
  maxFct: { label: 'Conj. fixa', value: (m) => m.fct, kind: 'max', unit: 's' },
  maxCast: { label: 'Conjuração total', value: (m) => m.castPeriod, kind: 'max', unit: 's' },
  maxAcd: { label: 'Pós-conjuração', value: (m) => m.acd, kind: 'max', unit: 's' },
  maxCd: { label: 'Recarga', value: (m) => m.cd, kind: 'max', unit: 's' },
  minAcdPercent: { label: 'Redução de pós', value: (m) => m.acdPercent, kind: 'min', unit: '%' },
  minFctReduction: { label: 'Redução de fixa', value: (m) => m.fctReduction, kind: 'min', unit: 's' },
  minVctPercent: { label: 'Redução de variável', value: (m) => m.vctPercent, kind: 'min', unit: '%' },
  maxAcdPercent: { label: 'Redução de pós (teto)', value: (m) => m.acdPercent, kind: 'max', unit: '%' },
  maxFctReduction: { label: 'Redução de fixa (teto)', value: (m) => m.fctReduction, kind: 'max', unit: 's' },
  maxVctPercent: { label: 'Redução de variável (teto)', value: (m) => m.vctPercent, kind: 'max', unit: '%' },
};

export const TIMING_LABELS: Record<TimingKey, string> = Object.fromEntries(
  Object.entries(CONSTRAINTS).map(([key, spec]) => [key, spec.label]),
) as Record<TimingKey, string>;

/** Os tempos são arredondados a 4 casas pelo motor; abaixo disso é ruído. */
const TOLERANCE = { s: 1e-4, '%': 1e-6 };
/** Para somar violações de unidades diferentes: 1% de pós pesa como 0,01 s. */
const UNIT_WEIGHT = { s: 1, '%': 0.01 };

export interface ConstraintCheck {
  key: TimingKey;
  label: string;
  value: number;
  limit: number;
  kind: 'max' | 'min';
  unit: 's' | '%';
  ok: boolean;
  /** Quanto falta para cumprir, na unidade do limite; 0 quando ok. */
  excess: number;
}

export function checkConstraints(metrics: BuildMetrics, constraints: TimingConstraints = {}): ConstraintCheck[] {
  return (Object.keys(CONSTRAINTS) as TimingKey[])
    .filter((key) => typeof constraints[key] === 'number' && Number.isFinite(constraints[key]))
    .map((key) => {
      const spec = CONSTRAINTS[key];
      const value = spec.value(metrics);
      const limit = constraints[key] as number;
      const gap = spec.kind === 'max' ? value - limit : limit - value;
      const excess = Math.max(0, gap - TOLERANCE[spec.unit]);
      return { key, label: spec.label, value, limit, kind: spec.kind, unit: spec.unit, ok: excess === 0, excess };
    });
}

/**
 * Pontuação com restrições, comparada em ordem:
 * 1. `violation`: soma de quanto falta para cada limite (segundos; 1% de pós conta como 0,01 s). Menor é melhor.
 * 2. `damage`: o objetivo escolhido. Maior é melhor.
 *
 * Assim a busca primeiro caminha para builds que cumprem os limites e, entre elas, maximiza
 * o dano. Se nenhuma cumprir, fica com a mais próxima, que é a mais útil de mostrar.
 */
export interface Score {
  violation: number;
  damage: number;
}

export const SCORE_EPSILON = 1e-9;

export function scoreOf(metrics: BuildMetrics, objective: DamageObjective, constraints?: TimingConstraints): Score {
  const violation = checkConstraints(metrics, constraints).reduce((sum, check) => sum + check.excess * UNIT_WEIGHT[check.unit], 0);
  return { violation, damage: damageScore(metrics, objective, constraints) };
}

export const WORST_SCORE: Score = { violation: Infinity, damage: -Infinity };

/** `a` é estritamente melhor que `b`? */
export function isBetter(a: Score, b: Score): boolean {
  if (a.violation < b.violation - SCORE_EPSILON) return true;
  if (a.violation > b.violation + SCORE_EPSILON) return false;
  return a.damage > b.damage + SCORE_EPSILON;
}

export const isFeasible = (score: Score) => score.violation <= SCORE_EPSILON;

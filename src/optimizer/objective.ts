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

export function damageScore(metrics: BuildMetrics, objective: DamageObjective): number {
  switch (objective) {
    case 'min': return metrics.damageMin;
    case 'max': return metrics.damageMax;
    case 'dps': return metrics.dps;
    default: return metrics.damageAvg;
  }
}

/**
 * Limites de tempo da skill, em segundos (já reduzidos, como o painel mostra).
 * Ausente = sem limite.
 */
export interface TimingConstraints {
  /** Conjuração variável. */
  maxVct?: number;
  /** Conjuração fixa. */
  maxFct?: number;
  /** Variável + fixa. */
  maxCast?: number;
  /** Pós-conjuração. */
  maxAcd?: number;
  /** Recarga. */
  maxCd?: number;
}

export type TimingKey = keyof TimingConstraints;

export const TIMING_LABELS: Record<TimingKey, string> = {
  maxVct: 'Conj. variável',
  maxFct: 'Conj. fixa',
  maxCast: 'Conjuração total',
  maxAcd: 'Pós-conjuração',
  maxCd: 'Recarga',
};

const TIMING_VALUE: Record<TimingKey, (metrics: BuildMetrics) => number> = {
  maxVct: (m) => m.vct,
  maxFct: (m) => m.fct,
  maxCast: (m) => m.castPeriod,
  maxAcd: (m) => m.acd,
  maxCd: (m) => m.cd,
};

/** Os tempos são arredondados a 4 casas pelo motor; abaixo disso é ruído. */
const TIME_TOLERANCE = 1e-4;

export interface ConstraintCheck {
  key: TimingKey;
  label: string;
  value: number;
  limit: number;
  ok: boolean;
  /** Quanto passa do limite (s); 0 quando ok. */
  excess: number;
}

export function checkConstraints(metrics: BuildMetrics, constraints: TimingConstraints = {}): ConstraintCheck[] {
  return (Object.keys(TIMING_VALUE) as TimingKey[])
    .filter((key) => typeof constraints[key] === 'number' && Number.isFinite(constraints[key]))
    .map((key) => {
      const value = TIMING_VALUE[key](metrics);
      const limit = constraints[key] as number;
      const excess = Math.max(0, value - limit - TIME_TOLERANCE);
      return { key, label: TIMING_LABELS[key], value, limit, ok: excess === 0, excess };
    });
}

/**
 * Pontuação com restrições, comparada em ordem:
 * 1. `violation`: soma, em segundos, de quanto cada tempo passa do limite. Menor é melhor.
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
  const violation = checkConstraints(metrics, constraints).reduce((sum, check) => sum + check.excess, 0);
  return { violation, damage: damageScore(metrics, objective) };
}

export const WORST_SCORE: Score = { violation: Infinity, damage: -Infinity };

/** `a` é estritamente melhor que `b`? */
export function isBetter(a: Score, b: Score): boolean {
  if (a.violation < b.violation - SCORE_EPSILON) return true;
  if (a.violation > b.violation + SCORE_EPSILON) return false;
  return a.damage > b.damage + SCORE_EPSILON;
}

export const isFeasible = (score: Score) => score.violation <= SCORE_EPSILON;

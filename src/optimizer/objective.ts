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

import { describe, expect, it } from 'vitest';
import { runExactOptimization } from '../runtime';
import { appShapedData } from '../__tests__/app-data';
import { MAGAZINE_FOR_ONE, nightWatchModel } from '../__tests__/nightwatch-build';

const data = appShapedData();
const preset = JSON.parse(JSON.stringify(nightWatchModel()));
const request = {
  preset, monsterId: 1832, skillValue: MAGAZINE_FOR_ONE, mode: 'exact' as const,
  slots: ['garment', 'accLeft'] as any, allowedItemIds: [2573, 2601, 2607], optimizeEnchants: false,
};

describe('runExactOptimization (painel → worker)', () => {
  it('conclui com OPTIMAL, resumo e links', async () => {
    const response = await runExactOptimization(data, { ...request, exact: { seedTimeMs: 0, postOptimizeStats: true } });
    expect(response.exact?.status).toBe('OPTIMAL');
    expect(response.exact?.checkpoint).toBeUndefined();
    expect(response.exact?.stats.progress).toBe(1);
    expect(response.applyPath).toMatch(/^\/s\//);
    expect(response.exact?.statsAdjusted?.applyPath).toMatch(/^\/s\//);
    expect(response.damageAfter).toBeGreaterThanOrEqual(response.damageBefore);
  }, 120_000);

  it('parar devolve INTERRUPTED com checkpoint; retomar conclui', async () => {
    let calls = 0;
    const stopped = await runExactOptimization(data, { ...request, exact: { seedTimeMs: 0 } }, { shouldStop: () => ++calls > 3 });
    expect(stopped.exact?.status).toBe('INTERRUPTED');
    expect(stopped.truncated).toBe(true);
    const checkpoint = JSON.parse(JSON.stringify(stopped.exact!.checkpoint));
    const resumed = await runExactOptimization(data, { ...request, exact: { seedTimeMs: 0, resume: checkpoint } });
    expect(resumed.exact?.status).toBe('OPTIMAL');
  }, 120_000);
});

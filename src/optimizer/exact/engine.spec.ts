import { describe, expect, it } from 'vitest';
import { exactSearch, ExactSearch, SearchCheckpoint } from './engine';
import {
  bruteForce, compareNumbers, randomCatalog, ToyCatalog, toyKey, toyProblem, ToyState, toyValid,
} from './__tests__/toy';

const item = (id: string, atk: number, extra: object = {}) => ({ id, atk, ...extra });

function solve(catalog: ToyCatalog, options: Parameters<typeof toyProblem>[1] & { mode?: 'best' | 'allTies'; useUpperBound?: boolean } = {}) {
  const { mode, useUpperBound, ...problemOptions } = options;
  return exactSearch(toyProblem(catalog, problemOptions), { mode, useUpperBound });
}

const keysOf = (states: ToyState[] | undefined) => new Set((states ?? []).map((state) => toyKey(state.picks)));

describe('ExactSearch — casos essenciais (plano §10.2)', () => {
  it('1. item que domina os outros, sem conjuntos', () => {
    const catalog: ToyCatalog = { slots: [{ name: 'arma', items: [item('fraca', 5), item('forte', 50), item('media', 20)] }], sets: [] };
    const result = solve(catalog);
    expect(result.status).toBe('OPTIMAL');
    expect(result.best!.states[0].picks[0]?.item.id).toBe('forte');
  });

  it('2. item individualmente inferior necessário para ativar o conjunto ótimo', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'elmo', items: [item('elmo-forte', 30), item('elmo-set', 1, { tags: ['s'] })] },
        { name: 'capa', items: [item('capa-forte', 30), item('capa-set', 1, { tags: ['s'] })] },
      ],
      sets: [{ tag: 's', threshold: 2, atk: 100 }],
    };
    const result = solve(catalog);
    expect(result.best!.score).toBe(102);
    expect(toyKey(result.best!.states[0].picks)).toBe('elmo-set+0|capa-set+0');
  });

  it('3. sinergia entre slots diferentes', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'arma', items: [item('arma', 10, { synergy: { tag: 'x', atk: 50 } }), item('arma2', 30)] },
        { name: 'anel', items: [item('anel-x', 1, { tags: ['x'] }), item('anel', 15)] },
      ],
      sets: [],
    };
    expect(solve(catalog).best!.score).toBe(61);
  });

  it('4. bônus por limiar de conjunto (3 peças)', () => {
    const catalog: ToyCatalog = {
      slots: ['a', 'b', 'c'].map((name) => ({ name, items: [item(`${name}-set`, 2, { tags: ['t'] }), item(`${name}-solo`, 10)] })),
      sets: [{ tag: 't', threshold: 3, atk: 30 }],
    };
    expect(solve(catalog).best!.score).toBe(36);
  });

  it('5. itens exclusivos', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'e', items: [item('unico-e', 50, { exclusive: 'u' }), item('normal-e', 10)] },
        { name: 'd', items: [item('unico-d', 50, { exclusive: 'u' }), item('normal-d', 10)] },
      ],
      sets: [],
    };
    const result = solve(catalog);
    expect(result.best!.score).toBe(60);
    expect(result.stats.pruned.exclusive).toBeGreaterThan(0);
  });

  it('6/9. crítico não linear e refino em níveis diferentes', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'arma', maxRefine: 3, items: [item('refinavel', 10, { refineAtk: 5 }), item('fixa', 22)] },
        { name: 'luva', items: [item('crit', 0, { crit: 50 }), item('atk', 8)] },
      ],
      sets: [],
    };
    const result = solve(catalog);
    expect(result.best!.score).toBeCloseTo(25 * 1.5); // refinavel +3 (25) × crítico 50%
    expect(result.best!.states[0].picks[0]?.refine).toBe(3);
  });

  it('7. slots obrigatórios e opcionais', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'obrig', mandatory: true, items: [item('ruim', 0, { exclusive: 'g' })] },
        { name: 'opc', items: [item('bom', 40, { exclusive: 'g' })] },
      ],
      sets: [],
    };
    const result = solve(catalog);
    expect(result.best!.score).toBe(0);
    expect(toyKey(result.best!.states[0].picks)).toBe('ruim+0|-');
  });

  it('sem build válida → NO_SOLUTION', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'a', mandatory: true, items: [item('x', 1, { exclusive: 'g' })] },
        { name: 'b', mandatory: true, items: [item('y', 1, { exclusive: 'g' })] },
      ],
      sets: [],
    };
    expect(solve(catalog).status).toBe('NO_SOLUTION');
    expect(solve(catalog, { withBound: true, useUpperBound: true }).status).toBe('NO_SOLUTION');
  });

  it('8. empates: modo allTies devolve todas as builds ótimas', () => {
    const catalog: ToyCatalog = {
      slots: [
        { name: 'a', items: [item('a1', 10), item('a2', 10), item('a3', 3)] },
        { name: 'b', items: [item('b1', 5), item('b2', 5)] },
      ],
      sets: [],
    };
    const one = solve(catalog);
    const all = solve(catalog, { mode: 'allTies' });
    const bounded = solve(catalog, { mode: 'allTies', withBound: true, useUpperBound: true });
    expect(one.best!.states).toHaveLength(1);
    expect(keysOf(all.best!.states)).toEqual(bruteForce(catalog).optimalKeys);
    expect(keysOf(bounded.best!.states)).toEqual(bruteForce(catalog).optimalKeys);
    expect(all.best!.states).toHaveLength(4);
  });
});

describe('ExactSearch — propriedade contra força bruta (plano §10.3)', () => {
  const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);

  it('sem poda de dano, com limite superior e com ordenação heurística: mesmo ótimo', () => {
    for (const seed of SEEDS) {
      const catalog = randomCatalog(seed);
      const oracle = bruteForce(catalog);
      const variants = [
        solve(catalog),
        solve(catalog, { heuristicOrder: true }),
        solve(catalog, { withBound: true, useUpperBound: true }),
        solve(catalog, { withBound: true, useUpperBound: true, heuristicOrder: true }),
      ];
      for (const result of variants) {
        if (!oracle.valid.length) { expect(result.status, `seed ${seed}`).toBe('NO_SOLUTION'); continue; }
        expect(result.status, `seed ${seed}`).toBe('OPTIMAL');
        expect(compareNumbers(result.best!.score, oracle.bestScore), `seed ${seed}`).toBe(0);
        expect(oracle.optimalKeys.has(toyKey(result.best!.states[0].picks)), `seed ${seed}`).toBe(true);
      }
    }
  });

  it('modo allTies (com e sem limite) devolve exatamente o conjunto ótimo da força bruta', () => {
    for (const seed of SEEDS) {
      const catalog = randomCatalog(seed);
      const oracle = bruteForce(catalog);
      for (const result of [solve(catalog, { mode: 'allTies' }), solve(catalog, { mode: 'allTies', withBound: true, useUpperBound: true })]) {
        expect(keysOf(result.best?.states), `seed ${seed}`).toEqual(oracle.optimalKeys);
      }
    }
  });

  it('o limite superior nunca fica abaixo do melhor alcançável (verificado em todos os estados)', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const catalog = randomCatalog(seed);
      const problem = toyProblem(catalog, { withBound: true });
      const oracle = bruteForce(catalog);
      // Para cada prefixo de cada build válida, o limite do prefixo ≥ score da build.
      for (const { picks, score } of oracle.valid) {
        for (let length = 0; length <= picks.length; length++) {
          expect(problem.upperBound!.bound({ picks: picks.slice(0, length) }) + 1e-9).toBeGreaterThanOrEqual(score);
        }
      }
    }
  });

  it('modo enumerate visita exatamente as builds válidas (sem poda por dano)', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const catalog = randomCatalog(seed);
      const seen: string[] = [];
      const search = new ExactSearch(toyProblem(catalog), { mode: 'enumerate', onLeaf: (state) => seen.push(toyKey(state.picks)) });
      const result = search.run();
      expect(result.status).toBe('COMPLETE');
      const oracle = bruteForce(catalog);
      expect(new Set(seen)).toEqual(new Set(oracle.valid.map((entry) => toyKey(entry.picks))));
      expect(seen).toHaveLength(oracle.valid.length);
      for (const key of seen) expect(toyValid(catalog, oracle.valid.find((entry) => toyKey(entry.picks) === key)!.picks)).toBe(true);
    }
  });
});

describe('ExactSearch — interrupção e checkpoint (plano §10.2, caso 16)', () => {
  it('interromper e retomar várias vezes não perde nem repete builds', () => {
    for (const seed of [3, 7, 11, 19, 23]) {
      const catalog = randomCatalog(seed);
      const reference = exactSearch(toyProblem(catalog), { mode: 'allTies' });
      let checkpoint: SearchCheckpoint<number, ToyState> | undefined;
      const visited: string[] = [];
      let runs = 0;
      for (;;) {
        runs++;
        const search = new ExactSearch(toyProblem(catalog), {
          mode: 'allTies', resume: checkpoint, maxLeaves: (checkpoint?.stats.leaves ?? 0) + 7,
          onLeaf: (state) => visited.push(toyKey(state.picks)),
        });
        const result = search.run();
        if (result.status !== 'INTERRUPTED') {
          expect(result.status).toBe(reference.status);
          if (reference.best) {
            expect(result.best!.score).toBe(reference.best.score);
            expect(keysOf(result.best!.states)).toEqual(keysOf(reference.best.states));
          }
          expect(result.stats.leaves).toBe(reference.stats.leaves);
          expect(result.stats.progress).toBe(1);
          break;
        }
        expect(result.best ? 'BEST' : 'NONE').toBeDefined();
        // Ida e volta por JSON, como o painel salva.
        checkpoint = JSON.parse(JSON.stringify(search.checkpoint()));
        expect(checkpoint!.stats.progress).toBeGreaterThanOrEqual(0);
        expect(checkpoint!.stats.progress).toBeLessThanOrEqual(1);
      }
      expect(runs).toBeGreaterThan(1);
      expect(visited).toHaveLength(reference.stats.leaves);
      expect(new Set(visited).size).toBe(visited.length);
    }
  });

  it('parada por shouldStop vira INTERRUPTED com a melhor build até agora', () => {
    const catalog = randomCatalog(5);
    let calls = 0;
    const result = exactSearch(toyProblem(catalog), { shouldStop: () => ++calls > 20 });
    expect(result.status).toBe('INTERRUPTED');
  });

  it('runAsync dá o mesmo resultado que run', async () => {
    const catalog = randomCatalog(9);
    const sync = exactSearch(toyProblem(catalog));
    const asyncResult = await new ExactSearch(toyProblem(catalog)).runAsync(0);
    expect(asyncResult.status).toBe(sync.status);
    expect(asyncResult.best?.score).toBe(sync.best?.score);
  });

  it('erro no problema vira ERROR', () => {
    const problem = toyProblem(randomCatalog(2));
    const broken = { ...problem, evaluate: () => { throw new Error('boom'); } };
    const result = exactSearch(broken);
    expect(result.status).toBe('ERROR');
    expect(result.error).toBe('boom');
  });
});

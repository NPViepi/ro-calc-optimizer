import { describe, expect, it } from 'vitest';
import { combineEffects, triggeredBy, uptimeOf } from './chance-effects';
import { CHANCE_EFFECTS } from './data/chance-effects';
import { BuildEvaluator } from './evaluate';
import { windhawkContext, windhawkModel } from './__tests__/windhawk-build';

const ROYAL_BOW = 700045;
const INSTINTO = 4879; // encantamento da Bota Temporal: 3% ao atacar fisicamente, DES +200 por 5 s

describe('tabela de efeitos (descrições pt-BR)', () => {
  it('lê chance, duração e gatilho, inclusive em cabeçalho na linha de cima', () => {
    expect(CHANCE_EFFECTS[INSTINTO]).toEqual({ chance: 3, duration: 5, trigger: 'physical' });
    expect(CHANCE_EFFECTS[27109]).toEqual({ chance: 3, duration: 6, trigger: 'any' }); // Carta Jitterbug
    expect(CHANCE_EFFECTS[26172]?.trigger).toBe('any'); // Cauda de Gato Real: um efeito físico e um mágico
  });
});

describe('tempo ativo e combinação', () => {
  const physical = { name: 'x', chance: 0.03, duration: 5, trigger: 'physical' as const };

  it('1 − (1 − p)^(golpes/s × duração)', () => {
    expect(uptimeOf(physical, 2, 1)).toBeCloseTo(1 - 0.97 ** 10, 10);
    expect(uptimeOf(physical, 0, 1)).toBe(0);
    // Gatilho de skill: uma tentativa por uso.
    expect(uptimeOf({ ...physical, trigger: 'skill', skill: 'Expurgar' }, 10, 2)).toBeCloseTo(1 - 0.97 ** 2.5, 10);
  });

  it('gatilho conforme o tipo da skill', () => {
    expect(triggeredBy(physical, 'Magazine for One', false)).toBe(true);
    expect(triggeredBy(physical, 'Magazine for One', true)).toBe(false);
    expect(triggeredBy({ ...physical, trigger: 'skill', skill: 'Artilharia Pesada' }, 'Magazine for One', false)).toBe(true);
    expect(triggeredBy({ ...physical, trigger: 'skill', skill: 'Expurgar' }, 'Magazine for One', false)).toBe(false);
  });

  it('média exata das combinações de efeitos ligados', () => {
    const base = { damageMin: 100, damageMax: 100, damageAvg: 100, dps: 100 };
    const gain: Record<string, number> = { a: 50, b: 20 };
    const measure = (names: string[]) => {
      const value = 100 + names.reduce((sum, name) => sum + gain[name], 0) + (names.length === 2 ? 10 : 0);
      return { damageMin: value, damageMax: value, damageAvg: value, dps: value };
    };
    const effects = [{ name: 'a', uptime: 0.5 }, { name: 'b', uptime: 0.25 }];
    // 0,375·100 + 0,375·150 + 0,125·120 + 0,125·180
    expect(combineEffects('expected', effects, base, measure).dps).toBeCloseTo(131.25, 10);
    expect(combineEffects('always', effects, base, measure).dps).toBe(180);
  });
});

describe('avaliador com efeitos de ativação', () => {
  const model = { ...windhawkModel(130), weapon: ROYAL_BOW, weaponEnchant3: INSTINTO } as any;
  const dps = (mode: 'off' | 'always' | 'expected') => new BuildEvaluator({ ...windhawkContext(), chanceEffects: mode }).evaluate(model);

  it('desligado < ponderado < sempre ativo', () => {
    const off = dps('off');
    const expected = dps('expected');
    const always = dps('always');
    expect(off.effects).toBeUndefined();
    expect(always.effects?.[0].uptime).toBe(1);
    const uptime = expected.effects?.[0].uptime ?? 0;
    expect(uptime).toBeGreaterThan(0);
    expect(uptime).toBeLessThan(1);
    expect(always.dps).toBeGreaterThan(off.dps);
    expect(expected.dps).toBeGreaterThan(off.dps);
    expect(expected.dps).toBeLessThan(always.dps);
    // Com um efeito só, o esperado é a interpolação pelo tempo ativo.
    expect(expected.dps).toBeCloseTo(off.dps + uptime * (always.dps - off.dps), 6);
  });
});

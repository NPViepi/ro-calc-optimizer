import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AbyssChaser } from '../jobs';
import { SkillFormulaVersion } from '../skills/skill-formula-version';
import { createMainModel } from '../utils';
import { buildAutoCastSimulation } from './auto-cast';
import { Calculator } from './calculator';
import { CalculatorController } from './calculator-controller';

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

// Card JaRSs9KniTwaVYNbwpy8. Client description supplies the damage/regen intervals;
// https://browiki.org/wiki/Invocação_do_Abismo supplies the 3% chance per skill level.
function prepare(level: number, squareLevel = 0, version: SkillFormulaVersion = 'current') {
  const cls = new AbyssChaser();
  const bonuses = cls.setLearnSkills({
    activeSkillIds: cls.activeSkills.map(skill => skill.name === 'From the Abyss' ? level : 0),
    passiveSkillIds: cls.passiveSkills.map(skill => skill.name === 'Abyss Square' ? squareLevel : 0),
  }).getSkillBonusAndName();
  const model = {
    ...createMainModel(), class: cls.classId, level: 240, jobLevel: 1,
    int: 120, dex: 100, spl: 60, weapon: 1602, skillFormulaVersion: version,
  };
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[21067], ...bonuses, buffEquips: {}, buffMasterys: {}, consumeData: [],
    extraOptionScripts: [], selectedAtkSkill: '', selectedChances: [], usedHpL: false,
  } as any);
  const simulate = (attacksPerSecond = 4, accuracy = 100) => buildAutoCastSimulation({
    calc, model, hasSelectedEffects: false,
    summary: {
      ...calc.getTotalSummary(), calc: { hitPerSecs: attacksPerSecond },
      dmg: { accuracy, criRateToMonster: 0, basicDps: 400 },
    },
  });
  return { calc, simulate };
}

describe('Invocação do Abismo autocast', () => {
  it.each([1, 2, 3, 4, 5])('uses the active level %i without requiring Fenda do Abismo', level => {
    const result = prepare(level).simulate();
    const orb = result.sources.find(entry => entry.source.skillId === 5317)!;
    expect(orb).toMatchObject({
      name: 'Invocação do Abismo',
      source: { skillLevel: level, chance: level * 3, trigger: 'physical-attack' },
      activationsPerSecond: 4 * level * 3 / 100,
    });
    expect(orb.expectedDamagePerActivation).toBeGreaterThan(0);
    expect(orb.dps).toBeCloseTo(orb.expectedDamagePerActivation * orb.activationsPerSecond);
    expect(result.autoCastDps).toBe(orb.dps);
    expect(result.totalDps).toBeCloseTo(400 + orb.dps);
    expect(result.blockedSources).toContainEqual(expect.objectContaining({ icon: 5321 }));
  });

  it('shows the activation instruction when the buff is off, even with Fenda learned', () => {
    const result = prepare(0, 5).simulate();
    expect(result.sources).toEqual([]);
    expect(result.blockedSources).toContainEqual(expect.objectContaining({
      icon: 5317, reason: 'Ative Invocação do Abismo',
    }));
  });

  it('keeps orb damage and Fenda do Abismo as independent sources', () => {
    const result = prepare(5, 3).simulate();
    expect(result.sources.map(entry => [entry.source.skillId, entry.source.skillLevel, entry.source.chance]))
      .toEqual([[5317, 5, 15], [5321, 3, 3]]);
    expect(result.autoCastDps).toBeCloseTo(result.sources.reduce((sum, entry) => sum + entry.dps, 0));
  });

  // Card 5qw6V9dyPakGZ6jwMiD8. The chance used to be a flat 20% taken from rAthena's
  // battle.cpp, whose own source marks it unconfirmed; https://browiki.org/wiki/Fenda_do_Abismo
  // gives the LATAM figure, 1% per level of Fenda do Abismo.
  it.each([1, 2, 3, 4, 5])('rolls Fenda do Abismo at 1%% per learned level (Nv %i)', squareLevel => {
    const result = prepare(5, squareLevel).simulate();
    const square = result.sources.find(entry => entry.source.skillId === 5321)!;
    expect(square.source.chance).toBe(squareLevel);
    expect(square.source.skillLevel).toBe(squareLevel);
    expect(square.source.chanceBreakdown).toEqual([
      { label: 'Invocação do Abismo', value: `${squareLevel}% por ataque básico` },
    ]);
    expect(square.activationsPerSecond).toBeCloseTo(4 * squareLevel / 100);
  });

  it.each([[1, 3], [2, 2.5], [3, 2], [4, 1.5], [5, 1]])(
    'caps sustained level %i activations by the %s-second orb regeneration', (level, interval) => {
      const { simulate } = prepare(level);
      const orb = simulate(20).sources.find(entry => entry.source.skillId === 5317)!;
      expect(orb.source.maxActivationsPerSecond).toBeCloseTo(1 / interval);
      expect(orb.activationsPerSecond).toBeCloseTo(1 / interval);
      expect(orb.dps).toBeCloseTo(orb.expectedDamagePerActivation / interval);
      const slow = simulate(1).sources.find(entry => entry.source.skillId === 5317)!;
      expect(slow.activationsPerSecond).toBeCloseTo(level * 3 / 100);
      expect(simulate(0).sources.find(entry => entry.source.skillId === 5317)!.dps).toBe(0);
    },
  );

  it('rolls on attack attempts independently of physical accuracy', () => {
    const { simulate } = prepare(5);
    const hit = simulate(4, 100).sources.find(entry => entry.source.skillId === 5317)!;
    const miss = simulate(4, 0).sources.find(entry => entry.source.skillId === 5317)!;
    expect(miss.activationsPerSecond).toBe(hit.activationsPerSecond);
    expect(miss.dps).toBe(hit.dps);
  });

  it.each<SkillFormulaVersion>(['current', 'pre-rebalance', 'rebalance-2026-02'])(
    'reuses the native magical damage and hit count for %s', version => {
      const { calc, simulate } = prepare(5, 0, version);
      const native = calc.solveAutoCast('From the Abyss==5');
      const orb = simulate().sources.find(entry => entry.source.skillId === 5317)!;
      expect(orb.summary).toMatchObject({
        baseSkillDamage: native.baseSkillDamage,
        skillMinDamage: native.skillMinDamage,
        skillMaxDamage: native.skillMaxDamage,
        skillTotalHit: native.skillTotalHit,
      });
      expect(orb.damageRanges[0]).toMatchObject({
        min: native.skillMinDamage * native.skillTotalHit,
        max: native.skillMaxDamage * native.skillTotalHit,
      });
    },
  );
});

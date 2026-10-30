import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from '../core/calculator';
import { CalculatorController } from '../core/calculator-controller';
import { SkillFormulaVersion } from '../skills/skill-formula-version';
import { createMainModel } from '../utils/create-main-model';
import { Inquisitor } from './Inquisitor';
import { AtkSkillFormulaInput } from './_character-base.abstract';

const versions: SkillFormulaVersion[] = ['current', 'pre-rebalance', 'rebalance-2026-02'];
const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

function solve(version: SkillFormulaVersion, spheres: number, skillLevel = 5) {
  const cls = new Inquisitor();
  const bonuses = cls.setLearnSkills({
    activeSkillIds: cls.activeSkills.map(s => s.name === 'Total Spirit' ? spheres : 0),
    passiveSkillIds: [],
  }).getSkillBonusAndName();
  const model = {
    ...createMainModel(), class: cls.classId, level: 250, jobLevel: 50,
    str: 100, vit: 80, dex: 90, pow: 60,
    selectedAtkSkill: `Third Flame Bomb==${skillLevel}`, skillFormulaVersion: version,
  };
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters['21077'], ...bonuses, buffEquips: {}, buffMasterys: {}, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: [], selectedAtkSkill: model.selectedAtkSkill,
    selectedChances: [], usedHpL: false,
  } as any);
  return (calc as any).damageSummary;
}

describe('Fogueira Espiritual across formula versions', () => {
  // LATAM's tooltip and both rebalance references specify the same sphere bands.
  it.each(versions)('%s uses 1/2/3 full-damage hits for 0–5/6–10/11–15 spheres', version => {
    const skill = new Inquisitor().getAtkSkills(version).find(s => s.name === 'Third Flame Bomb')!;
    for (const [spheres, hits] of [[0, 1], [1, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3]]) {
      const input = { skills: { activeLevel: () => spheres } } as unknown as AtkSkillFormulaInput;
      const totalHit = typeof skill.totalHit === 'function' ? skill.totalHit(input) : skill.totalHit;
      expect(totalHit, `${spheres} spheres`).toBe(hits);
    }
  });

  it.each([[0, 1], [5, 1], [6, 2], [10, 2], [15, 3]])('compares the same %i spheres without losing hits when switching rebalance', (spheres, hits) => {
    for (const level of [1, 5]) {
      const legacy = solve('pre-rebalance', spheres, level);
      expect(legacy.skillTotalHit).toBe(hits);
      for (const version of ['current', 'rebalance-2026-02'] as const) {
        const rebalanced = solve(version, spheres, level);
        expect(rebalanced.skillTotalHit).toBe(legacy.skillTotalHit);
        expect(rebalanced.skillMinDamage).toBeGreaterThan(legacy.skillMinDamage);
        expect(rebalanced.skillMaxDamage).toBeGreaterThan(legacy.skillMaxDamage);
      }
    }
  });
});

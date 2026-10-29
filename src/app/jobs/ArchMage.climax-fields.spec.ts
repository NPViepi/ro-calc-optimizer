import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ElementType } from 'src/app/constants/element-type.const';
import { JobBuffs } from 'src/app/constants/job-buffs';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { createMainModel } from 'src/app/utils';
import { ArchMage } from './ArchMage';
import { AtkSkillFormulaInput, AtkSkillModel } from './_character-base.abstract';

/**
 * Florescer (All Bloom 5222), Pilares de Pedra (Violent Quake 5218) and Tufão Destrutivo
 * (Destructive Hurricane 5215) under each level of Potencializar Magia (Climax), plus the
 * three states those levels leave behind: [Pólen] and [Empalamento] on the target,
 * [Zéfiro] on the caster.
 *
 * Tracker cards tvMthNAl4c7Ors5itXZW ("Debuff: Florescer e Pilares de Terra") and
 * GLifZpPzecmzKiai9hUd ("Falta a habilidade Tufão Destrutivo do Magus"). Before them the
 * two field skills only knew Climax Nv3, as a ×2 on the ratio, and Tufão Destrutivo was
 * not in the class list at all.
 *
 * The Climax table is the client description of each skill; bROWiki's pages for the three
 * skills and for Potencializar Magia agree with it and add the one thing the client does
 * not say — that the damage steps are "cumulativo com equipamentos de efeitos semelhantes".
 * So they join the gear's "Dano de [habilidade] +N%" (the skill-id bonus key) instead of
 * scaling the ratio. Tufão's 500% extra hit and Florescer's 7.000% garden burn are flat
 * percentages: neither text gives them a base-level or FEI term.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const NEUTRAL_LV1 = '21077';
const BASE_LEVEL = 250;
const TOTAL_SPL = 100;

const inputAt = (skillLevel: number) =>
  ({ skillLevel, model: { level: BASE_LEVEL }, status: { totalSpl: TOTAL_SPL } }) as unknown as AtkSkillFormulaInput;

const magus = (actives: Record<string, number> = {}) => {
  const cls = new ArchMage();
  const activeSkillIds = cls.activeSkills.map((s) => actives[s.name] ?? 0);
  cls.setLearnSkills({ activeSkillIds, passiveSkillIds: cls.passiveSkills.map(() => 0) });
  cls.getSkillBonusAndName();

  return cls;
};

const skillOf = (cls: ArchMage, name: string): AtkSkillModel => {
  const skill = cls.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`${name} is not in the Magus skill list`);

  return skill;
};

const hitsOf = (skill: AtkSkillModel, skillLevel = 5) =>
  typeof skill.totalHit === 'function' ? skill.totalHit(inputAt(skillLevel)) : skill.totalHit;

/** A bare level-250 Magus with FEI 100 against the Neutral Lv1 dummy, through the real chain. */
function simulate(opts: { skill: string; actives?: Record<string, number>; debuffs?: Record<string, number> }) {
  const cls: any = magus(opts.actives);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls.getSkillBonusAndName();

  const model: any = createMainModel();
  model.class = cls.classId;
  model.level = BASE_LEVEL;
  model.jobLevel = 1;
  model.int = 130;
  model.dex = 130;
  model.spl = TOTAL_SPL;
  model.selectedAtkSkill = opts.skill;

  const buffEquips: Record<string, any> = {};
  for (const def of JobBuffs) {
    const value = opts.debuffs?.[def.name];
    if (!value) continue;
    buffEquips[def.name] = def.dropdown.find((d) => d.value === value)?.bonus;
  }

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[NEUTRAL_LV1], equipAtks, masteryAtks, buffEquips, buffMasterys: {}, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: [], activeSkillNames, learnedSkillMap,
    selectedAtkSkill: opts.skill, selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  return {
    max: ds.skillMaxDamage as number,
    part2Max: ds.skillMaxDamage2 as number,
    propertyMultiplier: ds.skillPropertyMultiplier as number,
    totalBonus: (calc as any).totalEquipStatus as Record<string, number>,
  };
}

describe('Tufão Destrutivo is offered to the Magus rotation', () => {
  it('is in the class skill list, Wind magic, with all five levels', () => {
    const skill = skillOf(new ArchMage(), 'Destructive Hurricane');

    expect(skill.value).toBe('Destructive Hurricane==5');
    expect([skill.isMatk, skill.element]).toEqual([true, ElementType.Wind]);
    expect(skill.levelList.map((l) => l.value)).toEqual([1, 2, 3, 4, 5].map((lv) => `Destructive Hurricane==${lv}`));
  });

  // "1.600% ... 8.000%" on the client table, (level x 1600 + FEI x 5) x base level / 100.
  it('pays 1.600% a level plus the FEI term', () => {
    const skill = skillOf(magus(), 'Destructive Hurricane');

    expect([1, 2, 3, 4, 5].map((lv) => skill.formula(inputAt(lv)))).toEqual([5250, 9250, 13250, 17250, 21250]);
  });

  it('carries the client cast and delay window', () => {
    const skill = skillOf(new ArchMage(), 'Destructive Hurricane');

    expect({ fct: skill.fct, vct: skill.vct, acd: skill.acd, cd: skill.cd }).toEqual({ fct: 1.5, vct: 4, acd: 0.5, cd: 2 });
  });

  it('lands in the damage summary', () => {
    expect(simulate({ skill: 'Destructive Hurricane==5' }).max).toBeGreaterThan(0);
  });
});

describe('Florescer and Pilares de Pedra offer every level', () => {
  it.each(['All Bloom', 'Violent Quake'])('%s has a five-level picker', (name) => {
    expect(skillOf(new ArchMage(), name).levelList.map((l) => l.value)).toEqual([1, 2, 3, 4, 5].map((lv) => `${name}==${lv}`));
  });
});

describe('Potencializar Magia reshapes the three skills level by level', () => {
  it('leaves the ratios and hit counts on the table without Climax', () => {
    const cls = magus();

    expect(skillOf(cls, 'All Bloom').formula(inputAt(5))).toBe(2500);
    expect(skillOf(cls, 'Violent Quake').formula(inputAt(5))).toBe(2750);
    expect([hitsOf(skillOf(cls, 'All Bloom')), hitsOf(skillOf(cls, 'Violent Quake'))]).toEqual([20, 20]);
    expect(skillOf(cls, 'Destructive Hurricane').part2.formula(inputAt(5))).toBe(0);
    expect(skillOf(cls, 'All Bloom').part2.formula(inputAt(5))).toBe(0);
  });

  it('Nv1: two pillars at a time, and a 500% second Tufão hit whatever the skill level', () => {
    const cls = magus({ Climax: 1 });

    expect(hitsOf(skillOf(cls, 'Violent Quake'))).toBe(40);
    expect(hitsOf(skillOf(cls, 'All Bloom'))).toBe(20);
    expect([1, 5].map((lv) => skillOf(cls, 'Destructive Hurricane').part2.formula(inputAt(lv)))).toEqual([500, 500]);
  });

  it('Nv2: two flowers at a time', () => {
    const cls = magus({ Climax: 2 });

    expect(hitsOf(skillOf(cls, 'All Bloom'))).toBe(40);
    expect(hitsOf(skillOf(cls, 'Violent Quake'))).toBe(20);
  });

  it('Nv4: none of the three deals damage', () => {
    const cls = magus({ Climax: 4 });

    for (const name of ['All Bloom', 'Violent Quake', 'Destructive Hurricane']) {
      expect(skillOf(cls, name).formula(inputAt(5)), name).toBe(0);
    }
  });

  it('Nv5: the garden burns for a flat 7.000%', () => {
    const cls = magus({ Climax: 5 });

    expect([1, 5].map((lv) => skillOf(cls, 'All Bloom').part2.formula(inputAt(lv)))).toEqual([7000, 7000]);
    expect(skillOf(cls, 'Destructive Hurricane').part2.formula(inputAt(5))).toBe(0);
  });

  it.each([
    { climax: 0, bloom: 0, quake: 0, hurricane: 0 },
    { climax: 1, bloom: 0, quake: -50, hurricane: 0 },
    { climax: 2, bloom: -50, quake: 0, hurricane: 0 },
    { climax: 3, bloom: 100, quake: 100, hurricane: 100 },
    { climax: 4, bloom: 0, quake: 0, hurricane: 0 },
    { climax: 5, bloom: 0, quake: 0, hurricane: 70 },
  ])('Nv$climax puts its damage step on the skill-id bonus, where gear adds too', ({ climax, bloom, quake, hurricane }) => {
    const { totalBonus } = simulate({ skill: 'Destructive Hurricane==5', actives: { Climax: climax } });

    expect(totalBonus[SKILL_ID_BY_NAME['All Bloom']] || 0).toBe(bloom);
    expect(totalBonus[SKILL_ID_BY_NAME['Violent Quake']] || 0).toBe(quake);
    expect(totalBonus[SKILL_ID_BY_NAME['Destructive Hurricane']] || 0).toBe(hurricane);
  });

  it('Nv3 roughly doubles Tufão Destrutivo on a bare build', () => {
    const plain = simulate({ skill: 'Destructive Hurricane==5' }).max;
    const climax = simulate({ skill: 'Destructive Hurricane==5', actives: { Climax: 3 } }).max;

    expect(climax / plain).toBeCloseTo(2, 2);
  });
});

describe('Zéfiro, what Tufão Destrutivo leaves on the caster at Nv4', () => {
  it('is a toggle of its own: ATQM +100 and Wind magic damage +30%', () => {
    const zephyr = new ArchMage().activeSkills.find((s) => s.name === 'Zephyr');

    expect(zephyr.label).toBe('Zéfiro');
    expect(zephyr.dropdown.find((d) => d.isUse).bonus).toEqual({ matk: 100, m_my_element_wind: 30 });
  });
});

describe('Pólen and Empalamento take the target resistance down by 100%', () => {
  it.each([
    { debuff: 'Pollen', label: 'Pólen', hits: 'All Bloom==5', misses: 'Violent Quake==5' },
    { debuff: 'Impalement', label: 'Empalamento', hits: 'Violent Quake==5', misses: 'All Bloom==5' },
  ])('$label doubles its element on a Neutral target and leaves the other alone', ({ debuff, label, hits, misses }) => {
    expect(JobBuffs.find((b) => b.name === debuff)).toMatchObject({ label, isDebuff: true });

    expect(simulate({ skill: hits }).propertyMultiplier).toBe(1);
    expect(simulate({ skill: hits, debuffs: { [debuff]: 10 } }).propertyMultiplier).toBe(2);
    expect(simulate({ skill: misses, debuffs: { [debuff]: 10 } }).propertyMultiplier).toBe(1);
  });

  it('stack with each other, as bROWiki says both can be up at once', () => {
    const both = { Pollen: 10, Impalement: 10 };

    expect(simulate({ skill: 'All Bloom==5', debuffs: both }).propertyMultiplier).toBe(2);
    expect(simulate({ skill: 'Violent Quake==5', debuffs: both }).propertyMultiplier).toBe(2);
  });
});

describe('the extra hits only show up at their own Climax level', () => {
  it('Tufão Destrutivo prints no second hit off Nv1, and a positive one on it', () => {
    expect(simulate({ skill: 'Destructive Hurricane==5' }).part2Max).toBe(0);
    expect(simulate({ skill: 'Destructive Hurricane==5', actives: { Climax: 1 } }).part2Max).toBeGreaterThan(0);
  });

  it('Florescer prints no garden burn off Nv5, and a positive one on it', () => {
    expect(simulate({ skill: 'All Bloom==5' }).part2Max).toBe(0);
    expect(simulate({ skill: 'All Bloom==5', actives: { Climax: 5 } }).part2Max).toBeGreaterThan(0);
  });
});

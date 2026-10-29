import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ElementMapper } from 'src/app/constants';
import { ElementType } from 'src/app/constants/element-type.const';
import { JobBuffs } from 'src/app/constants/job-buffs';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { buildElementTable } from 'src/app/core/summary-tables';
import { ArchMage } from 'src/app/jobs/ArchMage';
import { AtkSkillModel } from 'src/app/jobs/_character-base.abstract';
import { createMainModel } from 'src/app/utils';
import { calcSkillAspd } from 'src/app/utils/calc-skill-aspd';

/**
 * The Sage-line ground fields (Vulcão / Dilúvio / Furacão) and the Sorcerer's four Insígnias,
 * offered in the party buff list. Tracker card 7eJx6XNmTPFTuRdYzv4L ("Habilidades de terreno
 * do Feiticeiro").
 *
 * The numbers are the client descriptions (ragassets skills.json), which bROWiki's seven
 * pages repeat. How each lands comes from rAthena's renewal code:
 * - a field is `ratio += 10/14/17/19/20` on the attacker's own element in battle_attr_fix;
 * - an Insígnia under the target is `ratio += 50` for the element it is weak to;
 * - Insígnia Nv3 is `skillratio += 25` on magic of its element;
 * - Insígnia do Vento Nv3 adds 50 to the delay rate of Wind magic.
 * Where rAthena and the client disagree (Vento Nv2, Água Nv3) the client wins.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const NEUTRAL_LV1 = '21077';
const WATER_LV1 = '21078';

const buff = (name: string) => {
  const def = JobBuffs.find((b) => b.name === name);
  if (!def) throw new Error(`${name} is not in JobBuffs`);

  return def;
};

const option = (name: string, label: string) => {
  const found = buff(name).dropdown.find((d) => d.label === label);
  if (!found) throw new Error(`${name} has no option "${label}"`);

  return found;
};

/** A bare level-250 Magus through the real chain, with JobBuffs picked by option label. */
function simulate(opts: { skill: string; buffs?: Record<string, string>; monster?: string; propertyAtk?: ElementType; actives?: Record<string, number> }) {
  const cls: any = new ArchMage();
  const activeSkillIds = cls.activeSkills.map((s: any) => opts.actives?.[s.name] ?? 0);
  cls.setLearnSkills({ activeSkillIds, passiveSkillIds: cls.passiveSkills.map(() => 0) });
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls.getSkillBonusAndName();

  const model: any = createMainModel();
  model.class = cls.classId;
  model.level = 250;
  model.jobLevel = 1;
  model.int = 130;
  model.dex = 130;
  model.spl = 100;
  model.selectedAtkSkill = opts.skill;
  model.propertyAtk = opts.propertyAtk;

  const buffEquips: Record<string, any> = {};
  for (const [name, label] of Object.entries(opts.buffs ?? {})) {
    buffEquips[name] = option(name, label).bonus;
  }

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[opts.monster ?? NEUTRAL_LV1], equipAtks, masteryAtks, buffEquips, buffMasterys: {}, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: [], activeSkillNames, learnedSkillMap,
    selectedAtkSkill: opts.skill, selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  return {
    max: ds.skillMaxDamage as number,
    skillPropertyMultiplier: ds.skillPropertyMultiplier as number,
    basicPropertyAtk: (calc as any).propertyBasicAtk as ElementType,
    totalBonus: (calc as any).totalEquipStatus as Record<string, number>,
  };
}

const FIRE_SKILL = 'Crimson Arrow==5';
const WATER_SKILL = 'Frozen Slash==5';
const WIND_SKILL = 'Storm Cannon==5';
const EARTH_SKILL = 'Rock Down==5';

describe('Terreno Mágico offers the three fields, one at a time', () => {
  it('lists every level of Vulcão, Dilúvio and Furacão in one picker', () => {
    const def = buff('_Sage_Field');

    expect(def).toMatchObject({ label: 'Terreno Mágico', inputType: 'dropdown' });
    expect(def.isDebuff).toBeFalsy();
    expect(def.dropdown.filter((d) => d.isUse)).toHaveLength(15);
  });

  it.each([
    { label: 'Vulcão Nv 1', bonus: { volcano: 10, atk: 10, matk: 10 } },
    { label: 'Vulcão Nv 5', bonus: { volcano: 20, atk: 30, matk: 30 } },
    { label: 'Dilúvio Nv 2', bonus: { deluge: 14, hpPercent: 9 } },
    { label: 'Dilúvio Nv 5', bonus: { deluge: 20, hpPercent: 15 } },
    { label: 'Furacão Nv 3', bonus: { violentGale: 17, flee: 9 } },
    { label: 'Furacão Nv 4', bonus: { violentGale: 19, flee: 12 } },
  ])('$label carries the client table', ({ label, bonus }) => {
    expect(option('_Sage_Field', label).bonus).toEqual(bonus);
  });
});

describe('a field adds to the property modifier of its own element', () => {
  it.each([
    { field: 'Vulcão Nv 5', hits: FIRE_SKILL, misses: WATER_SKILL },
    { field: 'Dilúvio Nv 5', hits: WATER_SKILL, misses: WIND_SKILL },
    { field: 'Furacão Nv 5', hits: WIND_SKILL, misses: EARTH_SKILL },
  ])('$field: +20% on its element on a Neutral target, nothing on another', ({ field, hits, misses }) => {
    const buffs = { _Sage_Field: field };

    expect(simulate({ skill: hits }).skillPropertyMultiplier).toBe(1);
    expect(simulate({ skill: hits, buffs }).skillPropertyMultiplier).toBe(1.2);
    expect(simulate({ skill: misses, buffs }).skillPropertyMultiplier).toBe(1);
  });

  it('adds points rather than scaling, as rAthena renewal does (a resisting target)', () => {
    const table = ElementMapper['Water 1'][ElementType.Fire];
    const fire = simulate({ skill: FIRE_SKILL, monster: WATER_LV1, buffs: { _Sage_Field: 'Vulcão Nv 5' } });

    expect(table).toBeLessThan(100);
    expect(fire.skillPropertyMultiplier).toBeCloseTo((table + 20) / 100, 2);
  });

  it('pays the level step: Vulcão Nv1 is +10%', () => {
    expect(simulate({ skill: FIRE_SKILL, buffs: { _Sage_Field: 'Vulcão Nv 1' } }).skillPropertyMultiplier).toBe(1.1);
  });

  it('stacks with a target debuff on the same modifier (Pólen)', () => {
    const r = simulate({ skill: FIRE_SKILL, buffs: { _Sage_Field: 'Vulcão Nv 5', Pollen: 'Sim' } });

    expect(r.skillPropertyMultiplier).toBe(2.2);
  });

  it('puts the side effects in the totals', () => {
    const bare = simulate({ skill: FIRE_SKILL }).totalBonus;
    const volcano = simulate({ skill: FIRE_SKILL, buffs: { _Sage_Field: 'Vulcão Nv 5' } }).totalBonus;

    expect((volcano.atk || 0) - (bare.atk || 0)).toBe(30);
    expect((volcano.matk || 0) - (bare.matk || 0)).toBe(30);
    expect(simulate({ skill: FIRE_SKILL, buffs: { _Sage_Field: 'Dilúvio Nv 5' } }).totalBonus.hpPercent).toBe(15);
    expect(simulate({ skill: FIRE_SKILL, buffs: { _Sage_Field: 'Furacão Nv 5' } }).totalBonus.flee).toBe((bare.flee || 0) + 15);
  });
});

describe('an Insígnia under the target: +50% from the element it is weak to', () => {
  it('offers four independent debuffs', () => {
    for (let i = 1; i <= 4; i++) {
      expect(buff(`_Sorcerer_Insignia_Target_${i}`)).toMatchObject({ isDebuff: true });
    }
  });

  it.each([
    { index: 1, hits: WATER_SKILL, misses: FIRE_SKILL },
    { index: 2, hits: WIND_SKILL, misses: WATER_SKILL },
    { index: 3, hits: EARTH_SKILL, misses: WIND_SKILL },
    { index: 4, hits: FIRE_SKILL, misses: EARTH_SKILL },
  ])('Insígnia $index', ({ index, hits, misses }) => {
    const buffs = { [`_Sorcerer_Insignia_Target_${index}`]: 'Sim' };

    expect(simulate({ skill: hits, buffs }).skillPropertyMultiplier).toBe(1.5);
    expect(simulate({ skill: misses, buffs }).skillPropertyMultiplier).toBe(1);
  });

  it('stacks with a field of the same element', () => {
    const buffs = { _Sorcerer_Insignia_Target_1: 'Sim', _Sage_Field: 'Dilúvio Nv 5' };

    expect(simulate({ skill: WATER_SKILL, buffs }).skillPropertyMultiplier).toBe(1.7);
  });

  it('allows all four target debuffs at once', () => {
    const buffs = Object.fromEntries([1, 2, 3, 4].map((i) => {
      const name = `_Sorcerer_Insignia_Target_${i}`;
      return [name, buff(name).dropdown.find((option) => option.isUse).label];
    }));
    for (const skill of [WATER_SKILL, WIND_SKILL, EARTH_SKILL, FIRE_SKILL]) {
      expect(simulate({ skill, buffs }).skillPropertyMultiplier).toBe(1.5);
    }
  });

  it('shows both in the element table column, next to the other resist reductions', () => {
    const row = buildElementTable({ fireInsigniaOnTarget: 50, deluge: 20, bitterCold: 15 }).find((r) => r.name === 'Water');

    expect(row.elementResistReduction).toBe(85);
  });
});

describe('Insígnia on the caster, Nv2 and Nv3', () => {
  it('offers Nv2 and Nv3 of each element, and not Nv1 (it only buffs the elemental)', () => {
    expect(buff('_Sorcerer_Insignia').dropdown.filter((d) => d.isUse).map((d) => d.label)).toEqual([
      'Fogo Nv 2', 'Fogo Nv 3', 'Água Nv 2', 'Água Nv 3', 'Vento Nv 2', 'Vento Nv 3', 'Terra Nv 2', 'Terra Nv 3',
    ]);
  });

  it.each([
    { label: 'Fogo Nv 2', bonus: { atk: 50, atkPercent: 10, propertyAtk: ElementType.Fire } },
    { label: 'Fogo Nv 3', bonus: { matk: 50, insignia_ratio_fire: 25 } },
    { label: 'Água Nv 2', bonus: { atkPercent: 10, healReceived: 10, propertyAtk: ElementType.Water } },
    { label: 'Água Nv 3', bonus: { vct: 30, insignia_ratio_water: 25 } },
    { label: 'Vento Nv 2', bonus: { atkPercent: 10, acd: 10, propertyAtk: ElementType.Wind } },
    { label: 'Vento Nv 3', bonus: { acd_magic_wind: 50, insignia_ratio_wind: 25 } },
    { label: 'Terra Nv 2', bonus: { atkPercent: 10, hp: 500, def: 50, propertyAtk: ElementType.Earth } },
    { label: 'Terra Nv 3', bonus: { sp: 50, mdef: 50, insignia_ratio_earth: 25 } },
  ])('$label carries the client table', ({ label, bonus }) => {
    expect(option('_Sorcerer_Insignia', label).bonus).toEqual(bonus);
  });

  describe('Nv3 adds 25 to the ratio of magic of its element', () => {
    // Terra Nv3 grants no ATQM, so the ratio is the only thing it moves.
    const buffs = { _Sorcerer_Insignia: 'Terra Nv 3' };

    it('Rock Down pays its ratio plus 25', () => {
      const cls = new ArchMage();
      cls.setLearnSkills({ activeSkillIds: cls.activeSkills.map(() => 0), passiveSkillIds: cls.passiveSkills.map(() => 0) });
      cls.getSkillBonusAndName();
      const skill = cls.atkSkills.find((s) => s.name === 'Rock Down') as AtkSkillModel;
      const ratio = skill.formula({ skillLevel: 5, model: { level: 250 }, status: { totalSpl: 100 } } as any);

      const plain = simulate({ skill: EARTH_SKILL }).max;
      const insignia = simulate({ skill: EARTH_SKILL, buffs }).max;

      expect(insignia / plain).toBeCloseTo((ratio + 25) / ratio, 3);
    });

    it('leaves magic of another element alone', () => {
      expect(simulate({ skill: FIRE_SKILL, buffs }).max).toBe(simulate({ skill: FIRE_SKILL }).max);
    });

    it('does not give a hit to a skill whose ratio is zero (Pilares de Pedra under Climax Nv4)', () => {
      const off = { actives: { Climax: 4 } };

      expect(simulate({ skill: 'Violent Quake==5', buffs, ...off }).max).toBe(simulate({ skill: 'Violent Quake==5', ...off }).max);
    });
  });

  describe('Nv2 turns physical attacks to its element', () => {
    it('sets the basic attack property', () => {
      expect(simulate({ skill: FIRE_SKILL }).basicPropertyAtk).toBe(ElementType.Neutral);
      expect(simulate({ skill: FIRE_SKILL, buffs: { _Sorcerer_Insignia: 'Terra Nv 2' } }).basicPropertyAtk).toBe(ElementType.Earth);
    });

    it('yields to the element picker, which is the character’s own endow', () => {
      const r = simulate({ skill: FIRE_SKILL, buffs: { _Sorcerer_Insignia: 'Terra Nv 2' }, propertyAtk: ElementType.Holy });

      expect(r.basicPropertyAtk).toBe(ElementType.Holy);
    });

    it('does not leak the element into the numeric totals', () => {
      const { totalBonus } = simulate({ skill: FIRE_SKILL, buffs: { _Sorcerer_Insignia: 'Terra Nv 2' } });

      expect(totalBonus.propertyAtk).toBeUndefined();
      expect([totalBonus.hp, totalBonus.def, totalBonus.atkPercent]).toEqual([500, 50, 10]);
    });
  });

  describe('Vento Nv3 halves the after-cast delay of Wind magic only', () => {
    const aspd = (skillData: Partial<AtkSkillModel>, totalEquipStatus: Record<string, number>) =>
      calcSkillAspd({
        skillData: { name: 'Test', acd: 1, cd: 0, fct: 0, vct: 0, ...skillData } as AtkSkillModel,
        totalEquipStatus: { acd: 0, vct: 0, fct: 0, fctPercent: 0, ...totalEquipStatus } as any,
        status: { totalDex: 0, totalInt: 0 } as any,
        skillLevel: 1,
      }).reducedAcd;

    it.each([
      { what: 'Wind magic', skill: { isMatk: true, element: ElementType.Wind }, expected: 0.5 },
      { what: 'Fire magic', skill: { isMatk: true, element: ElementType.Fire }, expected: 1 },
      { what: 'a physical Wind skill', skill: { isMatk: false, element: ElementType.Wind }, expected: 1 },
    ])('$what', ({ skill, expected }) => {
      expect(aspd(skill, { acd_magic_wind: 50 })).toBe(expected);
    });

    it('sums with the global after-cast reduction', () => {
      expect(aspd({ isMatk: true, element: ElementType.Wind }, { acd_magic_wind: 50, acd: 10 })).toBe(0.4);
    });
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Jobs from '../jobs';
import { AtkSkillFormulaInput, AtkSkillModel, CharacterBase } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { Calculator } from '../core/calculator';
import { CalculatorController } from '../core/calculator-controller';
import { createMainModel } from '../utils/create-main-model';
import { normalizeSavedModel } from '../core/saved-model';
import { encodeBuild, decodeBuild } from '../core/share-codec';
import { ElementType } from '../constants/element-type.const';
import { REBALANCE_2022_REFERENCE } from './rebalance-2022-reference';
import { SKILL_FORMULA_VERSION_OPTIONS, SkillFormulaVersion } from './skill-formula-version';

const version = 'current' as const;
function job(name: ClassName, active: Record<string, number> = {}): CharacterBase {
  const cls = new Jobs[name]() as CharacterBase;
  cls.setLearnSkills({ activeSkillIds: cls.activeSkills.map(s => active[s.name] ?? 0), passiveSkillIds: cls.passiveSkills.map(() => 0) }).getSkillBonusAndName();
  return cls;
}
function input(level: number, active: Record<string, number> = {}, learned: Record<string, number> = {}): AtkSkillFormulaInput {
  return { skillLevel: level, model: { level: 100, skillFormulaVersion: version }, status: { totalPow: 0, totalSpl: 0, totalCon: 0 },
    skills: { isActive: n => !!active[typeof n === 'string' ? n : n.name], activeLevel: n => active[typeof n === 'string' ? n : n.name] ?? 0, learnedLevel: n => learned[typeof n === 'string' ? n : n.name] ?? 0 },
    monster: { size: 'm', data: { level: 100 }, isRace: () => false, isElement: () => false },
    weapon: { data: { weight: 0, baseWeaponLevel: 4 }, isType: () => false, isSubType: () => false },
    equipmentBonus: { shield: {} }, totalBonus: {}, maxHp: 0, maxSp: 0, ammoElement: ElementType.Fire,
  } as unknown as AtkSkillFormulaInput;
}
function attack(name: string, cls?: CharacterBase): AtkSkillModel {
  const owner = cls ?? job(REBALANCE_2022_REFERENCE.find(g => name in g.skills)!.classes[0]);
  return owner.getAtkSkills(version).find(s => s.name === name)!;
}
const count = (value: number | ((i: AtkSkillFormulaInput) => number), i: AtkSkillFormulaInput) => typeof value === 'function' ? value(i) : value ?? 1;
const names = new Set(REBALANCE_2022_REFERENCE.flatMap(g => Object.keys(g.skills)));
const snapshot = (skills: AtkSkillModel[]) => skills.filter(s => names.has(s.name)).map(s => ({ ...JSON.parse(JSON.stringify(s)), ratio: s.formula(input(1)), packets: count(s.totalHit, input(1)) }));

describe('third fourth-job / second expanded-job rebalance, June 2022', () => {
  it('covers all 148 attacks, 18 article groups, 20 classes and all learned levels without mutating other versions', () => {
    expect(REBALANCE_2022_REFERENCE).toHaveLength(18);
    expect(REBALANCE_2022_REFERENCE.flatMap(g => Object.keys(g.skills))).toHaveLength(148);
    expect(new Set(REBALANCE_2022_REFERENCE.flatMap(g => g.classes)).size).toBe(20);
    for (const group of REBALANCE_2022_REFERENCE) for (const name of group.classes) {
      const cls = job(name);
      const legacy = snapshot(cls.getAtkSkills('pre-rebalance'));
      const later = snapshot(cls.getAtkSkills('rebalance-2026-02'));
      const skills = cls.getAtkSkills(version);
      for (const [skillName, ref] of Object.entries(group.skills)) {
        const skill = skills.find(s => s.name === skillName)!;
        expect(skill, `${name}: ${skillName}`).toBeDefined();
        for (let level = 1; level <= ref.maxLevel; level++) {
          const i = input(level);
          expect(skill.levelList.some(s => s.value.endsWith(`==${level}`)), `${skillName} Nv${level}`).toBe(true);
          expect(skill.formula(i), `${skillName} Nv${level}`).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(skill.formula(i))).toBe(true);
          expect(count(skill.totalHit, i)).toBeGreaterThan(0);
          for (const field of ['vct', 'fct', 'acd', 'cd'] as const) {
            expect(typeof skill[field] === 'function' ? skill[field](level) : skill[field], `${skillName} ${field}`).toBeGreaterThanOrEqual(0);
          }
        }
      }
      expect(snapshot(cls.getAtkSkills('pre-rebalance'))).toEqual(legacy);
      expect(snapshot(cls.getAtkSkills('rebalance-2026-02'))).toEqual(later);
    }
  });

  // Independently read from Sigma's v3/v2 formula tables: base100, traits0,
  // no learned passives, weapon weight0, no optional buffs. Split hits are not packets.
  it.each([
    ['Frozen Slash',5,4750], ['Storm Cannon',5,4750], ['Rock Down',5,4750], ['Crimson Arrow',5,1500], ['Destructive Hurricane',5,14250],
    ['Hack and Slasher',10,7300], ['Storm Slash',5,950], ['Madness Crusher',5,4400], ['Servant Weapon',5,2500], ['Dragonic Aura',10,36500],
    ['Crescive Bolt',10,4420], ['Gale Storm',10,9500], ['Shadow Stab',5,1500], ['Eternal Slash',5,1325],
    ['Abyss Dagger',5,2600], ['Deft Stab',10,5850], ['Frenzy Shot',10,4000], ['Abyss Square',5,2850],
    ['Explosion Blaster',5,14000], ['Massive Flame Blaster',10,21500], ['Second Flame',5,14700],
    // 18.300%, not the article's 18.000%: the client's table is 300 + 1800/Nv level by
    // level, and the article's 2140/Nv only lands on its Nv10. See skill-ratio-client-table.
    ['Astral Strike',10,18300],
    ['Overslash',10,1200], ['Shield Shooting',5,11900], ['Grand Judgement',10,15250], ['Cross Rain',10,3200],
    ['Metallic Fury',5,11000], ['Rhythm Shooting',5,800], ['Rose Blossom',5,10200],
    ['Framen',5,4000], ['Arbitrium',10,10000], ['Petitio',10,10500],
    ['Explosive Powder',5,2650], ['Mayhemic Thorns',10,2700], ['Diamond Storm',5,8150], ['Axe Stomp',5,4600],
    ['Spark Blaster',10,7750], ['Triple Laser',5,3300], ['Mighty Smash',10,3100],
    ['Only One Bullet',5,8300], ['Spiral Shooting',5,8500], ['Magazine for One',5,2400], ['Wild Fire',5,12500],
    ['Basic Grenade',5,5750], ['Hasty Fire in the Hole',5,6750],
    ['Talisman of Blue Dragon',5,7500], ['Talisman of White Tiger',5,5100], ['Talisman of Red Phoenix',5,5500], ['Talisman of Black Tortoise',5,9400],
    ['Shadow Hunting',10,4500], ['Shadow Dance',10,5900], ['Shadow Flash',10,8600], ['Huuma Shuriken - Grasp',10,2700],
    ['Huuma Shuriken - Construct',10,4600], ['Red Flame Cannon',10,13350], ['Cold Blooded Cannon',10,5750], ['Thundering Cannon',10,13600], ['Golden Dragon Cannon',10,4300],
    ['Twinkling Galaxy',5,2200], ['Star Cannon',5,2700], ['All in the Sky',10,23000],
    ['Chulho Sonic Claw',7,5650], ['Hogogong Strike',7,1580], ['Hyunrok Breeze',7,4800], ['Hyunrok Cannon',7,7350],
    ['Double Bowling Bash',10,2650], ['Mega Sonic Blow',10,5350], ['Shield Chain Rush',10,5100], ['Spiral Pierce Max',10,5265],
    ['Meteor Storm Buster',10,3500], ['Jupitel Thunderstorm',10,18000], ['Napalm Vulcan Strike',10,6850],
  ])('%s Nv%i = %i%% in the earlier version', (name, level, expected) => {
    expect(attack(name as string).formula(input(level as number))).toBeCloseTo(expected as number);
  });

  it('uses historical cast tables at low and high levels', () => {
    expect(attack('Storm Slash').cd).toBe(0.3);
    expect(attack('Crescive Bolt')).toMatchObject({ cd: 0.15, acd: 0.3 });
    expect(attack('Cross Rain')).toMatchObject({ cd: 4.5, acd: 0.15 });
    expect(attack('Spark Blaster')).toMatchObject({ vct: 1.5, fct: 0.5, acd: 0.25, cd: 0.7 });
    expect(attack('Mighty Smash')).toMatchObject({ acd: 0, cd: 0.3 });
    const ground = attack('Ground Gravitation');
    expect([1,4,10].map(l => typeof ground.vct === 'function' && ground.vct(l))).toEqual([3,3.2,5]);
    expect([1,4,10].map(l => typeof ground.acd === 'function' && ground.acd(l))).toEqual([2,1.8,1]);
  });

  it('uses the Korean final Shield Shooting example and Grand Judgement base ratio', () => {
    const i = input(5, {}, { 'Shield Mastery': 10 });
    i.equipmentBonus = { shield: { weight: 150, refine: 10 } } as any;
    expect(attack('Shield Shooting').formula(i)).toBe(12840);
    const grand = input(10);
    grand.monster.isRace = (...races) => races.includes('plant');
    expect(attack('Grand Judgement').formula(grand)).toBe(16850);
  });

  it('resolves traits, mastery, weapon weight, stances, hit counts and expected repeat probabilities', () => {
    const i = input(5, { 'Turisus Runestone': 1 });
    i.status.totalPow = 20;
    expect(attack('Storm Slash').formula(i)).toBe(1365);
    i.weapon.data = { weight: 150, baseWeaponLevel: 5 } as any;
    expect(attack('Madness Crusher').formula(i)).toBe(5290);
    const cross = input(10, { 'Holy Shield': 1 }, { 'Spear & Sword Mastery': 10 });
    cross.status.totalSpl = 20;
    expect(attack('Cross Rain').formula(cross)).toBe(5600);
    expect(count(attack('Cross Rain').totalHit, cross)).toBe(15);
    expect(count(attack('Shadow Stab').totalHit, input(5, { 'Cloaking Exceed': 1 }))).toBe(2);
    expect(count(attack('Deft Stab').damageRepeat, input(10))).toBe(1.5);
    expect(count(attack('Frenzy Shot').totalHit, input(10))).toBe(2);
    expect(count(attack('Frenzy Shot').totalHit, input(1))).toBe(1.1);
    const report = input(10, { 'Research Report': 1 });
    expect(attack('Mayhemic Thorns').formula(report)).toBe(3250);
    expect(count(attack('Mayhemic Thorns').totalHit, report)).toBe(5);
    expect(count(attack('Twinkling Galaxy').totalHit, input(5))).toBe(15);
    expect(attack('Hack and Slasher').canCri).toBe(false);
    expect(attack('Explosion Blaster').canCri).toBe(false);
    expect(attack('Shadow Flash').canCri).toBe(false);
    expect(attack('Triple Laser').canCri).toBe(true);
    expect(attack('Mega Sonic Blow').formula(input(10, { 'Angel of Power': 1, '_Preview_Target Below Half HP': 1 }, { 'Self Study Tactics': 10 }))).toBe(22870);
  });

  it('keeps Metallic Fury primary and branded area packets separate, with one to five marked targets', () => {
    const skill = attack('Metallic Fury');
    const i = input(5, { '_Debuf_Sonic_Brand': 1 }, { 'Stage Manner': 5 });
    i.status.totalSpl = 20;
    i.stack = 5;
    expect(skill.formula(i)).toBe(11150);
    expect(skill.part2.formula(i)).toBe(18650);
    expect(skill.part2.formula(input(5))).toBe(0);
    expect(skill.getElement('', i)).toBe(ElementType.Fire);
    expect(skill.part2.element).toBeUndefined();
  });

  it('round trips the historical version and keeps the rebalance as the default', () => {
    const model = { ...createMainModel(), skillFormulaVersion: 'pre-rebalance' as const, skillStacks: { 'Metallic Fury': 5 } };
    const restored = normalizeSavedModel(decodeBuild(encodeBuild(model)));
    expect(restored.skillFormulaVersion).toBe('pre-rebalance');
    expect(restored.skillStacks).toEqual(model.skillStacks);
    expect(normalizeSavedModel({}).skillFormulaVersion).toBe('current');
    expect(normalizeSavedModel({ skillFormulaVersion: 'future' }).skillFormulaVersion).toBe('current');
    expect(SKILL_FORMULA_VERSION_OPTIONS.map(o => o.value)).toEqual(['current', 'pre-rebalance', 'rebalance-2026-02']);
  });
});

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const table = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));
function solve(name: ClassName, skill: string, formulaVersion: SkillFormulaVersion, active: Record<string, number> = {}, overrides: Partial<ReturnType<typeof createMainModel>> = {}) {
  const cls = job(name, active);
  const model = { ...createMainModel(), class: cls.classId, level: 250, jobLevel: 1, str: 130, int: 130, dex: 130, spl: 100, selectedAtkSkill: skill, skillFormulaVersion: formulaVersion, ...overrides };
  const calc = new Calculator().setMasterItems(items).setHpSpTable(table).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, { monster: monsters['21077'], ...cls.getSkillBonusAndName(), buffEquips: {}, buffMasterys: {}, consumeData: [], aspdPotion: undefined, extraOptionScripts: [], selectedAtkSkill: skill, selectedChances: [], usedHpL: false } as any);
  return { calc, dmg: calc.getTotalSummary().dmg };
}

describe('historical formulas in real damage and autocasts', () => {
  it('selects each build independently, including an explicitly supplied legacy autocast skill', () => {
    const old = solve(ClassName.ArchMage, 'Frozen Slash==5', 'pre-rebalance');
    const third = solve(ClassName.ArchMage, 'Frozen Slash==5', version);
    const fourth = solve(ClassName.ArchMage, 'Frozen Slash==5', 'rebalance-2026-02');
    expect(third.dmg.baseSkillDamage).toBeGreaterThan(old.dmg.baseSkillDamage);
    expect(fourth.dmg.baseSkillDamage - third.dmg.baseSkillDamage).toBe(375);
    expect(third.calc.solveAutoCast('Frozen Slash==5', job(ClassName.ArchMage).atkSkills.find(s => s.name === 'Frozen Slash')).baseSkillDamage).toBe(third.dmg.baseSkillDamage);
    expect(solve(ClassName.ArchMage, 'Frozen Slash==5', 'pre-rebalance').dmg).toEqual(old.dmg);
  });

  // Fúria Estridente needs an instrument and an arrow (client: "Apenas com Chicote ou
  // Instrumento", "Consome 1 Flecha equipada"). The requirement arrived with the skill's
  // "Atual (LATAM)" entry in `shared-skills.ts`, which this version now patches instead
  // of being synthesised bare, so the build has to carry both.
  const BARD_INSTRUMENT = 570028;
  const FIRE_ARROW = 1752;

  it('passes selected marked-target counts to Metallic Fury secondary damage', () => {
    const active = { '_Debuf_Sonic_Brand': 1 };
    const equip = { weapon: BARD_INSTRUMENT, ammo: FIRE_ARROW };
    const one = solve(ClassName.Troubadour, 'Metallic Fury==5', version, active, { ...equip, skillStacks: { 'Metallic Fury': 1 } });
    const five = solve(ClassName.Troubadour, 'Metallic Fury==5', version, active, { ...equip, skillStacks: { 'Metallic Fury': 5 } });
    expect(five.dmg.baseSkillDamage - one.dmg.baseSkillDamage).toBe(15000);
    expect(five.dmg.skillMaxDamage2).toBeGreaterThan(one.dmg.skillMaxDamage2);
    expect(five.dmg.skillMaxDamage).toBe(one.dmg.skillMaxDamage);
  });

  it('applies the third rebalance Climax bonuses and Vigor, which the legacy build lacks', () => {
    const old = solve(ClassName.ArchMage, 'Destructive Hurricane==5', 'pre-rebalance', { Climax: 3 });
    const third = solve(ClassName.ArchMage, 'Destructive Hurricane==5', version, { Climax: 3 });
    const fourth = solve(ClassName.ArchMage, 'Destructive Hurricane==5', 'rebalance-2026-02', { Climax: 3 });
    expect(third.dmg.skillMaxDamage).toBeGreaterThan(old.dmg.skillMaxDamage);
    expect(third.dmg.skillMaxDamage).toBeGreaterThan(fourth.dmg.skillMaxDamage);
    const legacy = solve(ClassName.DragonKnight, 'Dragonic Breath==10', 'pre-rebalance', { Vigor: 10 }).calc.getTotalSummary() as any;
    const rebalanced = solve(ClassName.DragonKnight, 'Dragonic Breath==10', version, { Vigor: 10 }).calc.getTotalSummary() as any;
    expect(rebalanced.flatBasicDmg - legacy.flatBasicDmg).toBe(50);
    expect(rebalanced.vigorBasicRaceDmg - legacy.vigorBasicRaceDmg).toBe(50);
  });
});

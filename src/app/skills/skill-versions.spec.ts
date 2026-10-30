import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Jobs from '../jobs';
import { CharacterBase, AtkSkillFormulaInput, AtkSkillModel } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { Calculator } from '../core/calculator';
import { CalculatorController } from '../core/calculator-controller';
import { createMainModel } from '../utils/create-main-model';
import { normalizeSavedModel } from '../core/saved-model';
import { encodeBuild, decodeBuild } from '../core/share-codec';
import { REBALANCE_2026_REFERENCE } from './rebalance-2026-reference';
import { PREVIEW_275_ATTACKS, previewBuffsForClass } from './preview-275';
import { PREVIEW_275_REFERENCE } from './preview-275-reference';
import { SKILL_ID_BY_NAME } from './index';

function job(name: ClassName): CharacterBase {
  const cls = new Jobs[name]() as CharacterBase;
  cls.setLearnSkills({activeSkillIds:cls.activeSkills.map(() => 0),passiveSkillIds:cls.passiveSkills.map(() => 0)}).getSkillBonusAndName();
  return cls;
}
function input(cls: CharacterBase, level = 1, active: Record<string, number> = {}, learned: Record<string, number> = {}): AtkSkillFormulaInput {
  return { skillLevel:level, model:{level:100,skillFormulaVersion:'rebalance-2026-02'}, status:{totalPow:0,totalSpl:0,totalCon:0},
    skills:{isActive:n => !!active[typeof n === 'string' ? n : n.name],activeLevel:n => active[typeof n === 'string' ? n : n.name] ?? 0, learnedLevel:n => learned[typeof n === 'string' ? n : n.name] ?? 0},
    monster:{size:'m',data:{level:100},isRace:()=>false}, weapon:{data:{weight:0,baseWeaponLevel:4},isType:()=>false,isSubType:()=>false},
    equipmentBonus:{}, totalBonus:{}, maxHp:0,maxSp:0,
  } as unknown as AtkSkillFormulaInput;
}
const count = (n: AtkSkillModel['totalHit'], i: AtkSkillFormulaInput) => typeof n === 'function' ? n(i) : n ?? 1;

describe('February rebalance coverage and isolation', () => {
  it('covers every class in all 18 dropdown articles, every attack and every level', () => {
    expect(REBALANCE_2026_REFERENCE).toHaveLength(18);
    expect(new Set(REBALANCE_2026_REFERENCE.flatMap(g => g.classes)).size).toBe(20);
    for (const group of REBALANCE_2026_REFERENCE) for (const name of group.classes) {
      const cls = job(name);
      const oldSkills = cls.atkSkills;
      const catalog = cls.getAtkSkills('rebalance-2026-02');
      for (const [skillName, reference] of Object.entries(group.skills)) {
        const skill = catalog.find(s => s.name === skillName);
        expect(skill, `${name}: ${skillName}`).toBeDefined();
        expect(SKILL_ID_BY_NAME[skillName], skillName).toBeGreaterThan(0);
        for(let level = 1; level <= reference.maxLevel; level++) {
          const i = input(cls, level);
          expect(skill.levelList.some(s => String(s.value).endsWith(`==${level}`)), `${skillName} Nv${level}`).toBe(true);
          expect(Number.isFinite(skill.formula(i)), skillName).toBe(true);
          expect(skill.formula(i), skillName).toBeGreaterThanOrEqual(0);
          expect(count(skill.totalHit, i), skillName).toBeGreaterThan(0);
          for (const field of ['cd','vct','fct','acd'] as const) {
            const value = skill[field];
            expect(typeof value === 'function' ? value(level) : value, `${skillName} ${field}`).toBeGreaterThanOrEqual(0);
          }
        }
      }
      // Neither requesting the new catalog nor switching back mutates a legacy object.
      expect(cls.atkSkills).toEqual(oldSkills);
      const legacy = cls.getAtkSkills('pre-rebalance');
      for (const old of oldSkills) {
        const restored = legacy.find(s => s.value === old.value);
        expect(restored.cd).toBe(old.cd);
        expect(restored.totalHit).toBe(old.totalHit);
        if (!['Unlucky Rush','Chain Reaction Shot','Red Flame Cannon','Cold Blooded Cannon','Thundering Cannon','Golden Dragon Cannon'].includes(old.name)) expect(restored.formula).toBe(old.formula);
      }
    }
  });

  // Independent values read from the articles at base 100, trait 0 and no passives.
  it.each([
    [ClassName.ArchMage,'Frozen Slash',5,4900], [ClassName.DragonKnight,'Hack and Slasher',10,7700],
    [ClassName.Windhawk,'Crescive Bolt',10,12220], [ClassName.ShadowCross,'Eternal Slash',5,1325],
    [ClassName.AbyssChaser,'Abyss Square',5,2850], [ClassName.Inquisitor,'Second Flame',5,14600],
    [ClassName.ImperialGuard,'Shield Shooting',5,14900], [ClassName.Troubadour,'Rose Blossom',5,10200],
    [ClassName.Trouvere,'Metallic Fury',5,13000], [ClassName.Cardinal,'Framen',5,4750],
    [ClassName.Biolo,'Explosive Powder',5,3150], [ClassName.ElementalMaster,'Diamond Storm',5,8150],
    [ClassName.Meister,'Spark Blaster',10,9250], [ClassName.NightWatch,'Only One Bullet',5,18200],
    [ClassName.SoulAscetic,'Talisman of Red Phoenix',5,7450], [ClassName.Shinkiro,'Shadow Flash',10,9000],
    [ClassName.Shiranui,'Golden Dragon Cannon',10,9950], [ClassName.SkyEmperor,'Midnight Kick',5,6600],
    [ClassName.SpiritHandler,'Chulho Sonic Claw',7,12400], [ClassName.HyperNovice,'Mega Sonic Blow',10,8400],
  ])('%s: %s Nv%i = %i%%', (name, skillName, level, expected) => {
    const cls = job(name as ClassName);
    expect(cls.getAtkSkills('rebalance-2026-02').find(s => s.name === skillName).formula(input(cls,level as number))).toBeCloseTo(expected as number);
  });

  it('resolves conditional states and preserves split Hyper Novice packets', () => {
    const cls = job(ClassName.HyperNovice);
    const skills = cls.getAtkSkills('rebalance-2026-02');
    const meteor = skills.filter(s => s.name === 'Meteor Storm Buster');
    expect(meteor.map(s => s.formula(input(cls,10)))).toEqual([3500,2050]);
    const jack = skills.filter(s => s.name === 'Jack Frost Nova');
    expect(jack.map(s => s.formula(input(cls,10)))).toEqual([5400,2000]);
    expect(jack.map(s => count(s.totalHit,input(cls,10)))).toEqual([10,1]);
    expect([1,2,3,4,5,6,7,8,9,10].map(level => skills.find(s => s.name === 'Jupitel Thunderstorm').hitByLevel(level))).toEqual([6,6,7,7,8,8,9,9,10,10]);
    const mega = skills.find(s => s.name === 'Mega Sonic Blow');
    expect(mega.formula(input(cls,10,{'Angel of Power':1,'_Preview_Target Below Half HP':1},{'Self Study Tactics':10}))).toBe(40940);
    const spirit = job(ClassName.SpiritHandler);
    expect(spirit.getAtkSkills('rebalance-2026-02').find(s => s.name === 'Chulho Sonic Claw').formula(input(spirit,7,{}, {'Commune with Chulho':1,'Mystical Creature Mastery':10}))).toBe(16200);
  });

  it('applies Climax packet counts and modes that replace damage with a status effect', () => {
    const cls = job(ClassName.ArchMage);
    const skills = cls.getAtkSkills('rebalance-2026-02');
    const bloom = skills.find(s => s.name === 'All Bloom');
    expect(count(bloom.damageRepeat,input(cls,5,{Climax:2}))).toBe(40);
    expect(bloom.formula(input(cls,5,{Climax:4}))).toBe(0);
    expect(bloom.part2.formula(input(cls,5,{Climax:5}))).toBe(85000);
    const crystal = skills.find(s => s.name === 'Crystal Impact');
    expect(count(crystal.damageRepeat,input(cls,5,{Climax:2}))).toBe(2);
    expect(crystal.formula(input(cls,5,{Climax:4}))).toBe(3375);
    expect(crystal.part2.formula(input(cls,5,{Climax:4}))).toBe(16875);
    const quake = skills.find(s => s.name === 'Violent Quake');
    expect(count(quake.totalHit,input(cls,5,{Climax:1}))).toBe(40);
    expect(quake.formula(input(cls,5,{Climax:4}))).toBe(0);
    expect(skills.find(s => s.name === 'Destructive Hurricane').formula(input(cls,5,{Climax:4}))).toBe(0);
    const arrow = skills.find(s => s.name === 'Crimson Arrow');
    expect(arrow.hit).toBe(1);
    expect(arrow.part2.hit).toBe(2);
  });

  it('includes inherited Sonic Brand ratios and the Giant Growth expected damage', () => {
    const bard = job(ClassName.Troubadour);
    const catalog = bard.getAtkSkills('rebalance-2026-02');
    expect(catalog.find(s => s.name === 'Reverberation').formula(input(bard,5,{'_Debuf_Sonic_Brand':1}))).toBe(2650);
    expect(catalog.find(s => s.name === 'Metalic Sound').formula(input(bard,10,{'_Debuf_Sonic_Brand':1},{Lesson:10}))).toBe(2160);
    const knight = job(ClassName.DragonKnight);
    expect(knight.getAtkSkills('rebalance-2026-02').find(s => s.name === 'Storm Slash').formula(input(knight,5,{'Turisus Runestone':1}))).toBe(3520);
  });
});

describe('275/60 previews, including buffs and recovery', () => {
  // Max-level, per-packet values from both announcement tables, at base 100,
  // trait 0 and without optional passives or buffs.
  it.each([
    ['Imperial Cross',8400,3], ['Radiant Spear',15000,1], ['Rush Strike',17500,1],
    ['Powerful Swing',4550,5], ['Energy Cannonade',4000,7], ['Mystery Powder',21500,1],
    ['Dust Explosion',3450,5], ['Cross Slash',1500,3], ['Hit and Sliding',17500,1],
    ['Chasing Break',3800,5], ['Chasing Shot',5000,2], ['Rhythmical Wave',18500,1],
    ['Wild Shot',1770,7], ['Midnight Fallen',6400,3], ['Dragonic Pierce',3850,5],
    ['Imperial Pressure',14850,1], ['Abyss Flame',2500,5], ['Psychic Stream',18500,1],
    ['Divinus Flos',20000,1], ['Blazing Flame Blast',21000,1], ['Wild Walk',15800,3],
    ['Sky Sun',7500,1], ['Sky Moon',3450,3], ['Star Light Kick',1400,7],
    ['Chulho Battering',1600,5], ['Hyunrok Spirit Power',1750,7],
  ])('%s matches the announcement: ratio %i, packets %i', (name, expected, hits) => {
    const definition = PREVIEW_275_ATTACKS.find(d => d.announcementName === name);
    const reference = PREVIEW_275_REFERENCE.find(s => s.name === name);
    const i = input(job(definition.classes[0]),reference.maxLevel);
    expect(definition.skill.formula(i)).toBe(expected);
    expect(count(definition.skill.totalHit,i)).toBe(hits);
  });

  it('keeps the two Abyss Flame areas separate and Dragonic Pierce ranged', () => {
    const cls = job(ClassName.AbyssChaser);
    const aroundUser = cls.getAtkSkills().find(s => s.value === 'Abyss Flame (Usuário)==5');
    expect(aroundUser.formula(input(cls,5))).toBe(4100);
    expect(count(aroundUser.totalHit,input(cls,5))).toBe(3);
    expect(job(ClassName.DragonKnight).getAtkSkills().find(s => s.name === 'Dragonic Pierce').isMelee ?? false).toBe(false);
  });

  it('maps all 29 announcement skills with their distinct game ids', () => {
    expect(PREVIEW_275_REFERENCE).toHaveLength(29);
    expect(new Set(PREVIEW_275_REFERENCE.map(s => s.id)).size).toBe(29);
    const attacks = new Set(PREVIEW_275_ATTACKS.map(d => d.announcementName));
    expect(attacks.size).toBe(26);
    expect(PREVIEW_275_REFERENCE.filter(s => !attacks.has(s.name)).map(s => s.name).sort()).toEqual(['Energy Conversion','Four Colors Charm','Overcoming Crisis']);
    for(const definition of PREVIEW_275_ATTACKS) for(const name of definition.classes) {
      const cls = job(name);
      const skill = cls.getAtkSkills().find(s => s.value === definition.skill.value);
      expect(skill?.preview).toBe(true);
      expect(skill.labelSuffix).toContain('Prévia');
      expect(SKILL_ID_BY_NAME[skill.name]).toBe(PREVIEW_275_REFERENCE.find(s => s.name === definition.announcementName).id);
    }
    expect(SKILL_ID_BY_NAME['Powerful Swing']).toBe(2279);
    expect(SKILL_ID_BY_NAME['Powerful Swing (Meister)']).toBe(6507);
    expect(SKILL_ID_BY_NAME['Cross Slash']).toBe(3004);
    expect(SKILL_ID_BY_NAME['Cross Slash (Shadow Cross)']).toBe(6511);
  });

  it('applies Overcoming Crisis HP and traits only when enabled', () => {
    const cls = job(ClassName.HyperNovice);
    expect(cls.getSkillBonusAndName().equipAtks['Overcoming Crisis']).toBeUndefined();
    cls.setLearnSkills({activeSkillIds:cls.activeSkills.map(s => s.name === 'Overcoming Crisis' ? 5 : 0),passiveSkillIds:[]});
    expect(cls.getSkillBonusAndName().equipAtks['Overcoming Crisis']).toEqual({hp:75000,pAtk:15,sMatk:15});
    expect(cls.activeSkills.find(s => s.name === 'Overcoming Crisis').label).toContain('Prévia');
  });

  it('makes four elemental charms independently stackable and boosts only their cannon', () => {
    const cls = job(ClassName.Shinkiro);
    const charms = previewBuffsForClass(ClassName.Shinkiro).filter(s => s.name.startsWith('_Preview_Four Colors'));
    expect(charms).toHaveLength(4);
    expect(charms.every(s => s.label.includes('Prévia') && !s.exclusiveGroup)).toBe(true);
    for(const version of ['current','pre-rebalance','rebalance-2026-02'] as const) {
      const cannon = cls.getAtkSkills(version).find(s => s.name === 'Red Flame Cannon');
      const off = input(cls,10);
      const on = input(cls,10,{'_Preview_Four Colors Fire':1,'_Preview_Four Colors Water':1});
      // Legacy formulas use the class state; an off class is enough for this comparison.
      expect(cannon.formula(on)-cannon.formula(off)).toBe(8500);
      expect(cls.getAtkSkills(version).find(s => s.name === 'Darkening Cannon').formula(on)).toBe(cls.getAtkSkills(version).find(s => s.name === 'Darkening Cannon').formula(off));
    }
  });

  it('applies Chasing to existing attacks and to the preview hit counts', () => {
    const cls = job(ClassName.AbyssChaser);
    for(const version of ['current','pre-rebalance','rebalance-2026-02'] as const) {
      const skill = cls.getAtkSkills(version).find(s => s.name === 'Unlucky Rush');
      expect(skill.formula(input(cls,5,{'_Preview_Chasing':1})) - skill.formula(input(cls,5))).toBe(12500);
    }
    const shot = cls.getAtkSkills().find(s => s.name === 'Chasing Shot');
    expect(count(shot.totalHit,input(cls,5))).toBe(2);
    expect(count(shot.totalHit,input(cls,5,{'_Preview_Chasing':1}))).toBe(3);
    const energy = job(ClassName.ArchMage).activeSkills.find(s => s.name === 'Energy Conversion');
    expect(energy.label).toContain('Prévia');
    expect(energy.dropdown.find(s => s.value === 5).label).toContain('600 SP / 10 AP');
  });
});

describe('version persistence and the real damage pipeline', () => {
  it('defaults old/unknown saves to LATAM and round trips the version and preview buffs', () => {
    expect(normalizeSavedModel({}).skillFormulaVersion).toBe('current');
    expect(normalizeSavedModel({skillFormulaVersion:'unknown'}).skillFormulaVersion).toBe('current');
    const model = {...createMainModel(),skillFormulaVersion:'rebalance-2026-02' as const,activeSkillMap:{'Overcoming Crisis':5}};
    expect(normalizeSavedModel(decodeBuild(encodeBuild(model))).skillFormulaVersion).toBe('rebalance-2026-02');
    expect(normalizeSavedModel(decodeBuild(encodeBuild(model))).activeSkillMap).toEqual({'Overcoming Crisis':5});
  });

  it('switches damage and timing per build, including explicitly supplied autocast data', () => {
    const items = JSON.parse(readFileSync('src/assets/demo/data/item.json','utf8'));
    const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json','utf8'));
    const table = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json','utf8'));
    const cls = job(ClassName.ArchMage);
    function solve(version: 'pre-rebalance'|'rebalance-2026-02', name = 'Soul Vulcan Strike==5') {
      const bonuses = cls.getSkillBonusAndName();
      const model = {...createMainModel(),class:cls.classId,level:250,jobLevel:1,int:130,dex:130,spl:100,selectedAtkSkill:name,skillFormulaVersion:version};
      const calc = new Calculator().setMasterItems(items).setHpSpTable(table).setClass(cls);
      calc.loadItemFromModel(model);
      new CalculatorController().runChain(calc,{monster:monsters['21077'],...bonuses,buffEquips:{},buffMasterys:{},consumeData:[],aspdPotion:undefined,extraOptionScripts:[],selectedAtkSkill:name,selectedChances:[],usedHpL:false} as any);
      return {calc,damage:(calc as any).damageSummary};
    }
    const before = solve('pre-rebalance');
    const after = solve('rebalance-2026-02');
    expect(after.damage.baseSkillDamage).toBeGreaterThan(before.damage.baseSkillDamage);
    expect(after.calc.atkSkills.find(s=>s.name==='Frozen Slash').cd).toBe(0.45);
    const autocast = after.calc.solveAutoCast('Soul Vulcan Strike==5',cls.atkSkills.find(s=>s.name==='Soul Vulcan Strike'));
    expect(autocast.baseSkillDamage).toBe(after.damage.baseSkillDamage);
    expect(solve('pre-rebalance').damage).toEqual(before.damage);
    const astral = solve('rebalance-2026-02','Astral Strike==10').damage;
    expect(astral.skillTotalHit).toBe(1);
    expect(astral.skillMaxDamage2).toBeGreaterThan(astral.skillMaxDamage);
  });
});

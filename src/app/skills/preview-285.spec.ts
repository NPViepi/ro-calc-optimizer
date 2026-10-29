import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Jobs from '../jobs';
import { AtkSkillFormulaInput, AtkSkillModel, CharacterBase } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { ElementType } from '../constants/element-type.const';
import { Calculator } from '../core/calculator';
import { CalculatorController } from '../core/calculator-controller';
import { createMainModel } from '../utils/create-main-model';
import { skillDescHtml } from '../utils/pretty-item-desc';
import { normalizeSavedModel } from '../core/saved-model';
import { encodeBuild, decodeBuild } from '../core/share-codec';
import { buildRotationView } from '../layout/pages/ro-calculator/battle-hud/rotation-view';
import { SKILL_ID_BY_NAME } from './index';
import { PREVIEW_285_REFERENCE } from './preview-285-reference';
import { PREVIEW_285_ATTACKS, preview285BuffsForClass, PREVIEW_285_AUTOCAST, INTEGRATION_PROCS } from './preview-285';

function job(name: ClassName, active: Record<string, number> = {}, passive: Record<string, number> = {}): CharacterBase {
  const cls = new Jobs[name]() as CharacterBase;
  cls.setLearnSkills({ activeSkillIds: cls.activeSkills.map(s => active[s.name] ?? 0), passiveSkillIds: cls.passiveSkills.map(s => passive[s.name] ?? 0) }).getSkillBonusAndName();
  return cls;
}
function input(level = 1, active: Record<string, number> = {}, passive: Record<string, number> = {}): AtkSkillFormulaInput {
  const cls = job(ClassName.Shinkiro, active, passive);
  return { skillLevel: level, model: { level: 100 }, status: { totalPow: 0, totalSpl: 0, totalCon: 0 },
    skills: { ...cls.skillState, isActive: n => !!active[typeof n === 'string' ? n : n.name], activeLevel: n => active[typeof n === 'string' ? n : n.name] ?? 0,
      learnedLevel: n => passive[typeof n === 'string' ? n : n.name] ?? 0 },
    weapon: { isType: () => false },
  } as unknown as AtkSkillFormulaInput;
}
const attack = (name: string) => PREVIEW_285_ATTACKS.find(d => d.skill.name === name)!.skill;
const hits = (s: AtkSkillModel, i = input()) => typeof s.totalHit === 'function' ? s.totalHit(i) : s.totalHit ?? 1;

describe('285/65 preview coverage', () => {
  it('accounts for all 36 client identities, including procs, enhanced kick and unsupported Alitea', () => {
    expect(PREVIEW_285_REFERENCE).toHaveLength(36);
    expect(new Set(PREVIEW_285_REFERENCE.map(s => s.id)).size).toBe(36);
    const supported = new Set<string>();
    for (const name of new Set(PREVIEW_285_ATTACKS.flatMap(d => d.classes).concat([ClassName.ShadowCross, ClassName.NightWatch, ClassName.SpiritHandler]))) {
      const cls = job(name);
      for (const skill of [...cls.getAtkSkills(), ...cls.activeSkills]) supported.add(skill.name);
      for (const control of preview285BuffsForClass(name)) expect(control.dropdown.find(o => !o.isUse)?.value).toBe(0);
    }
    for (const ref of PREVIEW_285_REFERENCE) {
      expect(SKILL_ID_BY_NAME[ref.name]).toBe(ref.id);
      expect(skillDescHtml(ref.id)).toContain(`${ref.name} (Prévia)`);
      if ('unavailableClass' in ref) expect(ref.unavailableClass).toBe('Alitea');
      else if (ref.id === 6636) expect(attack('Seven-Star Heavenly Kick').maxStack).toBe(7);
      else expect(supported.has(ref.name), ref.name).toBe(true);
    }
    for (const { classes, skill } of PREVIEW_285_ATTACKS) for (const name of classes) {
      const cls = job(name);
      for (const version of ['current', 'rebalance-2022-06', 'rebalance-2026-02'] as const) {
        expect(cls.getAtkSkills(version).find(s => s.value === skill.value)?.preview).toBe(true);
      }
      expect(cls.atkSkills.some(s => s.name === skill.name)).toBe(false);
      for (const entry of skill.levelList!) {
        const lv = Number(entry.value.split('==')[1]);
        expect(skill.formula(input(lv))).toBeGreaterThan(0);
        expect(hits(skill, input(lv))).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ['Servant Weapon-Cleave', 5, 4050, 3], ['Shield Slam', 5, 21000, 1], ['Overdrive Protocol', 4, 6800, 2],
    ['Rampant Vine', 5, 4500, 2], ['Phantom Dagger', 5, 12750, 3.75], ['Wraith Dash', 3, 15000, 1],
    ['Burning Flame', 5, 6400, 3], ['Frozen Hail', 5, 6400, 3], ['Storm Rise', 5, 6400, 3], ['Terra Burst', 5, 6400, 3], ['Venom Bombard', 5, 6400, 3],
    ['Punitio', 5, 3750, 4], ['Lex Expiatrix', 5, 6500, 3], ['Sky-Shattering Strike', 5, 7950, 3], ['Fragment Bolt', 5, 7000, 2],
    ['Primed Solid Trap', 5, 19750, 1], ['Primed Deep Blind Trap', 5, 19750, 1], ['Primed Swift Trap', 5, 19750, 1], ['Primed Flame Trap', 5, 19750, 1],
    ['Fugue Des Fleches', 5, 1550, 8], ['Shadow Torrent', 10, 6500, 4], ['Seven-Star Heavenly Kick', 5, 35000, 1],
    ['Yellow Dragon Talisman', 5, 8600, 3], ['Wind Cutter Turbo', 10, 5500, 5], ['High Magnum Break', 10, 16000, 1],
  ])('%s Nv%i: published ratio %i%%, packets %i', (name, lv, ratio, packets) => {
    expect(attack(name as string).formula(input(lv as number))).toBe(ratio);
    expect(hits(attack(name as string), input(lv as number))).toBe(packets);
  });

  it('applies conditional packets, masteries and the seven-satellite enhancement', () => {
    expect(attack('Servant Weapon-Cleave').formula(input(5, { Vigor: 1 }))).toBe(5400);
    expect(hits(attack('Servant Weapon-Cleave'), input(5, { Vigor: 1 }))).toBe(4);
    expect(hits(attack('Overdrive Protocol'), input(4, { _Meister_ABR_Cannon: 1 }))).toBe(4);
    expect(attack('Overdrive Protocol').formula(input(4, {}, { 'ABR Mastery': 10 }))).toBe(7300);
    expect(hits(attack('Rampant Vine'), input(5, { _Preview_Creeper: 1 }))).toBe(5);
    expect(attack('Rampant Vine').formula(input(5, {}, { 'Bionics Mastery': 10 }))).toBe(4900);
    expect(attack('Lex Expiatrix').formula(input(5, { Competentia: 1 }, { 'Fidus Animus': 10 }))).toBe(8750);
    expect(attack('Fugue Des Fleches').formula(input(5, { 'Mystic Symphony': 1 }))).toBe(1950);
    expect(attack('Shadow Torrent').formula(input(10, { Surge: 5 }, { 'Shadow Dance': 10 }))).toBe(9700);
    expect(attack('Seven-Star Heavenly Kick').formula({ ...input(5), stack: 7 })).toBe(46620);
    expect(attack('Yellow Dragon Talisman').formula(input(5, { _SoulAscetic_Blessing: 5 }, { 'Talisman Mastery': 10 }))).toBe(11600);
    expect(attack('Primed Solid Trap').verifyItemFn(input())).toContain('Primed Trap');
    expect(attack('Primed Solid Trap').verifyItemFn(input(5, { 'Primed Trap': 1 }))).toBe('');
    expect(attack('Primed Solid Trap').verifyItemFn(input(5, { 'Primed Trap': 1, 'Wug Rider': 1 }))).toContain('Worg');
    const shieldRange = attack('Shield Slam').isMelee;
    expect(typeof shieldRange === 'function' && shieldRange('mace', input(5, { 'Holy Shield': 1 }))).toBe(false);
    expect(attack('Wraith Dash').element).toBe(ElementType.Ghost);
    for (const [state, packets, critical] of [['First Faith Power', 3, true], ['Judge', 4, false], ['Third Exor Flame', 2, false]] as const) {
      const s = attack('Sky-Shattering Strike');
      expect(hits(s, input(5, { [state]: 1 }))).toBe(packets);
      expect(typeof s.canCri === 'function' && s.canCri(input(5, { [state]: 1 }))).toBe(critical);
    }
  });

  it('resolves Integration element from cast level and proc strength from learned level', () => {
    const cls = job(ClassName.ElementalMaster);
    expect(cls.autoCastDefinitions.filter(d => d.key === PREVIEW_285_AUTOCAST.key)).toHaveLength(1);
    for (const [index, proc] of INTEGRATION_PROCS.entries()) {
      const i = input(index + 1, { 'Elemental Integration': index + 1 }, { 'Elemental Integration': 5 });
      const result = PREVIEW_285_AUTOCAST.resolve({ skillState: i.skills, skillById: id => cls.getAtkSkills().find(s => SKILL_ID_BY_NAME[s.name] === id) } as any);
      expect(result.sources![0]).toMatchObject({ skillId: 6616 + index, skillLevel: 5, chance: 25, trigger: 'physical-attack' });
      expect(result.sources![0].skillData?.element).toBe(proc.element);
      expect(attack(proc.name).formula(input(5, { _ElementalMaster_spirit: proc.spirit }))).toBe(7100);
    }
    expect(PREVIEW_285_AUTOCAST.resolve({ skillState: input().skills } as any).sources).toBeUndefined();
  });

  it('keeps old saves off and round trips preview controls by name', () => {
    const cls = job(ClassName.Shinkiro);
    expect(cls.getSkillBonusAndName().equipAtks.Surge).toBeUndefined();
    const model = { ...createMainModel(), selectedAtkSkill: 'Shadow Torrent==10', activeSkillMap: { Surge: 5, 'Mirage - Cluster': 1 } };
    const restored = normalizeSavedModel(decodeBuild(encodeBuild(model)));
    expect(restored.activeSkillMap).toEqual(model.activeSkillMap);
    expect(restored.selectedAtkSkill).toBe(model.selectedAtkSkill);
  });
});

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const table = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));
function solve(name: ClassName, skill: string, active: Record<string, number> = {}, extraOptions: Record<string, number>[] = []) {
  const cls = job(name, active);
  const model = { ...createMainModel(), class: cls.classId, level: 250, jobLevel: 1, str: 130, int: 130, dex: 130, luk: 130, selectedAtkSkill: skill };
  const calc = new Calculator().setMasterItems(items).setHpSpTable(table).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, { monster: monsters['21077'], ...cls.getSkillBonusAndName(), buffEquips: {}, buffMasterys: {}, consumeData: [], aspdPotion: undefined, extraOptionScripts: extraOptions, selectedAtkSkill: skill, selectedChances: [], usedHpL: false } as any);
  return calc.getTotalSummary();
}
describe('285 previews in the damage engine', () => {
  it('applies Surge to physical outcomes and stronger Shadow Torrent, without a HIT bonus', () => {
    const off = solve(ClassName.Shinkiro, 'Shadow Torrent==10');
    const on = solve(ClassName.Shinkiro, 'Shadow Torrent==10', { Surge: 5 });
    expect(on.dmg.skillMinDamageNoCri).toBeGreaterThan(off.dmg.skillMinDamageNoCri * 3);
    expect(on.dmg.skillMinDamage).toBeGreaterThan(off.dmg.skillMinDamage * 3);
    expect(on.dmg.skillAccuracy).toBe(off.dmg.skillAccuracy);
    expect(on.dmg.skillFormulaGraphNoCri.min.nodes.some(n => n.id === 'nonCriticalDamage')).toBe(true);
    expect(on.dmg.skillFormulaGraph.min.nodes.some(n => n.id === 'nonCriticalDamage')).toBe(false);
  });

  it('disables basic and skill criticals while Venom Ignition boosts normal physical damage', () => {
    const off = solve(ClassName.ShadowCross, 'Cross Slash (Shadow Cross)==5');
    const on = solve(ClassName.ShadowCross, 'Cross Slash (Shadow Cross)==5', { 'Venom Ignition': 5 });
    expect(off.dmg.skillCanCri).toBe(true);
    expect(on.dmg.skillCanCri).toBe(false);
    expect(on.dmg.skillCriRateToMonster).toBe(0);
    expect(on.dmg.criRateToMonster).toBe(0);
    expect(on.dmg.criRateBreakdown.total).toBe(0);
    expect(on.dmg.skillMinDamage).toBeGreaterThan(off.dmg.skillMinDamageNoCri * 1.9);
    expect(on.dmg.basicMinDamage).toBeGreaterThan(off.dmg.basicMinDamage * 1.9);
    expect(on.dmg.criMaxDamage).toBe(0);
    const forced = solve(ClassName.ShadowCross, 'Cross Slash (Shadow Cross)==5', {}, [{ forceCri: 1 }]);
    const suppressed = solve(ClassName.ShadowCross, 'Cross Slash (Shadow Cross)==5', { 'Venom Ignition': 5 }, [{ forceCri: 1 }]);
    expect(forced.dmg.skillCriRateToMonster).toBe(100);
    expect(suppressed.dmg.skillCanCri).toBe(false);
    expect(suppressed.dmg.skillCriRateToMonster).toBe(0);
  });

  it('applies the Spirit Handler resonance to the correct attack id', () => {
    const off = solve(ClassName.SpiritHandler, 'Chulho Sonic Claw==7');
    const on = solve(ClassName.SpiritHandler, 'Chulho Sonic Claw==7', { 'Resonance of Gwiseol - Cheolho': 1 });
    expect(on.dmg.skillMinDamage).toBeGreaterThan(off.dmg.skillMinDamage * 1.4);
    expect(on.dmg.skillBonusFromEquipment - off.dmg.skillBonusFromEquipment).toBe(50);
  });

  it('keeps per-use damage but declines DPS and mixed-rotation timing without published delays', () => {
    const result = solve(ClassName.ArchMage, 'Wraith Dash==3');
    expect(result.dmg.skillMinDamage).toBeGreaterThan(0);
    expect(result.calcSkill.timingUnknown).toBe(true);
    expect(result.dmg.skillDps).toBe(0);
    const view = buildRotationView({ rotation: ['Wraith Dash==3', '__basic'], summaryByValue: new Map([['Wraith Dash==3', result]]), baseSummary: result, atkSkills: job(ClassName.ArchMage).getAtkSkills(), hasSelectedChances: false });
    expect(view.timingUnknown).toBe(true);
    expect(view.cycle.sustainedDps).toBe(0);
    expect(view.ttk).toBeNull();
  });
});

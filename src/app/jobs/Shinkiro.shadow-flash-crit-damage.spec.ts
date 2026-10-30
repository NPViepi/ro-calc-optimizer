import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { Shinkiro } from './Shinkiro';
import { Shiranui } from './Shiranui';

/**
 * Centelha das Trevas (Shadow Flash, 5482) and the *equipment* crit-damage bonus.
 *
 * Reported by a community user: "o stat de porcentagem de dano crítico está contando
 * inteiro, sendo que no jogo só conta metade dele". They were right — the skill carried
 * `canCri: true` without `criDmgPercentage`, so it took 100% of "Dano Crítico +N%" while
 * every other can-crit 4th-job skill in the engine takes half.
 *
 * The half is not a convention someone invented here, it is measured in game: the Night
 * Watch gearless recording (NightWatch.replay.spec.ts) has a pet granting crit damage
 * +1% and the skill's critical lands at ×1.005, not ×1.01.
 *
 * Why the Shadow Flash recordings did not catch it: that character wore no equipment at
 * all, so `criDmg` was 0. Those replays pin the other leg of the multiplier — the base
 * 140% plus T.Crít from CRV, which `criDmgPercentage` never scales — and are silent on
 * this one. See Shinkiro.shadow-flash-replay.spec.ts.
 *
 * The two legs, and where each is applied (damage-calculator.ts):
 *
 *   criMultiplier    = 1.40 + T.Crít%          <- traits, never halved  (:251)
 *   criDmgToMonster  = criDmg × criDmgPercentage  <- equipment, halved  (:1301)
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_NEUTRAL = '21077';
const SKILL = 'Shadow Flash==10';

/** A bare accessory whose only effect is "Dano Crítico +N%", so nothing else can move. */
const CRIT_DMG_ACC = 999000001;
const withCritDamageItem = (criDmg: number) => ({
  ...items,
  [CRIT_DMG_ACC]: {
    id: CRIT_DMG_ACC,
    name: 'Test Crit Damage Accessory',
    itemTypeId: 2,
    itemSubTypeId: 517,
    location: 'Accessory',
    slots: 0,
    defense: 0,
    weight: 0,
    requiredLevel: 1,
    usableClass: ['all'],
    script: { criDmg: [String(criDmg)] },
  },
});

/**
 * Same character as the replay spec — CRT 100, no gear — with one accessory bolted on so
 * the equipment leg is the only thing that differs between runs.
 */
function critOf(ClassCtor: typeof Shinkiro | typeof Shiranui, classId: number, criDmg: number) {
  const cls = new ClassCtor();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
    .getSkillBonusAndName();
  learnedSkillMap.set('Shadow Dance', 5);
  learnedSkillMap.set('Shadow Flash', 10);

  const db = criDmg > 0 ? withCritDamageItem(criDmg) : items;
  const calc = new Calculator().setMasterItems(db).setHpSpTable(hpSpTable).setClass(cls);

  const bonus = cls.getJobBonusStatus(46);
  const model: any = createMainModel();
  model.class = classId;
  model.level = 230;
  model.jobLevel = 46;
  model.str = 125; model.agi = 1; model.vit = 1; model.int = 1; model.dex = 1; model.luk = 125;
  model.pow = 0; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 0; model.crt = 100;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi;
  model.jobVit = bonus.vit; model.jobInt = bonus.int;
  model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta;
  model.jobWis = bonus.wis; model.jobSpl = bonus.spl;
  model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  if (criDmg > 0) model.accLeft = CRIT_DMG_ACC;
  model.selectedAtkSkill = SKILL;

  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_NEUTRAL],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: SKILL,
    selectedChances: [], usedHpL: false,
  } as any);

  const summary = (calc as any).damageSummary;
  return {
    cri: summary.skillMaxDamage as number,
    noCri: summary.skillMaxDamageNoCri as number,
    criDmgToMonster: summary.skillCriDmgToMonster as number,
    percentage: summary.skillCriDmgPercentage as number,
  };
}

describe.each([
  ['Shinkiro', Shinkiro, 4304] as const,
  ['Shiranui', Shiranui, 4305] as const,
])('Centelha das Trevas — %s', (_name, ClassCtor, classId) => {
  it('applies only half of the equipment crit damage', () => {
    const r = critOf(ClassCtor, classId, 50);

    expect(r.percentage).toBe(0.5);
    expect(r.criDmgToMonster).toBe(25);
  });

  it('moves the critical by half the bonus, not all of it', () => {
    const semBonus = critOf(ClassCtor, classId, 0);
    const comBonus = critOf(ClassCtor, classId, 50);

    // Crit damage +50% -> ×1.25 on the critical, not the ×1.50 it used to give. The
    // band is wider than an equality because the damage is floored per hit across the
    // skill's 4 hits, which walks the ratio a thousandth off the clean figure — the two
    // classes land on different absolute numbers and so on different residues.
    const ratio = comBonus.cri / semBonus.cri;
    expect(ratio).toBeGreaterThan(1.245);
    expect(ratio).toBeLessThan(1.255);
  });

  it('leaves the non-critical damage untouched', () => {
    // "Dano Crítico" only exists inside the critical branch; a build that never crits
    // must read the same with and without the accessory.
    expect(critOf(ClassCtor, classId, 50).noCri).toBe(critOf(ClassCtor, classId, 0).noCri);
  });

  it('keeps the gearless multiplier the replays measured — 1.40 + T.Crít 35%', () => {
    // criDmgPercentage must not touch the trait leg. CRV 100 + 5 from the job table
    // gives T.Crít ⌊105/3⌋ = 35, so the ratio stays 1.75 with no equipment on.
    const r = critOf(ClassCtor, classId, 0);
    expect(r.cri / r.noCri).toBeCloseTo(1.75, 3);
  });
});

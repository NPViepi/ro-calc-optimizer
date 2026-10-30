import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { ArchMage } from './ArchMage';

/** Pazzolino's 26/09/2026 Magus recordings, all on the same medium Neutral dummy.
 * The three short files have no trait packet (single-map recordings); the long file gives
 * SPL 100 / STA 39 / WIS 39 for the identical character and equipment.
 */
const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));
const replay: any = decodeReplay(loadReplayFixture('mg-pazzolino-field-arrow.rrf'));
const bareReplay: any = decodeReplay(loadReplayFixture('mg-pazzolino-crimson-bare-recognized.rrf'));
const aid = replay.sessionInfo.aid;
const ACTIVES = { 'Recognized Spell': 1, 'Mystical Amplification': 10 };

function packets(r: any, skillId: number) {
  return (r.damage ?? []).filter((d: any) => d.source === r.sessionInfo.aid && d.skillId === skillId);
}

function sim(skill: string, actives: Record<string, number> = ACTIVES, source: any = replay) {
  const model: any = replayToModel(source, items).model;
  const cls: any = new ArchMage();
  const b = cls.getJobBonusStatus(model.jobLevel);
  Object.assign(model, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });
  const learned: Record<number, number> = {};
  for (const [id, level] of source.learnedSkills) learned[id] = level;
  const passiveSkillIds = cls.passiveSkills.map((p: any) => learned[SKILL_ID_BY_NAME[p.name]] ?? 0);
  const activeSkillIds = cls.activeSkills.map((a: any) => actives[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds, passiveSkillIds }).getSkillBonusAndName();
  model.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters['21065'], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {}, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: parseOptionScripts((model.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: [], usedHpL: false,
  } as any);
  const ds: any = (calc as any).damageSummary;
  return { min: ds.skillMinDamage as number, max: ds.skillMaxDamage as number,
    hits: ds.skillTotalHit as number, explosion: ds.skillMaxDamage2 as number,
    dpsInput: ds.skillDpsInputMax as number };
}

describe('Magus ground spells — packets, not displayed white hit labels', () => {
  it('imports the full build and its traits', () => {
    expect(replay.sessionInfo.aid).toBe(aid);
    expect(replayToModel(replay, items).summary).toMatchObject({ equippedCount: 19, skippedItems: [],
      traits: { pow: 0, sta: 39, wis: 39, spl: 100, con: 0, crt: 0 } });
  });

  it.each([
    { name: 'Tornado Storm', id: 5227, ticks: 10, displayed: 1, damage: 3_687_935 },
    { name: 'Mystery Illusion', id: 5217, ticks: 13, displayed: 1, damage: 8_883_008 },
    { name: 'Floral Flare Road', id: 5229, ticks: 10, displayed: 2, damage: 5_056_160 },
    { name: 'Rain of Crystal', id: 5216, ticks: 8, displayed: 2, damage: 3_973_810 },
  ])('$name uses $ticks packet totals for one cast', ({ name, id, ticks, displayed, damage }) => {
    const observed = packets(replay, id);
    expect(observed).toHaveLength(ticks);
    expect(observed.every((d: any) => d.hits === displayed && Number(d.damage) === damage)).toBe(true);
    const calculated = sim(`${name}==5`);
    expect(calculated.hits).toBe(ticks);
    expect(damage).toBeGreaterThanOrEqual(calculated.min);
    expect(damage / calculated.max).toBeLessThan(1.00004);
  });

  it('also counts Stratum Tremor as ten 0.4-second ticks over four seconds', () => {
    // This skill was not cast in the replay; its timing is specified by the client table.
    expect(sim('Stratum Tremor==5').hits).toBe(10);
  });
});

describe('Flecha Escarlate — separate arrow and explosion packets', () => {
  it('matches both hits in the minimally equipped Maestria Arcana recording', () => {
    expect(replayToModel(bareReplay, items).summary).toMatchObject({
      equippedCount: 1, skippedItems: [],
      traits: { pow: 0, sta: 39, wis: 39, spl: 100, con: 0, crt: 0 },
    });
    expect(packets(bareReplay, 5235)).toHaveLength(3);
    expect(packets(bareReplay, 5236)).toHaveLength(3);
    expect(packets(bareReplay, 5235).every((d: any) => Number(d.damage) === 68_402 && d.hits === 1)).toBe(true);
    expect(packets(bareReplay, 5236).every((d: any) => Number(d.damage) === 95_362 && d.hits === 2)).toBe(true);
    expect((bareReplay.skillUses ?? []).some((s: any) => s.source === bareReplay.sessionInfo.aid
      && s.skillId === 2206 && s.time < packets(bareReplay, 5235)[0].time)).toBe(true);
    const calculated = sim('Crimson Arrow==5', { 'Recognized Spell': 1 }, bareReplay);
    expect(calculated.max).toBe(68_402);
    expect(calculated.explosion).toBe(95_362);
  });
  it('the long recording isolates the arrow, Climax, then Pólen on one build', () => {
    expect(packets(replay, 5235).map((d: any) => Number(d.damage))).toEqual([
      5_710_489, 5_710_489, 5_710_489, 5_710_489, 5_710_489,
      11_421_239, 11_421_239, 11_421_239,
    ]);
    expect(packets(replay, 5236).map((d: any) => Number(d.damage))).toEqual([
      8_030_386, 8_030_386, 8_030_386, 16_060_772, 16_060_772,
      32_122_256, 32_122_256, 32_122_256,
    ]);
    expect((replay.statusEvents ?? []).some((s: any) => s.aid === 4379 && s.statusId === 1183)).toBe(true);
  });

  it('the three controlled replays reproduce the same base, Climax and Pólen steps', () => {
    const names = ['mg-pazzolino-arrow-plain.rrf', 'mg-pazzolino-arrow-climax.rrf', 'mg-pazzolino-arrow-pollen.rrf'];
    const states = names.map((name) => {
      const r: any = decodeReplay(loadReplayFixture(name));
      expect(replayToModel(r, items).summary.equippedCount).toBe(19);
      return [Number(packets(r, 5235)[0].damage), Number(packets(r, 5236)[0].damage)];
    });
    expect(states).toEqual([[5_710_489, 8_030_386], [5_710_489, 16_060_772], [11_421_239, 32_122_256]]);
  });

  it('matches the direct arrow closely and makes Climax double only the explosion', () => {
    const plain = sim('Crimson Arrow==5');
    const climax = sim('Crimson Arrow==5', { ...ACTIVES, Climax: 4 });
    expect(plain.hits).toBe(1);
    expect(Math.abs(plain.max - 5_710_489)).toBeLessThan(100);
    expect(climax.max).toBe(plain.max);
    expect(climax.explosion / plain.explosion).toBeCloseTo(2, 3);
    expect(plain.dpsInput).toBe(plain.max + plain.explosion);
    expect(climax.dpsInput).toBe(climax.max + climax.explosion);
    expect(Math.abs(plain.explosion - 8_030_386)).toBeLessThan(150);
    expect(Math.abs(climax.explosion - 16_060_772)).toBeLessThan(300);
  });

  it('Pazzolino screenshot confirms the same explosion-to-arrow ratio on a second damage state', () => {
    // The chat log shows one 6,661,920 arrow and two 4,684,168 explosion hits.
    // A replay packet combines the two explosion hits in its damage field.
    const replayArrow = Number(packets(replay, 5235)[0].damage);
    const replayExplosion = Number(packets(replay, 5236)[0].damage);
    const screenshotArrow = 6_661_920;
    const screenshotExplosion = 2 * 4_684_168;
    expect(screenshotExplosion / screenshotArrow).toBeCloseTo(replayExplosion / replayArrow, 6);
    expect(screenshotExplosion / screenshotArrow).toBeCloseTo(45 / 32, 5);
  });
});

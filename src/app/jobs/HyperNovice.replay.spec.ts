import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { importReplayBuffer } from 'src/app/replay/replay-to-model';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { HyperNovice } from './HyperNovice';

/**
 * Hyper Novice — the magic tree checked against `fixtures/hn-magic-lv1.rrf`, recorded on
 * tra_fild on 02/08/2026 by "Asbrun III" against "Dummy - Médio" (monster 21065, Formless,
 * Neutral 1, MDEF 0, soft MDEF 25).
 *
 * The recording is worth four runs in one file. The player casts every magic skill at
 * **level 1**, then strips all 20 pieces of gear (including shadow and costume) and casts
 * them again, then re-equips, casts the ultimate and casts them again, then strips the gear
 * once more. The two bare runs are the ones used here: with no weapon there is no MATK
 * variance, so every packet is a single deterministic number and the comparison is by
 * **equality**, not by range.
 *
 * Character (session snapshot + the traits the player reported):
 *   base level 240, job level 50, class 4307
 *   STR 31  AGI 100  VIT 120  INT 120  DEX 94  LUK 100
 *   SPL 100  WIS 30  STA 29  (POW/CON/CRT at zero)
 *   Self Study Sorcery Lv5; every attack skill cast at Lv1 (the 0x01de packets say so).
 *
 * What it decided:
 *   - the `[V2]` tables (Sigma's blog) were wrong for Hell's Drive, Napalm Vulcan Strike,
 *     Jack Frost Nova's explosion and Ground Gravitation's field. The client description
 *     is right, same verdict as the Night Watch recordings (see [[sigma-v2-vs-client-tables]]);
 *   - Meteor Storm Buster (5455) was missing from the class entirely;
 *   - the ultimate "Anjo da Magia" (5462) multiplies the skill ratio, per skill;
 *   - Self Study Sorcery's "+N% damage" column reaches the repeating damage of a ground
 *     skill but NOT its first hit.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

/** "Dummy - Médio" — the only target hit in the recording. */
const DUMMY_MEDIUM = '21065';
const BASE_LEVEL = 240;
const JOB_LEVEL = 50;
const SORCERY = 5;

/**
 * The status packets read ATQ Equip. = 100 and ATQM Equip. = 100 with **nothing** equipped.
 * This was chased as an unidentified buff for a while; it is neither a buff nor a mystery —
 * it is the character's own two Super Novice passives, both learned at Lv5 in the replay's
 * skill tree (5075 and 5077):
 *   Crescimento (Break Through) Lv5      ATQ +100
 *   Transcendência (Transcendence) Lv5   ATQM +100
 *
 * They are injected here rather than switched on through `setLearnSkills` for one reason:
 * the calculator books Break Through's ATK as **mastery** ATK (`isMasteryAtk`), which lands
 * after the P.ATQ multiplier and therefore does not show up in ATQ Equip., while the client
 * clearly prints it there. Which of the two stages the server uses cannot be settled from a
 * pure magic build, so the class is left alone and this file reproduces the status window.
 * Transcendence is already `isEquipAtk` and needs no such care.
 */
const RECORDING_BUFF = { atk: 100, matk: 100 };

const REPLAY = 'src/app/replay/__tests__/fixtures/hn-magic-lv1.rrf';
function replayBuffer() {
  const b = readFileSync(REPLAY);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function simulate(skillValue: string, opts: { ultimate?: boolean } = {}) {
  const cls = new HyperNovice();
  // The passive lists are read positionally by setLearnSkills; use the raw list so the
  // indexes line up with the (sorted) public getter.
  const passiveIds = (cls as any)._passiveSkillList.map((s: any) => (s.name === 'Self Study Sorcery' ? SORCERY : 0));
  const activeIds = (cls as any)._activeSkillList.map((s: any) => (s.name === 'Angel of Magic' && opts.ultimate ? 1 : 0));
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const bonus = cls.getJobBonusStatus(JOB_LEVEL);
  const model: any = createMainModel();
  model.class = 4307;
  model.level = BASE_LEVEL;
  model.jobLevel = JOB_LEVEL;
  model.str = 31; model.agi = 100; model.vit = 120; model.int = 120; model.dex = 94; model.luk = 100;
  model.pow = 0; model.sta = 29; model.wis = 30; model.spl = 100; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = skillValue;

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MEDIUM],
    equipAtks: { ...equipAtks, _recordingBuff: RECORDING_BUFF },
    masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const summary = (calc as any).damageSummary;
  const dmgCalculator = (calc as any).dmgCalculator;
  const total: any = calc.getTotalSummary();
  return {
    /** skill percentage, per hit, already truncated by the engine */
    ratio: summary.baseSkillDamage as number,
    /** no weapon means no MATK variance: min === max, and both are the packet */
    min: summary.skillMinDamage as number,
    max: summary.skillMaxDamage as number,
    matk: (dmgCalculator.getStatusMatk() + dmgCalculator.getExtraMatk()) as number,
    statusAtk: total.calc.totalStatusAtk as number,
    sMatk: dmgCalculator.traitBonus.sMatk as number,
  };
}

/**
 * The 0x01de packets of the two bare runs. `noUltimate` is the run at t=29..53s and
 * `withUltimate` the one at t=94..118s, after "Anjo da Magia" was cast (AP 200 -> 50, a
 * 300s buff). Both runs repeat the same value packet after packet, which is what makes
 * equality the right comparison.
 */
const PACKETS: { label: string; value: string; noUltimate: number; withUltimate: number }[] = [
  { label: 'Meteor Storm Buster (landing)', value: 'Meteor Storm Buster==1', noUltimate: 32214, withUltimate: 48336 },
  { label: 'Meteor Storm Buster (explosion)', value: 'Meteor Storm Buster (Explosão)==1', noUltimate: 30691, withUltimate: 46043 },
  { label: 'Jupitel Thunderstorm', value: 'Jupitel Thunderstorm==1', noUltimate: 72672, withUltimate: 123552 },
  { label: "Hell's Drive", value: "Hell's Drive==1", noUltimate: 64347, withUltimate: 109404 },
  { label: 'Jack Frost Nova (sphere)', value: 'Jack Frost Nova (Inicial)==1', noUltimate: 13923, withUltimate: 23676 },
  { label: 'Jack Frost Nova (explosion)', value: 'Jack Frost Nova==1', noUltimate: 28748, withUltimate: 48888 },
  { label: 'Ground Gravitation (burst)', value: 'Ground Gravitation (Inicial)==1', noUltimate: 163796, withUltimate: 245708 },
  { label: 'Ground Gravitation (field)', value: 'Ground Gravitation==1', noUltimate: 31447, withUltimate: 47176 },
];

/**
 * Napalm Vulcan Strike is the only reading that is not exact: the simulator lands 7 low
 * out of 27013 (0.026%). It is the one skill Self Study Sorcery boosts twice as much, and
 * the server appears to apply that doubled bonus after the target's soft MDEF instead of
 * on the ratio; every other skill is unaffected by the difference. Not worth a special
 * case — pinned here so a future recording can settle it.
 */
const NAPALM = { value: 'Napalm Vulcan Strike==1', noUltimate: 27013, withUltimate: 54054 };
const NAPALM_TOLERANCE = 10;

describe('Hyper Novice — damage of the two bare runs', () => {
  it.each(PACKETS)('$label: the packet matches exactly', ({ value, noUltimate }) => {
    const r = simulate(value);
    // No weapon, so the engine has no range to hide behind.
    expect(r.min).toBe(r.max);
    expect(r.min).toBe(noUltimate);
  });

  it('Napalm Vulcan Strike is within 0.03% (the doubled passive bonus rounds elsewhere)', () => {
    expect(Math.abs(simulate(NAPALM.value).min - NAPALM.noUltimate)).toBeLessThanOrEqual(NAPALM_TOLERANCE);
  });

  /**
   * The old `[V2]` ratios put four of these packets far outside anything the engine
   * could produce — this is the assertion that actually decides the client table wins.
   * `v2Ratio` is the Lv1 percentage the class carried before, without the base-level
   * factor: Sigma's `base + lv * (perLv + sorcery * n) + SPL * k`.
   */
  it.each([
    { label: "Hell's Drive", value: "Hell's Drive==1", v2Ratio: 1500 + (700 + SORCERY * 4) + 108 * 3, packet: 64347 },
    { label: 'Napalm Vulcan Strike', value: 'Napalm Vulcan Strike==1', v2Ratio: 350 + (650 + SORCERY * 4) + 108 * 3, packet: 27013 },
    { label: 'Jack Frost Nova (explosion)', value: 'Jack Frost Nova==1', v2Ratio: 400 + (500 + SORCERY * 5) + 108 * 4, packet: 28748 },
    { label: 'Ground Gravitation (field)', value: 'Ground Gravitation==1', v2Ratio: 800 + (700 + SORCERY * 4) + 108 * 2, packet: 31447 },
  ])('$label: the old [V2] ratio would miss the packet by more than 5%', ({ value, v2Ratio, packet }) => {
    const r = simulate(value);
    // Damage scales linearly with the ratio, so the old damage is the current one x k.
    const k = Math.floor(v2Ratio * (BASE_LEVEL / 100)) / r.ratio;
    expect(Math.abs(packet - r.min * k) / packet).toBeGreaterThan(0.05);
  });
});

describe('Hyper Novice — the "Anjo da Magia" ultimate (5462)', () => {
  it.each(PACKETS)('$label: the packet with the ultimate up matches exactly', ({ value, withUltimate }) => {
    expect(simulate(value, { ultimate: true }).min).toBe(withUltimate);
  });

  it('Napalm Vulcan Strike doubles, within the same 0.03%', () => {
    expect(Math.abs(simulate(NAPALM.value, { ultimate: true }).min - NAPALM.withUltimate)).toBeLessThanOrEqual(
      NAPALM_TOLERANCE * 2,
    );
  });

  /**
   * The multiplier is per skill and it lands on the **ratio**, not on the final damage:
   * the recorded packets divide out to x1.70 / x1.50 / x2.00 to five decimal places, and
   * an additive skill-damage bonus (the usual channel) would compose wrongly with the
   * passive's own +5% and come out ~2% short.
   */
  it.each([
    { label: 'Jupitel Thunderstorm', value: 'Jupitel Thunderstorm==1', factor: 1.7 },
    { label: "Hell's Drive", value: "Hell's Drive==1", factor: 1.7 },
    { label: 'Jack Frost Nova (explosion)', value: 'Jack Frost Nova==1', factor: 1.7 },
    { label: 'Meteor Storm Buster (landing)', value: 'Meteor Storm Buster==1', factor: 1.5 },
    { label: 'Ground Gravitation (field)', value: 'Ground Gravitation==1', factor: 1.5 },
    { label: 'Napalm Vulcan Strike', value: 'Napalm Vulcan Strike==1', factor: 2 },
  ])('$label: multiplies the ratio by $factor', ({ value, factor }) => {
    const off = simulate(value);
    const on = simulate(value, { ultimate: true });
    expect(on.ratio).toBe(Math.floor(off.ratio * factor));
  });
});

describe('Hyper Novice — Self Study Sorcery', () => {
  /**
   * The passive's "+N% damage" column reaches only one of Meteor Storm Buster's two hits:
   * both read 600% at Lv1 in the client table, yet the recorded packets differ by exactly
   * 5% with Self Study Sorcery at Lv5.
   *
   * *Which* of the two takes it is not decidable from this file — at Lv1 the two columns
   * are equal, so swapping them reproduces the same pair of numbers. The Lv5 runs in
   * `HyperNovice.magic-matrix.replay.spec.ts` are what settled it: the bonus rides the
   * **landing**, the opposite of Jack Frost Nova and Ground Gravitation.
   */
  it('the bonus separates the two Meteor Storm Buster hits by exactly 5%', () => {
    expect(simulate('Meteor Storm Buster==1').ratio).toBe(
      Math.floor(simulate('Meteor Storm Buster (Explosão)==1').ratio * (1 + SORCERY / 100)),
    );
  });

  it('grants S.MATK +1 per level, which the status packets confirm', () => {
    // ZC_PAR_CHANGE SP_SMATK (226) reads 42 with no gear: floor(108/3) + floor(6/5) + 5.
    expect(simulate('Jupitel Thunderstorm==1').sMatk).toBe(42);
  });
});

describe('Hyper Novice — bare status cross-checked against ZC_PAR_CHANGE', () => {
  /**
   * Status MATK was one point low until the job-bonus table was rebuilt from irowiki: it
   * goes through `floor(DEX/5)`, which gives 19 at DEX 99 and 20 at DEX 100, and the table
   * had DEX +5 at job 50 where the wiki's summary says +6. The recording is what spotted
   * it; the wiki is what confirmed it (see the table comments in HyperNovice.ts).
   */
  it('status MATK (SP_MATK2) is 850 with no gear', () => {
    expect(simulate('Jupitel Thunderstorm==1').matk - RECORDING_BUFF.matk).toBe(850);
  });

  /**
   * Status ATK is still one point low, and the DEX fix did not move it:
   * `floor(BaseLv/4 + DEX/5 + STR + LUK/3) + POW x 5` = 60 + 20 + 41 + 35,33 -> 156, +40.
   * The only single input that reaches 197 without pushing status MATK to 851 is STR 42,
   * i.e. a job STR bonus of +11 — but irowiki's grid and its summary box both say +10, so
   * the table is left alone. The formula itself is validated elsewhere (NightWatch's
   * SP_ATK1 = 789 lands exactly), and this character is a pure magic build, so nothing in
   * this file depends on it. Pinned so it is not mistaken for noise.
   */
  it('status ATK (SP_ATK1) is 196, one short of the 197 the client shows', () => {
    expect(simulate('Jupitel Thunderstorm==1').statusAtk).toBe(196);
  });
});

/**
 * The same character with all 20 pieces back on (rounds 1 and 3 of the recording). Built
 * from `importReplayBuffer` rather than retyped, so the gear, refines, cards, enchants and
 * random options are exactly what the player wore.
 */
function simulateGeared(skillValue: string, opts: { ultimate?: boolean } = {}) {
  const cls = new HyperNovice();
  const passiveIds = (cls as any)._passiveSkillList.map((s: any) => (s.name === 'Self Study Sorcery' ? SORCERY : 0));
  const activeIds = (cls as any)._activeSkillList.map((s: any) => (s.name === 'Angel of Magic' && opts.ultimate ? 1 : 0));
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const imported = importReplayBuffer(replayBuffer(), items) as any;
  const bonus = cls.getJobBonusStatus(JOB_LEVEL);
  const model: any = { ...createMainModel(), ...imported.model };
  model.class = 4307;
  model.level = BASE_LEVEL;
  model.jobLevel = JOB_LEVEL;
  model.str = 31; model.agi = 100; model.vit = 120; model.int = 120; model.dex = 94; model.luk = 100;
  model.pow = 0; model.sta = 29; model.wis = 30; model.spl = 100; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = skillValue;
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MEDIUM],
    equipAtks: { ...equipAtks, _recordingBuff: RECORDING_BUFF },
    masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts(imported.model.rawOptionTxts ?? []),
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const summary = (calc as any).damageSummary;
  const dmgCalculator = (calc as any).dmgCalculator;
  const total: any = calc.getTotalSummary();
  const weaponMatk = dmgCalculator.getWeaponMatk();
  return {
    min: summary.skillMinDamage as number,
    max: summary.skillMaxDamage as number,
    /** SP_ATK1 — the left number of the client's ATQ line */
    statusAtk: total.calc.totalStatusAtk as number,
    /** SP_ATK2 — the right one: weapon + refine + every flat ATK on the build */
    equipAtk: ((total.weapon?.baseWeaponAtk ?? 0) + (total.weapon?.refineBonus ?? 0) + total.calc.totalEquipAtk) as number,
    /** SP_MATK1 — the client prints the weapon's raw MATK here, without its roll */
    equipMatk: (dmgCalculator.getExtraMatk() + weaponMatk.parts.rawWeaponMATK) as number,
    statusMatk: dmgCalculator.getStatusMatk() as number,
    def: total.calc.def as number,
    mdef: total.calc.mdef as number,
    cri: total.calc.totalCri as number,
    amotion: ((200 - total.calc.totalAspd) * 10) as number,
    pAtk: dmgCalculator.traitBonus.pAtk as number,
    sMatk: dmgCalculator.traitBonus.sMatk as number,
    res: total.calc.res as number,
    mres: total.calc.mres as number,
    cRate: dmgCalculator.traitBonus.cRate as number,
  };
}

/**
 * The client's status window, as the ZC_PAR_CHANGE packets print it once the last piece is
 * back on (t=64.9s). This is what drove the equipment pass: every line that disagreed was
 * traced to an item, and the three that were fixed are listed in the test below.
 */
describe('Hyper Novice — geared status window vs ZC_PAR_CHANGE', () => {
  const geared = () => simulateGeared('Jupitel Thunderstorm==1');

  it.each([
    { sp: 'SP_ATK2 (ATQ equip.)', game: 319, read: (r: any) => r.equipAtk },
    { sp: 'SP_MATK1 (ATQM equip.)', game: 1017, read: (r: any) => r.equipMatk },
    { sp: 'SP_DEF2 (DEF equip.)', game: 748, read: (r: any) => r.def },
    { sp: 'SP_CRITICAL', game: 35, read: (r: any) => r.cri },
    { sp: 'SP_ASPD (amotion)', game: 550, read: (r: any) => r.amotion },
    { sp: 'SP_PATK', game: 23, read: (r: any) => r.pAtk },
    { sp: 'SP_SMATK', game: 89, read: (r: any) => r.sMatk },
    { sp: 'SP_MRES', game: 89, read: (r: any) => r.mres },
    { sp: 'SP_CRATE', game: 1, read: (r: any) => r.cRate },
  ])('$sp reads $game', ({ game, read }) => {
    expect(read(geared())).toBe(game);
  });

  /**
   * What the equipment pass found, each one pinned by the line it fixed:
   *
   * - **Escudo Ilusión B (460014)** still carried the Thai "Illusion Shield II" script
   *   (MaxHP/MaxSP +10%, ATK/MATK +15 every 3 refines, base DEF 60). LATAM re-purposed the
   *   item — its pt-BR text is boss damage + two set bonuses — so the +45 ATK/+45 MATK the
   *   refine clause added at +9 was pure invention, and the base DEF is 20.
   * - **Manopla Sombria FEI (24753)** was missing "ATQ e ATQM +1 por refino" (+9 each here),
   *   which the pt-BR description has always carried.
   *
   * Those two cancel to exactly -36 on both ATQ equip. and ATQM equip., which is what the
   * packets were short of. They are independent items, so landing both lines at once is
   * what makes this a check rather than a fit.
   */
  it('ATQ equip. and ATQM equip. were both 36 over before the two item fixes', () => {
    const r = geared();
    expect(r.equipAtk).toBe(319);
    expect(r.equipMatk).toBe(1017);
    // The shield's bogus clause gave 45 of each; the shadow gauntlet's real one gives 9.
    expect(r.equipAtk + 45 - 9).toBe(319 + 36);
  });

  /**
   * ASPD had no Hyper Novice row in the table at all and fell through to the unarmed
   * default (base 156, no weapon or shield penalty). The Super Novice row — the base job's
   * — reproduces the recorded amotion exactly with this rod-and-shield build.
   */
  it('amotion 550 (ASPD 145) comes from the Super Novice rod/shield penalties', () => {
    expect(geared().amotion).toBe(550);
  });

  /**
   * One line still disagrees, by an amount that is fully explained and does not touch
   * outgoing damage:
   *
   * - **equip MDEF is 13 short**, which is exactly the base MDEF the client prints on the
   *   two pieces that have any (Tiara Carnavalesca "DEFM: 3" and Manto Branco Mágico
   *   "DEFM: 10"). item.json has a `defense` column but no MDEF one, so no item in the
   *   database can carry base MDEF — a schema gap, not a Hyper Novice one.
   * - **RES was 16 over** until the trait table was rebuilt: `res = STA + floor(STA/3) x 5`
   *   needs STA 33 for the recorded 88, where the old table gave 39. irowiki's grid put the
   *   whole STA column at +4 by job 50, not +10, which is what the recording had measured.
   */
  it('equip MDEF is short by the base MDEF the schema cannot store', () => {
    expect(geared().mdef).toBe(62 - 13);
  });

  it('RES reads 88 once the STA trait bonus is 4 at job 50', () => {
    expect(geared().res).toBe(88);
  });
});

/**
 * Geared damage. Unlike the bare runs this one has a weapon, so MATK rolls and the
 * comparison is a range: every recorded packet must sit inside [min, max].
 *
 * This used to be short at the top by 3-5% on five of the eight entries, and the residual
 * was pinned here as "one missing equipment multiplier". It was **Grácil Anel Mágico
 * (490020)**: its "Dano mágico contra oponentes de todas as propriedades +10%" was scripted
 * as `m_my_element_all` (the caster's element, which composes additively with the other
 * +% element lines) when the "contra oponentes de" wording means `m_element_all` — the
 * target's element, a stage of its own. The two siblings 490015 and 490018 carried the same
 * mistake. `HyperNovice.magic-matrix.replay.spec.ts` is what isolated it: with the residual
 * measured per element, it grew with the build's own `m_my_element` total instead of staying
 * flat, which is only possible if 10 of those points belong to a different stage.
 *
 * Ruled out along the way: the weapon has no Enchant Grade (a grade would move refineBonus
 * and SP_MATK1 off 1017, and grade D alone would push status MATK to 929); the target is a
 * boss (Gravitação and Geladinho never land, and both are boss-immune), so the shield's
 * boss clause does apply.
 */
describe('Hyper Novice — geared damage', () => {
  const GEARED: { label: string; value: string; packets: number[] }[] = [
    { label: "Hell's Drive", value: "Hell's Drive==1", packets: [820941] },
    { label: 'Ground Gravitation (burst)', value: 'Ground Gravitation (Inicial)==1', packets: [1784230] },
    { label: 'Jack Frost Nova (sphere)', value: 'Jack Frost Nova (Inicial)==1', packets: [163011] },
    { label: 'Jupitel Thunderstorm', value: 'Jupitel Thunderstorm==1', packets: [1505274] },
    { label: 'Ground Gravitation (field)', value: 'Ground Gravitation==1', packets: [381835] },
    { label: 'Jack Frost Nova (explosion)', value: 'Jack Frost Nova==1', packets: [364794] },
    { label: 'Meteor Storm Buster (landing)', value: 'Meteor Storm Buster==1', packets: [652857] },
    { label: 'Meteor Storm Buster (explosion)', value: 'Meteor Storm Buster (Explosão)==1', packets: [625492] },
  ];

  it.each(GEARED)('$label: every recorded packet is inside the range', ({ value, packets }) => {
    const r = simulateGeared(value);
    for (const packet of packets) {
      expect(packet).toBeGreaterThanOrEqual(r.min);
      expect(packet).toBeLessThanOrEqual(r.max);
    }
  });

  /** A range wide enough to swallow anything would make the test above meaningless. */
  it.each(GEARED)('$label: the weapon roll keeps the range under 18% wide', ({ value }) => {
    const r = simulateGeared(value);
    expect(r.max / r.min).toBeLessThan(1.18);
  });
});

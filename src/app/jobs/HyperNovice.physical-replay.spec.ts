import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { HyperNovice } from 'src/app/jobs/HyperNovice';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';

/**
 * `hn-physical-matrix.rrf` — "Cafe Underground", Hyper Novice base 240 / job 50, POW 100
 * CON 59, on the training field against the Large dummy (21066). Submitted through
 * "Ajude o simulador" on 14/08/2026.
 *
 * The first community recording that follows the gear-state protocol on its own: it
 * starts with **nothing equipped**, puts the shield on alone, then the weapon, then the
 * rest piece by piece, and finally fires the ultimate — with the status window re-sent at
 * every single change. Every other recording in that batch was a buffed run against real
 * monsters and could not separate a wrong item from a wrong formula.
 *
 * It also covers a build the class had no test for: both existing Hyper Novice replay
 * specs are magic. This one is physical, through Choque Violento (Shield Chain Rush).
 *
 * Two states are worth everything here:
 *
 *  - **shield only.** With no weapon there is no ATK roll, so all nine packets print the
 *    *same* number, 341.560. That is an equation, not a range.
 *  - **full gear, with and without the ultimate.** Same gear either side, so the ratio
 *    between them is the ultimate's multiplier and nothing else.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const SHIELD_CHAIN_RUSH = 5453;
const DUMMY_LARGE = '21066';
const replay: any = decodeReplay(loadReplayFixture('hn-physical-matrix.rrf'));
const aid = replay.sessionInfo.aid;

/** Packets of Choque Violento inside a time window, ascending. */
function packets(from: number, to: number): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === SHIELD_CHAIN_RUSH && d.time >= from && d.time <= to)
    .map((d: any) => d.damage)
    .sort((a: number, b: number) => a - b);
}

/**
 * The build as it stood at `t`: every equip change up to then, replayed through the same
 * importer the app uses, so slot mapping, cards and random options are not re-implemented.
 */
function stateAt(t: number) {
  const records = (replay.equipChanges ?? [])
    .filter((e: any) => e.time <= t && e.equipped)
    .map((e: any) => ({
      itemId: e.itemId, qty: 1, equipped: e.location, refine: e.refine,
      grade: e.grade ?? 0, cards: e.cards, options: e.options ?? [],
    }));
  const synthetic = { ...replay, initialInventory: new Map(records.map((r: any, i: number) => [i, r])) };
  return replayToModel(synthetic as any, items).model as any;
}

function sim(t: number, ultimate = false, withChances = false) {
  const m = stateAt(t);
  // These are the traits the sender reported on upload — and the ones the recording
  // itself carries, since this session changed map: `replay.traits` reads back exactly
  // this, which is what replay-traits.spec.ts holds the parser to.
  Object.assign(m, { pow: 100, sta: 0, wis: 0, spl: 0, con: 59, crt: 0 });

  const cls: any = new HyperNovice();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });

  const learned: Record<number, number> = {};
  for (const [id, lv] of replay.learnedSkills) learned[id] = lv;
  const passiveIds = cls.passiveSkills.map((p: any) => {
    const sid = SKILL_ID_BY_NAME[p.name];
    return sid ? learned[sid] ?? 0 : 0;
  });
  // The physical skills are gated on Anjo do Poder, not on the magic angel.
  const activeIds = cls.activeSkills.map((p: any) => (p.name === 'Angel of Power' && ultimate ? 1 : 0));
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const value = 'Shield Chain Rush==10';
  m.selectedAtkSkill = value;
  const rawOpts: string[] = (m.rawOptionTxts ?? []).filter(Boolean);
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_LARGE],
    equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts(rawOpts),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: value,
    selectedChances: [], usedHpL: false,
  } as any);

  // Chance ("proc") bonuses are opt-in: the app prices them in with a second pass and
  // reports the result in `effectedSkill*`, leaving skillMin/MaxDamage as the proc-off
  // figure. This build has exactly one — see the Orbe Lupino block below.
  if (withChances) {
    (calc as any).setSelectedChances(calc.chanceList.map((c: any) => c.name)).recalcExtraBonus(value);
  }

  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const dmg: any = (calc as any).dmgCalculator;
  return {
    min: (withChances ? ds.effectedSkillDamageMin : ds.skillMinDamage) as number,
    max: (withChances ? ds.effectedSkillDamageMax : ds.skillMaxDamage) as number,
    chanceNames: calc.chanceList.map((c: any) => c.name) as string[],
    atkStatus: tot.calc.totalStatusAtk as number,
    equipAtk: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    pAtk: dmg.traitBonus.pAtk as number,
    def: tot.calc.def as number,
    res: tot.calc.res as number,
    amotion: ((200 - tot.calc.totalAspd) * 10) as number,
  };
}

/** Windows between equipment changes, from the recording's own timeline. */
const SHIELD_ONLY = { at: 20_000, from: 9_000, to: 23_000 };
const SHIELD_AND_WEAPON = { at: 30_000, from: 27_000, to: 45_000 };
const FULL = { at: 60_000, from: 59_000, to: 68_000 };
/** Ultimate up from 70.842 (EFST 1383); gear unchanged since 53.565. */
const FULL_ULTIMATE = { at: 60_000, from: 71_000, to: 95_000 };

describe('Hyper Novice físico — Choque Violento, gravação por estado', () => {
  it('the shield-only state really is deterministic', () => {
    // No weapon means no ATK roll: this is what makes the state an equation.
    const pk = packets(SHIELD_ONLY.from, SHIELD_ONLY.to);
    expect(pk).toHaveLength(9);
    expect(new Set(pk).size).toBe(1);
    expect(pk[0]).toBe(341_560);
  });

  it('every recorded packet lands on the Large training dummy', () => {
    const targets = new Set(
      (replay.damage ?? [])
        .filter((d: any) => d.source === aid)
        .map((d: any) => replay.entities.get(d.target)?.view),
    );
    expect([...targets]).toEqual([Number(DUMMY_LARGE)]);
  });

  /**
   * OPEN, and now small: the simulator lands 0,14% **over** the deterministic packet —
   * 342.027 against 341.560, no roll on either side, so the 467 is exact rather than noise.
   *
   * It used to be 3,0% *under*. What closed it was Crescimento Lv5: it was booked as
   * mastery ATK (after the P.ATQ multiplier) and the client's own SP_ATK2 says the server
   * counts it as equip ATK, before. See the note on Break Through in SuperNovice.ts.
   *
   * Ruled out for what is left: the skill ratio, which matches the client's table (Nv10 =
   * 3.400% plus 30 per level of Físico Autodidata); the target, a 0 DEF / 0 RES dummy; and
   * external buffs, of which this recording has none that BUFF_EFST knows.
   */
  it('pins the remaining 0,14% overshoot on the deterministic state', () => {
    const s = sim(SHIELD_ONLY.at);
    const game = 341_560;

    expect(Math.round(s.max)).toBe(342_027);
    expect(s.max / game).toBeCloseTo(1.0014, 4);
  });

  it('reads the isolated status window back exactly', () => {
    const s = sim(SHIELD_ONLY.at);
    // Straight from the ZC_PAR_CHANGE burst at t=7.686, the shield-only window.
    expect(s.def).toBe(55);
    expect(s.res).toBe(9);
    expect(s.amotion).toBe(350);
    expect(s.pAtk).toBe(59);
    // Crescimento Lv5's +100 is part of this column, as the client prints it.
    expect(s.equipAtk).toBe(150);
  });

  it('keeps the geared states within a hair of the recorded range', () => {
    const pk = packets(SHIELD_AND_WEAPON.from, SHIELD_AND_WEAPON.to);
    const s = sim(SHIELD_AND_WEAPON.at);
    expect(pk).toHaveLength(13);
    // The same sub-1% overshoot as the bare state, carried through the weapon's roll.
    expect(s.max / pk[pk.length - 1]).toBeGreaterThan(0.99);
    expect(s.max / pk[pk.length - 1]).toBeLessThan(1.02);
  });
});

/**
 * **The full-gear window is not one state.** It looked 5,9% short of the game for a long
 * while, and the reason is not a formula: at t=50.227 the character puts on
 *
 *   310609 **Orbe Lupino - Eternidade** — "Ao realizar ataques físicos: 3% de chance de
 *   ativar [Eternidade] por 10 segundos. Eternidade: VIT +50, dano físico +25%."
 *
 * a ten-second proc worn in this state and in no other. `skillMaxDamage` is the proc-**off**
 * max, so comparing it against a recorded packet that happened to land while [Eternidade]
 * was up is comparing two different things.
 *
 * What exposed it was the *shape* of the window rather than its top: regressing each
 * window's sorted packets on their order-statistic positions recovers the true range, and
 * the full-gear window is 56% wider than the calculator's — 4,9σ. A wider spread with an
 * only-3,75% higher centre cannot come from any multiplier; it takes a second random
 * source, and a proc is the only second random source there is.
 *
 * Left open, and now small: the top packet sits **0,70%** above the proc-on ceiling. The
 * sign flips against the deterministic shield-only state (0,137% *over*), so it is a
 * sub-1% composition residual that only shows up once the multipliers are large. Settling
 * it needs another weaponless state with full gear, which this recording does not have.
 */
describe('Hyper Novice físico — o proc do Orbe Lupino', () => {
  const WOLF_ORB = 'Wolf Orb (Unlimited Vital)';

  it('is the one chance bonus, and only the full-gear state carries it', () => {
    expect(sim(SHIELD_ONLY.at).chanceNames).toEqual([]);
    expect(sim(SHIELD_AND_WEAPON.at).chanceNames).toEqual([]);
    expect(sim(FULL.at).chanceNames).toEqual([WOLF_ORB]);
  });

  it('accounts for every full-gear packet once both states are on the table', () => {
    const pk = packets(FULL.from, FULL.to);
    const off = sim(FULL.at);
    const on = sim(FULL.at, false, true);
    expect(pk).toHaveLength(12);

    // The proc is worth ~5,2% at the top: atkPercent 64 -> 89.
    expect(Math.round(off.max)).toBe(4_673_950);
    expect(Math.round(on.max)).toBe(4_915_198);

    // Nothing falls below the floor, and the five lowest never needed the proc at all.
    expect(pk[0]).toBeGreaterThanOrEqual(off.min);
    expect(pk[4]).toBeLessThanOrEqual(off.max);
    // Everything else fits under the proc-on ceiling — bar the documented 0,70% on the top
    // packet, which is the whole of what is still unexplained.
    expect(pk[10]).toBeLessThanOrEqual(on.max);
    expect(pk[11] / on.max).toBeCloseTo(1.007, 3);
  });
});

/**
 * The physical ultimate, **Anjo do Poder (5461)**, which the class did not model at all
 * until this recording turned up: it had a single `Angel of Magic` toggle, and the four
 * physical skills passed no `ultimateMultiplier`, so they took the default of 1 and gained
 * nothing however the toggle was set.
 *
 * Two independent sources agree on the number, which is why it is wired rather than
 * merely pinned:
 *
 *  - the **client description** (ragassets `skills.json`) lists "Choque Violento: +50%";
 *  - this **recording** measures 1,5 exactly. The gear does not change between the two
 *    windows — the last equip change is at 53.565, the first ultimate packet at 71.927 —
 *    so their ratio is the ultimate alone, taken on the maxima, which are the
 *    deterministic end of each roll.
 *
 * The maxima line up as cleanly as they do because **both** are Orbe Lupino proc-on hits
 * (see the block above); the ultimate's two early packets land ~6 s after the last
 * proc-on hit of the full-gear window, well inside [Eternidade]'s ten seconds. Its five
 * late packets, from 78,6 s on, are proc-off — and they are the ones that pin the
 * multiplier against a state the calculator models exactly.
 */
describe('Hyper Novice físico — o supremo físico (Anjo do Poder)', () => {
  it('the recording puts the ultimate at exactly x1,5 on Choque Violento', () => {
    const withoutUlt = packets(FULL.from, FULL.to);
    const withUlt = packets(FULL_ULTIMATE.from, FULL_ULTIMATE.to);
    expect(withoutUlt).toHaveLength(12);
    expect(withUlt).toHaveLength(7);

    const ratio = withUlt[withUlt.length - 1] / withoutUlt[withoutUlt.length - 1];
    expect(ratio).toBeCloseTo(1.5, 4);
  });

  it('the simulator now moves by the same 1,5 when the ultimate goes on', () => {
    const off = sim(FULL.at, false);
    const on = sim(FULL.at, true);

    expect(on.max / off.max).toBeCloseTo(1.5, 2);
  });

  /**
   * The independent check on the multiplier. Split the ultimate window the way the proc
   * splits it and the late, proc-off packets sit just **under** the calculator's own
   * proc-off ceiling — 6.971.895 against 7.010.760, a 0,56% undershoot, which is the
   * sampling slack of five draws and nothing else. Only the two early packets need
   * [Eternidade], and they stay under the proc-on ceiling bar the same 0,70% as the
   * full-gear top packet.
   */
  it('has the proc-off ultimate packets land just under the proc-off ceiling', () => {
    const game = packets(FULL_ULTIMATE.from, FULL_ULTIMATE.to);
    const off = sim(FULL.at, true);
    const on = sim(FULL.at, true, true);

    // 71.927 and 72.763 are the two proc-on hits; the rest are 78,6 s or later.
    const late = game.filter((d) => d < 7_000_000);
    expect(late).toHaveLength(5);
    expect(late[late.length - 1]).toBe(6_971_895);
    expect(late[late.length - 1] / off.max).toBeGreaterThan(0.99);
    expect(late[late.length - 1] / off.max).toBeLessThanOrEqual(1);

    expect(game[game.length - 1] / on.max).toBeCloseTo(1.007, 3);
  });

  it('is gated on its own angel, not on the magic one', () => {
    const cls: any = new HyperNovice();
    expect(cls.activeSkills.map((a: any) => a.name)).toContain('Angel of Power');
    expect(cls.activeSkills.map((a: any) => a.name)).toContain('Angel of Magic');
  });
});

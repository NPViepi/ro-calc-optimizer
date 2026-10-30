import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { Shinkiro } from './Shinkiro';

/**
 * `shinkiro-gear-states.rrf` — "¬Oden", Shinkiro base 239 / job 50, POD 100 CRV 49, on
 * tra_fild against the training dummies, 17/08/2026. Centelha das Trevas Lv10 throughout.
 *
 * It gears up on camera, which turns one file into three builds — bare, weapon only, full
 * gear — with the status window re-sent at every change. Two of those states are exact
 * equations rather than ranges:
 *
 *  - **bare** (only the kunai in the ammo slot): no weapon, so no ATK roll. Every packet
 *    is one of two numbers, 1.070.004 and 1.690.608, in the 1,58 ratio the crit gives.
 *  - **full gear**: CRIT 149 against a dummy is a certainty, so all 22 packets print the
 *    same 29.852.436 — the crit, and nothing else.
 *
 * Read together they separate a class-formula error from an item error, and here they
 * caught one of each. Three defects fell out, all measured on this file:
 *
 *  1. **Perícia com Shuriken** (Dagger Practice, 522) was booked as a flat `x_atk: 30`.
 *     The client conditions it — "Aumenta o ATQ ao usar Shuriken e Kunai" — and Centelha
 *     das Trevas is melee. See `Kagerou.getMasteryAtk`.
 *  2. **Ammo ATK counted on melee attacks.** The Kagerou line keeps kunai equipped for its
 *     throwing skills whatever the weapon, so the Kunai Ardente's 30 ATK rode along on
 *     every hit. See `DamageCalculator.getExtraAtk`.
 *  3. **The replay importer dropped mid/low costume enchants** whose record packs `cards[]`
 *     from 0 instead of keying it to the head slot — Mortal 1 and Mortal 3 here, and with
 *     Mortal 3 gone so was Mortal 2's set bonus: 12 points of Dano Crítico, i.e. 6% after
 *     the skill-crit halving. See `resolveSlots`.
 *
 * Together they were +3,2% on the bare state and −2,8% on the full-gear one; with all
 * three fixed every crit in the file lands to the unit.
 *
 * It also settles what `Shinkiro.shadow-flash-replay.spec.ts` had to leave open. That
 * recording's character had POD 8 and STA 8, so the ratio's `+ POD × 5` term could equally
 * have been STA, CON or a constant. This one has **POD 100 allocated and STA 0**: POD × 5
 * reproduces the bare packet exactly, and STA × 5 would put it 2,7% off.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const SHADOW_FLASH = 5482;
const DUMMY_NEUTRAL = '21077';
const replay: any = decodeReplay(loadReplayFixture('shinkiro-gear-states.rrf'));
const aid = replay.sessionInfo.aid;

/**
 * Packets of Centelha das Trevas inside a time window, ascending.
 *
 * Filtering on `source` is not optional here: the recording was taken in a party, and the
 * stream carries a Hyper Novice's magic (Tempestade de Júpiter, Ira da Terra, Espectro
 * Napalm) alongside the recorder's own hits.
 */
function packets(from: number, to: number): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === SHADOW_FLASH && d.time >= from && d.time <= to)
    .map((d: any) => d.damage)
    .sort((a: number, b: number) => a - b);
}

/**
 * The build as it stood at `t`: the t=0 inventory snapshot with every equip change up to
 * then folded onto it by inventory slot, then read by the same importer the app uses — so
 * slot mapping, sockets, grades and random options are not re-implemented here.
 */
function stateAt(t: number) {
  const inv = new Map<any, any>(
    [...replay.initialInventory].map(([k, r]: any) => [k, { ...r, cards: [...(r.cards ?? [])] }]),
  );
  for (const e of replay.equipChanges ?? []) {
    if (e.time > t) break;
    const rec = inv.get(e.slot) ?? { slot: e.slot, qty: 1, options: [] };
    inv.set(e.slot, {
      ...rec,
      itemId: e.itemId,
      refine: e.refine,
      grade: e.grade,
      cards: [...(e.cards ?? [])],
      options: e.options?.length ? e.options : rec.options ?? [],
      equipped: e.equipped ? e.location : 0,
    });
  }

  return replayToModel({ ...replay, initialInventory: inv } as any, items).model as any;
}

/** Full engine run on the build worn at `t`, through the same chain the page uses. */
function sim(t: number, opts: { skill?: string; dropAmmo?: boolean } = {}) {
  const m = stateAt(t);
  if (opts.dropAmmo) m.ammo = undefined;
  // The traits the sender reported. The stream carries only three of the six (this session
  // never changed map), and a partial set is not usable — `readReplayTraits` returns null
  // and the importer writes none, which is why they are set by hand.
  Object.assign(m, { pow: 100, sta: 0, wis: 0, spl: 0, con: 0, crt: 49 });

  const cls: any = new Shinkiro();
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
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: cls.activeSkills.map(() => 0), passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const value = opts.skill ?? 'Shadow Flash==10';
  m.selectedAtkSkill = value;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_NEUTRAL],
    equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: value,
    selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const dmg: any = (calc as any).dmgCalculator;

  return {
    model: m,
    cri: Math.round(ds.skillMaxDamage as number),
    noCriMin: Math.round(ds.skillMinDamageNoCri as number),
    noCriMax: Math.round(ds.skillMaxDamageNoCri as number),
    max: Math.round(ds.skillMaxDamage as number),
    // Status-window columns, on the same terms as the recording's ZC_PAR_CHANGE.
    atkStatus: tot.calc.totalStatusAtk as number,
    equipAtk: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    pAtk: dmg.traitBonus.pAtk as number,
    sMatk: dmg.traitBonus.sMatk as number,
    cRate: dmg.traitBonus.cRate as number,
    res: tot.calc.res as number,
    mres: tot.calc.mres as number,
    def: tot.calc.def as number,
    mdef: tot.calc.mdef as number,
    cri_: tot.calc.totalCri as number,
    amotion: Math.round((200 - tot.calc.totalAspd) * 10) as number,
  };
}

/**
 * The three windows, from the recording's own equip timeline: the weapon goes on at
 * 27.127, the rest between 49.256 and 55.371, and no damage lands while it is being put on.
 */
const BARE = { at: 20_000, from: 0, to: 27_000 };
const WEAPON = { at: 30_000, from: 27_200, to: 49_000 };
const FULL = { at: 60_000, from: 56_000, to: 82_000 };

describe('Shinkiro — Centelha das Trevas, gravação por estado de equipamento', () => {
  it('imports every worn piece, including the mid/low costume enchants', () => {
    const m = sim(FULL.at).model;
    expect(m.weapon).toBe(510052); // Lâmina Malevolente
    // The three "Mortal" stones. Upper's record keys its enchant to cards[0] either way;
    // mid and low pack theirs from 0 here, which is what used to drop them.
    expect(m.costumeEnchantUpper).toBe(29359);
    expect(m.costumeEnchantMiddle).toBe(29047);
    expect(m.costumeEnchantLower).toBe(29360);
  });

  it('reads back both recorded status windows', () => {
    // Straight from the ZC_PAR_CHANGE burst at t=27.127, the weapon-only window.
    const w = sim(WEAPON.at);
    expect(w.atkStatus).toBe(807); // SP_ATK1
    expect(w.equipAtk).toBe(272); // SP_ATK2 — Lâmina Malevolente +9, 200 base + 72 refine
    expect(w.pAtk).toBe(55);
    expect(w.sMatk).toBe(19);
    expect(w.res).toBe(18);
    expect(w.mres).toBe(8);
    expect(w.cRate).toBe(18);
    expect(w.def).toBe(0);
    expect(w.mdef).toBe(0);
    expect(w.amotion).toBe(290);

    // And from t=55.371, once the last piece is on.
    const f = sim(FULL.at);
    expect(f.atkStatus).toBe(842);
    expect(f.equipAtk).toBe(957);
    expect(f.pAtk).toBe(71);
    expect(f.sMatk).toBe(19);
    expect(f.res).toBe(42);
    expect(f.mres).toBe(32);
    expect(f.cRate).toBe(28);
    expect(f.def).toBe(434);
    expect(f.mdef).toBe(5);
    expect(f.amotion).toBe(310);
  });

  it('lands the bare state on the packet, crit and non-crit', () => {
    const pk = packets(BARE.from, BARE.to);
    const s = sim(BARE.at);

    // No weapon, no roll: 20 packets, two distinct values, and their ratio is the crit.
    expect(pk).toHaveLength(20);
    expect([...new Set(pk)].sort((a, b) => a - b)).toEqual([1_070_004, 1_690_608]);
    expect(s.noCriMin).toBe(s.noCriMax);

    expect(s.cri).toBe(1_690_608);
    // The engine floors the crit to a whole number of hits but not the non-crit, so the
    // no-crit figure lands 3 damage (0,0003%) above a packet that is a multiple of 4.
    expect(s.noCriMax).toBe(1_070_007);
    expect(s.noCriMax - 1_070_004).toBeLessThanOrEqual(3);
  });

  it('brackets the weapon-only window and hits its crit exactly', () => {
    const pk = packets(WEAPON.from, WEAPON.to);
    const s = sim(WEAPON.at);
    const noCri = pk.filter((d) => d !== 3_283_628);

    expect(pk).toHaveLength(20);
    expect(s.cri).toBe(3_283_628);
    // Every non-crit packet falls inside the simulated roll…
    expect(noCri[0]).toBeGreaterThanOrEqual(s.noCriMin);
    expect(noCri[noCri.length - 1]).toBeLessThanOrEqual(s.noCriMax);
    // …and that roll is tight enough that a wrong ratio could not hide inside it.
    expect(s.noCriMax / s.noCriMin).toBeLessThan(1.12);
  });

  it('lands the full-gear crit on the packet', () => {
    const pk = packets(FULL.from, FULL.to);
    const s = sim(FULL.at);

    // CRIT 149 against a dummy: every packet is a crit, so they are all the same number.
    expect(pk).toHaveLength(22);
    expect(new Set(pk).size).toBe(1);
    expect(s.cri).toBe(29_852_436);
  });

  /**
   * The two ATK terms this recording removed are conditional, not gone: what makes them
   * conditional is that Centelha das Trevas is melee. Kunai Distorcida throws the same
   * kunai this character has in the ammo slot, so it keeps both — and the bare state, with
   * nothing but the ammo on, isolates them.
   */
  it('still gives a kunai-throwing skill its ammo ATK and Perícia com Shuriken', () => {
    const KUNAI = { skill: 'Kunai - Distortion==10' };

    // The melee skill is deaf to the ammo slot…
    expect(sim(BARE.at, { dropAmmo: true }).cri).toBe(sim(BARE.at).cri);
    // …and the thrown one is not (it cannot crit, so `skillMaxDamage` is the reading).
    expect(sim(BARE.at, KUNAI).max).toBeGreaterThan(0);
    expect(sim(BARE.at, { ...KUNAI, dropAmmo: true }).max).toBeLessThan(sim(BARE.at, KUNAI).max);
  });

  /**
   * **CLOSED on 29/08/2026** — this used to pin a 1-point overshoot (42 and 150 against the
   * recording's 41 and 149), correctly blaming the LUK leg and correctly saying one LUK value
   * could not choose between the candidate formulas. Two Sicário recordings at other LUK
   * values supplied the missing points, and the answer was that CRIT is not a whole number
   * per LUK: rAthena holds it in tenths as `piso(nívelBase / 10) + 10 + LUK × 3` and
   * truncates once, at display. At this character's LUK 128 that is `21 + 10 + 384 = 41,5`,
   * so 41 — where `piso(128 / 3)` gave 42.
   */
  it('reproduces the recorded Crítico in both gear states', () => {
    expect(sim(WEAPON.at).cri_).toBe(41); // game: 41
    expect(sim(FULL.at).cri_).toBe(149); // game: 149
  });
});

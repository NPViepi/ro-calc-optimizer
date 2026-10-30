import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SoulAscetic } from './SoulAscetic';

/**
 * `sa-exorcismo-gear-states.rrf` — "SPC das Almas", Soul Ascetic base 220 / job 38, FEI 83
 * and nothing else allocated, on tra_fild against "Dummy - Grande" (monster 21066, Formless,
 * Neutral 1, boss, MDEF 0, soft MDEF 25), 15/08/2026. Tracker card `DeZJHbAXb2`; the traits
 * come from the submission form, since a session inside one map never fires
 * `ZC_COUPLESTATUS`.
 *
 * It gears up on camera, so one file carries three builds — bare, weapon only, full gear —
 * and the status window is re-sent at every piece. Exorcizar Assombração Lv5 throughout,
 * with Brisa Leve Lv7 (Sagrado) up from t=5,6s and 20 souls refilled by Convocar Almas
 * before every cast.
 *
 * Two toggles move during the recording and both are read off the packets, not assumed:
 *
 *  - **Totem de Tutela** (5422) is a ground unit, placed at 54,1s / 95,1s / 132,9s / 163,2s
 *    and lasting ~30s. It is what the skill's "Inflige mais dano se o alvo estiver sob
 *    efeito de ... Totem de Tutela" branch keys on, and the file brackets its expiry
 *    between t=80,4s (still on) and t=85,0s (off).
 *  - **EFST 1364**, the [Mandala das Feras] state, is already running at t=0 and expires at
 *    61,2s. It carries +25 S.ATQM (the status window prints S.ATQM 62 → 37 as it drops).
 *    The calculator does not model Mandala at all, so every assertion here is taken from a
 *    window with 1364 **off**.
 *
 * What the bare window settles exactly — no weapon means no MATK roll, so the repeats of
 * each value are one number, not a range:
 *
 *  - the ratio `(150 × Lv + Maestria com Almas × 2 + FEI) × almas × NívelBase/100` is
 *    right, and so is the 250-per-level Totem branch: 560.685 → 890.905 is 1349/849 to
 *    seven significant figures, which fixes `Maestria com Almas × 2 + FEI = 99` — i.e.
 *    FEI 93 = 83 allocated + 7 from the job-38 trait table + 3 from Maestria com Almas Lv3;
 *  - the soul count is **20**: solving the three bare values for (almas, MATK) leaves
 *    exactly one physical answer, 20 souls at MATK 866.
 *
 * And what the geared windows caught: **Diadema Profano (410184) had no combo registered**.
 * Its pt-BR description pays ATQ/ATQM +50, +8% against Chefes and +10% against the Neutro
 * and Sagrado properties when a matching Anel + Colar Profano pair is worn — this character
 * wears the Safira pair. The recording proves the flat half to the unit (equipping it takes
 * SP_ATK2 from 137 to 187 and SP_MATK1 from 862 to 912) and the percentage half by damage:
 * without the element clause the recorded maximum sits above the simulated one, and with it
 * every packet falls inside. See the last test.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const FIXTURE = 'sa-exorcismo-gear-states.rrf';
/** "Dummy - Grande" — every packet the recorder produced hit this one entity. */
const TARGET = '21066';
const EXORCISM = 'Exorcism of Malicious Soul==5';
const EXORCISM_ID = 5425;
/** Convocar Almas Lv5 tops the gauge up before every cast; the bare window solves to 20. */
const SOULS = 20;
/** Brisa Leve Lv7 = Sagrado, cast at t=5,6s and refreshed twice. */
const SEVEN_WIND_HOLY = 7;

const replay: any = decodeReplay(loadReplayFixture(FIXTURE));
const aid = replay.sessionInfo.aid;

/**
 * Exorcizar Assombração packets inside a window, ascending.
 *
 * `source` is not optional: a Shadow Cross was hitting the same dummies and its
 * Impacto Brutal packets ride in the same stream.
 */
function packets(from: number, to: number): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === EXORCISM_ID && d.time >= from && d.time <= to)
    .map((d: any) => d.damage)
    .sort((a: number, b: number) => a - b);
}

/** The build worn at `t`: the t=0 snapshot with every equip change up to then folded on. */
function stateAt(t: number, db: any) {
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

  return replayToModel({ ...replay, initialInventory: inv } as any, db).model as any;
}

/** Full engine run on the build worn at `t`, through the same chain the page uses. */
function sim(t: number, opts: { totem?: boolean; fiveElements?: boolean; db?: any } = {}) {
  const db = opts.db ?? items;
  const m = stateAt(t, db);
  // Reported on the tracker card by the person who recorded it. The stream carries none:
  // `ZC_COUPLESTATUS` only arrives on a map load and this session never left tra_fild.
  Object.assign(m, { pow: 0, sta: 0, wis: 0, spl: 83, con: 0, crt: 0 });

  const cls: any = new SoulAscetic();
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
  const activeLv: Record<string, number> = {
    'Total Soul': SOULS,
    'Seven Wind': SEVEN_WIND_HOLY,
    // Cast at t=1,197 and refreshed at t=125,8s; the status window prices it at +50 ATQM.
    'Fairy Soul': 5,
    'Totem of Tutelary': opts.totem ? 1 : 0,
    'Talisman of Five Elements': opts.fiveElements ? 1 : 0,
  };
  const activeIds = cls.activeSkills.map((s: any) => activeLv[s.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  m.selectedAtkSkill = EXORCISM;
  const calc = new Calculator().setMasterItems(db).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[TARGET],
    equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: EXORCISM,
    selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const dmg: any = (calc as any).dmgCalculator;

  return {
    model: m,
    ratio: ds.baseSkillDamage as number,
    // Magic never crits, so the no-cri pair is the whole reading.
    min: Math.round(ds.skillMinDamageNoCri as number),
    max: Math.round(ds.skillMaxDamageNoCri as number),
    // Status-window columns, on the same terms as the recording's ZC_PAR_CHANGE.
    atkStatus: tot.calc.totalStatusAtk as number,
    equipAtk: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    statusMatk: tot.calc.totalStatusMatk as number,
    pAtk: dmg.traitBonus.pAtk as number,
    sMatk: dmg.traitBonus.sMatk as number,
    res: tot.calc.res as number,
    mres: tot.calc.mres as number,
    def: tot.calc.def as number,
    mdef: tot.calc.mdef as number,
    cri: tot.calc.totalCri as number,
    amotion: Math.round((200 - tot.calc.totalAspd) * 10) as number,
  };
}

/**
 * The three windows, from the recording's own equip timeline: the weapon goes on at 75,4s,
 * the other nine pieces between 109,3s and 112,0s, and no packet lands while they do.
 * Every window here is past t=61,2s, so [Mandala das Feras] is off in all of them.
 */
const BARE = { at: 65_000, from: 62_000, to: 74_000 };
const WEAPON = { at: 90_000, from: 76_000, to: 109_000 };
const FULL = { at: 134_000, from: 133_000, to: 153_000 };

describe('Soul Ascetic — Exorcizar Assombração, recording by equipment state', () => {
  it('imports every worn piece', () => {
    const m = sim(FULL.at).model;
    expect(m.weapon).toBe(550015); // Pêndulo Primordial +9
    expect(m.weaponRefine).toBe(9);
    expect(m.armor).toBe(450178); // Veste do Lobo Cinzento +7
    expect(m.shield).toBe(460014); // Escudo Ilusión B +4
    expect(m.headUpper).toBe(401206); // Tiara Carnavalesca
    expect(m.headMiddle).toBe(410184); // Diadema Profano
    expect(m.accRight).toBe(490052); // Anel Profano Safira
    expect(m.accLeft).toBe(490053); // Colar Profano Safira
  });

  it('reads back both recorded status windows', () => {
    // From the ZC_PAR_CHANGE burst at t=75.426, the weapon-only window.
    const w = sim(WEAPON.at);
    expect(w.atkStatus).toBe(154); // SP_ATK1
    expect(w.equipAtk).toBe(137); // SP_ATK2
    expect(w.statusMatk).toBe(813); // SP_MATK2
    expect(w.pAtk).toBe(0);
    expect(w.sMatk).toBe(37);
    expect(w.res).toBe(8);
    expect(w.mres).toBe(8);
    expect(w.def).toBe(0);
    expect(w.mdef).toBe(0);
    expect(w.cri).toBe(27);
    expect(w.amotion).toBe(270);

    // And from t=111.953, once the last piece is on.
    const f = sim(FULL.at);
    expect(f.atkStatus).toBe(155);
    // 137 + 50: the Diadema Profano combo, and the reason it is registered at all.
    expect(f.equipAtk).toBe(187);
    expect(f.statusMatk).toBe(816);
    expect(f.pAtk).toBe(0);
    expect(f.sMatk).toBe(37);
    expect(f.res).toBe(8);
    expect(f.mres).toBe(8);
    expect(f.def).toBe(739);
    expect(f.cri).toBe(27);
    expect(f.amotion).toBe(300);
  });

  it('gets the Totem de Tutela branch and the soul count right on the bare window', () => {
    const pk = packets(BARE.from, BARE.to);
    const s = sim(BARE.at, { totem: true });

    // No weapon, no MATK roll: three casts, one number.
    expect(pk).toEqual([753_200, 753_200, 753_200]);
    expect(s.min).toBe(s.max);
    // (250 × 5 + 3 × 2 + 93) × 20 almas × 220/100.
    expect(s.ratio).toBe(59_356);

    // This window is what priced the two MATK corrections that came with it, both of them
    // measured right here:
    //  - **Espírito da Fada Lv5** was commented out in `SoulReaper.ts`. The recording casts
    //    it at t=1.197 with nothing but shadow gear on and SP_MATK1 goes 4 → 54.
    //  - **`Total Soul` booked an `x_matk` of 3 per soul**, i.e. +60 at twenty souls. The
    //    equipment MATK never moves as the gauge fills, and solving these three packets
    //    gives MATK 866 — the status window's own 813 + 54, with no room for another 60.
    //
    // OPEN, and all that is left: one MATK point. The simulator totals 867 where the server
    // used 866, so it lands 0,08% high. SP_MATK2 813 and SP_MATK1 54 are what the client
    // prints and their sum is 867, so the server's own total is one below what it displays;
    // separating a display rounding from an off-by-one in the status-MATK curve needs a
    // second bare recording at a different INT.
    expect(s.max).toBe(753_795);
    expect(s.max / pk[0]).toBeLessThan(1.001);
  });

  it('brackets the weapon-only window, with and without the totem', () => {
    // Totem placed at 54,1s and expired between 80,4s and 85,0s, then re-placed at 95,1s.
    const withTotem = [1_328_955, 1_468_440, 1_480_310, 1_481_500];
    const noTotem = [969_735, 991_775];
    expect(packets(WEAPON.from, WEAPON.to)).toEqual([...noTotem, ...withTotem].sort((a, b) => a - b));

    const on = sim(WEAPON.at, { totem: true });
    expect(withTotem[0]).toBeGreaterThanOrEqual(on.min);
    expect(withTotem[withTotem.length - 1]).toBeLessThanOrEqual(on.max);

    const off = sim(WEAPON.at);
    expect(noTotem[0]).toBeGreaterThanOrEqual(off.min);
    expect(noTotem[noTotem.length - 1]).toBeLessThanOrEqual(off.max);
    // The two branches are 1349/849 apart and the roll is nowhere near that wide, so the
    // six packets separate into the two groups on their own.
    expect(on.min).toBeGreaterThan(off.max);
  });

  it('brackets the full-gear window', () => {
    // Talismã dos Elementos Lv1 goes up at t=128,6s and is still running here.
    const pk = packets(FULL.from, FULL.to);
    const s = sim(FULL.at, { totem: true, fiveElements: true });

    expect(pk).toHaveLength(10);
    expect(pk[0]).toBeGreaterThanOrEqual(s.min);
    expect(pk[pk.length - 1]).toBeLessThanOrEqual(s.max);
    // Wider than the 1,12 a formula check wants — the Pêndulo Primordial's MATK variance is
    // ±101 on a 253 weapon MATK — which is why the bare window above carries the ratio and
    // this one only has to contain the packets.
    expect(s.max / s.min).toBeLessThan(1.17);
  });

  /**
   * The Diadema Profano combo, isolated: strip it back to the bare "+2% físico e mágico"
   * the record used to carry and the recorded maximum no longer fits under the simulated
   * one. The flat half is already pinned by SP_ATK2 above; this is what pins the two
   * percentage clauses, since a status window cannot show them.
   */
  it('needs the Diadema Profano combo to contain the full-gear packets', () => {
    const stripped = { ...items, 410184: { ...items[410184], script: { atkPercent: ['2'], matkPercent: ['2'] } } };
    const s = sim(FULL.at, { totem: true, fiveElements: true, db: stripped });

    expect(s.equipAtk).toBe(137);
    expect(Math.max(...packets(FULL.from, FULL.to))).toBeGreaterThan(s.max);
  });
});

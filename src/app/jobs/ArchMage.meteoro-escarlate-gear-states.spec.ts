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

/**
 * `mg-meteoro-escarlate-gear-states.rrf` — "Diabaum", Magus base 201 / job 13 on tra_fild,
 * 22/08/2026. Tracker card rL9VbPv3gG, submitted anonymously. Traits read off the file:
 * FEI 10, the rest 0.
 *
 * The magic counterpart of the Sicário gear-states file: the character starts **with
 * nothing equipped**, fires Meteoro Escarlate Lv5, puts a +13 Báculo de Apoio Místico on,
 * fires again, then the other sixteen pieces one by one, then Maestria Arcana and
 * Amplificação de Magia Lv10, then walks to the Poison and Wind Lv1 dummies:
 *
 *     W0  13–18 s  bare-handed                 26.222 ×4         (deterministic)
 *     W1  33–38 s  the staff alone             127.694..146.748
 *     W2  53–57 s  the whole build             273.315..345.219
 *     W3  63–68 s  + Maestria Arcana + Amp.    439.446..473.802
 *     W4 112–117 s  the same on Poison Lv1      653.646..698.369  (Fire: ×1,5)
 *     W5 119–121 s  the same on Wind Lv1        436.499..466.928  (Fire: ×1,0)
 *
 * What the file settled:
 *
 *  - **The magic chain reproduces the bare-handed packet to the unit**: 26.222 recorded,
 *    26.222 simulated, with status MATK 340 in the window and in the engine. Meteoro
 *    Escarlate is 3.700% at Lv5 as one packet displayed as 7 hits, over 2,01 (base 201),
 *    the S.ATQM stage and the flat soft MDEF — all exact.
 *  - **Colar de Ampulheta was an empty script.** "Todos os talentos +6, a cada 5 níveis de
 *    classe até o 30: −1" — ZC_COUPLESTATUS at 45,1 s reads every trait `plus` 4 at job
 *    13, S.ATQM goes 10 → 12 and status MATK 340 → 362 in the window. With the record
 *    filled the engine reproduces both numbers and every geared window brackets; before it
 *    the recorded ceiling sat 2,4% above the simulated one. That needed a job-level
 *    ranged form in the item-script grammar (`jobLevel:5(1-30)----1`).
 *  - The +13 staff's over-refine MATK roll is what keeps the damage spread open even
 *    under Maestria Arcana: W3–W5 still vary ±4% in the recording, inside the engine's
 *    min..max.
 *
 * The other two Magus cards on the board are the same skill family on one dummy each and
 * come along as corroboration (`mg-espiritos-ancestrais-241.rrf`, card c2cRfoUtQ4, credit
 * Sunrise; `mg-espiritos-ancestrais-243.rrf`, card ENKtgfdH43, credit Listat): Espíritos
 * Ancestrais Lv5 is 900% per spirit, seven spirits, and both files land inside the
 * simulated range with their typed traits.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const METEORO_ESCARLATE = 2211;
const ESPIRITOS_ANCESTRAIS = 5220;
const NEUTRAL_LV1 = '21077';
const POISON_LV1 = '21082';
const WIND_LV1 = '21081';

const replay: any = decodeReplay(loadReplayFixture('mg-meteoro-escarlate-gear-states.rrf'));
const aid = replay.sessionInfo.aid;

/** The build worn at `t`: the t=0 snapshot with every equip change up to then folded on. */
function stateAt(r: any, t: number) {
  const inv = new Map<any, any>([...r.initialInventory].map(([k, rec]: any) => [k, { ...rec, cards: [...(rec.cards ?? [])] }]));
  for (const e of r.equipChanges ?? []) {
    if (e.time > t) break;
    const rec = inv.get(e.slot) ?? { slot: e.slot, qty: 1, options: [] };
    inv.set(e.slot, {
      ...rec, itemId: e.itemId, refine: e.refine, grade: e.grade, cards: [...(e.cards ?? [])],
      options: e.options?.length ? e.options : rec.options ?? [], equipped: e.equipped ? e.location : 0,
    });
  }
  return replayToModel({ ...r, initialInventory: inv } as any, items).model as any;
}

function run(r: any, m: any, opts: { monster: string; skill: string; actives?: Record<string, number>; traits?: Record<string, number> }) {
  const cls: any = new ArchMage();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  }, opts.traits ?? {});
  const learned: Record<number, number> = {};
  for (const [id, lv] of r.learnedSkills) learned[id] = lv;
  const passiveIds = cls.passiveSkills.map((p: any) => {
    const sid = SKILL_ID_BY_NAME[p.name];
    return sid ? learned[sid] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((a: any) => opts.actives?.[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();
  m.selectedAtkSkill = opts.skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[opts.monster], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {}, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: opts.skill, selectedChances: [], usedHpL: false,
  } as any);
  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const st: any = (calc as any).dmgCalculator.status;
  return {
    statusMatk: tot.calc.totalStatusMatk as number,
    sMatk: ds.sMatk as number,
    traits: { pow: st.totalPow, sta: st.totalSta, wis: st.totalWis, spl: st.totalSpl, con: st.totalCon, crt: st.totalCrt },
    min: ds.skillMinDamage as number,
    max: ds.skillMaxDamage as number,
    hits: ds.skillTotalHit as number,
    propertyMultiplier: ds.skillPropertyMultiplier as number,
  };
}

const BUFFED = { 'Recognized Spell': 1, 'Mystical Amplification': 10 }; // EFST 355 at 60,8 s, 113 at 62,3 s

type Window = { from: number; to: number; monster: string; actives: Record<string, number>; n: number };
const WINDOWS: Record<string, Window> = {
  W0: { from: 13_000, to: 18_000, monster: NEUTRAL_LV1, actives: {}, n: 4 },
  W1: { from: 33_000, to: 38_000, monster: NEUTRAL_LV1, actives: {}, n: 6 },
  W2: { from: 53_000, to: 57_000, monster: NEUTRAL_LV1, actives: {}, n: 5 },
  W3: { from: 63_000, to: 68_000, monster: NEUTRAL_LV1, actives: BUFFED, n: 6 },
  W4: { from: 112_000, to: 117_000, monster: POISON_LV1, actives: BUFFED, n: 6 },
  W5: { from: 119_000, to: 121_000, monster: WIND_LV1, actives: BUFFED, n: 3 },
};

function packets(r: any, who: number, skillId: number, from = 0, to = 999_999): number[] {
  return (r.damage ?? [])
    .filter((d: any) => d.source === who && d.skillId === skillId && d.time >= from && d.time < to)
    .map((d: any) => d.damage as number);
}

function windowAt(r: any, sp: number, t: number): number {
  const seen = (r.paramChanges ?? []).filter((p: any) => p.type === sp && p.time < t);
  return Number(seen[seen.length - 1].value);
}

const simWindow = (w: Window) => run(replay, stateAt(replay, w.from), { monster: w.monster, skill: 'Crimson Rock==5', actives: w.actives });

describe('Magus — Meteoro Escarlate from bare hands to full gear (rL9VbPv3gG)', () => {
  it('starts with nothing on and dresses on camera', () => {
    const { summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(0);
    expect(summary.traits).toEqual({ pow: 0, sta: 0, wis: 0, spl: 10, con: 0, crt: 0 });
    expect(replay.equipChanges).toHaveLength(17);
    expect(stateAt(replay, WINDOWS.W0.from).weapon).toBeUndefined();
    expect([stateAt(replay, WINDOWS.W1.from).weapon, stateAt(replay, WINDOWS.W1.from).weaponRefine]).toEqual([640009, 13]);
  });

  it('reproduces the bare-handed packet to the unit', () => {
    const r = simWindow(WINDOWS.W0);
    expect(packets(replay, aid, METEORO_ESCARLATE, WINDOWS.W0.from, WINDOWS.W0.to)).toEqual([26_222, 26_222, 26_222, 26_222]);
    expect([r.min, r.max]).toEqual([26_222, 26_222]);
    expect(r.hits).toBe(1); // 3.700% in one packet, displayed as 7 hits
    expect(r.statusMatk).toBe(windowAt(replay, 44, 26_000)); // 340
  });

  it('reproduces status MATK and S.ATQM with the whole build on, Colar de Ampulheta included', () => {
    const r = simWindow(WINDOWS.W2);
    expect(r.statusMatk).toBe(windowAt(replay, 44, WINDOWS.W2.from)); // 362
    expect(r.sMatk).toBe(windowAt(replay, 226, WINDOWS.W2.from)); // 12
    // ZC_COUPLESTATUS at 45,1 s: every trait `plus` 4 at job 13 (+6, −1 per 5 job levels).
    const couple: Record<number, number> = {};
    for (const c of replay.coupleStatus) if (c.statusId >= 219 && c.statusId <= 224) couple[c.statusId] = c.base + c.plus;
    expect([couple[219], couple[220], couple[221], couple[222], couple[223], couple[224]]).toEqual([r.traits.pow, r.traits.sta, r.traits.wis, r.traits.spl, r.traits.con, r.traits.crt]);
    expect(items[490087].script).toEqual({ allTrait: ['6', 'jobLevel:5(1-30)----1'] });
  });

  it.each(Object.entries(WINDOWS).filter(([k]) => k !== 'W0').map(([key, w]) => ({ key, w })))('brackets every packet of $key', ({ key, w }) => {
    const r = simWindow(w);
    const rec = packets(replay, aid, METEORO_ESCARLATE, w.from, w.to);
    expect(rec).toHaveLength(w.n);
    expect(r.propertyMultiplier).toBe(key === 'W4' ? 1.5 : 1);
    for (const p of rec) {
      expect(p, key).toBeGreaterThanOrEqual(r.min);
      expect(p, key).toBeLessThanOrEqual(r.max);
    }
  });
});

describe('Magus — Espíritos Ancestrais Lv5, two single-dummy files (c2cRfoUtQ4, ENKtgfdH43)', () => {
  it.each([
    // Sunrïse 241/50, typed FEI 100 SAB 36 CON 26, Maestria Arcana + Amp. Lv10 up (EFST 355, 113), Dummy - Médio.
    { fixture: 'mg-espiritos-ancestrais-241.rrf', monster: '21065', traits: { spl: 100, wis: 36, con: 26 }, actives: BUFFED, n: 3 },
    // Laste 243/50, typed FEI 100 CON 65, no offensive buff, Dummy - Pequeno.
    { fixture: 'mg-espiritos-ancestrais-243.rrf', monster: '21064', traits: { spl: 100, con: 65 }, actives: {}, n: 2 },
  ])('$fixture: seven spirits of 900% each, inside the simulated range', ({ fixture, monster, traits, actives, n }) => {
    const r: any = decodeReplay(loadReplayFixture(fixture));
    const res = run(r, replayToModel(r, items).model, { monster, skill: 'Soul Vulcan Strike==5', actives, traits });
    expect(res.hits).toBe(7);
    const rec = packets(r, r.sessionInfo.aid, ESPIRITOS_ANCESTRAIS);
    expect(rec).toHaveLength(n);
    for (const p of rec) {
      expect(p).toBeGreaterThanOrEqual(res.min * 7);
      expect(p).toBeLessThanOrEqual(res.max * 7);
    }
  });
});

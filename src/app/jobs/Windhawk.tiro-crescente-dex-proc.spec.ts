import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { JobBuffs } from 'src/app/constants/job-buffs';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { Windhawk } from './Windhawk';

/**
 * Two recordings of the same Falcão do Vento, "Asmitta_" (base 243 / job 50), firing
 * nothing but Tiro Crescente Lv10 under Ilimitar 5 and Ventos Sinistros:
 *
 *   `wh-tiro-crescente-dex-proc-b104.rrf` — 01/09/2026, card XBDYvMBxUb: Gakkung
 *      Primordial-LT +12 [A] with Cavaleiro do Abismo + Freeoni Espacial, Flecha Sombria,
 *      183 packets on the Dummy - Sagrado.
 *   `wh-tiro-crescente-dex-proc-b090.rrf` — 27/08/2026, card dRWnxnEUAc: the same bow at
 *      Grade B with two Andarilho Poluto, Flecha de Prata, 143 packets on the Humanoide.
 *
 * Every packet is a critical (DES 130 and CRIT 209 / 116: the crit is deterministic, 99
 * packets print the same integer), and the status window alternates on a fixed rhythm —
 * DES `plus` 61 ↔ 286, status ATQ 945 ↔ 1170, Precisão 912 ↔ 1137 — which is the Bota
 * Desconhecida DES +13 [C] proc, "DES +175, +25 por grau D e C" = +225. The engine
 * registers it as the chance "Unknown Dexterity Boots [1]"; the on-proc packets read off
 * the `effected*` fields with it selected.
 *
 * What the two files settle, by exact ratio:
 *
 *  - **The stack ramp is 1,0 / 1,1 / 1,2 / 1,3** — the first cast is stack 0, and the
 *    three after it print 1,0999×, 1,1997× and 1,2996× of it in both files.
 *  - **The DES proc is worth what DES +225 is worth**: ×1,1598 recorded, ×1,1607
 *    simulated (b104); ×1,1852 recorded, ×1,1860 simulated (b090).
 *  - **Visão Real Lv10 is worth its +5 stats, +30 Precisão and +10 CRIT and nothing
 *    more on this skill**: the packets fall 0,44% when it expires at 32,5 s, the size of
 *    the stat loss. The engine's toggle is `Falcon Eyes`; with it on, Crítico reproduces
 *    the window exactly (211 / 116) and ATQ Equip. does too (1.337 / 1.104).
 *
 * Still open — the absolute level:
 *
 *  - Both cards' typed traits are impossible at base 243 (168 trait points: POD 99 +
 *    STA 97 is 196, POD 100 + CON 70 is 170), and Tiro Crescente scales on CON × 10, so
 *    the build's CON is unknown; the window carries no P.ATQ. Simulated at POD 100 /
 *    CON 68, the budget's edge, the engine sits 2,8% under the newer file and 2,2% over
 *    the older one — the same character, the same skill, opposite signs. No equipped
 *    item's text is missing from its script (grades included); the two builds differ in
 *    cards (boss +25% and CRIT +100 vs size +60%), arrow property and random options. A
 *    recording of this character with the traits typed after a fresh trait reset, or one
 *    that reaches a map change so ZC_COUPLESTATUS carries them, would close it.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const TIRO_CRESCENTE = 5334;
const DEX_PROC = 'Unknown Dexterity Boots [1]';
const TRAITS = { pow: 100, sta: 0, wis: 0, spl: 0, con: 68, crt: 0 };
const ACTIVES: Record<string, number> = { 'No Limits': 5, 'Calamity Gale': 1, 'Improve Concentration': 10, 'Falcon Eyes': 10, 'Wind Walk': 5 };
const CONSUMABLES = [12883, 14766, 23475, 100232, 102803]; // Bolinho, Ilimitada, Infinita, Energético Físico, Estimulante
/** With CON unknown the level is held to ±3,5%; the structure below is held exactly. */
const LEVEL_TOLERANCE = 0.035;

/**
 * Per file: where the DES proc is up (status ATQ jumps +225), where Visão Real is up
 * (EFST 115 / status ATQ −7 when it drops), and the ZC_PAR_CHANGE values to reproduce.
 */
type File = { fixture: string; monster: string; procOn: [number, number][]; trueSightOn: [number, number][]; window: { atkEquip: number; cri: number; atkOff: number; atkOn: number } };
const FILES: Record<string, File> = {
  b104: {
    fixture: 'wh-tiro-crescente-dex-proc-b104.rrf', monster: '21083',
    procOn: [[7_899, 17_910], [22_833, 32_581]], trueSightOn: [[0, 32_581]],
    window: { atkEquip: 1337, cri: 211, atkOff: 945, atkOn: 1170 },
  },
  b090: {
    fixture: 'wh-tiro-crescente-dex-proc-b090.rrf', monster: '21070',
    procOn: [[3_415, 13_426], [23_029, 33_038]], trueSightOn: [[0, 8_033], [17_484, 999_999]], // recast at 17,5 s
    window: { atkEquip: 1104, cri: 116, atkOff: 930, atkOn: 1155 },
  },
};
const inAny = (ranges: [number, number][], t: number) => ranges.some(([a, b]) => t >= a && t < b);

const decoded = new Map<string, any>();
const replayOf = (key: string) => {
  if (!decoded.has(key)) decoded.set(key, decodeReplay(loadReplayFixture(FILES[key].fixture)));
  return decoded.get(key);
};

function sim(key: string, proc: boolean) {
  const replay = replayOf(key);
  const m: any = replayToModel(replay, items).model;
  const cls: any = new Windhawk();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  }, TRAITS);
  const learned: Record<number, number> = {};
  for (const [id, lv] of replay.learnedSkills) learned[id] = lv;
  const passiveIds = cls.passiveSkills.map((p: any) => {
    const sid = SKILL_ID_BY_NAME[p.name];
    return sid ? learned[sid] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((a: any) => ACTIVES[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();
  const buffEquips: Record<string, any> = {};
  const agi = JobBuffs.find((d) => d.name === 'Cantocandidus')!;
  buffEquips[agi.name] = agi.dropdown.find((d: any) => d.value === 10).bonus; // EFST 12
  const skill = 'Crescive Bolt==10';
  m.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[FILES[key].monster], equipAtks, masteryAtks, buffEquips, buffMasterys: {},
    consumeData: CONSUMABLES.map((id) => items[id].script), aspdPotion: m.aspdPotion,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: proc ? [DEX_PROC] : [], usedHpL: false,
  } as any);
  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const st: any = (calc as any).dmgCalculator.status;
  return {
    chances: ((calc as any)._chanceList ?? []).map((c: any) => c.name) as string[],
    atkEquip: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    atkStatus: tot.calc.totalStatusAtk as number,
    cri: tot.calc.totalCri as number,
    dex: st.totalDex as number,
    crit: (proc ? ds.effectedSkillDamageMax : ds.skillMaxDamage) as number,
    critNoStack: ds.noStackMaxCriDamage as number,
    canCri: ds.skillCanCri as boolean,
    hits: ds.skillTotalHit as number,
  };
}

function packets(key: string): { time: number; damage: number }[] {
  const r = replayOf(key);
  return (r.damage ?? []).filter((d: any) => d.source === r.sessionInfo.aid && d.skillId === TIRO_CRESCENTE).map((d: any) => ({ time: d.time as number, damage: d.damage as number }));
}

const procOn = (key: string, t: number) => inAny(FILES[key].procOn, t);
const trueSightOn = (key: string, t: number) => inAny(FILES[key].trueSightOn, t);

/** The commonest packet value in a window — the deterministic critical of that state. */
function mode(values: number[]): [number, number] {
  const m = new Map<number, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1])[0];
}

describe.each(Object.keys(FILES))('Falcão do Vento — Tiro Crescente under the DES proc, file %s', (key) => {
  it('imports the bow with its grade and offers the boot proc as a chance', () => {
    const { model, summary }: any = replayToModel(replayOf(key), items);
    expect(summary.equippedCount).toBe(20);
    expect([model.weapon, model.weaponRefine, model.weaponGrade]).toEqual([700046, 12, key === 'b104' ? 'A' : 'B']);
    expect([model.boot, model.bootRefine, model.bootGrade]).toEqual([470072, 13, 'C']);
    expect(sim(key, false).chances).toContain(DEX_PROC);
  });

  it('reproduces ATQ Equip. and Crítico, and the DES +225 of the proc', () => {
    const off = sim(key, false);
    const on = sim(key, true);
    const w = FILES[key].window;
    expect(off.atkEquip).toBe(w.atkEquip);
    expect(off.cri).toBe(w.cri);
    expect(on.dex - off.dex).toBe(225);
    // Status ATQ (DES-scaled) reads 5 under the window in both states.
    expect(w.atkOff - off.atkStatus).toBe(5);
    expect(w.atkOn - on.atkStatus).toBe(5);
  });

  it('every packet is a critical and the first cast is stack 0', () => {
    const r = sim(key, false);
    expect(r.canCri).toBe(true);
    expect(r.hits).toBe(1);
    const [p0, p1, p2, p3] = packets(key).map((p) => p.damage);
    expect(p1 / p0).toBeCloseTo(1.1, 2);
    expect(p2 / p0).toBeCloseTo(1.2, 2);
    expect(p3 / p0).toBeCloseTo(1.3, 2);
    expect(r.crit / r.critNoStack).toBeCloseTo(1.3, 2);
  });

  it('prices the proc: the on/off ratio of the plateaus matches DES +225', () => {
    const on = mode(packets(key).filter((p) => procOn(key, p.time) && trueSightOn(key, p.time)).map((p) => p.damage))[0];
    const off = mode(packets(key).filter((p) => !procOn(key, p.time) && trueSightOn(key, p.time)).map((p) => p.damage))[0];
    expect(on / off).toBeCloseTo(sim(key, true).crit / sim(key, false).crit, 2);
  });

  it('holds the plateaus to ±3,5% with CON unknown', () => {
    for (const proc of [false, true]) {
      const [plateau, count] = mode(packets(key).filter((p) => procOn(key, p.time) === proc && trueSightOn(key, p.time)).map((p) => p.damage));
      expect(count).toBeGreaterThan(10);
      const eng = sim(key, proc).crit;
      expect(Math.abs(plateau / eng - 1)).toBeLessThan(LEVEL_TOLERANCE);
    }
  });
});

describe('Falcão do Vento — Visão Real expiring is worth its stats only (b104)', () => {
  it('the on-proc plateau falls 0,44% when EFST 115 goes off at 32,5 s', () => {
    const before = mode(packets('b104').filter((p) => procOn('b104', p.time) && p.time < 32_581).map((p) => p.damage));
    const after = mode(packets('b104').filter((p) => p.time >= 32_581 && p.time < 32_849).map((p) => p.damage));
    expect(before).toEqual([103_871_652, 99]);
    expect(after[0]).toBe(103_412_052);
    expect(after[0] / before[0]).toBeCloseTo(0.9956, 3);
  });
});

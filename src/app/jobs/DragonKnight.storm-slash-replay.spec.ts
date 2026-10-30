import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { ElementType } from 'src/app/constants/element-type.const';
import { JobBuffs } from 'src/app/constants/job-buffs';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { DragonKnight } from './DragonKnight';

/**
 * `dk-storm-slash-buffed.rrf` — "NullCaster", Cavaleiro Draconiano base 244 / job 50 on
 * tra_fild, 125 Dilacerar Lv5 casts on the Dummy - Fogo (Fire Lv1), 25/08/2026. Tracker
 * card GvfWS5eND5, submitted anonymously. Traits read off the recording: POD 100, CRV 71.
 *
 * The first Dragon Knight recording the repo holds, and a contaminated one: the character
 * carries 45 buffs (three foods, Bolinho Divino, Poção Ilimitada, Poção Infinita, Estimulante,
 * Elixir Rubro, Energético Físico, Bênção de Tyr, Força Titânica, Aura de Combate, Luz da
 * Alma, Dedicação, Lâmina de Aura, Encantar Lâmina, Rapidez com Duas Mãos, a Cardinal's
 * whole kit and a Water converter), and the dummy is public — from 432 s on, other players
 * park Lex Aeterna (EFST 22, 92 times), Garra Sombria (730), Quake (1402) and Vício Mágico
 * (1142) on it, which is why the same buff state prints packets at 1×, 2×, 3× and 6× of
 * each other. Only the two windows below are free of target-side debuffs, and they are
 * what the engine is held to.
 *
 * What the file settled:
 *
 *  - **The status window reconciles to the unit** in both states once every buff the
 *    engine models is switched on: Precisão, Crítico, P.ATQ, C.Rate, ATQ and all twelve
 *    stat/trait columns of ZC_COUPLESTATUS. The one exception is Bênção de Tyr's "ATQ +20",
 *    which appears in neither ATQ column while its Precisão +30 does; it is left out of the
 *    simulated ATQ and flagged below.
 *  - **Aura de Combate is ATQ Equip.** ATQ Equip. reads the build's own equipment plus
 *    exactly the rune's 70; the engine had it as a hidden mastery, after the P.ATQ
 *    multiplier, worth ~3% less on this build.
 *  - **An endow reaches the status ATK.** With the Water converter on the Fire Lv1 dummy
 *    the engine sat 13% under both plateaus with a Neutral status ATK, and within 1% with
 *    the status ATK Water-scaled like the weapon — the same figure in a state with no
 *    Cardinal buffs and in one with all of them, which is what makes it a stage and not a
 *    flat term. rAthena keeps status ATK Neutral for everything but Ventania; this file
 *    says otherwise, so `calcTotalAtk` now scales it whenever the attack's property is the
 *    endow the character carries (never for a weapon's own element).
 *  - **Dilacerar under Força Titânica.** The client promises "15% de chance de infligir o
 *    dobro de dano"; the file has 14 of 62 packets in the second window at exactly
 *    1,92436× the plateau (the ratio is exact — both values repeat), not 2×. Lex Aeterna's
 *    doubling, seen later on the same dummy, is exactly 2×. The proc is not modelled and
 *    the ratio is pinned as an observation.
 *
 * Still open, in order of size:
 *
 *  - A third plateau (225–255 s, 8 identical packets at 70.549.505) sits 4,6% above the
 *    48-packet plateau of the second window with an identical buff list and an identical
 *    window. Nothing in the file explains it; with DES 5 a crit may still roll (see
 *    GuillotineCross.cross-impact-gear-states.spec.ts), but a roll does not repeat eight
 *    times. The engine lands between the two.
 *  - The engine is 0,3–0,9% over the plateaus it is held to. Tyr's ATQ +20, if it applies
 *    in battle without showing in the window, is worth exactly that.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_FIRE_LV1 = '21080';
const STORM_SLASH = 5213;
const STORM_SLASH_SKILL = 'Storm Slash==5';
const EFST_LEX_AETERNA = 22;

const replay: any = decodeReplay(loadReplayFixture('dk-storm-slash-buffed.rrf'));
const aid = replay.sessionInfo.aid;
const dummy = 4396;

/** Bênção de Tyr (14601) without its ATQ +20 — see the header. Precisão and Esquiva stay. */
const TYR_WITHOUT_ATK = { hit: ['30'], flee: ['30'] };

/** Every consumable the recorder has up in both windows, by id — item.json scripts. */
const CONSUMABLES = [
  12796, // Elixir Rubro: ATQ +30 (the window sees it come on: ATQ Equip. 1174 -> 1204)
  12883, // Bolinho Divino: all stats +10, ATQ +30 (it is what EFST 271-276 are)
  14766, // Poção Ilimitada: ATQ +30, dano físico +1%
  23475, // Poção Infinita: dano crítico +5%
  102803, // Estimulante: talentos +5, P.ATQ +10
  12429, 12431, 12434, // Churrasco (FOR), Carne ao Vinho (VIT), Macarrão (SOR): +20 each
  100232, // Energético Físico (EFST 1170): dano corpo a corpo +15%
];

/** The class's own toggles up in both windows. Runes are the RuneKnight toggles by rune name. */
const CLASS_TOGGLES = {
  'Two hand Quicken': 10, // EFST 2
  'Aura Blade': 5, // EFST 103
  'Spear Dynamo': 5, // Dedicação, EFST 105
  'Asir Runestone': 1, // Aura de Combate, EFST 322: ATQ +70
  'Lux Anima Runestone': 2, // Luz da Alma, EFST 1154
  'Turisus Runestone': 1, // Força Titânica, EFST 319: FOR +30, corpo a corpo +15%
};

/** 172–193 s: 14 packets, before the Cardinal arrives. */
const STATE_1 = { actives: CLASS_TOGGLES, buffs: {} as Record<string, number>, from: 172_000, to: 193_000 };

/** 296–326 s: 62 packets, the Cardinal's kit on top (Bênção/Aumentar Agilidade at job 70). */
const STATE_3 = {
  actives: { ...CLASS_TOGGLES, 'Enchant Blade': 10 },
  buffs: { Clementia: 17, Cantocandidus: 17, 'Impositio Manus': 5, Religio: 5, Benedictum: 5, 'Argutus Vita': 5, 'Argutus Telum': 5, 'Presens Acies': 5 } as Record<string, number>,
  from: 296_000,
  to: 326_000,
};

function sim(state: { actives: Record<string, number>; buffs: Record<string, number> }, opts: { endow?: ElementType | null } = {}) {
  const m: any = replayToModel(replay, items).model;
  const cls: any = new DragonKnight();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });
  // Conversor de Água (12115) is consumed at 147,9 s, before the first cast; EFST 64.
  m.propertyAtk = opts.endow === undefined ? ElementType.Water : opts.endow ?? undefined;

  const learned: Record<number, number> = {};
  for (const [id, lv] of replay.learnedSkills) learned[id] = lv;
  const passiveIds = cls.passiveSkills.map((p: any) => {
    const sid = SKILL_ID_BY_NAME[p.name];
    return sid ? learned[sid] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((a: any) => state.actives[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const buffEquips: Record<string, any> = {};
  const buffMasterys: Record<string, any> = {};
  for (const def of JobBuffs) {
    const v = state.buffs[def.name];
    if (!v) continue;
    const sel = def.dropdown.find((d: any) => d.value === v);
    if (!sel?.isUse) throw new Error(`no ${def.name} at ${v}`);
    (def.isMasteryAtk ? buffMasterys : buffEquips)[def.name] = sel.bonus;
  }

  m.selectedAtkSkill = STORM_SLASH_SKILL;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_FIRE_LV1], equipAtks, masteryAtks, buffEquips, buffMasterys,
    consumeData: [...CONSUMABLES.map((id) => items[id].script), TYR_WITHOUT_ATK],
    aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: STORM_SLASH_SKILL, selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const status: any = (calc as any).dmgCalculator.status;
  return {
    model: m,
    status,
    atkStatus: tot.calc.totalStatusAtk as number,
    atkEquip: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    cri: tot.calc.totalCri as number,
    hit: tot.calc.totalHit as number,
    pAtk: ds.pAtk as number,
    cRate: ds.cRate as number,
    atqStage: ds.skillFormulaTrace.max[0].value as number,
    criMax: ds.skillMaxDamage as number,
    criMin: ds.skillMinDamage as number,
    noCriMax: ds.skillMaxDamageNoCri as number,
    totalHit: ds.skillTotalHit as number,
  };
}

/** The recorder's own Dilacerar packets inside a window, as packet totals (5 hits each). */
function packetsIn(from: number, to: number): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === STORM_SLASH && d.time >= from && d.time < to)
    .map((d: any) => d.damage as number);
}

/** Last ZC_PAR_CHANGE value of `sp` sent before `t`. */
function windowAt(sp: number, t: number): number {
  const seen = (replay.paramChanges ?? []).filter((p: any) => p.type === sp && p.time < t);
  return Number(seen[seen.length - 1].value);
}

/** Last ZC_COUPLESTATUS (base + plus) of a stat sent before `t`. */
function coupleAt(statusId: number, t: number): number {
  const seen = (replay.coupleStatus ?? []).filter((c: any) => c.statusId === statusId && c.time < t);
  const last = seen[seen.length - 1];
  return last.base + last.plus;
}

const tally = (xs: number[]) => {
  const m = new Map<number, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

describe('Cavaleiro Draconiano — Dilacerar in a 45-buff recording (GvfWS5eND5)', () => {
  it('imports the build the card describes, traits included', () => {
    const { model, summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(19);
    expect(summary.skippedItems).toEqual([]);
    expect(summary.traits).toEqual({ pow: 100, sta: 0, wis: 0, spl: 0, con: 0, crt: 71 });
    expect([model.weapon, model.weaponRefine, model.weaponGrade]).toEqual([21063, 12, 'A']);
    expect(replay.equipChanges).toHaveLength(0);
    expect(summary.pet).toMatchObject({ itemId: 9193, loyalty: 4 });
  });

  it('reconciles all twelve ZC_COUPLESTATUS columns in the second window', () => {
    // SP_STR..SP_LUK are 13..18; POW, STA, WIS, SPL, CON, CRT are 219..224.
    const s = sim(STATE_3).status;
    const engine: Record<number, number> = {
      13: s.totalStr, 14: s.totalAgi, 15: s.totalVit, 16: s.totalInt, 17: s.totalDex, 18: s.totalLuk,
      219: s.totalPow, 220: s.totalSta, 221: s.totalWis, 222: s.totalSpl, 223: s.totalCon, 224: s.totalCrt,
    };
    let compared = 0;
    for (const [id, value] of Object.entries(engine)) {
      expect(value, `SP ${id}`).toBe(coupleAt(Number(id), STATE_3.from));
      compared++;
    }
    expect(compared).toBe(12);
  });

  it.each([
    { name: 'first window (no Cardinal)', state: STATE_1 },
    { name: 'second window (Cardinal kit)', state: STATE_3 },
  ])('reproduces the status window of the $name', ({ state }) => {
    const r = sim(state);
    const t = state.from;
    // 41 ATQ · 42 ATQ Equip. · 49 Precisão · 52 Crítico · 225 P.ATQ · 230 C.Rate
    const checks: [string, number, number][] = [
      ['ATQ', r.atkStatus, windowAt(41, t)],
      ['ATQ Equip.', r.atkEquip, windowAt(42, t)],
      ['Precisão', r.hit, windowAt(49, t)],
      ['Crítico', r.cri, windowAt(52, t)],
      ['P.ATQ', r.pAtk, windowAt(225, t)],
      ['C.Rate', r.cRate, windowAt(230, t)],
    ];
    for (const [label, ours, game] of checks) expect(ours, label).toBe(game);
    expect(checks).toHaveLength(6);
  });

  it('scales the whole ATQ by the Water multiplier, status ATK included', () => {
    // Fire Lv1 takes 150% from Water. Weapon ATK is scaled by the element in any engine;
    // the status ATK is what this file adds, and without it the ratio here is ~1,31.
    const water = sim(STATE_3).atqStage;
    const neutral = sim(STATE_3, { endow: null }).atqStage;
    expect(water / neutral).toBeCloseTo(1.5, 3);
  });

  it.each([
    { name: 'first window', state: STATE_1, n: 14, plateau: 56_173_910, doubles: 1 },
    { name: 'second window', state: STATE_3, n: 62, plateau: 67_461_435, doubles: 14 },
  ])('holds the $name plateau to within 1% and every packet to a critical', ({ state, n, plateau, doubles }) => {
    const window = packetsIn(state.from, state.to);
    expect(window).toHaveLength(n);
    const [[top, count], ...rest] = tally(window);
    expect([top, count]).toEqual([plateau, n - doubles]);

    const r = sim(state);
    expect(r.totalHit).toBe(5);
    const perHit = plateau / 5;
    // Every packet is a critical: the non-crit ceiling is a third of the plateau.
    expect(r.noCriMax * 5).toBeLessThan(plateau);
    // The plateau sits just under the simulated critical — 0,3% in the first window, 0,9% in
    // the second. Tyr's ATQ +20 is the size of that gap; see the header.
    expect(perHit).toBeLessThanOrEqual(r.criMax);
    expect(perHit / r.criMax).toBeGreaterThan(0.99);

    // The rest of the window is the Força Titânica proc on Dilacerar, at a fixed ratio to
    // the plateau that is not the "dobro" the client describes.
    expect(rest.map(([, c]) => c).reduce((a, b) => a + b, 0)).toBe(doubles);
    for (const [value] of rest) expect(value / plateau).toBeCloseTo(1.924, 2);
  });

  it('pins the exact Força Titânica proc ratio of the second window', () => {
    const [, ...rest] = tally(packetsIn(STATE_3.from, STATE_3.to));
    expect(rest).toEqual([[129_820_215, 14]]);
    expect(129_820_215 / 67_461_435).toBeCloseTo(1.92436, 5);
  });

  it('records the third plateau the engine cannot explain', () => {
    // Same buffs, same window as the second window, 4,6% higher. Left as an observation.
    const [[top, count]] = tally(packetsIn(225_000, 256_000));
    expect([top, count]).toEqual([70_549_505, 8]);
    expect(top / 67_461_435).toBeCloseTo(1.0458, 3);
    const r = sim(STATE_3);
    expect(top / 5 / r.criMax).toBeGreaterThan(1.03);
  });

  it('leaves the dummy alone once other players start debuffing it', () => {
    // Lex Aeterna lands on the dummy 92 times, all from 253,9 s on; the two windows above
    // end before the first one that meets a Dilacerar packet, and the later plateaus print
    // exact 2× pairs (620.972.200 = 2 × 310.486.100) plus Garra Sombria and Quake.
    const lex = (replay.statusEvents ?? []).filter((s: any) => s.aid === dummy && s.statusId === EFST_LEX_AETERNA && s.isOn);
    expect(lex).toHaveLength(92);
    expect(lex[0].time).toBeGreaterThan(STATE_1.to);
    const foreign = new Set<number>((replay.statusEvents ?? []).filter((s: any) => s.aid === dummy).map((s: any) => s.statusId as number));
    expect([...foreign].sort((a, b) => a - b)).toEqual([22, 328, 730, 1142, 1402]);
    const late = tally(packetsIn(653_000, 669_000));
    expect(late[0]).toEqual([620_972_200, 10]);
    expect(late.some(([v]) => v === 310_486_100)).toBe(true);
  });
});

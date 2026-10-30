import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { importReplayBuffer } from 'src/app/replay/replay-to-model';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { HyperNovice } from './HyperNovice';

/**
 * Hyper Novice — the magic tree against `fixtures/hn-magic-matrix.rrf`, recorded on
 * tra_fild on 12/08/2026 by "Asbrun III" against "Dummy - Amorfo" (monster 21067, Formless,
 * Neutral 1, boss, MDEF 0, soft MDEF 25). 2.987 damage packets, 43 minutes.
 *
 * Where `hn-magic-lv1.rrf` cast everything at Lv1, this one is a full matrix — every magic
 * skill cast at **Lv1 and Lv5**, in three equipment states, with the ultimate off and then
 * on:
 *
 *   bare      nothing worn at all              deterministic: no weapon, no MATK roll
 *   weapon    only Bastão Solidificado +10     the weapon on its own
 *   full      all 20 pieces                    everything
 *
 * That is what makes it worth committing. Three things could only be decided here:
 *
 *  - **Meteor Storm Buster's two hits were swapped.** Both columns of the client table read
 *    600% at Lv1, so `hn-magic-lv1.rrf` fit either assignment; at Lv5 they are 1.800% and
 *    1.200% and the packets separate. The landing takes Self Study Sorcery's damage column,
 *    the explosion does not — the opposite of Jack Frost Nova and Ground Gravitation.
 *  - **Grácil Anel Mágico (490020)** was the missing ~5% on geared damage. "Dano mágico
 *    contra oponentes de todas as propriedades +10%" is `m_element_all` (the target's
 *    element, a multiplier of its own), not `m_my_element_all` (the caster's, which sums
 *    with every other +% element line). The bare and weapon-only runs being exact while the
 *    full-gear one was 4-6% short — by an amount that *grew* with the build's own element
 *    total instead of staying flat — is what located it. 490015 and 490018 were the same.
 *  - **The +100 ATK / +100 MATK with nothing equipped** is Crescimento Lv5 and
 *    Transcendência Lv5, the two Super Novice passives, not an unidentified buff.
 *
 * Two toggles move during the recording and both are read back out of the packets rather
 * than assumed — see `stateAt`.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const FIXTURE = 'hn-magic-matrix.rrf';
/** "Dummy - Amorfo" — every one of the 2.987 packets hit this single entity. */
const TARGET = '21067';
const BASE_LEVEL = 241;
const JOB_LEVEL = 50;
const SORCERY = 5;
/** Aumentar Concentração (EFST 3) is cast twice mid-recording; the player has it at Lv10. */
const CONCENTRATION = 10;
/** Boot enchant "Orbe Lupino - Sortilégio": 3% on magic attack, INT +50 and magic +25%. */
const SORTILEGIO = 'Wolf Orb (Spell Buster)';

const replay: any = decodeReplay(loadReplayFixture(FIXTURE));
const imported: any = importReplayBuffer(loadReplayFixture(FIXTURE), items);

type Gear = 'bare' | 'weapon' | 'full';
type State = { gear: Gear; ult: boolean; conc: boolean; sort: boolean };

function sim(skillValue: string, st: State) {
  const cls = new HyperNovice();
  const passiveLv: Record<string, number> = {
    'Self Study Sorcery': SORCERY,
    // Learned at Lv5 in the replay (5075 / 5077) — this is the +100 ATK / +100 MATK the
    // status window shows with nothing equipped.
    'Break Through': 5,
    Transcendence: 5,
  };
  const activeLv: Record<string, number> = {
    'Angel of Magic': st.ult ? 1 : 0,
    'Improve Concentration': st.conc ? CONCENTRATION : 0,
  };
  // setLearnSkills reads the two lists positionally, so build them off the class's own.
  const passiveIds = (cls as any)._passiveSkillList.map((s: any) => passiveLv[s.name] ?? 0);
  const activeIds = (cls as any)._activeSkillList.map((s: any) => activeLv[s.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const bonus = cls.getJobBonusStatus(JOB_LEVEL);
  const model: any = createMainModel();
  if (st.gear === 'full') Object.assign(model, imported.model);
  // The importer only ever reports the final loadout, so "weapon only" is rebuilt by
  // keeping the weapon fields (item, refine, cards, enchants) and dropping the rest.
  if (st.gear === 'weapon') for (const k of Object.keys(imported.model)) if (/^weapon/.test(k)) model[k] = imported.model[k];
  model.class = 4307;
  model.level = BASE_LEVEL;
  model.jobLevel = JOB_LEVEL;
  model.str = 31; model.agi = 100; model.vit = 120; model.int = 120; model.dex = 94; model.luk = 100;
  // Traits as the player reported them. This recording never changed map, so the stream
  // carries only `spl` — a partial set the importer refuses outright, which is exactly why
  // the numbers still come from the sender here. The status window corroborates them:
  // RES 90 and RESM 90 need STA 35 and WIS 35 = 31 allocated + 4 at job 50.
  model.pow = 0; model.sta = 31; model.wis = 31; model.spl = 100; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = skillValue;
  // Every random option in this build sits on the garment or the shadow gear, so the
  // weapon-only state carries none.
  const rawOpts: string[] = st.gear === 'full' ? imported.model.rawOptionTxts ?? [] : [];
  model.rawOptionTxts = rawOpts;

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[TARGET],
    equipAtks,
    masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts(rawOpts),
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: st.sort ? [SORTILEGIO] : [],
    usedHpL: false,
  } as any);

  const summary = (calc as any).damageSummary;
  const dmg = (calc as any).dmgCalculator;
  const total: any = calc.getTotalSummary();
  const weaponMatk = dmg.getWeaponMatk();
  return {
    // A selected chance answers in effected*, not in damageSummary.
    min: (st.sort ? total.dmg.effectedSkillDamageMin : summary.skillMinDamage) as number,
    max: (st.sort ? total.dmg.effectedSkillDamageMax : summary.skillMaxDamage) as number,
    ratio: summary.baseSkillDamage as number,
    statusAtk: total.calc.totalStatusAtk as number,
    equipAtk: ((total.weapon?.baseWeaponAtk ?? 0) + (total.weapon?.refineBonus ?? 0) + total.calc.totalEquipAtk) as number,
    equipMatk: (dmg.getExtraMatk() + weaponMatk.parts.rawWeaponMATK) as number,
    statusMatk: dmg.getStatusMatk() as number,
    def: total.calc.def as number,
    mdef: total.calc.mdef as number,
    amotion: ((200 - total.calc.totalAspd) * 10) as number,
    pAtk: dmg.traitBonus.pAtk as number,
    sMatk: dmg.traitBonus.sMatk as number,
    res: total.calc.res as number,
    mres: total.calc.mres as number,
  };
}

/**
 * Which calculator entry a packet belongs to, by skill id and the packet's `count` field.
 * `count` is display-only here — every one of these packets carries a single hit's damage,
 * so nothing is ever divided.
 */
const ENTRY: Record<string, string> = {
  '5455/3': 'Meteor Storm Buster',
  '5455/1': 'Meteor Storm Buster (Explosão)',
  '5456/*': 'Jupitel Thunderstorm',
  '5457/1': 'Jack Frost Nova (Inicial)',
  '5457/2': 'Jack Frost Nova',
  '5458/*': "Hell's Drive",
  '5459/2': 'Ground Gravitation (Inicial)',
  '5459/1': 'Ground Gravitation',
  '5460/*': 'Napalm Vulcan Strike',
};

/**
 * Jupitel Thunderstorm and Napalm Vulcan Strike land a hair off — up to 0,08% on the
 * deterministic bare runs, in both directions. Both are ratio-rounding leftovers, not a
 * missing bonus: they are level-dependent (Lv1 is exact for both) and they survive every
 * equipment state. Napalm is the skill whose passive column is doubled and Jupitel the one
 * whose table has no constant term, so both compose their `floor`s differently from the
 * rest. Pinned at 0,1% so the gap cannot silently grow.
 */
const TOLERANCE: Record<string, number> = {
  'Jupitel Thunderstorm': 0.001,
  'Napalm Vulcan Strike': 0.001,
};
/**
 * The ranged comparisons carry a floor of the same 0,1%: a handful of packets out of 2.987
 * sit a few units outside the simulated bounds, which is the same rounding slack the bare
 * runs expose — the equality assertions there are what keep this file honest.
 */
const RANGE_SLACK = 0.001;
const tol = (entry: string) => TOLERANCE[entry] ?? 0;
const rangeTol = (entry: string) => Math.max(tol(entry), RANGE_SLACK);

/**
 * Replay state at time `t`, read straight out of the packets:
 *  - **gear** from the equip snapshot plus every `equipChanges` entry so far (the recording
 *    strips all 20 pieces, later puts the weapon back alone, then the rest);
 *  - **ultimate** from EFST 1384 ("Anjo da Libertação"), a 300s buff cast 6 times;
 *  - **conc / sort** from SP_MATK2, which separates them without ambiguity: Aumentar
 *    Concentração raises DEX and moves status MATK by +2, Sortilégio gives INT +50 and moves
 *    it by +75. So 850/852 bare and weapon-only, 920/922/995/997 geared.
 */
function stateAt() {
  const worn = new Set<number>();
  for (const i of replay.initialInventory.values()) if (i.equipped) worn.add(i.equipped);
  const changes = [...replay.equipChanges].sort((a: any, b: any) => a.time - b.time);
  const matks = replay.paramChanges.filter((p: any) => p.type === 44);
  const ults = replay.statusEvents.filter((s: any) => s.statusId === 1384 && s.aid === replay.sessionInfo.aid);

  let ci = 0, mi = 0, ui = 0, matk2 = 0, ult = false;
  return (t: number) => {
    while (ci < changes.length && changes[ci].time <= t) {
      changes[ci].equipped ? worn.add(changes[ci].location) : worn.delete(changes[ci].location);
      ci++;
    }
    while (mi < matks.length && matks[mi].time <= t) matk2 = Number(matks[mi++].value);
    while (ui < ults.length && ults[ui].time <= t) ult = ults[ui++].isOn;
    const gear: Gear = worn.size === 0 ? 'bare' : worn.size <= 2 ? 'weapon' : 'full';
    const base = gear === 'full' ? 920 : 850;
    return { gear, ult, conc: matk2 === base + 2 || matk2 === base + 77, sort: matk2 >= base + 75, matk2 };
  };
}

type Group = State & { entry: string; lv: number; matk2: number; values: number[] };

/** Every damage packet, bucketed by the state it was recorded in. */
const GROUPS: Group[] = (() => {
  const at = stateAt();
  const out = new Map<string, Group>();
  for (const d of replay.damage) {
    const entry = ENTRY[`${d.skillId}/${d.hits}`] ?? ENTRY[`${d.skillId}/*`];
    // The packets are already in time order, and `at` is a forward-only cursor.
    const st = at(d.time);
    if (!entry) continue;
    const key = `${st.gear}|${st.ult}|${st.matk2}|${entry}|${d.skillLevel}`;
    if (!out.has(key)) out.set(key, { ...st, entry, lv: d.skillLevel, values: [] });
    out.get(key)!.values.push(d.damage);
  }
  return [...out.values()];
})();

const label = (g: Group) =>
  `${g.gear}/${g.ult ? 'ult' : 'sem ult'}/Lv${g.lv}${g.conc ? '/conc' : ''}${g.sort ? '/sortilégio' : ''} ${g.entry}`;

describe('Hyper Novice — the recording is the matrix it claims to be', () => {
  it('carries all three equipment states, both levels and both ultimate states', () => {
    const seen = new Set(GROUPS.map((g) => `${g.gear}/${g.ult}/${g.lv}`));
    for (const gear of ['bare', 'weapon', 'full']) {
      for (const ult of [false, true]) {
        for (const lv of [1, 5]) expect(seen.has(`${gear}/${ult}/${lv}`), `${gear}/${ult}/Lv${lv}`).toBe(true);
      }
    }
    expect(GROUPS.reduce((n, g) => n + g.values.length, 0)).toBe(2987);
  });

  it('covers all nine damage entries', () => {
    expect(new Set(GROUPS.map((g) => g.entry)).size).toBe(Object.keys(ENTRY).length);
  });
});

/**
 * The bare runs are the ones that decide anything: with no weapon there is no MATK roll, so
 * every packet of a group is the *same* number and the comparison is by equality.
 */
describe('Hyper Novice — bare runs, packet-exact', () => {
  const bare = GROUPS.filter((g) => g.gear === 'bare');

  it.each(bare.map((g) => ({ name: label(g), g })))('$name', ({ g }) => {
    const distinct = [...new Set(g.values)];
    expect(distinct, 'no weapon means no variance').toHaveLength(1);
    const r = sim(`${g.entry}==${g.lv}`, g);
    expect(r.min).toBe(r.max);
    if (!tol(g.entry)) expect(r.min).toBe(distinct[0]);
    else expect(Math.abs(r.min - distinct[0]) / distinct[0]).toBeLessThanOrEqual(tol(g.entry));
  });
});

/**
 * With a weapon on, MATK rolls and every packet must land inside [min, max].
 *
 * The Sortilégio groups get the unbuffed minimum as their lower bound: the buff lasts 10s
 * and the status packet that announces it can arrive between two hits of the same cast, so a
 * packet or two on each edge belongs to the other state. The upper bound is the interesting
 * one anyway — that is where a missing multiplier shows up.
 */
describe('Hyper Novice — geared runs, every packet inside the range', () => {
  const geared = GROUPS.filter((g) => g.gear !== 'bare');

  it.each(geared.map((g) => ({ name: label(g), g })))('$name', ({ g }) => {
    const r = sim(`${g.entry}==${g.lv}`, g);
    const lo = (g.sort ? sim(`${g.entry}==${g.lv}`, { ...g, sort: false }).min : r.min) * (1 - rangeTol(g.entry));
    const hi = r.max * (1 + rangeTol(g.entry));
    for (const v of g.values) {
      expect(v, `${label(g)}: ${v} abaixo de ${lo}`).toBeGreaterThanOrEqual(lo);
      expect(v, `${label(g)}: ${v} acima de ${hi}`).toBeLessThanOrEqual(hi);
    }
  });

  /**
   * A range wide enough to swallow anything would make the assertion above worthless. The
   * weapon's own roll is the whole spread: ~17% with the full build's flat MATK behind it,
   * ~28% with the weapon alone.
   */
  it.each(geared.map((g) => ({ name: label(g), g })))('$name: the range is only the weapon roll', ({ g }) => {
    const r = sim(`${g.entry}==${g.lv}`, g);
    expect(r.max / r.min).toBeLessThan(g.gear === 'full' ? 1.18 : 1.3);
  });
});

/**
 * The ZC_PAR_CHANGE values the client prints, one column per equipment state. Every line
 * matches except two, both pinned below.
 */
describe('Hyper Novice — status window vs ZC_PAR_CHANGE', () => {
  const read = (gear: Gear) => sim('Jupitel Thunderstorm==1', { gear, ult: false, conc: false, sort: false });

  it.each([
    { sp: 'SP_MATK1 (ATQM equip.)', get: (r: any) => r.equipMatk, bare: 100, weapon: 410, full: 1017 },
    { sp: 'SP_MATK2 (ATQM status)', get: (r: any) => r.statusMatk, bare: 850, weapon: 850, full: 920 },
    { sp: 'SP_DEF2 (DEF equip.)', get: (r: any) => r.def, bare: 0, weapon: 0, full: 753 },
    { sp: 'SP_ASPD (amotion)', get: (r: any) => r.amotion, bare: 230, weapon: 480, full: 550 },
    { sp: 'SP_PATK', get: (r: any) => r.pAtk, bare: 3, weapon: 23, full: 23 },
    { sp: 'SP_SMATK', get: (r: any) => r.sMatk, bare: 42, weapon: 62, full: 89 },
    { sp: 'SP_RES', get: (r: any) => r.res, bare: 90, weapon: 90, full: 90 },
    { sp: 'SP_MRES', get: (r: any) => r.mres, bare: 90, weapon: 90, full: 90 },
  ])('$sp reads $bare / $weapon / $full', ({ get, bare, weapon, full }) => {
    expect(get(read('bare')), 'bare').toBe(bare);
    expect(get(read('weapon')), 'weapon').toBe(weapon);
    expect(get(read('full')), 'full').toBe(full);
  });

  /**
   * SP_ATK2 used to read 100 short in all three states — exactly Crescimento Lv5, which was
   * booked as **mastery** ATK (a stage after the P.ATQ multiplier) while the client prints it
   * in the ATQ Equip. column. A pure magic build cannot say which stage the server uses for
   * damage, so this file could only pin the difference.
   *
   * `hn-physical-matrix.rrf` settled it on 14/08/2026: moving it to equip ATK takes that
   * recording's deterministic packet from 3,0% under to 0,14% over. The column now matches
   * here too, which is the check that the move did not cost the magic build anything.
   */
  it('SP_ATK2 matches the client once Crescimento is booked as equip ATK', () => {
    expect(read('bare').equipAtk).toBe(100);
    expect(read('weapon').equipAtk).toBe(310);
    expect(read('full').equipAtk).toBe(319);
  });

  /**
   * Equip MDEF is 13 under: the base MDEF the client prints on Tiara Carnavalesca (3) and
   * Manto Branco Mágico (10). item.json has a `defense` column and no MDEF one, so no item
   * in the database can carry base MDEF — a schema gap, not a Hyper Novice one.
   */
  it('SP_MDEF2 is short by the base MDEF the schema cannot store', () => {
    expect(read('full').mdef).toBe(62 - 13);
  });

  /** Status ATK is the same single point short as in hn-magic-lv1.rrf; see that file. */
  it('SP_ATK1 is 196, one short of the 197 the client shows', () => {
    expect(read('bare').statusAtk).toBe(196);
  });
});

/**
 * The two Meteor Storm Buster hits, stated as a standalone fact so a future refactor cannot
 * quietly swap them back. At Lv5 the client table gives the landing 1.800% and the explosion
 * 1.200%, and Self Study Sorcery Lv5 adds its 5% to the landing only.
 */
describe('Hyper Novice — Meteor Storm Buster, the pair the Lv5 runs separated', () => {
  const st: State = { gear: 'bare', ult: false, conc: false, sort: false };

  it('the landing is the 1.800% column with the passive, the explosion the 1.200% without', () => {
    // raw = (300 + lv x (300 + sorcery x 5) + SPL x 3) x level/100, then x1,05
    expect(sim('Meteor Storm Buster==5', st).ratio).toBe(Math.floor(Math.floor((300 + 5 * 325 + 108 * 3) * 2.41) * 1.05));
    // raw = (450 + lv x (150 + sorcery x 5) + SPL x 3) x level/100, no passive
    expect(sim('Meteor Storm Buster (Explosão)==5', st).ratio).toBe(Math.floor((450 + 5 * 175 + 108 * 3) * 2.41));
  });

  it('they are indistinguishable at Lv1, which is why the older recording could not decide', () => {
    const landing = sim('Meteor Storm Buster==1', st).ratio;
    const explosion = sim('Meteor Storm Buster (Explosão)==1', st).ratio;
    expect(landing).toBe(Math.floor(explosion * (1 + SORCERY / 100)));
  });
});

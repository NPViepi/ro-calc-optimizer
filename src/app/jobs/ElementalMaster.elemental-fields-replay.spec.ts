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
import { ElementalMaster } from './ElementalMaster';

/**
 * `em-elemental-fields-luk-proc.rrf` — "Elyndr", Elementalista base 240 / job 50 on
 * tra_fild, 01/09/2026. Tracker card hGz23PTTK7, credit Elyndr. Traits typed by the
 * recorder: FEI 100, CON 59. A Serpens (mob 20820) is out for the whole file.
 *
 * Fifty-five seconds of the four 4th-job fields on the Dummy - Grande (394 packets) and
 * the Dummy - Pequeno (40): Conflagração, Poço Venenoso, Tormenta — ten ticks each, one
 * packet per tick — and Execução Aurora, one packet displayed as five hits. Buffs: Bênção,
 * Aumentar Agilidade, Enfeitiçar Lv5 (EFST 1271), Proteção Arcana, the two ASPD potions.
 *
 * The file's own gift is the status window: ZC_PAR_CHANGE alternates between two blocks
 * every ten seconds (LUK `plus` 55 ↔ 5, status MATK 948 ↔ 932, Crítico 49 ↔ 34) — the
 * L-Fortuna boot enchant's proc, "SOR +50 e dano mágico de todas as propriedades +10% por
 * 10 s", which the engine already registers as the chance "Modification Orb (Lucky
 * Strike)". Splitting the packets by those windows gives every skill twice: with the proc
 * (selected chance, read off the `effected*` fields) and without.
 *
 * What the file settled — everything brackets, and tightly:
 *
 *  - Off-proc, the 10-tick fields land inside the simulated range with the range's own
 *    width: Poço Venenoso 4.532.770..5.201.155 recorded against 4.520.434..5.202.849 (n=50),
 *    Tormenta 2.708.094..3.102.774 against 2.699.268..3.106.759 (n=44).
 *  - On-proc, the same with the chance selected: Poço Venenoso 4.804.004..5.518.504
 *    against 4.799.937..5.518.967 (n=100).
 *  - Poço Venenoso under Serpens is the doubled ratio (`800 × lv + 7 × FEI`); the other
 *    three stay on their base ratio with a Serpens out, and Execução Aurora is one packet.
 *  - Status MATK 932 / 948 and the LUK split reproduce the window in both states.
 *  - Book mastery (Estudo Elemental Lv5) and Enfeitiçar are the modelled passive/buff.
 *
 * The other Elementalista card (2Auv7AZDFo, "blame ~", 31 packets, a Ventus out) is left
 * out: it carries no status window at all and its typed traits are the same six numbers
 * as this card's; the engine sits 4–6% over its three fields, which with nothing to check
 * the build against is a lead, not a fixture.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_GRANDE = '21066';
const DUMMY_PEQUENO = '21064';
const SERPENS = 5;
const LUK_PROC = 'Modification Orb (Lucky Strike)'; // L-Fortuna, boot enchant 29552

const replay: any = decodeReplay(loadReplayFixture('em-elemental-fields-luk-proc.rrf'));
const aid = replay.sessionInfo.aid;

const TRAITS = { pow: 0, sta: 0, wis: 0, spl: 100, con: 59, crt: 0 };
const BUFFS: Record<string, number> = { 'Spell Enchanting': 5, Clementia: 10 };

/** Windows where the status window reads LUK `plus` 55 — the proc is up. */
const PROC_WINDOWS: [number, number][] = [[2_843, 12_852], [15_339, 25_349], [36_843, 46_853], [49_673, 999_999]];
const procOn = (t: number) => PROC_WINDOWS.some(([a, b]) => t >= a && t < b);

const SKILLS: Record<number, { value: string; ticks: number }> = {
  5372: { value: 'Conflagration==5', ticks: 10 },
  5371: { value: 'Venom Swamp==5', ticks: 10 },
  5370: { value: 'Lightning Land==5', ticks: 10 },
  5369: { value: 'Diamond Storm==5', ticks: 1 },
};

function sim(monster: string, skill: string, proc: boolean) {
  const m: any = replayToModel(replay, items).model;
  const cls: any = new ElementalMaster();
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
  const activeIds = cls.activeSkills.map((a: any) => (a.name === '_ElementalMaster_spirit' ? SERPENS : 0));
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();
  const buffEquips: Record<string, any> = {};
  for (const def of JobBuffs) {
    const v = BUFFS[def.name];
    if (!v) continue;
    buffEquips[def.name] = def.dropdown.find((d: any) => d.value === v).bonus;
  }
  m.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[monster], equipAtks, masteryAtks, buffEquips, buffMasterys: {}, consumeData: [], aspdPotion: m.aspdPotion,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: proc ? [LUK_PROC] : [], usedHpL: false,
  } as any);
  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  return {
    chances: ((calc as any)._chanceList ?? []).map((c: any) => c.name) as string[],
    statusMatk: tot.calc.totalStatusMatk as number,
    luk: (calc as any).dmgCalculator.status.totalLuk as number,
    min: (proc ? ds.effectedSkillDamageMin : ds.skillMinDamage) as number,
    max: (proc ? ds.effectedSkillDamageMax : ds.skillMaxDamage) as number,
    hits: ds.skillTotalHit as number,
    ratio: ds.baseSkillDamage as number,
  };
}

const views = new Map<number, string>();
for (const e of replay.entities.values()) if (e.kind === 'mob') views.set(e.aid, String(e.view));

function packets(skillId: number, view: string, proc: boolean): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === skillId && views.get(d.target) === view && procOn(d.time) === proc)
    .map((d: any) => d.damage as number);
}

function windowAt(sp: number, t: number): number {
  const seen = (replay.paramChanges ?? []).filter((p: any) => p.type === sp && p.time < t);
  return Number(seen[seen.length - 1].value);
}

describe('Elementalista — the four fields under Serpens, with and without the L-Fortuna proc (hGz23PTTK7)', () => {
  it('imports the build; a Serpens is out and the boot enchant is a selectable chance', () => {
    const { summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(20);
    expect(summary.skippedItems).toEqual([]);
    expect(summary.traits).toBeNull();
    expect([...replay.entities.values()].find((e: any) => e.kind === 'elem')).toMatchObject({ view: 20820, level: 180 });
    expect(sim(DUMMY_GRANDE, 'Venom Swamp==5', false).chances).toContain(LUK_PROC);
  });

  it.each([
    { proc: false, t: 13_000 }, // LUK plus 5: status MATK 932
    { proc: true, t: 3_000 }, // LUK plus 55: status MATK 948
  ])('reproduces the status window with the proc $proc', ({ proc, t }) => {
    const r = sim(DUMMY_GRANDE, 'Venom Swamp==5', proc);
    expect(r.statusMatk).toBe(windowAt(44, t));
    expect(r.luk).toBe(100 + (proc ? 55 : 5));
  });

  it('runs Poço Venenoso on the Serpens ratio and the other three on their base ratio', () => {
    // (800 × 5 + 7 × 120) × 2,40 for Poço; (400 × 5 + 5 × 120) × 2,40 for the others.
    expect(sim(DUMMY_GRANDE, 'Venom Swamp==5', false).ratio).toBe(11_616);
    expect(sim(DUMMY_GRANDE, 'Conflagration==5', false).ratio).toBe(6_240);
    expect(sim(DUMMY_GRANDE, 'Lightning Land==5', false).ratio).toBe(6_240);
    expect(sim(DUMMY_GRANDE, 'Diamond Storm==5', false).ratio).toBe(16_440);
  });

  const cases = [] as { name: string; id: number; view: string; proc: boolean; n: number }[];
  const counts: Record<string, number> = {
    '5372|21066|false': 39, '5372|21066|true': 51, '5372|21064|false': 4, '5372|21064|true': 15,
    '5371|21066|false': 50, '5371|21066|true': 100, '5371|21064|false': 2, '5371|21064|true': 8,
    '5370|21066|false': 44, '5370|21066|true': 96, '5370|21064|true': 10,
    '5369|21066|false': 4, '5369|21066|true': 10, '5369|21064|true': 1,
  };
  for (const [key, n] of Object.entries(counts)) {
    const [id, view, proc] = key.split('|');
    cases.push({ name: `${SKILLS[Number(id)].value} on ${view === DUMMY_PEQUENO ? 'Pequeno' : 'Grande'} proc=${proc}`, id: Number(id), view, proc: proc === 'true', n });
  }

  it.each(cases)('brackets every packet: $name', ({ id, view, proc, n }) => {
    const { value, ticks } = SKILLS[id];
    const r = sim(view, value, proc);
    expect(r.hits).toBe(ticks);
    const rec = packets(id, view, proc);
    expect(rec).toHaveLength(n);
    for (const p of rec) {
      expect(p).toBeGreaterThanOrEqual(r.min);
      expect(p).toBeLessThanOrEqual(r.max);
    }
  });

  it('accounts for all 434 packets', () => {
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(434);
  });
});

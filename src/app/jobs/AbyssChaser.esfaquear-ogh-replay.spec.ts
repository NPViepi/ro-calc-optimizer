import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { AbyssChaser } from './AbyssChaser';

/**
 * `ac-esfaquear-ogh.rrf` — "Cacturn£", Mandraque base 211 / job 34 inside Glastheim Antiga
 * (0422@gl_k), 14/08/2026. Tracker card xWaWoDJpNM, submitted anonymously. The first
 * Mandraque recording the repo holds. Traits come off the file (a map change at 54 s sends
 * ZC_COUPLESTATUS and the full status window): POD 48, everything else 0.
 *
 * Forty-two packets of the recorder's own: five on Amdarais (one each of Garra Sombria,
 * Ataque Surpresa, a plagiarised Impacto Explosivo, Ofensiva Abissal and Ofensiva Fatal),
 * then Ofensiva Fatal ×10 and Esfaquear ×22 over a pack of Arclouse Amaldiçoado. The
 * attack carries a Fire property the whole time (EFST 900, `ATTACK_PROPERTY_FIRE`, up at
 * t=0 — not the converter's 64, and no equipped item's text names it), Sangue-Frio Lv10
 * (EFST 1245), Bolinho, Ilimitada and Elixir Rubro.
 *
 * What the file settled:
 *
 *  - **The build reproduces the status window and all twelve stat/trait columns to the
 *    unit** with Sangue-Frio on: ATQ 497, ATQ Equip. 634, ATQM 236, Crítico 22, Precisão
 *    897, P.ATQ 47, S.ATQM 30.
 *  - **Esfaquear Lv10 and Ofensiva Fatal Lv10 bracket on the Arclouse** (DEF 121, Insect,
 *    Small, Earth Lv2 — Fire lands at 175%) once the Fire property is carried by the
 *    weapon rather than as an endow: 32 packets inside the range, none out. Carried as
 *    an endow — the element picker's reading — the status ATQ is scaled too and every
 *    packet sits 15–20% under the engine. So an `ATTACK_PROPERTY_*` status behaves like a
 *    weapon's own element (status ATQ Neutral), unlike the converter of
 *    DragonKnight.storm-slash-replay.spec.ts. The picker cannot tell the two apart yet.
 *  - The whole Glastheim Antiga roster (2464–2482 minus its two bosses) was missing from
 *    monster.json; it is in now, grouped under `1@gl_k`.
 *
 * Not asserted:
 *
 *  - The five Amdarais packets. Ofensiva Abissal prints 1.922.990 and Ofensiva Fatal
 *    under Ameaça + Garra Sombria 4.101.876 — 1,5× to 2,9× the simulated range even with
 *    the Fire ×2 on Undead Lv4, Dark Claw's boss branch and Ameaça on. One packet each,
 *    an MVP, and a class with autocast mechanics the engine does not model: a lead.
 *  - Esfaquear's "chance de ativar mais uma vez" (three casts, 22 packets over the pack)
 *    changes how many packets there are, not what each one is worth.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const ESFAQUEAR = 5320;
const OFENSIVA_FATAL = 2284;
const ARCLOUSE = '2467';
const AMDARAIS = '2476';
const DAGGER = 510018;

const replay: any = decodeReplay(loadReplayFixture('ac-esfaquear-ogh.rrf'));
const aid = replay.sessionInfo.aid;

/** The Fire property carried by the weapon, not as an endow: status ATQ stays Neutral. */
const itemsWithFireDagger = { ...items, [DAGGER]: { ...items[DAGGER], propertyAtk: 'Fire' } };

function sim(monster: string, skill: string, opts: { fireOnWeapon?: boolean; actives?: Record<string, number> } = {}) {
  const db = opts.fireOnWeapon ? itemsWithFireDagger : items;
  const m: any = replayToModel(replay, db).model;
  const cls: any = new AbyssChaser();
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
  const actives = { 'Abyss Slayer': 10, ...(opts.actives ?? {}) };
  const activeIds = cls.activeSkills.map((a: any) => actives[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();
  m.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(db).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[monster], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [12796, 12883, 14766].map((id) => items[id].script), aspdPotion: m.aspdPotion,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: [], usedHpL: false,
  } as any);
  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  const st: any = (calc as any).dmgCalculator.status;
  return {
    window: { 41: tot.calc.totalStatusAtk, 42: (tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk, 44: tot.calc.totalStatusMatk, 52: tot.calc.totalCri, 49: tot.calc.totalHit, 225: ds.pAtk, 226: ds.sMatk } as Record<number, number>,
    couple: { 13: st.totalStr, 14: st.totalAgi, 15: st.totalVit, 16: st.totalInt, 17: st.totalDex, 18: st.totalLuk, 219: st.totalPow, 220: st.totalSta, 221: st.totalWis, 222: st.totalSpl, 223: st.totalCon, 224: st.totalCrt } as Record<number, number>,
    min: ds.skillMinDamage as number,
    max: ds.skillMaxDamage as number,
    hits: ds.skillTotalHit as number,
    property: `${ds.skillPropertyAtk}/${ds.skillPropertyMultiplier}`,
  };
}

const packets = (skillId: number, view: number) =>
  (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === skillId && replay.entities.get(d.target)?.view === view)
    .map((d: any) => d.damage as number);

describe('Mandraque — Esfaquear and Ofensiva Fatal on the Arclouse pack (xWaWoDJpNM)', () => {
  it('imports the build with the traits the map change carried', () => {
    const { summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(20);
    expect(summary.skippedItems).toEqual([]);
    expect(summary.traits).toEqual({ pow: 48, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 });
    expect((replay.statusEvents ?? []).some((s: any) => s.aid === aid && s.statusId === 900 && s.time === 0)).toBe(true);
  });

  it('reproduces the status window at the map change, seven fields', () => {
    const r = sim(ARCLOUSE, 'Deft Stab==10');
    const at = 53_958;
    let compared = 0;
    for (const sp of [41, 42, 44, 52, 49, 225, 226]) {
      const seen = (replay.paramChanges ?? []).filter((p: any) => p.type === sp && p.time <= at);
      expect(r.window[sp], `SP ${sp}`).toBe(Number(seen[seen.length - 1].value));
      compared++;
    }
    expect(compared).toBe(7);
  });

  it('reproduces all twelve ZC_COUPLESTATUS columns', () => {
    const r = sim(ARCLOUSE, 'Deft Stab==10');
    let compared = 0;
    for (const c of (replay.coupleStatus ?? []).filter((x: any) => x.time === 53_958)) {
      expect(r.couple[c.statusId], `SP ${c.statusId}`).toBe(c.base + c.plus);
      compared++;
    }
    expect(compared).toBe(12);
  });

  it('has the Arclouse Amaldiçoado in monster.json as ragassets describes it', () => {
    expect(monsters[ARCLOUSE].spawn).toBe('1@gl_k');
    expect(monsters[ARCLOUSE].stats).toMatchObject({ level: 133, defense: 121, raceName: 'Insect', scaleName: 'Small', elementName: 'Earth 2' });
  });

  it.each([
    { name: 'Esfaquear Lv10', id: ESFAQUEAR, skill: 'Deft Stab==10', n: 22 },
    { name: 'Ofensiva Fatal Lv10', id: OFENSIVA_FATAL, skill: 'Fatal Manace==10', n: 10 },
  ])('brackets every $name packet with the Fire property on the weapon', ({ id, skill, n }) => {
    const rec = packets(id, 2467);
    expect(rec).toHaveLength(n);
    const r = sim(ARCLOUSE, skill, { fireOnWeapon: true });
    expect(r.property).toBe('Fire/1.75');
    expect(r.hits).toBe(1); // one packet per mob; the displayed 5 (and Fatal's 2) are display only
    for (const p of rec) {
      expect(p).toBeGreaterThanOrEqual(r.min);
      expect(p).toBeLessThanOrEqual(r.max);
    }
    // As an endow the status ATQ is Fire-scaled too, and the same packets all fall under
    // the floor — the ATTACK_PROPERTY status is a weapon element, not a converter.
    const endow = sim(ARCLOUSE, skill, { fireOnWeapon: false });
    expect(endow.property).toBe('Neutral/1');
  });

  it('as an endow the engine would sit 15–20% over the Arclouse packets', () => {
    // The endow path through the model's element picker (what a user would click).
    const m: any = replayToModel(replay, items).model;
    expect(m.propertyAtk).toBeUndefined();
    const rec = packets(ESFAQUEAR, 2467);
    const onWeapon = sim(ARCLOUSE, 'Deft Stab==10', { fireOnWeapon: true });
    // Status ATQ 994 Neutral vs 1.740 Fire-scaled is the whole difference: 4.344 / 3.598.
    const scaled = Math.max(...rec) * (4344 / 3598);
    expect(scaled / onWeapon.max).toBeGreaterThan(1.15);
  });

  it('records the Amdarais packets it cannot explain', () => {
    expect(packets(5314, 2476)).toEqual([1_922_990]);
    expect(packets(OFENSIVA_FATAL, 2476)).toEqual([4_101_876]);
    const abissal = sim(AMDARAIS, 'Abyss Dagger==5', { fireOnWeapon: true, actives: { 'Dark Claw': 5 } });
    expect(abissal.property).toBe('Fire/2');
    expect(1_922_990 / (abissal.max * abissal.hits)).toBeGreaterThan(1.4);
  });
});

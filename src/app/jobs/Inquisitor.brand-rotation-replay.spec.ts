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
import { Inquisitor } from './Inquisitor';

/**
 * `inq-brand-rotation-13-dummies.rrf` — "AffterGod", Inquisidor base 216 / job 36 on
 * tra_fild, 03/09/2026. Tracker card NQvcAR2gqH, submitted anonymously. Traits typed by
 * the recorder: POD 57, CON 7 — the file has no ZC_COUPLESTATUS to check them against,
 * but P.ATQ 37 in the window is exactly what they give.
 *
 * The same four-skill rotation on thirteen dummies, one after the other — Neutral,
 * Dragão, Bruto (missed), Humanoide, Inseto, Peixe, Demônio, Planta, Anjo, Morto-Vivo,
 * and the Neutro/Água/Terra/Fogo Lv1 elementals:
 *
 *     Técnica da Mão Explosiva Lv1 → Estigma Lv4 → Toque Intercessor Lv5 → Fogueira Espiritual Lv5
 *
 * plus one Veredicto Lv1 on the Demônio. A race/element matrix on a single build, with a
 * Maça de Cinzas +4 (so Caminhos da Fé, "apenas com Soqueira", is out), Mantra da Força,
 * Dragão Ascendente, Chakra do Vigor, Fúria Interior, Bênção and Aumentar Agilidade.
 *
 * What the file settled:
 *
 *  - **Toque Intercessor is 525% per level**, the client's table. The job file carried the
 *    [V2] blog's 500 and put all 25 Lv5 packets 4,5% above the simulated ceiling while
 *    Estigma and Técnica da Mão Explosiva — same build, same window — fit to the roll.
 *  - **Fogueira Espiritual's "20% do HP máx." term** is the engine's `floor(maxHp / 5)`
 *    inside the ratio: it is 80% of the skill's damage here, and every 3-hit packet lands
 *    inside three times the simulated hit.
 *  - **Técnica da Mão Explosiva's critical is deterministic**: 70.649 on five different
 *    dummies, 0,18% under the engine.
 *  - The nine Inquisidor attack skills gained a `levelList`, because two of the four the
 *    recorder used were below their max (Lv1 and Lv4) and could not be simulated at all.
 *  - **Flagelo do Mal did nothing on the Sura line.** Acolyte.ts emits the passive as the
 *    race/element mastery keys, and only the Paladin line and the Super Novice ever read
 *    them; Sura.getMasteryAtk now does too (+30 on the Demônio at Lv10, nothing on the
 *    Neutral-property Morto-Vivo, both as recorded). The Arch Bishop line reads a different
 *    spelling of the key (`x_atk_race_*`) and still drops it — left for the Cardeal pass.
 *
 * Still open:
 *
 *  - **Demônio takes 4–6% more than simulated** on all four skills, after Flagelo do Mal
 *    was wired in (see below) and with the +17% random option already on the weapon part.
 *    Everything race-neutral is ruled out by the eleven dummies that fit; the build has
 *    exactly three demon-keyed sources and the recording prices them at +11,4% over the
 *    Humanoide against the engine's +6,6%. Two readings fit every Demônio packet, the
 *    exact critical included: Caminhos da Fé Lv3 applying with the mace despite "apenas
 *    com Soqueira" (+5% on the damage, with "Morto-Vivo" meaning the property as in
 *    Flagelo do Mal — the Neutral-property Morto-Vivo dummy takes nothing extra, as
 *    recorded), or the +17% option scaling more than the weapon part. The file that
 *    separates them: the same character on the Humanoide and Demônio dummies, once with
 *    the mace and once with a knuckle. No equipped item names Demônio; the one skipped
 *    random option is a poison resistance.
 *  - **Veredicto Lv1**: one 5-hit packet on the Demônio, 0,6% above five times the hit.
 *  - Two 4-second windows after a Dragon Combo → Ruína → Garra de Tigre chain read ATQ
 *    Equip. 433 instead of 313, and the four packets inside them run ~7% high; they are
 *    excluded here. Which Sura state that is, the file does not say (no EFST toggles).
 *
 * The second Inquisidor card on the board (a2ZssWk3s5, base 245, 28 packets) is left out:
 * no status window at all, 34 buffs including the five EFST_NOODLE_FES event foods, and the
 * engine 13% under across the same four skills — a lead, not a measurement.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const replay: any = decodeReplay(loadReplayFixture('inq-brand-rotation-13-dummies.rrf'));
const aid = replay.sessionInfo.aid;

/** Typed into the dialog; the file carries no traits (single-map session). */
const TRAITS = { pow: 57, sta: 0, wis: 0, spl: 0, con: 7, crt: 0 };

/** EFSTs up for the whole recording, by the engine's toggle names. */
const ACTIVES: Record<string, number> = {
  'Rising Dragon': 10, // 410, learned Lv10
  'Gentle Touch - Alive': 5, // 427 Chakra do Vigor, learned Lv5
  'Powerful Faith': 5, // 1160 Mantra da Força
  'Total Spirit': 15, // Fogueira hits three times, which needs 11+ spheres
};
const BUFFS: Record<string, number> = { Clementia: 10, Cantocandidus: 10 }; // 10, 12

const SKILLS: Record<number, string> = {
  5244: 'Explosion Blaster==1',
  5245: 'First Brand==4',
  5250: 'Second Judgement==5',
  5252: 'Third Flame Bomb==5',
  5253: 'Third Consecration==1',
};

/** ATQ Equip. jumps 313 → 433 for four seconds after a Sura combo; those packets are out. */
const COMBO_WINDOWS: [number, number][] = [[37_398, 41_403], [155_451, 159_473]];
const inComboWindow = (t: number) => COMBO_WINDOWS.some(([a, b]) => t >= a && t < b);

const DEMON = '21073';

function sim(monster: string, skill: string, passiveOverride: Record<string, number> = {}) {
  const m: any = replayToModel(replay, items).model;
  const cls: any = new Inquisitor();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  }, TRAITS);

  const learned: Record<number, number> = {};
  for (const [id, lv] of replay.learnedSkills) learned[id] = lv;
  const passiveIds = cls.passiveSkills.map((p: any) => {
    if (p.name in passiveOverride) return passiveOverride[p.name];
    const sid = SKILL_ID_BY_NAME[p.name];
    return sid ? learned[sid] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((a: any) => ACTIVES[a.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const buffEquips: Record<string, any> = {};
  const buffMasterys: Record<string, any> = {};
  for (const def of JobBuffs) {
    const v = BUFFS[def.name];
    if (!v) continue;
    const sel = def.dropdown.find((d: any) => d.value === v);
    (def.isMasteryAtk ? buffMasterys : buffEquips)[def.name] = sel.bonus;
  }

  m.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[monster], equipAtks, masteryAtks, buffEquips, buffMasterys, consumeData: [],
    aspdPotion: undefined, extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  const tot: any = calc.getTotalSummary();
  return {
    atkEquip: ((tot.weapon?.baseWeaponAtk ?? 0) + (tot.weapon?.refineBonus ?? 0) + tot.calc.totalEquipAtk) as number,
    pAtk: ds.pAtk as number,
    maxHp: tot.calc.maxHp as number,
    totalHit: ds.skillTotalHit as number,
    min: ds.skillMinDamage as number,
    max: ds.skillMaxDamage as number,
    noCriMin: ds.skillMinDamageNoCri as number | undefined,
    noCriMax: ds.skillMaxDamageNoCri as number | undefined,
    canCri: ds.skillCanCri as boolean,
  };
}

/** The recorder's packets of one skill on one dummy view id, outside the combo windows. */
function packets(skillId: number, view: string): number[] {
  const views = new Map<number, string>();
  for (const e of replay.entities.values()) if (e.kind === 'mob') views.set(e.aid, String(e.view));
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.skillId === skillId && views.get(d.target) === view && !inComboWindow(d.time))
    .map((d: any) => d.damage as number);
}

/** Every dummy the recorder hit, by view id — twelve, Bruto (21069) was never reached. */
const DUMMIES = ['21067', '21068', '21070', '21071', '21072', '21073', '21074', '21075', '21076', '21077', '21078', '21079', '21080'];
const NON_DEMON = DUMMIES.filter((v) => v !== DEMON);

describe('Inquisidor — the brand rotation on thirteen dummies (NQvcAR2gqH)', () => {
  it('imports the build the card describes', () => {
    const { model, summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(16);
    expect(summary.skippedItems).toEqual([]);
    expect(summary.traits).toBeNull();
    expect([model.weapon, model.weaponRefine]).toEqual([16028, 4]);
    expect(replay.equipChanges).toHaveLength(0);
    expect(new Set(packets(5245, '21068')).size).toBeGreaterThan(0);
  });

  it('reproduces P.ATQ and HP máx. from the typed traits; ATQ Equip. is 5 over', () => {
    const r = sim('21068', 'First Brand==4');
    // ZC_PAR_CHANGE at 11,3 s: SP 225 = 37, SP 42 = 313; SP 6 at 9,5 s = 149.376.
    expect(r.pAtk).toBe(37);
    // 891 HP (0,6%) under the window; Dragão Ascendente Lv10's +HP% is the likely edge.
    expect(r.maxHp).toBe(148_485);
    expect(r.atkEquip - 313).toBe(5);
  });

  it('offers every level of the nine Inquisidor attack skills', () => {
    const cls: any = new Inquisitor();
    const withLevels = cls.atkSkills.filter((s: any) => /Brand|Faith|Punish|Judgement|Consecration|Flame|Blaster/.test(s.name));
    expect(withLevels).toHaveLength(9);
    for (const s of withLevels) {
      const max = Number(String(s.value).split('==')[1]);
      expect(s.levelList.map((l: any) => l.value)).toEqual(Array.from({ length: max }, (_, i) => `${s.name}==${i + 1}`));
    }
  });

  it('holds Técnica da Mão Explosiva Lv1: the critical is one number, the rest is the roll', () => {
    let crits = 0;
    let rolls = 0;
    for (const view of NON_DEMON) {
      const r = sim(view, SKILLS[5244]);
      expect(r.canCri).toBe(true);
      for (const p of packets(5244, view)) {
        if (p === 70_649) {
          crits++;
          expect(p / r.max).toBeCloseTo(0.998, 3);
        } else {
          rolls++;
          expect(p).toBeGreaterThanOrEqual(r.noCriMin!);
          expect(p).toBeLessThanOrEqual(r.noCriMax!);
        }
      }
    }
    expect([crits, rolls]).toEqual([8, 16]);
  });

  it.each([
    { name: 'Estigma Lv4', id: 5245, per: 1, n: 22 },
    { name: 'Toque Intercessor Lv5', id: 5250, per: 1, n: 22 },
    { name: 'Fogueira Espiritual Lv5', id: 5252, per: 3, n: 22 },
  ])('brackets every $name packet on the eleven non-Demônio dummies', ({ id, per, n }) => {
    let compared = 0;
    for (const view of NON_DEMON) {
      const r = sim(view, SKILLS[id]);
      expect(r.totalHit).toBe(per);
      for (const p of packets(id, view)) {
        // The engine's ATQ Equip. is 5 over the window (318 vs 313), which lifts its floor
        // ~0,3% above the game's: two packets sit 0,13% and 0,04% under it (Estigma on the
        // Morto-Vivo, Toque on the Inseto). Fogueira's ceiling is grazed by 0,3% once.
        expect(p, `${view}`).toBeGreaterThanOrEqual(r.min * per * 0.996);
        expect(p, `${view}`).toBeLessThanOrEqual(r.max * per * 1.004);
        compared++;
      }
    }
    expect(compared).toBe(n);
  });

  it('pins the Demônio residual: every skill lands 4–6% above the engine there', () => {
    const excess: number[] = [];
    for (const [id, per] of [[5245, 1], [5250, 1], [5252, 3]] as [number, number][]) {
      const r = sim(DEMON, SKILLS[id]);
      const mid = ((r.min + r.max) / 2) * per;
      for (const p of packets(id, DEMON)) excess.push(p / mid);
    }
    expect(excess).toHaveLength(8);
    for (const x of excess) expect(x).toBeGreaterThan(1.03);
    for (const x of excess) expect(x).toBeLessThan(1.07);
  });

  it('Flagelo do Mal Lv10 is worth its +30 mastery ATQ on the Demônio and nothing on the Morto-Vivo', () => {
    // The Sura line never read the race/element mastery keys the passive emits, so Lv10
    // and Lv0 printed the same number until 12/09/2026. Morto-Vivo is Neutral property and
    // the passive's undead half is by element, so it gets nothing there — as recorded.
    const cls: any = new Inquisitor();
    const idx = cls.passiveSkills.findIndex((p: any) => p.name === 'Demon Bane');
    expect(idx).toBeGreaterThanOrEqual(0);
    const withBane = sim(DEMON, SKILLS[5244]).max;
    const without = sim(DEMON, SKILLS[5244], { 'Demon Bane': 0 }).max;
    expect(withBane).toBeGreaterThan(without * 1.01);
    expect(sim('21076', SKILLS[5244]).max).toBe(sim('21076', SKILLS[5244], { 'Demon Bane': 0 }).max);
  });

  it('pins Veredicto Lv1: one 5-hit packet on the Demônio, 0,6% above the simulated ceiling', () => {
    const r = sim(DEMON, SKILLS[5253]);
    expect(r.totalHit).toBe(5);
    const [p] = packets(5253, DEMON);
    expect(p).toBe(269_315);
    expect(p / (r.max * 5)).toBeCloseTo(1.006, 2);
  });
});

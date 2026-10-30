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
import { Cardinal } from './Cardinal';

/**
 * `card-gemini-lumen-autoattack.rrf` — "Ynk Cardinal", Cardeal base 229 / job 46 on
 * tra_fild against the Dummy - Médio, 13/08/2026. Tracker card efDxy9DBTU, credit Ynk.
 * Traits typed by the recorder: POD 100, CRV 14. No status window beyond HP and weight,
 * no ZC_COUPLESTATUS.
 *
 * Ninety seconds of auto-attack with a Bíblia Adulter Fides +9 under Gemini Lumen: 222
 * basic criticals, 62 Magni Lumen and 61 Modi Lumen procs, and 40 Petitio Lv10 autocasts.
 * Thirty-three buffs at the start (Bolinho, Ilimitada, Infinita, Estimulante, the whole
 * Cardeal kit including Competentia, Lauda Agnus/Ramus, Assumptio, Basílica and a
 * Sacramentum); Aspersio goes up at 39,5 s and the recorder's own Oratio Lv10 lands on
 * the dummy at 42,6 s. That gives three clean windows:
 *
 *     A   0–37 s   everything up, Neutral weapon           basic 138.680..143.898 (n=92)
 *     B  43–63 s   Aspersio + Oratio, Lauda buffs gone      basic 152.268..158.413 (n=47)
 *     D  73–91 s   Aspersio, Oratio gone                    basic 133.501..138.501 (n=65)
 *
 * The recorder's ask on the card is a feature: an auto-attack mode where Gemini Lumen and
 * the Petitio autocast count. This file prices what such a mode needs.
 *
 * What the file settled:
 *
 *  - **Lauda Ramus is a crit-damage buff** — "Dano Crítico +5% por nível" — and the
 *    engine had no such buff. A → D loses it and the basic critical falls 3,9%; on this
 *    build's 170% of equipment crit damage that is what Nv2 (+10%) gives, Nv4 would be
 *    7,4%. The buff was up before the recording started, so its level is not in the file;
 *    the JobBuffs entry carries all four levels and the spec uses Nv2.
 *  - **Oratio Lv10 is worth +14,0% here, not +20%**: exactly the −20% on the weapon+equip
 *    share of the ATQ (68%) with nothing on the status ATK. So an endow (Aspersio) gives
 *    the status ATK the element table only, never a target's resistance debuff — the
 *    refinement `calcTotalAtk` carries since this file, on top of the Dragon Knight rule.
 *  - **Petitio autocasts land in the critical range** (8,2..8,5 M against a non-crit
 *    ceiling of 2,7 M) even though every packet is typed "normal" — a skill packet never
 *    carries the critical flag, only the basic attack's does.
 *  - **Flagelo do Mal never reached the Priest line** either: ArchBishop.getMasteryAtk
 *    looked for `x_atk_race_*`, a key nothing emits. Wired; this Formless dummy cannot
 *    price it.
 *
 * Still open:
 *
 *  - The engine sits 1,8–2,6% over the basic critical and Petitio in every window, the
 *    same amount whichever buff is up. Typed traits and no window: the build cannot be
 *    separated from the chain here, so it is pinned as a tolerance.
 *  - **Gemini Lumen's procs are not modelled.** Magni Lumen lands at 0,72× the basic
 *    critical (100.200..105.624 in A) and Modi Lumen at 21.342..28.702; the weapon and
 *    the Elmo carry "+N% de dano de Gemini Lumen" the engine already keys under 2054.
 *  - The pet (Abelha-Rainha, intimacy 965) arrives with view −1 and no egg in the
 *    inventory, so the importer cannot place it; on a boss-class dummy it changes nothing.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_MEDIO = '21065';
const PETITIO = 5283;
const MAGNI_LUMEN = 2055;
const MODI_LUMEN = 2056;

const replay: any = decodeReplay(loadReplayFixture('card-gemini-lumen-autoattack.rrf'));
const aid = replay.sessionInfo.aid;
const dummy = 4389;

const TRAITS = { pow: 100, sta: 0, wis: 0, spl: 0, con: 0, crt: 14 };
const ACTIVES: Record<string, number> = { 'Impositio Manus': 5, Clementia: 14, 'Kyrie Eleison': 10, Assumptio: 5, Magnificat: 5, Laudaagnus: 4 };
const BUFFS_BASE: Record<string, number> = { Cantocandidus: 14, Benedictum: 5, 'Argutus Telum': 5, 'Presens Acies': 5, Competentia: 5 };
const CONSUMABLES = [12883, 14766, 102803, 23475]; // Bolinho, Ilimitada, Estimulante, Infinita

type Window = { from: number; to: number; holy: boolean; buffs: Record<string, number> };
const WINDOWS: Record<string, Window> = {
  A: { from: 0, to: 37_275, holy: false, buffs: { ...BUFFS_BASE, 'Lauda Ramus': 2 } },
  B: { from: 42_608, to: 63_490, holy: true, buffs: { ...BUFFS_BASE, Oratio: 10 } },
  D: { from: 72_719, to: 91_121, holy: true, buffs: BUFFS_BASE },
};

function sim(w: Window, skill = 'Petitio==10') {
  const m: any = replayToModel(replay, items).model;
  const cls: any = new Cardinal();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  }, TRAITS);
  if (w.holy) m.propertyAtk = ElementType.Holy;

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
  const buffMasterys: Record<string, any> = {};
  for (const def of JobBuffs) {
    const v = w.buffs[def.name];
    if (!v) continue;
    const sel = def.dropdown.find((d: any) => d.value === v);
    if (!sel?.isUse) throw new Error(`no ${def.name} at ${v}`);
    (def.isMasteryAtk ? buffMasterys : buffEquips)[def.name] = sel.bonus;
  }

  m.selectedAtkSkill = skill;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MEDIO], equipAtks, masteryAtks, buffEquips, buffMasterys,
    consumeData: CONSUMABLES.map((id) => items[id].script), aspdPotion: m.aspdPotion,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skill, selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;
  return {
    basicCriMin: ds.criMinDamage as number,
    basicCriMax: ds.criMaxDamage as number,
    basicNoCriMax: ds.basicMaxDamage as number,
    skillCriMin: ds.skillMinDamage as number,
    skillCriMax: ds.skillMaxDamage as number,
    skillNoCriMax: ds.skillMaxDamageNoCri as number,
    propertyMultiplier: ds.skillPropertyMultiplier as number,
  };
}

function packets(skillId: number, w: Window): number[] {
  return (replay.damage ?? [])
    .filter((d: any) => d.source === aid && d.target === dummy && d.skillId === skillId && d.time >= w.from && d.time < w.to)
    .map((d: any) => d.damage as number);
}

/** The engine runs 1,8–2,6% high on this file, whichever buff is up — see the header. */
const OVER = 0.97;

describe('Cardeal — auto-attack under Gemini Lumen (efDxy9DBTU)', () => {
  it('imports the build; traits typed, pet unresolved', () => {
    const { summary }: any = replayToModel(replay, items);
    expect(summary.equippedCount).toBe(20);
    expect(summary.skippedItems).toEqual([]);
    expect(summary.traits).toBeNull();
    expect(summary.pet).toBeUndefined();
    expect(replay.pet).toMatchObject({ name: 'Abelha-Rainha', view: -1, intimacy: 965 });
  });

  it('offers Lauda Ramus at its four levels, +5% crit damage each', () => {
    const def = JobBuffs.find((b) => b.name === 'Lauda Ramus')!;
    expect(def.dropdown.filter((d: any) => d.isUse).map((d: any) => [d.value, d.bonus.criDmg])).toEqual([[1, 5], [2, 10], [3, 15], [4, 20]]);
  });

  it.each([
    { name: 'A (Lauda Ramus, Neutral)', key: 'A', basic: 92, petitio: 20 },
    { name: 'B (Aspersio + Oratio)', key: 'B', basic: 47, petitio: 14 },
    { name: 'D (Aspersio alone)', key: 'D', basic: 65, petitio: 5 },
  ])('holds window $name: every basic hit a critical, Petitio in the critical range', ({ key, basic, petitio }) => {
    const w = WINDOWS[key];
    const r = sim(w);
    const hits = packets(0, w);
    expect(hits).toHaveLength(basic);
    for (const p of hits) {
      expect(p).toBeGreaterThan(r.basicNoCriMax);
      expect(p).toBeGreaterThanOrEqual(r.basicCriMin * OVER);
      expect(p).toBeLessThanOrEqual(r.basicCriMax);
    }
    const casts = packets(PETITIO, w);
    expect(casts).toHaveLength(petitio);
    for (const p of casts) {
      expect(p).toBeGreaterThan(r.skillNoCriMax);
      expect(p).toBeGreaterThanOrEqual(r.skillCriMin * OVER);
      expect(p).toBeLessThanOrEqual(r.skillCriMax);
    }
  });

  it('prices Lauda Ramus: A over D is +3,9% recorded, +3,7% simulated at Nv2', () => {
    const rec = Math.max(...packets(0, WINDOWS.A)) / Math.max(...packets(0, WINDOWS.D));
    const eng = sim(WINDOWS.A).basicCriMax / sim(WINDOWS.D).basicCriMax;
    expect(rec).toBeCloseTo(1.039, 2);
    expect(eng).toBeCloseTo(1.037, 2);
  });

  it('prices Oratio Lv10 under Aspersio: +14% recorded, the weapon share of −20% simulated', () => {
    const rec = Math.max(...packets(0, WINDOWS.B)) / Math.max(...packets(0, WINDOWS.D));
    const b = sim(WINDOWS.B);
    const eng = b.basicCriMax / sim(WINDOWS.D).basicCriMax;
    expect(b.propertyMultiplier).toBe(1.2);
    expect(rec).toBeCloseTo(1.144, 2);
    expect(eng).toBeCloseTo(1.142, 2);
  });

  it('records the Gemini Lumen procs the engine does not model', () => {
    const all: Window = { from: 0, to: 99_999, holy: false, buffs: {} };
    expect(packets(MAGNI_LUMEN, all)).toHaveLength(62);
    expect(packets(MODI_LUMEN, all)).toHaveLength(61);
    const magni = packets(MAGNI_LUMEN, WINDOWS.A);
    const crit = Math.max(...packets(0, WINDOWS.A));
    expect(Math.max(...magni) / crit).toBeCloseTo(0.734, 2);
    expect(Math.min(...magni) / crit).toBeCloseTo(0.696, 2);
  });
});

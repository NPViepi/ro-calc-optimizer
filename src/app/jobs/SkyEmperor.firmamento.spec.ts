import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { importReplayBuffer } from 'src/app/replay/replay-to-model';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { SkyEmperor } from './SkyEmperor';

/**
 * Sky Emperor — **Firmamento** (All in the Sky, id 5474) against
 * `fixtures/se-firmamento.rrf`, recorded on tra_fild on 13/08/2026 by Ted ("Ted Uju")
 * and sent through the "Ajude o simulador" dialog (submission VrFeDxBoFM).
 *
 * The recording is deliberately short, and that is exactly why it closes: **no equipment
 * at all** (not even a weapon), so there is no ATK variance and every packet is a
 * deterministic integer. Two packets, against "Dummy - Humanoide" (monster 21070,
 * DemiHuman race, soft DEF 50):
 *
 *   t=2829  basic attack             4,295          count 1  normal
 *   t=7138  Firmamento Lv10      6,576,267          count 3  "double" (NOT a critical)
 *
 * Traits do not travel in the `.rrf`; they came from the submission form: **POW 100,
 * CRT 52**, everything else 0. With the job bonus at job level 50 (POW +11) that is a
 * total POW of 111.
 *
 * **How the three unknowns were separated.** The basic attack hands over the ATK for
 * free: 4,295 + 50 soft DEF = **ATK 4,345**, which is exactly what the engine produces
 * for this character (⌊2,349 × 1.85⌋, Kihop Lv5 over the whole ATK). That leaves only
 * the ratio:
 *
 *   per hit = ⌊ATK × ratio ÷ 100⌋ − 50 = 2,192,089  ->  ratio = 50,452
 *
 * and 50,452 = ⌊21,110 × 239/100⌋, with 21,110 = 2,000×10 + 111×10. No other integer
 * fits. Three modelling decisions follow from that:
 *
 *  - **These are 3 FULL hits, not one split packet.** The sibling skills use `hit`,
 *    where the server splits ONE damage value across N display readings (⌊total÷N⌋×N).
 *    Read that way, the single damage would be ~6.58M and **no integer ratio produces
 *    it**. Since 3 × 2,192,089 is exact, it is `totalHit`. divine-pride agrees: it
 *    labels the table column "ATK per Hit". The race condition only makes sense this
 *    way — against other races it is 1 hit.
 *  - **Sky Mastery does NOT enter.** The description says it does, but that line is
 *    boilerplate repeated across the whole class: Firmamento's client table is the only
 *    one without the "Nv. Maestria" column, which is where the siblings'
 *    `skillLevel × mastery × 5` comes from. With Sky Mastery at 10 in the recording, any
 *    mastery term overshoots the measured integer.
 *  - **The POW coefficient is 10, not 5.** Every sibling uses POW×5 (and caps at level
 *    5); here 21,110 − 20,000 = 1,110 = 111 × 10 exactly. Since only Lv10 has data,
 *    POW×10 and POW×skillLevel are indistinguishable — which is why the picker exposes
 *    only Lv10, and only Lv10 is pinned here.
 *
 * **What this recording does NOT measure** (left open on purpose):
 *  - the critical. The packet is `double`, not `critical` — Ted had Crit 41 and did not
 *    crit. The model mirrors the siblings (full CRIT chance, half crit damage).
 *  - cast/cooldown times. The client's pt-BR block only lists the AP cost (100), and the
 *    external sources disagree with each other and with LATAM even on the ATK per level
 *    (divine-pride 1,450-12,250%, gnjoy TH 5,000-23,000%, LATAM client 2,000-20,000% —
 *    and it is the client table the recording confirms). The skill's acd/fct/vct/cd
 *    fields are guesses and only affect the displayed DPS.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const FIXTURE = 'se-firmamento.rrf';
/** "Dummy - Humanoide" — DemiHuman race, which is what unlocks the 3 hits. */
const TARGET_DEMIHUMAN = '21070';
/** "Dummy - Bruto" — Brute race, to prove non-DemiHuman/Demon targets take 1 hit. */
const TARGET_BRUTE = '21069';

/** Traits reported by the recorder (they do not exist in the `.rrf`). */
const TRAITS = { pow: 100, sta: 0, wis: 0, spl: 0, con: 0, crt: 52 };

const replay: any = decodeReplay(loadReplayFixture(FIXTURE));
const imported: any = importReplayBuffer(loadReplayFixture(FIXTURE), items);

/** The recording's two packets, read from the file instead of retyped. */
const basicPacket = replay.damage.find((d: any) => d.skillId === 0);
const firmamentoPacket = replay.damage.find((d: any) => d.skillId === 5474);

/**
 * Runs the whole chain the way the page does. Skill levels come from the recording's own
 * tree (`learnedSkills`), not from numbers retyped here.
 */
function sim(skillValue: string, opts: { kihop?: number; monsterId?: string } = {}) {
  const learned: Record<number, number> = imported.learnedSkills;
  const { kihop = learned[424], monsterId = TARGET_DEMIHUMAN } = opts;

  const cls = new SkyEmperor();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
    .getSkillBonusAndName();
  learnedSkillMap.set('Sky Mastery', learned[5463]);
  learnedSkillMap.set('War Book Mastery', learned[5464]);
  learnedSkillMap.set('Run', learned[411]);
  if (kihop) learnedSkillMap.set('Power', kihop);

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  const bonus = cls.getJobBonusStatus(imported.model.jobLevel);
  const model: any = createMainModel();
  // Class, levels and base stats all come from the file itself.
  Object.assign(model, {
    class: imported.model.class,
    level: imported.model.level,
    jobLevel: imported.model.jobLevel,
    str: imported.model.str, agi: imported.model.agi, vit: imported.model.vit,
    int: imported.model.int, dex: imported.model.dex, luk: imported.model.luk,
    ...TRAITS,
    jobStr: bonus.str, jobAgi: bonus.agi, jobVit: bonus.vit,
    jobInt: bonus.int, jobDex: bonus.dex, jobLuk: bonus.luk,
    jobPow: bonus.pow, jobSta: bonus.sta, jobWis: bonus.wis,
    jobSpl: bonus.spl, jobCon: bonus.con, jobCrt: bonus.crt,
    selectedAtkSkill: skillValue,
  });
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[monsterId],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const s = (calc as any).damageSummary;
  return {
    perHit: s.skillMaxDamageNoCri || s.skillMaxDamage,
    hits: s.skillTotalHit as number,
    basic: s.basicMaxDamage as number,
  };
}

describe('Sky Emperor — the Firmamento recording', () => {
  it('is the right character: level 239/50, no equipment at all', () => {
    expect(imported.model.class).toBe(4302);
    expect(imported.model.level).toBe(239);
    expect(imported.model.jobLevel).toBe(50);
    expect(imported.summary.equippedCount).toBe(0);
    // Nothing fell outside the DB, so the residual cannot be a missing item.
    expect(imported.summary.skippedItems).toEqual([]);
  });

  it('has Firmamento Lv10, Sky Mastery 10, War Book Mastery 10 and Kihop 5', () => {
    expect(imported.learnedSkills[5474]).toBe(10);
    expect(imported.learnedSkills[5463]).toBe(10);
    expect(imported.learnedSkills[5464]).toBe(10);
    expect(imported.learnedSkills[424]).toBe(5);
  });

  it('carries the two expected packets, and the Firmamento one is not a critical', () => {
    expect(basicPacket.damage).toBe(4295);
    expect(firmamentoPacket.skillLevel).toBe(10);
    expect(firmamentoPacket.damage).toBe(6576267);
    expect(firmamentoPacket.hits).toBe(3);
    // "double" = action 8/9. A critical would be "critical" (action 10/13).
    expect(firmamentoPacket.hitType).toBe('double');
  });
});

describe('Sky Emperor — Firmamento Lv10 vs "Dummy - Humanoide"', () => {
  // 6,576,267 ÷ 3 = 2,192,089 exactly.
  const PER_HIT = 2192089;

  it('deals 2,192,089 per hit across 3 hits — the 6,576,267 packet', () => {
    const r = sim('All in the Sky==10');
    expect(r.perHit).toBe(PER_HIT);
    expect(r.hits).toBe(3);
    expect(r.perHit * r.hits).toBe(firmamentoPacket.damage);
  });

  it('drops to 1 hit outside DemiHuman/Demon, with the same per-hit damage', () => {
    const r = sim('All in the Sky==10', { monsterId: TARGET_BRUTE });
    expect(r.hits).toBe(1);
    expect(r.perHit).toBe(PER_HIT);
  });

  it('reproduces the same recording basic attack, 4,295 — this is what pins ATK 4,345', () => {
    expect(sim('All in the Sky==10').basic).toBe(basicPacket.damage);
  });

  it('breaks without Kihop learned (guard for the passive-skill fix)', () => {
    const r = sim('All in the Sky==10', { kihop: 0 });
    expect(r.perHit).not.toBe(PER_HIT);
    expect(r.basic).not.toBe(basicPacket.damage);
  });
});

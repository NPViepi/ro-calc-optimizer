import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { createMainModel } from 'src/app/utils';
import { importReplayBuffer } from 'src/app/replay/replay-to-model';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { SoulAscetic } from './SoulAscetic';

/**
 * Soul Ascetic — Exorcizar Assombração (SOA_EXORCISM_OF_MALICIOUS_SOUL, 5425) against the
 * first replay this class ever had.
 *
 * It was written with a residual it could not close, and a second recording closed it:
 * `SoulAscetic.exorcism-gear-states.spec.ts` (card DeZJHbAXb2) gears up on camera, so it
 * has the gearless control and the status window this one lacks. What that file settled is
 * folded in below — the soul count, the enhanced branch, and the two MATK terms — and the
 * three cells that used to be open are now one cell that fits.
 *
 * Ground truth: `fixtures/soa-exorcismo.rrf`, submitted through "Ajude o simulador" and
 * triaged as card bVCSkxTfvj. "ShaktiBell", Asceta das Almas base 223 / job 40, recorded
 * on tra_fild against "Dummy - Médio" (mob 21065, Formless, Neutral 1, boss, MDEF 0).
 * 14 seconds, five casts, nothing else: cast Convocar Almas Lv5, cast Exorcizar
 * Assombração Lv5, repeat. Five damage packets, all `count = 5`:
 *
 *   2.866.465   2.806.720   2.533.250   2.620.710   2.711.250
 *
 * **What this recording settles.**
 *
 *  1. *The formula in `SoulAscetic.ts` is right.* browiki.org/wiki/Exorcizar_Assombração
 *     publishes it in full — "Dano = {[(Dano base) + (Nv. de Maestria com Almas x 2)] +
 *     FEI} x Almas Ativas x (Nv. de base / 100)" — which is character-for-character what
 *     the class computes, and its 150%/250% per level reproduce the client's own table
 *     (750% / 1.250% at Lv5). Two independent sources, no divergence: the `[V2]` label the
 *     skill still carries is, for this one skill, not a liability. Asserted below.
 *  2. *The cast window is right.* The recording's ZC_USE_SKILL puts the cast at **824 ms**;
 *     the engine computes 824,3 ms from fct 1,5 + vct 3 and this build's reduction. That
 *     also validates the imported build's DEX, INT and every VCT% piece on it — an exact
 *     match no wrong loadout survives.
 *  3. *The traits are consistent.* The sender reported FEI 92 and nothing else, and 92 is
 *     exactly the whole trait budget at base 223 (7 at 200, +3 per level, +4 every 5th).
 *     The recording itself carries none: it never leaves tra_fild, so no ZC_COUPLESTATUS.
 *
 * **What it cannot settle, and why.** This is a 14-second single-state recording. It has
 * no ZC_PAR_CHANGE for any status field — only HP (5), SP (7) and AP (232) — so the §3
 * cross-check that normally proves the build before a formula is read off it is simply not
 * available, and there is no gearless control and no second buff state to separate the
 * stages (§9). Two inputs to the damage are unobservable in it:
 *
 *   - **the soul count.** Convocar Almas "atinge o limite máximo de Almas", and this
 *     character has Perícia com Almas Lv5 → 20 souls. But every packet carries `count = 5`,
 *     while both bROWiki and the client say "o número de golpes é igual ao número de Almas
 *     consumidas". **Settled by the other recording: it is 20 souls, and `count` is not the
 *     soul count** — that character's gearless window solves to exactly one (souls, MATK)
 *     pair, 20 souls at MATK 866, while its packets also carry `count = 5`.
 *   - **the enhanced branch.** The 250%-per-level column applies if the target carries
 *     Assombração or the caster stands in a Totem de Tutela. Neither leaves a trace here:
 *     no ground unit is created during the recording, and the status stream only ever
 *     carries the *player's* own EFSTs, never the dummy's. **It was live.** Totem de Tutela
 *     is a ground unit that lasts ~30s (bracketed to the second in the other file), so one
 *     placed before a 14-second recording starts leaves nothing in it, and the fit below
 *     picks that cell and no other.
 *
 * **What actually closed the gap**, all of it measured on the other recording:
 *   - the souls pay **no** MATK. bROWiki's Coletar Alma says "Cada Alma concede ATQM +3"
 *     and the Total Soul dropdown booked it as `x_matk: lv * 3`; the gearless window says
 *     otherwise — its equipment MATK never moves as the gauge fills, and its packets solve
 *     to 866, the status window's own 813 + 54 with no room for another 60. Dropped, and
 *     dropping it is what let this recording's floor fall below its lowest packet;
 *   - **Talismã do Mago** (5420 Lv2, EFST 1358, up for the whole recording) was missing from
 *     the class. It is in now, and its S.ATQM +4 is the last 1,7%: the note this file used
 *     to carry — that it made the near-fitting cell *worse* — was written when the engine
 *     was reading 1,7% high, and the sign flipped when the souls' phantom MATK came out;
 *   - the other active EFSTs: 1053/1061 (Coletar Alma and the soul counter), 1356 Talismã
 *     do Protetor and 157 Kaahi (both HP regen — the periodic 10.685 HP heals every 3 s are
 *     Talismã do Protetor), 1059 Espírito do Golem (DEF), and 802/942/983/984/1084/1085,
 *     the play-time and account EXP/drop counters already dismissed in `nw-mastery-gap`;
 *   - Reencarnação das Almas (+7-25% to all damage) and Mandala das Feras (+S.ATQM): both
 *     missing from the class, but neither is in this character's learned tree.
 *
 * That recording is `sa-exorcismo-gear-states.rrf`, which is exactly the file this note
 * asked for: it changes equipment on camera, re-sends the status window at every piece, and
 * carries a gearless window with the totem on and off.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const FIXTURE = 'soa-exorcismo.rrf';
/** "Dummy - Médio" — all five packets hit this one entity (aid 4378). */
const TARGET = '21065';
const BASE_LEVEL = 223;
const JOB_LEVEL = 40;
const SKILL = 'Exorcism of Malicious Soul==5';
/** Trait budget at base 223 is 92, and the sender allocated all of it to FEI. */
const SPL = 92;
const SOUL_MASTERY = 10;
const TALISMAN_MASTERY = 5;
/** Talismã do Mago, learned at Lv2 and up the whole time (EFST 1358). */
const MAGICIAN_TALISMAN = 2;

const replay: any = decodeReplay(loadReplayFixture(FIXTURE));
const imported: any = importReplayBuffer(loadReplayFixture(FIXTURE), items);
const recorded: number[] = (replay.damage ?? []).map((d: any) => d.damage);

/** Full engine run over the imported build, for one (souls, enhanced-branch) pair. */
function sim(souls: number, totem: boolean) {
  const cls: any = new SoulAscetic();
  const passiveLv: Record<string, number> = { 'Soul Mastery': SOUL_MASTERY, 'Talisman Mastery': TALISMAN_MASTERY };
  const activeLv: Record<string, number> = {
    'Total Soul': souls,
    'Totem of Tutelary': totem ? 1 : 0,
    // EFST 1358, running for the whole recording; learned at Lv2, so S.ATQM +4.
    'Talisman of the Magician': MAGICIAN_TALISMAN,
  };
  const passiveIds = cls._passiveSkillList.map((s: any) => passiveLv[s.name] ?? 0);
  const activeIds = cls._activeSkillList.map((s: any) => activeLv[s.name] ?? 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const bonus = cls.getJobBonusStatus(JOB_LEVEL);
  const model: any = createMainModel();
  // The gear is never retyped: `replayToModel` places all 20 pieces, their cards, enchants
  // and the two random options (see §2b of the review-rrf-class skill).
  Object.assign(model, imported.model);
  model.class = 4303;
  model.level = BASE_LEVEL;
  model.jobLevel = JOB_LEVEL;
  // Session snapshot: the allocated stats, before any job bonus.
  model.str = 1; model.agi = 116; model.vit = 100; model.int = 125; model.dex = 125; model.luk = 1;
  model.pow = 0; model.sta = 0; model.wis = 0; model.spl = SPL; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = SKILL;
  const rawOpts: string[] = imported.model.rawOptionTxts ?? [];
  model.rawOptionTxts = rawOpts;

  const calc: any = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[TARGET], equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts(rawOpts),
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: SKILL, selectedChances: [], usedHpL: false,
  } as any);

  const summary = calc.damageSummary;
  const total: any = calc.getTotalSummary();
  return {
    ratio: summary.baseSkillDamage as number,
    min: summary.skillMinDamageNoCri as number,
    max: summary.skillMaxDamageNoCri as number,
    castMs: Math.round(total.calcSkill.castPeriod * 1000),
    maxHp: total.calc.maxHp as number,
    maxSp: total.calc.maxSp as number,
  };
}

describe('Soul Ascetic — the recording itself', () => {
  it('is five Exorcizar Assombração Lv5 casts on one dummy, each packet 5 hits', () => {
    expect(recorded).toEqual([2866465, 2806720, 2533250, 2620710, 2711250]);
    for (const d of replay.damage) {
      expect(d.skillId).toBe(5425);
      expect(d.skillLevel).toBe(5);
      expect(d.hits).toBe(5);
      expect(d.target).toBe(4378);
    }
  });

  it('gathers souls with Convocar Almas Lv5 before every cast', () => {
    const casts = replay.skillUses.filter((s: any) => s.source === replay.sessionInfo.aid);
    expect(casts.map((s: any) => s.skillId)).toEqual([5421, 5425, 5421, 5425, 5421, 5425, 5421, 5425, 5421, 5425]);
  });

  it('carries no status window at all — only HP, SP and AP', () => {
    const sps = [...new Set(replay.paramChanges.map((p: any) => p.type))] as number[];
    expect(sps.sort((a, b) => a - b)).toEqual([5, 7, 232]);
  });

  it('carries no traits (single map, no ZC_COUPLESTATUS) — FEI 92 comes from the card', () => {
    expect(imported.summary.traits).toBe(null);
  });

  it('imports all 20 equipped pieces, nothing outside item.json', () => {
    expect(imported.summary.equippedCount).toBe(20);
    expect(imported.summary.skippedItems).toEqual([]);
    expect(imported.summary.skippedCards).toBe(0);
  });
});

describe('Soul Ascetic — Exorcizar Assombração, what the recording confirms', () => {
  it('cast window matches the recorded 824 ms exactly', () => {
    const cast = replay.skillCasts.find((c: any) => c.skillId === 5425);
    expect(cast.castMs).toBe(824);
    expect(sim(20, false).castMs).toBe(824);
  });

  // browiki.org/wiki/Exorcizar_Assombração and the client's own per-level table both give
  // 150% per level plain and 250% per level enhanced; nv. de base, Maestria com Almas x2
  // and FEI enter as the wiki's formula writes them.
  it('plain branch: (150 x nv + Maestria x 2 + FEI) x Almas x nv. base/100', () => {
    // (150x5 + 10x2 + FEI 111) x 20 x 2,23
    expect(sim(20, false).ratio).toBe(39292);
    expect(sim(5, false).ratio).toBe(9823);
  });

  it('enhanced branch (Assombração / Totem de Tutela): the 150 becomes 250', () => {
    // (250x5 + 10x2 + FEI 111) x 20 x 2,23
    expect(sim(20, true).ratio).toBe(61592);
    expect(sim(5, true).ratio).toBe(15398);
  });
});

describe('Soul Ascetic — Exorcizar Assombração, which cell the packets pick', () => {
  const lo = Math.min(...recorded);
  const hi = Math.max(...recorded);

  /**
   * The four cells of (souls, branch). A cell "fits" only if its simulated range brackets
   * every recorded packet — the engine's min/max are the MATK roll's own bounds, so a
   * packet outside them is impossible, not merely unlikely.
   *
   * Measured, with the build exactly as imported and Talismã do Mago Lv2 up:
   *
   *   souls  branch     simulated range            vs recording
   *    5     plain        403.500 -   462.165      6,2x too low
   *    5     enhanced     632.520 -   724.485      4,0x too low
   *   20     plain      1.614.090 - 1.848.755      1,55x too low
   *   20     enhanced   2.530.170 - 2.898.025      **contains all five packets**
   *
   * One cell out of four, and it contains the recording with 0,1% to spare at the floor.
   * That is the whole answer to the two things this file could not observe: the character
   * had 20 souls, and the Totem de Tutela the packets never mention was standing.
   *
   * It did not fit when this file was written. Three things moved since, all of them
   * measured on `sa-exorcismo-gear-states.rrf`: the souls' phantom +3 MATK apiece came out,
   * Talismã do Mago went in, and Espírito da Fada went in (which this character did not
   * have up, so it changes nothing here).
   */
  it('20 souls in a Totem de Tutela contains every packet', () => {
    const r = sim(20, true);
    expect(r.min).toBe(2530170);
    expect(r.max).toBe(2898025);
    expect(lo).toBeGreaterThanOrEqual(r.min);
    expect(hi).toBeLessThanOrEqual(r.max);
  });

  it('and it is the only cell that does', () => {
    for (const [souls, totem] of [[5, false], [5, true], [20, false]] as [number, boolean][]) {
      const r = sim(souls, totem);
      expect(hi, `${souls} souls, totem=${totem}`).toBeGreaterThan(r.max);
    }
  });

  it('20 souls on the plain branch is still 1,55x low', () => {
    const r = sim(20, false);
    expect(r.min).toBe(1614090);
    expect(r.max).toBe(1848755);
    expect(hi / r.max).toBeCloseTo(1.55, 2);
  });

  it('5 souls — what the packet count says — is nowhere near, on either branch', () => {
    expect(hi / sim(5, false).max).toBeCloseTo(6.2, 1);
    expect(hi / sim(5, true).max).toBeCloseTo(3.96, 2);
  });
});

describe('Soul Ascetic — HP/SP table row (hp_sp_table.json row 56)', () => {
  /**
   * Nothing above depends on this, and the recording proves it on its own: the character
   * sits at 60.398 HP for the whole file (Talismã do Protetor tops it up every 3 s and the
   * value repeats exactly, so it is the cap) with SP peaking at 6.416.
   *
   * The row upstream shipped was a placeholder — baseHp 9.805 at 200 against Soul Reaper's
   * 20.752, and a flat 900 SP across all 51 levels (SoulLinker's max SP at 99) — and the
   * engine got 27.905 HP and 2.864 SP out of it, less than half. Since card
   * vk17UlVbaGo5GlRMnIxb the seven Expanded 4th rows carry rAthena's per-class curve
   * (expanded-fourth-hp-sp-table.spec.ts has the formula). On this build it lands 303 HP
   * (+0,5%) and 234 SP (+3,6%) over the window, with the VIT/INT typed from the card rather
   * than read from the file, so the residual is not attributable to the row alone. The two
   * numbers below are that approximation; they move when the row does.
   */
  it('the recording holds HP 60.398 and SP 6.416 at base 223', () => {
    // ZC_PAR_CHANGE values arrive as BigInt.
    const hp = replay.paramChanges.filter((p: any) => p.type === 5).map((p: any) => Number(p.value));
    const sp = replay.paramChanges.filter((p: any) => p.type === 7).map((p: any) => Number(p.value));
    expect(Math.max(...hp)).toBe(60398);
    expect(Math.max(...sp)).toBe(6416);
  });

  it('the engine gets 60.701 HP and 6.650 SP on the rAthena row — +0,5% and +3,6%', () => {
    const r = sim(20, false);
    expect(r.maxHp).toBe(60701);
    expect(r.maxSp).toBe(6650);
  });

  it('the row sits above the class it evolves from', () => {
    expect(hpSpTable['56'].jobs).toEqual({ SoulAscetic: true });
    expect(hpSpTable['54'].jobs).toEqual({ SoulReaper: true, BabySoulReaper: true });
    expect(hpSpTable['56'].baseHp['200']).toBeGreaterThan(hpSpTable['54'].baseHp['200']);
    // baseSp climbs across the whole 4th-job range instead of sitting at 900.
    expect(new Set(Object.values(hpSpTable['56'].baseSp)).size).toBe(51);
  });
});

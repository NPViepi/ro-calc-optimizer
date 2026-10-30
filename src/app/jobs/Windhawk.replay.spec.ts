import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { Windhawk } from 'src/app/jobs/Windhawk';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { importReplayBuffer } from 'src/app/replay/replay-to-model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';

/**
 * `wh-ilimitar.rrf` — Windhawk level 233/50 hitting the **Dummy - Sombrio**, submitted
 * by Shummuy through the "Ajude o simulador" dialog (submission `pDVbjdvnXT`). The first
 * recording to check this class.
 *
 * It carries two states of the **same equipment**, which is what makes it useful without
 * a gearless recording: the 26 packets split into "no buff" (up to 21.2s) and
 * "Ilimitar 5 + Ventos Sinistros" (EFST 722 and 1252, switched on at 21216 ms and
 * 21227 ms). Two equations, and the difference between them separates a ranged-damage
 * multiplier from a free-standing one.
 *
 * **What the check found.** All three formulas are correct; what was missing was the
 * **Enchant Grade**. Shummuy's Gakkung Primordial-LT is **Grade C**, and without it the
 * imported build lost `atkPercent +3` (Grade D), `pAtk +1` and `range +15` (Grade C) —
 * 12.2% less damage unbuffed and 5.9% less with Ilimitar. That was the "somewhat
 * different damage" he reported.
 *
 * The grade **is** in the file: anyone watching the recording in the client reads
 * "+11 [C] Gakkung Primordial-LT". What was missing was the parser exposing it —
 * rrfparser 1.0.0 started walking the record's TLV chain and brought back tag 299.
 * Nothing here supplies the grade by hand: it comes from the `.rrf` itself, which is why
 * this test also proves the import.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_SOMBRIO = '21084';
/** Traits, collected with the submission — these the replay genuinely does not carry. */
const TALENTOS = { pow: 100, sta: 0, wis: 0, spl: 0, con: 30, crt: 0 };

type Buffs = { ilimitar?: number; ventos?: number };

function simular(skillValue: string, buffs: Buffs = {}) {
  const { model, learnedSkills } = importReplayBuffer(loadReplayFixture('wh-ilimitar.rrf'), items);
  const m: any = model;
  m.class = 4257;
  Object.assign(m, TALENTOS);

  const cls = new Windhawk();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });
  m.selectedAtkSkill = skillValue;

  const passiveIds = cls.passiveSkills.map((s) => {
    const id = SKILL_ID_BY_NAME[s.name];
    return id ? learnedSkills[id] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((s) => {
    if (s.name === 'No Limits') return buffs.ilimitar ?? 0;
    if (s.name === 'Calamity Gale') return buffs.ventos ?? 0;
    return 0;
  });
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_SOMBRIO], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skillValue, selectedChances: [], usedHpL: false,
  } as any);

  const s = (calc as any).damageSummary;
  return {
    golpes: s.skillTotalHit as number,
    critico: s.skillMaxDamage as number,
    /** Critical with the gauge at zero — only meaningful for the stacking skills. */
    semAcumulo: s.noStackMaxCriDamage as number,
    min: (s.skillCanCri ? s.skillMinDamageNoCri : s.skillMinDamage) as number,
    max: (s.skillCanCri ? s.skillMaxDamageNoCri : s.skillMaxDamage) as number,
    podeCritar: !!s.skillCanCri,
  };
}

const ILIMITAR: Buffs = { ilimitar: 5, ventos: 1 };

/**
 * The recording's criticals. A critical uses the weapon's **maximum** ATK, so it is
 * deterministic: each of these numbers repeated identically 3 to 7 times across the
 * packets, which is why the comparison is by equality rather than by range.
 */
describe('Windhawk — the grade comes from the recording itself', () => {
  it('imports the weapon as Grade C, and the rest of the gear ungraded', () => {
    const { model }: any = importReplayBuffer(loadReplayFixture('wh-ilimitar.rrf'), items);
    expect(model.weapon).toBe(700046);
    expect(model.weaponGrade).toBe('C');
    expect([model.headUpperGrade, model.armorGrade, model.garmentGrade]).toEqual(['', '', '']);
  });
});

describe('Windhawk — the recorded criticals, by equality', () => {
  it.each([
    { nome: 'Tiro Preciso Lv5, sem buff', skill: 'Focused Arrow Strike==5', buffs: {}, dano: 1008719, pacotes: 7 },
    { nome: 'Tiro Crescente Lv10 (3 acúmulos), sem buff', skill: 'Crescive Bolt==10', buffs: {}, dano: 2469710, pacotes: 3 },
    { nome: 'Tiro Crescente Lv10 (3 acúmulos), Ilimitar', skill: 'Crescive Bolt==10', buffs: ILIMITAR, dano: 9528458, pacotes: 3 },
    { nome: 'Vendaval de Flechas Lv10, Ilimitar', skill: 'Gale Storm==10', buffs: ILIMITAR, dano: 4855835, pacotes: 2 },
    { nome: 'Tiro Preciso Lv5, Ilimitar', skill: 'Focused Arrow Strike==5', buffs: ILIMITAR, dano: 3243387, pacotes: 5 },
  ])('$nome = $dano ($pacotes pacotes idênticos)', ({ skill, buffs, dano }) => {
    const r = simular(skill, buffs);
    expect(r.podeCritar).toBe(true);
    // Vendaval's `hit: 5` is display only: the whole packet is a single damage hit.
    expect(r.golpes).toBe(1);
    expect(r.critico).toBe(dano);
  });
});

/**
 * Without Ventos Sinistros, Vendaval cannot crit, so the three packets are normal rolls
 * and only give an interval. The range is tight (max/min ≈ 1.06), which stops a wrong
 * percentage slipping through unnoticed inside it.
 */
describe('Windhawk — unbuffed Vendaval falls in the non-crit range', () => {
  const gravados = [721465, 709725, 730005];

  it('cannot crit without Ventos Sinistros', () => {
    expect(simular('Gale Storm==10').podeCritar).toBe(false);
  });

  it.each(gravados)('%i sits inside the simulated range', (dano) => {
    const r = simular('Gale Storm==10');
    expect(dano).toBeGreaterThanOrEqual(r.min);
    expect(dano).toBeLessThanOrEqual(r.max);
  });

  it('keeps the range tight enough for the test to mean something', () => {
    const r = simular('Gale Storm==10');
    expect(r.max / r.min).toBeLessThan(1.12);
  });
});

/**
 * Tiro Crescente stacks up to 3 times, and the recording caught all four states in
 * sequence (12.2s to 17.6s). The simulator hits **both ends to the unit**: with no stacks
 * and at the top. Since the step is constant, that closes all four shots.
 *
 * Beware a misleading calculation: the step (190,020) is **not** 10% of the first shot
 * (189,965). Nothing is left unexplained — the formula's `(1 + 0.1 × stacks)` multiplies
 * the damage before the target's DEF, so it does not scale the packet's final number.
 * Comparing `recorded[0] × 1.1` with `recorded[1]` gives a 0.03% difference that is only
 * the DEF effect, not a missing bonus.
 */
describe('Windhawk — the four Tiro Crescente stacks', () => {
  const porAcumulo = [1899649, 2089669, 2279690, 2469710];

  it('gives 1,899,649 with no stacks, to the unit', () => {
    expect(simular('Crescive Bolt==10').semAcumulo).toBe(porAcumulo[0]);
  });

  it('gives 2,469,710 at 3 stacks, to the unit', () => {
    expect(simular('Crescive Bolt==10').critico).toBe(porAcumulo[3]);
  });

  it('matches the packets\' step with the simulator\'s', () => {
    const r = simular('Crescive Bolt==10');
    const degrauSim = (r.critico - r.semAcumulo) / 3;
    const degrauGravado = (porAcumulo[3] - porAcumulo[0]) / 3;
    expect(degrauSim).toBe(degrauGravado);
    // ...and the middle packets land exactly where that step puts them.
    expect(porAcumulo[1] - porAcumulo[0]).toBe(190020);
    expect(porAcumulo[2] - porAcumulo[1]).toBe(190021);
  });
});

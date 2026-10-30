import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { PetLoyalty } from 'src/app/constants';
import { NightWatch } from 'src/app/jobs/NightWatch';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from './__tests__/load-fixture';
import { importReplayBuffer } from './replay-to-model';

/**
 * **The Night Watch's open residual, measured.**
 *
 * Once the Cesta de Mascotes set was added (see `nw-mira-damage.spec.ts`), a 0.33% to
 * 0.48% difference was left over: the recorded damage is always slightly **higher** than
 * the simulated one. This file fixes nothing — it measures the gap precisely, so the next
 * attempt to explain it has something to validate against.
 *
 * shummuy's three geared recordings use **the same equipment** and differ only in buffs,
 * which gives four multiplier combinations over one build:
 *
 *   nw-mira-pet.rrf   Mira Focalizada (ATK +150, aiming count 10)
 *   nw-ult.rrf        Carta na Manga Lv10 (ranged damage +100%, P.ATK +30), no aim
 *   nw-ult-mira.rrf   both
 *
 * The eight packets used here are **criticals**, and a critical is deterministic: it uses
 * the weapon's maximum ATK, with no variance at all. Each one is an exact equation.
 *
 * **What the measurement says.** The gap is not a percentage: if it were, the
 * recorded/simulated ratio would be the same across all four combinations, and it varies
 * (0.48% with aim only, 0.33% with both). Its size shrinks exactly in proportion to the
 * growth of total ATK — so it is a **fixed value added to ATK**, added **after** the
 * P.ATK multiplier (which is why it shrinks when Carta na Manga comes in, since that only
 * touches P.ATK and range). That is the engine's "mastery ATK" stage (`calcTotalAtk`:
 * `... * pAtkMultiplier + masteryAtk`), and measured there the value is **~30**, the same
 * across all four combinations, both weapons and all three skills.
 *
 * **What has already been ruled out**, each by measurement rather than opinion:
 *   - any percentage bonus (physical damage %, ranged, by size/race/element/class, crit
 *     damage, C.Rate): those would give a constant ratio, and it is not constant;
 *   - equipment ATK and weapon ATK: they pass through the P.ATK multiplier, so the ratio
 *     would also stay constant;
 *   - range: the Carta na Manga recording and the both-buffs one have the same total range
 *     and different residuals;
 *   - POW/CON/STR/DEX/LUK: POW +1 would show in SP_ATK1 (851 against the 846 the packet
 *     carries);
 *   - the pet and the ammo: identical across all five recordings;
 *   - the two cards missing from item.json (310991 "MHP 2Lv" and 29013 "Absorção de HP 3"):
 *     their pt-BR descriptions only give HP;
 *   - a hidden buff: the EFSTs active at the start of the recordings are
 *     802/942/983/984/1084/1085 (play-time and account item/EXP period counters), 695
 *     (equipped-ammo icon) and 1345/1346 (Mira Focalizada itself) — none touches damage.
 *
 * **The control that closes the net**: the **gearless** recording matches exactly
 * (`NightWatch.replay.spec.ts` compares the criticals by equality). What is missing
 * therefore comes from the equipment — and none of the worn pieces has, in its pt-BR
 * description, an ATK line the engine is not already applying.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_MORTO_VIVO = '21076';
/** A piece worn in all three recordings — used as the injection point for the mastery probe. */
const CESTA_DE_MASCOTES = '410599';

const FUZIL = { id: 810005, refine: 0, cards: [] as number[], nome: 'Atirador Consertado +0' };
const PISTOLA = { id: 13115, refine: 7, cards: [] as number[], nome: 'Pistola Aprimorável +7' };

/** Buff states of the three recordings. */
const MIRA = { mira: 1, aim: 10, ult: 0 };
const ULT = { mira: 0, aim: 0, ult: 10 };
const AMBOS = { mira: 1, aim: 10, ult: 10 };

type Caso = {
  nome: string; fixture: string; skill: string;
  arma: typeof FUZIL; buffs: typeof MIRA; gravado: number;
};

/**
 * The eight deterministic criticals. Each value repeats within its recording, which is
 * what proves they are criticals: identical damage on different shots.
 */
const CRITICOS: Caso[] = [
  { nome: 'mira · Disparo Único', fixture: 'nw-mira-pet.rrf', skill: 'Only One Bullet', arma: FUZIL, buffs: MIRA, gravado: 2628657 },
  { nome: 'mira · Atirar em Espiral', fixture: 'nw-mira-pet.rrf', skill: 'Spiral Shooting', arma: FUZIL, buffs: MIRA, gravado: 1954171 },
  { nome: 'mira · Artilharia Pesada', fixture: 'nw-mira-pet.rrf', skill: 'Magazine for One', arma: PISTOLA, buffs: MIRA, gravado: 3674718 / 6 },
  { nome: 'ult · Atirar em Espiral', fixture: 'nw-ult.rrf', skill: 'Spiral Shooting', arma: FUZIL, buffs: ULT, gravado: 1529673 },
  { nome: 'ult · Disparo Único', fixture: 'nw-ult.rrf', skill: 'Only One Bullet', arma: FUZIL, buffs: ULT, gravado: 1579455 },
  { nome: 'ambos · Disparo Único', fixture: 'nw-ult-mira.rrf', skill: 'Only One Bullet', arma: FUZIL, buffs: AMBOS, gravado: 4470524 },
  { nome: 'ambos · Atirar em Espiral', fixture: 'nw-ult-mira.rrf', skill: 'Spiral Shooting', arma: FUZIL, buffs: AMBOS, gravado: 3323434 },
  { nome: 'ambos · Artilharia Pesada', fixture: 'nw-ult-mira.rrf', skill: 'Magazine for One', arma: PISTOLA, buffs: AMBOS, gravado: 6130452 / 6 },
];

function simular(c: Caso, maestriaExtra = 0) {
  const its = maestriaExtra
    ? { ...items, [CESTA_DE_MASCOTES]: { ...items[CESTA_DE_MASCOTES], script: { ...items[CESTA_DE_MASCOTES].script, cannonballAtk: [String(maestriaExtra)] } } }
    : items;

  const { model, learnedSkills } = importReplayBuffer(loadReplayFixture(c.fixture), its);
  const m: any = model;
  m.class = 4306;
  m.pow = 100; m.sta = 0; m.wis = 0; m.spl = 0; m.con = 62; m.crt = 0;
  m.petLoyalty = PetLoyalty.Normal;
  m.weapon = c.arma.id; m.weaponRefine = c.arma.refine;
  m.weaponCard1 = c.arma.cards[0] ?? 0; m.weaponCard2 = c.arma.cards[1] ?? 0;

  const cls = new NightWatch();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });
  const skillValue = `${c.skill}==1`;
  m.selectedAtkSkill = skillValue;

  const passiveIds = cls.passiveSkills.map((s) => {
    const id = SKILL_ID_BY_NAME[s.name];
    return id ? learnedSkills[id] ?? 0 : 0;
  });
  const activeIds = cls.activeSkills.map((s) =>
    s.name === 'Intensive Aim' ? c.buffs.mira
      : s.name === '_NightWatch_Aiming Count' ? c.buffs.aim
        : s.name === 'Hidden Card' ? c.buffs.ult : 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const calc = new Calculator().setMasterItems(its).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MORTO_VIVO], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skillValue, selectedChances: [], usedHpL: false,
  } as any);

  // `skillMaxDamage` is already per hit — so are the recorded values in the table (the
  // packet total divided by its hit count).
  const s = (calc as any).damageSummary;
  return {
    critico: s.skillMaxDamage as number,
    podeCritar: !!s.skillCanCri,
    range: ((calc as any).totalEquipStatus as Record<string, number>)['range'],
  };
}

/** How much mastery ATK would close this case's gap. */
function maestriaNecessaria(c: Caso) {
  const base = simular(c).critico;
  const comSonda = simular(c, 100).critico;
  return (c.gravado - base) / ((comSonda - base) / 100);
}

describe('Night Watch residual — direction and size', () => {
  it.each(CRITICOS)('$nome: recorded exceeds simulated by less than 0.5%', (c) => {
    const r = simular(c);
    expect(r.podeCritar).toBe(true);
    expect(c.gravado).toBeGreaterThan(r.critico);
    expect(c.gravado / r.critico).toBeLessThan(1.005);
  });
});

describe('Night Watch residual — it is not a percentage', () => {
  /**
   * If a percentage bonus were missing (physical, ranged, by size…), the
   * recorded/simulated ratio would be the same across the three recordings, because the
   * equipment is the same. It is not: with Mira Focalizada alone far more is left over
   * than with both active. That difference rules out the whole family of multiplicative
   * bonuses in one go.
   */
  it('drops the ratio when the buffs come in, instead of holding steady', () => {
    const razao = (nome: string) => {
      const c = CRITICOS.find((x) => x.nome === nome)!;
      return c.gravado / simular(c).critico;
    };
    const soMira = razao('mira · Disparo Único');
    const soUlt = razao('ult · Disparo Único');
    const asDuas = razao('ambos · Disparo Único');

    expect(soMira).toBeGreaterThan(soUlt);
    expect(soUlt).toBeGreaterThan(asDuas);
    // The drop is far too large to be rounding: 0.38% -> 0.33% is 1/7 of the gap.
    expect((soMira - 1) / (asDuas - 1)).toBeGreaterThan(1.1);
  });

  /**
   * Nor is it range: Carta na Manga gives "dano físico à distância +100%", so the `ult`
   * and `ult+mira` recordings have the **same** range total. A missing `range` would leave
   * both with the same residual — and their residuals differ.
   */
  it('is not range: same range total, different residuals', () => {
    const ult = CRITICOS.find((c) => c.nome === 'ult · Disparo Único')!;
    const ambos = CRITICOS.find((c) => c.nome === 'ambos · Disparo Único')!;
    expect(simular(ult).range).toBe(simular(ambos).range);
    expect(ult.gravado / simular(ult).critico).toBeGreaterThan(ambos.gravado / simular(ambos).critico);
  });
});

describe('Night Watch residual — ~30 ATK at the mastery stage', () => {
  /**
   * The mastery stage (`calcTotalAtk`: `(status + groups) * pAtkMultiplier +
   * masteryAtk`) is the only one in the engine that sits **outside** the P.ATK multiplier
   * and **inside** the skill percentage. Measured there, the gap gives the same number
   * across all four buff combinations, both weapons and all three skills — which is the
   * signature of a fixed value, and what points at the stage.
   */
  it.each(CRITICOS)('$nome: needs ~30 mastery ATK', (c) => {
    const n = maestriaNecessaria(c);
    expect(n).toBeGreaterThan(29.5);
    expect(n).toBeLessThan(31.5);
  });

  it('has all eight cases agreeing within 4%', () => {
    const ns = CRITICOS.map(maestriaNecessaria);
    expect(Math.max(...ns) / Math.min(...ns)).toBeLessThan(1.04);
  });
});

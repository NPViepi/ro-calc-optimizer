import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { SkyEmperor } from './SkyEmperor';

/**
 * Sky Emperor — second recording, **with a weapon**. This is what separates the two
 * Taekwon-line passives that the first recording could only measure summed together.
 *
 * Source: https://recap.latam-tools.com.br/?r=HdHAKyBShW  (TKtestearma.rrf, recorded by
 * Ted on tra_fild against "Dummy - Neutro", 30/07/2026). Same character as the weaponless
 * recording (SkyEmperor.replay.spec.ts): base level 229, job 46, POW 100 allocated,
 * Maestria Celestial Lv10, Kihop Lv5, Corrida Lv10.
 *
 * Only equipment: **Livro Metálico (1588) +7**, no cards and no random options. Elo
 * Celestial (EFST 1392) is already active from the start, so the four state skills come
 * out at maximum effect, as in the first recording.
 *
 * **Why it settles it.** Corrida only grants its +100 ATK bare-handed; Kihop always
 * applies. Weaponless the two add up and are indistinguishable from a single factor; with
 * a weapon only Kihop is left:
 *
 *   weaponless   ⌊(2,167 + 100) × 1.85⌋ = 4,193   (the ATK the packets demand, exactly)
 *   with weapon  ⌊[2,422..2,462] × 1.85⌋ = 4,480..4,555
 *
 * A single 1.935 factor (what the first recording alone suggested) would give 4,686..4,763
 * with a weapon, and a single flat value would give 4,448..4,488 — both fall outside the
 * packets.
 *
 * Because the weapon has ATK variance, each packet is a different roll and the test is one
 * of **containment**: every observed damage has to sit between the simulator's minimum and
 * maximum. That is stronger than it sounds — the reachable values form a sparse set (41
 * possible ATK values across a span of 75 integers), and all 52 distinct damage values in
 * the recording land inside it.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

/** "Dummy - Neutro" (view 21077), the recording's target. */
const DUMMY_NEUTRO = '21077';
const LIVRO_METALICO = 1588;
const REFINO = 7;
const CELESTIAL_UNITY = 7;

function faixaDe(skillValue: string, opts: { comArma?: boolean; space?: number } = {}) {
  const { comArma = true, space = CELESTIAL_UNITY } = opts;
  const cls = new SkyEmperor();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap, usedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
    .getSkillBonusAndName();
  learnedSkillMap.set('Sky Mastery', 10);
  learnedSkillMap.set('Run', 10);
  // Kihop is passive: it comes from the learned level, not the active-skills tab.
  learnedSkillMap.set('Power', 5);
  activeSkillNames.add('_SkyEmperor_Celestial_Space');
  usedSkillMap.set('_SkyEmperor_Celestial_Space', space);

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  const bonus = cls.getJobBonusStatus(46);
  const model: any = createMainModel();
  model.class = 4302;
  model.level = 229;
  model.jobLevel = 46;
  model.str = 120; model.agi = 1; model.vit = 120; model.int = 50; model.dex = 100; model.luk = 120;
  model.pow = 100; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  if (comArma) { model.weapon = LIVRO_METALICO; model.weaponRefine = REFINO; }
  model.selectedAtkSkill = skillValue;
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_NEUTRO],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const s = (calc as any).damageSummary;
  return { min: s.skillMinDamage as number, max: s.skillMaxDamage as number };
}

/**
 * Distinct NON-critical damage values observed, per skill. Entardecer and Explosão
 * Crepuscular do crit under Elo Celestial, so their non-crit is measured in a Celestial
 * Space where they cannot crit (`espacoSemCrit`) — the ratio is the same.
 */
const PACOTES: { nome: string; skill: string; danos: number[]; espacoSemCrit?: number }[] = [
  { nome: 'Entardecer Nv.5', skill: 'Noon Blast==5', espacoSemCrit: 1 /* Nascer do Sol */, danos: [698748, 699682, 702794] },
  {
    nome: 'Explosão Crepuscular Nv.5', skill: 'Sunset Blast==5', espacoSemCrit: 2 /* Meio-Dia */,
    danos: [328804, 329242, 329754, 330852, 330998, 331218],
  },
  { nome: 'Chute Meia-Lua Nv.5', skill: 'Midnight Kick==5', danos: [854914, 855484, 857004, 861562] },
  { nome: 'Alvorada Nv.5', skill: 'Dawn Break==5', danos: [422008, 423320, 424070, 424728] },
  { nome: 'Constelação Nv.1', skill: 'Twinkling Galaxy==1', danos: [98433, 98478, 98631, 98718, 98763, 98871, 99156, 99201, 99246] },
  {
    nome: 'Colapso Estelar Nv.5', skill: 'Star Burst==5',
    danos: [316666, 317160, 317724, 318076, 318216, 318358, 318780, 318992, 319556, 320330, 320612, 320682],
  },
  {
    nome: 'Explosão Galática Nv.5', skill: 'Star Cannon==5',
    danos: [359682, 360243, 360885, 361044, 361443, 361605, 361923, 362325, 362484, 363204, 363525, 363684, 364164, 364245],
  },
];

describe('Sky Emperor — damage with Livro Metálico +7 vs "Dummy - Neutro"', () => {
  it.each(PACOTES)('$nome: all $danos.length recorded values fall in the simulator range', ({ skill, danos, espacoSemCrit }) => {
    const { min, max } = faixaDe(skill, espacoSemCrit ? { space: espacoSemCrit } : {});
    for (const d of danos) {
      expect(d, `${d} outside [${min}, ${max}]`).toBeGreaterThanOrEqual(min);
      expect(d, `${d} outside [${min}, ${max}]`).toBeLessThanOrEqual(max);
    }
  });

  // The recording's criticals, under Elo Celestial, with the same 1.42 multiplier.
  it.each([
    { nome: 'Entardecer Nv.5', skill: 'Noon Blast==5', danos: [1000398, 1004596] },
    { nome: 'Explosão Crepuscular Nv.5', skill: 'Sunset Blast==5', danos: [469808] },
  ])('$nome: the criticals fall in the simulator range', ({ skill, danos }) => {
    const { min, max } = faixaDe(skill);
    for (const d of danos) {
      expect(d, `${d} outside [${min}, ${max}]`).toBeGreaterThanOrEqual(min);
      expect(d, `${d} outside [${min}, ${max}]`).toBeLessThanOrEqual(max);
    }
  });

  // Without this guard the containment test would pass with too wide a range.
  it('keeps the range tight: the observed extremes touch the simulator\'s', () => {
    const { min, max } = faixaDe('Star Cannon==5');
    const obs = PACOTES.find((p) => p.skill === 'Star Cannon==5')!.danos;
    expect(max - min).toBeLessThan(0.02 * max); // weapon variance, ~1.7%
    expect(Math.min(...obs) - min).toBeLessThan(0.005 * max);
    expect(max - Math.max(...obs)).toBeLessThan(0.005 * max);
  });

  it('does not count Corrida with a weapon in hand — the same build bare-handed gives more ATK per hit', () => {
    // Bare-handed the ATK is 4,193 (fixed); armed the range is 4,480..4,555. Corrida's
    // +100 only applies bare-handed, so the weapon has to raise it LESS than it would if
    // that +100 counted.
    const comArma = faixaDe('Star Cannon==5');
    const semArma = faixaDe('Star Cannon==5', { comArma: false });
    expect(semArma.min).toBe(semArma.max); // weaponless there is no variance
    expect(semArma.max).toBe(335514); // the same number as the first recording
    expect(comArma.max).toBeGreaterThan(semArma.max);
  });
});

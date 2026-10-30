import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { AtkSkillModel } from './_character-base.abstract';
import { SkyEmperor } from './SkyEmperor';

/**
 * Sky Emperor — skill ratios validated against an in-game LATAM recording.
 *
 * Source: https://recap.latam-tools.com.br/?r=ghbGkHpHjy  (MestreCelestialSemArma.rrf,
 * recorded by Ted on tra_fild against "Dummy - Amorfo", 30/07/2026).
 *
 * The recording is **weaponless and with no equipment at all** — no weapon ATK variance,
 * so every packet repeats the same integer. None of the EFSTs active at the start affect
 * damage (Armazém, DROP/EXP bonuses, Manual de Mascar).
 *
 * Character state (session snapshot + the traits Ted confirmed):
 *
 *   base level 229, job level 46, class 4302 (Sky Emperor)
 *   base stats STR 120, AGI 1, VIT 120, INT 50, DEX 100, LUK 120
 *   traits     POW 100 allocated; STA/WIS/SPL/CON/CRT 0 allocated
 *   Maestria Celestial Lv10 (ZC_SKILLINFO_LIST)
 *
 * At t=22.8 s the character uses Elo Celestial; the [União Celestial] state (EFST 1392)
 * stays active to the end, and it is under that state that Entardecer, Explosão
 * Crepuscular, Chute Meia-Lua and Alvorada were used.
 *
 * Damage packets (`div` = hits in the packet, damage is the total across them):
 *
 *   5473 Explosão Galática Nv.5    335.514 × 86        div 3
 *   5469 Chute Meia-Lua    Nv.5    796.410 × 3         div 2
 *   5470 Alvorada          Nv.5    393.126 × 3         div 2
 *   5466 Entardecer        Nv.5    652.380 × 4  /  926.378 × 3 (crítico)   div 2
 *   5467 Explosão Crepuscular Nv.5 306.708 × 6  /  435.526 × 4 (crítico)   div 2
 *   5471 Constelação       Nv.1     91.818 × 4         div 3
 *   (ataque básico crítico: 5.883, div 1)
 *
 * **How the ratios below were measured.** Damage follows
 *   damage = ⌊ATK × ratio ÷ 100⌋ − soft DEF 50, then split as ⌊total÷div⌋ × div.
 * With six equations and necessarily integer ratios, (ATK, ratio) has a unique solution
 * over an ATK sweep from 200 to 60,000: **ATK 4,193** and the six ratios asserted here.
 * The basic attack closes it from the outside: ⌊(4,193 − 50) × 1.42⌋ = 5,883 ✓ (1.42 =
 * 1.40 base + C.Rate 2%, from the job bonus's CRT 6). The ratios match the client's pt-BR
 * description exactly (see src/app/skills) and browiki.org — the Sigma blog tables ("V2"),
 * which this class used to use, are out of date for LATAM.
 *
 * **Where ATK 4,193 comes from.** Status ATK 797 (the recording's own snapshot, and the
 * in-game stats window) × 2 × P.ATK 36% = 2,167. Then two Taekwon-line passives are added,
 * in this order:
 *
 *   Corrida Lv10  +100 ATK, **bare-handed only**        ->  2,267
 *   Kihop Lv5     +85% over the whole ATK               ->  ⌊2,267 × 1.85⌋ = 4,193
 *
 * The second recording, with a weapon, is what separates the two: there Corrida's +100
 * disappears and Kihop alone explains the numbers (see SkyEmperor.replay-arma.spec.ts).
 * Kihop was already in the engine (StarEmperor.modifyFinalAtk, `powerLv × 15 + 10` = 85
 * at Lv5); Corrida was the missing one, and went in as mastery ATK in
 * Taekwondo.getMasteryAtk.
 */

const BASE_LEVEL = 229;
/** POW 100 allocated + 9 from the trait bonus at job level 46. */
const TOTAL_POW = 109;
const SKY_MASTERY = 10;

/** Elo Celestial — see CelestialSpace in SkyEmperor.ts. */
const CELESTIAL_UNITY = 7;

const sky = (celestialSpace = 0): SkyEmperor => {
  const c = new SkyEmperor();
  (c as any).bonuses = {
    activeSkillNames: new Set<string>(celestialSpace ? ['_SkyEmperor_Celestial_Space'] : []),
    equipAtks: {},
    masteryAtks: {},
    learnedSkillMap: new Map<string, number>([['Sky Mastery', SKY_MASTERY]]),
    usedSkillMap: new Map<string, number>(celestialSpace ? [['_SkyEmperor_Celestial_Space', celestialSpace]] : []),
  };
  return c;
};

const findSkill = (char: SkyEmperor, name: string): AtkSkillModel => {
  const skill = char.atkSkills.find((s) => s.name === name);
  if (!skill) throw new Error(`skill not found: ${name}`);
  return skill;
};

/** The ratio as the server uses it: plain Math.floor (int cast), not the repo floor. */
const ratioOf = (char: SkyEmperor, name: string, skillLevel: number) =>
  Math.floor(
    findSkill(char, name).formula({
      model: { level: BASE_LEVEL },
      skillLevel,
      status: { totalPow: TOTAL_POW },
    } as any),
  );

const canCriOf = (char: SkyEmperor, name: string) => (findSkill(char, name).canCri as () => boolean)();

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

/** "Dummy - Amorfo", the weaponless recording's target. */
const DUMMY_AMORFO = '21067';

/**
 * Runs the whole chain, the way the page does. `corrida`/`kihop` exist for the test that
 * shows ATK only closes with both passives active.
 */
function danoDe(
  skillValue: string,
  opts: { corrida?: number; kihop?: number; weapon?: number; refine?: number; monsterId?: string; space?: number } = {},
) {
  const { corrida = 10, kihop = 5, weapon, refine, monsterId = DUMMY_AMORFO, space = CELESTIAL_UNITY } = opts;
  const cls = new SkyEmperor();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap, usedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
    .getSkillBonusAndName();
  learnedSkillMap.set('Sky Mastery', SKY_MASTERY);
  if (corrida) learnedSkillMap.set('Run', corrida);
  // Kihop is passive: it comes from the learned level, not the active-skills tab.
  if (kihop) learnedSkillMap.set('Power', kihop);
  activeSkillNames.add('_SkyEmperor_Celestial_Space');
  usedSkillMap.set('_SkyEmperor_Celestial_Space', space);

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  const bonus = cls.getJobBonusStatus(46);
  const model: any = createMainModel();
  model.class = 4302;
  model.level = BASE_LEVEL;
  model.jobLevel = 46;
  model.str = 120; model.agi = 1; model.vit = 120; model.int = 50; model.dex = 100; model.luk = 120;
  model.pow = 100; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 0; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  if (weapon) { model.weapon = weapon; model.weaponRefine = refine; }
  model.selectedAtkSkill = skillValue;
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
  return { max: s.skillMaxDamage as number, min: s.skillMinDamage as number, noCri: s.skillMaxDamageNoCri as number };
}

describe('Sky Emperor — ratios measured in the recording (Elo Celestial active)', () => {
  it('Entardecer Lv5 → 15560', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Noon Blast', 5)).toBe(15560);
  });

  it('Explosão Crepuscular Lv5 → 7316', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Sunset Blast', 5)).toBe(7316);
  });

  it('Chute Meia-Lua Lv5 → 18995 (uses the Meia-Noite value)', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Midnight Kick', 5)).toBe(18995);
  });

  it('Alvorada Lv5 → 9377 (uses the Pôr da Lua value)', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Dawn Break', 5)).toBe(9377);
  });

  it('Constelação Lv1 → 2191', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Twinkling Galaxy', 1)).toBe(2191);
  });

  it('Explosão Galática Lv5 → 8003', () => {
    expect(ratioOf(sky(CELESTIAL_UNITY), 'Star Cannon', 5)).toBe(8003);
  });
});

/**
 * The Sigma blog's "Sky Emperor (3rd version)" tables (Feb 2026) do **not** describe
 * LATAM: no ATK between 1 and 60,000, at any soft DEF (0 to 126), reproduces the six
 * packets with them. They would give Entardecer 19,797 / Crepuscular 8,576 / Meia-Lua
 * 21,972 / Alvorada 9,606 / Constelação 2,649 / Galática 8,690. If that version ever
 * reaches LATAM, this spec is what will catch it.
 *
 * The V3 post does confirm two things worth keeping: the hits per packet ("1 hit, dmg
 * displayed 2 times" on the four state skills; 3 times on Constelação and Explosão
 * Galática), and that the crit chance is the user's FULL CRIT — not half, as the client's
 * pt-BR translation says. The recording agrees with full CRIT: 7 criticals in 17 casts
 * (41%) at Crit 40 on the panel; at half (20%), P(X>=7) would be 3.8%.
 */
describe('Sky Emperor — hits per packet, matching the recording `div`', () => {
  const cases: { name: string; hit: number }[] = [
    { name: 'Noon Blast', hit: 2 },
    { name: 'Sunset Blast', hit: 2 },
    { name: 'Midnight Kick', hit: 2 },
    { name: 'Dawn Break', hit: 2 },
    { name: 'Twinkling Galaxy', hit: 3 },
    { name: 'Star Cannon', hit: 3 },
  ];

  it.each(cases)('$name splits into $hit hits', ({ name, hit }) => {
    expect(findSkill(sky(), name).hit).toBe(hit);
  });
});

describe('Sky Emperor — Elo Celestial unlocks the maximum effect', () => {
  // Entardecer and Explosão Crepuscular only crit in their own state; in the recording
  // both crit under Elo Celestial, with no Amanhecer in between.
  it('lets Entardecer crit at Meio-Dia and under Elo Celestial', () => {
    expect(canCriOf(sky(2), 'Noon Blast')).toBe(true);
    expect(canCriOf(sky(CELESTIAL_UNITY), 'Noon Blast')).toBe(true);
    expect(canCriOf(sky(1), 'Noon Blast')).toBe(false);
  });

  it('lets Explosão Crepuscular crit at Pôr do Sol and under Elo Celestial', () => {
    expect(canCriOf(sky(3), 'Sunset Blast')).toBe(true);
    expect(canCriOf(sky(CELESTIAL_UNITY), 'Sunset Blast')).toBe(true);
    expect(canCriOf(sky(2), 'Sunset Blast')).toBe(false);
  });

  it('drops Chute Meia-Lua to its normal value outside Meia-Noite/Elo Celestial', () => {
    expect(ratioOf(sky(4), 'Midnight Kick', 5)).toBe(
      Math.floor((500 + 5 * (1000 + SKY_MASTERY * 5) + TOTAL_POW * 5) * (BASE_LEVEL / 100)),
    );
  });

  it('drops Alvorada to its normal value outside Pôr da Lua/Elo Celestial', () => {
    expect(ratioOf(sky(5), 'Dawn Break', 5)).toBe(
      Math.floor((300 + 5 * (400 + SKY_MASTERY * 5) + TOTAL_POW * 5) * (BASE_LEVEL / 100)),
    );
  });
});

/**
 * The twelve bonuses below come from the "Atributos"/"Talentos" window of the SAME
 * character, at the same job level (screenshot sent by Ted): STR 120+12, AGI 1+10,
 * VIT 120+6, INT 50+3, DEX 100+9, LUK 120+3 / POW 100+9, STA 0+7, WIS 0+1, SPL 0, CON 0+4,
 * CRT 0+6. They match, one by one, the per-level table at irowiki.org/wiki/Sky_Emperor.
 * The recording confirms POW 9 by a third route: the snapshot's status ATK (797) and the
 * six ratios only close at total POW 109 — 100 allocated + 9 from the bonus.
 *
 * It was this screenshot that caught the trait table's STA column being wrong (it gave 12
 * at job level 46).
 */
describe('Sky Emperor — job/trait bonus at job level 46', () => {
  const bonus = new SkyEmperor().getJobBonusStatus(46);

  it('job bonus → STR 12 / AGI 10 / VIT 6 / INT 3 / DEX 9 / LUK 3', () => {
    expect([bonus.str, bonus.agi, bonus.vit, bonus.int, bonus.dex, bonus.luk]).toEqual([12, 10, 6, 3, 9, 3]);
  });

  it('trait bonus → POW 9 / STA 7 / WIS 1 / SPL 0 / CON 4 / CRT 6', () => {
    expect([bonus.pow, bonus.sta, bonus.wis, bonus.spl, bonus.con, bonus.crt]).toEqual([9, 7, 1, 0, 4, 6]);
  });

  it('gives P.ATK 36 and C.Rate 2, as the Talentos window shows', () => {
    // P.ATK = ⌊POW 109 / 3⌋ + ⌊CON 4 / 5⌋ = 36;  C.Rate = ⌊CRT 6 / 3⌋ = 2.
    // That C.Rate 2 is what produces the 1.42 crit multiplier measured in the recording.
    const totalPow = 100 + bonus.pow;
    const totalCon = 0 + bonus.con;
    const totalCrt = 0 + bonus.crt;
    expect(Math.floor(totalPow / 3) + Math.floor(totalCon / 5)).toBe(36);
    expect(Math.floor(totalCrt / 3)).toBe(2);
  });
});

/**
 * Absolute damage, end to end: the same chain the page uses (class + model + target)
 * against the recording's packets. This block is what pins ATK 4,193 and, with it, the two
 * Taekwon-line passives that produce it — Corrida Lv10 (+100, bare-handed) and Kihop Lv5
 * (+85%).
 */
describe('Sky Emperor — absolute damage vs "Dummy - Amorfo", weaponless recording', () => {
  // `skillMaxDamageNoCri` deliberately skips the hit split (engine convention, see
  // damage-calculator.ts), so the non-crit is measured in a Celestial Space where the
  // skill cannot crit — which is exactly the packets' non-crit number.
  const SEM_CRIT = { Entardecer: 1 /* Nascer do Sol */, Crepuscular: 2 /* Meio-Dia */ };
  const casos: { nome: string; skill: string; dano: number; espacoSemCrit?: number; cri?: number }[] = [
    { nome: 'Explosão Galática Nv.5', skill: 'Star Cannon==5', dano: 335514 },
    { nome: 'Chute Meia-Lua Nv.5', skill: 'Midnight Kick==5', dano: 796410 },
    { nome: 'Alvorada Nv.5', skill: 'Dawn Break==5', dano: 393126 },
    { nome: 'Constelação Nv.1', skill: 'Twinkling Galaxy==1', dano: 91818 },
    { nome: 'Entardecer Nv.5', skill: 'Noon Blast==5', dano: 652380, espacoSemCrit: SEM_CRIT.Entardecer, cri: 926378 },
    { nome: 'Explosão Crepuscular Nv.5', skill: 'Sunset Blast==5', dano: 306708, espacoSemCrit: SEM_CRIT.Crepuscular, cri: 435526 },
  ];

  it.each(casos)('$nome → $dano', ({ skill, dano, espacoSemCrit, cri }) => {
    expect(danoDe(skill, espacoSemCrit ? { space: espacoSemCrit } : {}).max).toBe(dano);
    if (cri !== undefined) expect(danoDe(skill).max).toBe(cri);
  });

  it('produces ATK 4,193 from both passives together — removing either one breaks it', () => {
    const comAmbas = danoDe('Star Cannon==5');
    const semCorrida = danoDe('Star Cannon==5', { corrida: 0 });
    const semKihop = danoDe('Star Cannon==5', { kihop: 0 });
    expect(comAmbas.max).toBe(335514);
    expect(semCorrida.max).not.toBe(335514);
    expect(semKihop.max).not.toBe(335514);
  });
});

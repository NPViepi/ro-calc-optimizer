import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { PetLoyalty } from 'src/app/constants';
import { createMainModel } from 'src/app/utils';
import { NightWatch } from './NightWatch';

/**
 * Night Watch — the per-level percentages of the weapon and grenade skills, checked
 * against five LATAM recordings made by shummuy on 31/07/2026 on tra_fild, against
 * "Dummy - Morto-Vivo" (monster 21076, Undead race, Neutral 1 element):
 *
 *   Armas + Ataque Basico + Skill.rrf   no equipment beyond the weapon and the ammo
 *   Armas + Ult.rrf                     geared, Carta na Manga Lv10
 *   Armas + Mira.rrf                    geared, Mira Focalizada
 *   Armas + Ult + Mira.rrf              geared, both
 *   Granadas Skill.rrf                  grenades, partial gear
 *
 * Character (session snapshot + the traits shummuy confirmed):
 *   base level 241, job level 50, class 4306
 *   STR 83  AGI 100  VIT 100  INT 100  DEX 120  LUK 100
 *   POW 100  CON 62  (STA/WIS/SPL/CRT all zero)
 *   A.D.P Lv10 and Perícia em Granada Lv10; **every attack skill at Lv1** (that is what
 *   the 0x01de packets carry in the level field, and what shummuy reported: "Ultimate
 *   estava no nv 10, e as duas passivas tbm o resto, tudo nv1").
 *
 * The five recordings swap weapons partway, one per segment, and each weapon exercises
 * exactly the skills it enables — that is what separates each skill's two formulas. Only
 * the gearless recording drives the end-to-end damage test; there the simulator matches
 * the criticals **exactly**. The other three still carry a ~3.6% residual that comes from
 * neither the skills nor the pet, and is being investigated on the equipment side.
 *
 * What they proved: the `[V2]` tables (Sigma blog) were wrong on six of the seven skills.
 * The correct ones are the client description's, and the gearless recording confirms all
 * of them.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

/** "Dummy - Morto-Vivo" — the target of all five recordings. */
const DUMMY_MORTO_VIVO = '21076';
const NIVEL_BASE = 241;
const NIVEL_CLASSE = 50;
/** Total CON = 62 allocated + 9 from the job bonus + 10 from Perícia em Granada. */
const CON_TOTAL = 81;
/** The recordings' ammo: Projétil de Purificação (Holy, ATK 40) — vs Neutral, ×1. */
const MUNICAO = 13220;
/**
 * The pet is out in all five recordings (entity 18010, "Orc Herói"), and shummuy
 * confirmed its loyalty tier. It is not equipment — it shows up neither in the inventory
 * nor in the packets' equip ATK — but its bonus is ATK +4% and crit damage +1%, and it is
 * what makes this recording's criticals land exactly. Without it the simulator sits 1.62%
 * low.
 */
const OVO_ORC_HEROI = 9121;
const LEALDADE = PetLoyalty.Normal;

/** The segments' weapons, with the refine and cards the recordings show. */
const ARMAS = {
  fuzil: { id: 810005, refine: 0, cards: [] as number[] },            // Atirador Consertado
  metralhadora: { id: 830008, refine: 0, cards: [] as number[] },     // Aspersor Consertado
  escopeta: { id: 820004, refine: 8, cards: [4115, 4115] },           // Retalhador Consertado
  lancaGranadas: { id: 840001, refine: 8, cards: [300241, 300240] },  // Lança-Granadas Primordial
  pistola: { id: 13115, refine: 7, cards: [] as number[] },           // Pistola Aprimorável
} as const;
type Arma = typeof ARMAS[keyof typeof ARMAS];

function simular(skillName: string, level: number, arma: Arma, aim = 0, opts: { semMascote?: boolean } = {}) {
  const cls = new NightWatch();

  // A.D.P and Perícia em Granada at Lv10; no active skill beyond the aiming count, which
  // the gearless recording never uses (Mira Focalizada is never switched on there).
  const passiveIds = cls.passiveSkills.map((s) => (s.name === 'PFI' || s.name === 'Grenade Mastery' ? 10 : 0));
  const activeIds = cls.activeSkills.map((s) => (s.name === '_NightWatch_Aiming Count' ? aim : 0));
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const bonus = cls.getJobBonusStatus(NIVEL_CLASSE);
  const model: any = createMainModel();
  model.class = 4306;
  model.level = NIVEL_BASE;
  model.jobLevel = NIVEL_CLASSE;
  model.str = 83; model.agi = 100; model.vit = 100; model.int = 100; model.dex = 120; model.luk = 100;
  model.pow = 100; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 62; model.crt = 0;
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  if (!opts.semMascote) {
    model.pet = OVO_ORC_HEROI;
    model.petLoyalty = LEALDADE;
  }
  model.weapon = arma.id;
  model.weaponRefine = arma.refine;
  model.weaponCard1 = arma.cards[0] ?? 0;
  model.weaponCard2 = arma.cards[1] ?? 0;
  model.ammo = MUNICAO;

  const skillValue = `${skillName}==${level}`;
  model.selectedAtkSkill = skillValue;

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MORTO_VIVO],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const s = (calc as any).damageSummary;
  const podeCritar = !!s.skillCanCri;
  const total: any = calc.getTotalSummary();
  return {
    /** the client status window's "ATQ Equip." (SP_ATK2): weapon + refine + gear */
    atkEquip: (total.weapon?.baseWeaponAtk ?? 0) + (total.weapon?.refineBonus ?? 0) + total.calc.totalEquipAtk,
    /** the left-hand "ATQ" in the status window (SP_ATK1) */
    atkStatus: total.calc.totalStatusAtk as number,
    /** the status window's "Crítico" (SP_CRITICAL) */
    criticoBase: total.calc.totalCri as number,
    /** the skill percentage, per hit, already truncated by the engine */
    razao: s.baseSkillDamage as number,
    golpes: s.skillTotalHit as number,
    podeCritar,
    min: (podeCritar ? s.skillMinDamageNoCri : s.skillMinDamage) as number,
    max: (podeCritar ? s.skillMaxDamageNoCri : s.skillMaxDamage) as number,
    critico: (podeCritar ? s.skillMaxDamage : 0) as number,
  };
}

/**
 * The **client description** tables (skill-meta.generated.ts), transcribed level by
 * level. `atk[i]` is the Lv i+1 percentage at aiming count 0, and `mira[i]` is how much
 * each count point adds at that level. The CON term does not appear in the description
 * ("Damage is additionally increased ... according to ... CON") — that coefficient is the
 * one the recordings measured, and the next test is what pins it.
 */
const TABELA_DO_CLIENTE: { skill: string; arma: Arma; atk: number[]; mira: number[]; con: number }[] = [
  // Vigília Noturna — the only one already correct before these recordings.
  { skill: 'The Vigilante at Night', arma: ARMAS.metralhadora, atk: [300, 600, 900, 1200, 1500], mira: [100, 200, 300, 400, 500], con: 2 },
  { skill: 'The Vigilante at Night', arma: ARMAS.escopeta, atk: [1500, 2200, 2900, 3600, 4300], mira: [200, 400, 600, 800, 1000], con: 3 },
  { skill: 'Only One Bullet', arma: ARMAS.fuzil, atk: [1350, 2200, 3050, 3900, 4750], mira: [250, 500, 750, 1000, 1250], con: 3 },
  { skill: 'Spiral Shooting', arma: ARMAS.fuzil, atk: [1300, 2200, 3100, 4000, 4900], mira: [150, 300, 450, 600, 750], con: 3 },
  { skill: 'Spiral Shooting', arma: ARMAS.lancaGranadas, atk: [2000, 3000, 4000, 5000, 6000], mira: [150, 300, 450, 600, 750], con: 3 },
  { skill: 'Magazine for One', arma: ARMAS.metralhadora, atk: [500, 800, 1100, 1400, 1700], mira: [50, 100, 150, 200, 250], con: 2 },
  { skill: 'Wild Fire', arma: ARMAS.escopeta, atk: [2000, 3500, 5000, 6500, 8000], mira: [500, 1000, 1500, 2000, 2500], con: 3 },
  { skill: 'Wild Fire', arma: ARMAS.lancaGranadas, atk: [1800, 3100, 4400, 5700, 7000], mira: [500, 1000, 1500, 2000, 2500], con: 3 },
  // Grenades: weapon-independent, and the extra term is the Perícia em Granada level (10).
  { skill: 'Basic Grenade', arma: ARMAS.escopeta, atk: [1900, 2800, 3700, 4600, 5500].map((a) => a + 10 * 50), mira: [0, 0, 0, 0, 0], con: 5 },
  { skill: 'Hasty Fire in the Hole', arma: ARMAS.escopeta, atk: [2400, 3300, 4200, 5100, 6000].map((a) => a + 10 * 20), mira: [0, 0, 0, 0, 0], con: 3 },
];

describe('Night Watch — per-level percentage vs the client description', () => {
  it.each(TABELA_DO_CLIENTE)('$skill (weapon $arma.id): all 5 levels match the client table', ({ skill, arma, atk, con }) => {
    for (let lv = 1; lv <= 5; lv++) {
      const esperado = Math.floor((atk[lv - 1] + CON_TOTAL * con) * (NIVEL_BASE / 100));
      expect(simular(skill, lv, arma).razao, `${skill} Nv.${lv}`).toBe(esperado);
    }
  });

  it.each(TABELA_DO_CLIENTE.filter((t) => t.mira[0] > 0))(
    '$skill (weapon $arma.id): the aiming count adds the level value, not a fixed one',
    ({ skill, arma, atk, mira, con }) => {
      for (const lv of [1, 5]) {
        for (const contagem of [1, 10]) {
          const esperado = Math.floor((atk[lv - 1] + mira[lv - 1] * contagem + CON_TOTAL * con) * (NIVEL_BASE / 100));
          expect(simular(skill, lv, arma, contagem).razao, `${skill} Nv.${lv} mira ${contagem}`).toBe(esperado);
        }
      }
    },
  );

  it('exposes every level — the recordings are at Lv1', () => {
    const cls = new NightWatch();
    for (const nome of ['The Vigilante at Night', 'Only One Bullet', 'Spiral Shooting', 'Magazine for One', 'Wild Fire', 'Basic Grenade', 'Hasty Fire in the Hole']) {
      const skill = cls.atkSkills.find((a) => a.name === nome)!;
      expect(skill.levelList?.map((l) => l.value), nome).toEqual([1, 2, 3, 4, 5].map((lv) => `${nome}==${lv}`));
    }
  });
});

/**
 * 0x01de packets from the **gearless** recording (Armas + Ataque Basico + Skill.rrf),
 * skills at Lv1, aiming count 0. `dano` is the packet total and `golpes` is the `count`
 * it carries; the simulator works per hit, so the comparison is `dano / golpes`. The two
 * critical packets from the Pistola segment live in the criticals block at the end of the
 * file.
 */
const PACOTES_SEM_EQUIPAMENTO: { ms: number; skill: string; arma: Arma; dano: number; golpes: number; critico?: boolean }[] = [
  { ms: 8786, skill: 'Only One Bullet', arma: ARMAS.pistola, dano: 227400, golpes: 1 },
  { ms: 11339, skill: 'Only One Bullet', arma: ARMAS.pistola, dano: 227995, golpes: 1 },
  { ms: 21036, skill: 'Magazine for One', arma: ARMAS.pistola, dano: 327660, golpes: 6 },
  { ms: 36893, skill: 'The Vigilante at Night', arma: ARMAS.escopeta, dano: 929360, golpes: 4 },
  { ms: 43694, skill: 'Wild Fire', arma: ARMAS.escopeta, dano: 232635, golpes: 1 },
  { ms: 50754, skill: 'The Vigilante at Night', arma: ARMAS.metralhadora, dano: 261583, golpes: 7 },
  { ms: 56286, skill: 'Magazine for One', arma: ARMAS.metralhadora, dano: 559500, golpes: 10 },
  { ms: 74889, skill: 'Spiral Shooting', arma: ARMAS.lancaGranadas, dano: 514996, golpes: 2 },
  { ms: 79905, skill: 'Wild Fire', arma: ARMAS.lancaGranadas, dano: 247083, golpes: 1 },
  { ms: 86203, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 130437, golpes: 1 },
  { ms: 88369, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 133163, golpes: 1 },
  { ms: 94769, skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 130117, golpes: 1 },
  { ms: 100471, skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 131046, golpes: 1 },
  { ms: 126187, skill: 'The Vigilante at Night', arma: ARMAS.metralhadora, dano: 278019, golpes: 7 },
];

/**
 * No slack: with the pet in place, every packet in this recording falls inside the
 * simulator's closed range. Before the pet was modelled, two of them overshot the maximum
 * by 0.42% and 0.52% and this test needed a 1.006 tolerance.
 */
const FOLGA_TETO = 1;

describe('Night Watch — damage from the gearless recording', () => {
  it.each(PACOTES_SEM_EQUIPAMENTO)('$skill @$ms (weapon $arma.id): $dano over $golpes hit(s)', ({ skill, arma, dano, golpes }) => {
    const r = simular(skill, 1, arma);
    expect(r.golpes, 'hit count').toBe(golpes);

    const porGolpe = dano / golpes;
    expect(Number.isInteger(porGolpe), `${dano} does not divide by ${golpes}`).toBe(true);
    expect(porGolpe).toBeGreaterThanOrEqual(r.min);
    expect(porGolpe).toBeLessThanOrEqual(Math.floor(r.max * FOLGA_TETO));
  });

  // Without this guard the test above would pass with too wide a range: the weapon ATK
  // spread is a few per cent, so getting the percentage table wrong throws the whole
  // damage outside the range.
  it('keeps the range tight — the simulator spread is the weapon\'s, not a wide margin', () => {
    for (const { skill, arma } of PACOTES_SEM_EQUIPAMENTO) {
      const r = simular(skill, 1, arma);
      expect(r.max / r.min, `${skill} ${arma.id}`).toBeLessThan(1.12);
    }
  });

  // With the old percentages (Sigma blog, "[V2]") the observed damage would fall OUTSIDE
  // the simulator range on all six — that is what the recording settles. `razaoAntiga` is
  // the Lv1 percentage without the CON term, as the code had it before these recordings.
  it.each([
    { skill: 'Only One Bullet', arma: ARMAS.fuzil, razaoAntiga: 800 + 1350, con: 3, porGolpe: 130437 },
    { skill: 'Spiral Shooting', arma: ARMAS.fuzil, razaoAntiga: 1200 + 1700, con: 3, porGolpe: 130117 },
    { skill: 'Spiral Shooting', arma: ARMAS.lancaGranadas, razaoAntiga: 1000 + 1500, con: 3, porGolpe: 514996 / 2 },
    { skill: 'Magazine for One', arma: ARMAS.metralhadora, razaoAntiga: 200 + 350, con: 2, porGolpe: 559500 / 10 },
    { skill: 'Wild Fire', arma: ARMAS.escopeta, razaoAntiga: 1000 + 2450, con: 3, porGolpe: 232635 },
    { skill: 'Wild Fire', arma: ARMAS.lancaGranadas, razaoAntiga: 1000 + 2300, con: 3, porGolpe: 247083 },
  ])('$skill (weapon $arma.id): the old [V2] percentage would push the packet out of range', ({ skill, arma, razaoAntiga, con, porGolpe }) => {
    const r = simular(skill, 1, arma);
    // Damage scales linearly with the percentage, so the old range is the current one × k.
    const k = Math.floor((razaoAntiga + CON_TOTAL * con) * (NIVEL_BASE / 100)) / r.razao;
    expect(k).toBeGreaterThan(1.05);
    const foraDaFaixa = porGolpe < r.min * k || porGolpe > Math.floor(r.max * k * FOLGA_TETO);
    expect(foraDaFaixa, `${porGolpe} would still fit in [${r.min * k}, ${r.max * k}]`).toBe(true);
  });
});

/**
 * The client status window shows up in the ZC_PAR_CHANGE packets, and it checks the whole
 * character independently of the damage. These are the ones the recordings carry.
 */
describe('Night Watch — status checked against the ZC_PAR_CHANGE packets', () => {
  it('SP_ATK1 (base ATK) = 789 in the gearless recording', () => {
    expect(simular('Only One Bullet', 1, ARMAS.fuzil).atkStatus).toBe(789);
  });

  /**
   * SP_CRITICAL = 35 with no equipment at all. This is the value that removed the `1 +`
   * from the base crit: total LUK here is 107 (100 allocated + 7 from the job bonus),
   * there is not a single piece granting Crit, and ⌊107/3⌋ = 35 — with the constant it
   * would be 36. The number comes from the server, not from the client's own maths.
   */
  it('SP_CRITICAL = 35 — base crit is ⌊LUK/3⌋, with no added constant', () => {
    expect(simular('Only One Bullet', 1, ARMAS.fuzil).criticoBase).toBe(35);
  });

  // The mid-recording weapon swap sends a fresh SP_ATK2, which gives one exact value per
  // weapon. The Pistola Aprimorável +7 one is what confirms the newly added item 13115:
  // 35 (base ATK) + 35 (refine, weapon level 3) + 35 (+5 per refine) + 85 (+5 per 10 base
  // levels from 70 on, 17 steps at level 241) = 190.
  it.each([
    { nome: 'Pistola Aprimorável +7', arma: ARMAS.pistola, spAtk2: 190 },
    { nome: 'Atirador Consertado +0', arma: ARMAS.fuzil, spAtk2: 300 },
    { nome: 'Aspersor Consertado +0', arma: ARMAS.metralhadora, spAtk2: 290 },
    { nome: 'Retalhador Consertado +8', arma: ARMAS.escopeta, spAtk2: 394 },
  ])('SP_ATK2 (equip ATK) with $nome = $spAtk2', ({ arma, spAtk2 }) => {
    expect(simular('Only One Bullet', 1, arma).atkEquip).toBe(spAtk2);
  });
});

/**
 * The critical packets from the gearless recording. A critical uses the weapon's
 * **maximum** ATK, so it is deterministic — which is why 197,340 and 467,394 repeat. That
 * makes them the most demanding point in the set: they measure the ATK ceiling with no
 * variance in the way, so the comparison here is by **equality**, not by range.
 *
 * These are what found the pet. While the Ovo de Orc Herói went unmodelled, all three sat
 * above the simulator by factors that did not agree with each other (1.62% on Atirador
 * Consertado +0 and 1.02% on Pistola Aprimorável +7), and the suspicion was weapon ATK
 * variance in getWeaponAtk. It was not: with the pet's ATK +4% and crit damage +1% at
 * Normal loyalty, all three land exactly and the two different factors are explained —
 * one is ATK, the other is ATK plus crit damage.
 */
describe('Night Watch — criticals from the gearless recording', () => {
  it.each([
    { skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 197340 },
    { skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 191118 },
    { skill: 'Magazine for One', arma: ARMAS.pistola, dano: 467394 / 6 },
  ])('$skill (weapon $arma.id): the critical matches exactly', ({ skill, arma, dano }) => {
    const r = simular(skill, 1, arma);
    expect(r.podeCritar).toBe(true);
    expect(r.critico).toBe(dano);
  });

  // Base crit 140% + C.Rate 1% (the recording carries SP_CRATE = 1), and on top the pet's
  // crit damage +1%, which the skill applies at half (criDmgPercentage 0.5).
  it('gives a crit multiplier of 1.41 × 1.005', () => {
    const r = simular('Only One Bullet', 1, ARMAS.fuzil);
    // 3 places: the per-hit rounding of the max damage already moves the ratio at the 4th.
    expect(r.critico / r.max).toBeCloseTo(1.41 * 1.005, 3);
  });

  it('would sit 1.6% low without the pet — which is what the recording rules out', () => {
    const semPet = simular('Only One Bullet', 1, ARMAS.fuzil, 0, { semMascote: true });
    expect(197340 / semPet.critico).toBeCloseTo(1.0162, 4);
  });
});

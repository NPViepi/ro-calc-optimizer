import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { AtkSkillModel } from './_character-base.abstract';
import { ElementalMaster } from './ElementalMaster';

/**
 * Elemental Master (Elementalista) — Poison line validated against in-game LATAM
 * replays, end-to-end (absolute damage, not just skill ratios).
 *
 * Ground truth, both recorded by "-Ted" on tra_fild against "Dummy - Neutro"
 * (view 21077 — Neutral defence, so a Poison attack lands at exactly 100% and the
 * element table cancels out):
 *
 *   with weapon: https://recap.latam-tools.com.br/?r=SDmM5r444F  (VenenoComArma.rrf)
 *   no weapon:   https://recap.latam-tools.com.br/?r=Zvf46w4Awd  (VenenoSemArma.rrf)
 *
 * Only the **no-weapon** run is asserted here: with no weapon there is no weapon-MATK
 * variance, so every packet of a given kind repeats the *same* integer (the with-weapon
 * run spreads over a range and cannot pin an exact number).
 *
 * Character state (from the replay's own Session snapshot, plus the trait build the
 * user confirmed — 100 FEI/SPL invested, every other trait 0):
 *
 *   base level 230, job level 47, class 4261
 *   base stats  STR 1, AGI 1, VIT 120, INT 130, DEX 1, LUK 1
 *   traits      SPL 100 allocated; POW/STA/WIS/CON/CRT 0 allocated
 *   equipment   none at all, no buffs affecting damage
 *
 * The only statuses in the recording are non-combat ones (Armazém, bônus de DROP/EXP)
 * plus the 1s after-cast marker, so nothing inflates these numbers.
 *
 * Two client skills fire, both from the Sorcerer tree:
 *   2450 SO_CLOUD_KILL    "Maldição de Jormungand" — 10 ticks over 5s, applies [Infecção]
 *   2448 SO_POISON_BUSTER "Implosão Tóxica"        — bigger ratio vs an infected target
 *
 * The [Infecção] timing is what makes the recording so useful: the cloud's **first**
 * tick lands before the debuff is applied, and the following nine land after it, so a
 * single cast gives both the clean and the debuffed number:
 *
 *   Maldição de Jormungand  16449 (1st tick, clean)   20571 (ticks 2-10, [Infecção])
 *   Implosão Tóxica         68309 (clean)            117700 ([Infecção])
 *
 * Derivation these lock in (see the S.ATQM formula in DamageCalculator.getStatusMatk):
 *   totalInt  = 130 base + 13 job bonus + 3 (see EXTRA_INT) = 146
 *   totalSpl  = 100 allocated + 8 job bonus        = 108
 *   totalCon  = 0 allocated + 5 job bonus          = 5
 *   S.ATQM    = 230/4 + 146 + 146/2 + 10/5 + 6/3 + 108*5 = 820
 *   S.ATQM%   = 108/3 + 5/5 = 37  ->  MATK = floor(820 * 1.37) = 1123
 *   damage    = floor(MATK * ratio/100) - 25       (25 = the dummy's soft MDEF)
 */

/**
 * Both recordings carry **+3 INT that the model cannot account for**.
 *
 * The class job-bonus table is not the culprit: INT +13 caps at job level 33 and
 * stays 13 through the job-60 cap, which is what ElementalMaster.jobBonusTable
 * already says and what kRO's own job-4261 status-weighting table, rAthena's
 * db/re/job_stats.yml and iROwiki all independently give. Neither character wears
 * a single piece of equipment, so it is not gear either.
 *
 * The evidence that it is specifically +3 **INT** (rather than a constant MATK
 * offset or a wrong skill coefficient) is that it reproduces both recordings at
 * once through two *independent* paths, at different base levels and stat builds:
 *   - the Poison recording needs it in the skill *ratio* (INT-scaled) AND in MATK;
 *   - the earlier EM recording's skills are SPL-scaled, so it needs it in MATK only.
 * A constant S.ATQM offset cannot do that: the required offsets differ (+5 and +4),
 * while +3 INT lands both exactly.
 *
 * Most likely an in-game buff/food active before the recording started (both
 * recordings begin with several persistent statuses the LATAM client has no name
 * for). Until it is identified, it is stated explicitly here so these assertions
 * test the damage pipeline rather than silently absorbing the gap elsewhere.
 */
const EXTRA_INT = 3;

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_NEUTRAL = '21077';

interface Scenario {
  level: number;
  jobLevel: number;
  str: number; agi: number; vit: number; int: number; dex: number; luk: number;
  /** Allocated FEI/SPL; the job-trait bonus is added from the class table. */
  spl: number;
  /** [Infecção] level on the target (0 = clean). */
  infection?: number;
  /** Summoned elemental, by the _ElementalMaster_spirit dropdown value (5 = Serpens). */
  spirit?: number;
  /** Domínio Elemental mode, by its dropdown value (1 = Passivo). */
  elControlMode?: number;
}

/**
 * `activeSkillIds` is positional against the class's own `_activeSkillList`, so pick the
 * slots by name rather than counting them — ElementalMaster inherits Sorcerer's list and
 * appends its own, and the indexes shift whenever either end grows.
 */
function activeSkillIdsFor(cls: ElementalMaster, picks: Record<string, number>): number[] {
  const list = (cls as any)._activeSkillList as { name: string; }[];

  return list.map((skill) => picks[skill.name] ?? 0);
}

/** The character in the two Poison replays (VenenoComArma / VenenoSemArma). */
const POISON_REPLAY: Scenario = {
  level: 230, jobLevel: 47,
  str: 1, agi: 1, vit: 120, int: 130, dex: 1, luk: 1,
  spl: 100,
};

/**
 * The earlier EM recording (base 239 / job 50, a full stat build) — kept here because
 * it exercises the *same* MATK pipeline through completely different skills and stats,
 * so it independently corroborates the job-bonus/S.ATQM numbers above.
 *   no weapon: https://recap.latam-tools.com.br/?r=oWqKSdBeZC  (testesemarma.rrf)
 */
const EM_SKILLS_REPLAY: Scenario = {
  level: 239, jobLevel: 50,
  str: 4, agi: 96, vit: 120, int: 125, dex: 120, luk: 43,
  spl: 100,
};

/** Full engine run: class + model + target through the same chain the page uses. */
function damageOf(scenario: Scenario, skillValue: string): number {
  const cls = new ElementalMaster();
  const activeSkillIds = activeSkillIdsFor(cls, {
    _ElementalMaster_spirit: scenario.spirit ?? 0,
    _ElementalMaster_el_control: scenario.elControlMode ?? 0,
  });
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds, passiveSkillIds: [] })
    .getSkillBonusAndName();

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);

  const bonus = cls.getJobBonusStatus(scenario.jobLevel);
  const model: any = createMainModel();
  model.class = 4261;
  model.level = scenario.level;
  model.jobLevel = scenario.jobLevel;
  model.str = scenario.str; model.agi = scenario.agi; model.vit = scenario.vit;
  model.int = scenario.int + EXTRA_INT; model.dex = scenario.dex; model.luk = scenario.luk;
  model.spl = scenario.spl;
  // mirrors ro-calculator.component#setJobBonus
  model.jobStr = bonus.str; model.jobAgi = bonus.agi; model.jobVit = bonus.vit;
  model.jobInt = bonus.int; model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta; model.jobWis = bonus.wis;
  model.jobSpl = bonus.spl; model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = skillValue;

  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_NEUTRAL],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: scenario.infection ? [{ infection: scenario.infection * 5 }] : [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  return (calc as any).damageSummary.skillMaxDamage as number;
}

describe('Elemental Master — Poison replay, absolute damage vs "Dummy - Neutro"', () => {
  it('Maldição de Jormungand Lv5, clean tick → 16449', () => {
    expect(damageOf(POISON_REPLAY, 'Killing Cloud==5')).toBe(16449);
  });

  it('Implosão Tóxica Lv5, clean → 68309', () => {
    expect(damageOf(POISON_REPLAY, 'Poison Burst==5')).toBe(68309);
  });

  // The cloud's own [Infecção] (−25% Poison resist at Lv5) is what separates these
  // from the two above. They only land exactly if the elemental multiplier scales
  // MATK ahead of the skill ratio — applying it to the final damage instead comes
  // out ~0.05% low (20561 / 117672), because the dummy's soft MDEF then gets scaled
  // along with the boost rather than subtracted once after it.
  it('Maldição de Jormungand Lv5 tick under [Infecção] → 20571', () => {
    expect(damageOf({ ...POISON_REPLAY, infection: 5 }, 'Killing Cloud==5')).toBe(20571);
  });

  it('Implosão Tóxica Lv5 under [Infecção] → 117700', () => {
    expect(damageOf({ ...POISON_REPLAY, infection: 5 }, 'Poison Burst==5')).toBe(117700);
  });
});

describe('Elemental Master — earlier EM-skill replay corroborates the same MATK pipeline', () => {
  it('Diamond Storm Lv5 (5 displayed hits) → 191585', () => {
    expect(damageOf(EM_SKILLS_REPLAY, 'Diamond Storm==5')).toBe(191585);
  });

  it('Conflagration Lv5, per tick → 71823', () => {
    expect(damageOf(EM_SKILLS_REPLAY, 'Conflagration==5')).toBe(71823);
  });
});

// ---------------------------------------------------------------------------
// Skill ratios. These are independent of the MATK/MDEF pipeline: the server
// int-casts the coefficient, so a plain Math.floor mirrors the game (see the
// skill-ratio-truncation convention).
// ---------------------------------------------------------------------------

const TOTAL_INT = 146; // 130 base + 16 job bonus at job 47
const BASE_LEVEL = 230;

const ratioOf = (skillName: string, skillLevel: number, totalBonus: Record<string, number> = {}) => {
  const cls = new ElementalMaster();
  (cls as any).bonuses = {
    activeSkillNames: new Set<string>(),
    equipAtks: {}, masteryAtks: {},
    learnedSkillMap: new Map<string, number>(),
    usedSkillMap: new Map<string, number>(),
  };
  const skill = cls.atkSkills.find((s) => s.name === skillName) as AtkSkillModel;
  if (!skill) throw new Error(`atk skill not found: ${skillName}`);

  return Math.floor(
    skill.formula({
      model: { level: BASE_LEVEL, jobLevel: 47 },
      skillLevel,
      status: { totalInt: TOTAL_INT },
      totalBonus,
    } as any),
  );
};

describe('Elemental Master — Poison skill ratios @ base 230, INT 146', () => {
  // (5*40 + 146*3) * 2.30 = 638 * 2.30 = 1467.4 -> 1467
  it('Maldição de Jormungand Lv5 → 1467% per tick', () => {
    expect(ratioOf('Killing Cloud', 5)).toBe(1467);
  });

  // clean:      (1000 + 5*300 + 146) * 2.30 = 2646 * 2.30 = 6085.8 -> 6085
  // [Infecção]: (1000 + 5*500 + 146) * 2.30 = 3646 * 2.30 = 8385.8 -> 8385
  it('Implosão Tóxica Lv5, clean → 6085%', () => {
    expect(ratioOf('Poison Burst', 5)).toBe(6085);
  });

  it('Implosão Tóxica Lv5 vs a target under [Infecção] → 8385%', () => {
    expect(ratioOf('Poison Burst', 5, { infection: 25 })).toBe(8385);
  });

  // The pt-BR description's per-level table: ATQM 1.300/1.600/1.900/2.200/2.500%
  // and ATQM (Infecção) 1.500/2.000/2.500/3.000/3.500%. Evaluated at INT 0 /
  // base level 100 the formula must reproduce those headline numbers exactly.
  it.each([
    [1, 1300, 1500],
    [2, 1600, 2000],
    [3, 1900, 2500],
    [4, 2200, 3000],
    [5, 2500, 3500],
  ])('Implosão Tóxica Lv%i matches the in-game tooltip (%i%% / %i%%)', (lv, clean, infected) => {
    const at100 = (bonus: Record<string, number>) => {
      const cls = new ElementalMaster();
      (cls as any).bonuses = {
        activeSkillNames: new Set<string>(), equipAtks: {}, masteryAtks: {},
        learnedSkillMap: new Map<string, number>(), usedSkillMap: new Map<string, number>(),
      };
      const skill = cls.atkSkills.find((s) => s.name === 'Poison Burst') as AtkSkillModel;
      return Math.floor(
        skill.formula({ model: { level: 100, jobLevel: 47 }, skillLevel: lv, status: { totalInt: 0 }, totalBonus: bonus } as any),
      );
    };
    expect(at100({})).toBe(clean);
    expect(at100({ infection: 25 })).toBe(infected);
  });
});

// ---------------------------------------------------------------------------
// Serpens + Domínio Elemental, through the same replay-anchored pipeline.
// Tracker card UKzvObIl4JWIKGGcWFbY (reported by Ted).
//
// These are not replay numbers — the two recordings had no elemental summoned.
// They ride on the 16449 baseline the recordings *do* pin, so what is asserted
// is the two bonuses' effect on a damage figure already proven against the game.
// ---------------------------------------------------------------------------

describe('Elemental Master — Serpens bonuses reach real damage', () => {
  const SERPENS = 5;
  const PASSIVE = 1;
  const DEFENSIVE = 2;
  const OFFENSIVE = 3;

  // "Dano mágico de propriedade Veneno +10%" — granted by the summon in any mode.
  // Not 16449 * 1.1 = 18093: the elemental multiplier scales MATK *before* the skill
  // ratio, so the dummy's soft MDEF is subtracted once afterwards rather than scaled.
  it('Serpens alone lifts the clean tick 16449 → 18096', () => {
    expect(damageOf({ ...POISON_REPLAY, spirit: SERPENS }, 'Killing Cloud==5')).toBe(18096);
  });

  // Modo Passivo adds "Dano de Maldição de Jormungand +50%" on top: 18096 * 1.5.
  it('Serpens at Passivo adds the +50% skill bonus → 27144', () => {
    expect(damageOf({ ...POISON_REPLAY, spirit: SERPENS, elControlMode: PASSIVE }, 'Killing Cloud==5')).toBe(27144);
  });

  // The regression guard: before this fix the bonus was keyed by skill *name*, which
  // getSkillBonus never reads, so Passivo and Defensivo both produced 18096.
  it('the other modes grant no skill bonus', () => {
    for (const mode of [DEFENSIVE, OFFENSIVE]) {
      expect(damageOf({ ...POISON_REPLAY, spirit: SERPENS, elControlMode: mode }, 'Killing Cloud==5')).toBe(18096);
    }
  });

  // A mode with no elemental summoned is not a state the game can be in, and it must
  // not pay out on its own.
  it('Passivo with no elemental summoned changes nothing', () => {
    expect(damageOf({ ...POISON_REPLAY, elControlMode: PASSIVE }, 'Killing Cloud==5')).toBe(16449);
  });
});

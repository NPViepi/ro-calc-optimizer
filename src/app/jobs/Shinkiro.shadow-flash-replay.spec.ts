import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { createMainModel } from 'src/app/utils';
import { Shinkiro } from './Shinkiro';

/**
 * Shinkiro — Centelha das Trevas (Shadow Flash, SS_KAGEGISSEN 5482) validated against
 * two in-game LATAM replays, end-to-end (absolute damage, not just the skill ratio).
 *
 * Ground truth, both recorded on tra_fild against the training dummies, reported by Ted:
 *
 *   sem arma: https://recap.latam-tools.com.br/?r=H4HCsciCCE  (sem arma.rrf)
 *   com arma: https://recap.latam-tools.com.br/?r=4cUPs4qG62  (com arma.rrf)
 *
 * Only the **no-weapon** run is asserted: with no weapon there is no weapon-ATK variance,
 * so every packet repeats the same integer, while the with-weapon run spreads over a range
 * and pins nothing. That run has exactly two distinct values across its 22 packets:
 *
 *   191496  (12 packets)
 *   335116  (10 packets)
 *
 * Three independent facts identify the bigger number as a **critical hit**:
 *
 *  1. 335116 / 191496 is exactly the crit multiplier — 1.40 base + C.Rate 35%. The
 *     recording's own ZC_PAR_CHANGE carries SP_CRATE = 35, so 1.75 is no coincidence.
 *  2. It shows up in 18 of the 44 packets across both recordings (40.9%), and the same
 *     packet stream reports SP_CRITICAL = 41.
 *  3. The rounding only works per hit: the packets carry `count = 4`, and
 *     4 × floor(191496 / 4 × 1.75) = 335116, whereas floor(191496 × 1.75) = 335118.
 *
 * Neither the pt-BR client description nor browiki.org/wiki/Centelha_das_Trevas mentions
 * a critical or the 4 hits, so the recordings are the only source for both — hence this
 * spec. `hit: 4` + `canCri: true` on the skill reproduce both numbers exactly.
 *
 * Character state (Session snapshot + the trait build Ted confirmed — 100 CRV, nothing
 * else allocated; no equipment at all beyond the kunai in the ammo slot, which a melee
 * skill does not use, and no damage-affecting buff in the recording):
 *
 *   base level 230, job level 46, class 4304 (Shinkiro)
 *   base stats  STR 125, AGI 1, VIT 1, INT 1, DEX 1, LUK 125
 *   traits      CRT 100 allocated; POW/STA/WIS/SPL/CON 0 allocated
 *   skills      Dança das Trevas Lv5, Centelha das Trevas Lv10
 *
 * Derivation these lock in:
 *   base ATK   = ⌊230/4 + DEX 10/5 + STR 135 + LUK 128/3⌋ + POW 8 × 5 = 277  (= SP_ATK1)
 *   ATK        = 277 × 2 = 554  ->  P.ATK 2%  ->  ⌊554 × 1.02⌋ = 565
 *   skill base = (9,700 + Dança 5 × 1,000 + POW 8 × 5) × 230/100 = 33,902%
 *   damage     = ⌊565 × 339.02⌋ − 50 (the dummy's soft DEF) = 191,496
 *   crítico    = ⌊191.496 × 1,75⌋ arredondado para baixo a múltiplo de 4 = 335.116
 *
 * **O termo de POD não é provado por esta gravação.** O que ela fixa é a razão inteira
 * 33.902, logo a base 14.740; a tabela do cliente dá 14.700, e os +40 restantes são
 * medidos. Só que este personagem tem POD 8, STA 8, SAB 2, CON 4, e +40 sai igualmente
 * de POD×5, STA×5, CON×10, SAB×20 ou de uma constante — POD e STA são numericamente
 * indistinguíveis aqui (ambos vêm só do bônus de classe). O que escolhe POD×5 são as
 * fontes, que convergem e não citam nenhum dos outros: browiki.org/wiki/Centelha_das_Trevas
 * escreve "Dano = {[(Dano base) + (POD × 5)] × (Nv. de base ÷ 100)}%", a descrição pt-BR
 * diz "afetado pelo nv. de base, POD e pelo nível de Dança das Trevas", e as versões 2 e 3
 * do blog do Sigma dão POW × 5. Uma gravação com POD alocado (em vez de CRV) separaria os
 * casos de vez: em POD 100 a diferença entre ter e não ter o termo é ~3,4% de dano.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_NEUTRAL = '21077';

/**
 * Job/trait bonuses come from the class's own tables (rebuilt from
 * irowiki.org/wiki/Shinkiro#Job_&_Talent_Bonuses — see the comment on `jobBonusTable`),
 * so this spec doubles as their regression test. At job 46 they resolve to
 *   FOR +10  AGI +7  VIT +5  INT +4  DES +9  SOR +3
 *   POD +8   STA +8  SAB +2  FEI +0  CON +4  CRV +5
 * and the recording confirms them from three directions at once:
 *   FOR +10, DES +9, SOR +3, POD +8  ->  ATQ base 277   (SP_ATK1 = 277)
 *   POD +8,  CON +4                  ->  P.ATQ ⌊8/3⌋ + ⌊4/5⌋ = 2   (SP_PATK = 2)
 *   CRV +5                           ->  T.Crít ⌊105/3⌋ = 35        (SP_CRATE = 35)
 * The tables this replaced gave FOR +12 / POD +9, i.e. 284 and 3.
 */

/** Full engine run: class + model + target through the same chain the page uses. */
function damageOf(skillValue: string) {
  const cls = new Shinkiro();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
    .getSkillBonusAndName();
  // Learned levels the recording's ZC_SKILLINFO_LIST reports for the two skills that
  // feed this formula (5481 Dança das Trevas = 5, 5482 Centelha das Trevas = 10).
  learnedSkillMap.set('Shadow Dance', 5);
  learnedSkillMap.set('Shadow Flash', 10);

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);

  const bonus = cls.getJobBonusStatus(46);
  const model: any = createMainModel();
  model.class = 4304;
  model.level = 230;
  model.jobLevel = 46;
  model.str = 125; model.agi = 1; model.vit = 1; model.int = 1; model.dex = 1; model.luk = 125;
  model.pow = 0; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 0; model.crt = 100;
  // mirrors ro-calculator.component#setJobBonus
  model.jobStr = bonus.str; model.jobAgi = bonus.agi;
  model.jobVit = bonus.vit; model.jobInt = bonus.int;
  model.jobDex = bonus.dex; model.jobLuk = bonus.luk;
  model.jobPow = bonus.pow; model.jobSta = bonus.sta;
  model.jobWis = bonus.wis; model.jobSpl = bonus.spl;
  model.jobCon = bonus.con; model.jobCrt = bonus.crt;
  model.selectedAtkSkill = skillValue;

  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);

  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_NEUTRAL],
    equipAtks, masteryAtks,
    buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: [],
    activeSkillNames, learnedSkillMap,
    selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const summary = (calc as any).damageSummary;
  return {
    cri: summary.skillMaxDamage as number,
    noCri: summary.skillMaxDamageNoCri as number,
    canCri: summary.skillCanCri as boolean,
    hits: summary.skillHit as number,
    baseSkillDamage: summary.baseSkillDamage as number,
  };
}

describe('Shinkiro — job/talent bonuses at job level 46', () => {
  // Asserted separately from the damage so a table regression names itself instead of
  // surfacing as an unexplained damage diff. Values: irowiki.org/wiki/Shinkiro.
  const bonus = new Shinkiro().getJobBonusStatus(46);

  it('job bonuses → FOR 10 / AGI 7 / VIT 5 / INT 4 / DES 9 / SOR 3', () => {
    expect([bonus.str, bonus.agi, bonus.vit, bonus.int, bonus.dex, bonus.luk]).toEqual([10, 7, 5, 4, 9, 3]);
  });

  it('talent bonuses → POD 8 / STA 8 / SAB 2 / FEI 0 / CON 4 / CRV 5', () => {
    expect([bonus.pow, bonus.sta, bonus.wis, bonus.spl, bonus.con, bonus.crt]).toEqual([8, 8, 2, 0, 4, 5]);
  });
});

describe('Shinkiro — Centelha das Trevas vs "Dummy - Neutro", replay "sem arma"', () => {
  const result = damageOf('Shadow Flash==10');

  it('is flagged as a skill that can crit, in 4 hits', () => {
    expect(result.canCri).toBe(true);
    expect(result.hits).toBe(4);
  });

  it('skill ratio is 33.902% (9.700 + Dança 5 x 1.000 + POD 8 x 5, x nv. base/100)', () => {
    expect(result.baseSkillDamage).toBe(33902);
  });

  it('non-critical hit → 191496', () => {
    expect(result.noCri).toBe(191496);
  });

  it('critical hit → 335116', () => {
    expect(result.cri).toBe(335116);
  });
});

import { AtkSkillModel } from '../jobs/_character-base.abstract';
import { SkillAspdModel } from '../models/damage-summary.model';
import { EquipmentSummaryModel } from '../models/equipment-summary.model';
import { StatusSummary } from '../models/status-summary.model';
import { SKILL_ID_BY_NAME } from '../skills';
import { floor } from './floor';
import { round, roundUp } from './round';

/**
 * Decimals kept on the uses-per-second rate. One decimal used to be enough while every
 * modelled skill fired at least once every ten seconds; the 4th-job skills with a 60s
 * recarga broke it, because `floor(1 / 61, 1)` is 0 — and damage-calculator.ts reads a
 * falsy rate as "no cast data" and substitutes the basic ASPD rate, which reported
 * Firmamento's DPS about 122x too high (reported by Ted).
 *
 * Six is the most `floor()` can carry (it rounds to six digits before truncating), and a
 * slow skill needs every one of them: at four decimals a 61s cycle still lost 0,6% of its
 * DPS to the truncation. Flooring is kept, so the rate is never overstated.
 */
const HIT_PER_SEC_PRECISION = 6;

export const calcSkillAspd = (params: {
  skillData: AtkSkillModel;
  totalEquipStatus: EquipmentSummaryModel;
  status: StatusSummary;
  skillLevel: number;
}): SkillAspdModel => {
  const { skillData, totalEquipStatus, status, skillLevel } = params;
  const { name, acd: baseSkillAcd, hitEveryNSec } = skillData;
  const { cd: baseSkillCd, fct: baseSkillFct, vct: baseSkillVct } = skillData;

  const skillAcd = typeof baseSkillAcd === 'function' ? baseSkillAcd(skillLevel) : baseSkillAcd;
  let skillCd = typeof baseSkillCd === 'function' ? baseSkillCd(skillLevel) : baseSkillCd;
  let skillFct = typeof baseSkillFct === 'function' ? baseSkillFct(skillLevel) : baseSkillFct;
  let skillVct = typeof baseSkillVct === 'function' ? baseSkillVct(skillLevel) : baseSkillVct;
  skillCd = floor(skillCd, 3)
  skillFct = floor(skillFct, 3)
  skillVct = floor(skillVct, 3)

  // The skill's own row in the client's "Informação de Conjuração / Espera" window, kept
  // aside before anything touches it so the UI can always show what the reductions start
  // from. `releasedSkill` (Warlock's Release) zeroes the working values below, which would
  // otherwise leave the display comparing 0 against 0. The engine's fct/vct/acd/cd are the
  // client's own numbers — src/app/skills/skill-delay.spec.ts holds every class to them.
  const client = { fct: skillFct, vct: skillVct, acd: skillAcd, cd: skillCd };

  if (totalEquipStatus['releasedSkill']) {
    skillCd = 0;
    skillFct = 0;
    skillVct = 0;
  }

  // item.json keys cast/cooldown reductions by skill id; fall back to the name for
  // skills without a catalog id yet.
  const id = SKILL_ID_BY_NAME[name] ?? name;
  const reduceSkillCd = totalEquipStatus[`cd__${id}`] || 0;
  const reduceSkillVct = totalEquipStatus[`vct__${id}`] || 0;
  const reduceSkillVctFix = totalEquipStatus[`fix_vct__${id}`] || 0;
  const reduceSkillFct = totalEquipStatus[`fct__${id}`] || 0;
  const reduceSkillFctPercent = totalEquipStatus[`fctPercent__${id}`] || 0;
  const reduceSkillAcd = totalEquipStatus[`acd__${id}`] || 0;
  // `acd_magic_<element>` — an after-cast reduction for magic of one element (Insígnia do
  // Vento Nv3, "Pós-conj. de magias de Vento -50%"). rAthena adds it to the same delay rate as
  // the global `acd`, so the two sum.
  const reduceElementAcd = skillData.isMatk && skillData.element ? totalEquipStatus[`acd_magic_${String(skillData.element).toLowerCase()}`] || 0 : 0;

  const { acd, vct, vct_inc = 0, fct, fctPercent, vctBySkill = 0 } = totalEquipStatus;
  const { totalDex, totalInt } = status;

  const precision = 4;
  const dex2Int1 = totalDex * 2 + totalInt;
  const vctByStat = Math.max(0, 1 - Math.sqrt(floor(dex2Int1 / 530, 5)));
  const vctGlobal = Math.max(0, 1 - (vct - vct_inc) / 100);
  const vctSkill = Math.max(0, 1 - reduceSkillVct / 100);
  const vctBySkill_ = (100 - vctBySkill) / 100;

  const reducedVct = Math.max(0, roundUp((skillVct - reduceSkillVctFix) * vctByStat * vctGlobal * vctSkill * vctBySkill_, precision));
  const reducedCd = Math.max(0, round(skillCd - reduceSkillCd, precision));
  const reducedAcd = Math.max(0, round((skillAcd - reduceSkillAcd) * (1 - (acd + reduceElementAcd) * 0.01), precision));

  const reducedFct = Math.max(0, roundUp((skillFct - reduceSkillFct - fct) * (1 - fctPercent * 0.01) * (1 - reduceSkillFctPercent * 0.01), precision));

  const blockPeriod = hitEveryNSec > 0 ? 0 : Math.max(reducedCd, reducedAcd);
  const castPeriod = hitEveryNSec > 0 ? round(hitEveryNSec, 2) : roundUp(reducedVct + reducedFct, precision);
  const hitPeriod = round(blockPeriod + castPeriod, 5);
  // console.log({ vctByStat, reducedVct, reducedCd, reducedAcd, hitPeriod });

  return {
    timingUnknown: skillData.timingUnknown,
    ignoreAspdFloor: skillData.ignoreAspdFloor,
    cd: skillCd,
    reducedCd,
    vct: skillVct,
    sumDex2Int1: dex2Int1,
    vctByStat,
    vctSkill,
    reducedVct,
    fct: skillFct,
    reducedFct,
    acd: skillAcd,
    reducedAcd,
    skillLevel,
    clientFct: client.fct,
    clientVct: client.vct,
    clientAcd: client.acd,
    clientCd: client.cd,
    castPeriod: castPeriod,
    hitPeriod,
    totalHitPerSec: skillData.timingUnknown ? 0 : floor(1 / hitPeriod, HIT_PER_SEC_PRECISION),
  };
};

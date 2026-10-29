import type { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from '../jobs/_character-base.abstract';

const acceleration = (input: AtkSkillFormulaInput) => input.skills.learnedLevel('Sonic Acceleration') > 0 ? 1.9 : 1;
const lowHp = (input: AtkSkillFormulaInput) => input.skills.isActive('Sonic Blow Target Below Half HP') ? 1.5 : 1;
const spirit = (input: AtkSkillFormulaInput) => input.skills.isActive('Assassin Spirit')
  ? input.pvpMode === 'woe' || input.pvpMode === 'woe-te' ? 1.25 : 2
  : 1;

/**
 * LATAM AS_SONICBLOW (136), not the older 800%/10% versions.
 * https://browiki.org/wiki/Lâminas_Destruidoras
 * https://browiki.org/wiki/Lâminas_Aceleradas
 * https://browiki.org/wiki/Espírito_do_Mercenário
 * Eight displayed hits divide one damage total. The client's delay row is
 * FCT/VCT/ACD = 0, CD = 1000 ms: Spirit's ACD reduction cannot shorten that CD.
 */
export const SONIC_BLOW: AtkSkillModel = {
  name: 'Sonic Blow', label: 'Sonic Blow Lv10', value: 'Sonic Blow==10',
  levelList: Array.from({ length: 10 }, (_, i) => ({ label: `Sonic Blow Nv${i + 1}`, value: `Sonic Blow==${i + 1}` })),
  fct: 0, vct: 0, acd: 0, cd: 1, isMelee: true, hit: 8,
  formula: input => (200 + 100 * input.skillLevel) * acceleration(input) * lowHp(input),
  ratioCalc: input => ({ rows: [
    { label: 'ATQ da habilidade', display: `${200 + 100 * input.skillLevel}%` },
    { label: 'Lâminas Aceleradas', display: `× ${acceleration(input)}` },
    { label: 'Alvo abaixo de 50% de HP', display: `× ${lowHp(input)}` },
  ] }),
  accuracy: input => input.accuracy * acceleration(input),
  finalDmgFormula: input => Math.floor(input.damage * spirit(input)),
  finalDmgCalc: input => ({ rows: [
    { label: 'Dano anterior', display: String(input.damageBefore) },
    { label: 'Espírito do Mercenário', display: `× ${spirit(input)}` },
    { label: 'Dano final', display: String(input.damageAfter), emphasis: true },
  ] }),
  verifyItemFn: ({ weapon }) => weapon.isType('katar') ? '' : 'katar',
};

const yesNo = [{ label: 'Sim', value: 1, isUse: true }, { label: 'Não', value: 0, isUse: false }];

export const SONIC_BLOW_BUFFS: ActiveSkillModel[] = [
  { name: 'Assassin Spirit', label: 'Espírito do Mercenário', inputType: 'selectButton', dropdown: yesNo },
  { name: 'Sonic Blow Target Below Half HP', label: 'Alvo abaixo de 50% de HP (Lâminas Destruidoras)', icon: 136, inputType: 'selectButton', dropdown: yesNo },
];

export const SONIC_ACCELERATION: PassiveSkillModel = {
  name: 'Sonic Acceleration', label: 'Lâminas Aceleradas', inputType: 'selectButton', dropdown: yesNo,
};

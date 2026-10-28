import { ElementType } from '../constants/element-type.const';
import type { SKILL_NAME } from '../constants/skill-name';
import type { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import { PREVIEW_275_REFERENCE } from './preview-275-reference';

type Input = AtkSkillFormulaInput;
type Definition = { classes: ClassName[]; announcementName: string; skill: AtkSkillModel };
const L = (i: Input) => i.skillLevel;
const on = (i: Input, name: SKILL_NAME) => i.skills.isActive(name);
const learn = (i: Input, name: SKILL_NAME) => i.skills.learnedLevel(name);
const ratio = (i: Input, value: number) => value * i.model.level / 100;
const p = (i: Input) => i.status.totalPow;
const s = (i: Input) => i.status.totalSpl;
const c = (i: Input) => i.status.totalCon;
const timing = (value: number | readonly number[]): AtkSkillModel['cd'] => typeof value === 'number' ? value : level => value[level - 1] ?? value[value.length - 1];
const requireState = (name: SKILL_NAME, label: string) => (i: Input) => on(i, name) ? '' : label;
const unity = (i: Input) => i.skills.activeLevel('_SkyEmperor_Celestial_Space') === 7 ? '' : 'União Celestial';
const axe = (i: Input) => !i.weapon.isType('twohandAxe') ? 'Machado de duas mãos' : on(i, 'On Magogear') ? 'Fora do M.E.C.H.A.' : '';
const ig = [ClassName.ImperialGuard];
const mk = [ClassName.Meister];
const ac = [ClassName.AbyssChaser];
const nw = [ClassName.NightWatch];
const sky = [ClassName.SkyEmperor];
const sh = [ClassName.SpiritHandler];
const ninja = [ClassName.Shinkiro, ClassName.Shiranui];
const grand = (i: Input) => on(i, 'Grand Judgement');

function attack(classes: ClassName[], announcementName: string, patch: Pick<AtkSkillModel, 'formula'> & Partial<AtkSkillModel>): Definition {
  const ref = PREVIEW_275_REFERENCE.find(r => r.name === announcementName)!;
  const name = patch.name ?? announcementName as SKILL_NAME;
  return { classes, announcementName, skill: {
    name, label: announcementName, labelSuffix: 'Prévia', value: `${name}==${ref.maxLevel}`,
    levelList: Array.from({ length: ref.maxLevel }, (_, index) => ({ label: `${announcementName} (Prévia) Nv${index + 1}`, value: `${name}==${index + 1}` })),
    vct: timing(ref.vct), fct: timing(ref.fct), acd: timing(ref.acd), cd: timing(ref.cd),
    preview: true, ...patch,
  } };
}

/** Announcement ratios, rather than later rAthena balance changes. Trait terms
 * missing from the announcement are provisional; see docs/skill-versions.md. */
export const PREVIEW_275_ATTACKS: Definition[] = [
  attack(ig, 'Imperial Cross', { isMelee: true, totalHit: 3, verifyItemFn: requireState('Attack Stance', 'Postura Ofensiva'), formula: i => ratio(i, 1650 + L(i) * 1350 + learn(i, 'Spear & Sword Mastery') * 25 + p(i) * 5 + (grand(i) ? 100 + L(i) * 300 : 0)) }),
  attack(ig, 'Radiant Spear', { canCri: true, criDmgPercentage: 0.5, verifyItemFn: i => !i.weapon.isType('spear') ? 'Lança de uma mão' : requireState('Attack Stance', 'Postura Ofensiva')(i), formula: i => ratio(i, 3500 + L(i) * 1150 + learn(i, 'Spear & Sword Mastery') * 50 + p(i) * 5 + (grand(i) ? L(i) * 250 : 0)) }),
  attack(mk, 'Rush Strike', { isMelee: true, verifyItemFn: axe, formula: i => ratio(i, L(i) * 3500 + p(i) * 5) }),
  attack(mk, 'Powerful Swing', { name: 'Powerful Swing (Meister)', isMelee: true, totalHit: 5, verifyItemFn: axe, formula: i => ratio(i, 300 + L(i) * 850 + p(i) * 5 + (on(i, 'Axe Stomp') ? 100 + L(i) * 100 : 0)) }),
  attack(mk, 'Energy Cannonade', { totalHit: 7, isIgnoreDef: true, isIgnoreSDef: true, verifyItemFn: requireState('On Magogear', 'M.E.C.H.A.'), formula: i => ratio(i, 250 + L(i) * 750 + p(i) * 5) }),
  attack([ClassName.Biolo], 'Mystery Powder', { isMelee: true, formula: i => ratio(i, 1500 + L(i) * 4000 + p(i) * 5) }),
  attack([ClassName.Biolo], 'Dust Explosion', { isMelee: true, totalHit: 5, verifyItemFn: requireState('_Preview_Mystery Powder', 'Mystery Powder (Prévia)'), formula: i => ratio(i, 450 + L(i) * (on(i, 'Research Report') ? 800 : 600) + p(i) * 5) }),
  attack([ClassName.ShadowCross], 'Cross Slash', { name: 'Cross Slash (Shadow Cross)', isMelee: true, totalHit: 3, canCri: true, baseCriPercentage: 0.5, criDmgPercentage: 0.5, formula: i => ratio(i, L(i) * (on(i, 'Shadow Exceed') ? 360 : 300) + p(i) * (on(i, 'Shadow Exceed') ? 7 : 5)) }),
  attack(ac, 'Hit and Sliding', { isMelee: weapon => weapon !== 'bow', formula: i => ratio(i, L(i) * 3500 + p(i) * 5) }),
  attack(ac, 'Chasing Break', { isMelee: true, totalHit: i => on(i, '_Preview_Chasing') ? 7 : 5, formula: i => ratio(i, (on(i, '_Preview_Chasing') ? 1750 : 1550) + L(i) * (on(i, '_Preview_Chasing') ? 500 : 450) + p(i) * 5) }),
  attack(ac, 'Chasing Shot', { totalHit: i => on(i, '_Preview_Chasing') ? 3 : 2, canCri: true, baseCriPercentage: 0.5, criDmgPercentage: 0.5, verifyItemFn: i => i.weapon.isType('bow') ? '' : 'Arco', formula: i => ratio(i, 1500 + L(i) * 700 + c(i) * 5 + (on(i, '_Preview_Chasing') ? 250 : 0)) }),
  attack([ClassName.Troubadour, ClassName.Trouvere], 'Rhythmical Wave', { isMatk: true, getElement: (_, i) => i.ammoElement, verifyItemFn: i => i.weapon.isType('instrument', 'whip') ? '' : 'Instrumento ou chicote', formula: i => ratio(i, 250 + L(i) * 3650 + learn(i, 'Stage Manner') * 25 + s(i) * 5 + (on(i, 'Mystic Symphony') ? 200 + L(i) * 1000 : 0)) }),
  attack(nw, 'Wild Shot', { totalHit: 7, canCri: true, criDmgPercentage: 0.5, verifyItemFn: i => i.weapon.isSubType('Rifle', 'Revolver') ? '' : 'Rifle ou revólver', formula: i => ratio(i, 870 + L(i) * (180 + (on(i, 'Hidden Card') ? i.weapon.isSubType('Rifle') ? 100 : 60 : 0)) + c(i) * 5) }),
  attack(nw, 'Midnight Fallen', { totalHit: 3, isIgnoreDef: true, isIgnoreSDef: true, verifyItemFn: i => i.weapon.isSubType('Shotgun', 'Gatling Gun', 'Grenade Launcher') ? '' : 'Espingarda, metralhadora ou lança-granadas', formula: i => ratio(i, 2400 + L(i) * (800 + (on(i, 'Hidden Card') ? i.weapon.isSubType('Shotgun') ? 400 : i.weapon.isSubType('Gatling Gun') ? 200 : 340 : 0)) + c(i) * 5) }),
  attack([ClassName.DragonKnight], 'Dragonic Pierce', { totalHit: 5, canCri: true, criDmgPercentage: 0.5, verifyItemFn: i => i.weapon.isType('twohandSpear') ? '' : 'Lança de duas mãos', formula: i => ratio(i, 850 + L(i) * 600 + p(i) * 7 + (on(i, 'Dragonic Aura') ? 100 + L(i) * 50 : 0)) }),
  attack(ig, 'Imperial Pressure', { isMatk: true, getElement: (_, i) => i.skills.isActive('Guard Stance') ? ElementType.Holy : ElementType.Neutral, formula: i => ratio(i, 5600 + L(i) * 1850 + learn(i, 'Spear & Sword Mastery') * 50 + s(i) * 7) }),
  attack(ac, 'Abyss Flame', { isMatk: true, element: ElementType.Fire, totalHit: 5, labelSuffix: 'Prévia · alvo', formula: i => ratio(i, L(i) * (500 + learn(i, 'Magic Sword Mastery') * 15) + s(i) * 10) }),
  attack(ac, 'Abyss Flame', { isMatk: true, element: ElementType.Fire, totalHit: 3, labelSuffix: 'Prévia · ao redor do usuário', value: 'Abyss Flame (Usuário)==5', levelList: Array.from({length: 5}, (_, index) => ({label: `Abyss Flame (Prévia · usuário) Nv${index + 1}`,value:`Abyss Flame (Usuário)==${index + 1}`})), formula: i => ratio(i, L(i) * (820 + learn(i, 'Magic Sword Mastery') * 30) + s(i) * 10) }),
  attack([ClassName.ElementalMaster], 'Psychic Stream', { isMatk: true, element: ElementType.Neutral, verifyItemFn: i => on(i, '_Preview_Energy Coat') ? 'Desative Proteção Arcana' : '', formula: i => ratio(i, 1000 + L(i) * 3500 + s(i) * 12) }),
  attack([ClassName.Cardinal], 'Divinus Flos', { isMatk: true, getElement: (_, i) => i.skills.isActive('_Preview_Ancilla') ? ElementType.Neutral : ElementType.Holy, formula: i => ratio(i, L(i) * 4000 + learn(i, 'Fidus Animus') * 70 + s(i) * 10) }),
  attack([ClassName.Inquisitor], 'Blazing Flame Blast', { canCri: true, criDmgPercentage: 0.5, verifyItemFn: requireState('Vigor Explosion', 'Fúria Interior'), formula: i => ratio(i, (on(i, '_Preview_Massive Flame Blaster') ? 3500 : 2000) + L(i) * (on(i, '_Preview_Massive Flame Blaster') ? 4200 : 3800) + p(i) * 10) }),
  attack([ClassName.Windhawk], 'Wild Walk', { totalHit: 3, canCri: true, criDmgPercentage: 0.5, formula: i => ratio(i, 1800 + L(i) * 2800 + c(i) * 5) * (1 + learn(i, 'Nature Friendly') / 10) * (1 + learn(i, 'Steel Crow') / 10) }),
  attack(sky, 'Sky Sun', { isMelee: true, canCri: true, criDmgPercentage: 0.5, verifyItemFn: unity, formula: i => ratio(i, L(i) * (1500 + learn(i, 'Sky Mastery') * 7) + p(i) * 5) }),
  attack(sky, 'Sky Moon', { isMelee: true, totalHit: 3, verifyItemFn: unity, formula: i => ratio(i, 1200 + L(i) * (450 + learn(i, 'Sky Mastery') * 9) + p(i) * 5) }),
  attack(sky, 'Star Light Kick', { isMelee: true, totalHit: 7, verifyItemFn: unity, formula: i => ratio(i, 400 + L(i) * (200 + learn(i, 'Sky Mastery') * 5) + p(i) * 5) }),
  attack(sh, 'Chulho Battering', { totalHit: 5, canCri: true, criDmgPercentage: 0.5, formula: i => ratio(i, 480 + L(i) * 160 + learn(i, 'Mystical Creature Mastery') * 70 + p(i) * 5) }),
  attack(sh, 'Hyunrok Spirit Power', { isMatk: true, totalHit: 7, getElement: (_, i) => [ElementType.Neutral, ElementType.Water, ElementType.Wind, ElementType.Earth, ElementType.Fire, ElementType.Dark, ElementType.Holy, ElementType.Neutral][i.skills.activeLevel('Colors of Hynrok')] ?? ElementType.Neutral, formula: i => ratio(i, 350 + L(i) * 200 + learn(i, 'Mystical Creature Mastery') * 30 + s(i) * 5) }),
];

export function previewSkillsForClass(className: ClassName): AtkSkillModel[] {
  return PREVIEW_275_ATTACKS.filter(d => d.classes.includes(className)).map(d => ({ ...d.skill }));
}

function buff(name: SKILL_NAME, label: string, maxLevel = 1, bonus?: (level: number) => Record<string, number>, previewDescription?: string): ActiveSkillModel {
  const off = { label: 'Não', value: 0, isUse: false };
  const levels = Array.from({ length: maxLevel }, (_, index) => ({ label: maxLevel === 1 ? 'Sim' : `Nv ${index + 1}`, value: index + 1, isUse: true, bonus: bonus?.(index + 1) }));
  // Par de botões: o "Sim" à esquerda, como em todo o resto da aba de habilidades.
  // Lista de níveis: começa no desligado. Ver select-button-order.spec.ts.
  return { name, label: `${label} (Prévia)`, preview: true, previewDescription, inputType: maxLevel === 1 ? 'selectButton' : 'dropdown',
    dropdown: maxLevel === 1 ? [...levels, off] : [off, ...levels] };
}
export function previewBuffsForClass(className: ClassName): ActiveSkillModel[] {
  switch (className) {
    case ClassName.ArchMage: return [{ ...buff('Energy Conversion', 'Energy Conversion', 5, undefined, 'Exchanges AP for SP. Levels 1 to 5 cost 22/19/16/13/10 AP and restore 40/120/240/400/600 SP respectively. Resource changes during a rotation are not simulated.'), dropdown: [
      {label:'Não',value:0,isUse:false}, ...[40,120,240,400,600].map((sp,index) => ({label:`Nv ${index + 1} · ${sp} SP / ${22 - index * 3} AP`,value:index+1,isUse:true})),
    ] }];
    case ClassName.HyperNovice: return [buff('Overcoming Crisis', 'Overcoming Crisis', 5, level => ({hp:level * 15000,pAtk:level * 3,sMatk:level * 3}), 'Costs 50 AP and lasts 300 seconds. Fully heals HP on activation and grants +15000 Max HP, +3 P.Atk and +3 S.Matk per skill level. The activation heal is not simulated.'), buff('_Preview_Target Below Half HP', 'Alvo abaixo de 50% HP', 1, undefined, 'Applies the additional Mega Sonic Blow damage against a target below 50% HP.')];
    case ClassName.Biolo: return [buff('_Preview_Mystery Powder', 'Mystery Powder · 60s', 1, undefined, 'Enables Dust Explosion while the 60-second Mystery Powder buff is active.')];
    case ClassName.AbyssChaser: return [buff('_Preview_Chasing', 'Chasing · 60s', 1, undefined, 'Lasts 60 seconds. Adds 2500% per skill level to Unlucky Rush and 700% per skill level to Chain Reaction Shot secondary damage. Increases Chasing Break and Chasing Shot damage and hit counts.')];
    case ClassName.Inquisitor: return [buff('_Preview_Massive Flame Blaster', 'Massive Flame Blaster', 1, undefined, 'Applies the enhanced Blazing Flame Blast damage while the Massive Flame Blaster buff is active.')];
    case ClassName.Windhawk: return [buff('_Preview_Wild Walk', 'Wild Walk', 5, level => ({flee:50 + level * 50}), 'Applies the Wild Walk Flee bonus: +100/150/200/250/300 for 6/9/12/15/18 seconds at levels 1 to 5. Movement speed also increases in game; movement is not simulated.')];
    case ClassName.ShadowCross: return [buff('_Preview_Blocking', 'Bloqueio bem-sucedido · 10s', 1, undefined, 'Records the successful blocking state granted by Cross Slash for 10 seconds. This control adds no damage bonus by itself.')];
    case ClassName.Cardinal: return [buff('_Preview_Ancilla', 'Ancilla', 1, undefined, 'Changes Divinus Flos from Holy to Neutral damage while Ancilla is active.')];
    case ClassName.ElementalMaster: return [buff('_Preview_Energy Coat', 'Proteção Arcana · condição de Psychic Stream', 1, undefined, 'Prevents Psychic Stream from being used while Energy Coat is active.')];
    case ClassName.Shinkiro:
    case ClassName.Shiranui: return [
      buff('_Preview_Four Colors Fire', 'Four Colors Charm · Fogo', 1, undefined, 'Requires 10 Fire spirits and costs 20 AP. Adds 8500% to the Red Flame Cannon ratio for 300 seconds. Can coexist with the other elemental charms.'), buff('_Preview_Four Colors Water', 'Four Colors Charm · Água', 1, undefined, 'Requires 10 Water spirits and costs 20 AP. Adds 7000% to the Cold Blooded Cannon ratio for 300 seconds. Can coexist with the other elemental charms.'),
      buff('_Preview_Four Colors Wind', 'Four Colors Charm · Vento', 1, undefined, 'Requires 10 Wind spirits and costs 20 AP. Adds 8500% to the Thundering Cannon ratio for 300 seconds. Can coexist with the other elemental charms.'), buff('_Preview_Four Colors Earth', 'Four Colors Charm · Terra', 1, undefined, 'Requires 10 Earth spirits and costs 20 AP. Adds 5500% to the Golden Dragon Cannon ratio for 300 seconds. Can coexist with the other elemental charms.'),
      buff('_Preview_Hidden Weapon', 'Hidden Weapon · área ativa', 1, undefined, 'Applies the additional Huuma Shuriken - Construct damage inside the Hidden Weapon area.'), buff('_Preview_Nightmare', 'Nightmare · alvo marcado', 1, undefined, 'Applies the Nightmare damage formulas against a marked target.'),
    ];
    default: return [];
  }
}

const wrapped = new WeakSet<AtkSkillModel>();
/** Off by default. Wrapping rather than rewriting preserves the current formulas. */
export function applyPreviewBuffs(skill: AtkSkillModel): AtkSkillModel {
  if (wrapped.has(skill)) return skill;
  const charms: Partial<Record<SKILL_NAME, [SKILL_NAME, number]>> = {
    'Red Flame Cannon': ['_Preview_Four Colors Fire',8500], 'Cold Blooded Cannon': ['_Preview_Four Colors Water',7000],
    'Thundering Cannon': ['_Preview_Four Colors Wind',8500], 'Golden Dragon Cannon': ['_Preview_Four Colors Earth',5500],
  };
  const charm = charms[skill.name];
  const chasing = skill.name === 'Unlucky Rush' || skill.name === 'Chain Reaction Shot';
  if (!charm && !chasing) return skill;
  const result: AtkSkillModel = { ...skill, formula: i => skill.formula(i) + (charm && on(i,charm[0]) ? ratio(i,charm[1]) : 0)
    + (on(i,'_Preview_Chasing') && (skill.name === 'Unlucky Rush' || (skill.name === 'Chain Reaction Shot' && !skill.part2)) ? ratio(i,L(i) * (skill.name === 'Unlucky Rush' ? 2500 : 700)) : 0) };
  if (skill.name === 'Chain Reaction Shot' && skill.part2) {
    const secondary = skill.part2;
    result.part2 = { ...secondary, formula: i => secondary.formula(i) + (on(i,'_Preview_Chasing') ? ratio(i,L(i) * 700) : 0) };
  }
  wrapped.add(result);
  return result;
}

import { ElementType } from '../constants/element-type.const';
import type { SKILL_NAME } from '../constants/skill-name';
import type { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import type { ClassAutoCastDefinition } from '../models/auto-cast.model';
import { PREVIEW_285_DESCRIPTIONS, PREVIEW_285_REFERENCE, Preview285Name } from './preview-285-reference';

type Input = AtkSkillFormulaInput;
const on = (i: Pick<Input, 'skills'>, name: SKILL_NAME) => i.skills.isActive(name);
const learned = (i: Input, name: SKILL_NAME) => i.skills.learnedLevel(name);
const scale = (i: Input, value: number) => value * i.model.level / 100;
const level = (i: Input) => i.skillLevel;
const requirement = (name: SKILL_NAME, label: string) => (i: Input) => on(i, name) ? '' : label;
const ninja = [ClassName.Shinkiro, ClassName.Shiranui];
const ref = (name: Preview285Name) => PREVIEW_285_REFERENCE.find(s => s.name === name)!;

function attack(classes: ClassName[], name: Preview285Name, patch: Pick<AtkSkillModel, 'formula'> & Partial<AtkSkillModel>) {
  const r = ref(name);
  const skill: AtkSkillModel = {
    name, label: name, value: `${name}==${r.maxLevel}`, labelSuffix: 'Prévia', preview: true, previewVersion: '285/65',
    previewDescription: PREVIEW_285_DESCRIPTIONS[r.id], timingUnknown: true,
    levelList: Array.from({ length: r.maxLevel }, (_, n) => ({ label: `${name} (Prévia) Nv${n + 1}`, value: `${name}==${n + 1}` })),
    // Structural placeholders only. timingUnknown prevents an invented DPS estimate.
    cd: 0, acd: 0, fct: 0, vct: 0, ...patch,
  };
  return { classes, skill };
}

const crit = { canCri: true, criDmgPercentage: 0.5 };
const traps = [
  ['Primed Solid Trap', ElementType.Earth], ['Primed Deep Blind Trap', ElementType.Dark],
  ['Primed Swift Trap', ElementType.Wind], ['Primed Flame Trap', ElementType.Fire],
] as const;
export const INTEGRATION_PROCS = [
  { name: 'Burning Flame', element: ElementType.Fire, spirit: 2 },
  { name: 'Frozen Hail', element: ElementType.Water, spirit: 1 },
  { name: 'Storm Rise', element: ElementType.Wind, spirit: 3 },
  { name: 'Terra Burst', element: ElementType.Earth, spirit: 4 },
  { name: 'Venom Bombard', element: ElementType.Poison, spirit: 5 },
] as const;

/** Only published terms are applied. Unknown trait coefficients are not guessed. */
export const PREVIEW_285_ATTACKS = [
  attack([ClassName.DragonKnight], 'Servant Weapon-Cleave', {
    ...crit, isMelee: true, totalHit: i => on(i, 'Vigor') ? 4 : 3,
    formula: i => scale(i, on(i, 'Vigor') ? 150 + level(i) * 1050 : 300 + level(i) * 750),
  }),
  attack([ClassName.ImperialGuard], 'Shield Slam', {
    isMelee: (_, i) => !i?.skills.isActive('Holy Shield'),
    verifyItemFn: i => i.model.shield ? '' : 'Escudo',
    formula: i => scale(i, 1000 + level(i) * 4000 + learned(i, 'Shield Mastery') * 300),
  }),
  attack([ClassName.Meister], 'Overdrive Protocol', {
    ...crit, canCri: i => on(i, '_Preview_ABR Infinity'), totalHit: i => on(i, '_Meister_ABR_Cannon') ? 4 : 2,
    formula: i => scale(i, 2600 + level(i) * 1050 + learned(i, 'ABR Mastery') * 50),
  }),
  attack([ClassName.Biolo], 'Rampant Vine', {
    ...crit, totalHit: i => on(i, '_Preview_Creeper') ? 5 : 2,
    formula: i => scale(i, 1000 + level(i) * 700 + learned(i, 'Bionics Mastery') * 40),
  }),
  attack([ClassName.AbyssChaser], 'Phantom Dagger', {
    isMelee: true, totalHit: i => 3 + level(i) * 0.15,
    verifyItemFn: i => i.weapon.isType('dagger', 'sword') ? '' : 'Adaga ou espada de uma mão',
    formula: i => scale(i, 7000 + level(i) * 1150),
  }),
  attack([ClassName.ArchMage], 'Wraith Dash', { isMatk: true, element: ElementType.Ghost, formula: i => 3000 + level(i) * 4000 }),
  ...INTEGRATION_PROCS.map(proc => attack([ClassName.ElementalMaster], proc.name, {
    isMatk: true, element: proc.element, totalHit: 3,
    formula: i => scale(i, 4400 + level(i) * 400 + (i.skills.activeLevel('_ElementalMaster_spirit') === proc.spirit ? 700 : 0)),
  })),
  attack([ClassName.Cardinal], 'Punitio', {
    ...crit, totalHit: 4, isMelee: weapon => weapon !== 'mace',
    formula: i => scale(i, 1000 + level(i) * 550 + learned(i, 'Mace & Book Mastery') * 35),
  }),
  attack([ClassName.Cardinal], 'Lex Expiatrix', {
    isMatk: true, totalHit: 3, getElement: (_, i) => on(i, '_Preview_Ancilla') ? ElementType.Neutral : ElementType.Holy,
    formula: i => scale(i, 1500 + level(i) * (on(i, 'Competentia') ? 1350 : 1000) + learned(i, 'Fidus Animus') * 50),
  }),
  attack([ClassName.Inquisitor], 'Sky-Shattering Strike', {
    ...crit, isMelee: true, canCri: i => on(i, 'First Faith Power') && !on(i, 'Judge') && !on(i, 'Third Exor Flame'),
    totalHit: i => on(i, 'Third Exor Flame') ? 2 : on(i, 'Judge') ? 4 : 3,
    verifyItemFn: i => ['First Faith Power', 'Judge', 'Third Exor Flame'].some(n => on(i, n as SKILL_NAME)) ? '' : 'Auréola do Poder, do Juiz ou das Chamas',
    formula: i => scale(i, 2450 + level(i) * 1100),
  }),
  attack([ClassName.Windhawk], 'Fragment Bolt', {
    ...crit, totalHit: 2, verifyItemFn: i => i.weapon.isType('bow') ? '' : 'Arco', formula: i => scale(i, 3000 + level(i) * 800),
  }),
  ...traps.map(([name, element]) => attack([ClassName.Windhawk], name, {
    isMelee: true, element,
    verifyItemFn: i => on(i, 'Wug Rider') ? 'Fora da montaria em Worg' : requirement('Primed Trap', 'Primed Trap (Prévia)')(i),
    formula: i => scale(i, level(i) * 3950 + learned(i, 'Advanced Trap') * 50),
  })),
  attack([ClassName.Troubadour, ClassName.Trouvere], 'Fugue Des Fleches', {
    totalHit: 8, verifyItemFn: i => i.weapon.isType('instrument', 'whip', 'bow') ? '' : 'Instrumento, chicote ou arco',
    formula: i => scale(i, (on(i, 'Mystic Symphony') ? 200 + level(i) * 350 : 300 + level(i) * 250)),
  }),
  attack(ninja, 'Shadow Torrent', {
    ...crit, isMelee: true, totalHit: 4,
    formula: i => level(i) * (on(i, 'Surge') ? 850 : 650) + learned(i, 'Shadow Dance') * 120,
  }),
  attack([ClassName.SkyEmperor], 'Seven-Star Heavenly Kick', {
    isMelee: true, maxStack: 7, defaultStack: 0,
    verifyItemFn: i => i.skills.activeLevel('_SkyEmperor_Celestial_Space') === 7 ? '' : 'Elo Celestial',
    formula: i => scale(i, i.stack === 7 ? (level(i) + 1) * 7770 : level(i) * 7000),
  }),
  attack([ClassName.SoulAscetic], 'Yellow Dragon Talisman', {
    isMatk: true, totalHit: 3, getElement: (_, i) => i.model.propertyAtk ?? ElementType.Neutral,
    verifyItemFn: i => i.skills.activeLevel('_SoulAscetic_Blessing') >= 4 ? '' : 'Bênção do Jabuti ou Mandala das Feras',
    formula: i => scale(i, (i.skills.activeLevel('_SoulAscetic_Blessing') === 5 ? 850 + level(i) * 1950 : 850 + level(i) * 1550) + learned(i, 'Talisman Mastery') * 100),
  }),
  attack([ClassName.HyperNovice], 'Wind Cutter Turbo', {
    totalHit: 5, formula: i => scale(i, level(i) * 550 + learned(i, 'Self Study Tactics') * 15),
  }),
  attack([ClassName.HyperNovice], 'High Magnum Break', {
    ...crit, isMelee: true, formula: i => scale(i, level(i) * 1600 + learned(i, 'Self Study Tactics') * 15),
  }),
];

export const preview285SkillsForClass = (name: ClassName): AtkSkillModel[] =>
  PREVIEW_285_ATTACKS.filter(d => d.classes.includes(name)).map(d => ({ ...d.skill }));

function buff(name: SKILL_NAME, maxLevel = 1, bonus?: (level: number) => Record<string, number>, description?: string): ActiveSkillModel {
  const r = PREVIEW_285_REFERENCE.find(s => s.name === name);
  const off = { label: 'Não', value: 0, isUse: false };
  const levels = Array.from({ length: maxLevel }, (_, n) => ({ label: maxLevel === 1 ? 'Sim' : `Nv ${n + 1}`, value: n + 1, isUse: true, bonus: bonus?.(n + 1) }));
  return { name, label: `${name.replace('_Preview_', '')} (Prévia)`, preview: true, previewVersion: '285/65',
    previewDescription: description ?? (r ? PREVIEW_285_DESCRIPTIONS[r.id] : undefined),
    inputType: maxLevel === 1 ? 'selectButton' : 'dropdown',
    // Par de botões: o "Sim" à esquerda. Lista de níveis: começa no desligado.
    dropdown: maxLevel === 1 ? [...levels, off] : [off, ...levels],
  };
}

export function preview285BuffsForClass(name: ClassName): ActiveSkillModel[] {
  switch (name) {
    case ClassName.ShadowCross: return [buff('Venom Ignition', 5, lv => ({ hit: 50 + lv * 20, nonCriticalDamage: 25 + lv * 15 }))];
    case ClassName.Shinkiro:
    case ClassName.Shiranui: return [buff('Mirage - Cluster'), buff('Surge', 5, lv => ({ nonCriticalDamage: lv * 10, criDmg: lv * 10, melee: lv * 30, range: lv * 30 }))];
    case ClassName.Windhawk: return [buff('Primed Trap')];
    case ClassName.NightWatch: return [buff('Tactical Repositioning')];
    case ClassName.Meister: return [{ ...buff('_Preview_ABR Infinity', 1, undefined, 'ABR-Infinity enables Overdrive Protocol critical hits. This summon is mutually exclusive with ABR-Battle Warrior and ABR-Dual Cannon.'), exclusiveGroup: 'meister_abr' }];
    case ClassName.Biolo: return [buff('_Preview_Creeper', 1, undefined, 'Creeper changes Rampant Vine from 2 to 5 hits.')];
    case ClassName.ElementalMaster: return [buff('Elemental Integration', 5)];
    case ClassName.SpiritHandler: return [
      buff('Resonance of Gwiseol - Cheolho', 1, () => ({ '5435': 50, '5436': 30, '5437': 60, '5506': 50 })),
      buff('Spirit Tongue Resonance - Hyeonrok', 1, () => ({ '5445': 50, '5446': 30, '5507': 60 })),
    ];
    default: return [];
  }
}

export function preview285PassivesForClass(name: ClassName): ActiveSkillModel[] {
  if (name === ClassName.ElementalMaster) return [buff('Elemental Integration', 5, undefined, 'Learned level sets the triggered magic level. The active control selects the element. If left unset, the selected active level is used.')];
  if (name === ClassName.Meister) return [buff('ABR Mastery', 10)];
  if (name === ClassName.Biolo) return [buff('Bionics Mastery', 10)];
  return [];
}

/** Proc skill id, element and selected buff level must agree. No automatic AP state. */
export const PREVIEW_285_AUTOCAST: ClassAutoCastDefinition = {
  key: 'preview-elemental-integration',
  resolve: ({ skillState, skillById }) => {
    const lv = skillState.activeLevel('Elemental Integration');
    const procLevel = Math.max(lv, skillState.learnedLevel('Elemental Integration'));
    const proc = INTEGRATION_PROCS[lv - 1];
    if (!proc) return {};
    const id = ref(proc.name).id;
    return { sources: [{ key: 'preview-elemental-integration', kind: 'passive', sourceName: 'Elemental Integration (Prévia)',
      enablingSkillId: 6615, skillId: id, skillLevel: procLevel, chance: 25, trigger: 'physical-attack', skillData: skillById(id) }] };
  },
};

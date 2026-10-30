import { ElementType } from '../constants/element-type.const';
import type { AtkSkillFormulaInput, AtkSkillModel } from '../jobs/_character-base.abstract';
import { ClassName } from '../jobs/_class-name';
import type { SKILL_NAME } from '../constants/skill-name';
import { REBALANCE_2026_REFERENCE, RebalanceTiming } from './rebalance-2026-reference';
import { REBALANCE_2022_REFERENCE } from './rebalance-2022-reference';
import { isLatamBaseline, type SkillFormulaVersion } from './skill-formula-version';

type Input = AtkSkillFormulaInput;
type Formula = AtkSkillModel['formula'];
type Patch = Partial<AtkSkillModel>;
const lv = (i: Input) => i.skillLevel;
const pow = (i: Input) => i.status.totalPow;
const spl = (i: Input) => i.status.totalSpl;
const con = (i: Input) => i.status.totalCon;
const learned = (i: Input, name: SKILL_NAME) => i.skills.learnedLevel(name);
const active = (i: Input, name: SKILL_NAME) => i.skills.isActive(name);
const state = (i: Input, name: SKILL_NAME) => i.skills.activeLevel(name);
const scale = (i: Input, ratio: number) => ratio * (i.model.level / 100);
const linear = (base: number, perLevel: number, trait: 'pow' | 'spl' | 'con', coefficient: number): Formula =>
  i => scale(i, base + lv(i) * perLevel + i.status[trait === 'pow' ? 'totalPow' : trait === 'spl' ? 'totalSpl' : 'totalCon'] * coefficient);
const race = (i: Input, ...names: Parameters<Input['monster']['isRace']>) => i.monster.isRace(...names);
const climax = (i: Input) => state(i, 'Climax');
const part = (formula: Formula, element: ElementType, isMatk = true, hit = 1): NonNullable<AtkSkillModel['part2']> =>
  ({ label: 'Dano adicional', isIncludeMain: false, element, isMatk, isMelee: false, hit, formula });

/** Ratios from the February class articles; hit is a display split, totalHit is a full-ratio packet. */
export const REBALANCE_2026_PATCHES: Record<string, Patch> = {
  'Soul Vulcan Strike': { formula: linear(0, 250, 'spl', 3), totalHit: i => lv(i) + 2 },
  'Mystery Illusion': { formula: linear(0, 950, 'spl', 5), totalHit: i => [0, 7, 7, 10, 10, 13][lv(i)] },
  'Deadly Projection': { formula: linear(0, 2800, 'spl', 5) },
  'Floral Flare Road': { formula: linear(50, 740, 'spl', 5), totalHit: 10 },
  'Rain of Crystal': { formula: linear(180, 760, 'spl', 5), totalHit: 8 },
  'Tornado Storm': { formula: linear(100, 760, 'spl', 5), totalHit: 10 },
  'Stratum Tremor': { formula: linear(100, 730, 'spl', 5), totalHit: 10 },
  'Crimson Arrow': { formula: linear(0, 350, 'spl', 3), hit: 1, part2: part(i => scale(i, lv(i) * (climax(i) ? 1200 : 700) + spl(i) * 5), ElementType.Fire, true, 2) },
  'Frozen Slash': { formula: i => scale(i, (climax(i) ? 550 : 400) + lv(i) * (climax(i) ? 1250 : 900) + spl(i) * 5), hit: 3 },
  'Storm Cannon': { formula: i => scale(i, lv(i) * (climax(i) ? 1500 : 1200) + spl(i) * 5), hit: 2 },
  'Rock Down': { formula: i => scale(i, lv(i) * (climax(i) ? 1500 : 1200) + spl(i) * 5), hit: 5 },
  'All Bloom': { formula: i => climax(i) === 4 ? 0 : scale(i, 200 + lv(i) * 1200 + spl(i) * 5), damageRepeat: i => lv(i) * 4 * (climax(i) === 2 ? 2 : 1), totalHit: 1, part2: part(i => climax(i) === 5 ? 85000 : 0, ElementType.Fire) },
  'Crystal Impact': { formula: i => scale(i, 250 + lv(i) * 1300 + spl(i) * 5) * crystalFactor(i, 1), damageRepeat: i => climax(i) === 2 ? 2 : 1, totalHit: 1, part2: part(i => scale(i, 250 + lv(i) * 1300 + spl(i) * 5) * crystalFactor(i, 2), ElementType.Water) },
  'Destructive Hurricane': { formula: i => climax(i) === 4 ? 0 : scale(i, 600 + lv(i) * 2850 + spl(i) * 5), part2: part(i => climax(i) === 1 ? 12500 : 0, ElementType.Wind) },
  'Violent Quake': { formula: i => climax(i) === 4 ? 0 : scale(i, 200 + lv(i) * 1200 + spl(i) * 5), totalHit: i => lv(i) * 4 * (climax(i) === 1 ? 2 : 1) },
  'Astral Strike': { formula: i => scale(i, (race(i, 'undead', 'dragon') ? 400 : 300) + lv(i) * (race(i, 'undead', 'dragon') ? 2100 : 1800) + spl(i) * 10), part2: { ...part(i => scale(i, lv(i) * 650 + spl(i) * 10), ElementType.Neutral), damageRepeat: 19 } },

  'Servant Weapon': { formula: linear(500, 400, 'pow', 5), totalHit: 2, canCri: true },
  'Servant Weapon-Phantom': { formula: linear(200, 300, 'pow', 5), totalHit: i => i.stack ?? 5, maxStack: 5, minStack: 1, defaultStack: 5, canCri: true },
  'Servant Weapon-Demolition': { formula: linear(0, 500, 'pow', 5), totalHit: i => i.stack ?? 5, maxStack: 5, minStack: 1, defaultStack: 5, canCri: true },
  'Hack and Slasher': { formula: linear(200, 750, 'pow', 7), totalHit: 2, canCri: true, criDmgPercentage: 0.5, isMelee: i => i === 'twohandSword' },
  // Giant Growth doubles a cast with 60% probability: show its mean ratio.
  'Storm Slash': { formula: i => scale(i, 200 + lv(i) * 400 + pow(i) * 5) * (active(i, 'Turisus Runestone') ? 1.6 : 1), totalHit: i => lv(i) },
  'Madness Crusher': { formula: i => scale(i, 350 + lv(i) * 1600 + pow(i) * 10 + (i.weapon.data.weight ?? 0) * (i.weapon.data.baseWeaponLevel ?? 0)) },
  'Dragonic Aura': { formula: i => scale(i, lv(i) * (race(i, 'demihuman', 'angel') ? 3800 : 3650) + pow(i) * 10) },
  'Dragonic Breath': { formula: i => scale(i, 50 + lv(i) * (350 + (active(i, 'Dragonic Aura') ? 0.07 : 0.05) * (i.maxHp / 8 + i.maxSp / 4)) + pow(i) * (active(i, 'Dragonic Aura') ? 10 : 7)), isIgnoreDef: true, isIgnoreSDef: true, hit: 2 },

  'Solid Trap': { formula: trapRatio, totalHit: i => (2.5 + lv(i) * 0.5 + learned(i, 'Advanced Trap')) / 0.5 },
  'Deep Blind Trap': { formula: trapRatio, totalHit: i => (2.5 + lv(i) * 0.5 + learned(i, 'Advanced Trap')) / 0.5 },
  'Flame Trap': { formula: trapRatio, totalHit: i => (2.5 + lv(i) * 0.5 + learned(i, 'Advanced Trap')) / 0.5 },
  'Swift Trap': { formula: trapRatio, totalHit: i => (2.5 + lv(i) * 0.5 + learned(i, 'Advanced Trap')) / 0.5 },
  'Hawk Rush': { formula: i => scale(i, lv(i) * 500 + con(i) * 5) * (1 + 0.1 * learned(i, 'Nature Friendly')) },
  'Hawk Boomerang': { formula: i => scale(i, lv(i) * (race(i, 'brute', 'fish') ? 750 : 600) + con(i) * 10) * (1 + 0.1 * learned(i, 'Nature Friendly')), canCri: true, criDmgPercentage: 0.5, element: ElementType.Neutral },
  'Crescive Bolt': { formula: i => scale(i, 400 + lv(i) * 900 + con(i) * 10) * (1 + 0.1 * (i.stack ?? 3)) * (active(i, 'Calamity Gale') ? 1.2 * (race(i, 'brute', 'fish') ? 1.5 : 1) : 1) },
  'Gale Storm': { formula: i => scale(i, lv(i) * 1000 + con(i) * 10) * (active(i, 'Calamity Gale') && race(i, 'brute', 'fish') ? 1.5 : 1) },

  'Shadow Stab': { formula: i => scale(i, lv(i) * (active(i, 'Cloaking Exceed') ? 400 : 350) + pow(i) * (active(i, 'Cloaking Exceed') ? 7 : 5)), totalHit: i => active(i, 'Cloaking Exceed') ? 3 : 2 },
  'Dancing Knife': { formula: linear(0, 200, 'pow', 5) },
  'Eternal Slash': { formula: i => scale(i, lv(i) * (active(i, 'Shadow Exceed') ? 365 : 265) + pow(i) * (active(i, 'Shadow Exceed') ? 3 : 2)), totalHit: i => i.stack ?? 1 },
  'Savage Impact': { formula: i => scale(i, lv(i) * (active(i, 'Shadow Exceed') ? 110 : 90) + pow(i) * (active(i, 'Shadow Exceed') ? 7 : 5)), totalHit: i => active(i, 'Cloaking Exceed') ? 5 : 3, verifyItemFn: undefined },
  'Impact Crater': { formula: linear(0, 80, 'pow', 3), totalHit: i => state(i, 'Spin Count') || 1 },
  'Fatal Shadow Claw': { formula: i => scale(i, lv(i) * (race(i, 'demihuman', 'dragon') ? 1450 : 1300) + pow(i) * 10) },

  'Abyss Dagger': { formula: linear(100, 900, 'pow', 5), totalHit: 2 },
  'Unlucky Rush': { formula: linear(100, 300, 'pow', 5) },
  'Deft Stab': { formula: linear(250, 350, 'pow', 5), totalHit: 5 },
  'Chain Reaction Shot': { formula: linear(0, 850, 'con', 15), part2: part(linear(600, 2350, 'con', 15), ElementType.Neutral, false) },
  'Frenzy Shot': { formula: linear(150, 600, 'con', 15), totalHit: i => 2 + lv(i) * 0.05, canCri: true },
  'From the Abyss': { formula: linear(100, 500, 'spl', 5), totalHit: 2 },
  'Abyss Square': { formula: i => scale(i, lv(i) * (570 + learned(i, 'Magic Sword Mastery') * 20) + spl(i) * 5), totalHit: 10 },
  'Omega Abyss Strike': { formula: i => scale(i, lv(i) * (race(i, 'angel', 'demon') ? 2350 : 2200) + spl(i) * 10) },

  'First Brand': { formula: linear(0, 1200, 'pow', 5) },
  'Second Faith': { formula: linear(100, 2300, 'pow', 5), hit: 2 },
  'Third Punish': { formula: linear(350, 1500, 'pow', 10), totalHit: 3, canCri: true },
  'Second Judgement': { formula: linear(150, 2600, 'pow', 7), hit: 3 },
  'Third Consecration': { formula: linear(0, 700, 'pow', 10), totalHit: 5 },
  'Second Flame': { formula: linear(100, 2900, 'pow', 9) },
  'Third Flame Bomb': { formula: i => scale(i, lv(i) * 650 + pow(i) * 10 + i.maxHp / 5), totalHit: i => Math.max(1, Math.min(3, Math.ceil(state(i, 'Total Spirit') / 5))) },
  'Oleum Sanctum': { formula: linear(500, 2000, 'pow', 5) },
  'Explosion Blaster': { formula: i => scale(i, (active(i, 'Oleum Sanctum') ? 350 : 0) + lv(i) * (active(i, 'Oleum Sanctum') ? 3450 : 2400) + pow(i) * (active(i, 'Oleum Sanctum') ? 15 : 10)), canCri: true },
  'Massive Flame Blaster': { formula: i => scale(i, lv(i) * (race(i, 'demihuman', 'brute') ? 2450 : 2300) + pow(i) * 15), canCri: true },

  'Overslash': { formula: i => scale(i, lv(i) * (160 + learned(i, 'Spear & Sword Mastery') * 250) + pow(i) * 7), totalHit: i => (i.stack ?? 1) >= 4 ? 7 : (i.stack ?? 1) >= 2 ? 5 : 3, minStack: 1, maxStack: 4, defaultStack: 1 },
  'Shield Shooting': { formula: i => scale(i, 650 + lv(i) * (2850 + learned(i, 'Shield Mastery') * 50) + pow(i) * 7 + (i.equipmentBonus.shield?.weight ?? 0) + (i.equipmentBonus.shield?.refine ?? 0) * 25) },
  'Cross Rain': { formula: i => scale(i, lv(i) * (active(i, 'Holy Shield') ? 450 + learned(i, 'Spear & Sword Mastery') * 15 : 320 + learned(i, 'Spear & Sword Mastery') * 10) + spl(i) * 7), totalHit: 8 },
  'Grand Judgement': { formula: i => scale(i, (race(i, 'plant', 'insect') ? 350 : 250) + lv(i) * (race(i, 'plant', 'insect') ? 1650 : 1250) + pow(i) * 7) },
  'Judgement Cross': { formula: i => scale(i, lv(i) * (race(i, 'plant', 'insect') ? 2100 : 1950) + spl(i) * 10), hit: 10 },

  'Sound Blend': { formula: i => scale(i, lv(i) * 120 + spl(i) * 0.5 * learned(i, 'Stage Manner')) },
  'Metallic Fury': { formula: i => scale(i, lv(i) * (active(i, '_Debuf_Sonic_Brand') ? 3600 : 2600) + spl(i) * (active(i, '_Debuf_Sonic_Brand') ? 2 : 1.5) * learned(i, 'Stage Manner')) },
  'Rhythm Shooting': { formula: i => scale(i, (active(i, '_Debuf_Sonic_Brand') ? 800 : 450) + lv(i) * (active(i, '_Debuf_Sonic_Brand') ? 750 : 650) + con(i) * (active(i, '_Debuf_Sonic_Brand') ? 7 : 5) * learned(i, 'Stage Manner')), totalHit: 3 },
  'Rose Blossom': { formula: i => scale(i, 200 + lv(i) * (active(i, '_Debuf_Sonic_Brand') ? 2200 : 2000) + con(i) * 3 * learned(i, 'Stage Manner')), hit: 2, part2: part(i => scale(i, 250 + lv(i) * (active(i, '_Debuf_Sonic_Brand') ? 3000 : 2800) + con(i) * 3 * learned(i, 'Stage Manner')), ElementType.Neutral, false) },

  'Framen': { formula: i => scale(i, lv(i) * ((race(i, 'demon', 'undead') ? 1050 : 950) + learned(i, 'Fidus Animus') * 5) + spl(i) * (race(i, 'demon', 'undead') ? 5 : 3)) },
  'Arbitrium': { formula: i => scale(i, lv(i) * (1000 + learned(i, 'Fidus Animus') * 10) + spl(i) * 10), part2: part(i => scale(i, lv(i) * (1750 + learned(i, 'Fidus Animus') * 50) + spl(i) * 10), ElementType.Holy) },
  'Petitio': { formula: i => scale(i, lv(i) * (1050 + learned(i, 'Mace & Book Mastery') * 50) + pow(i) * 5) },
  'Pneumaticus Procella': { formula: i => scale(i, (race(i, 'demon', 'undead') ? 200 : 150) + lv(i) * (race(i, 'demon', 'undead') ? 2250 : 2100) + spl(i) * 10 + learned(i, 'Fidus Animus') * (race(i, 'demon', 'undead') ? 5 : 3)), totalHit: 4, hit: 10 },
  'Effligo': { formula: i => scale(i, lv(i) * (race(i, 'demon', 'undead') ? 1800 : 1650) + pow(i) * 7 + learned(i, 'Mace & Book Mastery') * (race(i, 'demon', 'undead') ? 15 : 8)) },

  'Acidified Zone Earth': { formula: acidRatio, totalHit: 7, hit: 1 },
  'Acidified Zone Fire': { formula: acidRatio, totalHit: 7, hit: 1 },
  'Acidified Zone Water': { formula: acidRatio, totalHit: 7, hit: 1 },
  'Acidified Zone Wind': { formula: acidRatio, totalHit: 7, hit: 1 },
  'Explosive Powder': { formula: i => scale(i, 400 + lv(i) * (active(i, 'Research Report') ? 650 : 550) + pow(i) * (active(i, 'Research Report') ? 10 : 7)), totalHit: i => active(i, 'Research Report') ? 5 : 3 },
  'Mayhemic Thorns': { formula: i => scale(i, (active(i, 'Research Report') ? 350 : 200) + lv(i) * 300 + pow(i) * (active(i, 'Research Report') ? 10 : 7)), totalHit: i => active(i, 'Research Report') ? 4 : 3, canCri: true },

  'Diamond Storm': { formula: i => elementalRatio(i, 1, false) },
  'Terra Drive': { formula: i => elementalRatio(i, 4, false) },
  'Conflagration': { formula: i => elementalRatio(i, 2, true), totalHit: 10 },
  'Lightning Land': { formula: i => elementalRatio(i, 3, true), totalHit: 10 },
  'Venom Swamp': { formula: i => elementalRatio(i, 5, true), totalHit: 10 },
  'Elemental Buster': { formula: i => scale(i, 500 + lv(i) * (race(i, 'dragon', 'formless') ? 2350 : 2200) + spl(i) * 10) },

  'Axe Stomp': { formula: linear(400, 950, 'pow', 5), totalHit: i => i.weapon.isType('twohandAxe') ? 3 : 1 },
  'Activation Attack Machine': { formula: i => (lv(i) * 100 + pow(i) * 5) * i.monster.data.level / 100, hitEveryNSec: 1 },
  'Rush Quake': { formula: i => scale(i, lv(i) * (race(i, 'formless', 'insect') ? 3750 : 3600) + pow(i) * 10) },
  'Spark Blaster': { formula: linear(250, 900, 'pow', 7), totalHit: 2 },
  'Triple Laser': { formula: linear(550, 900, 'pow', 12), totalHit: 3, canCri: true },
  'Mighty Smash': { formula: i => scale(i, (active(i, 'Axe Stomp') ? 50 : 25) + lv(i) * 180 + pow(i) * (active(i, 'Axe Stomp') ? 10 : 7)), totalHit: i => active(i, 'Axe Stomp') ? 7 : 5 },

  'The Vigilante at Night': { formula: i => i.weapon.isSubType('Gatling Gun') ? aimed(i, 0, 300, 100, 2) : aimed(i, 800, 700, 200, 3), totalHit: i => i.weapon.isSubType('Gatling Gun') ? 7 : 4 },
  'Only One Bullet': { formula: i => aimed(i, 1200, i.weapon.isSubType('Rifle') ? 3000 : 3400, 350, 3) },
  'Spiral Shooting': { formula: i => i.weapon.isSubType('Rifle') ? aimed(i, 1400, 2800, 150, 3) : aimed(i, 1200, 1700, 150, 3), totalHit: i => i.weapon.isSubType('Rifle') ? 1 : 2 },
  'Magazine for One': { formula: i => i.weapon.isSubType('Gatling Gun') ? aimed(i, 250, 500, 100, 2) : aimed(i, 300, 800, 100, 2), totalHit: i => i.weapon.isSubType('Gatling Gun') ? 10 : 6 },
  'Wild Fire': { formula: i => aimed(i, 1500, i.weapon.isSubType('Shotgun') ? 3200 : 3000, 500, 3) },
  'Basic Grenade': { formula: i => grenade(i, 1500, 2100, 50, 5), hit: 2 },
  'Hasty Fire in the Hole': { formula: i => grenade(i, 1500, 1500, 20, 3), totalHit: 3, hit: 2 },
  'Grenade Dropping': { formula: i => grenade(i, 550, 850, 20, 3), totalHit: 48 },
  'Mission Bombard': { formula: i => grenade(i, 5000, 1800, 100, 5), damageRepeat: 3, totalHit: 1, part2: { ...part(i => grenade(i, 800, 200, 30, 5), ElementType.Neutral, false), damageRepeat: 120 } },

  'Talisman of Soul Stealing': { formula: i => scale(i, 500 + lv(i) * (1250 + (learned(i, 'Talisman Mastery') + learned(i, 'Soul Mastery')) * 7) + spl(i) * 3) },
  'Exorcism of Malicious Soul': { formula: i => scale(i, (lv(i) * (active(i, 'Totem of Tutelary') ? 250 : 150) + learned(i, 'Soul Mastery') * 2 + spl(i)) * (state(i, 'Total Soul') || 1)) },
  'Talisman of Blue Dragon': { formula: i => talisman(i, 600, mandala(i) ? 2200 : 1700), hit: 1 },
  'Talisman of White Tiger': { formula: i => talisman(i, 400, mandala(i) ? 1400 : 1000), hit: 2 },
  'Talisman of Red Phoenix': { formula: i => talisman(i, mandala(i) ? 1400 : 1200, mandala(i) ? 1650 : 1250), hit: 3 },
  'Talisman of Black Tortoise': { formula: i => talisman(i, mandala(i) ? 2300 : 2150, mandala(i) ? 2100 : 1600), hit: 3 },
  'Talisman of Four Bearing God': { formula: i => talisman(i, 50, 250), totalHit: i => mandala(i) ? 7 : state(i, '_SoulAscetic_Blessing') + 1 },
  'Mandala of the Beasts': { formula: i => scale(i, 500 + lv(i) * (2000 + (learned(i, 'Talisman Mastery') + learned(i, 'Soul Mastery')) * 15) + spl(i) * 5), totalHit: 5 },

  'Infiltration': { formula: linear(0, 700, 'con', 3), hit: 2 },
  'Melting': { formula: linear(0, 700, 'con', 3.5), hit: 3 },
  'Shadow Hunting': { formula: i => scale(i, 600 + lv(i) * (900 + learned(i, 'Shadow Flash') * 5) + pow(i) * 3) },
  'Shadow Dance': { formula: i => scale(i, 550 + lv(i) * (750 + learned(i, 'Shadow Hunting') * 50) + pow(i) * 4), hit: 5 },
  'Shadow Flash': { formula: i => scale(i, 1500 + lv(i) * (750 + learned(i, 'Shadow Dance') * 50) + pow(i) * 5), hit: 1, canCri: true },
  'Huuma Shuriken - Grasp': { formula: i => scale(i, 850 + lv(i) * (350 + learned(i, 'Huuma Shuriken - Construct') * 5) + pow(i) * 3), totalHit: 20 },
  'Huuma Shuriken - Construct': { formula: i => scale(i, 600 + lv(i) * (1200 + learned(i, 'Huuma Shuriken - Grasp') * 30) + pow(i) * 5), hit: 3, part2: part(i => active(i, '_Preview_Hidden Weapon') ? scale(i, 600 + lv(i) * (1500 + learned(i, 'Huuma Shuriken - Grasp') * 30) + pow(i) * 5) : 0, ElementType.Neutral, false, 6) },
  'Kunai - Distortion': { formula: i => scale(i, 300 + lv(i) * (600 + learned(i, 'Kunai - Refraction') * 10) + pow(i) * 3), hit: 2 },
  'Kunai - Rotation': { formula: i => scale(i, 800 + lv(i) * (700 + learned(i, 'Kunai - Distortion') * 70) + pow(i) * 4), totalHit: 4, hit: 3 },
  'Kunai - Refraction': { formula: i => scale(i, 200 + lv(i) * (360 + learned(i, 'Kunai - Rotation') * 10) + pow(i) * 5), totalHit: 8, hit: 3 },
  'Red Flame Cannon': { formula: i => scale(i, 500 + lv(i) * (1000 + learned(i, 'Darkening Cannon') * 70) + spl(i) * 5), hit: 3 },
  'Cold Blooded Cannon': { formula: i => scale(i, 350 + lv(i) * (850 + learned(i, 'Darkening Cannon') * 40) + spl(i) * 5), hit: 6 },
  'Thundering Cannon': { formula: i => scale(i, 500 + lv(i) * (450 + learned(i, 'Darkening Cannon') * 70) + spl(i) * 5), hit: 2 },
  'Golden Dragon Cannon': { formula: i => scale(i, 450 + lv(i) * 950 + learned(i, 'Darkening Cannon') * 15 + spl(i) * 5) },
  'Darkening Cannon': { formula: linear(450, 950, 'spl', 5), hit: 2 },
  'Shadow - Nightmare': { formula: i => scale(i, 18000 + pow(i) * 10) * (active(i, '_Preview_Nightmare') ? 1.5 : 1), hit: 4 },
  'Kunai - Nightmare': { formula: i => scale(i, 18000 + pow(i) * 10) * (active(i, '_Preview_Nightmare') ? 1.5 : 1), hit: 8 },
  'Dark Dragon - Nightmare': { formula: linear(15500, 0, 'spl', 10), hit: 4, totalHit: i => active(i, '_Preview_Nightmare') ? 2 : 1 },

  'Rising Sun': { formula: i => celestial(i, 500, 600, 5, 5), hit: 2 },
  'Noon Blast': { formula: i => celestial(i, 1600, 1250, 5, 5), hit: 2, canCri: i => skyState(i, 2) },
  'Sunset Blast': { formula: i => celestial(i, 950, 400, 5, 5), hit: 2, canCri: i => skyState(i, 3) },
  'Rising Moon': { formula: i => celestial(i, 700, 450, 5, 3), hit: 2 },
  'Midnight Kick': { formula: i => celestial(i, skyState(i, 5) ? 1550 : 600, skyState(i, 5) ? 1450 : 1200, 5, 5) },
  'Dawn Break': { formula: i => celestial(i, 400, skyState(i, 6) ? 600 : 400, 5, 5) },
  'Twinkling Galaxy': { formula: i => celestial(i, 300, 500, 3, 3), totalHit: 7, hit: 3 },
  'Star Burst': { formula: i => celestial(i, 500, 400, 5, 3), totalHit: 15, hit: 2 },
  'Star Cannon': { formula: i => celestial(i, 250, 550, 5, 5), totalHit: 5, hit: 3 },
  'All in the Sky': { formula: linear(250, 1200, 'pow', 10), totalHit: i => race(i, 'demihuman', 'demon') ? 3 : 1, canCri: true },

  'Chulho Sonic Claw': { formula: i => creature(i, 850, 850, 1650, 2050, 50, 100, false), hit: 2 },
  'Howling of Chulho': { formula: i => creature(i, 600, 700, 1050, 1150, 50, 100, false) },
  'Hogogong Strike': { formula: i => creature(i, 180, 250, 200, 350, 10, 20, false), totalHit: 3, canCri: true },
  'Hyunrok Breeze': { formula: i => creature(i, 650, 750, 750, 950, 20, 40, true), totalHit: 16 },
  'Hyunrok Cannon': { formula: i => creature(i, 1050, 1050, 1550, 1850, 50, 75, true) },

  'Double Bowling Bash': { formula: i => hyper(i, 200 + lv(i) * (300 + learned(i, 'Self Study Tactics') * 3) + pow(i) * 2, false, 1.7, 1, 5), totalHit: i => i.stack ?? 3, maxStack: 5, minStack: 3, defaultStack: 3, hit: 1 },
  'Mega Sonic Blow': { formula: i => hyper(i, 900 + lv(i) * (750 + learned(i, 'Self Study Tactics') * 5) + pow(i) * 4, false, 2, 1, 5) * (active(i, '_Preview_Target Below Half HP') ? 2 : 1), hit: 8 },
  'Shield Chain Rush': { formula: i => hyper(i, 700 + lv(i) * (500 + learned(i, 'Self Study Tactics') * 3) + pow(i) * 3, false, 1.7, 2, 10), hit: 5 },
  'Spiral Pierce Max': { formula: i => hyper(i, (700 + lv(i) * (800 + learned(i, 'Self Study Tactics') * 3)) * ({ s: 1.5, m: 1.3, l: 1.2 }[i.monster.size]) + pow(i) * 3, false, 2, 1, 5), hit: 5 },
  'Meteor Storm Buster': { formula: i => hyper(i, 300 + lv(i) * (320 + learned(i, 'Self Study Sorcery') * 5) + spl(i) * 3, true, 1.5) },
  'Jupitel Thunderstorm': { formula: i => hyper(i, lv(i) * (1800 + learned(i, 'Self Study Sorcery') * 3) + spl(i) * 3, true, 1.7), hitByLevel: level => 5 + Math.ceil(level / 2) },
  'Jack Frost Nova': { formula: i => hyper(i, 400 + lv(i) * (500 + learned(i, 'Self Study Sorcery') * 5) + spl(i) * 4, true, 1.7), totalHit: i => [0, 4, 5, 6, 6, 7, 7, 8, 9, 9, 10][lv(i)] },
  "Hell's Drive": { formula: i => hyper(i, 1500 + lv(i) * (700 + learned(i, 'Self Study Sorcery') * 4) + spl(i) * 3, true, 1.7) },
  'Ground Gravitation': { formula: i => hyper(i, 800 + lv(i) * (700 + learned(i, 'Self Study Sorcery') * 4) + spl(i) * 2, true, 1.5), totalHit: 10 },
  'Napalm Vulcan Strike': { formula: i => hyper(i, 350 + lv(i) * (650 + learned(i, 'Self Study Sorcery') * 4) + spl(i) * 3, true, 1.4, 2) },
};

/** June 2022 differences from the shared formulas above. Timings have their own
 * historical reference; no later cast data is used for this version. */
export const REBALANCE_2022_PATCHES: Record<string, Patch> = {
  ...REBALANCE_2026_PATCHES,
  'Crimson Arrow': { formula: linear(0, 300, 'spl', 3), hit: 1, part2: part(i => scale(i, lv(i) * (climax(i) ? 1200 : 600) + spl(i) * 5), ElementType.Fire, true, 2) },
  'Frozen Slash': { formula: i => scale(i, (climax(i) ? 400 : 250) + lv(i) * (climax(i) ? 1250 : 900) + spl(i) * 5), hit: 3 },
  'Storm Cannon': { formula: i => scale(i, lv(i) * (climax(i) ? 1250 : 950) + spl(i) * 5), hit: 2 },
  'Rock Down': { formula: i => scale(i, lv(i) * (climax(i) ? 1250 : 950) + spl(i) * 5), hit: 5 },
  'Destructive Hurricane': { ...REBALANCE_2026_PATCHES['Destructive Hurricane'], formula: i => climax(i) === 4 ? 0 : scale(i, 250 + lv(i) * 2800 + spl(i) * 5) },
  // Final Korean notice + historical implementation agree on 18000/21400 at Nv10.
  // The article gave 2140/lv on Undead and Dragon, which only lands on the client's Nv10
  // (21.400%). The client's own table is 400 + 2100/lv there and 300 + 1800/lv otherwise,
  // level by level, so this skill reads the same as the later bundle.
  'Astral Strike': REBALANCE_2026_PATCHES['Astral Strike'],

  'Hack and Slasher': { ...REBALANCE_2026_PATCHES['Hack and Slasher'], formula: linear(300, 700, 'pow', 7), canCri: false },
  'Storm Slash': { formula: i => scale(i, 100 + lv(i) * 170 + pow(i) * 5) * (active(i, 'Turisus Runestone') ? 1.3 : 1), totalHit: i => lv(i), canCri: true },
  'Madness Crusher': { formula: i => scale(i, 400 + lv(i) * 800 + pow(i) * 7 + (i.weapon.data.weight ?? 0) * (i.weapon.data.baseWeaponLevel ?? 0)) },

  'Crescive Bolt': { formula: i => scale(i, lv(i) * 340 + con(i) * 10) * (1 + 0.1 * (i.stack ?? 3)) * (active(i, 'Calamity Gale') ? 1.2 * (race(i, 'brute', 'fish') ? 1.5 : 1) : 1) },
  'Gale Storm': { formula: i => scale(i, lv(i) * 950 + con(i) * 5) * (active(i, 'Calamity Gale') && race(i, 'brute', 'fish') ? 1.5 : 1) },
  'Shadow Stab': { formula: linear(0, 300, 'pow', 5), totalHit: i => active(i, 'Cloaking Exceed') ? 2 : 1 },
  'Abyss Dagger': { formula: linear(100, 500, 'pow', 5), totalHit: 2 },
  'Deft Stab': { formula: linear(350, 550, 'pow', 5), totalHit: 1, hit: 5, damageRepeat: i => 1 + lv(i) * 0.05 },
  'Frenzy Shot': { formula: linear(0, 400, 'con', 5), totalHit: i => 1 + lv(i) * 0.1, canCri: true },

  'Explosion Blaster': { formula: i => scale(i, lv(i) * (active(i, 'Oleum Sanctum') ? 3200 : 2800) + pow(i) * 15), canCri: false },
  'Second Flame': { formula: linear(200, 2900, 'pow', 9) },
  'Massive Flame Blaster': { formula: i => scale(i, lv(i) * (race(i, 'demihuman', 'brute') ? 2300 : 2150) + pow(i) * 15), canCri: false },
  'Overslash': { ...REBALANCE_2026_PATCHES['Overslash'], formula: i => scale(i, lv(i) * (120 + learned(i, 'Spear & Sword Mastery') * 10) + pow(i) * 5) },
  // Korean final notice: Nv5, mastery10, shield150/+10 = 12840%, not the
  // English translation's 14440%. Historical rAthena supplies 1400 + 2100*Lv.
  // 400 + 2300/lv is the client's table (2.700% to 11.900%); the article's 1400 + 2100/lv
  // only agrees at Nv5. The POD, shield weight and refine terms stay the article's: the
  // client names them without numbers.
  'Shield Shooting': { formula: i => scale(i, 400 + lv(i) * (2300 + learned(i, 'Shield Mastery') * 15) + pow(i) * 5 + (i.equipmentBonus.shield?.weight ?? 0) + (i.equipmentBonus.shield?.refine ?? 0) * 4) },
  'Grand Judgement': { formula: i => scale(i, (race(i, 'plant', 'insect') ? 350 : 250) + lv(i) * (race(i, 'plant', 'insect') ? 1650 : 1500) + pow(i) * 7) },
  'Cross Rain': { formula: i => scale(i, lv(i) * (active(i, 'Holy Shield') ? 450 + learned(i, 'Spear & Sword Mastery') * 10 : 320 + learned(i, 'Spear & Sword Mastery') * 5) + spl(i) * 5), totalHit: 15 },
  'Metallic Fury': { formula: i => scale(i, lv(i) * 2200 + spl(i) * 1.5 * learned(i, 'Stage Manner')), getElement: (_, i) => i.ammoElement ?? ElementType.Neutral, part2: { ...part(i => active(i, '_Debuf_Sonic_Brand') ? scale(i, lv(i) * (2200 + 300 * (i.stack ?? 1)) + spl(i) * 1.5 * learned(i, 'Stage Manner')) : 0, ElementType.Neutral), element: undefined }, minStack: 1, maxStack: 5, defaultStack: 1 },
  'Rhythm Shooting': { formula: i => scale(i, (active(i, '_Debuf_Sonic_Brand') ? 300 : 200) + lv(i) * (active(i, '_Debuf_Sonic_Brand') ? 220 : 120) + con(i) * 3 * learned(i, 'Stage Manner')), totalHit: 3 },
  'Framen': { formula: i => scale(i, lv(i) * ((race(i, 'demon', 'undead') ? 900 : 800) + learned(i, 'Fidus Animus') * 5) + spl(i) * (race(i, 'demon', 'undead') ? 5 : 3)) },
  'Arbitrium': { formula: i => scale(i, lv(i) * (1000 + learned(i, 'Fidus Animus') * 10) + spl(i) * 7), part2: part(i => scale(i, lv(i) * (1250 + learned(i, 'Fidus Animus') * 10) + spl(i) * 7), ElementType.Holy) },
  'Petitio': { formula: i => scale(i, lv(i) * (1050 + learned(i, 'Mace & Book Mastery') * 10) + pow(i) * 5) },
  'Explosive Powder': { ...REBALANCE_2026_PATCHES['Explosive Powder'], formula: i => scale(i, 400 + lv(i) * (active(i, 'Research Report') ? 550 : 450) + pow(i) * (active(i, 'Research Report') ? 10 : 7)) },
  'Mayhemic Thorns': { ...REBALANCE_2026_PATCHES['Mayhemic Thorns'], formula: i => scale(i, (active(i, 'Research Report') ? 250 : 200) + lv(i) * (active(i, 'Research Report') ? 300 : 250) + pow(i) * (active(i, 'Research Report') ? 10 : 7)), totalHit: i => active(i, 'Research Report') ? 5 : 3 },
  'Axe Stomp': { ...REBALANCE_2026_PATCHES['Axe Stomp'], formula: linear(350, 850, 'pow', 5) },
  'Spark Blaster': { formula: linear(250, 750, 'pow', 7), totalHit: 2, isIgnoreDef: true, isIgnoreSDef: true },
  'Triple Laser': { formula: linear(300, 600, 'pow', 10), totalHit: 3, canCri: true },
  'Mighty Smash': { formula: i => scale(i, (active(i, 'Axe Stomp') ? 150 : 100) + lv(i) * 300 + pow(i) * 7), totalHit: i => active(i, 'Axe Stomp') ? 5 : 3, verifyItemFn: i => i.weapon.isType('axe', 'twohandAxe') ? '' : 'Machado' },

  'Only One Bullet': { formula: i => aimed(i, 800, i.weapon.isSubType('Rifle') ? 1350 : 1500, 350, 3) },
  'Spiral Shooting': { ...REBALANCE_2026_PATCHES['Spiral Shooting'], formula: i => i.weapon.isSubType('Rifle') ? aimed(i, 1200, 1700, 150, 3) : aimed(i, 1000, 1500, 150, 3) },
  'Magazine for One': { ...REBALANCE_2026_PATCHES['Magazine for One'], formula: i => i.weapon.isSubType('Gatling Gun') ? aimed(i, 200, 350, 100, 2) : aimed(i, 150, 450, 100, 2) },
  'Wild Fire': { formula: i => aimed(i, 1000, i.weapon.isSubType('Shotgun') ? 2450 : 2300, 500, 3) },
  'Basic Grenade': { formula: i => grenade(i, 1000, 950, 50, 5), hit: 2 },
  'Hasty Fire in the Hole': { formula: i => grenade(i, 1500, 1050, 20, 3), totalHit: 3, hit: 2 },
  'Exorcism of Malicious Soul': { formula: i => scale(i, (lv(i) * 150 + learned(i, 'Soul Mastery') * 2 + spl(i)) * (state(i, 'Total Soul') || 1)) },
  'Talisman of Blue Dragon': { formula: i => talisman(i, mandala(i) ? 350 : 250, mandala(i) ? 1650 : 1450), hit: 1 },
  'Talisman of White Tiger': { formula: i => talisman(i, 350, mandala(i) ? 1350 : 950), hit: 2 },
  'Talisman of Red Phoenix': { formula: i => talisman(i, mandala(i) ? 1200 : 1000, mandala(i) ? 1300 : 900), hit: 3 },
  'Talisman of Black Tortoise': { formula: i => talisman(i, mandala(i) ? 2300 : 2150, mandala(i) ? 1850 : 1450), hit: 3 },

  'Shadow Hunting': { formula: i => scale(i, 500 + lv(i) * (400 + learned(i, 'Shadow Flash') * 5) + pow(i) * 3) },
  'Shadow Dance': { formula: i => scale(i, 400 + lv(i) * (550 + learned(i, 'Shadow Hunting') * 50) + pow(i) * 4), hit: 5 },
  'Shadow Flash': { formula: i => scale(i, 1600 + lv(i) * (700 + learned(i, 'Shadow Dance') * 100) + pow(i) * 5), hit: 1, canCri: false },
  'Huuma Shuriken - Grasp': { formula: i => scale(i, 700 + lv(i) * (200 + learned(i, 'Huuma Shuriken - Construct') * 5) + pow(i) * 3), totalHit: 20 },
  'Huuma Shuriken - Construct': { formula: i => scale(i, 600 + lv(i) * (400 + learned(i, 'Huuma Shuriken - Grasp') * 30) + pow(i) * 5), hit: 3, part2: part(i => active(i, '_Preview_Hidden Weapon') ? scale(i, 800 + lv(i) * (600 + learned(i, 'Huuma Shuriken - Grasp') * 30) + pow(i) * 5) : 0, ElementType.Neutral, false, 6) },
  'Red Flame Cannon': { formula: i => scale(i, 850 + lv(i) * (1250 + learned(i, 'Darkening Cannon') * 70) + spl(i) * 5), hit: 3 },
  'Cold Blooded Cannon': { formula: i => scale(i, 250 + lv(i) * (550 + learned(i, 'Darkening Cannon') * 40) + spl(i) * 5), hit: 6 },
  'Thundering Cannon': { formula: i => scale(i, 600 + lv(i) * (1300 + learned(i, 'Darkening Cannon') * 70) + spl(i) * 5), hit: 2 },
  'Golden Dragon Cannon': { formula: i => scale(i, 300 + lv(i) * (400 + learned(i, 'Darkening Cannon') * 15) + spl(i) * 5) },

  'Midnight Kick': { ...REBALANCE_2026_PATCHES['Midnight Kick'], hit: 2 },
  'Dawn Break': { ...REBALANCE_2026_PATCHES['Dawn Break'], hit: 2 },
  'Twinkling Galaxy': { formula: i => celestial(i, 200, 400, 3, 3), totalHit: 15, hit: 3 },
  'Star Cannon': { formula: i => celestial(i, 200, 500, 5, 5), totalHit: 15, hit: 3 },
  'All in the Sky': { ...REBALANCE_2026_PATCHES['All in the Sky'], formula: linear(3000, 2000, 'pow', 10) },
  'Chulho Sonic Claw': { formula: i => creature(i, 400, 500, 750, 850, 50, 100, false), hit: 2, canCri: i => learned(i, 'Commune with Chulho') > 0 },
  'Hogogong Strike': { ...REBALANCE_2026_PATCHES['Hogogong Strike'], formula: i => creature(i, 180, 250, 200, 350, 10, 20, false) },
  'Hyunrok Breeze': { formula: i => creature(i, 600, 700, 600, 800, 20, 40, true), totalHit: 16 },
  'Hyunrok Cannon': { formula: i => creature(i, 700, 800, 950, 1100, 50, 75, true) },
  'Double Bowling Bash': { ...REBALANCE_2026_PATCHES['Double Bowling Bash'], formula: i => hyper(i, 150 + lv(i) * (250 + learned(i, 'Self Study Tactics') * 3) + pow(i) * 2, false, 1.5, 1, 5) },
  'Mega Sonic Blow': { ...REBALANCE_2026_PATCHES['Mega Sonic Blow'], formula: i => hyper(i, 850 + lv(i) * (450 + learned(i, 'Self Study Tactics') * 5) + pow(i) * 4, false, 1.7, 1, 5) * (active(i, '_Preview_Target Below Half HP') ? 2 : 1) },
  'Shield Chain Rush': { formula: i => hyper(i, 600 + lv(i) * (450 + learned(i, 'Self Study Tactics') * 3) + pow(i) * 3, false, 1.5, 2, 10), hit: 5 },
  'Spiral Pierce Max': { formula: i => hyper(i, (550 + lv(i) * (350 + learned(i, 'Self Study Tactics') * 3)) * ({ s: 1.5, m: 1.3, l: 1.2 }[i.monster.size]) + pow(i) * 3, false, 1.7, 1, 5), hit: 5 },
};

function aimed(i: Input, base: number, perLevel: number, perAim: number, trait: number): number {
  return scale(i, base + lv(i) * (perLevel + state(i, '_NightWatch_Aiming Count') * perAim) + con(i) * trait);
}
function grenade(i: Input, base: number, perLevel: number, mastery: number, trait: number): number {
  return scale(i, base + lv(i) * perLevel + learned(i, 'Grenade Mastery') * mastery + con(i) * trait);
}
function mandala(i: Input): boolean { return active(i, '_SoulAscetic_Mandala') || state(i, '_SoulAscetic_Blessing') === 5; }
function talisman(i: Input, base: number, perLevel: number): number { return scale(i, base + lv(i) * (perLevel + learned(i, 'Talisman Mastery') * 15) + spl(i) * 5); }
function skyState(i: Input, value: number): boolean { return [value, 7].includes(state(i, '_SkyEmperor_Celestial_Space')); }
function celestial(i: Input, base: number, perLevel: number, mastery: number, trait: number): number {
  return scale(i, base + lv(i) * (perLevel + learned(i, 'Sky Mastery') * mastery) + pow(i) * trait);
}
function creature(i: Input, base: number, communeBase: number, perLevel: number, communeLevel: number, mastery: number, communeMastery: number, magic: boolean): number {
  const commune = learned(i, magic ? 'Commune with Hyunrok' : 'Commune with Chulho') > 0;
  return scale(i, (commune ? communeBase : base) + lv(i) * (commune ? communeLevel : perLevel) + learned(i, 'Mystical Creature Mastery') * (commune ? communeMastery : mastery) + (magic ? spl(i) : pow(i)) * 5);
}
function hyper(i: Input, ratio: number, magic: boolean, ultimate: number, passiveMultiplier = 1, passiveFlat = 0): number {
  const level = learned(i, magic ? 'Self Study Sorcery' : 'Self Study Tactics');
  const passive = level > 0 ? level * passiveMultiplier + passiveFlat : 0;
  return Math.floor(Math.floor(Math.floor(scale(i, ratio)) * (1 + passive / 100)) * (active(i, magic ? 'Angel of Magic' : 'Angel of Power') ? ultimate : 1));
}

function crystalFactor(i: Input, shard: 1 | 2): number {
  switch (climax(i)) {
    case 3: return shard === 1 ? 1.5 : 1;
    case 4: return shard === 1 ? 0.5 : 2.5;
    default: return 1;
  }
}
function trapRatio(i: Input): number { return scale(i, lv(i) * 850 + con(i) * 5) * (1 + 0.2 * learned(i, 'Advanced Trap')); }
function acidRatio(i: Input): number {
  const report = active(i, 'Research Report');
  return scale(i, lv(i) * 400 + pow(i) * (1 + learned(i, 'Bionic Pharmacy')) * (report && race(i, 'formless', 'plant') ? 1.5 : 1)) * (report ? 1.5 : 1);
}
function elementalRatio(i: Input, spirit: number, field: boolean): number {
  const summoned = state(i, '_ElementalMaster_spirit') === spirit;
  return field
    ? scale(i, 500 + lv(i) * (summoned ? 1050 : 650) + spl(i) * (summoned ? 7 : 5))
    : scale(i, (summoned ? 5400 : 400) + lv(i) * (summoned ? 1800 : 1550) + spl(i) * (summoned ? 10 : 5));
}

function timing(value: RebalanceTiming): AtkSkillModel['cd'] {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return level => value[level - 1] ?? value[value.length - 1];
  return level => Math.max(0, value.base + value.perLevel * level);
}
const referenceMap = (groups: typeof REBALANCE_2026_REFERENCE) => new Map(groups.flatMap(group => Object.entries(group.skills).map(([name, data]) => [name, { ...data, source: group.source }] as const)));
const references2026 = referenceMap(REBALANCE_2026_REFERENCE);
const references2022 = referenceMap(REBALANCE_2022_REFERENCE);

/** Pure, per-calculation selection. Never writes to a shared job or skill definition. */
export function resolveRebalancedSkill(skill: AtkSkillModel, version?: SkillFormulaVersion): AtkSkillModel {
  if (version === 'pre-rebalance') return skill;
  // Sonic Brand also changes these inherited third-job ratios. Their cast data
  // and damage-packet behavior remain those of the existing implementation.
  if (skill.name === 'Reverberation' || skill.name === 'Metalic Sound') return {
    ...skill, formula: i => active(i, '_Debuf_Sonic_Brand')
      ? scale(i, skill.name === 'Reverberation' ? 700 + lv(i) * 390 : lv(i) * 156 + learned(i, 'Lesson') * 60)
      : skill.formula(i),
  };
  const historical = isLatamBaseline(version);
  const reference = (historical ? references2022 : references2026).get(skill.name);
  const patch = (historical ? REBALANCE_2022_PATCHES : REBALANCE_2026_PATCHES)[skill.name];
  if (!reference || !patch) return skill;
  return {
    ...skill,
    levelList: Array.from({length:reference.maxLevel}, (_, index) => ({label:`${skill.label} Nv${index + 1}`,value:`${skill.value.split('==')[0]}==${index + 1}`})),
    hit: reference.hit, totalHit: reference.totalHit, damageRepeat: undefined,
    isMatk: reference.isMatk,
    vct: timing(reference.vct), fct: timing(reference.fct), acd: timing(reference.acd), cd: timing(reference.cd),
    // Legacy explanations describe the legacy ratio and must not survive the switch.
    ratioCalc: undefined, finalDmgCalc: undefined,
    ...patch,
    ...(historical && patch.canCri ? { criDmgPercentage: 0.5 } : {}),
    ...hyperVariant(skill),
  };
}

function hyperVariant(skill: AtkSkillModel): Patch {
  if (skill.name === 'Meteor Storm Buster' && skill.labelSuffix === 'Explosão') return {
    hit: 1, formula: i => hyper(i, 450 + lv(i) * (160 + learned(i, 'Self Study Sorcery') * 5) + spl(i) * 3, true, 1.5, 0),
  };
  if (skill.name === 'Jack Frost Nova' && skill.labelSuffix === 'Inicial') return {
    hit: 1, totalHit: 1, formula: i => hyper(i, lv(i) * (200 + learned(i, 'Self Study Sorcery') * 3) + spl(i) * 2, true, 1.7, 0),
  };
  if (skill.name === 'Ground Gravitation' && skill.labelSuffix === 'Inicial') return {
    hit: 2, totalHit: 1, formula: i => hyper(i, 3000 + lv(i) * (1500 + learned(i, 'Self Study Sorcery') * 4) + spl(i) * 10, true, 1.5, 0),
  };
  if (skill.name === 'Ground Gravitation') return {hit: 1};
  if (skill.name === 'Jack Frost Nova') return {hit: 2};
  return {};
}

export function rebalancedSkillCatalog(skills: AtkSkillModel[], className: ClassName, version?: SkillFormulaVersion): AtkSkillModel[] {
  if (version === 'pre-rebalance') return skills;
  const historical = isLatamBaseline(version);
  const references = historical ? REBALANCE_2022_REFERENCE : REBALANCE_2026_REFERENCE;
  const patches = historical ? REBALANCE_2022_PATCHES : REBALANCE_2026_PATCHES;
  const catalog = skills.map(skill => resolveRebalancedSkill(skill, version));
  for (const group of references.filter(group => group.classes.includes(className))) {
    for (const [name, data] of Object.entries(group.skills)) {
      if (catalog.some(skill => skill.name === name)) continue;
      const patch = patches[name];
      if (!patch?.formula) continue;
      catalog.push(resolveRebalancedSkill({
        name: name as SKILL_NAME, label: name, value: `${name}==${data.maxLevel}`,
        levelList: Array.from({ length: data.maxLevel }, (_, index) => ({ label: `${name} Nv${index + 1}`, value: `${name}==${index + 1}` })),
        acd: 0, cd: 0, vct: 0, fct: 0, formula: patch.formula,
        isMatk: data.isMatk, isMelee: data.isMelee,
        element: data.element ? data.element[0].toUpperCase() + data.element.slice(1) as ElementType : undefined,
        labelSuffix: historical ? 'Rebalance - 02/06/2022 - (kRO)' : 'Rebalance - 21/12/2022 - (kRO)',
      }, version));
    }
  }
  return catalog;
}

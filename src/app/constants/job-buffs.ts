import { ActiveSkillModel } from '../jobs/_character-base.abstract';
import { ElementType } from './element-type.const';
import { BragisPoemFn, DarkClawFn, ShieldSpellFn, SwingDanceFn } from './share-active-skills';
import { ArtistPartyBuffs } from './artist-party-buffs';
import { ArgutusTelumBuff, ArgutusVitaBuff, LaudaAgnusBuff, LaudaRamusBuff, PresensAciesBuff } from './cleric-party-buffs';

const JobBuffsList: ActiveSkillModel[] = [
  {
    name: 'Cantocandidus',
    label: 'Aumentar Agilidade',
    icon: 29,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      { label: 'Nv 3', value: 3, isUse: true, bonus: { agi: 5, aspdPercent: 3 } },
      { label: 'Nv 10', value: 10, isUse: true, bonus: { agi: 12, aspdPercent: 10 } },
      { label: 'Job 20', value: 12, isUse: true, bonus: { agi: 14, aspdPercent: 12 } },
      { label: 'Job 30', value: 13, isUse: true, bonus: { agi: 15, aspdPercent: 13 } },
      { label: 'Job 40', value: 14, isUse: true, bonus: { agi: 16, aspdPercent: 14 } },
      { label: 'Job 50', value: 15, isUse: true, bonus: { agi: 17, aspdPercent: 15 } },
      { label: 'Job 60', value: 16, isUse: true, bonus: { agi: 18, aspdPercent: 16 } },
      { label: 'Job 70', value: 17, isUse: true, bonus: { agi: 19, aspdPercent: 17 } },
    ],
  },
  {
    name: 'Clementia',
    label: 'Bênção',
    icon: 34,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      { label: 'Nv 10', value: 10, isUse: true, bonus: { str: 10, int: 10, dex: 10, hit: 20 } },
      { label: 'Job 20', value: 12, isUse: true, bonus: { str: 12, int: 12, dex: 12, hit: 22 } },
      { label: 'Job 30', value: 13, isUse: true, bonus: { str: 13, int: 13, dex: 13, hit: 23 } },
      { label: 'Job 40', value: 14, isUse: true, bonus: { str: 14, int: 14, dex: 14, hit: 24 } },
      { label: 'Job 50', value: 15, isUse: true, bonus: { str: 15, int: 15, dex: 15, hit: 25 } },
      { label: 'Job 60', value: 16, isUse: true, bonus: { str: 16, int: 16, dex: 16, hit: 26 } },
      { label: 'Job 70', value: 17, isUse: true, bonus: { str: 17, int: 17, dex: 17, hit: 27 } },
    ],
  },
  {
    name: 'Impositio Manus',
    label: 'Impositio 5',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { atk: 25, matk: 25 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Expiatio',
    label: 'Expiatio 5',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { p_pene_race_all: 25, m_pene_race_all: 25 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Competentia',
    label: 'Competentia',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { pAtk: 50, sMatk: 50 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Religio',
    label: 'Religio',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { spl: 10, wis: 10, sta: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Benedictum',
    label: 'Benedictum',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { pow: 10, crt: 10, con: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Reencarnação das Almas (Asceta das Almas) affects party members for 300 seconds.
    // bROWiki lists +7% at Nv1, +2% per level, up to +25% at Nv10 for physical
    // melee, physical ranged and magic of every property.
    // https://browiki.org/wiki/Reencarna%C3%A7%C3%A3o_das_Almas
    name: 'Soul of Heaven and Earth',
    label: 'Reencarnação das Almas',
    icon: 5432,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      ...Array.from({ length: 10 }, (_, index) => {
        const level = index + 1;
        const bonus = 5 + level * 2;
        return {
          label: `Nv ${level}`,
          value: level,
          skillLv: level,
          isUse: true,
          bonus: { melee: bonus, range: bonus, m_my_element_all: bonus },
        };
      }),
    ],
  },
  {
    // Talismã do Protetor restores HP every three seconds. The damage simulator
    // has no healing-over-time calculation; the selectable state is still useful
    // for representing a party member's buffs.
    name: 'Talisman of Protection',
    label: 'Talismã do Protetor',
    icon: 5418,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      ...Array.from({ length: 5 }, (_, i) => ({ label: `Nv ${i + 1}`, value: i + 1, isUse: true, bonus: {} })),
    ],
  },
  {
    name: 'Talisman of the Warrior',
    label: 'Talismã do Guerreiro',
    icon: 5419,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      ...Array.from({ length: 5 }, (_, i) => ({ label: `Nv ${i + 1}`, value: i + 1, isUse: true, bonus: { pAtk: (i + 1) * 2 } })),
    ],
  },
  {
    name: 'Talisman of the Magician',
    label: 'Talismã do Mago',
    icon: 5420,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      ...Array.from({ length: 5 }, (_, i) => ({ label: `Nv ${i + 1}`, value: i + 1, isUse: true, bonus: { sMatk: (i + 1) * 2 } })),
    ],
  },
  {
    name: 'Talisman of Five Elements',
    label: 'Talismã dos Elementos',
    icon: 5423,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      ...Array.from({ length: 5 }, (_, i) => {
        const bonus = (i + 1) * 4;
        return {
          label: `Nv ${i + 1}`, value: i + 1, isUse: true,
          bonus: Object.fromEntries(['water', 'wind', 'earth', 'fire', 'neutral'].flatMap((element) => [
            [`p_element_${element}`, bonus], [`m_element_${element}`, bonus],
          ])),
        };
      }),
    ],
  },
  ArgutusVitaBuff,
  ArgutusTelumBuff,
  PresensAciesBuff,
  {
    name: 'Crazy Uproar',
    label: 'Grito de Guerra',
    inputType: 'selectButton',
    isMasteryAtk: true,
    dropdown: [
      { label: 'Sim', value: 1, skillLv: 1, isUse: true, bonus: { str: 4, atk: 30 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  LaudaAgnusBuff,
  LaudaRamusBuff,
  {
    name: 'Adrenaline Rush',
    label: 'Adrenalina 5',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', value: 5, skillLv: 5, isUse: true, bonus: { hit: 20, skillAspd: 5 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  {
    name: 'Power Thrust',
    label: 'Força Violenta 5',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', value: 5, skillLv: 5, isUse: true, bonus: { flatDmg: 15 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  {
    label: 'Manejo Perfeito 5',
    inputType: 'selectButton',
    name: 'Weapon Perfection',
    dropdown: [
      { label: 'Sim', value: 5, skillLv: 5, isUse: true, bonus: { ignore_size_penalty: 1 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  {
    name: 'Fairy Soul',
    label: 'Espírito da Fada',
    icon: 2599,
    exclusiveGroup: 'soul',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { matk: 50, vct: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Shadow Soul',
    label: 'Espírito das Sombras',
    icon: 2597,
    exclusiveGroup: 'soul',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { cri: 20, aspd: 3 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Falcon Soul',
    label: 'Espírito do Falcão',
    icon: 2598,
    exclusiveGroup: 'soul',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { atk: 50, hit: 15 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Defensive soul (DEF/MDEF, unbreakable equipment) — no offensive effect to model.
    name: 'Golem Soul',
    label: 'Espírito do Golem',
    icon: 2596,
    exclusiveGroup: 'soul',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: {} },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: "Odin's Power",
    label: 'Poder de Odin',
    icon: 2537,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: 'Nv 1', isUse: true, value: 1, bonus: { atk: 70, matk: 70, def: -20, mdef: -20 } },
      { label: 'Nv 2', isUse: true, value: 2, bonus: { atk: 100, matk: 100, def: -40, mdef: -40 } },
    ],
  },
  {
    name: 'Comet Amp',
    label: 'Cometa',
    icon: 2213,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { comet: 50 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    label: 'Impacto Explosivo',
    name: 'Magnum Break',
    inputType: 'dropdown',
    dropdown: [
      { label: '-', value: 0, isUse: false },
      { label: 'Ativo', value: 1, isUse: true, bonus: { magnumBreakPsedoBonus: 1 } },
      { label: 'Limpar EDP', value: 2, isUse: true, bonus: { magnumBreakClearEDP: 1 } },
    ],
  },
  {
    label: 'Chuva de Mariscos',
    name: 'Bunch of Shrimp',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { atkPercent: 10, matkPercent: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Moonlight Serenade',
    label: 'Serenata ao Luar',
    exclusiveGroup: 'wanderer_dance',
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: 'Job 30', value: 13, isUse: true, bonus: { matk: 46 } },
      { label: 'Job 40', value: 14, isUse: true, bonus: { matk: 48 } },
      { label: 'Job 50', value: 15, isUse: true, bonus: { matk: 50 } },
      { label: 'Job 60', value: 16, isUse: true, bonus: { matk: 52 } },
      { label: 'Job 70', value: 17, isUse: true, bonus: { matk: 54 } },
    ],
  },
  {
    name: 'Striking',
    label: 'Encanto de Órion',
    inputType: 'selectButton',
    isEquipAtk: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 20, bonus: { atk: 100, perfectHit: 70 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Vulcão / Dilúvio / Furacão (SA_VOLCANO 285, SA_DELUGE 286, SA_VIOLENTGALE 287) — the
    // Sage-line ground fields, one picker because "Apenas 1 magia de terreno pode estar ativa
    // por vez" (bROWiki). Everyone standing in the field deals +10/14/17/19/20% physical and
    // magical damage of its element: rAthena's renewal battle_attr_fix does
    // `ratio += val3` on the attacker's status, the same property-modifier stage the target
    // debuffs below use (see getElementResistReduction). The side effect is the client's
    // table: Vulcão ATQ and ATQM +10…30 (rAthena `5 + 5 × lv`), Dilúvio HP máx. +5…15%,
    // Furacão Esquiva +3…15. Tracker card 7eJx6XNmTPFTuRdYzv4L.
    name: '_Sage_Field',
    label: 'Terreno Mágico',
    icon: 285,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      ...[10, 14, 17, 19, 20].flatMap((dmg, i) => {
        const lv = i + 1;
        return [
          { label: `Vulcão Nv ${lv}`, isUse: true, value: 10 + lv, icon: 285, bonus: { volcano: dmg, atk: 5 + 5 * lv, matk: 5 + 5 * lv } },
          { label: `Dilúvio Nv ${lv}`, isUse: true, value: 20 + lv, icon: 286, bonus: { deluge: dmg, hpPercent: [5, 9, 12, 14, 15][i] } },
          { label: `Furacão Nv ${lv}`, isUse: true, value: 30 + lv, icon: 287, bonus: { violentGale: dmg, flee: 3 * lv } },
        ];
      }).sort((a, b) => a.value - b.value),
    ],
  },
  {
    // Insígnia do Fogo / da Água / do Vento / da Terra (SO_*_INSIGNIA 2465-2468) on whoever
    // stands in it. Nv1 only buffs the Sorcerer's elemental, so it is not offered. Nv2 and Nv3
    // are separate, not cumulative: rAthena tests `val1 == 2` and `val1 == 3`, and the client
    // table lists each level's own effects. Where rAthena and the client disagree the client
    // wins, and bROWiki's four pages agree with the client: Vento Nv2 is "Pós-conjuração -10%"
    // (rAthena: ASPD +10%) and Água Nv3 is "Conjuração variável -30%" with no element
    // restriction (rAthena: Water spells only).
    //
    // - "ATQ +10%" is `atkPercent`, the key the items phrased that way use; "ATQ +50" is `atk`.
    // - "Propriedade da arma muda para X" is an endow, carried as `propertyAtk` (calculator.ts).
    // - "Dano mágico de X +25%" is not the `m_my_element_*` stage: rAthena's
    //   battle_calc_magic_attack does `skillratio += 25` on magic of that element, so it is
    //   `insignia_ratio_<element>`, added to the skill ratio (calcMagicalSkillDamage).
    // - Vento Nv3 "Pós-conj. de magias de Vento -50%" is `acd_magic_wind`, which rAthena adds
    //   to the delay rate for Wind magic only (calcSkillAspd).
    // - Água Nv2 "Efetv. de cura +10%" is healing received — display only.
    name: '_Sorcerer_Insignia',
    label: 'Insígnia',
    icon: 2465,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: 'Fogo Nv 2', isUse: true, value: 12, icon: 2465, bonus: { atk: 50, atkPercent: 10, propertyAtk: ElementType.Fire } },
      { label: 'Fogo Nv 3', isUse: true, value: 13, icon: 2465, bonus: { matk: 50, insignia_ratio_fire: 25 } },
      { label: 'Água Nv 2', isUse: true, value: 22, icon: 2466, bonus: { atkPercent: 10, healReceived: 10, propertyAtk: ElementType.Water } },
      { label: 'Água Nv 3', isUse: true, value: 23, icon: 2466, bonus: { vct: 30, insignia_ratio_water: 25 } },
      { label: 'Vento Nv 2', isUse: true, value: 32, icon: 2467, bonus: { atkPercent: 10, acd: 10, propertyAtk: ElementType.Wind } },
      { label: 'Vento Nv 3', isUse: true, value: 33, icon: 2467, bonus: { acd_magic_wind: 50, insignia_ratio_wind: 25 } },
      { label: 'Terra Nv 2', isUse: true, value: 42, icon: 2468, bonus: { atkPercent: 10, hp: 500, def: 50, propertyAtk: ElementType.Earth } },
      { label: 'Terra Nv 3', isUse: true, value: 43, icon: 2468, bonus: { sp: 50, mdef: 50, insignia_ratio_earth: 25 } },
    ],
  },
  {
    name: 'Raid',
    label: 'Ataque Surpresa',
    icon: 214, // RG_RAID
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { raid: 1 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  DarkClawFn(),
  {
    name: 'Debuff_Spore Explosion',
    label: 'Esporo Explosivo',
    icon: 2481,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { sporeExplosion: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  ShieldSpellFn(),
  BragisPoemFn(),
  SwingDanceFn(),
  {
    name: 'Mystical Amplification',
    label: 'Amplificação Mística',
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: 'Nv 5', isUse: true, value: 5, bonus: { mysticAmp: 25 } },
      { label: 'Nv 10', isUse: true, value: 1, bonus: { mysticAmp: 50 } },
    ],
  },
  {
    name: 'Spell Enchanting',
    label: 'Enfeitiçar 5',
    inputType: 'selectButton',
    dropdown: [
      { label: 'Sim', isUse: true, value: 5, bonus: { sMatk: 5 * 4 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'March of Prontera',
    label: 'Marcha de Prontera',
    icon: 5364,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: '+ 15', isUse: true, value: 5, bonus: { pAtk: 15 } },
      { label: '+ 22', isUse: true, value: 6, bonus: { pAtk: 22 } },
    ],
  },
  {
    name: 'Serenade of Jawaii',
    label: 'Serenata de Jawaii',
    icon: 5362,
    inputType: 'dropdown',
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: '+ 15', isUse: true, value: 5, bonus: { sMatk: 15 } },
      { label: '+ 22', isUse: true, value: 6, bonus: { sMatk: 22 } },
    ],
  },
  ...ArtistPartyBuffs,

  {
    name: 'Rhapsody of Mineworker',
    label: 'Rapsódia do Minerador',
    icon: 5360,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { monster_res: -100 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: 'Geffenia Nocturne',
    label: 'Recital de Geffenia',
    icon: 5358,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { monster_mres: -100 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Oratio (Arch Bishop) lowers the target's Holy property resistance by 2% per
    // level (−20% at Lv 10), so Holy attacks land for that much more. browiki.org/wiki/Oratio
    name: 'Oratio',
    label: 'Oratio 10',
    icon: 2046,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { oratio: 20 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Assombração is the target state inflicted by Necromancia (Evil Soul Curse).
    // The skill level changes its application chance, not the resistance reduction.
    // The client specifies -100% Dark resistance, or -20% against bosses.
    name: 'Evil Soul Curse',
    label: 'Assombração',
    icon: 2601,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { soulCurse: 100 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Infecção — the debuff Maldição de Jormungand (Killing Cloud, SO_CLOUD_KILL)
    // leaves on the target: it lowers Poison property resistance by 5% per skill
    // level (−25% at Lv 5), so every Poison attack lands for that much more (see
    // getElementResistReduction). browiki.org/wiki/Maldição_de_Jormungand
    name: 'Infection',
    label: 'Infecção',
    icon: 2450,
    inputType: 'dropdown',
    isDebuff: true,
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      { label: 'Nv 1', isUse: true, value: 1, bonus: { infection: 5 } },
      { label: 'Nv 2', isUse: true, value: 2, bonus: { infection: 10 } },
      { label: 'Nv 3', isUse: true, value: 3, bonus: { infection: 15 } },
      { label: 'Nv 4', isUse: true, value: 4, bonus: { infection: 20 } },
      { label: 'Nv 5', isUse: true, value: 5, bonus: { infection: 25 } },
    ],
  },
  {
    // GC_VENOMIMPRESS reduces the target's Poison resistance by 10% per level.
    // Its shorter duration on bosses does not change the amount of reduction.
    name: 'Venom Impression',
    label: 'Potencializar Veneno',
    icon: 2021,
    inputType: 'dropdown',
    isDebuff: true,
    dropdown: [
      { label: '-', isUse: false, value: 0 },
      ...Array.from({ length: 5 }, (_, i) => ({ label: `Nv ${i + 1}`, isUse: true, value: i + 1, bonus: { venomImpression: (i + 1) * 10 } })),
    ],
  },
  {
    // Intoxicação — the debuff Poço Venenoso (Venom Swamp, EM_VENOM_SWAMP) and Cultivar
    // Fada can leave on the target. Two effects are modeled off this single `intoxication`
    // flag: +25% Poison-property damage taken (as a −25% Poison resistance reduction, see
    // getElementResistReduction) and the target's physical DEF dropped to zero (see the
    // isIntoxicated getter). Its 10%/s HP drain isn't modeled (irrelevant to a hit's damage).
    // browiki.org/wiki/Poço_Venenoso · browiki.org/wiki/Efeitos_negativos#Intoxicação
    name: 'Intoxication',
    label: 'Intoxicação',
    icon: 5371,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { intoxication: 25 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Geladinho (Bitter Cold) — the debuff Jack Frost Nova (HN_JACK_FROST_NOVA) leaves on
    // the target: it takes +15% Water-property damage for 5s, modeled as a −15% Water
    // resistance reduction (see getElementResistReduction). In-game it doesn't affect boss
    // monsters; as with the other element-RR debuffs (Oratio/Infecção) that boss exclusion
    // isn't modeled. blog: sigmathefallen … Hyper Novice 2nd version.
    name: 'Bitter Cold',
    label: 'Geladinho',
    icon: 5457,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { bitterCold: 15 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Pólen — what Florescer (AG_ALL_BLOOM 5222) leaves on the target under Potencializar
    // Magia Nv4, for 30s: "Resistência à propriedade Fogo -100%", i.e. +100 points on the
    // Fire property modifier (see getElementResistReduction). The client text names no
    // boss exclusion. browiki.org/wiki/Florescer
    name: 'Pollen',
    label: 'Pólen',
    icon: 5222,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { pollen: 100 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    // Empalamento — what Pilares de Pedra (AG_VIOLENT_QUAKE 5218) leaves on the target
    // under Potencializar Magia Nv4, for 30s: "Resistência à propriedade Terra -100%".
    // bROWiki notes it and Pólen can be up at the same time. browiki.org/wiki/Pilares_de_Pedra
    name: 'Impalement',
    label: 'Empalamento',
    icon: 5218,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { impalement: 100 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  // Each Insígnia under the target can be selected independently. The legacy single
  // picker is migrated in setSkillModelArray when an older build is loaded.
  ...([
    ['Fogo', 2465, 'fireInsigniaOnTarget'],
    ['Água', 2466, 'waterInsigniaOnTarget'],
    ['Vento', 2467, 'windInsigniaOnTarget'],
    ['Terra', 2468, 'earthInsigniaOnTarget'],
  ] as const).map(([element, icon, bonusKey], index) => ({
    name: `_Sorcerer_Insignia_Target_${index + 1}` as ActiveSkillModel['name'],
    label: `Insígnia de ${element} no alvo`,
    icon,
    inputType: 'selectButton' as const,
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 1, bonus: { [bonusKey]: 50 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  })),
  {
    // Gravitação (Gravitational Field) — the debuff Ground Gravitation (HN_GROUND_GRAVITATION)
    // leaves on the target: it takes +10% physical AND magical damage (rAthena battle.cpp:
    // `damage += damage * 10 / 100` on BF_WEAPON|BF_MAGIC). Boss monsters are immune (modeled,
    // see _getGravitationBonus). Its −30% move-speed part is irrelevant to a hit's damage.
    name: 'Gravitation',
    label: 'Gravitação',
    icon: 5459,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', isUse: true, value: 10, bonus: { gravitation: 10 } },
      { label: 'Não', isUse: false, value: 0 },
    ],
  },
  {
    name: '_Meister_Quake',
    label: 'Avanço Sísmico',
    icon: 5296,
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      { label: 'Sim', value: 10, isUse: true, bonus: { quake: 50 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  {
    name: 'Oleum Sanctum',
    label: 'Oleum Sanctum 5',
    inputType: 'selectButton',
    isDebuff: true,
    dropdown: [
      // { label: 'Nv 1', value: 1, isUse: true, bonus: { oleumSanctum: 1 * 3 } },
      // { label: 'Nv 2', value: 2, isUse: true, bonus: { oleumSanctum: 2 * 3 } },
      // { label: 'Nv 3', value: 3, isUse: true, bonus: { oleumSanctum: 3 * 3 } },
      // { label: 'Nv 4', value: 4, isUse: true, bonus: { oleumSanctum: 4 * 3 } },
      { label: 'Sim', value: 5, isUse: true, bonus: { oleumSanctum: 5 * 3 } },
      { label: 'Não', value: 0, isUse: false },
    ],
  },
  // {
  //   name: 'Climax',
  //   label: 'Climax',
  //   inputType: 'dropdown',
  //   dropdown: [
  //     { label: '-', value: 0, isUse: false },
  //     { label: 'Nv 1', value: 1, isUse: true, bonus:{def: 300, mdef: 100, m_my_element_water: 30} },
  //     { label: 'Nv 2', value: 2, isUse: true },
  //     { label: 'Nv 3', value: 3, isUse: true },
  //     { label: 'Nv 4', value: 4, isUse: true },
  //     { label: 'Nv 5', value: 5, isUse: true },
  //   ],
  // },
];

// Buffs first, monster debuffs last (stable within each group).
export const JobBuffs: ActiveSkillModel[] = [
  ...JobBuffsList.filter((b) => !b.isDebuff),
  ...JobBuffsList.filter((b) => b.isDebuff),
];

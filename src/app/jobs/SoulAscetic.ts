import { JOB_4_MAX_JOB_LEVEL, JOB_4_MIN_MAX_LEVEL } from '../app-config';
import { genSkillList } from '../utils';
import { SoulReaper } from './SoulReaper';
import { ActiveSkillModel, AtkSkillFormulaInput, AtkSkillModel, PassiveSkillModel } from './_character-base.abstract';
import { ClassName } from './_class-name';

const jobBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 1, 1, 0, 0],
  2: [0, 0, 1, 2, 1, 0],
  3: [0, 1, 1, 2, 1, 0],
  4: [0, 1, 1, 3, 2, 0],
  5: [0, 1, 1, 4, 3, 0],
  6: [0, 1, 1, 4, 4, 0],
  7: [0, 1, 1, 5, 5, 0],
  8: [0, 1, 2, 5, 6, 0],
  9: [0, 1, 2, 6, 6, 0],
  10: [0, 1, 3, 6, 7, 0],
  11: [0, 2, 3, 7, 7, 0],
  12: [0, 2, 3, 8, 8, 0],
  13: [0, 2, 3, 8, 8, 0],
  14: [0, 2, 3, 9, 8, 1],
  15: [0, 2, 4, 10, 8, 1],
  16: [0, 2, 5, 10, 8, 1],
  17: [0, 2, 5, 10, 9, 1],
  18: [0, 2, 5, 10, 9, 1],
  19: [0, 2, 5, 10, 9, 1],
  20: [0, 2, 5, 10, 9, 1],
  21: [0, 2, 5, 10, 10, 1],
  22: [0, 2, 5, 10, 11, 1],
  23: [0, 2, 5, 11, 11, 2],
  24: [0, 2, 5, 11, 11, 2],
  25: [0, 3, 5, 11, 11, 2],
  26: [0, 3, 5, 11, 11, 2],
  27: [1, 3, 5, 11, 11, 2],
  28: [1, 4, 6, 11, 11, 2],
  29: [2, 5, 6, 11, 11, 2],
  30: [2, 5, 6, 11, 11, 2],
  31: [2, 5, 6, 11, 11, 2],
  32: [2, 6, 6, 11, 12, 2],
  33: [2, 6, 6, 11, 12, 2],
  34: [2, 7, 6, 11, 12, 2],
  35: [2, 7, 7, 11, 13, 2],
  36: [3, 7, 7, 11, 13, 2],
  37: [3, 7, 7, 11, 13, 2],
  38: [3, 7, 7, 11, 13, 2],
  39: [3, 7, 7, 11, 13, 2],
  40: [3, 7, 7, 11, 13, 2],
  41: [3, 7, 7, 11, 13, 2],
  42: [3, 7, 7, 11, 13, 2],
  43: [3, 7, 7, 11, 13, 2],
  44: [3, 7, 7, 11, 13, 2],
  45: [3, 7, 7, 11, 13, 2],
  46: [3, 7, 7, 11, 13, 2],
  47: [3, 7, 7, 11, 13, 2],
  48: [3, 7, 7, 11, 13, 2],
  49: [3, 7, 7, 11, 13, 2],
  50: [3, 7, 7, 11, 13, 2],
  51: [3, 7, 7, 11, 13, 2],
  52: [3, 7, 7, 11, 13, 2],
  53: [3, 7, 7, 11, 13, 2],
  54: [3, 7, 7, 11, 13, 2],
  55: [3, 7, 7, 11, 13, 2],
  56: [3, 7, 7, 11, 13, 2],
  57: [3, 7, 7, 11, 13, 2],
  58: [3, 7, 7, 11, 13, 2],
  59: [3, 7, 7, 11, 13, 2],
  60: [3, 7, 7, 11, 13, 2],
  61: [3, 7, 7, 11, 13, 2],
  62: [3, 7, 7, 11, 13, 2],
  63: [3, 7, 7, 11, 13, 2],
  64: [3, 7, 7, 11, 13, 2],
  65: [3, 7, 7, 11, 13, 2],
  66: [3, 7, 7, 11, 13, 2],
  67: [3, 7, 7, 11, 13, 2],
  68: [3, 7, 7, 11, 13, 2],
  69: [3, 7, 7, 11, 13, 2],
  70: [3, 7, 7, 11, 13, 2],
};

const traitBonusTable: Record<number, [number, number, number, number, number, number]> = {
  1: [0, 0, 0, 0, 0, 0],
  2: [0, 0, 0, 0, 0, 0],
  3: [0, 0, 0, 1, 0, 0],
  4: [0, 0, 0, 1, 0, 0],
  5: [0, 0, 0, 1, 0, 0],
  6: [0, 0, 0, 2, 0, 0],
  7: [0, 0, 0, 2, 0, 0],
  8: [0, 0, 0, 2, 0, 0],
  9: [0, 0, 0, 3, 0, 0],
  10: [0, 0, 0, 3, 0, 0],
  11: [0, 0, 0, 3, 0, 0],
  12: [0, 0, 0, 3, 0, 0],
  13: [0, 0, 1, 3, 1, 0],
  14: [0, 0, 1, 3, 1, 0],
  15: [0, 0, 1, 3, 1, 0],
  16: [0, 0, 1, 3, 1, 1],
  17: [0, 0, 1, 3, 1, 1],
  18: [0, 0, 1, 3, 2, 1],
  19: [0, 0, 2, 3, 2, 1],
  20: [0, 0, 2, 3, 2, 1],
  21: [0, 0, 2, 3, 2, 1],
  22: [0, 0, 2, 4, 2, 1],
  23: [0, 0, 2, 4, 2, 1],
  24: [0, 0, 2, 4, 2, 1],
  25: [0, 0, 2, 4, 2, 1],
  26: [0, 0, 2, 5, 2, 1],
  27: [0, 1, 2, 5, 2, 1],
  28: [0, 1, 2, 5, 2, 1],
  29: [0, 2, 2, 5, 2, 1],
  30: [0, 2, 2, 6, 2, 1],
  31: [0, 2, 3, 6, 2, 1],
  32: [0, 2, 3, 6, 2, 1],
  33: [0, 2, 3, 6, 3, 1],
  34: [0, 2, 3, 6, 3, 1],
  35: [0, 2, 3, 6, 3, 1],
  36: [0, 3, 3, 6, 3, 1],
  37: [0, 3, 3, 7, 3, 1],
  38: [0, 3, 3, 7, 3, 1],
  39: [0, 3, 3, 7, 3, 1],
  40: [0, 3, 3, 7, 3, 2],
  41: [0, 3, 3, 7, 3, 2],
  42: [0, 3, 3, 7, 3, 2],
  43: [0, 3, 4, 7, 4, 2],
  44: [0, 3, 5, 8, 4, 2],
  45: [0, 3, 5, 9, 4, 2],
  46: [0, 3, 5, 9, 5, 2],
  47: [0, 3, 5, 10, 5, 2],
  48: [0, 3, 5, 10, 5, 3],
  49: [0, 3, 5, 10, 6, 3],
  50: [0, 3, 6, 11, 6, 3],
  51: [0, 3, 6, 12, 6, 3],
  52: [0, 3, 6, 12, 7, 3],
  53: [0, 3, 7, 12, 7, 3],
  54: [0, 4, 7, 12, 7, 3],
  55: [0, 4, 7, 13, 7, 3],
  56: [0, 4, 8, 13, 7, 3],
  57: [0, 4, 8, 13, 7, 3],
  58: [0, 4, 8, 13, 7, 3],
  59: [0, 4, 8, 13, 8, 3],
  60: [0, 4, 8, 13, 8, 3],
  61: [0, 4, 8, 13, 8, 3],
  62: [0, 4, 8, 13, 8, 3],
  63: [0, 4, 8, 13, 8, 3],
  64: [0, 4, 8, 13, 8, 3],
  65: [0, 4, 8, 13, 8, 3],
  66: [0, 4, 8, 13, 8, 3],
  67: [0, 4, 8, 13, 8, 3],
  68: [0, 4, 8, 13, 8, 3],
  69: [0, 4, 8, 13, 8, 3],
  70: [0, 4, 8, 13, 8, 3],
};

/**
 * How far along the blessing chain the character is.
 *
 * The four elemental talismans grant their blessing in a fixed order — Dragão Azul → Tigre
 * Branco → Fênix Vermelha → Jabuti Negro — and each one only lands if the previous is
 * already up ("entra em estado de [Bênção do Tigre Branco] se possuir a [Bênção do Dragão
 * Azul] ativada"). The client's EFST table names them by compass point instead: Leste
 * (1360), Oeste (1361), Sul (1362), Norte (1363). So this is one state advancing, not four
 * independent flags, and Talismã das Divindades hits once per blessing plus one.
 *
 * The numbers are load-bearing — saved builds and share links carry them — and have not
 * moved. What moved is which beast rungs 2 and 3 are named after: they read South and West,
 * which put Fênix ahead of Tigre. `sa-exorcismo-gear-states.rrf` casts all four in order and
 * the EFST timeline is 1360 → 1361 → 1362 → 1363, one replacing the last.
 */
const BlessingValue = {
  BlueDragon: 1,
  WhiteTiger: 2,
  RedPhoenix: 3,
  BlackTortoise: 4,
  AllFour: 5,
} as const;

type BlessingValueT = typeof BlessingValue[keyof typeof BlessingValue];

/**
 * The tail every talisman ratio carries: the client's "Nv. de Perícia" column, which is
 * `Perícia com Talismãs × 15` per skill level, plus a FEI term.
 *
 * **The FEI term is the one number here the client never states.** `FEI × 5` is the Sigma
 * "2nd version" figure, which is what this file used before its damage columns were
 * replaced, and it is kept deliberately: `SoulAscetic.exorcismo-replay.spec.ts` bounds it
 * at FEI × 5,5..6,2 for a Lv1 talisman, so it is close but probably low, and one recording
 * of five single casts through a rolling weapon MATK cannot do better than that. Settling
 * it needs a **bare-handed** recording of a talisman at Lv1 and Lv5 — with no weapon there
 * is no MATK roll for a wrong coefficient to hide inside, which is exactly how the same
 * file settled Exorcizar Assombração to the unit.
 */
const talismanTail = (talismanMastery: number, skillLevel: number, totalSpl: number) =>
  talismanMastery * 15 * skillLevel + totalSpl * 5;

/** Talismã do Ceifeiro and Mandala das Feras read "Nv. de Perícia e Maestria" instead, so
 *  both masteries count, at 7 and 15 per skill level respectively. */
const masteryTail = (talismanMastery: number, soulMastery: number, per: number, skillLevel: number, totalSpl: number) =>
  (talismanMastery + soulMastery) * per * skillLevel + totalSpl * 5;

export class SoulAscetic extends SoulReaper {
  protected override CLASS_NAME = ClassName.SoulAscetic;
  protected override JobBonusTable = jobBonusTable;
  protected override TraitBonusTable = traitBonusTable;

  protected override minMaxLevel = JOB_4_MIN_MAX_LEVEL;
  protected override maxJob = JOB_4_MAX_JOB_LEVEL;

  private readonly classNames4th = [ClassName.Only_4th, ClassName.SoulAscetic];

  /**
   * Every damage column below is the client's own per-level row from
   * `SKILL_META[...].description`, not the Sigma "2nd version" blog the `[V2]` labels used
   * to mark. The two disagree by a lot — the blog put Talismã do Dragão Lv1 at
   * `250 + 1.450` where the client says `900` — and `sa-exorcismo-gear-states.rrf` sides
   * with the client: its five Lv1 casts put that ratio at 3.216-3.743 against the 4.961 the
   * blog's table produced. See [[sigma-v2-vs-client-tables]].
   *
   * The second column of each client table is the **[Mandala das Feras]** state, not
   * Talismã dos Elementos — that one is only the "+4% de dano contra as propriedades Água,
   * Vento, Terra, Fogo e Neutro" buff, and it is modelled as such below.
   */
  private readonly atkSkillList4th: AtkSkillModel[] = [
    {
      name: 'Exorcism of Malicious Soul',
      label: 'Exorcism of Malicious Soul Lv5',
      value: 'Exorcism of Malicious Soul==5',
      acd: 0,
      fct: 1.5,
      vct: 3,
      cd: 1,
      isMatk: true,
      hit: 5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const soulMasteryLv = this.learnLv('Soul Mastery');
        const totalSoul = this.activeSkillLv('Total Soul') || 1;

        // Totem of Tutelary (or the target carrying Dead Spirit's Curse, which the
        // calc doesn't model) *enhances* the skill to the 250 coefficient. Both branches
        // are confirmed to the unit by the replay's bare window.
        if (this.isSkillActive('Totem of Tutelary')) {
          return (250 * skillLevel + soulMasteryLv * 2 + totalSpl) * totalSoul * (baseLevel / 100);
        }

        return (150 * skillLevel + soulMasteryLv * 2 + totalSpl) * totalSoul * (baseLevel / 100);
      },
    },
    {
      // "Arremessa um Talismã em um alvo único", so one hit and no display multiplier.
      name: 'Talisman of Soul Stealing',
      label: 'Talisman of Soul Stealing Lv5',
      value: 'Talisman of Soul Stealing==5',
      acd: 0,
      fct: 1.5,
      vct: 3,
      cd: 1,
      isMatk: true,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const soulMaster = this.learnLv('Soul Mastery');

        // 1.500% / 2.000% / 2.500% / 3.000% / 3.500%, i.e. 1.000 + 500 per level.
        return (1000 + 500 * skillLevel + masteryTail(talisMaster, soulMaster, 7, skillLevel, totalSpl)) * (baseLevel / 100);
      },
    },
    {
      name: 'Talisman of Blue Dragon',
      label: 'Talisman of Blue Dragon Lv5',
      value: 'Talisman of Blue Dragon==5',
      acd: 0,
      fct: 1.5,
      vct: 1,
      cd: 0.3,
      isMatk: true,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const tail = talismanTail(talisMaster, skillLevel, totalSpl);

        // 900% per level, 1.350% under Mandala.
        if (this.isSkillActive('_SoulAscetic_Mandala')) {
          return (1350 * skillLevel + tail) * (baseLevel / 100);
        }

        return (900 * skillLevel + tail) * (baseLevel / 100);
      },
    },
    {
      name: 'Talisman of White Tiger',
      label: 'Talisman of White Tiger Lv5',
      value: 'Talisman of White Tiger==5',
      acd: 0,
      fct: 1.5,
      vct: 1,
      cd: 0.4,
      isMatk: true,
      hit: 2,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const tail = talismanTail(talisMaster, skillLevel, totalSpl);

        // 700% per level, 1.000% under Mandala.
        if (this.isSkillActive('_SoulAscetic_Mandala')) {
          return (1000 * skillLevel + tail) * (baseLevel / 100);
        }

        return (700 * skillLevel + tail) * (baseLevel / 100);
      },
    },
    {
      name: 'Talisman of Red Phoenix',
      label: 'Talisman of Red Phoenix Lv5',
      value: 'Talisman of Red Phoenix==5',
      acd: 0,
      fct: 1.5,
      vct: 1,
      cd: 0.45,
      isMatk: true,
      hit: 3,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const tail = talismanTail(talisMaster, skillLevel, totalSpl);

        // 2.100% → 4.500% in steps of 600; 2.900% → 6.500% in steps of 900 under Mandala.
        if (this.isSkillActive('_SoulAscetic_Mandala')) {
          return (2000 + 900 * skillLevel + tail) * (baseLevel / 100);
        }

        return (1500 + 600 * skillLevel + tail) * (baseLevel / 100);
      },
    },
    {
      name: 'Talisman of Black Tortoise',
      label: 'Talisman of Black Tortoise Lv5',
      value: 'Talisman of Black Tortoise==5',
      acd: 0,
      fct: 1.5,
      vct: 1,
      cd: 0.7,
      isMatk: true,
      hit: 3,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const tail = talismanTail(talisMaster, skillLevel, totalSpl);

        // 2.900 → 6.500 in steps of 900; 3.350 → 8.750 in steps of 1.350 under Mandala.
        // (The client prints this one's two columns without the % sign the others carry.)
        if (this.isSkillActive('_SoulAscetic_Mandala')) {
          return (2000 + 1350 * skillLevel + tail) * (baseLevel / 100);
        }

        return (2000 + 900 * skillLevel + tail) * (baseLevel / 100);
      },
    },
    {
      name: 'Talisman of Four Bearing God',
      label: 'Talisman of Four Bearing God Lv5',
      value: 'Talisman of Four Bearing God==5',
      acd: 0,
      fct: 1.5,
      vct: 2,
      cd: 1,
      isMatk: true,
      /**
       * "O número de ataques aumenta com o número de Feras Divinas que abençoaram você" —
       * one hit per blessing plus one, and 7 flat while [Mandala das Feras] is up. The
       * replay lands the four-blessing case: cast at t=159,3s with Bênção do Norte
       * running, the packet carries `count` 5.
       */
      totalHit: () => {
        if (this.isSkillActive('_SoulAscetic_Mandala')) return 7;

        const blessing = this.activeSkillLv('_SoulAscetic_Blessing') as BlessingValueT;
        const hitMap = {
          [BlessingValue.BlueDragon]: 2,
          [BlessingValue.WhiteTiger]: 3,
          [BlessingValue.RedPhoenix]: 4,
          [BlessingValue.BlackTortoise]: 5,
          [BlessingValue.AllFour]: 5,
        };

        return hitMap[blessing] || 1;
      },
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');

        // 200% per level, per hit. No Mandala damage column — Mandala buys hits instead.
        return (200 * skillLevel + talismanTail(talisMaster, skillLevel, totalSpl)) * (baseLevel / 100);
      },
    },
    {
      name: 'Mandala of the Beasts',
      label: 'Mandala of the Beasts Lv5',
      value: 'Mandala of the Beasts==5',
      acd: 0,
      fct: 1.5,
      vct: 2,
      cd: 5,
      isMatk: true,
      /**
       * Five hits, from the replay's single cast: 13.775.920 at `count` 5. Reading the
       * client's row as the whole packet instead would need a FEI term near 45.000.
       *
       * OPEN, and why this skill's damage is not asserted against that packet: with the
       * `FEI × 5` the rest of the tree uses, the ratio comes out 11-30% under what the
       * packet implies (the file bounds it at 106.050-123.440 against 95.040 here). Two
       * readings fit — a FEI term that scales with skill level, or the +25 S.ATQM landing
       * on Mandala's own hit rather than only afterwards — and one cast through a rolling
       * weapon MATK cannot separate them. The bare-handed recording the talisman tables
       * want settles this one too.
       */
      totalHit: 5,
      formula: (input: AtkSkillFormulaInput): number => {
        const { model, skillLevel, status } = input;
        const { totalSpl } = status;
        const baseLevel = model.level;
        const talisMaster = this.learnLv('Talisman Mastery');
        const soulMaster = this.learnLv('Soul Mastery');

        // 1.500 per level, per hit.
        return (1500 * skillLevel + masteryTail(talisMaster, soulMaster, 15, skillLevel, totalSpl)) * (baseLevel / 100);
      },
    },
  ];
  private readonly activeSkillList4th: ActiveSkillModel[] = [
    {
      /**
       * The state Mandala das Feras leaves behind ("Após o ataque, o usuário entra em
       * estado de [Mandala das Feras] e aumenta o S.ATQM"), EFST 1364. It is what every
       * talisman's second damage column keys on, and what takes Talismã das Divindades to
       * 7 hits. The replay measures the S.ATQM leg directly: the status window prints 62
       * and drops to 37 when 1364 expires at t=61,2s, on a character whose only other
       * S.ATQM is Perícia com Talismãs Lv6 and the trait table.
       */
      name: '_SoulAscetic_Mandala',
      label: 'Mandala of the Beasts',
      inputType: 'dropdown',
      dropdown: genSkillList(5, lv => ({ sMatk: lv * 5 })),
    },
    {
      /**
       * "Aumenta o P.ATQ temporariamente", +2 per level for 300s at Lv5. A self/party buff
       * with no state of its own beyond the number.
       */
      name: 'Talisman of the Warrior',
      label: 'Talisman of the Warrior',
      inputType: 'dropdown',
      dropdown: genSkillList(5, lv => ({ pAtk: lv * 2 })),
    },
    {
      /**
       * The S.ATQM twin, +2 per level. `soa-exorcismo.rrf` runs it at Lv2 (EFST 1358) for
       * its whole 14 seconds, and its +4 S.ATQM is what closes that recording's residual:
       * without it the simulated ceiling sits 1,7% under the highest packet.
       */
      name: 'Talisman of the Magician',
      label: 'Talisman of the Magician',
      inputType: 'dropdown',
      dropdown: genSkillList(5, lv => ({ sMatk: lv * 2 })),
    },
    {
      name: 'Talisman of Five Elements',
      label: 'Five Elements',
      inputType: 'dropdown',
      dropdown: genSkillList(5, lv => ({
        p_element_water: lv * 4,
        p_element_wind: lv * 4,
        p_element_earth: lv * 4,
        p_element_fire: lv * 4,
        p_element_neutral: lv * 4,
        m_element_water: lv * 4,
        m_element_wind: lv * 4,
        m_element_earth: lv * 4,
        m_element_fire: lv * 4,
        m_element_neutral: lv * 4,
      })),
    },
    {
      name: '_SoulAscetic_Blessing',
      label: 'Blessing of',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Blue Dragon (East)', value: BlessingValue.BlueDragon, isUse: true },
        { label: 'White Tiger (West)', value: BlessingValue.WhiteTiger, isUse: true },
        { label: 'Red Phoenix (South)', value: BlessingValue.RedPhoenix, isUse: true },
        { label: 'Black Tortoise (North)', value: BlessingValue.BlackTortoise, isUse: true },
        { label: 'All four beasts', value: BlessingValue.AllFour, isUse: true },
      ],
    },
    {
      name: 'Totem of Tutelary',
      label: 'Totem of Tutelary',
      inputType: 'dropdown',
      dropdown: [
        { label: '-', value: 0, isUse: false },
        { label: 'Nv 5', value: 1, isUse: true },
      ],
    },
  ];
  private readonly passiveSkillList4th: PassiveSkillModel[] = [
    {
      name: 'Talisman Mastery',
      label: 'Talisman Mastery',
      inputType: 'dropdown',
      dropdown: genSkillList(10, lv => ({ sMatk: lv })),
    },
    {
      name: 'Soul Mastery',
      label: 'Soul Mastery',
      inputType: 'dropdown',
      dropdown: genSkillList(10, lv => ({ spl: lv })),
    },
  ];

  constructor() {
    super();

    this.inheritSkills({
      activeSkillList: this.activeSkillList4th,
      atkSkillList: this.atkSkillList4th,
      passiveSkillList: this.passiveSkillList4th,
      classNames: this.classNames4th,
    });
  }
}

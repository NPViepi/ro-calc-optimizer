import { describe, expect, it } from 'vitest';
import { ElementType } from '../constants/element-type.const';
import { formatCalcNumber } from '../utils';
import { ArchMage } from './ArchMage';
import { AtkSkillFormulaInput, AtkSkillModel } from './_character-base.abstract';

/**
 * Cacos de Gelo (Crystal Impact, AG_CRYSTAL_IMPACT 5225) and the five levels of
 * Potencializar Magia (Climax) that reshape it.
 *
 * The skill was missing from the Magus rotation entirely — reported on the tracker as
 * card 7s1dGCi4xsZcgqtuHJfw, "não encontrei na lista". Two Water shards land per cast,
 * each carrying the whole ratio (skill level x 800 + SPL x 5) x base level / 100, so the
 * second is modelled as a `part2` rather than as a hit count on the first: from Climax 3
 * onwards the two stop being equal.
 *
 * The Climax table is bROWiki's, on both the Cacos de Gelo and the Potencializar Magia
 * pages. The LATAM client description omits the Lv1 clause — it mentions the Geleira
 * buff but not that the cast stops dealing damage — while every sibling skill spells the
 * same clause out on its own no-damage level.
 */

const LEVEL = 5;
const BASE_LEVEL = 250;
const TOTAL_SPL = 100;
/** (5 x 800 + 100 x 5) x 250/100 */
const BASE_RATIO = 11250;

const inputAtLevel = (skillLevel: number) =>
  ({ skillLevel, model: { level: BASE_LEVEL }, status: { totalSpl: TOTAL_SPL } }) as unknown as AtkSkillFormulaInput;
const formulaInput = inputAtLevel(LEVEL);

/** An ArchMage with Potencializar Magia held at `climaxLevel` (0 = not cast). */
const magusWithClimax = (climaxLevel: number) => {
  const cls = new ArchMage();
  const activeSkillIds = cls.activeSkills.map((s) => (s.name === 'Climax' ? climaxLevel : 0));
  cls.setLearnSkills({ activeSkillIds, passiveSkillIds: cls.passiveSkills.map(() => 0) });
  cls.getSkillBonusAndName();

  return cls;
};

const crystalImpact = (cls: ArchMage): AtkSkillModel => {
  const skill = cls.atkSkills.find((s) => s.name === 'Crystal Impact');
  if (!skill) throw new Error('Crystal Impact is not in the Magus skill list');

  return skill;
};

/** [first shard, second shard] ratios at the given Climax level. */
const shardRatios = (climaxLevel: number): number[] => {
  const skill = crystalImpact(magusWithClimax(climaxLevel));

  return [skill.formula(formulaInput), skill.part2.formula(formulaInput)];
};

describe('Cacos de Gelo is offered to the Magus rotation', () => {
  it('is in the class skill list, at level 5', () => {
    expect(crystalImpact(new ArchMage()).value).toBe('Crystal Impact==5');
  });

  it('throws two Water shards of magic damage', () => {
    const skill = crystalImpact(new ArchMage());

    expect(skill.isMatk).toBe(true);
    expect(skill.element).toBe(ElementType.Water);
    expect(skill.part2.isMatk).toBe(true);
    expect(skill.part2.element).toBe(ElementType.Water);
  });

  it('offers every one of its five levels in the picker', () => {
    expect(crystalImpact(new ArchMage()).levelList).toEqual([
      { label: 'Crystal Impact Nv1', value: 'Crystal Impact==1' },
      { label: 'Crystal Impact Nv2', value: 'Crystal Impact==2' },
      { label: 'Crystal Impact Nv3', value: 'Crystal Impact==3' },
      { label: 'Crystal Impact Nv4', value: 'Crystal Impact==4' },
      { label: 'Crystal Impact Nv5', value: 'Crystal Impact==5' },
    ]);
  });

  // 800% per level per shard, on the client's own table.
  it('pays 800% a level on each shard, at every level', () => {
    const skill = crystalImpact(magusWithClimax(0));

    expect([1, 2, 3, 4, 5].map((lv) => skill.formula(inputAtLevel(lv)))).toEqual([3250, 5250, 7250, 9250, BASE_RATIO]);
  });

  // The client's own Conjuração/Espera window for 5225, mirrored in skill-delay.json.
  it('carries the client cast and delay window', () => {
    const skill = crystalImpact(new ArchMage());

    expect({ fct: skill.fct, vct: skill.vct, acd: skill.acd, cd: skill.cd }).toEqual({ fct: 1.5, vct: 4, acd: 0.5, cd: 2 });
  });
});

describe('Potencializar Magia reshapes it level by level', () => {
  it('leaves both shards on the full ratio when Climax is not cast', () => {
    expect(shardRatios(0)).toEqual([BASE_RATIO, BASE_RATIO]);
  });

  it('stops the damage outright at Lv1, where the cast only grants Geleira', () => {
    expect(shardRatios(1)).toEqual([0, 0]);
  });

  it('makes the first shard strike twice at Lv2', () => {
    expect(shardRatios(2)).toEqual([BASE_RATIO * 2, BASE_RATIO]);
  });

  it('adds 50% to the first shard alone at Lv3', () => {
    expect(shardRatios(3)).toEqual([BASE_RATIO * 1.5, BASE_RATIO]);
  });

  it('trades half the first shard for 150% more on the second at Lv4', () => {
    expect(shardRatios(4)).toEqual([BASE_RATIO * 0.5, BASE_RATIO * 2.5]);
  });

  // Lv5 is area only: 31x31 cells, with the second shard splashing 5x5 around each
  // target it reaches. Neither changes a damage figure.
  it('changes nothing but the area at Lv5', () => {
    expect(shardRatios(5)).toEqual([BASE_RATIO, BASE_RATIO]);
  });
});

describe('The Hab. Base step says where its percentage came from', () => {
  const calcOf = (climaxLevel: number, shard: 1 | 2) => {
    const skill = crystalImpact(magusWithClimax(climaxLevel));
    const ratioCalc = shard === 1 ? skill.ratioCalc : skill.part2.ratioCalc;

    return ratioCalc?.(formulaInput);
  };

  // Without Climax the ratio is the client table and nothing else, so a breakdown would
  // only repeat the label the chip already carries.
  it('says nothing when Potencializar Magia is not up', () => {
    expect(calcOf(0, 1)).toBeUndefined();
  });

  it('walks the table, the FEI term and the Climax factor, in that order', () => {
    const calc = calcOf(4, 1);

    expect(calc?.rows.map((r) => [r.label, r.display])).toEqual([
      ['Cacos de Gelo Nv 5 (tabela do cliente)', '4.000%'],
      ['FEI 100 × 5', '4.500%'],
      ['Potencializar Magia Nv 4: dano do 1º caco -50%, do 2º caco +150%', '× 0,5'],
      ['Hab. Base (1º caco)', '2.250%', ],
    ]);
  });

  it('closes each shard on the ratio its own formula returns', () => {
    for (const shard of [1, 2] as const) {
      for (const climax of [1, 2, 3, 4, 5]) {
        const calc = calcOf(climax, shard);
        const skill = crystalImpact(magusWithClimax(climax));
        const ratio = shard === 1 ? skill.formula(formulaInput) : skill.part2.formula(formulaInput);
        // The rows are percentages; the chain multiplies them by the base level.
        expect(calc?.rows.at(-1)?.display).toBe(`${formatCalcNumber(ratio / (BASE_LEVEL / 100))}%`);
      }
    }
  });

  it('points the reader at the bROWiki page behind the table', () => {
    expect(calcOf(3, 1)?.link?.url).toBe('https://browiki.org/wiki/Cacos_de_Gelo');
  });
});

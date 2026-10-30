import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CalculatorController } from '../core/calculator-controller';
import { Calculator } from '../core/calculator';
import { ElementType } from '../constants';
import { MysticSymphonyFn } from '../constants/share-passive-skills/mystic-symphony-fn';
import { createMainModel } from '../utils';
import { AtkSkillFormulaInput, AtkSkillModel } from './_character-base.abstract';
import { METALLIC_FURY } from '../skills/shared-skills';
import { Troubadour } from './Troubadour';
import { Trouvere } from './Trouvere';

// Card: simulador-furia-estridente-da-diva-nao-esta-na-lista-de-habilidades.
// The skill (5356) was only reachable through the rebalance versions, because the
// "Atual (LATAM)" catalog had no entry for it at all. Each table below names the
// source it pins; METALLIC_FURY's docblock carries the URLs.
const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSp = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const BASE_LEVEL = 100; // × baseLevel/100 = ×1, so the ratio reads as the client's %

/** The ratio alone, at a chosen base level, SPL, Presença de Palco and mark state. */
function ratio(
  skillLevel: number,
  { level = BASE_LEVEL, spl = 0, stageManner = 0, marked = false } = {},
): number {
  const input = {
    model: { level },
    skillLevel,
    status: { totalSpl: spl },
    skills: {
      isActive: (name: string) => marked && name === '_Debuf_Sonic_Brand',
      learnedLevel: (name: string) => (name === 'Stage Manner' ? stageManner : 0),
    },
  } as unknown as AtkSkillFormulaInput;

  // The server int-casts the ratio; see [[skill-ratio-truncation]].
  return Math.floor(METALLIC_FURY.formula(input));
}

function run(Class: typeof Troubadour | typeof Trouvere, ammo: number) {
  const cls = new Class();
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: cls.activeSkills.map(() => 0), passiveSkillIds: cls.passiveSkills.map(() => 0) })
    .getSkillBonusAndName();
  const model = createMainModel();
  model.level = 250;
  model.weapon = Class === Troubadour ? 570028 : 580028;
  model.ammo = ammo;
  model.selectedAtkSkill = 'Metallic Fury==5';
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSp).setClass(cls);
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[21077], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined, extraOptionScripts: [],
    activeSkillNames, learnedSkillMap, selectedAtkSkill: 'Metallic Fury==5',
    selectedChances: [], usedHpL: false,
  } as any);
  return (calc as any).damageSummary;
}

describe('Fúria Estridente', () => {
  it('is in the "Atual (LATAM)" catalog of both classes, as magic', () => {
    for (const Class of [Troubadour, Trouvere]) {
      const skill = new Class().atkSkills.find((s: AtkSkillModel) => s.name === 'Metallic Fury');
      expect(skill).toBe(METALLIC_FURY);
      expect(skill?.isMatk).toBe(true);
    }
  });

  it('can be simulated at every level, not only at the cap', () => {
    expect(METALLIC_FURY.levelList?.map((l) => l.value)).toEqual([
      'Metallic Fury==1', 'Metallic Fury==2', 'Metallic Fury==3', 'Metallic Fury==4', 'Metallic Fury==5',
    ]);
  });

  it('keeps the rebalance pickers free of a doubled level, as the synthesised entry was', () => {
    // `resolveRebalancedSkill` rebuilds the list as `${label} Nv${n}`, and the UI only
    // swaps the English name for the pt-BR one. A label of "Metallic Fury Lv5" would
    // therefore read "Fúria Estridente Lv5 Nv1" once this entry exists in `current`.
    for (const version of ['pre-rebalance', 'rebalance-2026-02'] as const) {
      const skill = new Trouvere().getAtkSkills(version).find((s) => s.name === 'Metallic Fury');
      expect(skill?.levelList?.[0].label).toBe('Metallic Fury Nv1');
    }
  });

  describe('900% per level, the client table', () => {
    const client = [900, 1800, 2700, 3600, 4500];

    it.each(client.map((pct, i) => ({ lv: i + 1, pct })))('Nv $lv -> $pct%', ({ lv, pct }) => {
      expect(ratio(lv)).toBe(pct);
    });
  });

  describe('×1,1 against a target under [Desarranjo Musical]', () => {
    // The wiki's "Desarranjo ♬" column, and the notice's second Nv5 figure (4.950%).
    const branded = [990, 1980, 2970, 3960, 4950];

    it.each(branded.map((pct, i) => ({ lv: i + 1, pct })))('Nv $lv -> $pct%', ({ lv, pct }) => {
      expect(ratio(lv, { marked: true })).toBe(pct);
    });
  });

  it('adds (SPL / 2) x the Presença de Palco level, outside the mark multiplier', () => {
    expect(ratio(5, { spl: 100, stageManner: 5 })).toBe(4500 + 250);
    expect(ratio(5, { spl: 100, stageManner: 5, marked: true })).toBe(4950 + 250);
    // Without Presença de Palco the SPL term drops out entirely, as the wiki states.
    expect(ratio(5, { spl: 100 })).toBe(4500);
  });

  it('scales with the base level', () => {
    expect(ratio(5, { level: 250 })).toBe(Math.floor(4500 * 2.5));
  });

  it('requires a whip or instrument and an equipped arrow', () => {
    expect(METALLIC_FURY.verifyItemFn?.({ weapon: { isType: () => true }, model: { ammo: 1752 } } as any)).toBe('');
    expect(METALLIC_FURY.verifyItemFn?.({ weapon: { isType: () => true }, model: { ammo: 0 } } as any)).toBe('Flecha');
    expect(METALLIC_FURY.verifyItemFn?.({ weapon: { isType: () => false }, model: { ammo: 1752 } } as any)).toContain('instrument');
  });

  it('uses the equipped arrow element in the magic pipeline', () => {
    for (const Class of [Troubadour, Trouvere]) {
      expect(run(Class, 1752).skillPropertyAtk).toBe(ElementType.Fire);
      expect(run(Class, 1754).skillPropertyAtk).toBe(ElementType.Water);
    }
  });

  it('is not one of the skills Sinfonia Mística boosts', () => {
    const bonus = MysticSymphonyFn().dropdown[0].bonus as Record<string, number>;
    expect(bonus[5356]).toBeUndefined();
    // The three the client does list, for contrast.
    expect([bonus[5357], bonus[5355], bonus[5353]]).toEqual([100, 100, 100]);
  });
});

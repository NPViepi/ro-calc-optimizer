import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AllowedCompareItemTypes } from 'src/app/app-config';
import { PetLoyalty } from 'src/app/constants';
import { itemSlotLabelKey } from 'src/app/constants/item-slot-i18n';
import { DEFAULT_CATALOG } from 'src/app/i18n';
import { RuneKnight } from 'src/app/jobs';
import { createMainModel } from 'src/app/utils';
import { Calculator } from '../calculator';

/**
 * The pet joined the "comparar slot" list, suggested by Ynk. What makes it different from
 * every other row already there is that an egg's bonus is chosen by TWO fields, not one:
 * the egg and its loyalty tier. The tiers **replace** one another rather than stacking
 * (LOYALTY[n] matches by equality — see calculator.ts), so an egg priced at the wrong tier
 * is not a smaller bonus, it is a different one. These pin that, so the compare loop
 * carrying `petLoyalty` alongside `pet` is not something a later refactor can quietly drop.
 */
const db = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));

const OVO_PORING = 9001; // luk +2 na Lealdade 3, +3 na 4; cri +1 em ambas
const OVO_DROPS = 9002; // atk +3 na Lealdade 3, +5 na 4; hit igual

const monster = {
  id: 1002, name: 'Poring', spawn: 'x',
  stats: { level: 1, health: 50, attack: { min: 7, max: 8 }, range: 1, defense: 0, magicDefense: 0, str: 1, int: 0, vit: 1, dex: 6, agi: 1, luk: 30, element: 1, elementName: 'Water', elementShortName: 'W1', race: 4, raceName: 'Plant', scale: 0, scaleName: 'Small', class: 0, criShield: 0, softDef: 0, mdef: 0, softMdef: 0, res: 0, mres: 0 },
  data: { def: 0, mdef: 0, criShield: 0, softDef: 0, res: 0, mres: 0 },
} as any;

/** Totals for a build wearing one egg at one tier, and nothing else. */
function totals(pet: number | undefined, petLoyalty: PetLoyalty): Record<string, number> {
  const cls = new RuneKnight();
  cls.setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] }).getSkillBonusAndName();
  const calc = new Calculator();
  calc
    .setMasterItems({ [OVO_PORING]: { ...db[OVO_PORING] }, [OVO_DROPS]: { ...db[OVO_DROPS] } } as any)
    .setHpSpTable([{ jobs: {}, baseHp: Array(251).fill(1000), baseSp: Array(251).fill(100) }] as any)
    .setClass(cls)
    .setMonster(monster);

  const model = createMainModel();
  model.level = 200;
  model.pet = pet;
  model.petLoyalty = petLoyalty;

  calc.loadItemFromModel(model).prepareAllItemBonus();

  return (calc as any).totalEquipStatus as Record<string, number>;
}

/** What the egg alone contributes, so the class's own passives cancel out. */
const delta = (pet: number, loyalty: PetLoyalty, key: string) =>
  (totals(pet, loyalty)[key] ?? 0) - (totals(undefined, loyalty)[key] ?? 0);

describe('pet as a comparable slot', () => {
  it('is offered in the "comparar slot" picker, with a pt-BR label', () => {
    expect([...AllowedCompareItemTypes]).toContain('pet');
    expect(DEFAULT_CATALOG[itemSlotLabelKey('pet')]).toBe('Pet');
  });

  /*
   * The reason the tier has to travel with the egg. If the compared egg were priced at the
   * main build's tier, an Ovo de Poring at Lealdade 4 would be read as +2 LUK instead of
   * +3 — a wrong answer that looks like a plausible one.
   */
  it('gives an egg a different bonus per loyalty tier', () => {
    expect(delta(OVO_PORING, PetLoyalty.Normal, 'luk')).toBe(2);
    expect(delta(OVO_PORING, PetLoyalty.Alta, 'luk')).toBe(3);

    expect(delta(OVO_DROPS, PetLoyalty.Normal, 'atk')).toBe(3);
    expect(delta(OVO_DROPS, PetLoyalty.Alta, 'atk')).toBe(5);
  });

  it('keeps the tiers exclusive rather than summing them', () => {
    // 2 or 3, never 5: LOYALTY[n] matches by equality.
    const both = delta(OVO_PORING, PetLoyalty.Alta, 'luk');
    expect(both).toBe(3);
    expect(both).not.toBe(5);
  });

  it('applies a line that every tier shares, at whichever tier is set', () => {
    expect(delta(OVO_PORING, PetLoyalty.Normal, 'cri')).toBe(1);
    expect(delta(OVO_PORING, PetLoyalty.Alta, 'cri')).toBe(1);
  });

  it('contributes nothing below the tiers the egg names', () => {
    // Ovo de Poring only speaks for tiers 3 and 4.
    expect(delta(OVO_PORING, PetLoyalty.Baixa, 'luk')).toBe(0);
    expect(delta(OVO_PORING, PetLoyalty.Baixa, 'cri')).toBe(0);
  });
});

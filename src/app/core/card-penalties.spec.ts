import { readFileSync } from 'node:fs';
import { Cardinal } from 'src/app/jobs';
import { createMainModel } from 'src/app/utils';
import { INERT_MONSTER, makeCalculator } from './__tests__/make-calculator';
import { wornBonus } from './__tests__/worn-bonus';

/**
 * Cards whose pt-BR text carries a penalty the record dropped. An audit of every card
 * description with a negative number against its script turned up four.
 */

const db = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));

describe('Carta Dollocaris Monocular (300375) on the Casaco Pirata (480174, level 2)', () => {
  // "Dano mágico de propriedade Sombrio, Sagrado, Fantasma e Neutro -25%.
  //  Refino +12 ou mais: ... +50%.  Em equip. de nível 2: ... +8% adicional."
  // The record only carried the net +25 at +12, so below +12 the card read as +8, not -17.
  const KEYS = ['m_my_element_dark', 'm_my_element_holy', 'm_my_element_ghost', 'm_my_element_neutral'];

  const worn = (garmentRefine: number) =>
    wornBonus({ garment: 480174, garmentRefine, garmentCard: 300375, cls: new Cardinal() });

  /** Holy Light max damage with the Casaco Pirata, carded or not. */
  function holyLight(garmentCard: number | undefined) {
    const cls = new Cardinal();
    const calc = makeCalculator(db, cls).setMonster({ ...INERT_MONSTER, stats: { ...INERT_MONSTER.stats, elementName: 'Water 1' } });
    const model = { ...createMainModel(), class: cls.classNameSet, level: 200, int: 100, garment: 480174, garmentRefine: 0, garmentCard };
    calc.setModel(model).loadItemFromModel(model).prepareAllItemBonus().calcAllAtk().calculateAllDamages('Holy Light==1');
    return (calc as any).damageSummary.skillMaxDamage as number;
  }

  it('is a net penalty below +12', () => {
    const t = worn(0);
    for (const key of KEYS) expect(t[key], key).toBe(-25 + 8);
  });

  it('turns into a bonus at +12', () => {
    const t = worn(12);
    for (const key of KEYS) expect(t[key], key).toBe(-25 + 50 + 8);
  });

  it('lowers holy magic damage below +12', () => {
    const bare = holyLight(undefined);
    const carded = holyLight(300375);
    expect(bare).toBeGreaterThan(0);
    expect(carded / bare).toBeCloseTo(0.83, 2);
  });
});

describe('Carta Fanático das Trevas (27265)', () => {
  // "Dano físico e mágico contra oponentes de propriedade Fogo e Sagrado -30%."
  it('takes 30% off against Fire and Holy targets', () => {
    const t = wornBonus({ weapon: 1201, weaponCard: 27265 });
    for (const key of ['p_element_fire', 'p_element_holy', 'm_element_fire', 'm_element_holy']) expect(t[key], key).toBe(-30);
    expect(t.p_element_dark).toBe(30);
  });
});

describe('Carta Aquila (300382)', () => {
  // "Resistência a todas as propriedades -30%."
  it('lowers every elemental resistance by 30%', () => {
    expect(wornBonus({ garment: 480174, garmentCard: 300382 }).subele_all).toBe(-30);
  });
});

describe('Carta Gemaring (4662)', () => {
  // "A cada 10 de FOR base até o 50: ATQ -5." and the same for each base stat.
  const worn = (base: number) =>
    wornBonus({ garment: 480174, garmentCard: 4662, stats: { str: base, agi: base, vit: base, int: base, dex: base, luk: base } });

  it.each([
    [1, 0],
    [9, 0],
    [10, 1],
    [49, 4],
    [50, 5],
    [130, 5],
  ])('base %i gives %i penalty steps, capped at 50', (base, steps) => {
    const t = worn(base);
    expect(t.atk).toBe(25 - 5 * steps);
    expect(t.matk).toBe(25 - 5 * steps);
    expect(t.hp).toBe(1000 - 200 * steps);
    expect(t.aspdPercent).toBe(10 - 2 * steps);
    expect(t.range).toBe(5 - steps);
    expect(t.criDmg).toBe(10 - 2 * steps);
  });
});

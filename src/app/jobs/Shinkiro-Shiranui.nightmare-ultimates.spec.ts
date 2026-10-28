import { describe, expect, it } from 'vitest';
import { ElementType } from '../constants';
import { resolveSkillMeta } from '../skills';
import { skillDescHtml } from '../utils';
import { AtkSkillModel, CharacterBase } from './_character-base.abstract';
import { Shinkiro } from './Shinkiro';
import { Shiranui } from './Shiranui';

/**
 * As duas ultimates do Pesadelo — card QmuDrNNL17a4dDs6FHFZ, "ta faltando a Kunai do
 * pesadelo".
 *
 * Kunai do Pesadelo (SS_HITOUAKUMU, 5494) causa 15.000% de ATQ mais (POD x 10), e Mahou
 * do Pesadelo (SS_ANKOKURYUUAKUMU, 5495) causa 12.000% de ATQM mais (FEI x 10), ambas de
 * nível único e ambas escalando pelo nível de base.
 *
 * Contra alvos em [Pesadelo] as duas causam 1,5x de dano, que é o que o cliente do LATAM
 * descreve para as duas. O bROWiki diverge só na Mahou, onde fala em 12.000% extras de
 * propriedade Fogo em vez do multiplicador; fica o cliente, que é o que o jogador lê.
 *
 * As duas entram nas duas classes porque é assim que o simulador já trata a linha Kunai e
 * a linha Mahou: Shinkiro e Shiranui carregam as duas famílias inteiras.
 *
 * @see https://browiki.org/wiki/Kunai_do_Pesadelo
 * @see https://browiki.org/wiki/Mahou_do_Pesadelo
 */

/** The class with [Pesadelo] either left off or turned on, as the UI toggle does it. */
const solve = (Ctor: new () => CharacterBase, nightmare: boolean) => {
  const cls = new Ctor();
  cls.setLearnSkills({
    activeSkillIds: cls.activeSkills.map((s) => (nightmare && s.name === '_Nightmare_target' ? 1 : 0)),
    passiveSkillIds: cls.passiveSkills.map(() => 0),
  }).getSkillBonusAndName();

  return cls;
};

/** Only two states exist per class, so each is built once. */
const SOLVED = new Map<string, CharacterBase>();
const classWith = (Ctor: new () => CharacterBase, nightmare: boolean): CharacterBase => {
  const key = `${Ctor.name}:${nightmare}`;
  if (!SOLVED.has(key)) SOLVED.set(key, solve(Ctor, nightmare));

  return SOLVED.get(key)!;
};

const skillOf = (cls: CharacterBase, name: string): AtkSkillModel => {
  const found = cls.atkSkills.find((entry) => entry.name === name);
  expect(found, `${name} is missing from the catalog`).toBeDefined();

  return found!;
};

const input = (over: { totalPow?: number; totalSpl?: number; baseLevel?: number }) =>
  ({
    model: { level: over.baseLevel ?? 100 },
    skillLevel: 1,
    status: { totalPow: over.totalPow ?? 0, totalSpl: over.totalSpl ?? 0 },
  }) as any;

/** Cada classe empresta o ícone do seu próprio aplicador de [Pesadelo]: Shinkiro é a
 *  metade POD e abre o estado pela linha Kunai, Shiranui é a metade SAB e o abre pela
 *  linha Mahou. São as duas pré-requisitos das ultimates que consomem o estado. */
const CLASSES: [string, new () => CharacterBase, number, string][] = [
  ['Shinkiro', Shinkiro, 5485, 'Kunai Distorcida'],
  ['Shiranui', Shiranui, 5492, 'Mahou da Escuridão'],
];

describe.each(CLASSES)('%s', (_name, Ctor, nightmareIcon, nightmareSkill) => {
  it('offers the [Pesadelo] state as a target toggle', () => {
    const toggle = new Ctor().activeSkills.find((s) => s.name === '_Nightmare_target');
    expect(toggle).toMatchObject({ label: 'Alvo em [Pesadelo]', inputType: 'selectButton' });
  });

  it(`empresta ícone e descrição de ${nightmareSkill}, o aplicador da própria classe`, () => {
    const toggle = new Ctor().activeSkills.find((s) => s.name === '_Nightmare_target');

    // A tela lê o mesmo `icon` duas vezes: desenha a figura e, por `buffTooltip`, escolhe
    // a descrição do balão. Sem ele o botão fica pelado, que é o que o card relatou.
    expect(toggle?.icon).toBe(nightmareIcon);
    expect(skillDescHtml(toggle?.icon)).toContain(nightmareSkill);
    expect(skillDescHtml(toggle?.icon)).toContain('[Pesadelo]');
  });

  it('keeps the toggle id-less, which is what lets the pt-BR label survive', () => {
    // Um nome que o catálogo resolve troca o rótulo pelo do cliente, e não há entrada que
    // signifique "o alvo está em [Pesadelo]": seis habilidades infligem o estado. O `icon`
    // acima resolve a figura sem mexer no rótulo, que é por isso que ele vem do modelo.
    expect(resolveSkillMeta('_Nightmare_target')?.id).toBeUndefined();
  });

  describe('Kunai do Pesadelo', () => {
    it('keeps the client cast, delay and recarga', () => {
      // skill-delay.json row 5494: fct 500, vct 2000, acd 500, cd 5000 (ms).
      expect(skillOf(classWith(Ctor, false), 'Kunai - Nightmare'))
        .toMatchObject({ fct: 0.5, vct: 2, acd: 0.5, cd: 5, value: 'Kunai - Nightmare==1' });
    });

    it('fixes no element — the equipped Kunai decides it', () => {
      expect(skillOf(classWith(Ctor, false), 'Kunai - Nightmare').element).toBeUndefined();
      expect(skillOf(classWith(Ctor, false), 'Kunai - Nightmare').isMatk).toBeUndefined();
    });

    it('hits for 15.000% de ATQ plus 10 x POD, scaled by base level', () => {
      const skill = skillOf(classWith(Ctor, false), 'Kunai - Nightmare');
      expect(skill.formula(input({}))).toBe(15000);
      expect(skill.formula(input({ totalPow: 150, baseLevel: 200 }))).toBe(33000);
    });

    it('hits 1,5x against a target in [Pesadelo]', () => {
      expect(skillOf(classWith(Ctor, true), 'Kunai - Nightmare').formula(input({}))).toBe(22500);
    });
  });

  describe('Mahou do Pesadelo', () => {
    it('keeps the client cast, delay and recarga', () => {
      // skill-delay.json row 5495: fct 1500, vct 2000, acd 500, cd 5000 (ms).
      expect(skillOf(classWith(Ctor, false), 'Dark Dragon - Nightmare'))
        .toMatchObject({ fct: 1.5, vct: 2, acd: 0.5, cd: 5, value: 'Dark Dragon - Nightmare==1' });
    });

    it('is Sombrio magic damage', () => {
      expect(skillOf(classWith(Ctor, false), 'Dark Dragon - Nightmare'))
        .toMatchObject({ isMatk: true, element: ElementType.Dark });
    });

    it('hits for 12.000% de ATQM plus 10 x FEI, scaled by base level', () => {
      const skill = skillOf(classWith(Ctor, false), 'Dark Dragon - Nightmare');
      expect(skill.formula(input({}))).toBe(12000);
      expect(skill.formula(input({ totalSpl: 150, baseLevel: 200 }))).toBe(27000);
    });

    it('hits 1,5x against a target in [Pesadelo]', () => {
      expect(skillOf(classWith(Ctor, true), 'Dark Dragon - Nightmare').formula(input({}))).toBe(18000);
    });
  });
});

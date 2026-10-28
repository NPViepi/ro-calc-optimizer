import { describe, expect, it } from 'vitest';
import { AbyssChaser } from './AbyssChaser';
import { AtkSkillModel, CharacterBase } from './_character-base.abstract';

/**
 * O estado [Ameaça] sobre Ofensiva Fatal — card z7bCXA6km845xiE7ViEb, "Adicionar Ameaça",
 * aberto por Adson a partir de um relato de Samuel Costa, apontando para
 * https://browiki.org/wiki/Ofensiva_Abissal#Amea%C3%A7a.
 *
 * O efeito já estava no motor desde que os arquivos de classe vieram do fork tailandês
 * (commit bbd8e729): `Fatal Manace` lê `Ofensiva Abissal` e troca a fórmula. O que não
 * havia era fonte — ninguém sabia de onde os números tinham saído nem se estavam certos.
 *
 * Saíram daqui, e estão. A página da Ofensiva Fatal publica as duas colunas lado a lado:
 *
 *   | Nv | ATQ Normal | ATQ Ameaça |
 *   | 1  | 120%       | 150%       |
 *   | 10 | 1.200%     | 1.500%     |
 *
 * e as duas fórmulas, `[Dano base + (AGI x 2)]` sem o estado e `[Dano base + (AGI x 3)]`
 * com ele. É exatamente 120/2 contra 150/3 por nível, que é o que o motor faz.
 *
 * A duração — 3 segundos por nível de Ofensiva Abissal, até 15 s no Nv 5 — não é modelada:
 * o simulador pergunta "o estado está ativo?", não "por quanto tempo". O botão Sim/Não da
 * Ofensiva Abissal é esse estado.
 *
 * @see https://browiki.org/wiki/Ofensiva_Fatal
 * @see https://browiki.org/wiki/Ofensiva_Abissal
 */

const classWith = (threat: boolean): CharacterBase => {
  const cls = new AbyssChaser();
  cls.setLearnSkills({
    activeSkillIds: cls.activeSkills.map((s) => (s.name === 'Abyss Dagger' ? (threat ? 5 : 0) : 0)),
    passiveSkillIds: cls.passiveSkills.map(() => 0),
  }).getSkillBonusAndName();

  return cls;
};

/** The two states this spec reads, solved once each. */
const MENACE: Record<'on' | 'off', AtkSkillModel> = {
  on: classWith(true).atkSkills.find((entry) => entry.name === 'Fatal Manace')!,
  off: classWith(false).atkSkills.find((entry) => entry.name === 'Fatal Manace')!,
};

const fatalMenace = (threat: boolean): AtkSkillModel => (threat ? MENACE.on : MENACE.off);

const input = (skillLevel: number, totalAgi = 0, baseLevel = 100) =>
  ({ model: { level: baseLevel }, skillLevel, status: { totalAgi } }) as any;

describe('Ofensiva Fatal', () => {
  it.each([
    [1, 120], [5, 600], [10, 1200],
  ])('hits for the ATQ column at Nv %i', (level, expected) => {
    expect(fatalMenace(false).formula(input(level))).toBe(expected);
  });

  it.each([
    [1, 150], [5, 750], [10, 1500],
  ])('hits for the ATQ (Ameaça) column at Nv %i', (level, expected) => {
    expect(fatalMenace(true).formula(input(level))).toBe(expected);
  });

  it('adds AGI x 2 normally and AGI x 3 under [Ameaça]', () => {
    expect(fatalMenace(false).formula(input(10, 100))).toBe(1200 + 200);
    expect(fatalMenace(true).formula(input(10, 100))).toBe(1500 + 300);
  });

  it('scales both readings by base level', () => {
    expect(fatalMenace(false).formula(input(10, 100, 200))).toBe((1200 + 200) * 2);
    expect(fatalMenace(true).formula(input(10, 100, 200))).toBe((1500 + 300) * 2);
  });
});

describe('Ofensiva Abissal', () => {
  it('is the toggle that puts the target in [Ameaça]', () => {
    const toggle = new AbyssChaser().activeSkills.find((s) => s.name === 'Abyss Dagger');
    expect(toggle?.inputType).toBe('selectButton');
    expect(toggle?.dropdown.find((option) => option.isUse)?.value).toBe(5);
  });

  it('hits for 350% per level plus 5 x POD, over two packets', () => {
    const skill = new AbyssChaser().atkSkills.find((entry) => entry.name === 'Abyss Dagger')!;
    expect(skill.totalHit).toBe(2);
    expect(skill.formula({ model: { level: 100 }, skillLevel: 5, status: { totalPow: 0 } } as any)).toBe(1750);
    expect(skill.formula({ model: { level: 100 }, skillLevel: 5, status: { totalPow: 100 } } as any)).toBe(2250);
  });
});

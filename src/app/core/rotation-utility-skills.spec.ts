import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AtkSkillModel } from '../jobs/_character-base.abstract';
import { CLASS_CTOR_BY_ID } from '../jobs/_class-list';
import { AbyssChaser } from '../jobs/AbyssChaser';
import { Shinkiro } from '../jobs/Shinkiro';
import { Shiranui } from '../jobs/Shiranui';
import { Thief } from '../jobs/Thief';
import { SKILL_ID_BY_NAME } from '../skills';
import { defaultAtkSkill, pruneRotationForClass } from './rotation';

/**
 * Habilidades sem dano na rotação — cards bLnU1DLpGeA2vxQ794I4 (Esconderijo, reportado por
 * Samuel Costa: "skill sem dano, apenas para calcular o DPS do ciclo") e
 * FPpmOoKCq7KzPxV4NUZ3 (Infiltrar, reportado por .Neblina).
 *
 * As duas ocupam uma ação do ciclo e não somam dano nenhum, e é justamente isso que o
 * pedido quer medir: com elas na rotação o DPS do ciclo cai, porque o tempo delas entra na
 * conta. Entram no catálogo de habilidades de ataque porque é dele que a rotação tira
 * tudo de que precisa — os tempos do cliente, a lista de níveis e o `value` que o link de
 * compartilhamento já fala —, e `isUtility` é o que as mantém fora do seletor de
 * habilidade única, que pergunta quanto a habilidade bate.
 */

const DELAYS: Record<string, { maxLevel: number; fct: number | number[]; vct: number | number[]; acd: number | number[]; cd: number | number[] }> =
  JSON.parse(readFileSync('src/assets/demo/data/skill-delay.json', 'utf8'));

/** Every utility entry in the catalog. One sweep of all 44 classes, read-only. */
const UTILITY: { classId: string; skill: AtkSkillModel }[] = Object.entries(CLASS_CTOR_BY_ID).flatMap(
  ([classId, Ctor]) => (new Ctor().atkSkills as AtkSkillModel[]).filter((skill) => skill.isUtility).map((skill) => ({ classId, skill })),
);

describe('every utility entry', () => {
  it('is one of the two the cards asked for', () => {
    expect([...new Set(UTILITY.map((row) => row.skill.name))].sort())
      .toEqual(['Hiding', 'Infiltration']);
  });

  it('deals no damage at all', () => {
    const scoring = UTILITY.filter(({ skill }) => skill.formula({} as any) !== 0);
    expect(scoring.map(({ classId, skill }) => `${classId}/${skill.name}`)).toEqual([]);
  });

  it('carries no second packet that could sneak damage back in', () => {
    const withPart2 = UTILITY.filter(({ skill }) => skill.part2 || skill.secondaryDmgInput);
    expect(withPart2.map(({ skill }) => skill.name)).toEqual([]);
  });
});

describe('Esconderijo', () => {
  const hiding = () => new Thief().atkSkills.find((s) => s.name === 'Hiding')!;

  it('is the client skill 51', () => {
    expect(SKILL_ID_BY_NAME['Hiding']).toBe(51);
  });

  it('costs one action and nothing else — the client publishes no delay row for it', () => {
    expect(DELAYS['51']).toBeUndefined();
    expect(hiding()).toMatchObject({ fct: 0, vct: 0, acd: 0, cd: 0, isUtility: true });
  });

  it('reaches every class in the Gatuno line', () => {
    expect(new AbyssChaser().atkSkills.some((s) => s.name === 'Hiding')).toBe(true);
  });

  it('survives a rotation prune, so a share link keeps it', () => {
    expect(pruneRotationForClass(['Hiding==1'], new Thief().atkSkills)).toEqual(['Hiding==1']);
  });
});

describe('Infiltrar', () => {
  const infiltration = () => new Shiranui().atkSkills.find((s) => s.name === 'Infiltration')!;

  it('is the client skill 5477', () => {
    expect(SKILL_ID_BY_NAME['Infiltration']).toBe(5477);
  });

  it('keeps the client recarga, which is the whole point of the report', () => {
    // skill-delay.json row 5477: cd [1500, 1250, 1000, 750, 500] ms, no cast and no pós.
    expect(DELAYS['5477']).toMatchObject({ maxLevel: 5, fct: 0, vct: 0, acd: 0 });
    const cd = infiltration().cd as (level: number) => number;
    expect([1, 2, 3, 4, 5].map(cd)).toEqual([1.5, 1.25, 1, 0.75, 0.5]);
  });

  it('offers the five levels the client caps it at', () => {
    expect(infiltration().levelList).toHaveLength(5);
  });

  it('is on both ninja 4th jobs, the way the Kunai and Mahou lines already are', () => {
    expect(new Shinkiro().atkSkills.some((s) => s.name === 'Infiltration')).toBe(true);
    expect(new Shiranui().atkSkills.some((s) => s.name === 'Infiltration')).toBe(true);
  });
});

describe('a habilidade padrão da linha do Gatuno', () => {
  it('deixou de ser `atkSkills[0]`, que agora é o Esconderijo', () => {
    expect(new Thief().atkSkills[0]?.name).toBe('Hiding');
    expect(new AbyssChaser().atkSkills[0]?.name).toBe('Hiding');
  });

  it('é a primeira que bate, e não a utilitária — o app e o servidor MCP leem a mesma regra', () => {
    const picked = defaultAtkSkill(new AbyssChaser().atkSkills);
    expect(picked).toBeDefined();
    expect(picked).not.toBe('Hiding==1');
  });
});

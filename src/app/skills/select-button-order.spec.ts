import { describe, expect, it } from 'vitest';
import { JobBuffs } from '../constants/job-buffs';
import type { ActiveSkillModel } from '../jobs/_character-base.abstract';
import { CLASS_CTOR_BY_ID } from '../jobs/_class-list';

/**
 * Todo botão de dois estados da aba de habilidades põe o "Sim" à esquerda e o "Não" à
 * direita.
 *
 * O quadro público pediu a padronização (card UqV6gdAehmmWqzvCrIw2): a posição mudava de
 * campo para campo, e o relato é que isso atrapalha ver de relance o que está ligado. A
 * ordem do `dropdown` é a ordem em que os botões aparecem, e o que fica guardado no modelo
 * é o `value` de quem está escolhido — então inverter a lista muda a tela, não a conta.
 *
 * As listas de nível (`inputType: 'dropdown'`) seguem a convenção oposta, com o desligado
 * na frente: ali o campo é uma lista que começa em "nenhum", não um par de botões.
 */
const CONTROLS = (() => {
  const byName = new Map<string, { owner: string; skill: ActiveSkillModel }>();
  const collect = (owner: string, list: readonly ActiveSkillModel[]) => {
    for (const skill of list ?? []) if (skill?.inputType === 'selectButton') byName.set(skill.name, { owner, skill });
  };
  collect('buffs de classe', JobBuffs);
  for (const ctor of Object.values(CLASS_CTOR_BY_ID)) {
    const job = new ctor();
    // Os buffs de prévia já entram aqui pelo `inheritSkills`, e é este getter que a tela lê.
    collect(job.className, job.activeSkills);
  }
  return [...byName.values()];
})();

describe('ordem dos botões Sim/Não', () => {
  it('põe o estado ligado na frente em todo botão de dois estados', () => {
    const outOfOrder = CONTROLS
      .filter(({ skill }) => !skill.dropdown[0]?.isUse)
      .map(({ owner, skill }) => `${owner} · ${skill.label} (${skill.dropdown.map((o) => o.label).join(' | ')})`);

    expect(outOfOrder).toEqual([]);
  });

  it('alcança o catálogo inteiro, e todo botão é um par Sim/Não', () => {
    // O levantamento que originou a correção achou 132 botões; o número só cresce.
    expect(CONTROLS.length).toBeGreaterThanOrEqual(132);
    expect(new Set(CONTROLS.map(({ skill }) => skill.dropdown.map((o) => o.label).join('|')))).toEqual(new Set(['Sim|Não']));
  });
});

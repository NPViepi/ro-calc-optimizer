import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AbyssChaser } from 'src/app/jobs';
import { createMainModel } from 'src/app/utils';
import { Calculator } from '../calculator';
import { CalculatorController } from '../calculator-controller';

/**
 * Esconderijo não soma dano — cards bLnU1DLpGeA2vxQ794I4 e FPpmOoKCq7KzPxV4NUZ3.
 *
 * A fórmula devolve 0, mas a cadeia de dano devolvia 1 assim mesmo (o piso da DEF suave),
 * e a linha da rotação lia "1 · 0,0%" para uma habilidade cujo pedido inteiro é não bater.
 * `isUtility` zera o que a cadeia deixou; o que entra no ciclo é só o tempo.
 */
describe('uma habilidade de utilidade na rotação', () => {
  // O `INERT_MONSTER` de `make-calculator.ts` não serve aqui: ele zera DEF e DEFM de
  // propósito, e é justamente o piso da DEF suave que este spec precisa exercitar. O
  // Dummy Amorfo é o alvo que o jogador usa no app, com DEF 50.
  const DUMMY_ID = 21067;
  const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
  const dummy = {
    id: DUMMY_ID, name: monsters[DUMMY_ID].name, spawn: 'x',
    stats: { ...monsters[DUMMY_ID].stats }, data: monsters[DUMMY_ID].data,
  } as any;

  const solve = (skill: string) => {
    const cls = new AbyssChaser();
    const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
      .setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] })
      .getSkillBonusAndName();

    const calc = new Calculator()
      .setMasterItems({} as any)
      .setHpSpTable([{ jobs: { [cls.className]: true }, baseHp: Array(251).fill(40000), baseSp: Array(251).fill(2500) }] as any)
      .setClass(cls)
      .setMonster(dummy);

    const model: any = createMainModel();
    Object.assign(model, { class: 4260, level: 200, jobLevel: 50, selectedAtkSkill: skill });
    calc.loadItemFromModel(model);
    new CalculatorController().runChain(calc, {
      monster: dummy, equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
      consumeData: [], aspdPotion: 0, extraOptionScripts: [], activeSkillNames, learnedSkillMap,
      selectedAtkSkill: skill, selectedChances: [], usedHpL: false,
    } as any);

    return calc.getTotalSummary().dmg as any;
  };

  it('deals exactly zero, not the 1 the soft DEF floor leaves', () => {
    const hiding = solve('Hiding==1');
    expect(hiding.skillMinDamage).toBe(0);
    expect(hiding.skillMaxDamage).toBe(0);
    expect(hiding.skillDps).toBe(0);
    expect(hiding.effectedSkillDamageMax).toBe(0);
  });

  it('still reads a damage figure for the attack beside it, so the zero is the skill, not the setup', () => {
    expect(solve('Fatal Manace==10').skillMaxDamage).toBeGreaterThan(0);
  });
});

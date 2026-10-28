import { describe, expect, it } from 'vitest';
import { CLASS_CTOR_BY_ID } from '../jobs/_class-list';
import { AtkSkillModel } from '../jobs/_character-base.abstract';
import { RoyalGuard } from '../jobs/RoyalGuard';
import { aspdFloorOf, RotationScheduleStep, simulateRotation } from './rotation-schedule';

/**
 * O piso de VelAtq e a exceção por habilidade — card tQu6cQrmdmxtWDyUKgRI, "Velocidade de
 * ataque está influenciando o spam da aegis inferi", reportado por Hatakashi.
 *
 * O agendador segura cada ação por `max(pós-conjuração, 1/VelAtq)` medido de começo a
 * começo, e é isso que prende quase toda habilidade. Aegis Inferi não: ela traz uma
 * pós-conjuração de 1 segundo e o tempo de movimento de ataque só entra quando a
 * habilidade não traz a sua. Com redução de recarga suficiente o ciclo dela desce abaixo
 * de 1/VelAtq e o piso aparecia onde não devia.
 *
 * `ignoreAspdFloor` é a exceção, por habilidade e desligada por padrão. A lista fechada
 * aqui embaixo é a garantia de que ninguém marca uma segunda habilidade sem dizer por quê.
 */

/** The only skills allowed to lift the floor, and the report that earned each one. */
const EXEMPT = [
  'Earth Drive', // Aegis Inferi (2323) — card tQu6cQrmdmxtWDyUKgRI
];

const step = (over: Partial<RotationScheduleStep>): RotationScheduleStep =>
  ({ key: 'k', cast: 0, acd: 0, cd: 0, damage: 100, ...over });

describe('the VelAtq floor', () => {
  it('paces a rotation whose own timings are shorter than one attack period', () => {
    // Two 0,2 s skills under a 0,5 s attack period: the floor, not the skills, sets the cycle.
    const cycle = simulateRotation({
      steps: [step({ key: 'a', cast: 0.2 }), step({ key: 'b', cast: 0.2 })],
      aspdPeriod: 0.5,
    });

    expect(cycle.cycleDuration).toBeCloseTo(1, 6);
    expect(cycle.isAspdLimited).toBe(true);
    expect(cycle.unconstrainedDuration).toBeCloseTo(1, 6);
  });

  it('lets a step marked ignoreAspdFloor start the next one as soon as its pós ends', () => {
    const cycle = simulateRotation({
      steps: [step({ key: 'a', cast: 0.2, ignoreAspdFloor: true }), step({ key: 'b', cast: 0.2, ignoreAspdFloor: true })],
      aspdPeriod: 0.5,
    });

    expect(cycle.cycleDuration).toBeCloseTo(0.4, 6);
    expect(cycle.isAspdLimited).toBe(false);
    expect(cycle.unconstrainedDuration).toBeCloseTo(0.4, 6);
  });

  it('keeps the exception per step — one exempt skill does not free the others', () => {
    const cycle = simulateRotation({
      steps: [step({ key: 'a', cast: 0.2, ignoreAspdFloor: true }), step({ key: 'b', cast: 0.2 })],
      aspdPeriod: 0.5,
    });

    // 'a' releases at 0,2 s; 'b' then holds the cycle open for its own 0,5 s floor.
    expect(cycle.cycleDuration).toBeCloseTo(0.7, 6);
    expect(cycle.isAspdLimited).toBe(true);
  });

  it('still honours the pós-conjuração of an exempt step', () => {
    const cycle = simulateRotation({
      steps: [step({ key: 'a', cast: 0.2, acd: 1, ignoreAspdFloor: true })],
      aspdPeriod: 0.5,
    });

    expect(cycle.cycleDuration).toBeCloseTo(1.2, 6);
  });
});

describe('which skills lift the floor', () => {
  const flagged = () => {
    const names = new Set<string>();
    for (const Ctor of Object.values(CLASS_CTOR_BY_ID)) {
      for (const skill of new Ctor().atkSkills as AtkSkillModel[]) {
        if (skill.ignoreAspdFloor) names.add(skill.name);
      }
    }

    return [...names].sort();
  };

  it('is the closed list, and nothing else', () => {
    expect(flagged()).toEqual([...EXEMPT].sort());
  });

  it('marks Aegis Inferi, which keeps its own 1 s pós-conjuração', () => {
    const earthDrive = new RoyalGuard().atkSkills.find((s) => s.name === 'Earth Drive')!;
    expect(earthDrive.ignoreAspdFloor).toBe(true);
    expect(earthDrive.acd).toBe(1);
  });
});

describe('o acessor do piso', () => {
  it('é o único lugar onde a exceção é lida — o agendador e a semente gulosa chamam este', () => {
    expect(aspdFloorOf({ ignoreAspdFloor: true }, 0.5)).toBe(0);
    expect(aspdFloorOf({ ignoreAspdFloor: false }, 0.5)).toBe(0.5);
    expect(aspdFloorOf({}, 0.5)).toBe(0.5);
  });
});

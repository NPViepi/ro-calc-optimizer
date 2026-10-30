import { describe, expect, it } from 'vitest';
import {
  BASIC_ATTACK_VALUE,
  MAX_ROTATION_LENGTH,
  compactRotationForShare,
  defaultAtkSkill,
  firstRealSkill,
  isBasicAttack,
  normalizeRotation,
  pruneRotationForClass,
  RotationSkillOption,
} from './rotation';

describe('isBasicAttack / firstRealSkill', () => {
  it('tells ataque básico apart from a catalog value', () => {
    expect(isBasicAttack(BASIC_ATTACK_VALUE)).toBe(true);
    expect(isBasicAttack('Solar Kick==7')).toBe(false);
  });

  it('mirrors the first real skill, skipping leading basic attacks', () => {
    expect(firstRealSkill([BASIC_ATTACK_VALUE, 'Solar Kick==7', 'Sunset Blast==5'])).toBe('Solar Kick==7');
  });

  it('has nothing to mirror for an empty or all-basic rotation', () => {
    expect(firstRealSkill([])).toBeUndefined();
    expect(firstRealSkill([BASIC_ATTACK_VALUE, BASIC_ATTACK_VALUE])).toBeUndefined();
  });
});

describe('normalizeRotation', () => {
  it('migrates a build saved before rotations existed to a rotation of one', () => {
    // No `rotation` key at all -> createMainModel's array default -> [] arrives here.
    expect(normalizeRotation([], 'Solar Kick==7')).toEqual(['Solar Kick==7']);
    expect(normalizeRotation(undefined, 'Solar Kick==7')).toEqual(['Solar Kick==7']);
  });

  it('keeps a real rotation, duplicates and all', () => {
    const rotation = ['Lunar Eclipse==7', 'Solar Kick==7', 'Sunset Blast==5', 'Solar Kick==7'];
    expect(normalizeRotation(rotation, 'Solar Kick==7')).toEqual(rotation);
  });

  it('drops non-strings and empty strings a hand-edited token could carry', () => {
    expect(normalizeRotation(['Solar Kick==7', null, 42, '', { a: 1 }, 'Sunset Blast==5'], undefined)).toEqual([
      'Solar Kick==7',
      'Sunset Blast==5',
    ]);
  });

  it('falls back when the value is not an array at all', () => {
    expect(normalizeRotation('Solar Kick==7', 'Sunset Blast==5')).toEqual(['Sunset Blast==5']);
  });

  it('caps the length', () => {
    const long = Array.from({ length: MAX_ROTATION_LENGTH + 15 }, (_, i) => `Skill==${i}`);
    expect(normalizeRotation(long, undefined)).toHaveLength(MAX_ROTATION_LENGTH);
  });

  it('returns empty when there is nothing to fall back to', () => {
    expect(normalizeRotation([], undefined)).toEqual([]);
  });
});

describe('pruneRotationForClass', () => {
  const atkSkills: RotationSkillOption[] = [
    { value: 'Solar Kick==7' },
    { value: 'Twinkling Galaxy==5', levelList: [{ value: 'Twinkling Galaxy==1' }, { value: 'Twinkling Galaxy==5' }] },
    { value: 'Sunset Blast==5', values: ['Sunset Blast==4'] },
  ];

  it('keeps values, levelList entries and values[] aliases', () => {
    const rotation = ['Solar Kick==7', 'Twinkling Galaxy==1', 'Sunset Blast==4'];
    expect(pruneRotationForClass(rotation, atkSkills)).toEqual(rotation);
  });

  it('drops a skill the class does not have (class switch, foreign share link)', () => {
    expect(pruneRotationForClass(['Solar Kick==7', 'Cross Impact==5'], atkSkills)).toEqual(['Solar Kick==7']);
  });

  it('always keeps ataque básico, which belongs to no class', () => {
    expect(pruneRotationForClass([BASIC_ATTACK_VALUE, 'Cross Impact==5'], atkSkills)).toEqual([BASIC_ATTACK_VALUE]);
  });

  it('can prune everything away, leaving the caller to reseed', () => {
    expect(pruneRotationForClass(['Cross Impact==5'], atkSkills)).toEqual([]);
  });
});

describe('compactRotationForShare', () => {
  it('drops a rotation that is exactly the mirrored skill, keeping old tokens byte-identical', () => {
    const preset = { selectedAtkSkill: 'Solar Kick==7', rotation: ['Solar Kick==7'], level: 200 };
    expect(compactRotationForShare(preset)).toEqual({ selectedAtkSkill: 'Solar Kick==7', level: 200 });
  });

  it('drops an empty rotation', () => {
    expect(compactRotationForShare({ selectedAtkSkill: 'Solar Kick==7', rotation: [] })).toEqual({
      selectedAtkSkill: 'Solar Kick==7',
    });
  });

  it('keeps a real rotation', () => {
    const preset = { selectedAtkSkill: 'Solar Kick==7', rotation: ['Solar Kick==7', BASIC_ATTACK_VALUE] };
    expect(compactRotationForShare(preset)).toEqual(preset);
  });

  it('keeps a single-entry rotation that is not the mirrored skill', () => {
    const preset = { selectedAtkSkill: 'Solar Kick==7', rotation: [BASIC_ATTACK_VALUE] };
    expect(compactRotationForShare(preset)).toEqual(preset);
  });

  it('leaves a preset without a rotation alone', () => {
    const preset = { selectedAtkSkill: 'Solar Kick==7' };
    expect(compactRotationForShare(preset)).toBe(preset);
  });

  it('round-trips: a compacted single-skill preset rebuilds the same rotation', () => {
    const preset = { selectedAtkSkill: 'Solar Kick==7', rotation: ['Solar Kick==7'] };
    const shared = compactRotationForShare(preset) as Record<string, any>;

    expect(normalizeRotation(shared['rotation'], shared['selectedAtkSkill'])).toEqual(preset.rotation);
  });
});

/**
 * A habilidade padrão — cards bLnU1DLpGeA2vxQ794I4 e FPpmOoKCq7KzPxV4NUZ3.
 *
 * Esconderijo entrou na cabeça do catálogo do Gatuno, e `atkSkills[0]` deixou de ser uma
 * habilidade que bate. Quem resolve "o jogador não escolheu nada" — a sessão do app e o
 * `resolveAtkSkill` do servidor MCP — passa por aqui para não cair numa utilitária.
 */
describe('defaultAtkSkill', () => {
  it('pula a utilitária no topo do catálogo', () => {
    expect(defaultAtkSkill([{ value: 'Hiding==1', isUtility: true }, { value: 'Fatal Manace==10' }]))
      .toBe('Fatal Manace==10');
  });

  it('devolve a primeira quando a classe só tem utilitárias, em vez de nada', () => {
    expect(defaultAtkSkill([{ value: 'Hiding==1', isUtility: true }])).toBe('Hiding==1');
  });

  it('aguenta uma lista vazia', () => {
    expect(defaultAtkSkill([])).toBeUndefined();
  });
});

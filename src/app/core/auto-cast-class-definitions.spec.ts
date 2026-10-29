import { describe, expect, it } from 'vitest';
import {
  AbyssChaser,
  ElementalMaster,
  Ranger,
  RuneKnight,
  Scholar,
  ShadowChaser,
  Sniper,
  Sorcerer,
  Windhawk,
} from '../jobs';

const keysOf = (character: { autoCastDefinitions: ReadonlyArray<{ key: string }> }) =>
  character.autoCastDefinitions.map(({ key }) => key);

describe('class-owned auto-cast definitions', () => {
  it('inherits Scholar definitions through Sorcerer and Elemental Master', () => {
    expect(keysOf(new Scholar())).toEqual(['auto-spell']);
    expect(keysOf(new Sorcerer())).toEqual(['auto-spell']);
    expect(keysOf(new ElementalMaster())).toEqual(['auto-spell', 'preview-elemental-integration']);
  });

  it('inherits Shadow Chaser definitions through Abyss Chaser', () => {
    expect(keysOf(new ShadowChaser())).toEqual(['shadow-spell']);
    expect(keysOf(new AbyssChaser())).toEqual(['shadow-spell', 'from-the-abyss', 'abyss-square']);
  });

  it('offers Gemini Lumen through Mimetismo as separate physical and magic melee procs', () => {
    const rule = new ShadowChaser().autoCastDefinitions[0];
    const result = rule.resolve({
      skillState: {
        activeLevel: () => 0,
        learnedLevel: (name: string) => name === 'Reproduce' ? 5 : 0,
      },
      optionsFor: () => [],
      model: { autoCastSelections: { reproduce: 2054 } },
    } as any);
    expect(result.slots?.find((slot) => slot.key === 'reproduce')?.options).toContainEqual(
      expect.objectContaining({ value: 2054 }),
    );
    expect(result.sources).toHaveLength(2);
    expect(result.blocked).toContainEqual(expect.objectContaining({ key: 'config-shadow-spell' }));
    expect(result.sources?.map((source) => source.skillData?.formula({ skillLevel: 5 } as any)))
      .toEqual([225, 600]);
    for (const source of result.sources ?? []) {
      expect(source).toMatchObject({ chance: 20, trigger: 'melee-physical-hit', skillLevel: 5 });
    }
  });

  it('requires Invocação and a learned Fenda before autocasting Fenda do Abismo', () => {
    const rule = new AbyssChaser().autoCastDefinitions.find(({ key }) => key === 'abyss-square')!;
    const context = (active: number, learned: number) => ({
      skillState: {
        activeLevel: (name: string) => name === 'From the Abyss' ? active : 0,
        learnedLevel: (name: string) => name === 'Abyss Square' ? learned : 0,
      },
      skillById: (id: number) => id === 5321 ? { name: 'Abyss Square' } : undefined,
    } as any);
    expect(rule.resolve(context(0, 5)).sources).toBeUndefined();
    expect(rule.resolve(context(5, 0)).sources).toBeUndefined();
    expect(rule.resolve(context(5, 3)).sources).toContainEqual(expect.objectContaining({
      skillId: 5321, skillLevel: 3, chance: 3, trigger: 'physical-attack', // 1% por nível de Fenda do Abismo.
    }));
  });

  it('accumulates Sniper and Ranger definitions on Windhawk', () => {
    expect(keysOf(new Sniper())).toEqual(['blitz-beat']);
    expect(keysOf(new Ranger())).toEqual(['blitz-beat', 'wug-strike', 'fear-breeze']);
    expect(keysOf(new Windhawk())).toEqual(['blitz-beat', 'wug-strike', 'fear-breeze', 'hawk-rush']);
  });

  it('does not leak definitions into unrelated class lines', () => {
    expect(keysOf(new RuneKnight())).toEqual(['lux-anima-storm-blast']);
  });

  it('locks Luxanima until its skill toggle is active', () => {
    const definition = new RuneKnight().autoCastDefinitions[0];
    const context = (active: boolean) => ({
      skillState: { isActive: (name: string) => name === 'Lux Anima Runestone' && active },
      skillById: (id: number) => id === 2017 ? { name: 'Storm Blast' } : undefined,
    } as any);
    expect(definition.resolve(context(false)).blocked).toContainEqual(expect.objectContaining({ icon: 2017 }));
    expect(definition.resolve(context(true)).sources).toContainEqual(expect.objectContaining({
      skillId: 2017, skillLevel: 1, chance: 15, trigger: 'physical-attack',
    }));
  });
});

/**
 * The attack rotation: the ordered list of skills the "Resumo de Batalha" panel
 * cycles through, replacing the single `selectedAtkSkill` reading.
 *
 * An entry is the same `"<SkillName>==<level>"` string the engine already speaks
 * (`Calculator.setOffensiveSkill`, `AtkSkillModel.value`), plus {@link BASIC_ATTACK_VALUE}
 * for ataque básico. Reusing that string rather than a `{skillId, level}` pair is
 * deliberate: several catalog entries can share a name and level and be told apart only
 * by `value` — see the `getElement(skillValue)` skills (Doram, RoyalGuard, ElementalMaster)
 * and HyperNovice's `labelSuffix` variants — so a decomposed id would be lossy.
 *
 * `MainModel.selectedAtkSkill` stays as a write-through mirror of the first real skill
 * here, which is what keeps the "Resumo de Batalha (antigo)" tab, `PresetModel`, the MCP
 * server and every engine spec working untouched.
 *
 * Duplicates are allowed and meaningful: the same skill can appear more than once, and
 * its recarga is what decides whether the second use fits.
 */

/** Sentinel entry for ataque básico. Not a skill the catalog knows, so it can never
 *  collide with an `AtkSkillModel.value` (those always carry a `==<level>` suffix). */
export const BASIC_ATTACK_VALUE = '__basic';

/**
 * Hard cap on rotation length. Not a UI policy — the rotation arrives from a share
 * token and from localStorage, both attacker-controlled, and it drives an O(n · cycles)
 * scheduler plus a permutation search. Far above any real combo.
 */
export const MAX_ROTATION_LENGTH = 20;

export const isBasicAttack = (value: string): boolean => value === BASIC_ATTACK_VALUE;

/**
 * A shape with just the two fields the default-skill rule reads, declared structurally
 * for the same reason {@link RotationSkillOption} is.
 */
export interface OffensiveSkillOption {
  value?: string;
  isUtility?: boolean;
}

/** Utilitárias (Esconderijo, Infiltrar) ocupam uma ação do ciclo e não batem em nada. */
export const isOffensiveSkill = (skill: OffensiveSkillOption): boolean => !skill?.isUtility;

/**
 * A habilidade que vale quando o jogador não escolheu nenhuma: a primeira que causa dano.
 * O seletor antigo pergunta quanto a habilidade bate, então uma utilitária no topo do
 * catálogo — Esconderijo é a primeira de toda a linha do Gatuno — não serve de padrão.
 * O `??` é para a classe que só tem utilitárias: melhor alguma coisa do que `undefined`.
 */
export const defaultAtkSkill = (atkSkills: OffensiveSkillOption[]): string | undefined =>
  ((atkSkills ?? []).find(isOffensiveSkill) ?? (atkSkills ?? [])[0])?.value;

/**
 * The skill `selectedAtkSkill` mirrors: the first entry that is an actual skill.
 * An all-basic rotation has none, and callers keep the previous value — the engine
 * always needs some valid skill string to solve against.
 */
export const firstRealSkill = (rotation: string[]): string | undefined =>
  (rotation ?? []).find((value) => typeof value === 'string' && value && !isBasicAttack(value));

/**
 * The shape `pruneRotationForClass` needs from a class's `atkSkills`. Declared
 * structurally rather than importing `AtkSkillModel` so this module stays trivially
 * testable with plain literals.
 */
export interface RotationSkillOption {
  value?: string;
  values?: string[];
  levelList?: { value?: string }[];
}

/**
 * Sanitise whatever a share token, an autosave or a saved simulation carried, and
 * supply the migration for builds saved before rotations existed: those have no
 * `rotation` key at all, so they land here as `[]` and come back out as a rotation of
 * one holding their `selectedAtkSkill`.
 */
export function normalizeRotation(raw: unknown, fallbackSkill?: string): string[] {
  const entries = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
  const capped = entries.slice(0, MAX_ROTATION_LENGTH);
  if (capped.length) return capped;

  return fallbackSkill ? [fallbackSkill] : [];
}

/**
 * Drop entries the current class cannot cast — a class switch, or a share link built on
 * another class. Matches the same three ways `setDefaultSkill` resolves a stored value:
 * the skill's own `value`, its `values[]` aliases, and each `levelList[].value`.
 * Ataque básico is classless and always survives.
 */
export function pruneRotationForClass(rotation: string[], atkSkills: RotationSkillOption[]): string[] {
  const known = new Set<string>();
  for (const skill of atkSkills ?? []) {
    if (skill?.value) known.add(skill.value);
    for (const alias of skill?.values ?? []) if (alias) known.add(alias);
    for (const level of skill?.levelList ?? []) if (level?.value) known.add(level.value);
  }

  return (rotation ?? []).filter((value) => isBasicAttack(value) || known.has(value));
}

/**
 * Drop a rotation that carries no information before encoding a share token: one that is
 * exactly `[selectedAtkSkill]` is what `normalizeRotation` rebuilds on decode anyway.
 * Keeps every single-skill build's token byte-identical to what it was before rotations
 * existed, so old and new clients produce the same link for the same build.
 */
export function compactRotationForShare<T extends Record<string, any>>(preset: T): T {
  const rotation = preset?.['rotation'];
  if (!Array.isArray(rotation)) return preset;

  const isTrivial = rotation.length === 0 || (rotation.length === 1 && rotation[0] === preset['selectedAtkSkill']);
  if (!isTrivial) return preset;

  const { rotation: _dropped, ...rest } = preset as Record<string, any>;
  return rest as T;
}

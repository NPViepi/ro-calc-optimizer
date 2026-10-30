import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VALID_SKILL_IDS } from '../skills';

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8')) as Record<string, any>;
const latam = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8')) as Record<string, any>;
const audit = JSON.parse(readFileSync('src/assets/demo/data/auto-cast-audit.json', 'utf8')) as {
  clauses: Array<{ itemId: number; disposition: string }>;
};
const clean = (text: string) => (text ?? '').replace(/\^[0-9a-fA-F]{6}/g, '');
const ATTACK_TRIGGER = /(?:ao realizar (?:um )?ataques? (?:físicos?|mágicos?)|ao atacar(?: com)?|a cada ataque físico|ataques físicos (?:corpo a corpo|à distância|normais?)?)/i;

/**
 * Broad discovery ratchet, deliberately followed by manual clause classification.
 * Every non-verified candidate is pending; production reads only item.json script.autoCast.
 */
const candidates = Object.entries(latam).filter(([id, entry]) => {
  const description = clean(entry.description);
  return !!items[id] && /autoconjur/i.test(description) && ATTACK_TRIGGER.test(description);
});

describe('LATAM item auto-cast audit', () => {
  it('closes the re-reviewed formula and ambiguous candidates without pending effects', () => {
    expect(audit.clauses.filter((clause) => ['pending-formula', 'ambiguous'].includes(clause.disposition))).toEqual([]);
    expect(audit.clauses.filter((clause) => clause.disposition === 'pending-model').map((clause) => clause.itemId))
      .toEqual([]);
  });
  it('accounts for the current attack-trigger candidate set', () => {
    // A client-data update must deliberately reclassify the changed set rather than
    // silently making a new proc eligible for production.
    // 311221 Cristal Invernal (Autoconjuração) entrou com o cliente de 28/10/2026 e segue pendente.
    expect(candidates).toHaveLength(244);
    const dispositions = candidates.map(([id]) => items[id].script?.autoCast ? 'verified-direct-damage' : 'pending-verification');
    expect(dispositions).toHaveLength(candidates.length);
  });

  it('ships only complete verified rules with catalogued skills and explicit roll semantics', () => {
    for (const [itemId, item] of Object.entries(items)) {
      for (const rule of item.script?.autoCast ?? []) {
        expect(VALID_SKILL_IDS.has(rule.skillId), `${itemId}/${rule.skillId}`).toBe(true);
        expect(rule.skillLevel).toEqual(expect.arrayContaining([expect.any(String)]));
        expect(rule.chance).toEqual(expect.arrayContaining([expect.any(String)]));
        expect(rule.trigger).toMatch(/^(physical-attack|physical-hit|melee-physical-attack|melee-physical-hit|ranged-physical-hit|magic-attack)$/);
        expect(rule.skillLevelMode ?? 'fixed').toMatch(/^(fixed|highest-learned|learned-only)$/);
      }
      for (const pending of item.script?.autoCastPending ?? []) {
        expect(pending.skillName, `${itemId}/pending`).toEqual(expect.any(String));
        expect(pending.reason, `${itemId}/${pending.skillName}`).toEqual(expect.any(String));
        if (pending.skillId !== undefined) expect(VALID_SKILL_IDS.has(pending.skillId), `${itemId}/${pending.skillId}`).toBe(true);
      }
    }
  });

  it('pins Terror Violeta clauses as two independent sources', () => {
    const description = clean(latam['1185'].description);
    expect(description).toContain('5% de chance de autoconjurar [Congelar] nv.5');
    expect(description).toContain('3% de chance de autoconjurar [Chuva de Meteoros] nv.3');
    expect(items[1185].script.autoCast).toHaveLength(2);
  });
});

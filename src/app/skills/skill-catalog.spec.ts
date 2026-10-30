import { describe, expect, it } from 'vitest';
import { SKILL_DESC_BY_ID, SKILL_ID_BY_NAME, SKILL_META, VALID_SKILL_IDS, resolveSkillMeta } from './index';

describe('skill catalog', () => {
  it('carries id, pt-BR label and description per skill', () => {
    const arrowStorm = SKILL_META['Arrow Storm'];
    expect(arrowStorm.id).toBe(2233);
    expect(arrowStorm.label).toBe('Tempestade de Flechas');
    expect(arrowStorm.description).toContain('Tempestade de Flechas');
  });

  it('maps internal name -> id (unambiguous direction)', () => {
    expect(SKILL_ID_BY_NAME['Holy Light']).toBe(156);
    expect(SKILL_ID_BY_NAME['Storm Gust']).toBe(89);
  });

  it('keeps Dragonic Breath (6001) apart from the two breaths', () => {
    // DK_DRAGONIC_BREATH is a real kRO skill and NOT a mistranslation of Aura
    // Draconiana (5210) nor of the Rune Knight's Sopro do Dragão (2008). It was removed
    // on 17/08/2026 because LATAM did not have it and its pt-BR label had been invented,
    // came back on 14/09/2026 as a preview under its English name, and is a LATAM skill
    // since the 28/10/2026 client, which ships the label and description asserted here.
    // See jobs/DragonKnight.ts.
    expect(SKILL_ID_BY_NAME['Dragon Breath']).toBe(2008);
    expect(SKILL_ID_BY_NAME['Dragon Breath - WATER']).toBe(5004);
    expect(SKILL_ID_BY_NAME['Dragonic Aura']).toBe(5210);
    expect(SKILL_ID_BY_NAME['Dragonic Breath']).toBe(6001);
    expect(VALID_SKILL_IDS.has(6001)).toBe(true);
    expect(SKILL_META['Dragonic Breath'].label).toBe('Baforada Draconiana');
    expect(SKILL_META['Dragonic Breath'].description).toContain('[Nv 10]');
  });

  it('maps id -> description for the hover tooltip', () => {
    // the client description opens with "<pt-BR> (<English>)"
    expect(SKILL_DESC_BY_ID[2233]).toContain('(Arrow Storm)');
  });

  it('exposes the set of valid skill ids for item.json validation', () => {
    expect(VALID_SKILL_IDS.has(2233)).toBe(true);
    expect(VALID_SKILL_IDS.has(156)).toBe(true);
    expect(VALID_SKILL_IDS.has(999999)).toBe(false);
  });

  it('keeps id-less internal markers as valid skill names (English fallback)', () => {
    const internal = resolveSkillMeta('_ElementalMaster_spirit');
    expect(internal).toBeDefined();
    expect(internal!.id).toBeUndefined();
  });
});

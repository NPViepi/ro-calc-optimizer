import { describe, expect, it } from 'vitest';
import { NightWatch } from 'src/app/jobs/NightWatch';
import { appShapedData } from './__tests__/app-data';
import { buildCatalog } from './candidates';
import { collectProfilePartners, damageProfileOf, isOffProfileItem } from './damage-profile';

const { items } = appShapedData();
const character = new NightWatch();
const byName = (name: string) => Object.values(items).find((item) => item.name === name && item.presentInLatam)!;

describe('filtro pelo tipo de dano da skill', () => {
  const profile = damageProfileOf(character, { selectedAtkSkill: 'Magazine for One==5', level: 240 } as any)!;
  const partners = collectProfilePartners(items, profile);
  const off = (name: string) => isOffProfileItem(byName(name), profile, partners);

  it('Artilharia Pesada: física e à distância', () => {
    expect(profile).toEqual({ magical: false, melee: false, skillId: 5408 });
  });

  it('tira itens só de dano mágico, mesmo com outros atributos', () => {
    expect(off('Malha Sombria Conjurante')).toBe(true); // ATQM + HP + conjuração
    expect(off('Diadema')).toBe(true); // só INT
    expect(off('Pedra de ATQM (Meio)')).toBe(true);
  });

  it('tira itens só de dano corpo a corpo numa skill à distância', () => {
    expect(off('Pedra de Corpo (Meio)')).toBe(true);
  });

  it('mantém armas com ATQ base e peças de conjunto com bônus físico', () => {
    expect(off('Revólver Invernal')).toBe(false); // ATQM no script, mas ATQ 230
    // Conjunto com o Manto Temporal INT (penetração física): só a versão [1] é pedida nele.
    expect(isOffProfileItem(items[22114], profile, partners)).toBe(false); // Botas Modificadas INT [1]
    expect(isOffProfileItem(items[22108], profile, partners)).toBe(true); // Botas Modificadas INT [0]
    expect(off('Manto Angelical')).toBe(false); // conjunto com a Batina Angelical FOR
  });

  it('não mexe em itens sem bônus de dano de nenhum tipo', () => {
    expect(off('Laço')).toBe(false); // só MDEF
  });

  it('o catálogo usa o perfil quando informado', () => {
    const ids = new Set(Object.values(buildCatalog(items, character, { maxRequiredLevel: 240, damageProfile: profile })).flat());
    expect(ids.has(byName('Malha Sombria Conjurante').id)).toBe(false);
    expect(ids.has(byName('Revólver Invernal').id)).toBe(true);
  });
});

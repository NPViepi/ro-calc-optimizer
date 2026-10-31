import { describe, expect, it } from 'vitest';
import { NightWatch } from 'src/app/jobs/NightWatch';
import { appShapedData } from './__tests__/app-data';
import { buildCatalog } from './candidates';
import { collectSetPartners, dropFewerSlotVariants, isInertItem, isIrrelevantByName } from './irrelevant-items';

const { items } = appShapedData();
const partners = collectSetPartners(items);
const allIds = (catalog: ReturnType<typeof buildCatalog>) => new Set(Object.values(catalog).flat());

describe('itens fora da busca', () => {
  it('tira aluguel, Apoio, Paraíso, Éden, novato e TE pelo nome', () => {
    for (const id of [
      1173, // [Aluguel] Muramasa
      24584, // Malha Sombria de Apoio (Booster Shadow Armor)
      24694, // Malha Sombria do Paraíso
      1192, // Espada do Éden I
      1243, // Adaga do Aprendiz
      1381, // Machado de Batalha de Iniciante
    ]) expect(isIrrelevantByName(items[id]), items[id].name).toBe(true);
    // "Excedente" contém "eden", mas não é do Éden.
    expect(isIrrelevantByName(items[13201])).toBe(false); // Projétil de Prata Excedente
    expect(isIrrelevantByName(items[24233])).toBe(false); // Manopla Sombria Excedente
  });

  it('tira itens sem efeito, mas não armas, munições nem peças de conjunto', () => {
    expect(isInertItem(items[2609], partners)).toBe(true); // Anel de Caveira
    expect(isInertItem(items[13158], partners)).toBe(false); // Retalhadora (arma: ATK base)
    expect(isInertItem(items[2239], partners)).toBe(false); // Monóculo (peça de conjunto)
  });

  it('tira a versão com menos slots só quando a maior está na mesma lista', () => {
    expect(dropFewerSlotVariants([13158, 13159], items, partners)).toEqual([13159]); // Retalhadora [0] e [1]
    expect(dropFewerSlotVariants([13158], items, partners)).toEqual([13158]);
    // Mesmo nome pt-BR, inglês diferente ("Modified Str Boot" / "Modified Str Boots [1]").
    expect(dropFewerSlotVariants([22107, 22113], items, partners)).toEqual([22113]);
  });

  it('o catálogo respeita as três regras', () => {
    const ids = allIds(buildCatalog(items, new NightWatch(), { maxRequiredLevel: 240 }));
    for (const id of [1173, 24694, 2609, 13158]) expect(ids.has(id), items[id].name).toBe(false);
    expect(ids.has(13159)).toBe(true); // Retalhadora [1]
    // No inventário, a [0] fica se a [1] não estiver lá.
    const owned = allIds(buildCatalog(items, new NightWatch(), { allowedItemIds: new Set([13158]) }));
    expect(owned.has(13158)).toBe(true);
  });
});

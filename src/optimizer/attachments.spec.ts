import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { attachmentsFor, buildCardCatalog, buildEnchantMap } from './attachments';
import { buildCatalog, OptimizableSlot } from './candidates';
import { BuildEvaluator } from './evaluate';
import { optimizeBuild } from './items';
import { findSetMoves } from './sets';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';
import { ENGINE_TIMEOUT } from './__tests__/timeouts';

const context = windhawkContext({ items: latamItemDb });
const { items, character } = context;
const enchantMap = buildEnchantMap(items);

const SHARPBOLT_BOW = 700016; // 0 encaixes
const ROYAL_BOW = 700045; // 2 encaixes
const THANOS_BOW = 700029;
const THANOS_HELMET = 400142;
const TEMPORAL_DEX_BOOT = 22004;
const HAWKEYE = 4879;
const ODIUM_MASK = 436002; // Meio + Baixo

describe('cartas e encantamentos', () => {
  const cards = buildCardCatalog(items);

  it('separa cartas por posição, como as listas da tela', () => {
    const weaponCards = new Set(cards.weapon);
    const armorCards = new Set(cards.armor);
    expect(weaponCards.size).toBeGreaterThan(0);
    expect(armorCards.size).toBeGreaterThan(0);
    // Uma carta de arma típica não é oferecida na armadura (e vice-versa), salvo as "All".
    const onlyWeapon = [...weaponCards].filter((id) => !armorCards.has(id));
    expect(onlyWeapon.length).toBeGreaterThan(0);
    for (const id of cards.weapon ?? []) expect(items[id].itemTypeId).toBe(6);
  }, ENGINE_TIMEOUT);

  it('o número de cartas segue os encaixes do item', () => {
    expect(attachmentsFor({ ...windhawkModel(130), weapon: SHARPBOLT_BOW }, ItemTypeEnum.weapon, items, enchantMap).cardFields).toEqual([]);
    expect(attachmentsFor({ ...windhawkModel(130), weapon: ROYAL_BOW }, ItemTypeEnum.weapon, items, enchantMap).cardFields)
      .toEqual([ItemTypeEnum.weaponCard1, ItemTypeEnum.weaponCard2]);
  }, ENGINE_TIMEOUT);

  it('os encantamentos vêm da tabela do item (Bota Temporal oferece Instinto na posição 2)', () => {
    const { enchants } = attachmentsFor({ ...windhawkModel(130), boot: TEMPORAL_DEX_BOOT }, ItemTypeEnum.boot, items, enchantMap);
    const position2 = enchants.find((entry) => entry.field === ItemTypeEnum.bootEnchant2);
    expect(position2?.ids).toContain(HAWKEYE);
    expect(enchants.every((entry) => entry.ids.every((id) => enchantMap.has(items[id].aegisName)))).toBe(true);
  }, ENGINE_TIMEOUT);
});

describe('conjuntos', () => {
  const catalog = buildCatalog(items, character, { maxRequiredLevel: 230 });
  const moves = findSetMoves(items, catalog);

  it('encontra o conjunto Arco + Elmo de Thanos, cada peça no seu slot', () => {
    const thanos = moves.find((move) => move.pieces.some((piece) => piece.id === THANOS_BOW) && move.pieces.some((piece) => piece.id === THANOS_HELMET));
    expect(thanos?.pieces).toEqual(expect.arrayContaining([
      { slot: ItemTypeEnum.weapon, id: THANOS_BOW },
      { slot: ItemTypeEnum.headUpper, id: THANOS_HELMET },
    ]));
  }, ENGINE_TIMEOUT);

  it('nunca usa o mesmo slot duas vezes e respeita os slots permitidos', () => {
    for (const move of moves) expect(new Set(move.pieces.map((piece) => piece.slot)).size).toBe(move.pieces.length);

    const noHead = findSetMoves(items, catalog, new Set([ItemTypeEnum.weapon, ItemTypeEnum.armor]));
    expect(noHead.every((move) => move.pieces.every((piece) => piece.slot === ItemTypeEnum.weapon || piece.slot === ItemTypeEnum.armor))).toBe(true);
  }, ENGINE_TIMEOUT);
});

describe('optimizeBuild com cartas, encantamentos e conjuntos', () => {
  const evaluator = new BuildEvaluator(context);
  const fast = { shortlistSize: 4, cardShortlistSize: 4, setShortlistSize: 6, statEvaluations: 400, maxRounds: 2, objective: 'dps' } as const;

  it('escolhe cartas e encantamentos válidos e não fica pior que sem eles', () => {
    const slots: OptimizableSlot[] = [ItemTypeEnum.weapon, ItemTypeEnum.ammo, ItemTypeEnum.boot];
    const plain = optimizeBuild(evaluator, context, windhawkModel(130), { ...fast, slots, optimizeCards: false, optimizeEnchants: false, optimizeSets: false });
    const full = optimizeBuild(evaluator, context, windhawkModel(130), { ...fast, slots });

    expect(full.damage).toBeGreaterThanOrEqual(plain.damage);
    const weaponCards = attachmentsFor(full.model, ItemTypeEnum.weapon, items, enchantMap).cardFields;
    for (const change of full.attachmentChanges) {
      if (!change.to) continue;
      const { cardFields, enchants } = attachmentsFor(full.model, change.slot, items, enchantMap);
      const allowed = cardFields.includes(change.field) || enchants.some((entry) => entry.field === change.field && entry.ids.includes(change.to!));
      expect(allowed).toBe(true);
    }
    expect([1, 2, 3, 4].filter((n) => (full.model as any)[`weaponCard${n}`]).length).toBeLessThanOrEqual(weaponCards.length);
  }, 120_000);

  it('mantém o tipo de arma por padrão (Tiro Preciso não declara que exige arco)', () => {
    const result = optimizeBuild(evaluator, context, windhawkModel(130), {
      ...fast, slots: [ItemTypeEnum.weapon, ItemTypeEnum.ammo], optimizeStats: false, constraints: { maxVct: 0 },
    });
    expect(items[result.model.weapon!].itemSubTypeId).toBe(items[SHARPBOLT_BOW].itemSubTypeId);
  }, 120_000);

  it('efeitos colaterais não mexem em slot travado', () => {
    const model = { ...windhawkModel(130), headLower: 420076 } as any;
    const result = optimizeBuild(evaluator, context, model, {
      ...fast, slots: [ItemTypeEnum.headMiddle], lockedSlots: [ItemTypeEnum.headLower], optimizeStats: false,
      catalog: { allowedItemIds: new Set([ODIUM_MASK, 410093]) },
    });
    expect(result.model.headLower).toBe(420076);
    expect(result.model.headMiddle).not.toBe(ODIUM_MASK);
  }, 60_000);
});

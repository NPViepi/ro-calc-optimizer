import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { ItemModel } from 'src/app/models/item.model';
import { EquipmentGridComponent } from '../../../../../react/controllers/equipment-grid';
import { SlotListBag } from './slot-list-bag.model';

/**
 * Quem vê a linha do escudo.
 *
 * A linha era lida só pela build principal, então uma arma de duas mãos à esquerda sumia com
 * ela da tela inteira — e com o botão de comparar junto, que é o que o card
 * `9lvALhlAS6Njj6z2pp6Q` (iukkeN) relatou: não havia onde pôr o escudo da build comparada.
 *
 * Quem responde por cada build é a sessão (`isShieldShown` e `isCompareShieldShown`); o que a
 * grade faz com as duas respostas é o que está fixado aqui. A metade principal não pode
 * oferecer um seletor quando a resposta dela é não: um escudo numa build de duas mãos escapa
 * da penalidade de Vel.Atq mas levaria os bônus do script para a conta.
 */

const TWO_HANDED = 2019;
const ONE_HANDED = 1623;

const item = (id: number, name: string): ItemModel =>
  ({ id, name, aegisName: `Item_${id}`, itemLevel: 4, slots: 0, script: {} }) as ItemModel;

const ITEMS: Record<number, ItemModel> = {
  [TWO_HANDED]: item(TWO_HANDED, '[Aluguel] Cajado de Duas Mãos TE'),
  [ONE_HANDED]: item(ONE_HANDED, '[Aluguel] Cajado do Poder'),
};

function makeGrid(input: { weapon?: number; leftWeapon?: number; shieldShown?: boolean; compareShield?: boolean }) {
  // Sem o serviço de layout, como nos outros specs da grade: ele só alimenta a busca de itens.
  const grid = new EquipmentGridComponent({ hintPending: false, labels: {} } as any, undefined as any);

  grid.items = ITEMS;
  grid.mapEnchant = new Map();
  grid.lists = { refineList: [], shadowRefineList: [] } as unknown as SlotListBag;
  grid.model = { rawOptionTxts: [], slotColors: {}, weapon: input.weapon, leftWeapon: input.leftWeapon };
  grid.model2 = { rawOptionTxts: [] };
  grid.compareItemNames = [];
  grid.showCompareItemMap = {};
  grid.isShieldShown = input.shieldShown ?? false;
  grid.isCompareShieldShown = input.compareShield ?? false;
  grid.refreshInputs();

  const slotKeys = grid.columns.flatMap((column) => column.flatMap((group) => group.slots.map((slot) => slot.key)));

  return { grid, shown: slotKeys.includes(ItemTypeEnum.shield) };
}

const shieldSlot = SLOTS_BY_KEY.get(ItemTypeEnum.shield)!;

describe('a linha do escudo na comparação', () => {
  it('fica fora da tela quando nenhuma das duas builds pode usar escudo', () => {
    expect(makeGrid({ weapon: TWO_HANDED }).shown).toBe(false);
  });

  it('aparece pela build comparada, com a principal dizendo o que ocupa a mão', () => {
    const { grid, shown } = makeGrid({ weapon: TWO_HANDED, compareShield: true });

    expect(shown).toBe(true);
    expect(grid.mainBlockedNote(shieldSlot)).toBe('[Aluguel] Cajado de Duas Mãos TE ocupa as duas mãos');
  });

  it('não põe recado nenhum quando a própria build principal pode usar escudo', () => {
    const { grid, shown } = makeGrid({ weapon: ONE_HANDED, shieldShown: true });

    expect(shown).toBe(true);
    expect(grid.mainBlockedNote(shieldSlot)).toBeNull();
  });

  it('explica a arma da mão esquerda, que disputa a mesma mão', () => {
    const { grid, shown } = makeGrid({ weapon: ONE_HANDED, leftWeapon: ONE_HANDED, compareShield: true });

    expect(shown).toBe(true);
    expect(grid.mainBlockedNote(shieldSlot)).toBe('[Aluguel] Cajado do Poder ocupa a outra mão');
  });

  it('pede uma arma quando não há nenhuma, que é o outro jeito de a mão não estar livre', () => {
    const { grid } = makeGrid({ compareShield: true });

    expect(grid.mainBlockedNote(shieldSlot)).toBe('Equipe uma arma para poder usar escudo');
  });

  it('não toca em slot nenhum fora o escudo', () => {
    const { grid } = makeGrid({ weapon: TWO_HANDED, compareShield: true });

    expect(grid.mainBlockedNote(SLOTS_BY_KEY.get(ItemTypeEnum.armor)!)).toBeNull();
  });
});

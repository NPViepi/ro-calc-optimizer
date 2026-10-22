/**
 * Quais cartas são de MVP. A base não marca isso: a carta é casada pelo nome com os monstros
 * que têm `stats.mvp`, usando todos os nomes disponíveis (pt-BR do LATAM, inglês em `enName`,
 * `dbname` do monstro). Quando o mesmo nome existe como MVP e como monstro comum (o Bafomé de
 * instância, por exemplo), vale o MVP. Ajustes manuais ficam em `data/mvp-cards.ts`.
 */

import { ItemTypeId } from 'src/app/constants/item.const';
import { ItemModel } from 'src/app/models/item.model';
import { MonsterModel } from 'src/app/models/monster.model';
import { MVP_CARD_OVERRIDES } from './data/mvp-cards';

export function normalizeName(name: string | undefined | null): string {
  return (name ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\[\d]/g, ' ')
    .replace(/\b(card|carta)\b/g, ' ')
    .replace(/[_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).join(' ');
}

/** Ids das cartas de MVP presentes em `items`. */
export function findMvpCards(items: Record<number, ItemModel>, monsters: Record<number, MonsterModel>): Set<number> {
  const mvpNames = new Set<string>();
  for (const monster of Object.values(monsters)) {
    if (!(monster as any)?.stats?.mvp) continue;
    for (const name of [monster.name, (monster as any).dbname]) {
      const key = normalizeName(name);
      if (key) mvpNames.add(key);
    }
  }
  const result = new Set<number>();
  for (const item of Object.values(items)) {
    if (!item || item.itemTypeId !== ItemTypeId.CARD) continue;
    const names = [item.name, item.enName].map(normalizeName).filter(Boolean);
    if (names.some((name) => mvpNames.has(name))) result.add(item.id);
  }
  for (const id of MVP_CARD_OVERRIDES.include) if (items[id]) result.add(id);
  for (const id of MVP_CARD_OVERRIDES.exclude) result.delete(id);
  return result;
}

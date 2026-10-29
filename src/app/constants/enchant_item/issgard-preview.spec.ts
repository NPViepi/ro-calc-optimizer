import { describe, expect, it } from 'vitest';
import items from '../../../assets/demo/data/item.json';
import latam from '../../../assets/demo/data/latam-items.json';
import { ItemModel } from '../../models/item.model';
import { getEnchants } from './_enchant_table';
import { dimWeapon2, dimWeapon3, dimWeapon4 } from './dim_glacier';
import { glacierWea1, glacierWea2, glacierWea3, glacierWea4 } from './glacier';

const db = items as Record<string, ItemModel>;
const enchantNames = new Set(Object.values(db).filter((item) => item.itemTypeId === 11).map((item) => item.aegisName));
// Equipment table: https://irowiki.org/wiki/Issgard_Land_of_Snow_Flowers#Equipment
const snowFlower = [450206, 450207, 480159, 480160, 470115, 470116, 490177, 490176, 490179, 490178];
// Divine Pride iRO descriptions: /database/item/400105, /400106 and /400107.
const crowns = [400105, 400106, 400107];
const weaponPairs = [
  [600027, 600030], [610037, 610041], [620017, 620019], [630018, 630019],
  [640033, 640034], [650025, 650028], [700052, 700059], [800014, 800015],
  [810010, 810015], [820008, 820011], [830013, 830015], [840009, 840010],
  [500049, 500054], [500050, 500055], [510061, 510075], [510062, 510076],
  [520017, 520021], [530025, 530034], [540049, 540056], [550069, 550089],
  [550070, 550090], [560032, 560037], [570029, 570032], [580030, 580033],
  [590038, 590047], [590039, 590048],
];

describe('Issgard equipment and remaining previews', () => {
  it('publishes all three Issgard crowns with a card slot and their crystal pools', () => {
    for (const id of crowns) {
      const item = db[id];
      const client = (latam as Record<string, { description?: string }>)[id];
      expect(item).toMatchObject({ location: 'Upper', slots: 1, requiredLevel: 230, usableClass: ['all'] });
      expect(item.preRelease, String(id)).toBe(client ? undefined : true);
      expect(client?.description ?? item.description).toContain('CON +');
      const pools = getEnchants(item.aegisName);
      expect(pools).toHaveLength(4);
      expect(pools?.[0]).toBeNull();
      expect(pools?.slice(1).flat().filter(name => !enchantNames.has(name!))).toEqual([]);
    }
  });

  it('lists every Snow Flower piece and both versions of every Glacier weapon', () => {
    expect(snowFlower).toHaveLength(10);
    expect(weaponPairs).toHaveLength(26);
    for (const id of [...snowFlower, ...weaponPairs.flat()]) {
      const item = db[id];
      const client = (latam as Record<string, { description?: string }>)[id];
      expect(item?.preRelease, String(id)).toBe(client ? undefined : true);
      expect((client?.description ?? item?.description)?.trim(), String(id)).toBeTruthy();
      const slots = getEnchants(item.aegisName);
      expect(slots, String(id)).toHaveLength(4);
      for (const slot of slots?.filter((pool): pool is string[] => !!pool) ?? []) {
        expect(slot.filter((name) => !enchantNames.has(name)), String(id)).toEqual([]);
      }
    }
  });

  it('keeps the card slot and distinct enchant families on Dim weapons', () => {
    for (const [regularId, dimId] of weaponPairs) {
      const regular = db[regularId];
      const dim = db[dimId];
      expect(regular.slots).toBe(0);
      expect(dim.slots).toBe(1);
      expect(regular.requiredLevel).toBe(210);
      expect(dim.requiredLevel).toBe(230);
      expect(getEnchants(regular.aegisName)).toEqual([glacierWea1, glacierWea2, glacierWea3, glacierWea4]);
      expect(getEnchants(dim.aegisName)).toEqual([null, dimWeapon2, dimWeapon3, dimWeapon4]);
    }
  });
});

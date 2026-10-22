import { MainModel } from 'src/app/models/main.model';
import { createMainModel } from 'src/app/utils';

/** Guerrilheiro (Night Watch) nível 240 com revólver, para Artilharia Pesada (Magazine for One). */
export const MAGAZINE_FOR_ONE = 'Magazine for One==5';
export const REVOLVER = 13146; // Calf Deathadder [2]

export function nightWatchModel(): MainModel {
  const model = createMainModel();
  model.class = 4306;
  model.level = 240;
  model.jobLevel = 50;
  model.str = 1; model.agi = 110; model.vit = 100; model.int = 1; model.dex = 130; model.luk = 1;
  model.pow = 0; model.sta = 0; model.wis = 0; model.spl = 0; model.con = 100; model.crt = 0;
  model.weapon = REVOLVER;
  model.weaponRefine = 10;
  model.selectedAtkSkill = MAGAZINE_FOR_ONE;
  model.rotation = [MAGAZINE_FOR_ONE];
  return model;
}

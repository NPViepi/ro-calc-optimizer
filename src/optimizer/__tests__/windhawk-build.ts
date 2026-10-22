import { readFileSync } from 'node:fs';
import { Windhawk } from 'src/app/jobs';
import { MainModel } from 'src/app/models/main.model';
import { createMainModel } from 'src/app/utils';
import { EvaluationContext } from '../evaluate';

/**
 * O mesmo build de Falcão do Vento de `src/app/core/__tests__/instinto-build.ts` (arco,
 * flecha, Bota Temporal com Instinto), descrito como um MainModel + EvaluationContext para
 * o otimizador. Mantido igual ao fixture do upstream de propósito: o spec do avaliador
 * compara os dois caminhos e prova que dão o mesmo resultado.
 */
export const itemDb = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));

export const INSTINTO_ID = 4879;

/**
 * A base com `presentInLatam` marcado, como o `build-web-data.mjs` faz no build do site
 * (o item.json do repositório não traz o campo). Usada pelos testes de itens.
 */
export const latamItemDb = (() => {
  const latam = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8'));
  return Object.fromEntries(Object.entries<any>(itemDb).map(([id, item]) => [id, latam[id] || item.preRelease ? { ...item, presentInLatam: true } : item]));
})();

const ACTIVE_SKILL_LEVELS: Record<string, number> = {
  'Improve Concentration': 10,
  'Wind Walk': 5,
  'Falcon Eyes': 10,
  'Fear Breeze': 5,
  'No Limits': 5,
  'Calamity Gale': 1,
};

/** Cópia do alvo do fixture do upstream (Poring sem defesas). */
export const ZEROED_PORING = {
  id: 1002, name: 'Poring', spawn: 'x',
  stats: {
    level: 1, health: 50, attack: { min: 7, max: 8 }, range: 1, defense: 0, magicDefense: 0,
    str: 1, int: 0, vit: 1, dex: 6, agi: 1, luk: 30, element: 1, elementName: 'Neutral 1',
    elementShortName: 'W1', race: 4, raceName: 'Plant', scale: 0, scaleName: 'Small', class: 0,
    criShield: 0, softDef: 0, mdef: 0, softMdef: 0, res: 0, mres: 0,
    hitRequireFor100: 182, fleeRequireFor95: 182,
  },
  data: { def: 0, mdef: 0, hitRequireFor100: 182, fleeRequireFor95: 182, criShield: 0, softDef: 0, res: 0, mres: 0 },
} as any;

export const SYNTHETIC_HP_SP = (className: string) =>
  [{ jobs: { [className]: true }, baseHp: Array(251).fill(100000), baseSp: Array(251).fill(10000) }] as any;

export function windhawkContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const character = new Windhawk();
  return {
    items: itemDb,
    hpSpTable: SYNTHETIC_HP_SP(character.className),
    character,
    monster: ZEROED_PORING,
    selectedChances: [],
    ...overrides,
  };
}

export function windhawkModel(dex: number): MainModel {
  const model = createMainModel();
  const cls = new Windhawk();
  model.class = 4257;
  model.level = 230;
  model.jobLevel = 47;
  model.activeSkills = cls.activeSkills.map((skill) => ACTIVE_SKILL_LEVELS[skill.name] ?? 0);
  model.passiveSkills = [];
  model.str = 4; model.agi = 100; model.vit = 100; model.int = 120; model.dex = dex; model.luk = 73;
  model.pow = 100; model.crt = 21;
  model.jobStr = 2; model.jobAgi = 12; model.jobVit = 7; model.jobInt = 8; model.jobDex = 7; model.jobLuk = 4;
  model.jobPow = 7; model.jobSta = 4; model.jobWis = 5; model.jobSpl = 4; model.jobCon = 8; model.jobCrt = 4;
  model.weapon = 700016;
  model.weaponRefine = 11;
  model.ammo = 1773;
  model.boot = 22004;
  model.bootRefine = 9;
  model.bootEnchant2 = INSTINTO_ID;
  model.selectedAtkSkill = 'Focused Arrow Strike==5';
  return model;
}

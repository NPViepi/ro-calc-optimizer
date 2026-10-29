import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AssassinCross } from '../jobs';
import { createMainModel } from '../utils';
import { buildAutoCastSimulation } from './auto-cast';
import { Calculator } from './calculator';
import { CalculatorController } from './calculator-controller';

/**
 * Items that grant [Ataque Duplo] (skill 48).
 *
 * Card wpUfFcfyaxiob72RTbmt ("Efeito de Ataque Duplo na Auto-conjuração", reportado por
 * GetLemonade). The engine has read the grant since the Bonés Maratonistas were scripted —
 * `auto-cast.ts` turns `enable_skill__48` into the extra-hit source on the Auto-conjuração
 * tab, at the higher of the granted and the learned level. What was missing was the data:
 * eleven records whose own pt-BR description says "Habilita [Ataque Duplo] nv.N" carried no
 * `enable_skill__48` key, so the tab showed nothing however the item was equipped.
 *
 * The first test is a census rather than a list, because that is the shape of the bug: the
 * four ids on the card were the ones someone noticed, and seven more had the same hole.
 * Anything the client says grants the skill has to carry the key, or this fails.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8')) as Record<string, any>;
const latam = JSON.parse(readFileSync('src/assets/demo/data/latam-items.json', 'utf8')) as Record<string, any>;
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const plain = (text: string) => (text ?? '').replace(/\^[0-9a-fA-F]{6}/g, '');

/** Every id whose pt-BR description says it enables [Ataque Duplo]. */
const GRANTING = Object.entries(latam)
  .filter(([, entry]) => /Habilita \[Ataque Duplo\] nv\.\d+/.test(plain(entry?.description)))
  .map(([id]) => ({ id, name: latam[id].name as string }));

describe('the client-described grants are all in item.json', () => {
  it('found the family at all (guards the regex against a description rewrite)', () => {
    expect(GRANTING.length).toBeGreaterThanOrEqual(SCRIPTS.length);
  });

  it('leaves no granting item without an enable_skill__48 entry', () => {
    const missing = GRANTING
      .filter(({ id }) => items[id] && !(items[id].script ?? {})['enable_skill__48'])
      .map(({ id, name }) => `${name} (${id})`);

    expect(missing).toEqual([]);
  });
});

/**
 * The level and its gate, per record. A bare level is an unconditional grant; the rest
 * carry the condition the description states — a refine threshold, a set partner, a
 * refine sum, or a learned skill. "ou no maior nível aprendido" needs no encoding: the
 * engine already takes `max(granted, learned)`.
 */
const SCRIPTS: [string, string, string[]][] = [
  ['Carta Sorrateiro', '4117', ['1']],
  ['Chapéu de Jiboia', '5388', ['5']],
  ['Pedra de Ataque Duplo (Capa)', '25302', ['3']],
  ['Ataque Duplo (encante de visual)', '29362', ['3']],
  ['Nagan', '1130', ['5']],
  ['Lança Peçonhenta', '1447', ['5']],
  ['Chapéu de Pintinho', '5283', ['2']],
  ['Boné Maratonista Mecânico', '19189', ['11===5']],
  ['Boné Maratonista Rúnico', '19195', ['11===5']],
  // Conjunto [Sobrevivente Ilusional] (20847), soma dos refinos 22 ou mais.
  ['Certeira Ilusional', '28745', ['EQUIP_ID[20847]REFINE[weapon,garment==22]4']],
  // Ao aprender [Perícia com Katar] (134) nv.10.
  ['Sicário II (Capa)', '310188', ['SKILL_ID[134==10]3']],
  ['Pedra de Sicário II (Capa)', '1000221', ['SKILL_ID[134==10]3']],
  // Conjunto Boné Maratonista Mágico (19194).
  ['Competidor Poring', '420820', ['EQUIP_ID[19194]10']],
];

describe.each(SCRIPTS)('%s (%s)', (_name, id, expected) => {
  it('grants the level its description names, under the gate it states', () => {
    expect(items[id].script['enable_skill__48']).toEqual(expected);
  });
});

/** The end the reporter was looking at: the source showing up on the Auto-conjuração tab. */
describe('Auto-conjuração shows the grant', () => {
  const simulate = (headgear?: number) => {
    const cls = new AssassinCross();
    const bonuses = cls.setLearnSkills({
      activeSkillIds: cls.activeSkills.map(() => 0),
      passiveSkillIds: cls.passiveSkills.map(() => 0),
    }).getSkillBonusAndName();
    const model = {
      ...createMainModel(), class: cls.classId, level: 200, jobLevel: 1,
      str: 120, agi: 120, weapon: 1201, headUpper: headgear,
    };
    const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
    calc.loadItemFromModel(model);
    new CalculatorController().runChain(calc, {
      monster: monsters[21067], ...bonuses, buffEquips: {}, buffMasterys: {}, consumeData: [],
      extraOptionScripts: [], selectedAtkSkill: '', selectedChances: [], usedHpL: false,
    } as any);
    return buildAutoCastSimulation({
      calc, model, hasSelectedEffects: false,
      summary: {
        ...calc.getTotalSummary(), calc: { hitPerSecs: 4 },
        dmg: { accuracy: 100, criRateToMonster: 0, basicDps: 400 },
      },
    });
  };

  it('has no Ataque Duplo source with nothing granting it', () => {
    expect(simulate().sources.find(entry => entry.source.skillId === 48)).toBeUndefined();
  });

  it('offers it at 7% per level once Chapéu de Jiboia is worn', () => {
    const source = simulate(5388).sources.find(entry => entry.source.skillId === 48)!;
    expect(source).toBeDefined();
    expect(source.source).toMatchObject({ kind: 'extra-hit', skillLevel: 5, chance: 35 });
    expect(source.source.extraHitOutcomes).toEqual([{ totalHits: 2, chance: 0.35 }]);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ElementType } from '../constants/element-type.const';
import { RaceType } from '../constants/race-type.const';

/**
 * Monster records the ragassets client feed cannot maintain.
 *
 * `tools/sync-monster-db.mjs` refreshes every record in monster.json from the client's own
 * mobs.json — except the ones the client table does not carry. Those keep whatever they
 * were created with, forever, and no sync run will ever correct them. Today that is 69
 * records: 9 synthetic Miragem de Amdarais clones this repo owns on purpose, and **60 real
 * monsters** whose stats come from divine-pride instead. Nearly all of them have RES > 0,
 * which makes them exactly the targets whose numbers get disputed.
 *
 * 20994 Betelgeuse is the one that got disputed, on tracker card `qpFtVdQx1bxY4PTJ3pVS`
 * ("Diferença de dano no Betelgeuse", reportado por Ynk, 21/08/2026). Its block came in
 * from the upstream Thai fork in commit c29084f7 (26/07/2024) and had never been read
 * since. It was checked against https://www.divine-pride.net/database/monster/20994 on
 * 21/08/2026 and **every figure matched** — the record is right; what the report was
 * really seeing is Aliviar, which the boss casts (constants/monster-relieve.ts).
 *
 * This spec exists so that verification is not lost, and so a careless edit or a bad
 * re-scrape of an unmaintainable record fails a test instead of quietly changing damage.
 * Divine-pride's own page prints "500 (-44,44%) Res", the same reduction
 * `res-mres-reduction.spec.ts` pins against bROWiki — two independent sources agreeing on
 * the stat and on what it does with it.
 */

const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));

describe('Betelgeuse (20994) — verified against divine-pride, unmaintainable by the feed', () => {
  const rec = monsters['20994'];

  it('is in the database, on the Torre da Constelação map that groups the picker', () => {
    expect(rec).toBeDefined();
    expect(rec.dbname).toBe('MD_BETELGEUSE');
    expect(rec.spawn).toBe('3@ch_t');
  });

  it('keeps divine-pride\'s stat block — level, HP, DEF/MDEF and the six base stats', () => {
    expect(rec.stats.level).toBe(250);
    expect(rec.stats.health).toBe(2_000_000_000);
    expect(rec.stats.defense).toBe(346);
    expect(rec.stats.magicDefense).toBe(102);
    expect([rec.stats.str, rec.stats.agi, rec.stats.vit]).toEqual([211, 211, 132]);
    expect([rec.stats.int, rec.stats.dex, rec.stats.luk]).toEqual([152, 279, 108]);
  });

  it('keeps RES 500 / RESM 500 — the figures the damage gap was blamed on', () => {
    expect(rec.stats.res).toBe(500);
    expect(rec.stats.mres).toBe(500);
  });

  it('is Grande / Dragão / Neutro 2 and an MVP boss', () => {
    expect(rec.stats.scaleName).toBe('Large');
    expect(rec.stats.raceName).toBe('Dragon');
    expect(rec.stats.elementName).toBe('Neutral 2');
    expect(rec.stats.mvp).toBe(1);
    expect(rec.stats.class).toBe(1);
  });
});

/**
 * A ratchet, not a census: the point is that the set of records the feed cannot maintain
 * only ever shrinks (a client update finally shipping one) or grows *deliberately* (the
 * add-ro-monster skill taking in another divine-pride-only mob). Either way the number
 * here has to be edited by hand, which is the moment to re-read the list.
 *
 * Checking the ids against the live feed would need the network, so this asserts the
 * shape it can see locally — the synthetic clones are all present and accounted for.
 */
describe('the synthetic Miragem de Amdarais targets stay accounted for', () => {
  const SYNTHETIC = [205731, 205732, 205733, 205734, 205735, 205736, 205737, 205738, 205739];

  it('all nine per-level clones exist and differ from mob 20573 only in HP', () => {
    const base = monsters['20573'];
    expect(base).toBeDefined();
    for (const id of SYNTHETIC) {
      const clone = monsters[String(id)];
      expect(clone, `monstro sintético ${id}`).toBeDefined();
      expect(clone.stats.health).not.toBe(base.stats.health);
      expect([clone.stats.defense, clone.stats.res, clone.stats.mres])
        .toEqual([base.stats.defense, base.stats.res, base.stats.mres]);
    }
  });
});

/**
 * The five EP19/EP20 bosses added on 27/10/2026, on tracker card `gaSsKRQ4qYcI8Qr1GG2H`
 * ("Bosses faltantes"). They were nameable in the picker — latam-monsters.json has carried
 * their pt-BR labels since an older feed — but had no stat block, so they could not be
 * chosen as a target at all. ragassets' mobs.json carries none of the five ids, so every
 * figure below was read off divine-pride on 27/10/2026 and no sync run will refresh them:
 *
 *   https://www.divine-pride.net/database/monster/21531  Aquila
 *   https://www.divine-pride.net/database/monster/21533  Simulation Juncea
 *   https://www.divine-pride.net/database/monster/21981  Lasgand
 *   https://www.divine-pride.net/database/monster/21982  Fallen Angel Slug
 *   https://www.divine-pride.net/database/monster/21996  Snowstorm Angel
 *
 * The card asked for Aquila, Simulation Juncea and Lasgand plus "the next bosses" — the
 * siblings in the same state. Fallen Angel Slug and Snowstorm Angel are the two: EP20
 * MVPs with a pt-BR label and no record. The rest of the gap (21532, 21534-21536, 21974,
 * 21979, 21980) is still untranslated in the client, and inventing a name for a monster is
 * not this repo's to do.
 */
/** The codes `tools/mob-source.mjs` writes are positions in these enums. */
const ELEMENTS: string[] = Object.values(ElementType);
const RACES: string[] = Object.values(RaceType);

describe.each([
  { name: 'Aquila', id: 21531, dbname: 'EP19_MD_AQUILA', spawn: 'MD_EP19', stats: {
    level: 210, health: 500_000_000, defense: 456, magicDefense: 112, res: 275, mres: 242,
    str: 80, agi: 80, vit: 80, int: 80, dex: 80, luk: 80,
    scaleName: 'Large', raceName: 'Formless', elementName: 'Neutral 3' } },
  { name: 'Simulation Juncea', id: 21533, dbname: 'EP19_MD_JUNCEA_S', spawn: 'MD_EP19', stats: {
    level: 215, health: 225_503_800, defense: 575, magicDefense: 100, res: 376, mres: 131,
    str: 159, agi: 91, vit: 276, int: 101, dex: 377, luk: 110,
    scaleName: 'Large', raceName: 'Formless', elementName: 'Poison 4' } },
  { name: 'Lasgand', id: 21981, dbname: 'MD_EP20_BOSS_LASGAND', spawn: 'MD_EP20', stats: {
    level: 215, health: 1_000_000_000, defense: 527, magicDefense: 286, res: 424, mres: 321,
    str: 112, agi: 92, vit: 107, int: 112, dex: 112, luk: 107,
    scaleName: 'Large', raceName: 'Undead', elementName: 'Poison 4' } },
  { name: 'Fallen Angel Slug', id: 21982, dbname: 'MD_EP20_FALLENANGEL', spawn: 'MD_EP20', stats: {
    level: 225, health: 206_537_987, defense: 359, magicDefense: 196, res: 283, mres: 217,
    str: 115, agi: 94, vit: 110, int: 115, dex: 115, luk: 110,
    scaleName: 'Large', raceName: 'Angel', elementName: 'Water 4' } },
  { name: 'Snowstorm Angel', id: 21996, dbname: 'EP20_SNOW_ANGEL', spawn: 'jor_back4', stats: {
    level: 235, health: 207_606_917, defense: 329, magicDefense: 179, res: 244, mres: 187,
    str: 101, agi: 83, vit: 97, int: 101, dex: 98, luk: 97,
    scaleName: 'Large', raceName: 'Angel', elementName: 'Holy 4' } },
])('$name ($id) — read off divine-pride, unmaintainable by the feed', ({ id, dbname, spawn, stats }) => {
  const rec = monsters[String(id)];

  it('is in the database, under the group its spawn code keys', () => {
    expect(rec).toBeDefined();
    expect(rec.dbname).toBe(dbname);
    expect(rec.spawn).toBe(spawn);
  });

  it('keeps every figure divine-pride prints', () => {
    expect(rec.stats).toMatchObject(stats);
  });

  it('is an MVP boss', () => {
    expect(rec.stats.mvp).toBe(1);
    expect(rec.stats.class).toBe(1);
  });

  it('carries the numeric codes the calc derives its tables from', () => {
    const [shortName, eleLevel] = stats.elementName.split(' ');
    expect(rec.stats.element).toBe(20 * Number(eleLevel) + ELEMENTS.indexOf(shortName));
    expect(rec.stats.elementShortName).toBe(shortName);
    expect(rec.stats.race).toBe(RACES.indexOf(stats.raceName));
    expect(rec.stats.scale).toBe(2);
  });
});

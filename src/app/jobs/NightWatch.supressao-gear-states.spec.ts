import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { NightWatch } from './NightWatch';

/**
 * Night Watch — Fogo de Supressão and Artilharia Pesada, against Nicolas's recording
 * (tracker card 9Nj2ePhbYx, `Supressao1.rrf`, 16/08/2026).
 *
 * Elizaveta, base 237 / job 50, on tra_fild against **Dummy - Médio** (monster 21065,
 * Formless, Neutral 1, Medium, DEF 0). Traits as the "Ajude o simulador" dialog collected
 * them — POD 100, CON 46, the other four at zero; the session never changes map, so the
 * `.rrf` carries none of its own. Neither Mira Focalizada nor Carta na Manga is ever
 * switched on: no EFST for either appears in the file, so the aiming count is 0 throughout.
 *
 * **The recording gears up on camera**, which is what makes it worth a fixture: folding
 * `equipChanges` onto the t=0 snapshot gives four builds out of one file — the same
 * character with almost no equipment, then fully geared, then through three weapons. One
 * recording covering the matrix that normally costs three.
 *
 * What it settled: the simulator was **1.02% high** on every one of the 40 packets, because
 * the character's ammunition — 13231 Projétil Venenoso — was missing from `item.json`, and
 * the importer fell back to the other bullet in the bag (13220 Projétil de Purificação,
 * ATQ 40 against the Venenoso's 20). Two independent sources pin that 20: the client
 * description in `latam-items.json`, and this file's criticals, which land on the exact
 * value at ATQ 20 and miss it at 19 and at 21.
 *
 * Everything else in the class checked out on the way, and none of it needed changing: the
 * status window matches the game exactly (ATQ 780/786, ATQ Equip. 726/670/499, P.ATQ 79/75,
 * S.ATQM 34/27/13, RES 16, RESM 9, C.Mais 10, T.CRÍT 3, VelAtq 147/165/168/182), and the
 * per-level tables of both skills reproduce the damage as they stand.
 *
 * Two readings that look like disagreements and are not, recorded so the next pass does not
 * re-chase them:
 *   - the game stops re-sending `sp=225` when the revolver goes on, so its status window
 *     still reads the weaponless P.ATQ (49) where the engine says 61. The damage settles it:
 *     dropping A.D.P's +12 puts the simulation ~7% below the recording, so the bonus is
 *     active and `weapon.isType('gun')` is right to cover revolvers;
 *   - displayed Crítico is 41/46 in game against the engine's 42/47. That is crit *rate*,
 *     which never enters the critical damage this file measures.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

/** "Dummy - Médio", the target of every packet in the recording. */
const DUMMY_MEDIO = '21065';
const FIXTURE = 'nw-supressao-gear-states.rrf';

const replay: any = decodeReplay(loadReplayFixture(FIXTURE));

/**
 * The build as of `untilMs`: the t=0 snapshot with every equip event up to that instant
 * folded in, handed to the real importer. Never retype the gear — `replayToModel` is what
 * knows the equip bitmask, the socket split and the random options.
 */
function modelAt(untilMs: number) {
  const inv = new Map<number, any>([...replay.initialInventory].map(([k, r]: any) => [k, { ...r, cards: [...r.cards] }]));
  for (const e of replay.equipChanges ?? []) {
    if (e.time > untilMs) break;
    const rec = inv.get(e.slot) ?? { slot: e.slot, qty: 1, options: [] };
    inv.set(e.slot, {
      ...rec,
      itemId: e.itemId,
      refine: e.refine,
      grade: e.grade,
      cards: [...(e.cards ?? [])],
      options: e.options?.length ? e.options : rec.options ?? [],
      equipped: e.equipped ? e.location : 0,
    });
  }
  return replayToModel({ ...replay, initialInventory: inv }, items);
}

function simulate(untilMs: number, skillName: string, skillLevel: number) {
  const { model, learnedSkills }: any = modelAt(untilMs);
  const m: any = model;
  // The traits the recorder's dialog collected — a single-map session carries none.
  m.pow = 100; m.sta = 0; m.wis = 0; m.spl = 0; m.con = 46; m.crt = 0;

  const cls = new NightWatch();
  const jb = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: jb.str, jobAgi: jb.agi, jobVit: jb.vit, jobInt: jb.int, jobDex: jb.dex, jobLuk: jb.luk,
    jobPow: jb.pow, jobSta: jb.sta, jobWis: jb.wis, jobSpl: jb.spl, jobCon: jb.con, jobCrt: jb.crt,
  });
  const selectedAtkSkill = `${skillName}==${skillLevel}`;
  m.selectedAtkSkill = selectedAtkSkill;

  const passiveSkillIds = cls.passiveSkills.map((s) => {
    const id = (SKILL_ID_BY_NAME as any)[s.name];
    return id ? learnedSkills[id] ?? 0 : 0;
  });
  // Nothing active: no Mira Focalizada, no Carta na Manga, aiming count 0.
  const activeSkillIds = cls.activeSkills.map(() => 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds, passiveSkillIds })
    .getSkillBonusAndName();

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MEDIO], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill, selectedChances: [], usedHpL: false,
  } as any);

  return { dmg: (calc as any).damageSummary, model: m };
}

/** The instants that separate the four states, in ms of session time. */
const GEARLESS_UNTIL = 25_000;
const GEARED_UNTIL = 31_000;
const SHOTGUN_UNTIL = 58_000;
const REVOLVER_UNTIL = 87_000;

/**
 * Fogo de Supressão declares `hit: 3` — a display split, with `totalHit` 1 — so each packet
 * is one hit and is compared undivided.
 */
const WILD_FIRE_STATES = [
  {
    name: 'no equipment beyond the weapon, the shadow set and the costumes · Bombardeador +9',
    untilMs: GEARLESS_UNTIL, weapon: 840004,
    packets: [1153686, 1153248, 1260417, 1230516, 1231389, 1251252, 1182279, 1240119, 1176384, 1188390],
  },
  {
    name: 'geared · Bombardeador +9 (Lança-Granadas)',
    untilMs: GEARED_UNTIL, weapon: 840004,
    packets: [3373230, 3576216, 3588219, 3616596, 3339834, 3582108, 3348129, 3496986, 3590403, 3446346],
  },
  {
    name: 'geared · Retalhador +7 (Espingarda)',
    untilMs: SHOTGUN_UNTIL, weapon: 820004,
    packets: [2854983, 2861781, 2758068, 2834007, 2878482, 2874210, 2904315, 2750493, 2839833, 2796327],
  },
];

/** Artilharia Pesada with the Revólver Descartado +0 — 10 packets, four of them criticals. */
const MAGAZINE_PACKETS = [2993754, 4483302, 4483302, 2989314, 3027684, 4483302, 3131376, 4483302, 3115206, 2951580];
/**
 * The critical, and the only exact equation in the file: a critical uses the weapon's
 * maximum ATK, so it is deterministic — and this one is printed four times, identically.
 * Artilharia Pesada is a real six-hit skill (`totalHit: 6`), so the packet divides by six.
 */
const MAGAZINE_CRIT_PER_HIT = 4483302 / 6;

describe('Night Watch · the recording imports the ammunition it was actually firing', () => {
  it('loads the Projétil Venenoso, not the other stack the snapshot also flags', () => {
    // The snapshot marks two ammo stacks as equipped — slot 83 (13231, 967 rounds) and
    // slot 103 (13220, 529). Only one was loaded, and the damage says it was the lower
    // slot; the importer resolves the tie the same way.
    expect(simulate(REVOLVER_UNTIL, 'Magazine for One', 5).model.ammo).toBe(13231);
  });

  it('has the bullet in the item DB with the ATQ and element its description states', () => {
    expect(items[13231]).toBeTruthy();
    expect(items[13231].attack).toBe(20);
    expect(items[13231].propertyAtk).toBe('Poison');
  });
});

describe('Artilharia Pesada · Revólver Descartado +0', () => {
  it('matches the recorded critical exactly', () => {
    const { dmg } = simulate(REVOLVER_UNTIL, 'Magazine for One', 5);
    expect(dmg.skillCanCri).toBe(true);
    expect(dmg.skillTotalHit).toBe(6);
    expect(dmg.skillMaxDamage).toBe(MAGAZINE_CRIT_PER_HIT);
  });

  it('brackets every non-critical packet', () => {
    const { dmg } = simulate(REVOLVER_UNTIL, 'Magazine for One', 5);
    const nonCrits = MAGAZINE_PACKETS.filter((d) => d !== MAGAZINE_CRIT_PER_HIT * 6).map((d) => d / 6);
    expect(nonCrits.length).toBe(6);
    for (const hit of nonCrits) {
      expect(hit).toBeGreaterThanOrEqual(dmg.skillMinDamageNoCri);
      expect(hit).toBeLessThanOrEqual(dmg.skillMaxDamageNoCri);
    }
    // The window has to stay tight, or a wrong ratio would still fit inside it.
    expect(dmg.skillMaxDamageNoCri / dmg.skillMinDamageNoCri).toBeLessThan(1.13);
  });
});

describe('Fogo de Supressão · both weapon branches, across the gear-up', () => {
  it.each(WILD_FIRE_STATES)('$name', (state) => {
    const { dmg, model } = simulate(state.untilMs, 'Wild Fire', 5);
    expect(model.weapon).toBe(state.weapon);
    expect(dmg.skillTotalHit).toBe(1);
    expect(dmg.skillHit).toBe(3);
    expect(dmg.skillCanCri).toBeFalsy();

    for (const packet of state.packets) {
      expect(packet).toBeGreaterThanOrEqual(dmg.skillMinDamage);
      expect(packet).toBeLessThanOrEqual(dmg.skillMaxDamage);
    }
    expect(dmg.skillMaxDamage / dmg.skillMinDamage).toBeLessThan(1.13);
  });
});

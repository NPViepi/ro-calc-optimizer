import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeReplay } from 'rrfparser';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from 'src/app/replay/__tests__/load-fixture';
import { replayToModel } from 'src/app/replay/replay-to-model';
import { SkyEmperor } from './SkyEmperor';

/**
 * `se-moon-states.rrf` — "Zonnor SE", Sky Emperor base 238 / job 50, on tra_fild against
 * the training dummies, 18/08/2026. Sent by Zonnor through the "Ajude o simulador" dialog
 * (tracker card wPs5rG55Hq). 278 s, 546 of its own hits; the stream also carries a Shadow
 * Cross ("Crawly") hitting the same dummies, so **every read filters on `source`**.
 *
 * What this recording adds over the two that came before it:
 *
 *  - `SkyEmperor.replay.spec.ts` (Ted, base 229) was recorded under **Elo Celestial**,
 *    which unlocks all four state skills at once. It therefore could not tell the two
 *    branches of Chute Meia-Lua and Alvorada apart.
 *  - This one never uses Elo Celestial. It walks the **moon chain** with Anoitecer —
 *    1st cast [Nascer da Lua], 2nd [Meia-Noite], 3rd [Pôr da Lua] (EFST 1388/1389/1390) —
 *    and casts each skill inside a known state, so the enhanced tables are measured
 *    directly. Alvorada appears in both states in the same file, 1,33x apart, which is
 *    exactly the 9.769 / 7.389 the two client rows give.
 *  - It gears up on camera (20 changes), so one file carries three builds: **naked**,
 *    **weapon only** (Livro Malevolente +8) and **full gear**. The naked window has no
 *    weapon-ATK roll, so every packet there is a single integer and each skill is an
 *    exact equation instead of a range.
 *
 * Character state — read from the recording itself, nothing typed by hand. The traits ride
 * on ZC_COUPLESTATUS (the session changed map), so the importer writes all six:
 *
 *   base 238 / job 50, class 4302     FOR 120 AGI 2 VIT 100 INT 85 DES 110 SOR 120
 *   POD 100  STA 9  SAB 10  FEI 0  CON 30  CRV 0   (allocated; job 50 adds POD +11)
 *   Maestria Celestial 10, Perícia com Livro 7
 *
 * **The naked window fixes ATK at 4.449 and the dummy's soft DEF at 50.** Over a sweep of
 * every ATK from 1.000 to 200.000 and every soft DEF from 0 to 300, that pair is the only
 * one that closes all four of Chute Meia-Lua, Alvorada, Constelação and Explosão Galática
 * at once — so the four ratios below are measured, not fitted.
 *
 * Two defects fell out of it, both in the same place: **the class was missing two of its
 * ten attack skills.** Amanhecer (5465) and Anoitecer (5468) — the two state openers, and
 * prerequisites of Firmamento, so every Sky Emperor has them — were in neither the job's
 * skill list nor the skill catalog. 5468 was not in `skill-meta.generated.ts` at all.
 * The recording casts Anoitecer 28 times and it is now modelled off those packets; see
 * `SkyEmperor.ts` for how its POD x 3 term was measured, and for the one number in the
 * pair that is still an inference (Amanhecer's, which no recording exercises).
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const replay: any = decodeReplay(loadReplayFixture('se-moon-states.rrf'));
const ME = replay.sessionInfo.aid;

/** The dummies hit here are "Dummy - Médio"/"Grande"; both are level 100, DEF 0, Formless. */
const DUMMY_MEDIUM = '21065';

/** Espaço Celeste dropdown values — see CelestialSpace in SkyEmperor.ts. */
const MOONRISE = 4;
const MIDNIGHT = 5;
const MOONSET = 6;

/** The moon-chain EFSTs the recording walks through. */
const STATE: Record<number, string> = { 1388: 'NascerLua', 1389: 'MeiaNoite', 1390: 'PorDaLua' };

const stateEvents = replay.statusEvents
  .filter((e: any) => STATE[e.statusId])
  .sort((a: any, b: any) => a.time - b.time);

/** Which moon state was active at `t`. */
function stateAtTime(t: number): string {
  let cur = '-';
  for (const e of stateEvents) {
    if (e.time > t) break;
    if (e.isOn) cur = STATE[e.statusId];
    else if (cur === STATE[e.statusId]) cur = '-';
  }
  return cur;
}

/**
 * The recorder's own packets for one skill, inside a time window and (optionally) a single
 * moon state, ascending. `source` filtering is what keeps the other player's Shadow Cross
 * hits out of the comparison.
 */
function packets(skillId: number, from: number, to: number, state?: string): number[] {
  return replay.damage
    .filter(
      (d: any) =>
        d.source === ME &&
        d.skillId === skillId &&
        d.time >= from &&
        d.time <= to &&
        (!state || stateAtTime(d.time) === state),
    )
    .map((d: any) => d.damage)
    .sort((a: number, b: number) => a - b);
}

/**
 * The build worn at `t`: the t=0 inventory snapshot with every equip change up to then
 * folded onto it by inventory slot, then read by the same importer the app uses — so slot
 * mapping, sockets, refines, grades and random options are not re-implemented here.
 */
function stateAt(t: number) {
  const inv = new Map<any, any>(
    [...replay.initialInventory].map(([k, r]: any) => [k, { ...r, cards: [...(r.cards ?? [])] }]),
  );
  for (const e of replay.equipChanges ?? []) {
    if (e.time > t) break;
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

  return replayToModel({ ...replay, initialInventory: inv } as any, items).model as any;
}

/** Full engine run on the build worn at `t`, through the same chain the page uses. */
function sim(t: number, skillValue: string, celestialSpace: number) {
  const model = stateAt(t);
  const cls: any = new SkyEmperor();

  const bonus = cls.getJobBonusStatus(model.jobLevel);
  Object.assign(model, {
    jobStr: bonus.str, jobAgi: bonus.agi, jobVit: bonus.vit,
    jobInt: bonus.int, jobDex: bonus.dex, jobLuk: bonus.luk,
    jobPow: bonus.pow, jobSta: bonus.sta, jobWis: bonus.wis,
    jobSpl: bonus.spl, jobCon: bonus.con, jobCrt: bonus.crt,
  });

  const learned: Record<number, number> = {};
  for (const [id, lv] of replay.learnedSkills) learned[id] = lv;
  const passiveSkillIds = cls.passiveSkills.map((p: any) => {
    const id = SKILL_ID_BY_NAME[p.name];
    return id ? learned[id] ?? 0 : 0;
  });
  const activeSkillIds = cls.activeSkills.map((a: any) =>
    a.name === '_SkyEmperor_Celestial_Space' ? celestialSpace : 0,
  );

  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds, passiveSkillIds })
    .getSkillBonusAndName();

  model.selectedAtkSkill = skillValue;
  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  model.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(model);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MEDIUM],
    equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((model.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skillValue,
    selectedChances: [], usedHpL: false,
  } as any);

  const ds: any = (calc as any).damageSummary;

  return {
    model,
    ratio: ds.baseSkillDamage as number,
    hits: ds.skillHit as number,
    canCri: ds.skillCanCri as boolean,
    min: Math.round(ds.skillMinDamage as number),
    max: Math.round(ds.skillMaxDamage as number),
    noCriMin: Math.round(ds.skillMinDamageNoCri as number),
    noCriMax: Math.round(ds.skillMaxDamageNoCri as number),
  };
}

/**
 * The three windows, from the recording's own equip timeline: the weapon goes on at
 * 131.838, the other 19 pieces between 194.418 and 205.393, and no damage lands while any
 * of them is being put on. `at` is a time inside the window, used to rebuild the build.
 */
const NAKED = { at: 120_000, from: 0, to: 131_838 };
const WEAPON = { at: 190_000, from: 131_839, to: 194_417 };
const FULL = { at: 215_000, from: 205_394, to: 278_000 };

describe('Mestre Celestial — gravação de Zonnor, estados lunares', () => {
  it('imports the build from the recording, all three states of it', () => {
    expect(stateAt(NAKED.at).weapon).toBeFalsy();

    const weapon = stateAt(WEAPON.at);
    expect(weapon.weapon).toBe(540042); // Livro Malevolente
    expect(weapon.weaponRefine).toBe(8);
    expect(weapon.armor).toBeFalsy();

    const full = stateAt(FULL.at);
    expect(full.weapon).toBe(540042);
    expect(full.armor).toBe(450115); // Grácil Traje Lunar +9
    expect(full.shield).toBe(460014); // Escudo Ilusión B +9
    expect(full.garment).toBe(20940); // Espinho Violeta
    expect(full.headUpper).toBe(400097); // Protetor das Marés
    expect(full.shadowWeapon).toBe(24390); // Manopla Sombria Inicial
    // The six traits ride on ZC_COUPLESTATUS, so they come off the file, not off the card.
    expect([full.pow, full.sta, full.wis, full.spl, full.con, full.crt]).toEqual([100, 9, 10, 0, 30, 0]);
    expect([full.level, full.jobLevel]).toEqual([238, 50]);
  });

  it('offers the two state openers in the skill picker, at all five levels', () => {
    const skills: any[] = (new SkyEmperor() as any).atkSkills;
    for (const [name, value] of [['Rising Sun', 'Rising Sun'], ['Rising Moon', 'Rising Moon']]) {
      const s = skills.find((x) => x.name === name);
      expect(s, `${name} missing from the picker`).toBeDefined();
      expect(s.value).toBe(`${value}==5`);
      expect(s.levelList.map((l: any) => l.value)).toEqual([1, 2, 3, 4, 5].map((lv) => `${value}==${lv}`));
    }
  });

  it('walks the moon chain: Anoitecer sets Nascer da Lua, then Meia-Noite, then Pôr da Lua', () => {
    const on = stateEvents.filter((e: any) => e.isOn).map((e: any) => STATE[e.statusId]);
    expect(on.slice(0, 3)).toEqual(['NascerLua', 'MeiaNoite', 'PorDaLua']);
    // Never Elo Celestial — that is what makes the two enhanced branches measurable here.
    expect(replay.statusEvents.some((e: any) => e.statusId === 1392)).toBe(false);
  });

  /**
   * The naked window: no weapon, so no ATK roll and no size modifier. Every packet of a
   * given skill is the same integer, and each assertion below is an exact equation at
   * ATK 4.449 against soft DEF 50.
   */
  describe('sem equipamento algum — cada pacote é uma equação exata', () => {
    const CASES: [string, number, string, number, string | undefined, number][] = [
      // label, skill id, skill value, Espaço Celeste, required state, recorded packet
      ['Anoitecer Lv1 @Nascer da Lua', 5468, 'Rising Moon==1', MOONRISE, 'NascerLua', 135_776],
      ['Anoitecer Lv1 @Meia-Noite', 5468, 'Rising Moon==1', MIDNIGHT, 'MeiaNoite', 135_776],
      ['Anoitecer Lv1 @Pôr da Lua', 5468, 'Rising Moon==1', MOONSET, 'PorDaLua', 135_776],
      ['Chute Meia-Lua Lv5 @Meia-Noite', 5469, 'Midnight Kick==5', MIDNIGHT, 'MeiaNoite', 879_294],
      ['Alvorada Lv5 @Pôr da Lua', 5470, 'Dawn Break==5', MOONSET, 'PorDaLua', 434_572],
      ['Constelação Lv1', 5471, 'Twinkling Galaxy==1', 0, undefined, 101_874],
      ['Explosão Galática Lv5', 5473, 'Star Cannon==5', 0, undefined, 371_040],
    ];

    for (const [label, id, value, space, state, expected] of CASES) {
      it(`${label} → ${expected.toLocaleString('pt-BR')}`, () => {
        const got = packets(id, NAKED.from, NAKED.to, state);
        expect(got.length).toBeGreaterThan(0);
        // The recording itself must be a single value, or the equation is not exact.
        expect(new Set(got).size).toBe(1);
        expect(got[0]).toBe(expected);
        expect(sim(NAKED.at, value, space).max).toBe(expected);
      });
    }

    it('Firmamento Lv10 é crítico: 2.235.172 x 1,42 = 3.173.944', () => {
      const got = packets(5474, NAKED.from, NAKED.to);
      expect(got).toEqual([3_173_944]);

      const r = sim(NAKED.at, 'All in the Sky==10', 0);
      expect(r.canCri).toBe(true);
      // Formless dummy, so a single hit — the 3 hits are DemiHuman/Demon only.
      expect(r.hits).toBe(1);
      expect(r.noCriMax).toBe(2_235_172);
      expect(r.max).toBe(3_173_944);
    });

    it('Anoitecer não é crítico, e o dano não depende do estado lunar', () => {
      const all = replay.damage.filter((d: any) => d.source === ME && d.skillId === 5468);
      expect(all.length).toBe(28);
      expect([...new Set(all.map((d: any) => d.hitType))]).toEqual(['double']);
      expect(sim(NAKED.at, 'Rising Moon==1', MIDNIGHT).canCri).toBe(false);
      // Same number in all three states — the client gives Anoitecer a single table.
      expect(new Set(packets(5468, NAKED.from, NAKED.to)).size).toBe(1);
    });
  });

  /**
   * The two ratios Ted's Elo Celestial recording could not separate. Both branches show up
   * in this file, and the enhanced one is worth 1,32x the base.
   */
  describe('os dois ramos de Alvorada, medidos no mesmo arquivo', () => {
    it('Pôr da Lua usa a tabela reforçada, Meia-Noite usa a base', () => {
      const enhanced = sim(WEAPON.at, 'Dawn Break==5', MOONSET);
      const base = sim(WEAPON.at, 'Dawn Break==5', MIDNIGHT);
      expect(enhanced.ratio).toBe(9769);
      expect(base.ratio).toBe(7389);

      const recEnhanced = packets(5470, WEAPON.from, WEAPON.to, 'PorDaLua');
      const recBase = packets(5470, WEAPON.from, WEAPON.to, 'MeiaNoite');
      expect(recEnhanced.length).toBe(5);
      expect(recBase.length).toBe(5);
      // The recorded windows do not overlap, and sit on either side of the two tables.
      expect(recBase[recBase.length - 1]).toBeLessThan(recEnhanced[0]);
    });
  });

  /**
   * With a weapon on there is an ATK roll, so each skill spans a range instead of a point.
   * A range assertion only means something if the range is tight, hence the max/min guard:
   * a wrong ratio would still fit inside a loose one.
   */
  describe('com arma e com equipamento completo — cada pacote cai na faixa do simulador', () => {
    const CASES: [string, number, string, number, string | undefined][] = [
      ['Anoitecer Lv1 @Pôr da Lua', 5468, 'Rising Moon==1', MOONSET, 'PorDaLua'],
      ['Chute Meia-Lua Lv5 @Meia-Noite', 5469, 'Midnight Kick==5', MIDNIGHT, 'MeiaNoite'],
      ['Alvorada Lv5 @Pôr da Lua', 5470, 'Dawn Break==5', MOONSET, 'PorDaLua'],
      ['Explosão Galática Lv5', 5473, 'Star Cannon==5', 0, undefined],
    ];

    for (const [wLabel, w] of [['com arma', WEAPON], ['equipamento completo', FULL]] as const) {
      for (const [label, id, value, space, state] of CASES) {
        it(`${wLabel}: ${label}`, () => {
          const got = packets(id, w.from, w.to, state);
          expect(got.length).toBeGreaterThan(0);

          const r = sim(w.at, value, space);
          expect(r.max / r.min).toBeLessThan(1.12);
          expect(got[0]).toBeGreaterThanOrEqual(r.min);
          expect(got[got.length - 1]).toBeLessThanOrEqual(r.max);
        });
      }
    }

    it('com arma: Firmamento Lv10 crítico bate na unidade', () => {
      expect(packets(5474, WEAPON.from, WEAPON.to)).toEqual([6_133_932]);
      expect(sim(WEAPON.at, 'All in the Sky==10', 0).max).toBe(6_133_932);
    });

    it('equipamento completo: Firmamento Lv10 sem crítico cai na faixa', () => {
      const got = packets(5474, FULL.from, FULL.to);
      expect(got).toEqual([10_131_047]);

      const r = sim(FULL.at, 'All in the Sky==10', 0);
      expect(got[0]).toBeGreaterThanOrEqual(r.noCriMin);
      expect(got[0]).toBeLessThanOrEqual(r.noCriMax);
    });
  });

  /**
   * The ratios these packets pin down, asserted on their own so a table regression names
   * itself instead of surfacing as an unexplained damage diff. All seven reproduce the
   * client's own pt-BR description (`src/app/skills/skill-meta.generated.ts`).
   */
  describe('razões de habilidade, base 238 com POD 111 e Maestria Celestial 10', () => {
    const RATIOS: [string, string, number, number][] = [
      // Lv1 is the level the recording measures. The two openers happen to coincide there
      // (both base 1.283) and separate from Lv2 on, so Lv5 is asserted as well.
      ['Anoitecer Lv1', 'Rising Moon==1', 0, 3053],
      ['Anoitecer Lv5', 'Rising Moon==5', 0, 6385],
      ['Amanhecer Lv1', 'Rising Sun==1', 0, 3053],
      ['Amanhecer Lv5', 'Rising Sun==5', 0, 7337],
      ['Chute Meia-Lua Lv5 @Meia-Noite', 'Midnight Kick==5', MIDNIGHT, 19765],
      ['Chute Meia-Lua Lv5 fora do estado', 'Midnight Kick==5', MOONRISE, 15005],
      ['Alvorada Lv5 @Pôr da Lua', 'Dawn Break==5', MOONSET, 9769],
      ['Alvorada Lv5 fora do estado', 'Dawn Break==5', MIDNIGHT, 7389],
      ['Constelação Lv1', 'Twinkling Galaxy==1', 0, 2291],
      ['Explosão Galática Lv5', 'Star Cannon==5', 0, 8341],
      ['Firmamento Lv10', 'All in the Sky==10', 0, 50241],
    ];

    for (const [label, value, space, expected] of RATIOS) {
      it(`${label} → ${expected}%`, () => {
        expect(sim(NAKED.at, value, space).ratio).toBe(expected);
      });
    }
  });
});

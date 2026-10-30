import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Calculator } from 'src/app/core/calculator';
import { CalculatorController } from 'src/app/core/calculator-controller';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { PetLoyalty } from 'src/app/constants';
import { NightWatch } from 'src/app/jobs/NightWatch';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { loadReplayFixture } from './__tests__/load-fixture';
import { importReplayBuffer } from './replay-to-model';

/**
 * `nw-mira-pet.rrf` (shummuy's "Armas + Mira") checked **by damage**, with the whole
 * build imported from the replay itself — the opposite of `NightWatch.replay.spec.ts`,
 * which uses the gearless recording to isolate the skill percentages.
 *
 * The character goes through four weapons and fires five skills at Lv1, always with Mira
 * Focalizada active and the aiming count at 10 (the EFST 1346 ticks every 500 ms always
 * reach ten between one shot and the next).
 *
 * This set is what found the missing combo on the **Cesta de Mascotes (410599)**: the
 * pt-BR description grants "Dano físico a distância +10%" when the pet is Orc Herói,
 * Bafomé or Abelha-Rainha, and the script only had the unconditional "Dano físico e
 * mágico +5%". Without that line the simulator sat ~5% low on **all** eighteen packets,
 * with four of them overshooting the top of the range.
 */

const items = JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
const monsters = JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8'));
const hpSpTable = JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8'));

const DUMMY_MORTO_VIVO = '21076';
const CESTA_DE_MASCOTES = 410599;

/** The recording's weapons, in the order the equipment packets swap them. */
const ARMAS = {
  escopeta: { id: 820004, refine: 8, cards: [4115, 4115], nome: 'Retalhador Consertado +8' },
  metralhadora: { id: 830008, refine: 0, cards: [] as number[], nome: 'Aspersor Consertado +0' },
  lancaGranadas: { id: 840001, refine: 8, cards: [300241, 300240], nome: 'Lança-Granadas Primordial +8' },
  fuzil: { id: 810005, refine: 0, cards: [] as number[], nome: 'Atirador Consertado +0' },
  pistola: { id: 13115, refine: 7, cards: [] as number[], nome: 'Pistola Aprimorável +7' },
} as const;
type Arma = typeof ARMAS[keyof typeof ARMAS];

function simular(skillName: string, arma: Arma, opts: { pet?: number } = {}) {
  const { model, learnedSkills } = importReplayBuffer(loadReplayFixture('nw-mira-pet.rrf'), items);
  const m: any = model;
  m.class = 4306;
  // Traits do not travel in the replay; these are the ones shummuy confirmed.
  m.pow = 100; m.sta = 0; m.wis = 0; m.spl = 0; m.con = 62; m.crt = 0;
  m.petLoyalty = PetLoyalty.Normal;
  if (opts.pet !== undefined) m.pet = opts.pet;
  m.weapon = arma.id; m.weaponRefine = arma.refine;
  m.weaponCard1 = arma.cards[0] ?? 0; m.weaponCard2 = arma.cards[1] ?? 0;

  const cls = new NightWatch();
  const b = cls.getJobBonusStatus(m.jobLevel);
  Object.assign(m, {
    jobStr: b.str, jobAgi: b.agi, jobVit: b.vit, jobInt: b.int, jobDex: b.dex, jobLuk: b.luk,
    jobPow: b.pow, jobSta: b.sta, jobWis: b.wis, jobSpl: b.spl, jobCon: b.con, jobCrt: b.crt,
  });
  const skillValue = `${skillName}==1`;
  m.selectedAtkSkill = skillValue;

  const passiveIds = cls.passiveSkills.map((s) => {
    const id = SKILL_ID_BY_NAME[s.name];
    return id ? learnedSkills[id] ?? 0 : 0;
  });
  // Mira Focalizada ligada e contagem de mira cheia, como na gravação inteira.
  const activeIds = cls.activeSkills.map((s) =>
    s.name === 'Intensive Aim' ? 1 : s.name === '_NightWatch_Aiming Count' ? 10 : 0);
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = cls
    .setLearnSkills({ activeSkillIds: activeIds, passiveSkillIds: passiveIds })
    .getSkillBonusAndName();

  const calc = new Calculator().setMasterItems(items).setHpSpTable(hpSpTable).setClass(cls);
  // Recorded before the 28/10/2026 client, so these packets measure the pre-rebalance formulas.
  m.skillFormulaVersion = 'pre-rebalance';
  calc.loadItemFromModel(m);
  new CalculatorController().runChain(calc, {
    monster: monsters[DUMMY_MORTO_VIVO], equipAtks, masteryAtks, buffEquips: {}, buffMasterys: {},
    consumeData: [], aspdPotion: undefined,
    extraOptionScripts: parseOptionScripts((m.rawOptionTxts ?? []).filter(Boolean)),
    activeSkillNames, learnedSkillMap, selectedAtkSkill: skillValue, selectedChances: [], usedHpL: false,
  } as any);

  const s = (calc as any).damageSummary;
  const podeCritar = !!s.skillCanCri;
  return {
    golpes: s.skillTotalHit as number,
    podeCritar,
    min: (podeCritar ? s.skillMinDamageNoCri : s.skillMinDamage) as number,
    max: (podeCritar ? s.skillMaxDamageNoCri : s.skillMaxDamage) as number,
    critico: (podeCritar ? s.skillMaxDamage : 0) as number,
    bonus: (calc as any).totalEquipStatus as Record<string, number>,
  };
}

/**
 * The Cesta de Mascotes combo is the only case in item.json where the `EQUIP_ID` partner
 * is the **pet** — it enters `equipItem` like any other piece, so the condition works the
 * same. The deltas below are against the same build with no pet at all, and therefore
 * include whatever the egg itself grants (Bafomé, for instance, already brings "Dano
 * físico a distância +5%" on its own, hence 15 instead of 10).
 */
describe('Cesta de Mascotes — the combo changes with the pet family', () => {
  const semMascote = () => simular('The Vigilante at Night', ARMAS.metralhadora, { pet: 0 }).bonus;

  it.each([
    { nome: 'Orc Herói', pet: 9121, chave: 'range', delta: 10 },
    { nome: 'Abelha-Rainha', pet: 9193, chave: 'range', delta: 10 },
    { nome: 'Freeoni', pet: 9111, chave: 'melee', delta: 10 },
    { nome: 'Flor do Luar', pet: 9112, chave: 'melee', delta: 10 },
    { nome: 'Pesar Noturno', pet: 9122, chave: 'm_my_element_all', delta: 10 },
    { nome: 'Senhor das Trevas', pet: 9148, chave: 'm_my_element_all', delta: 10 },
    // Added to item.json along with the other missing eggs; its own lines are
    // matkPercent and the Neutro/Sagrado boost, so the delta here is the combo's alone.
    { nome: 'Vigia do Tempo', pet: 9171, chave: 'm_my_element_all', delta: 10 },
  ])('$nome: $chave +$delta', ({ pet, chave, delta }) => {
    const base = semMascote();
    const com = simular('The Vigilante at Night', ARMAS.metralhadora, { pet }).bonus;
    expect(com[chave] - base[chave]).toBe(delta);
  });

  it.each([
    { nome: 'Patinho', pet: 9125 },
    { nome: 'Pouring', pet: 9114 },
    { nome: 'Quinding', pet: 9109 },
    { nome: 'Esqueleão', pet: 9113 },
  ])('gives after-cast and variable cast -5% for $nome, of the casting family', ({ pet }) => {
    const base = semMascote();
    const com = simular('The Vigilante at Night', ARMAS.metralhadora, { pet }).bonus;
    expect(com['acd'] - base['acd']).toBe(5);
    expect(com['vct'] - base['vct']).toBe(5);
  });

  it('keeps the families apart — Orc Herói grants neither melee nor magic damage', () => {
    const base = semMascote();
    const com = simular('The Vigilante at Night', ARMAS.metralhadora, { pet: 9121 }).bonus;
    expect(com['melee'] - base['melee']).toBe(0);
    expect(com['m_my_element_all'] - base['m_my_element_all']).toBe(0);
    expect(com['acd'] - base['acd']).toBe(0);
  });

  /**
   * Four of the pets the description names had no item.json record and were left out of
   * the conditions while they could not be equipped: 9109 Quinding, 9113 Esqueleão, 9114
   * Pouring and 9171 Vigia do Tempo. They were added to the DB, so the combo grew with
   * them — all fifteen pets the description lists are now named.
   */
  it('names every pet its description lists, and all of them exist in item.json', () => {
    const script = items[CESTA_DE_MASCOTES].script;
    const ids = JSON.stringify(script).match(/\d{4,}/g)!.map(Number);
    expect(ids.filter((id) => !items[String(id)])).toEqual([]);
    expect([9109, 9113, 9114, 9171].filter((id) => !ids.includes(id))).toEqual([]);
    expect(new Set(ids).size).toBe(15);
  });
});

/**
 * The recording's eighteen 0x01de packets. `dano` is the packet total; `golpesPacote` is
 * the `count` it carries, which is **not** always the logical hit count — Tiroteio arrives
 * with 3 (the engine models that as `hit: 3`, three display hits for one damage hit). That
 * is why the division uses the simulator's `skillTotalHit`, and a separate test checks
 * that the two agree where they should.
 */
const PACOTES: { ms: number; skill: string; arma: Arma; dano: number; golpesPacote: number; critico?: boolean }[] = [
  { ms: 1912, skill: 'The Vigilante at Night', arma: ARMAS.escopeta, dano: 8883184, golpesPacote: 4 },
  { ms: 9497, skill: 'Wild Fire', arma: ARMAS.escopeta, dano: 3426240, golpesPacote: 3 },
  { ms: 14530, skill: 'The Vigilante at Night', arma: ARMAS.metralhadora, dano: 4061666, golpesPacote: 7 },
  { ms: 19697, skill: 'Magazine for One', arma: ARMAS.metralhadora, dano: 4688600, golpesPacote: 10 },
  { ms: 26129, skill: 'Spiral Shooting', arma: ARMAS.lancaGranadas, dano: 4287206, golpesPacote: 2 },
  { ms: 31047, skill: 'Wild Fire', arma: ARMAS.lancaGranadas, dano: 3812133, golpesPacote: 3 },
  { ms: 36779, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 42580, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 47513, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 52430, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 57529, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 62430, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, golpesPacote: 1, critico: true },
  { ms: 67563, skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 1655573, golpesPacote: 1 },
  { ms: 72546, skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 1281588, golpesPacote: 1 },
  { ms: 77629, skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 1954171, golpesPacote: 1, critico: true },
  { ms: 84413, skill: 'Only One Bullet', arma: ARMAS.pistola, dano: 1802761, golpesPacote: 1 },
  { ms: 89748, skill: 'Magazine for One', arma: ARMAS.pistola, dano: 3674718, golpesPacote: 6, critico: true },
  { ms: 95146, skill: 'Magazine for One', arma: ARMAS.pistola, dano: 2409960, golpesPacote: 6 },
];

/**
 * **A 0.5% tolerance, and it still measures a real gap.** With the Cesta combo in place
 * the eight criticals — deterministic, since a critical uses the weapon's **maximum** ATK
 * — sit 0.38% (rifle) to 0.48% (revolver) above the simulator, and three non-critical
 * packets overshoot the ceiling by 0.12% to 0.36%. That is the residual left after the
 * combo and it still has no explanation; two of the build's cards remain outside item.json
 * (310991 "MHP 2Lv" and 29013 "Absorção de HP 3"), but both are HP only.
 */
const FOLGA = 1.005;

describe('damage from the Armas + Mira recording', () => {
  it.each(PACOTES.filter((p) => !p.critico))(
    '$skill @$ms ($arma.nome): $dano falls in the simulator range',
    ({ skill, arma, dano }) => {
      const r = simular(skill, arma);
      const porGolpe = dano / r.golpes;
      expect(Number.isInteger(porGolpe), `${dano} does not divide by ${r.golpes}`).toBe(true);
      expect(porGolpe).toBeGreaterThanOrEqual(r.min);
      expect(porGolpe).toBeLessThanOrEqual(Math.floor(r.max * FOLGA));
    },
  );

  it.each(PACOTES.filter((p) => p.critico))(
    '$skill @$ms ($arma.nome): the critical $dano matches the deterministic maximum',
    ({ skill, arma, dano }) => {
      const r = simular(skill, arma);
      expect(r.podeCritar).toBe(true);
      const porGolpe = dano / r.golpes;
      expect(porGolpe).toBeGreaterThanOrEqual(r.critico);
      expect(porGolpe).toBeLessThanOrEqual(Math.floor(r.critico * FOLGA));
    },
  );

  // Without this guard the test above would pass with too wide a range.
  it('keeps the range tight — the spread is the weapon ATK\'s, not a wide margin', () => {
    for (const { skill, arma } of PACOTES) {
      const r = simular(skill, arma);
      expect(r.max / r.min, `${skill} ${arma.nome}`).toBeLessThan(1.12);
    }
  });

  it('treats the packet count as the hit count, except on Tiroteio (3 shown, 1 of damage)', () => {
    for (const p of PACOTES) {
      const esperado = p.skill === 'Wild Fire' ? 1 : p.golpesPacote;
      expect(simular(p.skill, p.arma).golpes, `${p.skill} @${p.ms}`).toBe(esperado);
    }
  });
});

/**
 * The size of the remaining residual, pinned on purpose: if anyone finds what is missing,
 * this test breaks, and that is the signal that the tolerance above can shrink.
 */
describe('open residual', () => {
  it.each([
    { skill: 'Only One Bullet', arma: ARMAS.fuzil, dano: 2628657, razao: 1.0038 },
    { skill: 'Spiral Shooting', arma: ARMAS.fuzil, dano: 1954171, razao: 1.0038 },
    { skill: 'Magazine for One', arma: ARMAS.pistola, dano: 3674718 / 6, razao: 1.0048 },
  ])('$skill: the recorded critical is $razao× the simulated one', ({ skill, arma, dano, razao }) => {
    expect(dano / simular(skill, arma).critico).toBeCloseTo(razao, 4);
  });
});

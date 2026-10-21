/**
 * Motor exato com o simulador real, em escopos pequenos, contra uma força bruta escrita à parte
 * (produto cartesiano das configurações de cada slot, validado no fim).
 */

import { describe, expect, it } from 'vitest';
import { SLOTS_BY_KEY } from 'src/app/app-config/equipment-slots';
import { ItemTypeEnum, MainItemWithRelations } from 'src/app/constants/item-type.enum';
import { MainModel } from 'src/app/models/main.model';
import { canGradeItem } from 'src/app/utils/can-grade';
import { attachmentsFor, buildCardCatalog, buildEnchantMap } from '../attachments';
import { buildCatalog, clearSlot, Grade, OptimizableSlot, placeItem, PlacementOptions, WeaponRulesProbe } from '../candidates';
import { limitViolations } from '../enchant-limits';
import { BuildEvaluator, stableKey } from '../evaluate';
import { isBetter, Score, scoreOf } from '../objective';
import { prepareSession } from '../runtime';
import { appShapedData } from '../__tests__/app-data';
import { MAGAZINE_FOR_ONE, nightWatchModel } from '../__tests__/nightwatch-build';
import { exactSearch, ExactSearch } from './engine';
import { ExactCheckpoint, optimizeExact } from './optimize';
import { RoBuildProblem, RoProblemOptions, scoreCompare } from './ro-problem';

const data = appShapedData();
const session = prepareSession(data, { preset: JSON.parse(JSON.stringify(nightWatchModel())), monsterId: 1832, skillValue: MAGAZINE_FOR_ONE });
const { context } = session;
const items = context.items;
const evaluator = new BuildEvaluator(context);
const probe = new WeaponRulesProbe(items, context.character);
const enchantMap = buildEnchantMap(items);
const get = (model: MainModel, key: string) => (model as Record<string, any>)[key];

const ILLUSION_ARMOR = 15376; // limites ×3/×2/×1 cadastrados
const EXCELION_SUIT = 15128;
const ARCHANGEL_WING = 2573;
const CLIP = 2607; // Presilha [1]
const RING = 2601;

/** Força bruta: todas as configurações de cada slot, combinadas, aplicadas em ordem e validadas no fim. */
function bruteForce(base: MainModel, slots: OptimizableSlot[], options: RoProblemOptions & { allowed: Set<number> }) {
  const catalog = buildCatalog(items, context.character, { maxRequiredLevel: base.level, ...options.catalog });
  const cards = buildCardCatalog(items, options.catalog);
  type Config = { id?: number; refine?: number; grade?: Grade; fields: Record<string, number | undefined>; original?: boolean };
  const configsOf = (slot: OptimizableSlot): Config[] => {
    const list: Config[] = [{ fields: {} }];
    if (get(base, slot)) list.push({ original: true, fields: {} });
    for (const id of catalog[slot] ?? []) {
      const levels: { refine?: number; grade?: Grade }[] = [];
      if (options.refineDomain === 'all') {
        const rule = SLOTS_BY_KEY.get(slot)?.refine ?? 'none';
        const max = rule === 'none' || (rule === 'accessory' && !items[id].isRefinable) ? 0 : options.placement?.defaultRefine?.[rule as 'equip'] ?? 0;
        const gradeable = SLOTS_BY_KEY.get(slot)?.grade && (items[id].canGrade || canGradeItem(items[id]));
        const grades: Grade[] = gradeable ? (['', 'D', 'C', 'B', 'A'] as Grade[]).slice(0, ['', 'D', 'C', 'B', 'A'].indexOf(options.placement?.defaultGrade ?? 'A') + 1) : [''];
        for (let refine = 0; refine <= max; refine++) for (const grade of grades) levels.push({ refine, grade });
      } else levels.push({});
      for (const level of levels) {
        const placed = placeItem(clearedBase(base, slots), slot, id, items, probe, level.refine === undefined ? options.placement : { refine: { [slot]: level.refine }, defaultGrade: level.grade ?? '' });
        const { cardFields, enchants } = attachmentsFor(placed, slot, items, enchantMap, options.catalog);
        const fieldDomains: [string, (number | undefined)[]][] = [
          ...cardFields.map((field) => [field, [undefined, ...(cards[slot] ?? [])]] as [string, (number | undefined)[]]),
          ...enchants.map(({ field, ids }) => [field, [undefined, ...ids]] as [string, (number | undefined)[]]),
        ];
        let combos: Record<string, number | undefined>[] = [{}];
        for (const [field, values] of fieldDomains) combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [field]: value })));
        for (const fields of combos) list.push({ id, ...level, fields });
      }
    }
    return list;
  };
  const perSlot = slots.map(configsOf);
  const results: { model: MainModel; score: Score }[] = [];
  const walk = (index: number, model: MainModel, chosen: Config[]) => {
    if (index === slots.length) {
      // Validação independente: cada slot com o item pedido, limites de encantamento respeitados.
      const ok = slots.every((slot, i) => (chosen[i].original ? get(base, slot) : chosen[i].id) === get(model, slot))
        && slots.every((slot) => {
          const enchants = (MainItemWithRelations[slot as ItemTypeEnum] ?? []).filter((field) => /Enchant\d$/.test(field)).map((field) => get(model, field)).filter(Boolean);
          return limitViolations(get(model, slot), enchants).length === 0;
        });
      if (ok) results.push({ model, score: scoreOf(evaluator.evaluate(model), options.objective ?? 'dps', options.constraints) });
      return;
    }
    const slot = slots[index];
    for (const config of perSlot[index]) {
      let next: MainModel;
      if (config.original) {
        next = placeItem(model, slot, get(base, slot), items, probe);
        for (const key of [slot, ...(MainItemWithRelations[slot as ItemTypeEnum] ?? []), `${slot}Refine`, `${slot}Grade`]) (next as any)[key] = get(base, key);
      } else {
        next = placeItem(model, slot, config.id, items, probe, config.refine === undefined ? options.placement : { refine: { [slot]: config.refine }, defaultGrade: config.grade ?? '' });
        next = { ...next, ...config.fields } as MainModel;
      }
      walk(index + 1, next, [...chosen, config]);
    }
  };
  walk(0, clearedBase(base, slots), []);
  const best = results.reduce<{ model: MainModel; score: Score } | undefined>((acc, entry) => (!acc || isBetter(entry.score, acc.score) ? entry : acc), undefined)!;
  const optimal = results.filter((entry) => scoreCompare(entry.score, best.score) === 0);
  return { results, best, optimalKeys: new Set(optimal.map((entry) => canonical(entry.model))) };
}

function clearedBase(base: MainModel, slots: OptimizableSlot[]) {
  const model = { ...base } as MainModel;
  for (const slot of slots) clearSlot(model, slot as ItemTypeEnum);
  return model;
}

/** Chave sem campos vazios (a força bruta e o motor podem deixar `undefined` em lugares diferentes). */
const canonical = (model: MainModel) => stableKey(Object.fromEntries(Object.entries(model).filter(([, value]) => value !== undefined && value !== null && value !== '')));

function scenario(slots: OptimizableSlot[], allowed: number[], extra: Partial<RoProblemOptions> = {}) {
  const allowedSet = new Set(allowed);
  const options: RoProblemOptions & { allowed: Set<number> } = {
    objective: 'dps', slots, catalog: { allowedItemIds: allowedSet }, placement: { defaultRefine: { equip: 0, accessory: 0, shadow: 0 } },
    allowed: allowedSet, ...extra,
  };
  return { options, base: session.model };
}

/** Duas cartas de cada posição e alguns encantamentos dos itens do escopo. */
function smallInventory() {
  const cards = buildCardCatalog(items);
  const pick = (slot: OptimizableSlot, count: number) => (cards[slot] ?? []).slice(0, count);
  const enchantsOf = (slot: OptimizableSlot, id: number, count: number) => {
    const placed = placeItem(clearedBase(session.model, [slot]), slot, id, items, probe, {});
    return [...new Set(attachmentsFor(placed, slot, items, enchantMap).enchants.flatMap((entry) => entry.ids.slice(0, count)))];
  };
  return [
    ILLUSION_ARMOR, EXCELION_SUIT, ARCHANGEL_WING, CLIP, RING,
    ...pick(ItemTypeEnum.armor, 1), ...pick(ItemTypeEnum.garment, 1), ...pick(ItemTypeEnum.accLeft, 1),
    ...enchantsOf(ItemTypeEnum.armor, ILLUSION_ARMOR, 2), ...enchantsOf(ItemTypeEnum.armor, EXCELION_SUIT, 2),
    ...enchantsOf(ItemTypeEnum.garment, ARCHANGEL_WING, 2), ...enchantsOf(ItemTypeEnum.accLeft, CLIP, 2),
  ];
}

describe('RoBuildProblem × força bruta (simulador real)', () => {
  const slots = [ItemTypeEnum.armor, ItemTypeEnum.garment, ItemTypeEnum.accLeft] as OptimizableSlot[];
  const { options, base } = scenario(slots, smallInventory());
  const oracle = bruteForce(base, slots, options);

  it('cartas, encantamentos (com limite cadastrado) e itens: mesmo ótimo, nenhuma build perdida', () => {
    expect(oracle.results.length).toBeGreaterThan(100);
    const problem = new RoBuildProblem(evaluator, context, base, options);
    const seen = new Set<string>();
    const result = new ExactSearch(problem, { mode: 'enumerate', onLeaf: (state) => seen.add(canonical(state.model)) }).run();
    expect(result.status).toBe('COMPLETE');
    // O motor visita exatamente as builds válidas da força bruta.
    expect(seen).toEqual(new Set(oracle.results.map((entry) => canonical(entry.model))));

    const best = exactSearch(problem);
    expect(best.status).toBe('OPTIMAL');
    expect(scoreCompare(best.best!.score, oracle.best.score)).toBe(0);
    expect(oracle.optimalKeys.has(canonical(best.best!.states[0].model))).toBe(true);
  }, 120_000);

  it('limites de encantamento podam (Ilusión ×1 nos lendários etc.) e as builds podadas são de fato inválidas', () => {
    const problem = new RoBuildProblem(evaluator, context, base, options);
    const result = exactSearch(problem, { mode: 'enumerate' });
    expect(result.stats.pruned.enchantLimit ?? 0).toBeGreaterThanOrEqual(0);
    expect(result.stats.leaves).toBe(oracle.results.length);
  }, 120_000);

  it('modo allTies devolve exatamente as builds empatadas da força bruta', () => {
    const result = exactSearch(new RoBuildProblem(evaluator, context, base, options), { mode: 'allTies' });
    expect(new Set(result.best!.states.map((state) => canonical(state.model)))).toEqual(oracle.optimalKeys);
  }, 120_000);

  it('a ordem (MRV × fixa, com e sem triagem) não muda o ótimo', () => {
    for (const extra of [{ slotOrder: 'fixed' as const }, { screen: false }, { slotOrder: 'fixed' as const, screen: false }]) {
      const result = exactSearch(new RoBuildProblem(evaluator, context, base, { ...options, ...extra }));
      expect(scoreCompare(result.best!.score, oracle.best.score)).toBe(0);
    }
  }, 120_000);
});

describe('RoBuildProblem — refino, grau, visuais, travas', () => {
  it('refineDomain "all": todos os níveis de refino e grau até o limite', () => {
    const slots = [ItemTypeEnum.garment, ItemTypeEnum.accLeft] as OptimizableSlot[];
    const placement: PlacementOptions = { defaultRefine: { equip: 4, accessory: 4, shadow: 0 }, defaultGrade: 'B' };
    const { options, base } = scenario(slots, [ARCHANGEL_WING, CLIP, RING], { refineDomain: 'all', placement, optimizeCards: false, optimizeEnchants: false });
    const oracle = bruteForce(base, slots, options);
    const problem = new RoBuildProblem(evaluator, context, base, options);
    const enumerated = exactSearch(problem, { mode: 'enumerate' });
    expect(enumerated.stats.leaves).toBe(oracle.results.length);
    const best = exactSearch(problem);
    expect(scoreCompare(best.best!.score, oracle.best.score)).toBe(0);
    // Há builds com refinos diferentes no espaço.
    const refines = new Set(oracle.results.map((entry) => get(entry.model, 'garmentRefine')));
    expect(refines.size).toBeGreaterThan(1);
  }, 120_000);

  it('encantamentos de visual com combinação EQUIP_ID (ATQ +1% Topo + Meio + Baixo)', () => {
    const slots = [ItemTypeEnum.costumeEnchantUpper, ItemTypeEnum.costumeEnchantMiddle, ItemTypeEnum.costumeEnchantLower] as OptimizableSlot[];
    const catalog = buildCatalog(items, context.character, { maxRequiredLevel: 240 });
    const wanted = [6943, 4882, 6642, 25016, 29029, 25304, 25008, 25010];
    const allowed = wanted.filter((id) => slots.some((slot) => catalog[slot]?.includes(id)));
    const { options, base } = scenario(slots, allowed);
    const oracle = bruteForce(base, slots, options);
    const result = exactSearch(new RoBuildProblem(evaluator, context, base, options), { mode: 'allTies' });
    expect(result.stats.leaves).toBe(oracle.results.length);
    expect(scoreCompare(result.best!.score, oracle.best.score)).toBe(0);
    expect(new Set(result.best!.states.map((state) => canonical(state.model)))).toEqual(oracle.optimalKeys);
  }, 120_000);

  it('slot travado nunca muda; o original sempre está no espaço (resultado ≥ build de entrada)', async () => {
    const model = { ...session.model, garment: ARCHANGEL_WING, garmentRefine: 7, accLeft: RING } as MainModel;
    const result = await optimizeExact(evaluator, context, model, {
      objective: 'dps', slots: [ItemTypeEnum.garment, ItemTypeEnum.accLeft, ItemTypeEnum.weapon] as OptimizableSlot[],
      lockedSlots: [ItemTypeEnum.weapon] as OptimizableSlot[], catalog: { allowedItemIds: new Set([CLIP, RING, ARCHANGEL_WING]) },
      seedTimeMs: 0, optimizeCards: false, optimizeEnchants: false,
    });
    expect(result.status).toBe('OPTIMAL');
    expect(result.model.weapon).toBe(model.weapon);
    expect(result.model.weaponRefine).toBe(model.weaponRefine);
    expect(isBetter(result.scoreBefore, result.score)).toBe(false);
  }, 120_000);
});

describe('optimizeExact — semente, status e checkpoint', () => {
  const slots = [ItemTypeEnum.garment, ItemTypeEnum.accLeft, ItemTypeEnum.accRight] as OptimizableSlot[];
  const allowed = new Set([ARCHANGEL_WING, CLIP, RING, ...buildCardCatalog(items).accLeft!.slice(0, 2)]);
  const base = { objective: 'dps' as const, slots, catalog: { allowedItemIds: allowed }, optimizeEnchants: false };

  it('com a semente heurística: OPTIMAL e nunca pior que a semente', async () => {
    const result = await optimizeExact(evaluator, context, session.model, { ...base, seedTimeMs: 3_000 });
    expect(result.status).toBe('OPTIMAL');
    expect(isBetter(result.seedScore, result.score)).toBe(false);
    expect(result.stats.progress).toBe(1);
    expect(result.spaceLog10).toBeGreaterThan(0);
    const plain = await optimizeExact(evaluator, context, session.model, { ...base, seedTimeMs: 0 });
    expect(scoreCompare(plain.score, result.score)).toBe(0);
  }, 120_000);

  it('interromper e retomar dá o mesmo resultado, com as mesmas builds avaliadas', async () => {
    const full = await optimizeExact(evaluator, context, session.model, { ...base, seedTimeMs: 0 });
    let checkpoint: ExactCheckpoint | undefined;
    let runs = 0;
    let last;
    do {
      runs++;
      last = await optimizeExact(evaluator, context, session.model, {
        ...base, seedTimeMs: 0, resume: checkpoint, maxLeaves: (checkpoint?.search.stats.leaves ?? 0) + 7,
      });
      if (last.status === 'INTERRUPTED') checkpoint = JSON.parse(JSON.stringify(last.checkpoint));
    } while (last.status === 'INTERRUPTED');
    expect(runs).toBeGreaterThan(2);
    expect(last.status).toBe('OPTIMAL');
    expect(scoreCompare(last.score, full.score)).toBe(0);
    expect(last.stats.leaves).toBe(full.stats.leaves);
  }, 120_000);

  it('checkpoint de outra build/opções é recusado', async () => {
    const interrupted = await optimizeExact(evaluator, context, session.model, { ...base, seedTimeMs: 0, maxLeaves: 5 });
    expect(interrupted.status).toBe('INTERRUPTED');
    await expect(optimizeExact(evaluator, context, session.model, { ...base, objective: 'avg', seedTimeMs: 0, resume: interrupted.checkpoint }))
      .rejects.toThrow(/checkpoint/i);
  }, 120_000);

  it('ajuste de atributos é informado à parte e não altera o resultado exato', async () => {
    const result = await optimizeExact(evaluator, context, session.model, { ...base, seedTimeMs: 0, postOptimizeStats: true });
    expect(result.status).toBe('OPTIMAL');
    expect(result.statChanges).toEqual([]);
    expect(result.statsAdjusted).toBeDefined();
    expect(isBetter(result.score, result.statsAdjusted!.score)).toBe(false);
  }, 120_000);
});

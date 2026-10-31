/**
 * Efeitos de ativação ("chances" da aba Efeitos) no otimizador.
 *
 * - `always` (objetivo dano máximo): todos os efeitos que a skill pode ativar ficam ligados.
 * - `expected` (DPS, médio, mínimo): valor esperado. Cada efeito fica ativo uma fração do tempo,
 *   1 − (1 − chance)^(tentativas/s × duração), e a métrica é a média das combinações de efeitos
 *   ligados, pesadas pela probabilidade de cada uma (efeitos independentes).
 * - `off`: como antes, nenhum efeito.
 *
 * Tentativas: a cada golpe para gatilhos de ataque (físico, mágico ou os dois), a cada uso para
 * gatilho de skill. Efeitos sem gatilho explícito na descrição não entram (ver
 * tools/build-chance-effects.mjs). Os de `autoCastEffect` usam os dados estruturados do item.
 */

import { Calculator } from 'src/app/core/calculator';
import { ItemModel, itemAutoCastEffectScripts } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { SKILL_META } from 'src/app/skills/skill-meta.generated';
import { CHANCE_EFFECTS, ChanceTrigger } from './data/chance-effects';

export type ChanceEffectMode = 'off' | 'always' | 'expected';

/** Até quantos efeitos a média é exata (2^N recálculos); acima disso, soma dos ganhos de cada um. */
const EXACT_LIMIT = 4;

export interface ActiveEffect {
  name: string;
  /** Chance por tentativa, 0–1. */
  chance: number;
  duration: number;
  trigger: ChanceTrigger;
  /** Gatilho `skill`: nome pt-BR ou id da skill. */
  skill?: string | number;
}

const META = SKILL_META as Record<string, { id?: number; label?: string }>;

/** Refino do slot onde o item está equipado (0 se não achar). */
function refineOf(model: MainModel, itemId: number): number {
  const record = model as Record<string, any>;
  for (const [key, value] of Object.entries(record)) {
    if (value === itemId && typeof record[`${key}Refine`] === 'number') return record[`${key}Refine`];
  }
  return 0;
}

/** Os efeitos da lista do motor que têm chance, duração e gatilho conhecidos. */
export function effectsOf(calc: Calculator, model: MainModel, items: Record<number, ItemModel>): ActiveEffect[] {
  const effects: ActiveEffect[] = [];
  for (const entry of calc.chanceList as { name: string; itemId?: number }[]) {
    const item = entry.itemId != null ? items[entry.itemId] : undefined;
    if (!item) continue;
    const structured = itemAutoCastEffectScripts(item.script).find((effect) => effect.name === entry.name);
    if (structured) {
      const refine = refineOf(model, item.id);
      const shieldRefine = Number(model.shieldRefine) || 0;
      const duration = structured.durationSeconds
        + (structured.durationPerShieldRefineEvery ? Math.floor(shieldRefine / structured.durationPerShieldRefineEvery) : 0);
      const chance = (structured.chance + refine * (structured.chancePerRefine ?? 0)) / 100;
      effects.push(structured.activationSkillId
        ? { name: entry.name, chance, duration, trigger: 'skill', skill: structured.activationSkillId }
        : { name: entry.name, chance, duration, trigger: structured.trigger === 'physical-or-magical' ? 'any' : 'physical' });
      continue;
    }
    const known = CHANCE_EFFECTS[item.id];
    if (known && entry.name === item.name) {
      effects.push({ name: entry.name, chance: known.chance / 100, duration: known.duration, trigger: known.trigger, skill: known.skill });
    }
  }
  return effects;
}

/** O efeito pode ser ativado pela skill avaliada? */
export function triggeredBy(effect: ActiveEffect, skillName: string, magical: boolean): boolean {
  switch (effect.trigger) {
    case 'any': return true;
    case 'physical': return !magical;
    case 'magical': return magical;
    case 'skill': {
      const meta = META[skillName];
      if (typeof effect.skill === 'number') return meta?.id === effect.skill;
      return !!effect.skill && effect.skill.toLowerCase() === (meta?.label ?? skillName).toLowerCase();
    }
  }
}

/** Fração do tempo com o efeito ativo: 1 − (1 − p)^(tentativas/s × duração). */
export function uptimeOf(effect: ActiveEffect, hitsPerSec: number, castPeriod: number): number {
  const attempts = effect.trigger === 'skill' ? (castPeriod > 0 ? 1 / castPeriod : 0) : hitsPerSec;
  if (!(attempts > 0) || !(effect.chance > 0)) return 0;
  if (effect.chance >= 1) return 1;
  return 1 - Math.pow(1 - effect.chance, attempts * effect.duration);
}

/** As métricas de dano que o efeito altera. */
export interface DamageFigures { damageMin: number; damageMax: number; damageAvg: number; dps: number }

const KEYS: (keyof DamageFigures)[] = ['damageMin', 'damageMax', 'damageAvg', 'dps'];

/**
 * Combina as figuras de dano por efeito. `measure(names)` liga os efeitos `names` no motor e
 * devolve as figuras; `base` é a build sem efeitos.
 */
export function combineEffects(
  mode: Exclude<ChanceEffectMode, 'off'>, effects: { name: string; uptime: number }[], base: DamageFigures,
  measure: (names: string[]) => DamageFigures,
): DamageFigures {
  if (!effects.length) return base;
  if (mode === 'always') return measure(effects.map((effect) => effect.name));
  const live = effects.filter((effect) => effect.uptime > 0);
  if (!live.length) return base;
  const total: DamageFigures = { damageMin: 0, damageMax: 0, damageAvg: 0, dps: 0 };
  if (live.length <= EXACT_LIMIT) {
    for (let mask = 0; mask < 1 << live.length; mask++) {
      let weight = 1;
      const names: string[] = [];
      live.forEach((effect, index) => {
        const on = (mask >> index) & 1;
        weight *= on ? effect.uptime : 1 - effect.uptime;
        if (on) names.push(effect.name);
      });
      if (weight === 0) continue;
      const figures = mask === 0 ? base : measure(names);
      for (const key of KEYS) total[key] += weight * figures[key];
    }
    return total;
  }
  // Muitos efeitos: base + Σ tempo ativo × ganho do efeito sozinho.
  Object.assign(total, base);
  for (const effect of live) {
    const alone = measure([effect.name]);
    for (const key of KEYS) total[key] += effect.uptime * (alone[key] - base[key]);
  }
  return total;
}

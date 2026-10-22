/**
 * Função de avaliação do otimizador: MainModel → métricas da skill-alvo.
 *
 * Monta o `CalcChainInput` a partir do próprio modelo exatamente como a sessão faz
 * (`CalculatorSession.buildProfileFromPreset`, o caminho "solver um build salvo"), para que
 * o otimizador só precise alterar o modelo — itens, refinos, atributos — e o resultado
 * continue idêntico ao que o simulador mostra.
 *
 * Um único `Calculator` é reaproveitado entre avaliações (como a sessão faz com os seus);
 * `solveSkill` re-semeia as fontes de bônus a cada passagem, e o spec deste arquivo
 * verifica que avaliações intercaladas não vazam estado de uma para a outra.
 */

import { JobBuffs } from 'src/app/constants/job-buffs';
import {
  applyGuaranaCandy, BuffDef, CalcChainInput, CalculatorController, collectBuffBonuses, collectConsumables,
  withoutWeaponlessTalismans,
} from 'src/app/core/calculator-controller';
import { Calculator } from 'src/app/core/calculator';
import { customOptionScripts } from 'src/app/core/custom-attachments';
import { parseOptionScripts } from 'src/app/core/option-scripts';
import { PlayerTargetProfile, PvpMode } from 'src/app/core/pvp';
import { CharacterBase } from 'src/app/jobs';
import { HpSpTable } from 'src/app/models/hp-sp-table.model';
import { ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { MonsterModel } from 'src/app/models/monster.model';
import { SKILL_ID_BY_NAME } from 'src/app/skills';
import { toRawOptionTxtList } from 'src/app/utils/to-raw-option-txt-list';

/** Tudo o que não muda enquanto o otimizador explora builds. */
export interface EvaluationContext {
  items: Record<number, ItemModel>;
  hpSpTable: HpSpTable;
  /** Instância da classe do build (ex.: `new Windhawk()`). */
  character: CharacterBase;
  monster: MonsterModel;
  relieveLevel?: number;
  /** PVP: quando presente, substitui o monstro. */
  playerTarget?: PlayerTargetProfile;
  pvpMode?: PvpMode;
  /** Definições de buffs; o padrão é a mesma lista da sessão (`JobBuffs`). */
  buffDefs?: BuffDef[];
  /** Efeitos ("chances") marcados pelo usuário. */
  selectedChances?: string[];
}

/** O que o otimizador lê de uma build avaliada. Tempos em segundos. */
export interface BuildMetrics {
  skillValue: string;
  /** Dano por uso da skill, já com os efeitos marcados (`effected*`). */
  damageMin: number;
  damageMax: number;
  damageAvg: number;
  /** DPS da skill pelo próprio motor (considera conjuração, recarga, pós-conj. e crítico). */
  dps: number;
  hitsPerSec: number;
  totalHits: number;
  /** Conjuração variável, fixa, pós-conjuração e recarga já reduzidas. */
  vct: number;
  fct: number;
  acd: number;
  cd: number;
  castPeriod: number;
  hitPeriod: number;
  /**
   * Redução de pós-conjuração em % (o "Pós-conjuração -X%" dos equipamentos): o `acd` total e,
   * em skill mágica, o bônus do elemento (`acd_magic_<elemento>`), que o motor soma ao `acd`.
   */
  acdPercent: number;
  /** Pós-conjuração da skill antes das reduções (a da tabela do cliente), em segundos. */
  baseAcd: number;
  /**
   * Redução de conjuração fixa em segundos ("Conjuração fixa -X s"): o `fct` global mais o da
   * própria skill (`fct__<id>`), como `calc-skill-aspd.ts` soma antes de aplicar as reduções em %.
   */
  fctReduction: number;
  /**
   * Redução de conjuração variável em % ("Conjuração variável -X%") vinda de equipamentos/buffs:
   * `vct` − `vct_inc` + `vct__<id>` + `vctBySkill`. Não inclui DES/INT.
   */
  vctPercent: number;
  /** Conjuração fixa e variável da skill antes das reduções (tabela do cliente), em segundos. */
  baseFct: number;
  baseVct: number;
  /** Fator das reduções de fixa em % (`fctPercent` global e da skill): fixa = (base − s) × fator. */
  fctFactor: number;
  /** Fator de DES/INT na variável (`vctByStat`) e redução fixa de variável da skill (`fix_vct__<id>`). */
  vctByStat: number;
  vctFlat: number;
  /** `2·DES + INT` — 530 zera a parte da variável que vem de atributos. */
  dex2Int1: number;
  /** O motor não conhece os tempos desta skill; dps/tempos não são confiáveis. */
  timingUnknown: boolean;
}

export interface EvaluatorStats {
  evaluations: number;
  cacheHits: number;
  /** Tempo gasto dentro do motor, em ms (sem contar acertos de cache). */
  engineMs: number;
}

const DEFAULT_CACHE_SIZE = 20_000;

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** JSON com chaves ordenadas: duas builds iguais geram a mesma chave de cache. */
export function stableKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>).sort()
    .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableKey((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Monta a entrada do motor a partir do modelo, como `buildProfileFromPreset` da sessão.
 * Não altera `model`: devolve também a cópia normalizada que deve ser carregada.
 */
export function buildChainInput(context: EvaluationContext, model: MainModel, skillValue: string): { model: MainModel; input: CalcChainInput } {
  const { character, items } = context;
  const buffDefs = context.buffDefs ?? (JobBuffs as unknown as BuffDef[]);
  const working = { ...model } as MainModel;
  const { equipAtks, masteryAtks, activeSkillNames, learnedSkillMap } = character
    .setLearnSkills({ activeSkillIds: working.activeSkills ?? [], passiveSkillIds: working.passiveSkills ?? [] })
    .getSkillBonusAndName();
  const hasWeapon = !!(working.weapon || working.leftWeapon);
  const { scripts: consumeData, usedHpL } = collectConsumables(working, items);
  const { aspdPotion, buffBonuses } = applyGuaranaCandy({
    consumables: working.consumables,
    aspdPotion: working.aspdPotion,
    buffDefs,
    selectedBuffValues: working.skillBuffs,
    activeSkillNames,
    buffBonuses: collectBuffBonuses(buffDefs, working.skillBuffs, activeSkillNames, hasWeapon),
  });
  working.rawOptionTxts = toRawOptionTxtList(working, items);

  return {
    model: working,
    input: {
      monster: context.monster,
      relieveLevel: context.relieveLevel,
      playerTarget: context.playerTarget,
      pvpMode: context.pvpMode,
      equipAtks: withoutWeaponlessTalismans(equipAtks, hasWeapon),
      masteryAtks,
      buffEquips: buffBonuses.equipAtk,
      buffMasterys: buffBonuses.masteryAtk,
      consumeData,
      aspdPotion,
      extraOptionScripts: parseOptionScripts([...working.rawOptionTxts, ...customOptionScripts(working)]),
      activeSkillNames,
      learnedSkillMap,
      selectedAtkSkill: skillValue,
      selectedChances: context.selectedChances ?? [],
      usedHpL,
    },
  };
}

/** Lê as métricas de um `Calculator` já resolvido, pela API pública do motor. */
export function readMetrics(calc: Calculator, skillValue: string): BuildMetrics {
  const summary = calc.getTotalSummary() as any;
  const dmg = summary.dmg ?? {};
  const timing = summary.calcSkill ?? {};
  const element = String(dmg.skillPropertyAtk ?? '').toLowerCase();
  // Mesma chave que `calc-skill-aspd.ts`: id do catálogo, ou o nome quando a skill não tem id.
  const skillName = skillValue.split('==')[0];
  const skillId = SKILL_ID_BY_NAME[skillName] ?? skillName;
  const acdPercent = num(summary.acd) + (dmg.dmgType === 'Magical' && element ? num(summary[`acd_magic_${element}`]) : 0);
  const damageMin = num(dmg.effectedSkillDamageMin ?? dmg.skillMinDamage);
  const damageMax = num(dmg.effectedSkillDamageMax ?? dmg.skillMaxDamage);

  return {
    skillValue,
    damageMin,
    damageMax,
    damageAvg: (damageMin + damageMax) / 2,
    dps: num(dmg.effectedSkillDps ?? dmg.skillDps),
    hitsPerSec: num(timing.totalHitPerSec),
    totalHits: num(dmg.skillTotalHit),
    vct: num(timing.reducedVct),
    fct: num(timing.reducedFct),
    acd: num(timing.reducedAcd),
    cd: num(timing.reducedCd),
    castPeriod: num(timing.castPeriod),
    hitPeriod: num(timing.hitPeriod),
    acdPercent,
    baseAcd: num(timing.clientAcd),
    fctReduction: num(summary.fct) + num(summary[`fct__${skillId}`]),
    vctPercent: num(summary.vct) - num(summary.vct_inc) + num(summary[`vct__${skillId}`]) + num(summary.vctBySkill),
    baseFct: num(timing.clientFct),
    baseVct: num(timing.clientVct),
    fctFactor: (1 - num(summary.fctPercent) / 100) * (1 - num(summary[`fctPercent__${skillId}`]) / 100),
    vctByStat: timing.vctByStat == null ? 1 : num(timing.vctByStat),
    vctFlat: num(summary[`fix_vct__${skillId}`]),
    dex2Int1: num(timing.sumDex2Int1),
    timingUnknown: !!timing.timingUnknown,
  };
}

export class BuildEvaluator {
  private readonly calc = new Calculator();
  private readonly controller = new CalculatorController();
  private readonly cache = new Map<string, BuildMetrics>();
  readonly stats: EvaluatorStats = { evaluations: 0, cacheHits: 0, engineMs: 0 };

  constructor(private readonly context: EvaluationContext, private readonly cacheSize = DEFAULT_CACHE_SIZE) {
    this.calc.setMasterItems(context.items).setHpSpTable(context.hpSpTable).setClass(context.character);
  }

  /** Avalia o modelo para `skillValue` (padrão: a skill selecionada no próprio modelo). */
  evaluate(model: MainModel, skillValue = model.selectedAtkSkill ?? ''): BuildMetrics {
    this.stats.evaluations++;
    const key = `${skillValue}|${stableKey(model)}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.stats.cacheHits++;
      // Reinsere para manter a ordem de uso (LRU simples).
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    const started = performance.now();
    const { model: working, input } = buildChainInput(this.context, model, skillValue);
    this.calc.setClass(this.context.character).loadItemFromModel(working);
    this.controller.runChain(this.calc, input);
    const metrics = readMetrics(this.calc, skillValue);
    this.stats.engineMs += performance.now() - started;

    this.cache.set(key, metrics);
    if (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value as string);

    return metrics;
  }

  clearCache() {
    this.cache.clear();
  }
}

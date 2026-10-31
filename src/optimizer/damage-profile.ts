/**
 * Tipo de dano da skill otimizada e o filtro que ele permite: um item que só aumenta dano do
 * outro tipo (mágico numa skill física, físico numa mágica) ou só da outra distância (corpo a
 * corpo numa skill à distância e vice-versa) não entra na busca, mesmo com outros atributos
 * (HP, defesa, conjuração…) ou slots — quase todo item desses tem a versão do outro tipo.
 *
 * Fica quando completa um conjunto que dá bônus do tipo certo (ex.: Botas Modificadas INT com
 * o Manto Temporal INT, que dá penetração física). Arma e munição com ATQ base contam como
 * físicas.
 */

import { ItemTypeId } from 'src/app/constants/item.const';
import { isCustomItem } from 'src/app/core/custom-items';
import { CharacterBase } from 'src/app/jobs';
import { itemBonusScriptEntries, ItemModel } from 'src/app/models/item.model';
import { MainModel } from 'src/app/models/main.model';
import { SKILL_META } from 'src/app/skills/skill-meta.generated';
import { comboName } from './sets';

export interface DamageProfile {
  magical: boolean;
  /** `undefined`: depende da arma (o `isMelee` da skill é uma função) — sem filtro de distância. */
  melee: boolean | undefined;
  /** Id da skill: bônus nela (`<id>`, `chance__<id>`) contam a favor do item. */
  skillId?: number;
}

/** O perfil da skill selecionada na build, ou `undefined` sem skill (aí não há filtro). */
export function damageProfileOf(character: CharacterBase, model: MainModel): DamageProfile | undefined {
  const name = (model.selectedAtkSkill ?? '').split('==')[0];
  if (!name) return undefined;
  const skill = (character.getAtkSkills(model.skillFormulaVersion) as any[]).find((entry) => entry.name === name);
  if (!skill) return undefined;
  const magical = !!skill.isMatk;
  // Igual ao motor (damage-calculator.ts): ausente = à distância; função = depende da arma.
  const melee = magical ? undefined : typeof skill.isMelee === 'function' ? undefined : !!skill.isMelee;
  return { magical, melee, skillId: (SKILL_META as Record<string, { id?: number }>)[name]?.id };
}

const strip = (key: string) => key.replace(/^chance__/, '');
const MAGIC = /^(matk|matkPercent|sMatk|spl|int|m_.+|pene_mres.*)$/;
const PHYSICAL = /^(atk|atkPercent|pAtk|pow|con|str|dex|luk|cri|criDmg|crt|cRate|criRange|range|melee|p_.+|pene_res.*|ignore_size_penalty)$/;
/** Valem para os dois tipos. */
const BOTH = /^(allStatus|allTrait)$/;

type Side = 'magic' | 'physical' | 'both' | 'melee' | 'range' | undefined;

function sideOf(key: string, profile: DamageProfile): Side {
  const base = strip(key);
  if (profile.skillId != null && base === String(profile.skillId)) return 'both';
  if (BOTH.test(base)) return 'both';
  if (base === 'melee') return 'melee';
  if (base === 'range') return 'range';
  if (MAGIC.test(base)) return 'magic';
  if (PHYSICAL.test(base)) return 'physical';
  return undefined;
}

/** O bônus ajuda a skill? (mesmo tipo e, se física, distância compatível). */
function helps(side: Side, profile: DamageProfile): boolean {
  if (side === 'both') return true;
  if (profile.magical) return side === 'magic';
  if (side === 'physical') return true;
  if (side === 'melee') return profile.melee !== false;
  if (side === 'range') return profile.melee !== true;
  return false;
}

const EQUIP_NAMES = /EQUIP\[(.+?)]/g;
const EQUIP_IDS = /EQUIP_ID\[([\d|&]+)]/g;

/** Peças de conjuntos cujo bônus ajuda a skill. */
export interface ProfilePartners { names: ReadonlySet<string>; ids: ReadonlySet<number> }

export function collectProfilePartners(items: Record<number, ItemModel>, profile: DamageProfile): ProfilePartners {
  const names = new Set<string>();
  const ids = new Set<number>();
  for (const item of Object.values(items)) {
    if (!item?.script) continue;
    for (const [key, lines] of itemBonusScriptEntries(item.script)) {
      if (!helps(sideOf(key, profile), profile)) continue;
      for (const line of lines) {
        for (const [, body] of line.matchAll(EQUIP_NAMES)) for (const part of body.split(/&&|\|\|/)) names.add(part.trim());
        for (const [, body] of line.matchAll(EQUIP_IDS)) for (const part of body.split(/&&|\|\|/)) ids.add(Number(part));
      }
    }
  }
  return { names, ids };
}

/** O item só aumenta dano do outro tipo ou da outra distância (e não fecha conjunto útil)? */
export function isOffProfileItem(item: ItemModel, profile: DamageProfile, partners: ProfilePartners): boolean {
  if (isCustomItem(item)) return false;
  const sides = new Set<Side>(Object.keys(item.script ?? {}).map((key) => sideOf(key, profile)));
  const weapon = item.itemTypeId === ItemTypeId.WEAPON || item.itemTypeId === ItemTypeId.AMMO;
  if (!profile.magical && weapon && (item as any).attack > 0) sides.add('physical');
  sides.delete(undefined);
  if (!sides.size || [...sides].some((side) => helps(side, profile))) return false;
  return !partners.ids.has(item.id) && !partners.names.has(comboName(item));
}

import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { Calculator } from 'src/app/core/calculator';
import { Windhawk } from 'src/app/jobs';
import { ENCHANT_LIMIT_RULES } from './data/enchant-limits';
import { canPlaceEnchant, enchantWarnings, limitViolations } from './enchant-limits';
import { buildCatalog } from './candidates';
import { BuildEvaluator } from './evaluate';
import { optimizeBuild } from './items';
import { latamItemDb, windhawkContext, windhawkModel } from './__tests__/windhawk-build';
import { ENGINE_TIMEOUT } from './__tests__/timeouts';

const context = windhawkContext({ items: latamItemDb });
const { items, character } = context;

const AUTOMATRON_ARMOR_A = 450127;
const AUTOMATRON_SHIELD_A = 460157;
const H_ATIRADOR = 310158; // Automatic (Breeze Shooting)
const B_DEF = 310082;
const M_RAPIDEZ = 310102;
const F_SUPERPODER = 310124;
const F_LAMPEJO = 310125;
const F_FORTUNA = 310126;
const AUTOMATRON_LEG_A = 470022;
const BP_HELMET = 401434; // Capacete Fortificado
const ENCANTO_FORTIFICADO = 313370;
const ENCANTO_DE_ATAQUE = 313365;

describe('dados de limites de encantamento', () => {
  it('todos os ids existem na base e os encantamentos são encantamentos', () => {
    for (const rule of ENCHANT_LIMIT_RULES) {
      for (const id of rule.items) expect(items[id], `peça ${id} (${rule.label})`).toBeTruthy();
      for (const id of Object.keys(rule.perEnchant).map(Number)) {
        expect(items[id], `encantamento ${id} (${rule.label})`).toBeTruthy();
        expect(items[id].itemTypeId === 11 || [4883, 29047].includes(id)).toBe(true);
      }
    }
  }, ENGINE_TIMEOUT);
});

describe('limites por item', () => {
  it('H- Habilidade: no máximo 2 cópias no Colete Automatron (a fase 4 chegou a pôr 3)', () => {
    expect(limitViolations(AUTOMATRON_ARMOR_A, [H_ATIRADOR, H_ATIRADOR])).toEqual([]);
    expect(limitViolations(AUTOMATRON_ARMOR_A, [H_ATIRADOR, H_ATIRADOR, H_ATIRADOR])).toHaveLength(1);

    const model = { ...windhawkModel(130), armor: AUTOMATRON_ARMOR_A, armorEnchant1: H_ATIRADOR, armorEnchant2: H_ATIRADOR } as any;
    expect(canPlaceEnchant(model, ItemTypeEnum.armor, ItemTypeEnum.armorEnchant3, H_ATIRADOR)).toBe(false);
    // Trocar um campo que já tem o encantamento não conta como cópia extra.
    expect(canPlaceEnchant(model, ItemTypeEnum.armor, ItemTypeEnum.armorEnchant2, H_ATIRADOR)).toBe(true);
    expect(canPlaceEnchant(model, ItemTypeEnum.armor, ItemTypeEnum.armorEnchant3, B_DEF)).toBe(true);
  }, ENGINE_TIMEOUT);

  it('M-Rapidez: x2 no Motor, mas x1 no Escudo Automatron', () => {
    expect(limitViolations(AUTOMATRON_SHIELD_A, [M_RAPIDEZ, M_RAPIDEZ])).toHaveLength(1);
    expect(limitViolations(480020, [M_RAPIDEZ, M_RAPIDEZ])).toEqual([]);
  }, ENGINE_TIMEOUT);

  it('F- Fantástico: no máximo 2 no item, sem repetir', () => {
    expect(limitViolations(AUTOMATRON_LEG_A, [F_SUPERPODER, F_LAMPEJO])).toEqual([]);
    expect(limitViolations(AUTOMATRON_LEG_A, [F_SUPERPODER, F_SUPERPODER])).not.toEqual([]);
    expect(limitViolations(AUTOMATRON_LEG_A, [F_SUPERPODER, F_LAMPEJO, F_FORTUNA])).not.toEqual([]);
  }, ENGINE_TIMEOUT);

  it('Capacetes do Passe de Batalha: x1 e x2 da coluna "Limite"', () => {
    expect(limitViolations(BP_HELMET, [ENCANTO_DE_ATAQUE, ENCANTO_DE_ATAQUE])).toEqual([]);
    expect(limitViolations(BP_HELMET, [ENCANTO_FORTIFICADO, ENCANTO_FORTIFICADO])).toHaveLength(1);
  }, ENGINE_TIMEOUT);

  it('item sem regra cadastrada: repetição é permitida, mas vira aviso', () => {
    const model = { ...windhawkModel(130), garment: 480824, garmentEnchant1: 4704, garmentEnchant2: 4704 } as any;
    expect(canPlaceEnchant(model, ItemTypeEnum.garment, ItemTypeEnum.garmentEnchant3, 4704)).toBe(true);
    const warnings = enchantWarnings(model, items, [ItemTypeEnum.garment]);
    expect(warnings).toEqual([expect.objectContaining({ slot: ItemTypeEnum.garment, kind: 'unverified' })]);
  }, ENGINE_TIMEOUT);
});

describe('acessórios', () => {
  it('acessórios de um lado só ficam no lado certo', () => {
    const catalog = buildCatalog(items, character, { maxRequiredLevel: 230 });
    for (const id of catalog.accLeft ?? []) expect(items[id].itemSubTypeId).not.toBe(510); // Acc_R
    for (const id of catalog.accRight ?? []) expect(items[id].itemSubTypeId).not.toBe(511); // Acc_L
  }, ENGINE_TIMEOUT);

  it('bônus de conjunto não duplica com o acessório repetido (o motor conta cada combo uma vez)', () => {
    // Anel Intensificador de Magia (serve nos dois lados): "vct: EQUIP[Geffen Magic Robe]===5".
    // Dois anéis + a túnica: o bônus próprio do anel soma duas vezes, o do conjunto só uma.
    const RING = 2964;
    const ROBE = 15074;
    const vctOf = (model: any) => {
      const cls = new Windhawk();
      cls.setLearnSkills({ activeSkillIds: [], passiveSkillIds: [] }).getSkillBonusAndName();
      const calc = new Calculator().setMasterItems(items).setHpSpTable(context.hpSpTable).setClass(cls).setMonster(context.monster);
      calc.loadItemFromModel(model).prepareAllItemBonus();
      return ((calc as any).totalEquipStatus.vct as number) ?? 0;
    };
    const base = { ...windhawkModel(130), boot: undefined, bootEnchant2: undefined } as any;
    const none = vctOf(base);
    const robe = vctOf({ ...base, armor: ROBE });
    const oneRing = vctOf({ ...base, accLeft: RING });
    const twoRings = vctOf({ ...base, accLeft: RING, accRight: RING });
    const oneRingRobe = vctOf({ ...base, accLeft: RING, armor: ROBE });
    const twoRingsRobe = vctOf({ ...base, accLeft: RING, accRight: RING, armor: ROBE });

    // Bônus de conjunto = (com tudo) − (peças sozinhas). Com um anel ou dois, é o mesmo 5.
    expect(oneRingRobe - oneRing - (robe - none)).toBe(5);
    expect(twoRingsRobe - twoRings - (robe - none)).toBe(5);
  }, ENGINE_TIMEOUT);
});

describe('optimizeBuild respeita os limites', () => {
  it('nunca entrega uma build que viola regra cadastrada', () => {
    const evaluator = new BuildEvaluator(context);
    const model = { ...windhawkModel(130), armor: AUTOMATRON_ARMOR_A } as any;
    const result = optimizeBuild(evaluator, context, model, {
      objective: 'dps', slots: [ItemTypeEnum.armor], optimizeStats: false, optimizeSets: false, maxRounds: 2,
      catalog: { allowedItemIds: new Set([AUTOMATRON_ARMOR_A]) }, shortlistSize: 1,
    });
    expect(result.warnings.filter((warning) => warning.kind === 'violation')).toEqual([]);
    const enchants = [result.model.armorEnchant1, result.model.armorEnchant2, result.model.armorEnchant3].filter(Boolean) as number[];
    expect(limitViolations(AUTOMATRON_ARMOR_A, enchants)).toEqual([]);
  }, 60_000);
});

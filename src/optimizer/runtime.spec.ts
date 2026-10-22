import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ItemTypeEnum } from 'src/app/constants/item-type.enum';
import { decodeShared } from 'src/app/core/share-codec';
import { readShareToken } from 'src/app/core/share-path';
import { buildLinks, OptimizerData, prepareSession, runOptimization } from './runtime';
import { latamItemDb, windhawkModel } from './__tests__/windhawk-build';
import { ENGINE_TIMEOUT } from './__tests__/timeouts';

const data: OptimizerData = {
  items: latamItemDb,
  monsters: JSON.parse(readFileSync('src/assets/demo/data/monster.json', 'utf8')),
  hpSpTable: JSON.parse(readFileSync('src/assets/demo/data/hp_sp_table.json', 'utf8')),
};
const IFRIT = 1832;
/** O preset como o app salva em `ro-set` (aqui, o modelo completo do fixture). */
const preset = JSON.parse(JSON.stringify(windhawkModel(130)));

describe('prepareSession', () => {
  it('monta classe, alvo e skills a partir do preset salvo pelo app', () => {
    const session = prepareSession(data, { preset, monsterId: IFRIT });

    expect(session.className).not.toBe('');
    expect(session.className).not.toBe('Windhawk'); // nome em pt-BR, como na tela
    expect(session.monsterName).toBe(data.monsters[IFRIT].name);
    expect(session.skillValue).toBe('Focused Arrow Strike==5');
    expect(session.skills.map((skill) => skill.value)).toContain('Focused Arrow Strike==5');
    expect(session.model.weapon).toBe(preset.weapon);
  }, ENGINE_TIMEOUT);

  it('todo rótulo de skill traz o nome da skill (nada de "Nv 1" solto)', () => {
    const { skills } = prepareSession(data, { preset, monsterId: IFRIT });
    expect(skills.length).toBeGreaterThan(3);
    for (const skill of skills) expect(skill.label).not.toMatch(/^(Nv|Lv)\.?\s*\d/);
  }, ENGINE_TIMEOUT);

  it('trocar a skill também troca a rotação (o app espelha uma na outra)', () => {
    const session = prepareSession(data, { preset, monsterId: IFRIT, skillValue: 'Arrow Storm==10' });
    expect(session.model.selectedAtkSkill).toBe('Arrow Storm==10');
    expect(session.model.rotation).toEqual(['Arrow Storm==10']);
  }, ENGINE_TIMEOUT);

  it('itens personalizados do preset entram no catálogo', () => {
    const custom = { ...latamItemDb[700016], id: 1_000_000_000_001, custom: true, name: 'Meu arco' };
    const session = prepareSession(data, { preset: { ...preset, __customItems: [custom] }, monsterId: IFRIT });
    expect(session.context.items[custom.id]?.name).toBe('Meu arco');
  }, ENGINE_TIMEOUT);

  it('erros claros para classe ou monstro desconhecidos', () => {
    expect(() => prepareSession(data, { preset: { ...preset, class: -1 }, monsterId: IFRIT })).toThrow(/Classe/);
    expect(() => prepareSession(data, { preset, monsterId: -1 })).toThrow(/Monstro/);
  }, ENGINE_TIMEOUT);
});

describe('links do simulador', () => {
  it('Aplicar abre a build otimizada; Comparar abre a atual com a otimizada na comparação', () => {
    const original = windhawkModel(130);
    const optimized = { ...original, garment: 480824, shadowArmor: 24663, costumeGarment: 20500, dex: 120 } as any;
    const links = buildLinks(original, optimized, {
      itemChanges: [
        { slot: ItemTypeEnum.garment, from: undefined, to: 480824 },
        { slot: ItemTypeEnum.shadowArmor, from: undefined, to: 24663 },
        { slot: ItemTypeEnum.costumeGarment, from: undefined, to: 20500 },
      ],
      attachmentChanges: [],
    });

    const applied = decodeShared(readShareToken(`https://simulador.latam-tools.com.br${links.applyPath}`));
    expect(applied?.preset).toMatchObject({ garment: 480824, shadowArmor: 24663, dex: 120, weapon: original.weapon });
    expect(applied?.compare).toBeNull();

    const compared = decodeShared(readShareToken(`https://simulador.latam-tools.com.br${links.comparePath}`));
    expect(compared?.preset).toMatchObject({ weapon: original.weapon, dex: original.dex });
    expect(compared?.preset['garment']).toBeUndefined();
    expect(compared?.compare?.stats).toBe(true);
    expect(compared?.compare?.itemNames).toEqual(['garment', 'shadowArmor']);
    expect(compared?.compare?.model2).toMatchObject({ garment: 480824, dex: 120 });
    // Visuais não entram na comparação do simulador: o painel avisa.
    expect(links.notCompared).toEqual(['Visual capa']);
  }, ENGINE_TIMEOUT);
});

describe('runOptimization', () => {
  it('devolve resultado pronto para o painel', () => {
    const response = runOptimization(data, {
      preset, monsterId: IFRIT, objective: 'dps', slots: [ItemTypeEnum.garment], optimizeSets: false, timeLimitMs: 20_000,
    });

    expect(response.damageAfter).toBeGreaterThanOrEqual(response.damageBefore);
    expect(response.applyPath).toMatch(/^\/s\/.+\/$/);
    expect(response.comparePath).toMatch(/^\/s\/.+\/$/);
    for (const change of response.changes) {
      expect(change.label).toBeTruthy();
      expect(change.to).not.toMatch(/^#/); // nomes resolvidos, não ids
    }
  }, 60_000);
});

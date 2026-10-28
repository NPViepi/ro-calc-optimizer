import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CalculatorSession } from './calculator-session';
import { CalculatorData, CalculatorLayout, ItemShop, SlotColorPreferences } from '../services/calculator-services';
import { DataClient } from '../services/data-client';
import { CustomItems } from '../services/custom-items';
import { Confirmations, Messages } from '../services/notifications';
import { DataKey, DataManifest, manifestPath } from '../../app/core/data-manifest';
import { SKILL_DESC_BY_ID } from '../../app/skills';
import { previewBuffsForClass } from '../../app/skills/preview-275';
import { ClassName } from '../../app/jobs/_class-name';
import { ItemTypeEnum } from '../../app/constants/item-type.enum';

function makeSession(overrides: Partial<Record<DataKey, Promise<unknown>>> = {}) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { location: new URL('https://calc.test/#/') });
  vi.stubGlobal('location', new URL('https://calc.test/#/'));
  vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
  vi.stubGlobal('document', { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { remove: vi.fn() } } });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0));
  const artifacts: Partial<Record<DataKey, Promise<unknown>>> = {};
  const manifest = JSON.parse(readFileSync('src/assets/data-manifest.json', 'utf8')) as DataManifest;
  for (const key of ['itemsCore', 'monsters', 'hpsp', 'classes', 'itemViews', 'itemsDesc', 'skillDescriptions'] as const) {
    artifacts[key] = Promise.resolve(JSON.parse(readFileSync(join('src', manifestPath(manifest, key)), 'utf8')));
  }
  Object.assign(artifacts, overrides);
  const data = new DataClient({ inFlight: artifacts });
  const layout = new CalculatorLayout(storage);
  const session = new CalculatorSession(new CalculatorData(data), new Messages(), new Confirmations(), new ItemShop(),
    data.descriptions, new SlotColorPreferences(), layout, new CustomItems(storage));
  return { session, storage, data, layout };
}
describe('plain calculator session', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('restores Algoz with base 99, every job through 70 and named Sonic Blow controls', async () => {
    const { session, storage } = makeSession();
    storage.setItem('ro-set', JSON.stringify({ class: 4013, level: 200, jobLevel: 68, str: 130, pow: 50, weapon: 1250,
      selectedAtkSkill: 'Sonic Blow==10', activeSkillMap: { 'Assassin Spirit': 1 }, passiveSkillMap: { 'Sonic Acceleration': 1 } }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.selectedCharacter.className).toBe(ClassName.AssassinCross);
    expect(session.model).toMatchObject({ class: 4013, level: 99, jobLevel: 68, str: 99, pow: 0, selectedAtkSkill: 'Sonic Blow==10' });
    expect(session.levelList.at(-1).value).toBe(99);
    expect(session.mainStatusList.at(-1).value).toBe(99);
    expect(session.jobList.map(row => row.value)).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
    expect(session.isAllowLeftWeaponByClass).toBe(true);
    expect(session.isAllowTraitStat).toBe(false);
    expect(session.activeSkills.some(s => s.name === 'Venom Impression')).toBe(false);
    expect(session.model.activeSkills[session.activeSkills.findIndex(s => s.name === 'Assassin Spirit')]).toBe(1);
    expect(session.model.passiveSkills[session.passiveSkills.findIndex(s => s.name === 'Sonic Acceleration')]).toBe(1);

    session.model.class = 5;
    session.onClassChange();
    session.confirmClassSwitch(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.mainStatusList.at(-1).value).toBe(130);
    expect(session.levelList.at(-1).value).toBe(200);
    expect(session.model.activeSkills[session.activeSkills.findIndex(s => s.name === 'Assassin Spirit')]).toBe(1);
    session.model.level = 200;
    session.model.class = 4013;
    session.onClassChange();
    session.confirmClassSwitch(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.model.level).toBe(99);
    expect(session.mainStatusList.at(-1).value).toBe(99);
    session.dispose();
  });
  it.each([
    [315757, 20773], [315758, 21386], [315759, 20801], [315760, 20612],
  ])('keeps %i target bonuses visible and marks them inactive outside their target list', async (enchant, target) => {
    const { session, storage } = makeSession();
    storage.setItem('monster', '1038');
    storage.setItem('ro-set', JSON.stringify({ class: 4256, level: 200, jobLevel: 1,
      garment: 480956, garmentRefine: 10, garmentEnchant1: enchant }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    session.selectedItemDesc = ItemTypeEnum.garmentEnchant1;
    session.onSelectItemDescription();
    const targetRows = () => session.itemBonusRows.filter(row => /monstros específicos/.test(row.label));
    expect(targetRows()).toHaveLength(3);
    expect(targetRows().every(row => row.display === '+25%' && row.note?.startsWith('Inativo para o alvo selecionado.'))).toBe(true);
    expect(session.totalSummary?.['p_monster'] ?? 0).toBe(0);
    expect(session.itemBonus['p_monster'] ?? 0).toBe(0);
    session.selectedMonster = target;
    session.onMonsterChange();
    await vi.advanceTimersByTimeAsync(1000);
    expect(targetRows()).toHaveLength(3);
    expect(targetRows().every(row => row.display === '+25%' && !row.note)).toBe(true);
    expect(session.totalSummary?.['p_monster']).toBe(25);
    session.selectedMonster = 1038;
    session.onMonsterChange();
    await vi.advanceTimersByTimeAsync(1000);
    expect(targetRows().every(row => row.note?.startsWith('Inativo para o alvo selecionado.'))).toBe(true);
    expect(session.totalSummary?.['p_monster'] ?? 0).toBe(0);
    session.dispose();
  });

  it.each([[0, 5], [7, 10], [8, 10], [9, 25]])('uses Motor refine +%i for inactive target bonuses', async (refine, expected) => {
    const { session, storage } = makeSession();
    storage.setItem('monster', '1038');
    storage.setItem('ro-set', JSON.stringify({ class: 4256, level: 200, jobLevel: 1,
      garment: 480956, garmentRefine: refine, garmentEnchant1: 315760 }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    session.selectedItemDesc = ItemTypeEnum.garmentEnchant1;
    session.onSelectItemDescription();
    const rows = session.itemBonusRows.filter(row => /monstros específicos/.test(row.label));
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.display === `+${expected}%` && !!row.note)).toBe(true);
    session.dispose();
  });

  it('uses the compared Motor refine for its inactive Q bonuses', async () => {
    const { session, storage } = makeSession();
    storage.setItem('monster', '1038');
    storage.setItem('ro-set', JSON.stringify({ class: 4256, level: 200, jobLevel: 1,
      garment: 480956, garmentRefine: 10, garmentEnchant1: 315760 }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    session.isEnableCompare = true;
    session.compareItemNames = [ItemTypeEnum.garment];
    session.model2 = { rawOptionTxts: [], garment: 480956, garmentRefine: 7, garmentEnchant1: 315759 };
    session.onCompareItemChange();
    await vi.advanceTimersByTimeAsync(1000);
    session.selectedCompareItemDesc = ItemTypeEnum.garmentEnchant1;
    session.onSelectItemDescription(true);
    expect(session.itemId).toBe(315759);
    const rows = session.itemBonusRows.filter(row => /monstros específicos/.test(row.label));
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.display === '+10%' && !!row.note)).toBe(true);
    expect(session.totalSummary2?.['p_monster'] ?? 0).toBe(0);
    session.dispose();
  });

  /**
   * Card `9lvALhlAS6Njj6z2pp6Q` (iukkeN): com um cajado de duas mãos na build principal, a
   * linha do escudo sumia da tela e não havia onde pôr o escudo da build comparada. Quem
   * responde pela linha agora é cada build; o `Calculator` só sabe da principal.
   */
  it('opens the shield row for the compared build alone, and keeps its shield in the numbers', async () => {
    const { session, storage } = makeSession();
    storage.setItem('ro-set', JSON.stringify({ class: 4255, level: 200, jobLevel: 1, weapon: 2019 }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.hiddenMap.shield).toBe(true);
    expect(session.isCompareShieldShown).toBe(false);

    session.isEnableCompare = true;
    session.compareItemNames = [ItemTypeEnum.weapon, ItemTypeEnum.shield];
    session.model2 = { rawOptionTxts: [], weapon: 1623, shield: 2101 };
    expect(session.isCompareShieldShown).toBe(true);

    session.onCompareItemChange();
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.model2[ItemTypeEnum.shield]).toBe(2101);

    // Uma arma de duas mãos dos dois lados fecha a linha de novo.
    session.model2 = { rawOptionTxts: [], weapon: 2019 };
    expect(session.isCompareShieldShown).toBe(false);
    session.dispose();
  });
  /**
   * A arma da mão esquerda tinha a mesma limitação do escudo, pelo mesmo motivo: a linha era
   * só da build principal. Com um katar (duas mãos) na principal, "duas mãos contra uma mão
   * + adaga na esquerda" não dava para montar — e a adaga comparada ainda era despejada da
   * conta, porque `resolveOffHandEviction` recebia a resposta da build errada.
   */
  it('opens the off-hand weapon row for the compared build alone, and keeps its dagger in the numbers', async () => {
    const KATAR = 1299, DAGGER = 13083, OFF_HAND_DAGGER = 13068;
    const { session, storage } = makeSession();
    storage.setItem('ro-set', JSON.stringify({ class: 4254, level: 200, jobLevel: 1, weapon: KATAR }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.isAllowLeftWeaponByClass).toBe(true);
    expect(session.isLeftWeaponShown).toBe(false);
    expect(session.isLeftWeaponOffered).toBe(false);

    session.isEnableCompare = true;
    session.compareItemNames = [ItemTypeEnum.weapon, ItemTypeEnum.leftWeapon];
    session.model2 = { rawOptionTxts: [], weapon: DAGGER, leftWeapon: OFF_HAND_DAGGER };
    expect(session.isCompareLeftWeaponShown).toBe(true);
    expect(session.isLeftWeaponOffered).toBe(true);

    session.onCompareItemChange();
    await vi.advanceTimersByTimeAsync(1000);
    // Oferecida na tela e contada no motor: as duas respostas são a mesma.
    expect(session.showCompareItemMap.leftWeapon).toBe(true);
    expect(session.model2[ItemTypeEnum.leftWeapon]).toBe(OFF_HAND_DAGGER);

    // Um katar na build comparada também fecha a linha: ele ocupa as duas mãos.
    session.model2 = { rawOptionTxts: [], weapon: KATAR };
    expect(session.isCompareLeftWeaponShown).toBe(false);
    session.dispose();
  });

  it('boots the real datasets, completes the solve and persists the existing autosave format', async () => {
    const { session, storage } = makeSession();
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    session.viewReady();
    await vi.advanceTimersByTimeAsync(300);
    expect(session.isInProcessingPreset).toBe(false);
    expect(session.isCalculating).toBe(false);
    expect(session.totalSummary?.calc?.totalAspd).toBeGreaterThan(0);
    expect(session.modelSummary).toBeDefined();
    expect(JSON.parse(storage.getItem('ro-set')!)).toHaveProperty('class', session.model.class);
    expect(session.getSnapshot()).toBeGreaterThan(0);
    session.dispose();
  });
  it('disposes pending initialization and does not publish late data', async () => {
    const { session } = makeSession();
    session.start(); session.dispose();
    const snapshot = session.getSnapshot();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.getSnapshot()).toBe(snapshot);
    expect(session.totalSummary).toBeUndefined();
  });

  it.each(['rebalance-2022-06', 'rebalance-2026-02'] as const)('hides preview catalogs and resets %s without shifting skill indices', async version => {
    const { session, storage, layout } = makeSession();
    storage.setItem('ro-set', JSON.stringify({ class: 4304, level: 250, jobLevel: 1,
      selectedAtkSkill: 'Shadow Torrent==10', rotation: ['Shadow Torrent==10'], activeSkillMap: { Surge: 5 }, skillFormulaVersion: version }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    const surge = session.activeSkills.findIndex(skill => skill.name === 'Surge');
    const names = session.activeSkills.map(skill => skill.name);
    const latamSkills = session.activeSkills.filter(skill => !skill.preview).map(skill => session.model.activeSkills[names.indexOf(skill.name)]);
    const previewItem = session.equipableItems.find(row => session.items[row.id]?.preRelease)!;
    expect(previewItem).toBeDefined();
    expect(session.model.activeSkills[surge]).toBe(5);
    layout.previews.set(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.model.skillFormulaVersion).toBe('current');
    expect(session.model.activeSkills[surge]).toBe(0);
    expect(session.activeSkills.map(skill => skill.name)).toEqual(names);
    expect(session.activeSkills.filter(skill => !skill.preview).map(skill => session.model.activeSkills[names.indexOf(skill.name)])).toEqual(latamSkills);
    expect(session.atkSkills.every(skill => !skill.preview)).toBe(true);
    expect(session.equipableItems.every(row => !session.items[row.id]?.preRelease)).toBe(true);
    expect(session.enchants.every(row => !session.items[Number(row.value)]?.preRelease)).toBe(true);
    expect(session.model.rotation).not.toContain('Shadow Torrent==10');
    expect(JSON.parse(storage.getItem('ro-set')!).activeSkillMap.Surge).toBe(0);
    layout.previews.set(true);
    expect(session.equipableItems.some(row => row.id === previewItem.id)).toBe(true);
    expect(session.atkSkills.some(skill => skill.name === 'Shadow Torrent')).toBe(true);
    expect(session.model.skillFormulaVersion).toBe('current');
    session.dispose();
  });

  it.each(['rebalance-2022-06', 'rebalance-2026-02'] as const)('keeps LATAM when importing %s with previews already off', async version => {
    const { session, storage, layout } = makeSession();
    layout.previews.set(false);
    storage.setItem('ro-set', JSON.stringify({ class: 4304, level: 250, jobLevel: 1,
      selectedAtkSkill: 'Shadow Torrent==10', rotation: ['Shadow Torrent==10'], activeSkillMap: { Surge: 5 }, skillFormulaVersion: version }));
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.model.skillFormulaVersion).toBe('current');
    expect(session.model.rotation).not.toContain('Shadow Torrent==10');
    const surge = session.activeSkills.findIndex(skill => skill.name === 'Surge');
    expect(session.model.activeSkills[surge]).toBe(0);
    expect(session.atkSkills.every(skill => !skill.preview)).toBe(true);
    session.onSkillFormulaVersionChange(version);
    expect(session.model.skillFormulaVersion).toBe('current');
    session.dispose();
  });

  it('replaces cached skill fallbacks when deferred descriptions arrive', async () => {
    const id = 999_998;
    const { session, data } = makeSession({ skillDescriptions: Promise.resolve({ [id]: 'Descrição completa da habilidade' }) });
    const skill = { name: 'delayed-skill', label: 'Habilidade', icon: id, dropdown: [] };
    try {
      expect(session.buffTooltip(skill)).not.toContain('Descrição completa');
      expect(session.skillTooltip(skill)).not.toContain('Descrição completa');
      await data.loadSkillDescriptions();
      expect(session.buffTooltip(skill)).toContain('Descrição completa da habilidade');
      expect(session.skillTooltip(skill)).toContain('Descrição completa da habilidade');
    } finally {
      delete SKILL_DESC_BY_ID[id];
      session.dispose();
    }
  });

  it('uses English preview skill and buff descriptions while keeping condition summaries', () => {
    const { session } = makeSession();
    try {
      expect(session.skillTooltip({ name: 'Abyss Flame', icon: 6515, preview: true })).toContain('5 hits around the target and 3 around the caster');
      const crisis = previewBuffsForClass(ClassName.HyperNovice)[0];
      const html = session.buffTooltip(crisis);
      expect(html).toContain('Costs 50 AP and lasts 300 seconds.');
      expect(html).toContain('Max HP +75000, P.Atk +15, S.Matk +15');
      expect(html).toContain('The activation heal is not simulated.');
      expect(html).toContain('Preview kRO 275/60.');
      const chasing = previewBuffsForClass(ClassName.AbyssChaser)[0];
      expect(session.buffTooltip({ ...chasing, icon: 6512 })).toContain('Adds 2500% per skill level to Unlucky Rush');
      expect(session.buffTooltip({ ...chasing, icon: 6512 })).not.toContain('retreats');
    } finally {
      session.dispose();
    }
  });

  it('uses the chosen Betelgeuse HP in both builds without changing the database or other targets', async () => {
    const { session, storage } = makeSession();
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    session.selectedMonster = 20994;
    session.onMonsterChange();
    session.toggleStatsCompare();
    for (const hp of [500_000_000, 800_000_000, 1_100_000_000, 1_400_000_000, 1_700_000_000, 2_000_000_000]) {
      session.betelgeuseHp = hp;
      session.onBetelgeuseHpChange();
      await vi.advanceTimersByTimeAsync(1500);
      expect(session.totalSummary.monster.hp).toBe(hp);
      expect(session.totalSummary2.monster.hp).toBe(hp);
      expect(storage.getItem('betelgeuseHp')).toBe(String(hp));
    }
    expect(session.monsterDataMap[20994].stats.health).toBe(2_000_000_000);
    session.betelgeuseHp = 500_000_000;
    session.selectedMonster = 21067;
    session.onMonsterChange();
    await vi.advanceTimersByTimeAsync(1500);
    expect(session.totalSummary.monster.hp).toBe(session.monsterDataMap[21067].stats.health);
    session.dispose();
  });

  it('offers Freyja Aliviar 0–8, resets a saved higher level and retains other targets’ 0–10', () => {
    const { session, storage } = makeSession();
    session.selectedMonster = 20994;
    session.relieveLevel = 10;
    expect(session.relieveLevelOptions.map((option) => option.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    session.selectedMonster = 21361;
    session.onMonsterChange();
    expect(session.isRelieveTarget).toBe(true);
    expect(session.relieveLevelOptions.map((option) => option.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(session.relieveLevelOptions.at(-1)?.label).toContain('80%');
    expect(session.relieveLevel).toBe(0);
    expect(storage.getItem('monster')).toBe('21361');
    session.dispose();
  });
  it.each(['success', 'offline'])('publishes the completed share link when shortening is %s', async (outcome) => {
    const { session } = makeSession();
    session.start();
    await vi.advanceTimersByTimeAsync(1500);
    const shortUrl = 'https://short.latam-tools.com.br/test12';
    vi.stubGlobal('fetch', outcome === 'success'
      ? vi.fn().mockResolvedValue(new Response(JSON.stringify({ short_url: shortUrl }), { status: 201 }))
      : vi.fn().mockRejectedValue(new Error('offline')));
    const rendered: { url: string; shortening: boolean }[] = [];
    const stop = session.subscribe(() => rendered.push({ url: session.shareUrl, shortening: session.shareShortening }));

    session.action(() => session.openShareDialog());
    const longUrl = session.shareUrl;
    expect(rendered.at(-1)?.shortening).toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(rendered.at(-1)).toEqual({ url: outcome === 'success' ? shortUrl : longUrl, shortening: false });
    stop();
    session.dispose();
  });
});

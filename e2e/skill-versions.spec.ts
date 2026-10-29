import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * An equipment piece the catalog still flags `preRelease`, resolved from the data rather
 * than named here. The flag is dropped from an id as soon as LATAM ships it (see
 * `preRelease` in item.model.ts), which is exactly what retired the name this test used
 * to hard-code -- the pt-BR overlay took over and the preview filter stopped hiding it.
 * It has to be an item every class can wear, since the slot lists the search reads are
 * built for the current class.
 */
const PREVIEW_ITEM = (() => {
  const items: Record<string, { name: string; usableClass?: string[]; preRelease?: boolean }> =
    JSON.parse(readFileSync('src/assets/demo/data/item.json', 'utf8'));
  const hit = Object.values(items).find((item) => item.preRelease && (item.usableClass || []).includes('all'));
  if (!hit) throw new Error('item.json flags no class-agnostic pre-release equipment: the preview filter cannot be exercised');
  return hit.name.replace(/\s*\[\d+\]$/, '');
})();

for (const version of ['rebalance-2022-06', 'rebalance-2026-02'] as const) test('formula selectors synchronize and persist: ' + version, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('ro-set')) localStorage.setItem('ro-set', JSON.stringify({class:4255,level:250,jobLevel:1,int:130,spl:100,selectedAtkSkill:'Soul Vulcan Strike==5',rotation:['Soul Vulcan Strike==5']}));
    localStorage.setItem('ro-right-accordion-active','[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0,{timeout:40000});
  await page.getByRole('button',{name:'Batalha',exact:true}).click();
  const battle = page.getByRole('region',{name:'Batalha',exact:true});
  const selector = battle.getByRole('combobox',{name:'Versão das fórmulas de habilidades'});
  await expect(selector).toHaveValue('current');
  await expect(selector.locator('option')).toHaveText(['Atual (LATAM)', 'Rebalance - 02/06/2022 - (kRO)', 'Rebalance - 21/12/2022 - (kRO)']);
  const referencesButton = battle.getByRole('button', { name: 'Referências dos rebalanceamentos', exact: true });
  await referencesButton.click();
  const references = page.getByRole('region', { name: 'Referências dos rebalanceamentos', exact: true });
  await expect(references).toContainText('As datas indicam quando cada rebalanceamento chegou ao kRO (servidor coreano).');
  await expect(references.getByRole('heading')).toHaveText(['Rebalance - 02/06/2022 - (kRO)', 'Rebalance - 21/12/2022 - (kRO)']);
  const sourceUrls = [
    'https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7600&curpage=1',
    'https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/13/#comment-11126',
    'https://sigmathefallen.blogspot.com/2025/02/',
    'https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7670&curpage=1',
    'https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/14/#comment-12421',
    'https://sigmathefallen.blogspot.com/2026/02/',
  ];
  await expect(references.getByRole('link')).toHaveCount(sourceUrls.length);
  for (const [index, url] of sourceUrls.entries()) {
    await expect(references.getByRole('link').nth(index)).toHaveAttribute('href', url);
    await expect(references.getByRole('link').nth(index)).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await page.screenshot({ path: `.tmp/rebalance-references-${version}-desktop.png` });
  await page.keyboard.press('Escape');
  await expect(references).toHaveCount(0);
  await expect(referencesButton).toBeFocused();
  await selector.selectOption(version);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillFormulaVersion)).toBe(version);
  await page.getByRole('button',{name:'Auto-conjuração',exact:true}).click();
  const auto = page.getByRole('region',{name:'Auto-conjuração',exact:true});
  const autoReferencesButton = auto.getByRole('button', { name: 'Referências dos rebalanceamentos', exact: true });
  await autoReferencesButton.scrollIntoViewIfNeeded();
  // Popovers dismiss on outside scrolling; let the browser finish revealing the button first.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await autoReferencesButton.click();
  await expect(references).toBeVisible();
  await autoReferencesButton.click();
  await expect(references).toHaveCount(0);
  await expect(auto.getByRole('combobox',{name:'Versão das fórmulas de habilidades'})).toHaveValue(version);
  await auto.getByRole('combobox',{name:'Versão das fórmulas de habilidades'}).selectOption('current');
  await expect(selector).toHaveValue('current');
  // Saving a target makes the PVP battle panel available.
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByLabel('Nome da simulação').fill('Alvo de prévia');
  await page.getByLabel('Nome da simulação').press('Enter');
  await expect(page.getByRole('dialog',{name:'Salvar simulação'})).toHaveCount(0);
  await page.getByRole('button',{name:'PVP',exact:true}).click();
  const pvp = page.getByRole('region',{name:'PVP',exact:true});
  await pvp.getByRole('combobox',{name:'Selecione um alvo salvo'}).click();
  await page.getByRole('option',{name:'Alvo de prévia',exact:true}).click();
  const pvpSelector = pvp.getByRole('combobox',{name:'Versão das fórmulas de habilidades'});
  const pvpReferencesButton = pvp.getByRole('button', { name: 'Referências dos rebalanceamentos', exact: true });
  await pvpReferencesButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await pvpReferencesButton.click();
  await expect(references).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pvpSelector).toHaveValue('current');
  await pvpSelector.selectOption(version);
  await expect(selector).toHaveValue(version);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillFormulaVersion)).toBe(version);
  const previews = page.getByRole('group', { name: 'Mostrar prévias' });
  const previewsYes = previews.getByRole('button', { name: 'Sim', exact: true });
  const previewsNo = previews.getByRole('button', { name: 'Não', exact: true });
  const settingsButton = page.getByRole('button', { name: 'Configurações', exact: true });
  const settings = page.getByRole('dialog', { name: 'Configurações', exact: true });
  await expect(previews).toHaveCount(0);
  const settingsButtonBounds = await settingsButton.boundingBox();
  const searchButtonBounds = await page.getByRole('button', { name: 'Buscar itens', exact: true }).boundingBox();
  expect(settingsButtonBounds!.height).toBe(searchButtonBounds!.height);
  expect(settingsButtonBounds!.y).toBe(searchButtonBounds!.y);
  const saveButton = page.getByRole('button', { name: 'Salvar', exact: true });
  expect(settingsButtonBounds!.width).toBe((await saveButton.boundingBox())!.width);
  expect((await settingsButton.locator('app-icon').boundingBox())!.width).toBe((await saveButton.locator('app-icon').boundingBox())!.width);
  // Text metrics vary by platform; the icon-only button must follow its neighbors.
  await page.evaluate(() => document.documentElement.style.setProperty('--font-family', 'Arial, sans-serif'));
  const alternateSettingsBounds = await settingsButton.boundingBox();
  const alternateSearchBounds = await page.getByRole('button', { name: 'Buscar itens', exact: true }).boundingBox();
  expect(alternateSettingsBounds!.height).toBe(alternateSearchBounds!.height);
  expect(alternateSettingsBounds!.y).toBe(alternateSearchBounds!.y);
  await page.evaluate(() => document.documentElement.style.removeProperty('--font-family'));
  expect(await settingsButton.evaluate(element => element.nextElementSibling)).toBeNull();
  await settingsButton.click();
  await expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
  await expect(settings).toBeVisible();
  const sidebarBounds = await settings.boundingBox();
  expect(sidebarBounds!.x + sidebarBounds!.width).toBe(await page.evaluate(() => document.documentElement.getBoundingClientRect().width));
  expect(sidebarBounds!.height).toBe(918);
  await expect(settings.getByRole('group')).toHaveCount(1);
  await expect(previewsYes).toHaveAttribute('aria-pressed', 'true');
  await previews.hover();
  await expect(page.getByRole('tooltip')).toContainText('Exibe itens e habilidades ainda não disponíveis no LATAM');
  await expect(page.getByRole('tooltip')).toContainText('volta às fórmulas LATAM');
  await expect(page.getByRole('tooltip')).toContainText('A escolha fica salva neste navegador.');
  await previewsYes.click();
  await expect(previewsYes).toHaveAttribute('aria-pressed', 'true');
  await previewsNo.click();
  await expect(previewsNo).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Versão das fórmulas de habilidades' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Referências dos rebalanceamentos', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillFormulaVersion)).toBe('current');
  await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await expect(settingsButton).toBeFocused();
  await page.reload();
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40000 });
  await settingsButton.click();
  await expect(previewsNo).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Versão das fórmulas de habilidades' })).toHaveCount(0);
  await previewsYes.click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(settingsButton).toBeFocused();
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
  await expect(selector).toHaveValue('current');
  await selector.selectOption(version);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillFormulaVersion)).toBe(version);
  await page.reload();
  await expect(page.locator('#ro-splash')).toHaveCount(0,{timeout:40000});
  await page.getByRole('button',{name:'Batalha',exact:true}).click();
  await expect(page.getByRole('region',{name:'Batalha',exact:true}).getByRole('combobox',{name:'Versão das fórmulas de habilidades'})).toHaveValue(version);
  await page.screenshot({path:'.tmp/skill-versions-desktop.png',fullPage:true});
  await settingsButton.click();
  await page.screenshot({ path: '.tmp/settings-sidebar-desktop.png' });
  await page.locator('.ui-overlay-backdrop').click({ position: { x: 20, y: 100 } });
  await expect(settings).toHaveCount(0);
  await settingsButton.click();
  await page.setViewportSize({width:390,height:844});
  const mobileSidebarBounds = await settings.boundingBox();
  expect(mobileSidebarBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mobileSidebarBounds!.x + mobileSidebarBounds!.width).toBe(await page.evaluate(() => document.documentElement.getBoundingClientRect().width));
  await page.screenshot({ path: '.tmp/settings-sidebar-mobile.png' });
  await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
  // A phone shows the sections behind the bottom bar's "Resultado" tab.
  await page.getByRole('button', { name: 'Resultado', exact: true }).click();
  const mobileSelector = page.getByRole('region',{name:'Batalha',exact:true}).getByRole('combobox',{name:'Versão das fórmulas de habilidades'});
  await referencesButton.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await referencesButton.click();
  await expect(references).toBeVisible();
  const referenceBounds = await references.boundingBox();
  expect(referenceBounds!.x).toBeGreaterThanOrEqual(0);
  expect(referenceBounds!.x + referenceBounds!.width).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  await page.screenshot({ path: `.tmp/rebalance-references-${version}-mobile.png` });
  await battle.locator('.rot-head .cap2').click();
  await expect(references).toHaveCount(0);
  await expect(mobileSelector).toBeVisible();
  // The existing calculator keeps a wide, horizontally scrollable workspace.
  await mobileSelector.scrollIntoViewIfNeeded();
  const bounds = await mobileSelector.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:'.tmp/skill-versions-mobile.png'});
  await expect.poll(() => errors).toEqual([]);
});

test('preview switch filters both skill generations and item search and restores the catalogs', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('ro-set')) localStorage.setItem('ro-set', JSON.stringify({ class: 4304, level: 250, jobLevel: 1,
      selectedAtkSkill: 'Shadow Torrent==10', rotation: ['Shadow Torrent==10'], activeSkillMap: { Surge: 5 } }));
    localStorage.setItem('ro-right-accordion-active', '[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40000 });
  await page.getByRole('button', { name: 'Habilidades', exact: true }).click();
  const surge = page.locator('.skill-control-row').filter({ hasText: 'Surge (Prévia)' });
  await expect(surge).toBeVisible();
  const search = async (present: boolean) => {
    await page.getByRole('button', { name: 'Buscar itens', exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByPlaceholder('Nome do item') });
    await dialog.getByPlaceholder('Nome do item').fill(PREVIEW_ITEM);
    await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(dialog.locator('.item-search-result-row').filter({ hasText: PREVIEW_ITEM })).toHaveCount(present ? 1 : 0);
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  };
  await search(true);
  const settingsButton = page.getByRole('button', { name: 'Configurações', exact: true });
  const settings = page.getByRole('dialog', { name: 'Configurações', exact: true });
  await settingsButton.click();
  await page.getByRole('group', { name: 'Mostrar prévias' }).getByRole('button', { name: 'Não', exact: true }).click();
  await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.locator('.skill-control-row').filter({ hasText: 'Prévia' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).activeSkillMap.Surge)).toBe(0);
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
  const battle = page.getByRole('region', { name: 'Batalha', exact: true });
  await expect(battle.locator('.rot-name').filter({ hasText: 'Shadow Torrent' })).toHaveCount(0);
  await battle.getByRole('button', { name: 'Adicionar habilidade', exact: true }).click();
  await battle.locator('.rot-add-dd').click();
  await expect(page.getByRole('option').filter({ hasText: 'Prévia' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await search(false);
  await settingsButton.click();
  await page.getByRole('group', { name: 'Mostrar prévias' }).getByRole('button', { name: 'Sim', exact: true }).click();
  await settings.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(surge).toBeVisible();
  await expect(surge.getByRole('combobox')).toContainText('Não');
  await search(true);
  await page.screenshot({ path: '.tmp/preview-visibility.png', fullPage: true });
});

test('new support buffs appear as Prévia and affect the saved build', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('ro-set')) localStorage.setItem('ro-set',JSON.stringify({class:4307,level:250,jobLevel:1}));
    localStorage.setItem('ro-right-accordion-active','[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0,{timeout:40000});
  await page.getByRole('button',{name:'Habilidades',exact:true}).click();
  const label = page.locator('.skill-control-label').filter({hasText:'Overcoming Crisis (Prévia)'});
  await expect(label).toBeVisible();
  await expect(label.locator('img')).toHaveCount(0);
  const iconSpace = label.locator('span.skill_icon');
  await expect(iconSpace).toBeVisible();
  await expect(iconSpace).toHaveCSS('width','20px');
  await expect(iconSpace).toHaveCSS('height','20px');
  await label.hover();
  await expect(page.getByRole('tooltip')).toContainText('Costs 50 AP and lasts 300 seconds.');
  await expect(page.getByRole('tooltip')).toContainText('Max HP +75000, P.Atk +15, S.Matk +15');
  const control = page.locator('.skill-control-row').filter({hasText:'Overcoming Crisis (Prévia)'}).getByRole('combobox');
  await control.click();
  await page.getByRole('option',{name:'Nv 5',exact:true}).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).activeSkillMap['Overcoming Crisis'])).toBe(5);
  await page.screenshot({path:'.tmp/skill-preview-buffs.png',fullPage:true});
});

test('preview attack details show the English description', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ro-set',JSON.stringify({class:4260,level:250,jobLevel:1,int:130,spl:100,selectedAtkSkill:'Abyss Flame==5',rotation:['Abyss Flame==5']}));
    localStorage.setItem('ro-right-accordion-active','[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0,{timeout:40000});
  await page.getByRole('button',{name:'Batalha',exact:true}).click();
  const battle = page.getByRole('region',{name:'Batalha',exact:true});
  await battle.getByRole('button',{name:'Detalhes da habilidade',exact:true}).click();
  await page.getByRole('button',{name:'Descrição da habilidade',exact:true}).click();
  await expect(page.locator('.pd-desc')).toContainText('5 hits around the target and 3 around the caster');
  await expect(page.locator('.pd-desc')).toContainText('Max level: 5');
});

test('285 previews expose Surge, persist it and explain unavailable timing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('ro-set')) localStorage.setItem('ro-set', JSON.stringify({ class: 4304, level: 250, jobLevel: 1, str: 130, selectedAtkSkill: 'Shadow Torrent==10', rotation: ['Shadow Torrent==10'] }));
    localStorage.setItem('ro-right-accordion-active', '[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40000 });
  await page.getByRole('button', { name: 'Habilidades', exact: true }).click();
  const label = page.locator('.skill-control-label').filter({ hasText: 'Surge (Prévia)' });
  await expect(label).toBeVisible();
  await expect(label.locator('img')).toHaveCount(0);
  const control = page.locator('.skill-control-row').filter({ hasText: 'Surge (Prévia)' }).getByRole('combobox');
  await expect(control).toContainText('Não');
  await label.hover();
  await expect(page.getByRole('tooltip')).toContainText('non-critical physical damage');
  await expect(page.getByRole('tooltip')).toContainText('285/65');
  await expect(page.getByRole('tooltip')).not.toContainText('275/60');
  await control.click();
  await page.getByRole('option', { name: 'Nv 5', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).activeSkillMap.Surge)).toBe(5);
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
  const battle = page.getByRole('region', { name: 'Batalha', exact: true });
  await expect(battle.getByText('Prévia: tempos ainda não publicados.', { exact: false })).toBeVisible();
  await expect(battle.locator('.loading_block')).toHaveCount(0);
  const details = battle.getByRole('button', { name: 'Detalhes da habilidade', exact: true });
  await details.scrollIntoViewIfNeeded();
  await expect(details).toBeInViewport();
  await details.click();
  await expect(page.locator('.shared-skill-details')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descrição da habilidade', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Descrição da habilidade', exact: true }).click();
  await expect(page.locator('.pd-desc')).toContainText('Shadow Torrent (Prévia)');
  await expect(page.locator('.pd-desc')).toContainText('4 melee physical hits');
  await page.screenshot({ path: '.tmp/skill-preview-285.png', fullPage: true });
  await page.reload();
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40000 });
  await page.getByRole('button', { name: 'Habilidades', exact: true }).click();
  await expect(page.locator('.skill-control-row').filter({ hasText: 'Surge (Prévia)' }).getByRole('combobox')).toContainText('Nv 5');
  await expect.poll(() => errors).toEqual([]);
});

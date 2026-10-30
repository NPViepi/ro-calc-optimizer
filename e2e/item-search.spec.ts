import { expect, Page, Route, test } from '@playwright/test';
import { ITEM_SEARCH_BONUS_OPTIONS } from '../src/app/core/item-search';

async function openSearch(page: Page) {
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Buscar itens', exact: true }).click();
  return page.getByRole('dialog', { name: /Buscar itens/ });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ro-right-accordion-active', '[]'));
});

test('current level filter restricts results and preserves its selection when reopened', async ({ page }) => {
  await page.route('**/items-core*.json', async route => {
    const response = await route.fetch();
    const items = await response.json();
    for (const [id, requiredLevel] of [[2201, 1], [2203, 999]]) {
      items[id] = { ...items[2201], id, name: 'Filtro por nível ' + id, requiredLevel };
    }
    await route.fulfill({ json: items });
  });
  const dialog = await openSearch(page);
  const levelFilter = dialog.getByRole('checkbox', { name: /Apenas itens para o nível atual \(\d+\) ou inferior/ });
  await expect(levelFilter).not.toBeChecked();
  await dialog.getByRole('searchbox', { name: 'Nome', exact: true }).fill('Filtro por nível');
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await levelFilter.check();
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(1);
  await expect(dialog.locator('tbody tr')).toContainText('Filtro por nível 2201');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Buscar itens', exact: true }).click();
  await expect(levelFilter).toBeChecked();
  await expect(dialog.locator('tbody tr')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(levelFilter).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await levelFilter.uncheck();
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
});

test('search dropdowns expose all bonus and type options, and bonus rows have no four-picker cap', async ({ page }) => {
  const dialog = await openSearch(page);
  const [nameBox, typeBox, skillBox, serverBox] = await Promise.all(
    [0, 1, 2, 3].map(index => dialog.locator('.item-search-field').nth(index).boundingBox()));
  expect(nameBox!.x).toBeCloseTo(skillBox!.x, 0);
  expect(typeBox!.x).toBeCloseTo(serverBox!.x, 0);
  expect(nameBox!.y).toBeCloseTo(typeBox!.y, 0);
  expect(skillBox!.y).toBeCloseTo(serverBox!.y, 0);
  expect(skillBox!.y).toBeGreaterThan(nameBox!.y);
  const types = dialog.getByRole('combobox', { name: 'Tipo', exact: true });
  await types.click();
  await expect(page.getByRole('option').locator('img')).toHaveCount(26);
  await expect.poll(() => page.getByRole('option').locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.getByRole('option').allTextContents()).toEqual([
    'Arma', 'Munição', 'Carta de Arma', 'Escudo', 'Carta de Escudo', 'Topo', 'Meio', 'Baixo', 'Carta de Cabeça',
    'Pedra de Encantamento', 'Armadura', 'Carta de Armadura', 'Capa', 'Carta de Capa', 'Botas', 'Carta de Botas',
    'Acessório', 'Carta de Acessório', 'Pet', 'Visual', 'Arma Sombria', 'Armadura Sombria', 'Escudo Sombrio',
    'Botas Sombrias', 'Brinco Sombrio', 'Pingente Sombrio',
  ]);
  await page.getByRole('option', { name: 'Arma', exact: true }).click();
  await page.getByRole('option', { name: 'Escudo', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(types).toHaveText('Arma, Escudo');
  await dialog.getByRole('combobox', { name: 'Habilidade', exact: true }).click();
  expect(await page.getByRole('option').count()).toBeGreaterThan(0);
  await expect(page.getByRole('option').locator('img')).toHaveCount(await page.getByRole('option').count());
  await expect.poll(() => page.getByRole('option').locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.getByRole('option').first().click();
  await page.getByRole('option').nth(1).click();
  await page.keyboard.press('Escape');

  const firstBonus = dialog.getByRole('combobox', { name: 'Bônus 1', exact: true });
  await firstBonus.click();
  expect(await page.getByRole('option').allTextContents()).toEqual(ITEM_SEARCH_BONUS_OPTIONS.map(option => option.label));
  await page.getByRole('searchbox', { name: 'Filtrar opções' }).fill('Redução de Recarga');
  await page.getByRole('option', { name: 'Redução de Recarga', exact: true }).click();
  await expect(firstBonus).toHaveText('Redução de Recarga');
  for (let n = 0; n < 7; n++) await dialog.getByRole('button', { name: 'Adicionar bônus', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: /^Bônus \d+$/ })).toHaveCount(8);
  await dialog.getByRole('button', { name: 'Remover bônus 2', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: /^Bônus \d+$/ })).toHaveCount(7);
  await expect(firstBonus).toHaveText('Redução de Recarga');
  await dialog.locator('.item-search-bonus-row').first().getByRole('button', { name: 'Limpar seleção' }).click();
  await expect(firstBonus).toHaveText('Bônus 1');
  for (let n = 0; n < 6; n++) await dialog.getByRole('button', { name: 'Remover bônus 2', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Remover bônus 1' })).toHaveCount(0);
  const mode = dialog.getByRole('group', { name: 'Item deve incluir todos os bônus selecionados', exact: true });
  await mode.getByRole('button', { name: 'Sim', exact: true }).click();
  await expect(mode.getByRole('button', { name: 'Sim', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await mode.getByRole('button', { name: 'Não', exact: true }).click();
  await expect(mode.getByRole('button', { name: 'Não', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
});

test('name searches require submission, clear selection, preserve filters on reopen, and fit narrow screens', async ({ page }) => {
  const dialog = await openSearch(page);
  const name = dialog.getByRole('searchbox', { name: 'Nome', exact: true });
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(dialog.locator('tbody tr')).toHaveCount(14);
  await dialog.locator('tbody tr').first().click();
  await expect(dialog.locator('.item-description-meta')).toBeVisible();
  await name.fill('nome que não existe em nenhum item');
  await expect(dialog.locator('tbody tr')).toHaveCount(14);
  await name.press('Enter');
  await expect(dialog.locator('.item-description-meta')).toHaveCount(0);
  await expect(dialog.getByText('Nenhum item encontrado.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Buscar itens', exact: true }).click();
  await expect(name).toHaveValue('nome que não existe em nenhum item');
  await name.fill('');
  await name.press('Enter');
  await expect(dialog.locator('tbody tr')).toHaveCount(14);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await dialog.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(dialog.getByRole('combobox', { name: 'Tipo', exact: true })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Bônus 1', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Filtrar opções' }).fill('ATQ');
  await page.getByRole('searchbox', { name: 'Filtrar opções' }).press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Bônus 1', exact: true })).toBeFocused();
});

test('a selected item gains its formatted description when the delayed dataset arrives', async ({ page }) => {
  let pendingDescription: Route | undefined;
  await page.route('**/items-desc*.json', route => { pendingDescription = route; });
  const dialog = await openSearch(page);
  await expect.poll(() => !!pendingDescription).toBe(true);
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await dialog.locator('tbody tr').first().click();
  const idLink = dialog.getByRole('link', { name: /^Item ID:/ });
  const id = (await idLink.innerText()).replace('Item ID: ', '');
  await expect(dialog.locator('.item-search-description')).toBeEmpty();
  await pendingDescription!.fulfill({ json: { [id]: 'Descrição carregada após selecionar o item\n^FF0000<b>ATQ +10</b><script>window.itemSearchUnsafe = true</script>' } });
  await expect(dialog.locator('.item-search-description')).toContainText('Descrição carregada após selecionar o item');
  await expect(dialog.locator('.item-search-description b')).toHaveText('ATQ +10');
  await expect(dialog.locator('.item-search-description br')).toHaveCount(1);
  await expect(dialog.locator('.item-search-description font')).toHaveAttribute('color', '#FF0000');
  await expect(dialog.locator('.item-search-description script')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).itemSearchUnsafe)).toBeUndefined();
  await dialog.locator('tbody tr').first().click();
  await expect(dialog.locator('.item-description-meta')).toHaveCount(0);
});

const equipmentCard = (page: Page, label: string) => page.locator('.eq-card').filter({
  has: page.locator('.eq-card__label').filter({ hasText: new RegExp('^' + label + '$') }),
});

test('equipment picker opens full search with its type selected and equips the chosen item', async ({ page }) => {
  await page.goto('/');
  const card = equipmentCard(page, 'Topo');
  await card.getByRole('button', { name: 'Topo', exact: true }).click();
  await page.locator('.picker').getByRole('button', { name: 'Buscar itens', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Buscar itens/ });
  await expect(page.locator('.picker')).toHaveCount(0);
  await expect(dialog.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveText('Topo');
  await expect(dialog.locator('tbody tr')).toHaveCount(14);
  await dialog.locator('tbody tr').first().click();
  const id = (await dialog.getByRole('link', { name: /^Item ID:/ }).innerText()).replace('Item ID: ', '');
  await expect(dialog.getByRole('combobox', { name: 'Equipar em', exact: true })).toHaveCount(0);
  const descriptionGap = await dialog.locator('.item-description-text').evaluate(element =>
    element.getBoundingClientRect().top - element.closest('.item-description-card')!.querySelector('.item-search-equip')!.getBoundingClientRect().bottom);
  expect(descriptionGap).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Equipar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.locator('.eq-card__icon img').first()).toHaveAttribute('src', new RegExp('/' + id + '\.png$'));
  // The destination's normal picker must now identify the item as selected.
  await card.locator('.eq-chip--primary').first().click();
  await expect(page.locator('.picker__row--selected')).toContainText(await card.locator('.eq-chip--primary .eq-chip__text').first().innerText());
  await page.keyboard.press('Escape');
});

test('global search equips an accessory in the selected compatible side', async ({ page }) => {
  const dialog = await openSearch(page);
  await dialog.getByRole('searchbox', { name: 'Nome', exact: true }).fill('Broche');
  await dialog.getByRole('searchbox', { name: 'Nome', exact: true }).press('Enter');
  await dialog.locator('tbody tr').first().click();
  const id = (await dialog.getByRole('link', { name: /^Item ID:/ }).innerText()).replace('Item ID: ', '');
  const destination = dialog.getByRole('combobox', { name: 'Equipar em', exact: true });
  await destination.click();
  await page.getByRole('option', { name: 'Acess. Dir.', exact: true }).click();
  await dialog.getByRole('button', { name: 'Equipar', exact: true }).click();
  await expect(equipmentCard(page, 'Acess. Dir.').locator('.eq-card__icon img').first()).toHaveAttribute('src', new RegExp('/' + id + '\.png$'));
  await expect(equipmentCard(page, 'Acess. Esq.').locator('.eq-card__icon img')).toHaveCount(0);
});

test('full search from comparison equips only the comparison and cancellation preserves equipment', async ({ page }) => {
  await page.goto('/');
  const card = equipmentCard(page, 'Topo');
  await card.locator('.eq-card__compare').click();
  await card.locator('.eq-card__compare-row').getByRole('button', { name: 'Topo', exact: true }).click();
  const search = page.locator('.picker').getByRole('button', { name: 'Buscar itens', exact: true });
  // The full-search action remains usable by keyboard inside the picker.
  await search.focus(); await search.press('Enter');
  const dialog = page.getByRole('dialog', { name: /Buscar itens/ });
  await expect(dialog.getByRole('combobox', { name: 'Tipo', exact: true })).toHaveText('Topo');
  await dialog.locator('tbody tr').first().click();
  const id = (await dialog.getByRole('link', { name: /^Item ID:/ }).innerText()).replace('Item ID: ', '');
  await expect(dialog.getByRole('combobox', { name: 'Equipar em', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Equipar na comparação', exact: true }).click();
  await expect(card.locator('.eq-card__compare-row .eq-card__icon img')).toHaveAttribute('src', new RegExp('/' + id + '\.png$'));
  await expect(card.locator('.eq-card__body').first().locator('.eq-card__icon img')).toHaveCount(0);
  await card.locator('.eq-card__compare-row .eq-chip--primary').first().click();
  await page.locator('.picker').getByRole('button', { name: 'Buscar itens', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.picker')).toHaveCount(0);
  await expect(card.locator('.eq-card__compare-row .eq-card__icon img')).toHaveAttribute('src', new RegExp('/' + id + '\.png$'));
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('item list and description scroll independently while pagination stays visible', async ({ page }) => {
  let pendingDescription: Route | undefined;
  await page.route('**/items-desc*.json', route => { pendingDescription = route; });
  const dialog = await openSearch(page);
  await expect.poll(() => !!pendingDescription).toBe(true);
  await dialog.getByRole('button', { name: 'Buscar', exact: true }).click();
  await dialog.locator('tbody tr').first().click();
  const id = (await dialog.getByRole('link', { name: /^Item ID:/ }).innerText()).replace('Item ID: ', '');
  await pendingDescription!.fulfill({ json: { [id]: Array.from({ length: 200 }, (_, index) => 'Linha ' + index + ': descrição longa do item.').join('\n') } });
  await expect(dialog.locator('.item-search-description')).toContainText('Linha 199');
  const list = dialog.locator('.ui-datatable-wrapper');
  const detail = dialog.getByRole('region', { name: 'Descrição do item', exact: true });
  const pagination = dialog.getByRole('navigation', { name: 'Paginação', exact: true });
  const content = dialog.locator('.ui-dialog-content');
  // A phone scrolls the sheet as one and opens the description in a popover instead
  // (responsive-layout.spec.ts).
  for (const width of [1920]) {
    await page.setViewportSize({ width, height: 918 });
    const before = (await pagination.boundingBox())!;
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await detail.evaluate(element => { element.scrollTop = 0; });
    expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const detailBox = (await detail.boundingBox())!;
    await page.mouse.move(detailBox.x + detailBox.width / 2, detailBox.y + detailBox.height / 2);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => detail.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await detail.focus();
    await detail.press('End');
    await expect.poll(() => detail.evaluate(element => element.scrollTop + element.clientHeight >= element.scrollHeight - 1)).toBe(true);
    expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await detail.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await content.evaluate(element => element.scrollTop)).toBe(0);
    await expect(pagination).toBeInViewport({ ratio: 1 });
    const after = (await pagination.boundingBox())!;
    expect(after.y).toBeCloseTo(before.y, 0);
    const panel = (await dialog.locator('.item-search-list').boundingBox())!;
    expect(Math.abs(panel.y + panel.height - after.y - after.height)).toBeLessThanOrEqual(2);
    expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  const firstItem = await dialog.locator('tbody tr').first().innerText();
  await pagination.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await expect(dialog.locator('tbody tr').first()).not.toHaveText(firstItem);
  for (let count = 0; count < 7; count++) await dialog.getByRole('button', { name: 'Adicionar bônus', exact: true }).click();
  const lastPicker = (await dialog.locator('.item-search-bonus-row').last().locator('.ui-dropdown').boundingBox())!;
  const add = (await dialog.getByRole('button', { name: 'Adicionar bônus', exact: true }).boundingBox())!;
  expect(Math.abs(lastPicker.y + lastPicker.height / 2 - add.y - add.height / 2)).toBeLessThanOrEqual(1);
  expect(add.x - lastPicker.x - lastPicker.width).toBeGreaterThanOrEqual(0);
  expect(add.x - lastPicker.x - lastPicker.width).toBeLessThan(16);
  await expect(pagination).toBeInViewport({ ratio: 1 });
  expect(await content.evaluate(element => element.scrollTop)).toBe(0);
});

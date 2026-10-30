import { expect, test } from '@playwright/test';

// Tracker guMcAuwzoEK5CyIY4CZ6: filtering must never change build selections or their indices.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ro-right-accordion-active', '[]');
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
});

test('consumable search matches abbreviations and accents, clears, and retains selected items', async ({ page }) => {
  await page.getByRole('button', { name: 'Consumíveis', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Consumíveis', exact: true });
  const search = panel.getByRole('searchbox', { name: 'Buscar consumíveis', exact: true });
  const options = panel.locator('.consumable-stack').getByRole('option');
  const total = await options.count();
  expect(total).toBeGreaterThan(1);
  const target = options.nth(1);
  const label = (await target.locator('.text_ellips').textContent())!.trim();
  const fuzzyQuery = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split('').filter((_, index) => index % 2 === 0).join('');
  await search.fill(fuzzyQuery);
  const filteredTarget = panel.getByRole('option', { name: label, exact: true });
  await expect(filteredTarget).toBeVisible();
  await filteredTarget.click();
  await expect(filteredTarget).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).consumables.length)).toBeGreaterThan(0);
  const selection = await page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).consumables);
  await search.fill('zzzzzzzzzzzzzzzzzzzzzz');
  await expect(panel.getByRole('status')).toHaveText('Nenhum resultado encontrado.');
  await panel.getByRole('button', { name: 'Limpar busca de consumíveis' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(options).toHaveCount(total);
  await expect(panel.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).consumables)).toEqual(selection);
  await page.setViewportSize({ width: 390, height: 844 });
  // A phone shows the sections behind the bottom bar's "Resultado" tab.
  await page.getByRole('button', { name: 'Resultado', exact: true }).click();
  await search.scrollIntoViewIfNeeded();
  const bounds = await search.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '.tmp/panel-search-mobile.png' });
});

test('filtered buffs update their original model index and remain selected after clearing', async ({ page }) => {
  await page.getByRole('button', { name: 'Habilidades', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Habilidades', exact: true });
  const search = panel.getByRole('searchbox', { name: 'Buscar habilidades e buffs', exact: true });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillBuffs);
  await search.fill('BNCAO');
  const blessing = panel.locator('.skill-control-row').filter({ hasText: /^Bênção/ }).first();
  await expect(blessing).toBeVisible();
  await blessing.getByRole('combobox').click();
  await page.getByRole('option', { name: /10/ }).last().click();
  const selected = await blessing.getByRole('combobox').textContent();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillBuffs[1])).toBe(10);
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!));
  expect(model.skillBuffs[1]).toBe(10); // Bênção is the second shared buff, even when it is the first visible row.
  expect(model.skillBuffs[0]).toBe(before[0]);
  await search.fill('zzzzzzzzzzzzzzzzzzzzzz');
  await expect(panel.getByRole('status')).toBeVisible();
  await panel.getByRole('button', { name: 'Limpar busca de habilidades e buffs' }).click();
  await expect(blessing.getByRole('combobox')).toHaveText(selected!);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ro-set')!).skillBuffs)).toEqual(model.skillBuffs);
  await page.screenshot({ path: '.tmp/panel-search-desktop.png' });
});

test('dropdown search clears from the keyboard without changing its selection', async ({ page }) => {
  await page.getByRole('button', { name: 'Consumíveis', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Consumíveis', exact: true });
  const potion = panel.locator('.consumable-aspd-field').getByRole('combobox');
  const selected = await potion.textContent();
  await potion.click();
  const input = page.getByRole('searchbox', { name: 'Filtrar opções' });
  await input.fill('ZZZZZZZZ');
  await expect(page.locator('.ui-select-pane').getByRole('option')).toHaveCount(0);
  await input.press('Tab');
  const clear = page.getByRole('button', { name: 'Limpar busca', exact: true });
  await expect(clear).toBeFocused();
  await clear.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  expect(await page.locator('.ui-select-pane').getByRole('option').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(potion).toHaveText(selected!);
});

test('equipment chip pickers use the same fuzzy filter and can clear it', async ({ page }) => {
  const card = page.locator('.eq-card').filter({ has: page.locator('.eq-card__label').filter({ hasText: /^Topo$/ }) });
  await card.getByRole('button', { name: 'Topo', exact: true }).click();
  const picker = page.locator('.picker');
  const input = picker.getByPlaceholder('Filtrar…');
  await input.fill('CHPEU');
  await expect(picker.locator('.picker__label').filter({ hasText: /Chapéu/ }).first()).toBeVisible();
  await input.fill('ZZZZZZZZZZZZZZZZZZZZ');
  await expect(picker.getByText('Nada encontrado.', { exact: true })).toBeVisible();
  const clear = picker.getByRole('button', { name: 'Limpar busca', exact: true });
  await clear.focus();
  await clear.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(picker.getByText('Nada encontrado.', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(card.locator('.eq-card__icon img')).toHaveCount(0);
});

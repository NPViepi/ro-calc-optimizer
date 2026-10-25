import { expect, Page, test } from '@playwright/test';
import fixtures from '../src/app/core/uri-compression.fixtures.json';

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ro-right-accordion-active', '[]'));
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
}

test('modal focus cycles in both directions and returns to its trigger', async ({ page }) => {
  await boot(page);
  const trigger = page.getByRole('button', { name: 'Meus itens', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  const focusables = dialog.locator('button, input, select, textarea, a[href], [tabindex]').filter({ visible: true });
  const enabled = await focusables.evaluateAll(elements => elements.filter(el => (el as HTMLElement).tabIndex >= 0 && !el.matches(':disabled')).map(el => ({ tag: el.tagName, text: el.textContent })));
  expect(enabled.length).toBeGreaterThan(2);
  const first = dialog.getByRole('button', { name: 'Fechar', exact: true });
  await first.focus(); await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab'); await expect(first).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await expect(page.locator('.ui-overlay-host')).toHaveCount(0);
});

test('equipment virtualization reaches the last row and resets after filtering', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Topo', exact: true }).click();
  const filter = page.getByPlaceholder('Filtrar…');
  const viewport = page.locator('app-virtual-list');
  await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(1000);
  expect(await viewport.locator('.picker__row').count()).toBeLessThan(30);
  await filter.fill('Kiwawa');
  await expect(page.locator('.picker__row').filter({ hasText: 'Kiwawa' })).toBeVisible();
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Topo', exact: true })).toBeFocused();
});

async function rotation(page: Page) {
  await boot(page);
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
  const hud = page.locator('app-rotation-list');
  await hud.getByRole('button', { name: 'Adicionar habilidade', exact: true }).click();
  await hud.locator('.rot-add-dd').click();
  await page.getByPlaceholder('Buscar por nome ou ID').fill('Ataque básico');
  await page.getByRole('option', { name: 'Ataque básico', exact: false }).click();
  await expect(hud.locator('.rot-row')).toHaveCount(1, { timeout: 40_000 });
  await hud.getByRole('button', { name: 'Adicionar habilidade', exact: true }).click();
  await hud.locator('.rot-add-dd').click();
  // The skill picker's options; a native <select> elsewhere on the page has options too.
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options.nth(1)).toBeVisible(); await options.nth(1).click();
  await expect(hud.locator('.rot-row')).toHaveCount(2);
  return hud;
}

test('rotation handles reorder by mouse and keyboard while preserving entries', async ({ page }) => {
  const hud = await rotation(page);
  const names = await hud.locator('.rot-row .rot-name').allTextContents();
  const handles = hud.locator('.rot-handle');
  const source = await handles.first().boundingBox();
  const target = await handles.last().boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height, { steps: 10 });
  await page.mouse.up();
  await expect(hud.locator('.rot-row .rot-name')).toHaveText([...names].reverse());
  await handles.first().press('ArrowDown');
  await expect(hud.locator('.rot-row .rot-name')).toHaveText(names);
  await expect(page.locator('.ui-drag-preview, .ui-drag-placeholder')).toHaveCount(0);
});

test('rotation handles support touch dragging and cancellation', async ({ page, context }) => {
  const hud = await rotation(page);
  const names = await hud.locator('.rot-row .rot-name').allTextContents();
  const handles = hud.locator('.rot-handle');
  await handles.first().scrollIntoViewIfNeeded();
  const source = await handles.first().boundingBox(); const target = await handles.last().boundingBox();
  const session = await context.newCDPSession(page);
  const x = source!.x + source!.width / 2;
  const firstY = source!.y + source!.height / 2;
  const lastY = target!.y + target!.height;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: firstY }] });
  for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: firstY + (lastY - firstY) * step / 8 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(hud.locator('.rot-row .rot-name')).toHaveText([...names].reverse());
  const handle = await handles.first().boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down(); await page.mouse.move(handle!.x, handle!.y + 40, { steps: 5 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(hud.locator('.rot-row .rot-name')).toHaveText([...names].reverse());
  await expect(page.locator('.ui-drag-preview, .ui-drag-placeholder')).toHaveCount(0);
  await session.detach();
});

test('direct historical share entry survives bootstrap and loads the lazy route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ro-right-accordion-active', '[]'));
  await page.goto(`/s/${fixtures.builds[0].token}/`);
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByRole('combobox').filter({ hasText: /^230$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeVisible();
});

test('connected equipment picker clamps after resize and closes on an outside click', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Topo', exact: true }).click();
  await expect(page.getByPlaceholder('Filtrar…')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const pane = page.locator('.ui-overlay-pane').filter({ has: page.getByPlaceholder('Filtrar…') });
  await expect.poll(async () => {
    const box = await pane.boundingBox();
    return !!box && box.x >= 7 && box.y >= 7 && box.x + box.width <= 383 && box.y + box.height <= 837;
  }).toBe(true);
  await page.locator('app-virtual-list').evaluate(el => { el.scrollTop = 2000; });
  await expect(pane).toBeVisible();
  await page.mouse.click(3, 3);
  await expect(page.getByPlaceholder('Filtrar…')).toHaveCount(0);
  await expect(page.locator('.ui-overlay-host')).toHaveCount(0);
});

import { expect, Page, test } from '@playwright/test';

async function boot(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ro-right-accordion-active', '[]'));
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Importar', exact: true }).waitFor();
}
// How far the page reaches past the viewport, with the elements responsible.
const pageOverflow = async (page: Page) => {
  const { overflow, culprits } = await page.evaluate(() => {
    const root = document.documentElement;
    const culprits = [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > root.clientWidth + 0.5)
      .slice(0, 5).map(element => `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, '.')}`);
    return { overflow: root.scrollWidth - root.clientWidth, culprits };
  });
  expect(culprits, `overflowing by ${overflow}px`).toEqual([]);
  return overflow;
};

for (const width of [320, 390, 768, 1024, 1119, 1120, 1280, 1920]) {
  test(`the page never scrolls sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    if (width < 1120) await page.getByRole('button', { name: 'Resultado', exact: true }).click();
    await page.getByRole('button', { name: 'Batalha', exact: true }).click();
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });
}

test('desktop keeps the 7 : 5 columns at every width and hides the pane switcher', async ({ page }) => {
  for (const width of [1120, 1280, 1366, 1440, 1530, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1120) await boot(page);
    await expect(page.locator('.calc-panes')).toBeHidden();
    const build = (await page.locator('.calc-col--build').boundingBox())!;
    const result = (await page.locator('.calc-col--result').boundingBox())!;
    expect(build.width / result.width).toBeCloseTo(7 / 5, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});

test('a desktop wide enough for the old 1500px floor keeps that layout', async ({ page }) => {
  // From 1545px the old 1500px calculator fits beside the gutters and a classic scrollbar.
  for (const width of [1545, 1600, 1720]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1545) await boot(page);
    await expect(page.locator('.char_band')).toHaveCSS('flex-wrap', 'nowrap');
    const skillColumns = await page.locator('.skill-panel .calc-panel-section').first()
      .evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(skillColumns).toBe(3);
  }
});

test('a tablet switches between the build and the result', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await boot(page);
  await expect(page.getByRole('button', { name: 'Equip.', exact: true })).toBeHidden();
  await expect(page.locator('app-equipment-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Batalha', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Resultado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Batalha', exact: true })).toBeVisible();
  await expect(page.locator('app-equipment-grid')).toBeHidden();
  // The switcher stays under the topbar while the pane scrolls.
  const switcher = page.locator('.calc-panes');
  await expect(switcher).toHaveCSS('position', 'sticky');
  expect(parseFloat(await switcher.evaluate(element => getComputedStyle(element).top))).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Resultado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // The sections column keeps the accordion's multiple-open behaviour.
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
  await page.getByRole('button', { name: 'PVP', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Batalha', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'PVP', exact: true })).toBeVisible();
});

test('a phone splits build, equipment and result into bottom tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const bar = page.locator('.calc-panes');
  await expect(bar).toHaveCSS('position', 'fixed');
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeCloseTo(844, 0);
  // The page reserves the bar's height, so its last content is never under it.
  const reserved = await page.locator('.layout-main-container').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom));
  expect(reserved).toBeGreaterThanOrEqual(box.height);
  await expect(page.locator('app-equipment-grid')).toBeHidden();
  await page.getByRole('button', { name: 'Equip.', exact: true }).click();
  await expect(page.locator('app-equipment-grid')).toBeVisible();
  await expect(page.locator('.stats_stack')).toBeHidden();
  // Search and the menu stay in the topbar as 44px targets; save and link live in the build card.
  for (const name of ['Buscar itens', 'Menu']) {
    const button = page.locator('app-topbar').getByRole('button', { name, exact: true });
    const target = (await button.boundingBox())!;
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('app-topbar').getByRole('button', { name: 'Salvar simulação' })).toHaveCount(0);
});

test('a phone folds each summary group behind its header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const toggle = page.locator('.ss_group_toggle').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const firstLabel = page.locator('.ss_col').first().locator('.ss_label').first();
  await expect(firstLabel).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(firstLabel).toBeHidden();
  // A wider screen always shows every group.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(firstLabel).toBeVisible();
  await expect(toggle).toBeHidden();
});

test('the phone menu lists every hidden topbar action as a full-width row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const rows = page.getByRole('navigation', { name: 'Menu' }).locator('.topbar-menu-row');
  await expect(rows).toHaveCount(8);
  let previousBottom = 0;
  for (const row of await rows.all()) {
    const box = (await row.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    previousBottom = box.y + box.height;
  }
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('a tap opens a value tooltip and an outside tap closes it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await boot(page);
    const points = page.locator('.ss_value_text:not(.bonus_clickable)').first();
    await expect(points).toHaveAttribute('tabindex', '0');
    await points.scrollIntoViewIfNeeded();
    await points.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.locator('.eq-grid__group-label').first().tap();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('touch shows hover-only affordances', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches);
    test.skip(!hoverNone, 'this browser does not report (hover: none) with touch emulation');
    await page.getByRole('button', { name: 'Resultado', exact: true }).click();
    await expect(page.locator('.bonus_clickable').first()).toHaveCSS('text-decoration-style', 'dotted');
    // The underline is there on touch (a mouse only sees it on hover): not transparent.
    await expect(page.locator('.bonus_clickable').first()).not.toHaveCSS('text-decoration-color', 'rgba(0, 0, 0, 0)');
  });

  test('a phone rotation fits, with tap buttons standing in for the drag handle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.getByRole('button', { name: 'Resultado', exact: true }).click();
    await page.getByRole('button', { name: 'Batalha', exact: true }).click();
    const hud = page.locator('app-rotation-list');
    for (const index of [0, 1, 1]) {
      await hud.getByRole('button', { name: 'Adicionar habilidade', exact: true }).first().click();
      await hud.locator('.rot-add-dd').click();
      await page.locator('[role=option]:visible').nth(index).click();
    }
    await expect(hud.locator('.rot-row')).toHaveCount(3);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    const names = await hud.locator('.rot-name').allTextContents();
    // Batalha keeps its desktop sizes on touch: the buttons are there, not finger-sized.
    const down = hud.getByRole('button', { name: /^Mover .* para baixo$/ }).first();
    await expect(down).toBeVisible();
    await down.tap();
    await expect(hud.locator('.rot-name').first()).toHaveText(names[1]);
  });

  test('a phone item search folds its filters after a search and reopens them from the heading', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.getByRole('button', { name: 'Buscar itens', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    const toggle = dialog.getByRole('button', { name: 'Filtros', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const list = dialog.locator('.ui-datatable-wrapper');
    const before = (await list.boundingBox())!.height;
    await dialog.getByRole('button', { name: 'Buscar', exact: true }).tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.getByLabel('Nome', { exact: true })).toBeHidden();
    await expect(toggle).toBeFocused();
    expect((await list.boundingBox())!.height).toBeGreaterThan(before + 150);
    await expect(dialog.getByRole('navigation', { name: 'Paginação', exact: true })).toBeInViewport({ ratio: 1 });
    await toggle.tap();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByLabel('Nome', { exact: true })).toBeVisible();
  });

  test('a phone item search is a bottom sheet that scrolls as one and opens descriptions in a popover', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.getByRole('button', { name: 'Buscar itens', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: /Buscar itens/ });
    await dialog.getByRole('button', { name: 'Buscar', exact: true }).tap();
    const sheet = (await dialog.boundingBox())!;
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    // Edge to edge, less a classic scrollbar where the desktop browser draws one.
    expect(sheet.width).toBeGreaterThanOrEqual(viewport.width - 17);
    expect(Math.abs(sheet.y + sheet.height - viewport.height)).toBeLessThanOrEqual(1);
    const content = dialog.locator('.ui-dialog-content');
    const list = dialog.locator('.ui-datatable-wrapper');
    expect(await list.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);
    await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(dialog.getByRole('navigation', { name: 'Paginação', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(dialog.locator('.item-search-detail')).toHaveCount(0);
    const name = (await dialog.locator('tbody tr').nth(1).innerText()).trim();
    await dialog.locator('tbody tr').nth(1).tap();
    const popover = page.getByRole('region', { name: 'Descrição do item', exact: true });
    await expect(popover.locator('strong').first()).toHaveText(name);
    await expect(popover.getByRole('button', { name: 'Equipar', exact: true })).toBeVisible();
    await page.locator('.item-search-detail-popover').getByRole('button', { name: 'Fechar', exact: true }).tap();
    await expect(popover).toHaveCount(0);
    await expect(dialog).toBeVisible();
  });

  test('a filled chip keeps a tappable clear button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches);
    test.skip(!hoverNone, 'this browser does not report (hover: none) with touch emulation');
    await page.getByRole('button', { name: 'Equip.', exact: true }).click();
    await page.getByRole('button', { name: 'Arma', exact: true }).first().tap();
    await page.locator('.picker__row').filter({ hasText: 'Carabina' }).first().tap();
    const clear = page.getByRole('button', { name: 'Remover Carabina', exact: true });
    const box = (await clear.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    await clear.tap();
    await expect(clear).toHaveCount(0);
  });

  test('a phone comparison row keeps its item names whole', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await boot(page);
    const hoverNone = await page.evaluate(() => matchMedia('(hover: none)').matches);
    test.skip(!hoverNone, 'this browser does not report (hover: none) with touch emulation');
    await page.getByRole('button', { name: 'Equip.', exact: true }).click();
    await page.getByRole('button', { name: 'Arma', exact: true }).first().tap();
    await page.locator('.picker__row').filter({ hasText: 'Carabina' }).first().tap();
    await page.locator('.eq-card__compare').first().tap();
    const row = page.locator('.eq-card__compare-row').first();
    await row.locator('.eq-chip').nth(1).tap();
    await page.locator('.picker__row').filter({ hasText: 'Carabina' }).first().tap();
    const names = await row.locator('.eq-chip__text').evaluateAll(texts => texts.map(text => text.scrollWidth - text.clientWidth));
    expect(names.length).toBeGreaterThan(0);
    for (const cut of names) expect(cut).toBeLessThanOrEqual(0);
    // The swap and clear buttons sit on their own line, so nothing covers the chips.
    const actions = (await row.locator('.eq-card__compare-actions').boundingBox())!;
    const chips = (await row.locator('.eq-card__chips').boundingBox())!;
    expect(chips.y).toBeGreaterThanOrEqual(actions.y + actions.height);
  });
});

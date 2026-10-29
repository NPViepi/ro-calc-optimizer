import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ro-right-accordion-active', '[]'));
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
});

for (const width of [1920, 390]) {
  test(`auto-cast shared monster card keeps its layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 918 });
    // A phone shows one pane at a time; the sections live behind the Resultado tab.
    if (width < 768) await page.getByRole('button', { name: 'Resultado', exact: true }).click();
    await page.getByRole('button', { name: 'Auto-conjuração', exact: true }).click();
    const section = page.getByRole('region', { name: 'Auto-conjuração', exact: true });
    // The element also carries the incoming-damage card below the monster one,
    // so every assertion here addresses the monster card itself.
    const card = section.locator('app-battle-monster-card .hud-card');
    await expect(card.locator('.hud-monster-head')).toHaveCSS('display', 'flex');
    await expect(card.locator('.hud-mstats')).toHaveCSS('display', 'grid');
    await expect(card.locator('.ui-card-body').first()).toHaveCSS('padding', '0px');
    const box = (await card.boundingBox())!;
    if (width === 390) {
      // On a phone the card fits the screen, and the stat band stacks under the
      // portrait instead of squeezing beside it.
      await expect(card.locator('.ui-card-content').first()).toHaveCSS('display', 'block');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    } else {
      await expect(card.locator('.ui-card-content').first()).toHaveCSS('display', 'flex');
      expect(box.height).toBeLessThan(400);
    }
    const stats = (await card.locator('.hud-band-right').boundingBox())!;
    expect(stats.x + stats.width).toBeLessThanOrEqual(box.x + box.width);
    await expect(section.getByRole('link', { name: 'Bug ou sugestão', exact: true })).toHaveClass(/ui-button/);
    await expect(section.getByRole('button', { name: 'Fórmula ou cálculo', exact: true })).toBeVisible();
  });
}

test('custom-item library and editor keep icons inline and preview in its column', async ({ page }) => {
  await page.getByRole('button', { name: 'Meus itens', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const headerIcon = dialog.locator('.ui-dialog-header img');
  await expect(headerIcon).toHaveCSS('position', 'static');
  // `.item_img` sets a height and leaves the width to the PNG, so the icon is zero wide
  // until it loads and the heading sits where the icon is about to be. Wait for the load
  // and read both boxes at one moment, or a cold icon fetch reads them a frame apart.
  await expect(headerIcon).toHaveJSProperty('complete', true);
  const [icon, heading] = await dialog.locator('.ui-dialog-header').evaluate((header) => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return [box(header.querySelector('img')!), box(header.querySelector('strong')!)];
  });
  expect(icon.x + icon.width).toBeLessThanOrEqual(heading.x);
  expect(Math.abs(icon.y + icon.height / 2 - heading.y - heading.height / 2)).toBeLessThan(2);
  await dialog.getByRole('button', { name: 'Novo item', exact: false }).click();
  await expect(headerIcon).toHaveCSS('position', 'static');
  await expect(dialog.locator('.studio-preview .item_img').first()).toHaveCSS('position', 'static');
  const editor = (await dialog.locator('.studio-main').boundingBox())!;
  const preview = (await dialog.locator('.studio-preview').boundingBox())!;
  expect(preview.x).toBeGreaterThanOrEqual(editor.x + editor.width);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.locator('.studio-preview')).toBeHidden();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390);
});

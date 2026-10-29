import { expect, test } from '@playwright/test';

test('splash paints while styles load and the editor waits for them', async ({ page }) => {
  let finishStyles!: () => void;
  const stylesPending = new Promise<void>(resolve => { finishStyles = resolve; });
  await page.route('**/*.css', async route => { await stylesPending; await route.continue(); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#ro-splash')).toBeVisible();
  await expect(page.locator('html')).toHaveCSS('font-size', '14px');
  await expect(page.locator('app-ro-calculator')).toHaveCount(0);
  finishStyles();
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'ATQ 26', exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(23, 33, 47)');
});

test('calculator becomes usable before optional descriptions and history arrive', async ({ page }) => {
  let finishDescriptions!: () => void;
  const descriptionsPending = new Promise<void>(resolve => { finishDescriptions = resolve; });
  const requested: string[] = [];
  page.on('request', request => requested.push(request.url()));
  await page.route('**/assets/data/*-desc*.json', async route => { await descriptionsPending; await route.continue(); });
  await page.route('**/assets/data/skill-descriptions*.json', async route => { await descriptionsPending; await route.continue(); });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'ATQ 26', exact: true })).toBeVisible();

  // A production build injects the manifest into the page (tools/inject-data-manifest.mjs);
  // the development server does not, and the app fetches assets/data-manifest.json instead.
  const files = await page.evaluate(async () => {
    const boot = window as Window & { __RO_DATA__?: { files: Record<string, string> } };
    return boot.__RO_DATA__?.files ?? (await (await fetch('assets/data-manifest.json')).json()).files as Record<string, string>;
  });
  expect(files).toBeDefined();
  await expect.poll(() => requested.some(url => url.includes(files!.skillDescriptions))).toBe(true);
  const preloadLinks = await page.locator('link[rel="modulepreload"]').evaluateAll(links => links.map(link => (link as HTMLLinkElement).href));
  const initialChunks = requested.filter(url => /\/chunk-.*\.js$/.test(url));
  expect(initialChunks.every(url => preloadLinks.includes(url))).toBe(true);

  finishDescriptions();
  await page.getByRole('button', { name: 'Novidades', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Histórico original (pré-fork) →')).toBeVisible();
  await expect(page.getByRole('dialog').locator('li')).not.toHaveCount(0);
  expect(requested.filter(url => /\/chunk-.*\.js$/.test(url)).some(url => !preloadLinks.includes(url))).toBe(true);
});

test('hover descriptions refresh when the deferred datasets arrive', async ({ page }) => {
  let finishSkills!: () => void;
  let finishItems!: () => void;
  const skillsPending = new Promise<void>(resolve => { finishSkills = resolve; });
  const itemsPending = new Promise<void>(resolve => { finishItems = resolve; });
  await page.route('**/assets/data/skill-descriptions*.json', async route => { await skillsPending; await route.continue(); });
  // items-desc.json on the development server, items-desc.<hash>.json in a production build.
  await page.route(/\/assets\/data\/items-desc(\.[\w-]+)?\.json$/, async route => {
    await itemsPending;
    await route.fulfill({ json: { 401147: 'Descrição do item carregada depois do primeiro cálculo.' } });
  });
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40_000 });
  await page.getByRole('button', { name: 'Habilidades', exact: true }).click();
  const blessing = page.locator('.skill-control-label').filter({ hasText: 'Bênção' });
  await blessing.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Bênção');
  await expect(tooltip).not.toContainText('Nível máximo:');
  finishSkills();
  // The open tooltip must replace its cached fallback without another mouse move.
  await expect(tooltip).toContainText('Nível máximo:');
  await expect(tooltip).toContainText('Maldição');
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);

  await page.getByRole('button', { name: 'Topo', exact: true }).click();
  await page.getByPlaceholder('Filtrar…').fill('Kiwawa');
  await page.locator('.picker__row').filter({ hasText: 'Kiwawa' }).hover();
  await expect(tooltip).toContainText('Kiwawa');
  await expect(tooltip).not.toContainText('Descrição do item carregada');
  finishItems();
  await expect(tooltip).toContainText('Descrição do item carregada depois do primeiro cálculo.');
});

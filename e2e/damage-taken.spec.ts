import { expect, Page, test } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('#ro-splash')).toHaveCount(0, { timeout: 40000 });
  // Below 1120px the sections sit behind the "Resultado" pane.
  if ((page.viewportSize()?.width ?? 1920) < 1120) await page.getByRole('button', { name: 'Resultado', exact: true }).click();
  await page.getByRole('button', { name: 'Batalha', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('monster', '20994');
    localStorage.setItem('ro-right-accordion-active', '[]');
    localStorage.setItem('ro-set', JSON.stringify({ class: 4256, level: 240, jobLevel: 1, shield: 2102, shieldCard: 4253, armor: 2345, armorCard: 4119 }));
  });
});

test('Betelgeuse damage card is collapsible, lists seven unique skills plus basic attack and reads the equipped armor card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  const toggle = page.getByRole('button', { name: 'Dano recebido', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const monsterCard = page.locator('app-battle-monster-card .hud-card:visible');
  const card = page.locator('app-battle-monster-card .damage-taken-card:visible');
  const monsterBounds = await monsterCard.boundingBox();
  const cardBounds = await card.boundingBox();
  expect(cardBounds!.y).toBeGreaterThanOrEqual(monsterBounds!.y + monsterBounds!.height);
  await toggle.focus(); await page.keyboard.press('Enter');
  const region = page.getByRole('region', { name: 'Dano recebido', exact: true });
  await expect(region).toBeVisible();
  await expect(region.getByRole('combobox', { name: 'Elemento da armadura' })).toContainText('Equipamento (Sombrio)');
  const picker = region.getByRole('combobox', { name: 'Ataque do monstro' });
  await picker.click();
  // Scoped to the picker's list: the skill formula selector is a native select whose
  // options are in the page too.
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(8);
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Ataque básico', exact: true })).toHaveCount(1);
  await page.getByRole('option', { name: 'Ataque Sombrio · Nv. 10', exact: true }).click();
  await expect(region.locator('.damage-taken-result strong')).toHaveText('0');
  await toggle.click();
  await expect(region).toBeHidden();
  expect(errors).toEqual([]);
});

test('basic attack is a physical melee hit with no skill level and ignores a previous armor-property override', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Dano recebido', exact: true }).click();
  const region = page.getByRole('region', { name: 'Dano recebido', exact: true });
  const picker = region.getByRole('combobox', { name: 'Ataque do monstro' });
  await region.getByRole('combobox', { name: 'Elemento da armadura' }).click();
  await page.getByRole('option', { name: 'Fantasma 1', exact: true }).click();
  await picker.click(); await page.getByRole('option', { name: 'Ataque básico', exact: true }).click();
  await expect(picker).toHaveText('Ataque básico');
  await expect(region.getByText('Dano por ataque básico', { exact: true })).toBeVisible();
  await expect(region.locator('.damage-taken-badges')).toHaveText('FísicoSem propriedadeCorpo a corpo');
  await expect(region.getByRole('combobox', { name: 'Elemento da armadura' })).toHaveCount(0);
  await expect(region.getByRole('link', { name: 'Ver monstro no Divine Pride' })).toHaveAttribute('href', 'https://www.divine-pride.net/database/monster/20994');
  const result = region.locator('.damage-taken-result strong');
  const ghostDamage = await result.textContent();
  await expect(result).not.toHaveText('0');
  await picker.click(); await page.getByRole('option', { name: 'Cometa · Nv. 4', exact: true }).click();
  await region.getByRole('combobox', { name: 'Elemento da armadura' }).click();
  await page.getByRole('option', { name: 'Equipamento (Sombrio)', exact: true }).click();
  await picker.click(); await page.getByRole('option', { name: 'Ataque básico', exact: true }).click();
  await expect(result).toHaveText(ghostDamage!);
  await region.getByText('Fórmula e reduções', { exact: true }).click();
  await region.getByRole('button', { name: 'Redução Chefe', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Carta Alice');
});

test('Earthquake target count changes damage and Aura remains fixed; reductions open the current equipment breakdown', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Dano recebido', exact: true }).click();
  const region = page.getByRole('region', { name: 'Dano recebido', exact: true });
  const picker = region.getByRole('combobox', { name: 'Ataque do monstro' });
  await region.getByText('Fórmula e reduções', { exact: true }).click();
  await region.getByRole('button', { name: 'Redução Chefe', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Carta Alice');
  await page.keyboard.press('Escape');
  await picker.click(); await page.getByRole('option', { name: 'Terremoto · Nv. 4', exact: true }).click();
  await expect(region.locator('.damage-taken-result strong')).toHaveText('198.216 – 291.792');
  await region.getByRole('combobox', { name: 'Alvos vivos na área' }).click();
  await page.getByRole('option', { name: '4', exact: true }).click();
  await expect(region.locator('.damage-taken-result strong')).toHaveText('49.554 – 72.948');
  await picker.click(); await page.getByRole('option', { name: 'Aura Assassina · Nv. 4', exact: true }).click();
  await expect(region.locator('.damage-taken-result strong')).toHaveText('10.000');
  await expect(region.getByRole('combobox', { name: 'Alvos vivos na área' })).toHaveCount(0);
});

test('a monster without a skill catalog offers only its basic attack', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('monster', '21361'));
  await boot(page);
  await page.getByRole('button', { name: 'Dano recebido', exact: true }).click();
  const region = page.getByRole('region', { name: 'Dano recebido', exact: true });
  await region.getByRole('combobox', { name: 'Ataque do monstro' }).click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('listbox').getByRole('option', { name: 'Ataque básico', exact: true })).toBeVisible();
});

test('the shared auto-cast monster card uses the current build for incoming reduction breakdowns', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Auto-conjuração', exact: true }).click();
  const section = page.getByRole('region', { name: 'Auto-conjuração', exact: true });
  await section.getByRole('button', { name: 'Dano recebido', exact: true }).click();
  await section.getByText('Fórmula e reduções', { exact: true }).click();
  await section.getByRole('button', { name: 'Redução Chefe', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Carta Alice');
});

test('damage inputs and formula remain inside the card on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.getByRole('button', { name: 'Dano recebido', exact: true }).click();
  const region = page.getByRole('region', { name: 'Dano recebido', exact: true });
  await expect(region.getByRole('combobox', { name: 'Ataque do monstro' })).toBeVisible();
  const bounds = await region.boundingBox();
  const cardBounds = await region.locator('xpath=ancestor::app-ui-card').boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(cardBounds!.width);
  expect(await region.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

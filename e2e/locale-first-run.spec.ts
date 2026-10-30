import { expect, test } from '@playwright/test';

/**
 * The suite opens with `ro-locale` already set (see playwright.config.ts), so every
 * test here clears it first: a first visit is exactly the absence of that key.
 */
const firstVisit = { storageState: { cookies: [], origins: [] } };

test.describe('first-run language dialog', () => {
  test.use(firstVisit);

  test('asks once, in all three languages, and will not be waved away', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('.locale-first-run');
    await expect(dialog).toBeVisible();

    // The question is printed three times because the reader's language is the one
    // thing still unknown; the options name themselves for the same reason.
    await expect(dialog.getByText('Escolha seu idioma')).toBeVisible();
    await expect(dialog.getByText('Elige tu idioma')).toBeVisible();
    await expect(dialog.getByText('Choose your language')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'OK' })).toBeVisible();
    await expect(dialog.locator('.ui-dialog-header-close')).toHaveCount(0);

    // Escape and a click on the backdrop both leave it where it is.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ro-locale'))).toBeNull();
  });

  test('defaults to Portuguese and records that answer', async ({ page }) => {
    await page.goto('/');
    await page.locator('.locale-first-run').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.locale-first-run')).toHaveCount(0);
    // Portuguese is the default AND a legitimate answer, so it has to be written down;
    // otherwise the dialog cannot tell the two apart on the next visit.
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ro-locale'))).toBe('pt-BR');

    await page.reload();
    await expect(page.locator('.locale-first-run')).toHaveCount(0);
  });

  test('switches the interface to the language picked before OK', async ({ page }) => {
    await page.goto('/');
    const dialog = page.locator('.locale-first-run');
    await dialog.locator('.ui-select-trigger').click();
    await page.getByRole('option', { name: 'English' }).click();
    await dialog.getByRole('button', { name: 'OK' }).click();

    await expect(page.locator('.locale-first-run')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search items' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('en');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ro-locale'))).toBe('en');
  });
});

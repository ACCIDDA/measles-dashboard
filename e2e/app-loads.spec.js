import { test, expect } from '@playwright/test';

test.describe('App loads', () => {
  test('renders map and core UI elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });

    await expect(page.locator('#map-svg')).toBeVisible();
    await expect(page.locator('h1')).toContainText('NC Measles (MMR) Coverage');
    await expect(page.locator('#map-legend')).toBeVisible();
    await expect(page.locator('#map-legend')).toContainText('Coverage Level');
  });

  test('county paths are rendered', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    const count = await page.locator('.county-path').count();
    expect(count).toBeGreaterThan(90);
  });

  test('tour help button is visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    // Dismiss tour if auto-started
    const tourBackdrop = page.locator('#tour-backdrop');
    if (await tourBackdrop.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourBackdrop.click();
    }
    await expect(page.locator('#tour-help-btn')).toBeVisible();
  });
});

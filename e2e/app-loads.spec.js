import { test, expect } from '@playwright/test';

test.describe('App loads', () => {
  test('national map renders at the root path', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });

    await expect(page.locator('#map-svg')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Measles Vaccination (MMR) Coverage');
    await expect(page.locator('#map-legend')).toBeVisible();
    await expect(page.locator('#map-legend')).toContainText('Coverage Level');
  });

  test('state view renders county paths at /state/nc', async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    const count = await page.locator('.county-path').count();
    expect(count).toBeGreaterThan(90);
  });

  test('tour help button is visible on the state view', async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    // Dismiss tour if auto-started
    const tourBackdrop = page.locator('#tour-backdrop');
    if (await tourBackdrop.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourBackdrop.click();
    }
    await expect(page.locator('#tour-help-btn')).toBeVisible();
  });
});

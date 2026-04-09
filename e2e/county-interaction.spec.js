import { test, expect } from '@playwright/test';

test.describe('County interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
  });

  test('clicking a county opens the sidebar', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#sb-county-label')).not.toBeEmpty();
    await expect(page.locator('#sb-cov')).not.toBeEmpty();
    await expect(page.locator('#sb-cnt')).not.toBeEmpty();
  });

  test('back button closes the sidebar', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.locator('#back-btn').click();
    await expect(page.locator('#sidebar.open')).not.toBeVisible({ timeout: 3000 });
  });

  test('Escape key closes the sidebar', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar.open')).not.toBeVisible({ timeout: 3000 });
  });
});

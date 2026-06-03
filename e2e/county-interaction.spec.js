import { test, expect } from '@playwright/test';

test.describe('County interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
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

  // The sidebar reflects the current zoom (#50): county detail at county zoom,
  // the state summary at state zoom, and nothing at national.
  test('back button steps county → state summary → closed', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sb-county-label')).toContainText('County');
    // Back to state zoom: sidebar now shows the state summary, still open.
    await page.locator('#back-btn').click();
    await expect(page.locator('#sb-county-label')).toHaveText('North Carolina');
    await expect(page.locator('#sidebar.open')).toBeVisible();
    // Back again to national: sidebar is gone.
    await page.locator('#back-btn').click();
    await expect(page.locator('#sidebar.open')).not.toBeVisible({ timeout: 3000 });
  });

  test('Escape returns from a county to the state summary', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sb-county-label')).toContainText('County');
    await page.keyboard.press('Escape');
    await expect(page.locator('#sb-county-label')).toHaveText('North Carolina');
    await expect(page.locator('#sidebar.open')).toBeVisible();
  });
});

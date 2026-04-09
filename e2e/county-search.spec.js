import { test, expect } from '@playwright/test';

test.describe('County search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
  });

  test('typing filters counties in dropdown', async ({ page }) => {
    await page.locator('#county-search-main').fill('Dur');
    await expect(page.locator('.cd-item')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.cd-name').first()).toContainText('Durham');
  });

  test('selecting a county opens sidebar', async ({ page }) => {
    await page.locator('#county-search-main').fill('Durham');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#sb-county-label')).toContainText('Durham County');
  });

  test('search input clears after selection', async ({ page }) => {
    await page.locator('#county-search-main').fill('Durham');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#county-search-main')).toHaveValue('');
  });

  test('nonsense query shows no results', async ({ page }) => {
    await page.locator('#county-search-main').fill('zzzzz');
    await expect(page.locator('.cd-item')).not.toBeVisible({ timeout: 1000 });
  });
});

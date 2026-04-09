import { test, expect } from '@playwright/test';

test.describe('School search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
    // Select Wake County
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
  });

  test('filtering school list by search', async ({ page }) => {
    const totalCount = await page.locator('.sb-school-item').count();
    expect(totalCount).toBeGreaterThan(0);

    await page.locator('#sb-search').fill('a');
    const filteredCount = await page.locator('.sb-school-item').count();
    expect(filteredCount).toBeLessThanOrEqual(totalCount);
    await expect(page.locator('#sb-results-count')).toContainText('of');
  });

  test('clearing search restores full list', async ({ page }) => {
    const totalCount = await page.locator('.sb-school-item').count();
    await page.locator('#sb-search').fill('test');
    await page.locator('#sb-search').fill('');
    const restoredCount = await page.locator('.sb-school-item').count();
    expect(restoredCount).toBe(totalCount);
  });
});

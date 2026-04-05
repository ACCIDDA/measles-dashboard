import { test, expect } from '@playwright/test';

test.describe('School detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
    // Select Wake County via search
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
  });

  test('clicking a school shows detail panel', async ({ page }) => {
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('#sd-name')).not.toBeEmpty();
    await expect(page.locator('#sd-cov-val')).not.toBeEmpty();
  });

  test('grade rows are rendered', async ({ page }) => {
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    const grades = page.locator('.sd-grade-row');
    await expect(grades).toHaveCount(6);
  });

  test('Estimated tab is active by default', async ({ page }) => {
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.sd-tab[data-mode="estimated"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('switching to Reported tab updates data', async ({ page }) => {
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await page.locator('.sd-tab[data-mode="reported"]').click();
    await expect(page.locator('.sd-tab[data-mode="reported"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('close button hides detail panel', async ({ page }) => {
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await page.locator('#sd-close').click();
    await expect(page.locator('#sb-school-detail')).not.toBeVisible({ timeout: 2000 });
  });
});

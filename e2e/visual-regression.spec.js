import { test, expect } from '@playwright/test';

const screenshotOpts = { animations: 'disabled', maxDiffPixelRatio: 0.01 };

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
  });

  test('full map desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('full-map-desktop.png', screenshotOpts);
  });

  test('full map mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('full-map-mobile.png', screenshotOpts);
  });

  test('county selected desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('county-selected-desktop.png', screenshotOpts);
  });

  test('county selected mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('.county-path').first().click();
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('county-selected-mobile.png', screenshotOpts);
  });

  test('school detail desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await expect(page).toHaveScreenshot('school-detail-desktop.png', screenshotOpts);
  });

  test('legend coverage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#map-legend')).toHaveScreenshot('legend-coverage.png', screenshotOpts);
  });

  test('legend undervax', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('.vt-btn[data-view="undervax"]').click();
    await expect(page.locator('#map-legend')).toHaveScreenshot('legend-undervax.png', screenshotOpts);
  });

  test('sidebar stats', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.sb-stats')).toHaveScreenshot('sidebar-stats.png', screenshotOpts);
  });
});

import { test, expect } from '@playwright/test';

const screenshotOpts = { animations: 'disabled', maxDiffPixelRatio: 0.01 };

// Wait for the map-g transform attribute to stay unchanged for ~500ms.
// d3 zoom transitions are JS-driven (50ms setTimeout + 800ms transition)
// so Playwright's `animations: 'disabled'` doesn't fast-forward them.
// A fixed-timeout wait races the transition; this poll only returns once
// the transform has been observed identical across 5 consecutive 100ms
// ticks, which gives the deferred zoom enough headroom to start AND
// finish before the screenshot is taken.
async function waitForMapTransformSettled(page, { stableTicks = 5, tickMs = 100, timeout = 8000 } = {}) {
  // Reset the tracker each call so previous test state doesn't satisfy us.
  await page.evaluate(() => { window.__lastTransform = { value: null, count: 0 }; });
  await page.waitForFunction((stableTicks) => {
    const el = document.querySelector('#map-g');
    if (!el) return false;
    const cur = el.getAttribute('transform') || '';
    if (cur === window.__lastTransform.value) {
      window.__lastTransform.count += 1;
    } else {
      window.__lastTransform = { value: cur, count: 1 };
    }
    return window.__lastTransform.count >= stableTicks;
  }, stableTicks, { polling: tickMs, timeout });
}

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
  });

  test('full map desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await waitForMapTransformSettled(page);
    await expect(page).toHaveScreenshot('full-map-desktop.png', screenshotOpts);
  });

  test('full map mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await waitForMapTransformSettled(page);
    await expect(page).toHaveScreenshot('full-map-mobile.png', screenshotOpts);
  });

  test('county selected desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await waitForMapTransformSettled(page);
    await expect(page).toHaveScreenshot('county-selected-desktop.png', screenshotOpts);
  });

  test('county selected mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('.county-path').first().click();
    await waitForMapTransformSettled(page);
    await expect(page).toHaveScreenshot('county-selected-mobile.png', screenshotOpts);
  });

  test('school detail desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await waitForMapTransformSettled(page);
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.locator('.sb-school-item').first().click();
    await expect(page.locator('#sb-school-detail')).toBeVisible({ timeout: 2000 });
    await expect(page).toHaveScreenshot('school-detail-desktop.png', screenshotOpts);
  });

  test('legend coverage', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#map-legend')).toHaveScreenshot('legend-coverage.png', screenshotOpts);
  });

  test('legend undervax', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('.vt-btn[data-view="undervax"]').click();
    await expect(page.locator('#map-legend')).toHaveScreenshot('legend-undervax.png', screenshotOpts);
  });

  test('sidebar stats', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/measles-dashboard/state/nc');
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.sb-stats')).toHaveScreenshot('sidebar-stats.png', screenshotOpts);
  });
});

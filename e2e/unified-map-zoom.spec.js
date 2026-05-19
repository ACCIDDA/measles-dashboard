import { test, expect } from '@playwright/test';

// End-to-end coverage for the unified zoom-aware map (issue #31). Verifies
// that all three zoom levels (national / state / county) are driven by a
// single component, that the URL stays in sync with the zoom transitions,
// and that Escape zooms out one level at a time.
//
// Visual assertions focus on stable layer signals (state-path, county-path,
// school-dot) rather than component swaps, since the legacy two-page
// architecture no longer exists.
test.describe('Unified map zoom transitions', () => {
  test('national zoom renders state paths + world background', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    // 50 states + DC + PR via the FIPS table.
    const count = await page.locator('path.state-path').count();
    expect(count).toBeGreaterThanOrEqual(51);
    // world-atlas countries layer (Canada / Mexico / Caribbean) renders
    // beneath the choropleth (closes #30).
    await expect(page.locator('path.world-path').first()).toBeAttached();
  });

  test('click NC: URL becomes /state/nc and the county layer appears', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));

    const nc = page.locator('path.state-path[aria-label^="North Carolina"]');
    await expect(nc).toHaveCount(1);
    await nc.click();

    await page.waitForURL('**/state/nc', { timeout: 5000 });
    // Counties are lazy-loaded, but the unified map has the same wrap so we
    // just wait for the county layer to land.
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#map-svg')).toHaveAttribute('aria-label', 'NC county map');
  });

  test('click a county: URL becomes /state/nc/<slug> and school dots appear', async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });

    // Drive county selection via the county search to land on a stable
    // county (Wake) regardless of mouse geometry.
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.waitForURL('**/state/nc/wake', { timeout: 5000 });
    await page.waitForSelector('circle.school-dot', { timeout: 5000 });
  });

  test('Escape zooms out one level (county → state → national)', async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc/wake');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });

    // First Escape — back to state zoom (URL = /state/nc).
    await page.keyboard.press('Escape');
    await page.waitForURL('**/state/nc', { timeout: 5000 });
    await expect(page.locator('#sidebar.open')).not.toBeVisible({ timeout: 3000 });

    // Second Escape — back to national zoom (URL = root).
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => /\/$/.test(window.location.pathname) || window.location.pathname.endsWith('/measles-dashboard/'), {}, { timeout: 5000 });
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('header')).toContainText('Click a state to explore');
  });

  test('coming_soon state (TX) shows the no-data toast and stays on national', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    const beforeUrl = page.url();

    await page.locator('path[data-state="tx"]').click();
    await expect(page.locator('[data-testid="no-data-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-data-toast"]')).toContainText('Data not yet available for Texas.');

    expect(page.url()).toBe(beforeUrl);
  });

  test('deep link to /state/nc/wake renders the county-zoom view immediately', async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc/wake');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#sb-county-label')).toContainText('Wake County');
  });
});

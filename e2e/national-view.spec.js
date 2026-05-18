import { test, expect } from '@playwright/test';

test.describe('National view (root path)', () => {
  test('renders all 50 states + DC + PR as separate paths', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    const count = await page.locator('path.state-path').count();
    // us-atlas exposes the 50 states + DC; PR is included via the FIPS table.
    expect(count).toBeGreaterThanOrEqual(51);
  });

  test('county search input is not visible on the national view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('#county-search-main')).toHaveCount(0);
    await expect(page.locator('#hd-search-btn')).toHaveCount(0);
  });

  test('header shows national landing copy', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('header')).toContainText('Click a state to explore');
  });

  test('legend shows the no-data swatch', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('#map-legend')).toContainText('No data yet');
  });

  test('clicking NC navigates to /state/nc and renders the county view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    // Disable the auto-started tour ahead of time so it doesn't shadow the
    // county map after the navigation lands.
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));

    // NC = FIPS 37. The path's aria-label includes the state name so we
    // can target it without relying on geometry.
    const nc = page.locator('path.state-path[aria-label^="North Carolina"]');
    await expect(nc).toHaveCount(1);
    await nc.click();

    await page.waitForURL('**/state/nc', { timeout: 5000 });
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#map-svg')).toHaveAttribute('aria-label', 'NC county map');
  });

  test('back navigation returns to the national view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));

    const nc = page.locator('path.state-path[aria-label^="North Carolina"]');
    await nc.click();
    await page.waitForURL('**/state/nc', { timeout: 5000 });
    await page.waitForSelector('.county-path', { timeout: 15000 });

    await page.goBack();
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('header')).toContainText('Click a state to explore');
    // County search should be hidden again on the national view.
    await expect(page.locator('#county-search-main')).toHaveCount(0);
  });
});

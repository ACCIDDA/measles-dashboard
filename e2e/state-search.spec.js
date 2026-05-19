import { test, expect } from '@playwright/test';

test.describe('State search (national view)', () => {
  test('renders the state-search input on the national view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    await expect(page.locator('#state-search-main')).toBeVisible();
    await expect(page.locator('#state-search-main')).toHaveAttribute(
      'placeholder',
      'Search states…'
    );
  });

  test('selecting a ready state navigates to its state view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    // Disable the auto-started tour so it doesn't shadow the county map.
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));

    await page.locator('#state-search-main').fill('North Carolina');
    await page.locator('#state-search-dropdown .cd-item').first().click();

    await page.waitForURL('**/state/nc', { timeout: 5000 });
    await page.waitForSelector('.county-path', { timeout: 15000 });
  });

  test('selecting a coming_soon state stays on / and shows the toast', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });

    await page.locator('#state-search-main').fill('Texas');
    await page.locator('#state-search-dropdown .cd-item').first().click();

    // URL should still be the root (no /state/<code> navigation).
    await expect(page).toHaveURL(/\/(measles-dashboard\/?)?$/);
    await expect(page.locator('[data-testid="no-data-toast"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="no-data-toast"]')).toContainText('Texas');
  });
});

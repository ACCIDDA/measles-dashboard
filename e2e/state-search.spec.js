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

  test('coming_soon states appear in the dropdown but are not selectable', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });

    await page.locator('#state-search-main').fill('Texas');

    // Texas is in the dropdown, tagged as "no data yet" and marked as a
    // non-selectable (aria-disabled) option that matches the choropleth's
    // grey-out treatment.
    const texasRow = page.locator('#state-search-dropdown .cd-item').first();
    await expect(texasRow).toBeVisible();
    await expect(texasRow).toContainText('Texas');
    await expect(texasRow).toContainText('(no data yet)');
    await expect(texasRow).toHaveAttribute('aria-disabled', 'true');
    await expect(texasRow).toHaveClass(/cd-item-disabled/);

    const beforeUrl = page.url();
    // Playwright's default click() waits for the element to be enabled, which
    // never happens here because the row is intentionally aria-disabled. Use
    // { force: true } to bypass that actionability check — the assertions
    // below still verify that the click is a no-op.
    await texasRow.click({ force: true });

    // Click is a no-op: no navigation, no toast, and the query/dropdown
    // remain so the user can keep searching.
    expect(page.url()).toBe(beforeUrl);
    await expect(page.locator('[data-testid="no-data-toast"]')).toHaveCount(0);
    await expect(page.locator('#state-search-main')).toHaveValue('Texas');
    await expect(texasRow).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

// Issue #18 — data manifest + grey-out for states without data.
//
// After PR #27 integrated the manifest into NationalMap at "/", the
// availability check fires when a user clicks a non-"ready" state in the
// choropleth. These specs verify the toast affordance and that no
// drill-down navigation occurs.
test.describe('State data manifest — integrated with national choropleth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/measles-dashboard/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
  });

  test('clicking a coming_soon state shows the "no data" toast and does not navigate', async ({ page }) => {
    const beforeUrl = page.url();
    await page.locator('path[data-state="tx"]').click();

    const toast = page.locator('[data-testid="no-data-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Data not yet available for Texas.');

    expect(page.url()).toBe(beforeUrl);
  });

  test('clicking the ready state (NC) navigates to the state view', async ({ page }) => {
    await page.locator('path[data-state="nc"]').click();
    await page.waitForURL(/\/state\/nc/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/state\/nc/);
  });
});

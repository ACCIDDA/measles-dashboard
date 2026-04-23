import { test, expect } from '@playwright/test';

test.describe('Keyboard navigation and accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
  });

  test('Escape deselects county', async ({ page }) => {
    await page.locator('.county-path').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar.open')).not.toBeVisible({ timeout: 3000 });
  });

  test('aria-live region exists', async ({ page }) => {
    await expect(page.locator('#aria-live[aria-live="polite"]')).toBeAttached();
  });

  test('sidebar has accessible role', async ({ page }) => {
    await expect(page.locator('#sidebar[role="complementary"]')).toBeAttached();
  });

  test('map has accessible role and label', async ({ page }) => {
    await expect(page.locator('#map-svg[role="application"]')).toBeAttached();
    await expect(page.locator('#map-svg')).toHaveAttribute('aria-label', 'NC county map');
  });
});

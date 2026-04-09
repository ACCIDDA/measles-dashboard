import { test, expect } from '@playwright/test';

test.describe('View toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
  });

  test('default view is coverage', async ({ page }) => {
    await expect(page.locator('.vt-btn[data-view="coverage"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map-legend')).toContainText('Coverage Level');
  });

  test('clicking Below 95% switches view', async ({ page }) => {
    await page.locator('.vt-btn[data-view="undervax"]').click();
    await expect(page.locator('.vt-btn[data-view="undervax"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.vt-btn[data-view="coverage"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#map-legend')).toContainText('% Schools Below 95%');
  });

  test('clicking Coverage switches back', async ({ page }) => {
    await page.locator('.vt-btn[data-view="undervax"]').click();
    await page.locator('.vt-btn[data-view="coverage"]').click();
    await expect(page.locator('.vt-btn[data-view="coverage"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map-legend')).toContainText('Coverage Level');
  });
});

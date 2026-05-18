import { test, expect } from '@playwright/test';

// Issue #18 — data manifest + grey-out for states without data.
//
// Until issue #14's NationalMap lands at "/", the manifest-driven
// national overview is mounted at "/national". These specs verify:
//   1. Greyed (coming_soon) states render as non-clickable.
//   2. The single "ready" state (NC) renders clickable / colored.
//   3. Clicking a greyed state does NOT navigate and surfaces the
//      "Data not yet available for {State name}." affordance.
test.describe('State data manifest — national overview', () => {
  test.beforeEach(async ({ page }) => {
    // Vite serves the app under base "/measles-dashboard/". Issue #14
    // will eventually route "/" → NationalMap; until then this PR
    // mounts the manifest-driven overview at "/national".
    await page.goto('/measles-dashboard/national');
    await page.waitForSelector('[data-testid="national-state-list"]', { timeout: 15000 });
  });

  test('NC renders as ready (clickable / colored)', async ({ page }) => {
    const nc = page.locator('[data-testid="state-btn-nc"]');
    await expect(nc).toBeVisible();
    await expect(nc).toHaveClass(/state-ready/);
    await expect(nc).not.toHaveClass(/state-coming-soon/);
  });

  test('at least 2 non-NC states render as greyed (coming_soon)', async ({ page }) => {
    const tx = page.locator('[data-testid="state-btn-tx"]');
    const va = page.locator('[data-testid="state-btn-va"]');
    await expect(tx).toBeVisible();
    await expect(tx).toHaveClass(/state-coming-soon/);
    await expect(tx).toHaveAttribute('aria-disabled', 'true');
    await expect(va).toBeVisible();
    await expect(va).toHaveClass(/state-coming-soon/);
    await expect(va).toHaveAttribute('aria-disabled', 'true');
  });

  test('clicking a greyed state shows the "no data" toast and does not navigate', async ({ page }) => {
    const beforeUrl = page.url();
    // `aria-disabled="true"` is intentional (for screen readers) but it
    // makes Playwright treat the button as disabled. We still want the
    // click to fire so the toast appears, so we bypass the actionability
    // check with `force: true`.
    await page.locator('[data-testid="state-btn-tx"]').click({ force: true });

    const toast = page.locator('[data-testid="no-data-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Data not yet available for Texas.');

    // No drill-down navigation occurred.
    expect(page.url()).toBe(beforeUrl);
  });

  test('the manifest exposes every state from the file', async ({ page }) => {
    // Spot-check a handful of state codes spread across the alphabet.
    const codes = ['ca', 'fl', 'ny', 'tx', 'wa', 'dc'];
    for (const code of codes) {
      await expect(page.locator(`[data-testid="state-btn-${code}"]`)).toBeVisible();
    }
  });
});

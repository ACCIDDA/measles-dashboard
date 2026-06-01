import { test, expect } from '@playwright/test';

// Stubs navigator.geolocation BEFORE the app boots, so the App's
// useStateGeolocation effect sees our fake coordinate instead of asking
// the browser permission UI. Each spec re-installs the stub on a fresh
// browser context to avoid bleed-over.
//
// We replace navigator.geolocation via the Navigator prototype because
// `Object.defineProperty(navigator, ...)` doesn't always stick in
// Chromium (the property lives on the prototype and is non-configurable
// on the instance in some builds).
async function stubGeolocation(page, { latitude, longitude, deny = false } = {}) {
  await page.addInitScript(({ latitude, longitude, deny }) => {
    const fakeGeolocation = {
      getCurrentPosition: (success, error) => {
        // Defer the callback to mimic the real browser timing — many
        // codepaths assume the success/error handler fires after the
        // current task completes, not synchronously.
        setTimeout(() => {
          if (deny) {
            // 1 = PERMISSION_DENIED in the PositionError enum.
            if (error) error({ code: 1, message: 'User denied geolocation' });
            return;
          }
          success({ coords: { latitude, longitude, accuracy: 50 } });
        }, 0);
      },
      watchPosition: () => 0,
      clearWatch: () => {},
    };
    // Patch the prototype getter so any access to navigator.geolocation
    // (instance or prototype) returns our fake object.
    try {
      Object.defineProperty(Navigator.prototype, 'geolocation', {
        configurable: true,
        get: () => fakeGeolocation,
      });
    } catch {
      // no-op
    }
    try {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        get: () => fakeGeolocation,
      });
    } catch {
      // no-op
    }
  }, { latitude, longitude, deny });
}

test.describe('State geolocation routing', () => {
  test('navigates to /state/nc when geolocation resolves to a Raleigh NC coordinate', async ({ page }) => {
    // Raleigh, NC — comfortably inside the NC state polygon.
    await stubGeolocation(page, { latitude: 35.78, longitude: -78.65 });
    // Dismiss the tour ahead of the navigation so it doesn't hijack focus.
    await page.addInitScript(() => {
      localStorage.setItem('nc_measles_tour_done', '1');
    });

    await page.goto('/');
    // The transition happens via history.pushState after the geolocation
    // hook resolves and the manifest finishes loading. pushState does not
    // fire a 'load' event, so wait until the URL has flipped and then
    // verify the county view rendered.
    await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(/\/state\/nc(?:[/?#]|$)/);
    await page.waitForSelector('.county-path', { timeout: 15000 });
    await expect(page.locator('#map-svg')).toHaveAttribute('aria-label', 'NC county map');
  });

  test('stays on the national view and highlights the user state when the state has no data', async ({ page }) => {
    // Austin, TX — inside TX, which is "coming_soon" in the manifest.
    await stubGeolocation(page, { latitude: 30.27, longitude: -97.74 });

    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });
    // Wait for the halo class to appear on the TX path (FIPS 48). The
    // hook resolves asynchronously, so poll the count rather than rely
    // on visibility — SVG paths can be picked up by Playwright as not
    // visible depending on bounding-box heuristics.
    await expect.poll(
      () => page.locator('path.state-path.state-user-location[data-fips="48"]').count(),
      { timeout: 15000 }
    ).toBe(1);

    // URL stays on root (national view) — geolocation didn't navigate us
    // away because the state isn't manifest-ready.
    expect(page.url()).not.toMatch(/\/state\//);
    await expect(page.locator('header')).toContainText('Click a state to explore');
  });

  test('stays on the national view with no visible error when permission is denied', async ({ page }) => {
    await stubGeolocation(page, { deny: true });

    await page.goto('/');
    await page.waitForSelector('path.state-path', { timeout: 15000 });

    // Give the hook plenty of time to resolve; no navigation should occur.
    await page.waitForTimeout(750);
    expect(page.url()).not.toMatch(/\/state\//);
    // No highlight halo when no state was resolved.
    await expect(page.locator('path.state-path.state-user-location')).toHaveCount(0);
    // National header copy still visible — no error toast.
    await expect(page.locator('header')).toContainText('Click a state to explore');
  });
});

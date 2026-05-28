import { test, expect } from '@playwright/test';

// E2E coverage for issues #28 and #29: when the user drills into a county
// the on-map school dots render with one shape per tier (matching the
// legend / sidebar), and the focal county's fill is muted so school dots
// stay visible on top.
test.describe('State map visuals (focal county + per-tier shapes)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/measles-dashboard/state/nc');
    await page.evaluate(() => localStorage.setItem('nc_measles_tour_done', '1'));
    await page.reload();
    await page.waitForSelector('.county-path', { timeout: 15000 });
    // Drill into Wake County, which has enough schools to span all three
    // coverage tiers in the NC fixture data.
    await page.locator('#county-search-main').fill('Wake');
    await page.locator('.cd-item').first().click();
    await expect(page.locator('#sidebar.open')).toBeVisible({ timeout: 3000 });
    // School dots render after a 50ms setTimeout in StateMap; wait for the
    // first g.school-dot to land in the DOM rather than racing it.
    await page.waitForSelector('g.school-dot', { timeout: 5000 });
  });

  test('school dots render as per-tier shapes (circle / rect / polygon)', async ({ page }) => {
    // Wake County in the NC dataset is dense enough to contain at least one
    // school in each coverage tier.
    await expect(page.locator('g.school-dot[data-tier="H"] circle.school-shape').first())
      .toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('g.school-dot[data-tier="M"] rect.school-shape').first())
      .toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('g.school-dot[data-tier="L"] polygon.school-shape').first())
      .toHaveCount(1, { timeout: 5000 });
  });

  test('every school dot has one tier-appropriate shape inside it', async ({ page }) => {
    // Sanity check: no orphan school-dot <g> elements without an inner shape.
    const dotCount = await page.locator('g.school-dot').count();
    expect(dotCount).toBeGreaterThan(0);
    const shapeCount = await page.locator('g.school-dot .school-shape').count();
    expect(shapeCount).toBe(dotCount);
  });

  test('focal county is full color; non-focal counties are dimmed (#29)', async ({ page }) => {
    // NCMap parity: the focal county renders at full tier color (no muted
    // fill); visual separation from neighbours now comes from a parent-
    // opacity drop on non-focal counties. The school dots' opaque cream
    // halos give the per-dot legibility the muted-fill approach used to.
    const focal = page.locator('path.county-path.county-focal');
    await expect(focal).toHaveCount(1);

    // No muted fill-opacity (attribute unset; CSS rule removed).
    const focalFillOpacity = await focal.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const attr = el.getAttribute('fill-opacity');
      return attr != null ? parseFloat(attr) : parseFloat(cs.fillOpacity);
    });
    expect(focalFillOpacity).toBeCloseTo(1, 5);

    // Focal at full parent-opacity; non-focal counties dimmed.
    const focalOpacity = await focal.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).opacity)
    );
    expect(focalOpacity).toBeCloseTo(1, 5);

    const nonFocalOpacity = await page
      .locator('path.county-path:not(.county-focal)')
      .first()
      .evaluate((el) => parseFloat(window.getComputedStyle(el).opacity));
    expect(nonFocalOpacity).toBeLessThan(0.5);
  });

  test('returning to the overview clears the focal class', async ({ page }) => {
    await expect(page.locator('path.county-path.county-focal')).toHaveCount(1);
    await page.locator('#back-btn').click();
    await expect(page.locator('path.county-path.county-focal')).toHaveCount(0, { timeout: 3000 });
  });
});

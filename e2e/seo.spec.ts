import { test, expect } from '@playwright/test';

test('public route heads update without leaking private state', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('BlindSolve');
  await expect(page.getByRole('link', { name: 'Guide', exact: true })).toHaveCount(0);
  await expect(page.getByText('BlindSolve · 3×3 blindfolded cube timer & training')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Letter Pairs' })).toHaveAttribute('href', '/pairs');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Letter Pairs' }).click();
  await expect(page).toHaveTitle('BlindSolve');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://blindsolve.com/pairs');
  // Local/preview hosts remain noindex even after client navigation.
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await page.goto('/about');
  await expect(page).toHaveURL(new URL('/', page.url()).href);
  await expect(page).toHaveTitle('BlindSolve');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

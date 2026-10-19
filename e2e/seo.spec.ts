import { test, expect } from '@playwright/test';

test('public route heads update without leaking private state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('BlindSolve');
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Letter Pairs' })).toHaveAttribute('href', '/pairs');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Letter Pairs' }).click();
  await expect(page).toHaveTitle('3BLD Letter Pairs & Mnemonics | BlindSolve');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://blindsolve.com/pairs');
  // Local/preview hosts remain noindex even after client navigation.
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice 3BLD with BlindSolve');
  await expect(page.getByRole('link', { name: '3BLD timer', exact: true })).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

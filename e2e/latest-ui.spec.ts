import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSpeffzScheme, stickersFor } from '../src/domain/bld/speffz';
import { pairKey } from '../src/domain/letterPairs';

const stamp = '2026-09-26T00:00:00.000Z';
function workspace(withPair = false) {
  const scheme = createSpeffzScheme();
  const pairs: Record<string, unknown> = {};
  if (withPair) {
    const edges = stickersFor(scheme, 'edge');
    const first = edges.find((s) => s.label === 'T')!;
    const second = edges.find((s) => s.label === 'W')!;
    pairs[pairKey(first.id, second.id)] = {
      id: crypto.randomUUID(), firstStickerId: first.id, secondStickerId: second.id,
      firstToken: 'T', secondToken: 'W', primaryMnemonic: 'tow', alternates: ['tower'],
      encounters: 0, forgotten: 0, updatedAt: stamp,
    };
  }
  return {
    scheme, pairs, solves: [], attempts: [], onboarded: true, schemeUpdatedAt: stamp,
    multiphaseTiming: true, pairSharing: 'shared', flippedEdges: 'cycle', twistedCorners: 'cycle',
    defaultCubeView: { top: 'white', front: 'green' }, preferencesUpdatedAt: stamp,
  };
}
async function load(page: Page, data = workspace()) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem('cubeiq-bld-v2:guest')) localStorage.setItem('cubeiq-bld-v2:guest', JSON.stringify({ data: value, revision: 0, dirty: false }));
  }, data);
}
async function holdSpace(page: Page) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(320);
  await page.keyboard.up('Space');
}

test('latest primary routes render without horizontal overflow', async ({ page }) => {
  await load(page);
  for (const [path, marker] of [['/', 'Scrambled cube'], ['/pairs', 'Pairs starting'], ['/flashcards', 'No pairs yet'], ['/training', 'Hold Space to start'], ['/settings', 'Cube & lettering']] as const) {
    await page.goto(path);
    if (path === '/') await expect(page.getByRole('group', { name: marker })).toBeVisible({ timeout: 45000 });
    else if (path === '/training') await expect(page.getByRole('timer', { name: marker })).toBeVisible();
    else await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('latest pair browser saves primary and alternate and reveals suggestions only on request', async ({ page }) => {
  await load(page);
  await page.goto('/pairs');
  await page.getByRole('gridcell', { name: 'TW, empty' }).click();
  await expect(page.getByRole('button', { name: /tow/i })).toHaveCount(0);
  await page.getByLabel('Mnemonic').fill('tow');
  await page.getByLabel('Add alternate').fill('tower');
  await page.getByRole('button', { name: "Can't think of one?" }).click();
  await expect(page.getByRole('button', { name: 'Hide suggestions' })).toBeVisible();
  await page.getByRole('button', { name: /^Save/ }).last().click();
  await page.reload();
  await expect(page.getByRole('gridcell', { name: /TW, tow/ })).toBeVisible();
});

test('flashcards use saved pairs, reveal, edit and persist an attempt', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/flashcards');
  await page.getByRole('button', { name: /Reveal/ }).click();
  await expect(page.getByText('tow', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Edit/ }).click();
  await page.getByLabel('Mnemonic').fill('towel');
  await page.getByRole('button', { name: /^Save/ }).click();
  await page.getByRole('button', { name: 'Remembered', exact: false }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.attempts).toHaveLength(1);
  expect(saved.attempts[0].kind).toBe('flashcard');
});

test('a held Flashcard shortcut reveals once and never records before release', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/flashcards');
  await page.keyboard.down('Space');
  await page.waitForTimeout(700);
  await expect(page.getByText('tow', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(0);
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Remembered', exact: false }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(1);
});

test('all Training modes remain idle until hold-release and Next returns to idle', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  for (const mode of ['Memo Recall', 'Trace Sprint', 'Full Memo']) {
    await page.getByRole('radio', { name: mode }).click();
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
    await holdSpace(page);
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toHaveCount(0);
    if (mode === 'Memo Recall') {
      await page.keyboard.press('Space');
      await page.keyboard.press('Escape');
    } else {
      if (mode === 'Full Memo') await page.locator('input').first().fill('test');
      await page.getByRole('button', { name: /^Submit/ }).click();
    }
    await expect(page.getByRole('button', { name: /Next/ })).toBeVisible();
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
  }
});

test('Space in a Training input never starts or submits another attempt', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await page.getByRole('radio', { name: 'Trace Sprint' }).click();
  await holdSpace(page);
  const input = page.locator('input').first();
  await input.fill('A B');
  await input.press('Space');
  await expect(input).toBeFocused();
});

test('Default Cube View persists independently of the fixed scramble reference', async ({ page }) => {
  await load(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Cube view' }).click();
  await page.getByRole('radio', { name: 'Orange' }).last().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(650);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.defaultCubeView).toEqual({ top: 'white', front: 'orange' });
  expect(saved.scheme.orientation).toEqual({ up: 'U', front: 'F' });
  await page.goto('/');
  await expect(page.getByRole('group', { name: 'Scrambled cube' })).toHaveAttribute('data-cube-view', 'white/orange');
});

test('Timer hold, memo split, execution stop and reconstruction save form one solve', async ({ page }) => {
  await load(page);
  await page.goto('/');
  await holdSpace(page);
  await expect(page.getByText('memo', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('exec', { exact: true })).toBeVisible();
  await page.waitForTimeout(30);
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Memo reconstruction' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip to save' }).click();
  await expect(page.getByRole('dialog', { name: 'Memo reconstruction' })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.solves).toHaveLength(1);
  expect(saved.solves[0].memoMs).toBeGreaterThan(0);
  expect(saved.solves[0].executionMs).toBeGreaterThanOrEqual(0);
  expect(saved.solves[0].totalMs).toBeGreaterThanOrEqual(saved.solves[0].memoMs);
});

test('auth surface exposes only WCA and Google', async ({ page }) => {
  await load(page);
  await page.goto('/signin');
  await expect(page.getByRole('button', { name: 'Continue with WCA' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByText(/password|magic link|github/i)).toHaveCount(0);
});

test('key latest screens pass automated WCAG checks', async ({ page }) => {
  await load(page, workspace(true));
  for (const path of ['/', '/pairs', '/flashcards', '/training', '/settings', '/signin']) {
    await page.goto(path);
    const audit = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
    audit.disableRules(['color-contrast']);
    expect((await audit.analyze()).violations, path).toEqual([]);
  }
});

test('requested desktop, tablet and mobile viewports stay horizontally contained', async ({ page }) => {
  await load(page, workspace(true));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 900, height: 560 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [name, path] of [['timer', '/'], ['pairs', '/pairs'], ['flashcards', '/flashcards'], ['training', '/training'], ['settings', '/settings'], ['auth', '/signin']] as const) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${viewport.width}px ${name}`).toBe(true);
      if ([1440, 1024, 390].includes(viewport.width)) {
        await page.screenshot({ path: `docs/screenshots/latest/${viewport.width}-${name}.png`, animations: 'disabled' });
      }
    }
  }
});

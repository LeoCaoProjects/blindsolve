import { expect, test, type Locator, type Page } from '@playwright/test';
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
    multiphaseTiming: true, showLiveTimer: true, pairSharing: 'shared', flippedEdges: 'cycle', twistedCorners: 'cycle',
    defaultCubeView: { top: 'white', front: 'green' }, preferencesUpdatedAt: stamp,
  };
}
async function load(page: Page, data = workspace()) {
  await page.addInitScript((value) => {
    if (!localStorage.getItem('cubeiq-bld-v2:guest')) localStorage.setItem('cubeiq-bld-v2:guest', JSON.stringify({ data: value, revision: 0, dirty: false }));
  }, data);
}
async function holdSpace(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.down('Space');
  await page.waitForTimeout(320);
  await page.keyboard.up('Space');
}
async function waitForTimerScramble(page: Page) {
  await expect(page.getByRole('button', { name: 'New scramble' })).toBeEnabled({ timeout: 45_000 });
}
const scrambleLabel = (region: Locator) =>
  region.locator('.sr-only').first().textContent();

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

test('mobile primary navigation keeps every section fully visible', async ({ page }) => {
  await load(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const label of ['Timer', 'Letter Pairs', 'Flashcards', 'Training']) {
      const item = nav.getByRole('link', { name: label });
      await expect(item).toBeVisible();
      expect(await item.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }), `${label} should be fully within the ${width}px viewport`).toBe(true);
    }
    expect(await nav.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `nav should fit at ${width}px`).toBe(true);
  }
});

test('Settings cube stays within its content column on narrow screens', async ({ page }) => {
  await load(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  const cube = page.getByRole('group', { name: 'Your cube' });
  await expect(cube).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => cube.evaluate((element) => {
      const stage = element.parentElement!.getBoundingClientRect();
      const faces = [...element.querySelectorAll('.absolute.grid')].map((face) => face.getBoundingClientRect());
      return stage.left >= 0 && stage.right <= window.innerWidth && faces.every((face) => face.left >= 0 && face.right <= window.innerWidth);
    }), `cube should fit at ${width}px`).toBe(true);
  }
});

test('signed-out workspaces do not call the admin-only feedback RPC', async ({ page }) => {
  await load(page);
  const adminChecks: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/rpc/is_feedback_admin')) adminChecks.push(request.url());
  });
  for (const path of ['/', '/pairs', '/flashcards', '/training', '/settings']) {
    await page.goto(path);
    await page.waitForTimeout(120);
  }
  expect(adminChecks).toEqual([]);
});

test('latest pair browser saves primary and alternate and reveals suggestions only on request', async ({ page }) => {
  await load(page);
  await page.goto('/pairs');
  await page.getByRole('gridcell', { name: 'TW, empty' }).click();
  await expect(page.getByRole('button', { name: /tow/i })).toHaveCount(0);
  await page.getByLabel('Mnemonic').fill('tow');
  await page.getByLabel('Add alternate').fill('tower');
  await page.getByRole('button', { name: 'Suggest words' }).click();
  await expect(page.getByRole('button', { name: 'Hide suggestions' })).toBeVisible();
  await page.getByRole('button', { name: /^Save/ }).last().click();
  await page.reload();
  await expect(page.getByRole('gridcell', { name: /TW, tow/ })).toBeVisible();
});

test('Letter Pair deletion promotes alternates and destructive clears require confirmation', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/pairs');
  await page.getByRole('gridcell', { name: /TW, tow/ }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByLabel('Mnemonic')).toHaveValue('tower');
  await page.getByRole('button', { name: /^Save/ }).last().click();
  await page.getByRole('gridcell', { name: /TW, tower/ }).click();
  await page.getByRole('button', { name: 'Clear pair' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  const cancelClear = page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' });
  await expect(cancelClear).toBeFocused();
  await cancelClear.click();
  await expect(page.getByRole('button', { name: 'Clear pair' }).first()).toBeFocused();
  await expect(page.getByLabel('Mnemonic')).toHaveValue('tower');
  await page.getByRole('button', { name: 'Clear pair' }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear pair' }).click();
  await expect(page.getByRole('gridcell', { name: 'TW, empty' })).toBeVisible();
});

test('clearing a first-token section and clearing all pairs use destructive confirmation', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/pairs');
  await page.getByRole('button', { name: 'Clear T pairs' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('can’t be undone');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('gridcell', { name: /TW, tow/ })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear all…' }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(Object.keys(saved.pairs)).toHaveLength(0);
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
  await page.reload();
  await expect(page.getByRole('list', { name: 'Recent cards' }).locator('li')).toHaveCount(1);
});

test('a held Flashcard shortcut reveals once and never records before release', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/flashcards');
  await expect(page.getByRole('button', { name: /Reveal/ })).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await page.keyboard.down('Space');
  await page.waitForTimeout(700);
  await expect(page.getByText('tow', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(0);
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Remembered', exact: false }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(1);
});

test('Flashcards keep physical variants but count a shared mnemonic once', async ({ page }) => {
  await load(page, workspace(true));
  await page.goto('/flashcards');
  await expect(page.getByRole('radiogroup', { name: 'Pieces' })).toHaveCount(0);
  await expect(page.getByText(/^(Edge|Corner)$/)).toBeVisible();
  await expect(page.getByText('1 card', { exact: true })).toBeVisible();
});

test('Trace Sprint submits once, freezes time, and Enter review advances without another record', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await page.getByRole('radio', { name: 'Trace Sprint' }).click();
  await holdSpace(page);
  await page.getByRole('button', { name: /^Submit/ }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  const review = page.getByRole('dialog', { name: 'Trace Sprint review' });
  await expect(review).toBeVisible();
  const time = review.locator('.font-timer').first();
  const frozen = await time.textContent();
  await page.waitForTimeout(150);
  expect(await time.textContent()).toBe(frozen);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(1);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
  await expect(review).toBeHidden();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(1);
  await holdSpace(page);
  await page.getByRole('button', { name: /^Submit/ }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(2);
  await page.reload();
  await page.getByRole('radio', { name: 'Trace Sprint' }).click();
  await expect(page.getByRole('list', { name: 'Attempts', exact: true }).locator('li')).toHaveCount(2);
});

test('Guided Solve follows memo, execution, self-report, review, then returns idle', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await page.getByRole('radio', { name: 'Guided Solve' }).click();
  const scramble = page.getByRole('region', { name: 'Scramble' });
  await expect(scramble).toBeVisible();
  await expect(scramble.getByText('Preparing scramble…')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByRole('radio', { name: 'Full Memo' })).toHaveCount(0);
  const newScramble = page.getByRole('button', { name: 'New scramble' });
  await newScramble.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
  await expect(scramble.getByText('Preparing scramble…')).toHaveCount(0, { timeout: 45_000 });
  await page.locator('main').click({ position: { x: 10, y: 10 } });
  await holdSpace(page);
  await expect(page.getByRole('timer', { name: 'Memorisation' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Executing', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  const review = page.getByRole('dialog', { name: 'Guided Solve result' });
  await expect(review).toBeVisible();
  await expect(review.getByText('memo', { exact: true })).toBeVisible();
  await expect(review.getByText('exec', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts)).toHaveLength(0);
  await review.getByRole('button', { name: /^Close/ }).click();
  await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
  await page.reload();
  await page.getByRole('radio', { name: 'Guided Solve' }).click();
  await expect(page.getByRole('list', { name: 'Attempts', exact: true }).locator('li')).toHaveCount(1);
});

test('Memo Recall history survives a full reload', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await page.getByRole('radio', { name: 'Memo Recall' }).click();
  await holdSpace(page);
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /^Submit/ }).click();
  await expect(page.getByRole('dialog', { name: 'Memo Recall result' })).toBeVisible();
  await page.reload();
  await page.getByRole('radio', { name: 'Memo Recall' }).click();
  await expect(page.getByRole('list', { name: 'Attempts', exact: true }).locator('li')).toHaveCount(1);
});

test('Execution Sprint preserves time and DNF after a full reload', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await expect(page.getByRole('button', { name: 'New scramble' })).toBeEnabled({ timeout: 45_000 });
  await holdSpace(page);
  await page.keyboard.press('Space');
  const review = page.getByRole('dialog', { name: 'Execution Sprint result' });
  await expect(review).toBeVisible();
  await review.getByRole('radio', { name: 'DNF', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts[0]);
  expect(saved.trainingMode).toBe('exec');
  expect(saved.correct).toBe(false);
  expect(saved.durationMs).toBeGreaterThanOrEqual(0);
  await review.getByRole('button', { name: /^Close/ }).click();
  await page.reload();
  const history = page.getByRole('list', { name: 'Attempts', exact: true });
  await expect(history.locator('li')).toHaveCount(1);
  await expect(history.getByText('DNF', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data.attempts[0])).toEqual(saved);
});

test('Timer and shared-scope, per-drill Training workspaces survive SPA navigation', async ({ page }) => {
  await load(page);
  await page.goto('/');
  const timerScramble = page.getByRole('region', { name: 'Scramble' });
  await expect(timerScramble).toContainText(/[UDFBRL]/, { timeout: 45_000 });
  const timerA = await scrambleLabel(timerScramble);

  await page.getByRole('link', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Execution Sprint' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Edges', exact: true }).click();
  const trainingScramble = page.getByRole('region', { name: 'Scramble' });
  await expect(trainingScramble.getByText('Preparing scramble…')).toHaveCount(0, { timeout: 45_000 });
  const executionId = await trainingScramble.getAttribute('data-challenge-id');

  await page.getByRole('radio', { name: 'Guided Solve' }).click();
  await page.getByRole('radio', { name: 'Corners', exact: true }).click();
  await page.getByRole('radio', { name: 'Execution Sprint' }).click();
  await expect(page.getByRole('radio', { name: 'Corners', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('region', { name: 'Scramble' })).not.toHaveAttribute('data-challenge-id', executionId!);

  await page.getByRole('link', { name: 'Timer', exact: true }).click();
  await expect.poll(() => scrambleLabel(page.getByRole('region', { name: 'Scramble' }))).toBe(timerA);
  await page.getByRole('link', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Execution Sprint' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Corners', exact: true })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: 'Guided Solve' }).click();
  await expect(page.getByRole('radio', { name: 'Corners', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Execution Sprint' }).click();
  await page.getByRole('link', { name: 'Timer', exact: true }).click();
  await page.getByRole('button', { name: 'New scramble' }).click();
  await expect.poll(() => scrambleLabel(page.getByRole('region', { name: 'Scramble' })), { timeout: 45_000 }).not.toBe(timerA);
});

test('Training tabs are ordered and an active Guided Solve keeps its phase and time across navigation', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await expect(page.getByRole('navigation', { name: 'Drill' }).getByRole('radio')).toHaveText([
    'Execution Sprint',
    'Guided Solve',
    'Memo Recall',
    'Trace Sprint',
  ]);
  await page.getByRole('radio', { name: 'Guided Solve' }).click();
  const scramble = page.getByRole('region', { name: 'Scramble' });
  await expect(scramble.getByText('Preparing scramble…')).toHaveCount(0, { timeout: 45_000 });
  const challengeId = await page.locator('[data-training-challenge-id]').getAttribute('data-training-challenge-id');
  await holdSpace(page);
  await expect(page.getByRole('timer', { name: 'Memorisation' })).toBeVisible();
  const memoClock = page.getByRole('timer').first();
  const memoBefore = await memoClock.innerText();
  await page.getByRole('link', { name: 'Timer', exact: true }).click();
  await page.waitForTimeout(80);
  await page.getByRole('link', { name: 'Training', exact: true }).click();
  await expect(page.locator('[data-training-challenge-id]')).toHaveAttribute('data-training-challenge-id', challengeId!);
  await expect(page.getByRole('timer', { name: 'Memorisation' })).toBeVisible();
  expect(await memoClock.innerText()).not.toBe(memoBefore);
});

test('all Training modes remain idle until hold-release and Next returns to idle', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  for (const mode of ['Memo Recall', 'Trace Sprint']) {
    await page.getByRole('radio', { name: mode }).click();
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
    await holdSpace(page);
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toHaveCount(0);
    if (mode === 'Memo Recall') {
      await page.keyboard.press('Space');
      await page.keyboard.press('Escape');
    } else {
      await page.getByRole('button', { name: /^Submit/ }).click();
    }
    await expect(page.getByRole('button', { name: /Next/ })).toBeVisible();
    await page.getByRole('button', { name: /Next/ }).click();
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toBeVisible();
  }
});

test('production search worker serves the hashed module for timer and restricted scrambles', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'Runs against an explicit production build or deployment.');
  await load(page);
  const workerResponses: { url: string; status: number; contentType: string }[] = [];
  const runtimeErrors: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('search-worker-entry')) {
      workerResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type'] ?? '',
      });
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await page.goto('/');
  const timerScramble = page.getByRole('region', { name: 'Scramble' });
  await expect(timerScramble).toBeVisible({ timeout: 45_000 });
  await expect(timerScramble).toContainText(/[UDFBRL]/, { timeout: 15_000 });
  const firstScramble = await timerScramble.innerText();
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: 'New scramble' }).click();
    await expect.poll(() => timerScramble.innerText(), { timeout: 45_000 }).not.toBe(firstScramble);
  }

  await page.goto('/training');
  for (const mode of ['Memo Recall', 'Trace Sprint']) {
    await page.getByRole('radio', { name: mode }).click();
    await holdSpace(page);
    await expect(page.getByRole('timer', { name: 'Hold Space to start' })).toHaveCount(0);
    if (mode === 'Memo Recall') {
      await page.keyboard.press('Space');
      await page.keyboard.press('Escape');
    } else {
      await page.getByRole('button', { name: /^Submit/ }).click();
    }
    await page.getByRole('button', { name: /Next/ }).click();
  }

  await page.getByRole('radio', { name: 'Execution Sprint' }).click();
  for (const scope of ['Both', 'Edges', 'Corners']) {
    await page.getByRole('radio', { name: scope, exact: true }).click();
    const scramble = page.getByRole('region', { name: 'Scramble' });
    await expect(scramble.getByText('Preparing scramble…')).toHaveCount(0, { timeout: 45_000 });
    await expect(scramble).toContainText(/[UDFBRL]/);
  }

  expect(workerResponses.length).toBeGreaterThan(0);
  expect(workerResponses.every(({ url }) => /search-worker-entry-[\w-]+\.js$/.test(url))).toBe(true);
  expect(workerResponses.every(({ status }) => status === 200 || status === 304)).toBe(true);
  expect(workerResponses.filter(({ status }) => status === 200).every(({ contentType }) => /javascript/.test(contentType))).toBe(true);
  expect(
    runtimeErrors.filter((message) =>
      /worker|scramble|document is not defined|font-src|content security policy[^\n]*font/i.test(message),
    ),
  ).toEqual([]);
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

test('Memo Recall results use read-only reconstruction without word-editing clutter', async ({ page }) => {
  await load(page);
  await page.goto('/training');
  await page.getByRole('radio', { name: 'Memo Recall' }).click();
  await expect(page.getByRole('button', { name: 'Suggest' })).toHaveCount(0);
  await holdSpace(page);
  await expect(page.getByRole('button', { name: 'Suggest' })).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Suggest' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Memo Recall result' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suggest' })).toHaveCount(0);
});

test('Settings Support scrollspy, feedback validation and signed-out optional contact match the final UI', async ({ page }) => {
  await load(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Support', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Support', exact: true })).toHaveAttribute('aria-current', 'true');
  const feedbackTrigger = page.getByRole('button', { name: 'Give feedback' });
  await feedbackTrigger.click();
  await expect(page.getByLabel('Email (optional)')).toBeVisible();
  await expect(page.getByLabel('Message')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeDisabled();
  await page.getByLabel('Message').fill('A local acceptance-test report');
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Give feedback' })).toHaveCount(0);
  await expect(feedbackTrigger).toBeFocused();
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

test('method choices are supported-only and explicitly choose view-relative physical buffers', async ({ page }) => {
  const data = workspace(); data.defaultCubeView = { top: 'white', front: 'orange' };
  await load(page, data); await page.goto('/settings');
  const edges = page.getByRole('radiogroup', { name: 'Edge method' });
  const corners = page.getByRole('radiogroup', { name: 'Corner method' });
  await expect(edges.getByRole('radio')).toHaveText(['OP', 'M2']);
  await expect(corners.getByRole('radio')).toHaveText(['OP']);
  await expect(page.getByText('3-style', { exact: true })).toHaveCount(0);
  await edges.getByRole('radio', { name: 'OP' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(500);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.scheme.edgeMethod).toBe('old-pochmann'); expect(saved.scheme.edgeBuffer).toBe('U:UB');
  const swap = page.getByRole('switch', { name: 'Automatically swap M2 targets' });
  await expect(swap).toBeVisible(); await swap.click();
  await edges.getByRole('radio', { name: 'M2' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(500);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.scheme.edgeBuffer).toBe('D:DL'); expect(saved.m2SecondTargetSwap).toBe(true);
  await page.getByRole('radio', { name: 'Cube view' }).click();
  await page.getByRole('radio', { name: 'Green' }).last().click();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(500);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.defaultCubeView).toEqual({ top: 'white', front: 'green' }); expect(saved.scheme.edgeBuffer).toBe('D:DL');
});

test('all Training drills share scope while retaining distinct challenges', async ({ page }) => {
  await load(page); await page.goto('/training');
  await page.getByRole('radio', { name: 'Edges', exact: true }).click();
  const ids = new Set<string>();
  for (const mode of ['Execution Sprint', 'Guided Solve', 'Memo Recall', 'Trace Sprint']) {
    await page.getByRole('radio', { name: mode }).click();
    await expect(page.getByRole('radio', { name: 'Edges', exact: true })).toHaveAttribute('aria-checked', 'true');
    ids.add((await page.locator('[data-training-challenge-id]').getAttribute('data-training-challenge-id'))!);
  }
  expect(ids.size).toBe(4);
  await page.getByRole('radio', { name: 'Corners', exact: true }).click();
  await page.getByRole('radio', { name: 'Execution Sprint' }).click();
  await expect(page.getByRole('radio', { name: 'Corners', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('link', { name: 'Timer', exact: true }).click();
  await page.getByRole('link', { name: 'Training', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Corners', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('Settings no longer exposes vocabulary strategy while pair overrides remain available', async ({ page }) => {
  await load(page, workspace(true)); await page.goto('/settings');
  await expect(page.getByRole('radiogroup', { name: 'Edge and corner vocabulary' })).toHaveCount(0);
  await page.goto('/pairs'); await page.getByRole('gridcell', { name: /TW, tow/ }).click();
  const editor = page.getByRole('dialog', { name: 'Pair TW' });
  await expect(editor.getByRole('radio', { name: 'Shared' })).toBeVisible();
  await expect(editor.getByRole('radio', { name: 'Edges' })).toBeVisible();
  await expect(editor.getByRole('radio', { name: 'Corners' })).toBeVisible();
});

test('Timer hold, memo split, execution stop and reconstruction save form one solve', async ({ page }) => {
  await load(page);
  await page.goto('/');
  await waitForTimerScramble(page);
  await holdSpace(page);
  await expect(page.getByText('Memorising', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('Executing', { exact: true })).toBeVisible();
  await page.waitForTimeout(30);
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog', { name: 'Memo reconstruction' })).toBeVisible();
  // A random scramble can reach review immediately (no unresolved break or word),
  // in which case the primary action is already "Save solve".
  await page.getByRole('button', { name: /Skip to save|Save solve/ }).click();
  await expect(page.getByRole('dialog', { name: 'Memo reconstruction' })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cubeiq-bld-v2:guest')!).data);
  expect(saved.solves).toHaveLength(1);
  expect(saved.solves[0].memoMs).toBeGreaterThan(0);
  expect(saved.solves[0].executionMs).toBeGreaterThanOrEqual(0);
  expect(saved.solves[0].totalMs).toBeGreaterThanOrEqual(saved.solves[0].memoMs);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Solves', exact: true }).locator('li')).toHaveCount(1);
});

test('hidden live timer masks active total and split times but reveals the final result', async ({ page }) => {
  await load(page);
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Show live timer' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Show live timer' })).toHaveAttribute('aria-checked', 'false');

  await page.goto('/');
  await waitForTimerScramble(page);
  await holdSpace(page);
  await expect(page.getByRole('timer')).toHaveText('Solve');
  await page.waitForTimeout(80);
  await expect(page.getByRole('timer')).toHaveText('Solve');
  await page.keyboard.press('Space');
  await expect(page.getByRole('timer')).toHaveText('Solve');
  await expect(page.getByText('Executing', { exact: true })).not.toContainText(/\d/);
  await expect(page.getByText('memo', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await expect(page.getByRole('timer')).not.toHaveText('Solve');
  await expect(page.getByRole('timer')).toContainText(/\d/);
});

test('M2 and memo-order preferences persist without manual orientation or parity instructions', async ({ page }) => {
  await load(page);
  await page.goto('/settings');
  await expect(page.getByText('Memo conventions', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Memo separately, at the end' })).toHaveCount(0);
  await expect(page.getByText('Flipped edges', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Twisted corners', { exact: true })).toHaveCount(0);
  await expect(page.getByText('BLD orientation', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('BLD orientation front')).toHaveCount(0);
  const m2 = page.getByRole('switch', { name: 'Automatically swap M2 targets' });
  await expect(m2).toHaveAttribute('aria-checked', 'false');
  await expect(m2).toBeEnabled();
  await m2.click();
  await page.getByRole('radio', { name: 'Edges first' }).click();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Automatically swap M2 targets' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Edges first' })).toHaveAttribute('aria-checked', 'true');

  await page.goto('/training');
  await page.getByRole('radio', { name: 'Memo Recall' }).click();
  await holdSpace(page);
  await expect(page.getByText(/M2 parity/i)).toHaveCount(0);
  const headings = page.locator('main h2');
  await expect(headings.first()).toHaveText('Edges');
  await expect(headings.nth(1)).toHaveText('Corners');
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

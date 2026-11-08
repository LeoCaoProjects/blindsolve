import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import type { AppData } from "../src/lib/repository";
import { writePairEntries } from "../src/magic/utils/pairPersistence";
const tokens = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");
const fixture = writePairEntries(
  {
    pairs: {},
    solves: [],
    attempts: [],
    scheme: createSpeffzScheme(),
    onboarded: true,
  } as AppData,
  Object.fromEntries(
    tokens.flatMap((a) =>
      tokens
        .filter((b) => b !== a)
        .map((b) => [`${a}|${b}`, { shared: [`${a}${b} word`] }]),
    ),
  ),
  "2026-11-08T00:00:00.000Z",
);
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!));
test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
      );
  }, fixture);
});
async function hold(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.down("Space");
  await page.waitForTimeout(400);
  await page.keyboard.up("Space");
}
async function unchanged(page: Page, before: unknown) {
  const after = await stored(page);
  expect(after.data.pairs).toEqual(before);
  expect(
    Object.values(after.pending ?? {}).some(
      (c) => (c as { kind: string }).kind === "pair",
    ),
  ).toBe(false);
  for (const pair of Object.values(after.data.pairs)) {
    expect(pair).not.toHaveProperty("encounters");
    expect(pair).not.toHaveProperty("forgotten");
  }
}
test("Flashcards retain remembered and forgotten attempts without modifying pair records", async ({
  page,
}) => {
  await page.goto("/flashcards");
  await expect(page.getByRole("button", { name: /^Reveal/ })).toBeVisible();
  const before = (await stored(page)).data.pairs;
  for (const response of ["Remembered", "Forgot"]) {
    await page.getByRole("button", { name: /^Reveal/ }).click();
    await page.waitForTimeout(250);
    await page
      .getByRole("button", { name: new RegExp(`^${response}`) })
      .click();
  }
  await expect
    .poll(async () => (await stored(page)).data.attempts.length)
    .toBe(2);
  expect(
    (await stored(page)).data.attempts
      .map((a: { correct: boolean }) => a.correct)
      .sort(),
  ).toEqual([false, true]);
  await unchanged(page, before);
});
test("Execution Sprint retains its attempt without writing pair usage", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByRole("radio", { name: "Words", exact: true }).click();
  const before = (await stored(page)).data.pairs;
  await hold(page);
  await expect(page.locator("main ol[aria-label]").first()).toBeVisible();
  await page.keyboard.press("Space");
  const result = page.getByRole("dialog", { name: "Execution Sprint result" });
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: /^Close/ }).click();
  await expect
    .poll(async () => (await stored(page)).data.attempts.length)
    .toBe(1);
  expect((await stored(page)).data.attempts[0].trainingMode).toBe("exec");
  await unchanged(page, before);
});
test("Timer reconstruction retains a solve without modifying existing pair records", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const before = (await stored(page)).data.pairs;
  await hold(page);
  await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByText("Executing", { exact: true })).toBeVisible();
  await page.waitForTimeout(30);
  await page.keyboard.press("Space");
  const result = page.getByRole("dialog", { name: "Memo reconstruction" });
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: /Skip to save|Save solve/ }).click();
  await expect(result).toHaveCount(0);
  expect((await stored(page)).data.solves).toHaveLength(1);
  await unchanged(page, before);
});

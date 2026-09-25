import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

async function startTimer(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}

async function completeReconstruction(page: Page) {
  for (let index = 0; index < 24; index++) {
    const option = page.locator(".cycle-token-list button").first();
    if (!(await option.isVisible())) break;
    await page.keyboard.press((await option.innerText()).trim());
    await page.waitForTimeout(240);
  }
  await expect(page.locator('input[aria-label^="Word you used for"]:visible').first()).toBeVisible({ timeout: 10000 });
  for (let index = 0; index < 48; index++) {
    const input = page.locator('input[aria-label^="Word you used for"]:visible').first();
    if (!(await input.isVisible())) break;
    const label = await input.getAttribute("aria-label");
    await input.fill(`memo ${index + 1}`);
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByLabel(label!, { exact: true })).toBeHidden();
    await page.waitForTimeout(220);
  }
  await expect(page.getByRole("heading", { name: "Corners" })).toBeVisible();
  await page.getByRole("button", { name: "Save solve" }).click();
}

test("standard timing skips the split and keeps overlays in control of Space and Escape", async ({
  page,
}) => {
  await page.goto("/settings");
  const defaults = page.getByRole("button", { name: "Use these defaults" });
  if (await defaults.isVisible()) await defaults.click();
  await page.getByLabel("Multiphase timing").uncheck();
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await startTimer(page);
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  const reconstruction = page.getByRole("dialog", {
    name: "Memo reconstruction",
  });
  await expect(reconstruction).toBeVisible();
  await page.keyboard.press("Space");
  await expect(reconstruction).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reconstruction).toBeVisible();
  await page.getByRole("radio", { name: /\+2/ }).click();
  await completeReconstruction(page);
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
  expect(stored.solves).toHaveLength(1);
  expect(stored.solves[0].memoMs).toBe(0);
  expect(stored.solves[0].executionMs).toBe(stored.solves[0].totalMs);
  expect(stored.solves[0].result).toBe("+2");
  expect(stored.solves[0].multiphase).toBe(false);
});

test("Timer document stays fixed while a long solve history scrolls internally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const scheme = createSpeffzScheme();
  const solves = Array.from({ length: 250 }, (_, index) => ({
    id: crypto.randomUUID(),
    scramble: "R U",
    memoMs: 10000,
    executionMs: 20000 + index,
    totalMs: 30000 + index,
    result: index % 17 === 0 ? ("dnf" as const) : ("success" as const),
    edgeMemo: ["A", "B"],
    cornerMemo: ["C", "D"],
    cycleBreaks: { edges: [], corners: [] },
    reconstruction: "complete" as const,
    createdAt: new Date(Date.UTC(2026, 8, 25, 0, index)).toISOString(),
  }));
  await page.addInitScript(
    ({ scheme, solves }) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          revision: 0,
          dirty: false,
          data: {
            scheme,
            pairs: {},
            solves,
            attempts: [],
            onboarded: true,
            schemeUpdatedAt: "2026-09-25T00:00:00Z",
          },
        }),
      ),
    { scheme, solves },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const metrics = await page.evaluate(() => {
    const history = document.querySelector<HTMLElement>(".workspace-history ol")!;
    return {
      documentFits: document.documentElement.scrollHeight <= innerHeight,
      historyOverflow: getComputedStyle(history).overflowY,
      historyScrolls: history.scrollHeight > history.clientHeight,
      stageHeight: document.querySelector<HTMLElement>(".timer-page-v1")!.getBoundingClientRect().height,
      viewportHeight: innerHeight,
    };
  });
  expect(metrics.documentFits).toBe(true);
  expect(metrics.historyOverflow).toBe("auto");
  expect(metrics.historyScrolls).toBe(true);
  expect(metrics.stageHeight).toBe(metrics.viewportHeight);
});

test("sticker control reveals the active custom scheme on the cube without a popup", async ({
  page,
}) => {
  const scheme = createSpeffzScheme();
  scheme.stickers["U:UB"] = { ...scheme.stickers["U:UB"], label: "CH" };
  await page.addInitScript((scheme) => {
    localStorage.setItem(
      "cubeiq-bld-v2:guest",
      JSON.stringify({
        revision: 0,
        dirty: false,
        data: {
          scheme,
          pairs: {},
          solves: [],
          attempts: [],
          onboarded: true,
          schemeUpdatedAt: "2026-09-25T00:00:00Z",
        },
      }),
    );
  }, scheme);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start timer", exact: true })).toBeEnabled({ timeout: 45000 });
  const cube = page.getByRole("group", { name: "Scrambled cube" });
  await page.getByRole("button", { name: "Sticker letters" }).click();
  await expect(cube.getByText("CH", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /sticker letters/i })).toHaveCount(0);
});

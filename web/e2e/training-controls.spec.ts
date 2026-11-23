import { test, expect, type Page } from "@playwright/test";
import { emptyData } from "../src/data/model";
import { scrambleToState } from "../src/domain/bld/cubing";
import { traceWithCanonicalBreaks } from "../src/domain/bld/trace";
import { applyM2SecondTargetSwap } from "../src/domain/bld/memoConventions";

async function controls(page: Page, mode: string, close = true) {
  const trigger = page.getByRole("button", {
    name: "Training controls",
    exact: true,
  });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole("radio", { name: mode, exact: true }).click();
  if (close) await closeControls(page);
}
async function closeControls(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await dialog.isVisible())
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
}
async function start(page: Page) {
  const idle = page.getByRole("timer", {
    name: "Hold Space to start",
    exact: true,
  });
  await expect(idle).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
  await idle.click();
  await page.keyboard.down("Space");
  await expect(
    page.getByRole("timer", { name: "Ready, release to start", exact: true }),
  ).toBeVisible();
  await page.keyboard.up("Space");
}
async function seed(page: Page, multi = false) {
  const data = emptyData();
  data.onboarded = true;
  if (multi)
    Object.values(data.scheme.stickers).forEach((s) => {
      s.label += "H";
    });
  data.attempts = (
    ["exec", "guided", "recall", "trace", "recognition"] as const
  ).map((trainingMode, i) => ({
    id: `50000000-0000-4000-8000-00000000001${i}`,
    kind: "memo",
    trainingMode,
    correct: true,
    accuracy: 0.75,
    durationMs: 2000,
    targets: 4,
    createdAt: "2026-11-01T00:00:00.000Z",
  }));
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, dirty: false, revision: 0 }),
      );
  }, data);
  await page.goto("/training");
  return data;
}

test("mouse result selection still allows Enter to close", async ({
  page,
}) => {
  await seed(page);
  for (const mode of ["Execution Sprint", "Guided Solve"]) {
    await controls(page, mode);
    await start(page);
    if (mode === "Guided Solve") await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    const dialog = page.getByRole("dialog", {
      name: `${mode} result`,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("radio", { name: "DNF", exact: true }).click();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-attempt-row]").first()).toContainText(
      "DNF",
    );
    await page.keyboard.press("1");
    await expect(page.locator("[data-attempt-row]").first()).not.toContainText("DNF");
    await page.keyboard.press("2");
    await expect(page.locator("[data-attempt-row]").first()).toContainText("DNF");
  }
});

test("idle result keys work in every training mode", async ({ page }) => {
  await seed(page);
  for (const mode of ["Execution Sprint", "Guided Solve", "Memo Recall", "Trace Sprint", "Target Recognition"]) {
    await controls(page, mode);
    const row = page.locator("[data-attempt-row]").first();
    await page.keyboard.press("2");
    await expect(row).toContainText("DNF");
    await page.keyboard.press("1");
    await expect(row).not.toContainText("DNF");
  }
});

for (const width of [1440, 390])
  test(`M2 controls and multi-character answers at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const data = await seed(page, true);
    await controls(page, "Trace Sprint", false);
    await page
      .getByRole("radiogroup", { name: "Pieces", exact: true })
      .getByRole("radio", { name: "Edges", exact: true })
      .click();
    const swap = page.getByRole("radiogroup", {
      name: "M2 target swap",
      exact: true,
    });
    await swap.getByRole("radio", { name: "On", exact: true }).click();
    await expect(
      swap.getByRole("radio", { name: "On", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
    await page.screenshot({
      path: test.info().outputPath(`training-m2-${width}.png`),
    });
    await closeControls(page);
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
    const scramble = (await page
      .getByRole("region", { name: "Scramble", exact: true })
      .locator(".sr-only")
      .textContent())!.replace(/^Scramble /, "");
    const state = await scrambleToState(scramble);
    const raw = traceWithCanonicalBreaks(state, data.scheme).trace.edges;
    const targets = applyM2SecondTargetSwap(raw, data.scheme).targets;
    await start(page);
    const field = page.getByRole("textbox", {
      name: "Edges targets",
      exact: true,
    });
    await field.fill(
      targets
        .map((t) => t.token)
        .join(" ")
        .toLowerCase(),
    );
    await field.press("Enter");
    const review = page.getByRole("dialog", {
      name: "Trace Sprint review",
      exact: true,
    });
    await expect(review).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const attempts = JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts;
      return attempts.find((attempt: { trainingMode: string }) => attempt.trainingMode === "trace").correct;
    })).toBe(true);
    await review.press("Enter");
    await expect(review).toHaveCount(0);
    await controls(page, "Target Recognition", false);
    await expect(
      swap.getByRole("radio", { name: "On", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await swap.getByRole("radio", { name: "Off", exact: true }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.m2SecondTargetSwap)).toBe(false);
    await swap.getByRole("radio", { name: "On", exact: true }).click();
    await closeControls(page);
    await start(page);
    await expect(page.getByLabel("M2 target position", { exact: true })).toHaveText(/M2 (first|second) target/);
    const input = page.getByLabel("Target label", { exact: true });
    await input.press("s");
    await input.press("h");
    await expect(page.locator("[data-recognition-progress]")).toContainText(
      "1 /",
    );
    await input.press("Enter");
    await expect(page.locator("[data-recognition-progress]")).toContainText(
      "2 /",
    );
    await expect(
      page.getByRole("button", { name: "Focus recognition typing" }),
    ).toContainText("SH");
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data
            .m2SecondTargetSwap,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

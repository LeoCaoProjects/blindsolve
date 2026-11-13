import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            attempts: [
              {
                id: "70000000-0000-4000-8000-000000000001",
                kind: "memo",
                trainingMode: "trace",
                createdAt: "2026-11-10T01:00:00Z",
                durationMs: 10000,
                targets: 20,
                correct: false,
                accuracy: 0.65,
              },
            ],
            solves: [],
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});
test("Trace history shows correct targets over total targets", async ({
  page,
}) => {
  await page.goto("/training");
  await page.getByRole("radio", { name: "Trace Sprint", exact: true }).click();
  const row = page.locator("[data-attempt-row]");
  await expect(row).toContainText("13/20 targets");
  await expect(row).toContainText("DNF");
});

for (const width of [1440, 390])
  test(`Recognition scope changes keep the idle timer and description anchored at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/training");
    const controls = page.getByRole("button", {
      name: "Training controls",
      exact: true,
    });
    if (await controls.isVisible()) await controls.click();
    await page
      .getByRole("radio", { name: "Target Recognition", exact: true })
      .click();
    const sheet = page.getByRole("dialog", {
      name: "Training controls",
      exact: true,
    });
    if (await sheet.isVisible())
      await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);
    const before = await page
      .getByRole("timer", { name: "Hold Space to start", exact: true })
      .boundingBox();
    const helpBefore = await page
      .getByRole("button", { name: "How it works", exact: true })
      .boundingBox();
    for (const scope of ["Edges", "Corners", "Both"]) {
      if (await controls.isVisible()) await controls.click();
      await page.getByRole("radio", { name: scope, exact: true }).click();
      const frames = await page.evaluate(async () => {
        const samples: number[][] = [];
        for (let i = 0; i < 24; i++) {
          await new Promise(requestAnimationFrame);
          const timer = document
            .querySelector('[role="timer"][aria-label="Hold Space to start"]')!
            .getBoundingClientRect();
          const help = [...document.querySelectorAll("button")]
            .find((b) => b.textContent?.trim() === "How it works")!
            .getBoundingClientRect();
          samples.push([timer.x, timer.y, help.x, help.y]);
        }
        return samples;
      });
      for (const frame of frames)
        for (const [i, expected] of [
          before!.x,
          before!.y,
          helpBefore!.x,
          helpBefore!.y,
        ].entries())
          expect(Math.abs(frame[i] - expected)).toBeLessThan(0.6);
      if (await sheet.isVisible())
        await sheet.getByRole("button", { name: "Close", exact: true }).click();
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
      const after = await page
        .getByRole("timer", { name: "Hold Space to start", exact: true })
        .boundingBox();
      expect(Math.abs(after!.y - before!.y)).toBeLessThan(0.6);
    }
  });

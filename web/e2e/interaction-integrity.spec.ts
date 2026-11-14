import { chooseTimerMode } from "./helpers/timerMode";
import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
const sizes = [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
];
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            solves: [],
            attempts: [],
            pairs: {},
            defaultCubeView: { top: "white", front: "green" },
          },
          revision: 0,
          dirty: false,
          pending: {},
        }),
      ),
    createSpeffzScheme(),
  );
});
for (const surface of ["timer", "training"])
  for (const [width, height] of sizes)
    test(`${surface} scramble loading and ready keep the same geometry at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/*search-worker-entry*", async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto(surface === "timer" ? "/" : "/training");
      const region = page.getByRole("region", {
        name: "Scramble",
        exact: true,
      });
      await expect(region.getByRole("status")).toBeVisible();
      const before = await region.boundingBox();
      release();
      await expect(region.locator(".sr-only").first()).toContainText(
        "Scramble ",
        { timeout: 30000 },
      );
      await expect(region.getByRole("status")).toHaveCount(0);
      const after = await region.boundingBox();
      expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
      expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
      if (surface === "timer") {
        const clock = page.locator("[data-timer-clock]");
        const clockBefore = await clock.boundingBox();
        // Fail only this isolated fixture's next restricted-scramble request.
        await page.evaluate(() => {
          crypto.getRandomValues = () => {
            throw new Error("fixture scramble failure");
          };
        });
        await chooseTimerMode(page, "edges");
        await expect(region.getByRole("alert")).toContainText(
          "Scramble unavailable. Try again.",
        );
        expect(await region.boundingBox()).toEqual(after);
        expect(await clock.boundingBox()).toEqual(clockBefore);
        await page.evaluate(() => {
          delete (crypto as unknown as Record<string, unknown>).getRandomValues;
        });
        const refresh = region.getByRole("button", {
          name: "New scramble",
          exact: true,
        });
        await refresh.click();
        await expect(refresh).toBeEnabled({ timeout: 30000 });
        await expect(region.getByRole("alert")).toHaveCount(0);
        await page.evaluate(() => {
          crypto.getRandomValues = () => {
            throw new Error("fixture refresh failure");
          };
        });
        await refresh.click();
        await expect(region.getByRole("alert")).toContainText(
          "New scramble failed",
        );
        expect(await region.boundingBox()).toEqual(after);
        expect(await clock.boundingBox()).toEqual(clockBefore);
        const error = (await region.getByRole("alert").boundingBox())!;
        const modes = (await page
          .getByRole("button", { name: "Timer mode", exact: true })
          .boundingBox())!;
        expect(error.x + error.width).toBeLessThan(modes.x);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
test("Pieces and Show align with mode boxes and have equal segments", async ({
  page,
}) => {
  await page.goto("/training");
  const mode = await page
    .getByRole("radio", { name: "Execution Sprint", exact: true })
    .boundingBox();
  for (const label of ["Pieces", "Show"]) {
    const group = page.getByRole("radiogroup", { name: label, exact: true });
    const box = await group.boundingBox();
    expect(Math.abs(box!.x - mode!.x)).toBeLessThan(1);
    expect(Math.abs(box!.width - mode!.width)).toBeLessThan(1);
    const choices = group.getByRole("radio");
    const boxes = await choices.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().width),
    );
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(1);
    await choices.last().click();
    await expect
      .poll(async () => {
        const indicator = await group
          .locator("[data-selection-indicator]")
          .boundingBox();
        const choice = await choices.last().boundingBox();
        return Math.max(
          Math.abs(indicator!.x - choice!.x),
          Math.abs(indicator!.width - choice!.width),
        );
      })
      .toBeLessThan(1);
  }
});

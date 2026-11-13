import { viewportGeometry } from "./helpers/viewport";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Apply and acknowledge actual Chrome tab zoom before exercising native window bounds.
for (const zoom of [0.8, 1, 1.25, 1.5]) {
  test(`Timer remains usable at native ${zoom * 100}% browser zoom`, async ({ baseURL }) => {
    const { nativeBrowser } = await import("../scripts/native-browser-session.mjs");
    const native = await nativeBrowser("chrome");
    try {
      const page = native.page!;
      await native.resize(1440, 900);
      const url = new URL("/", baseURL);
      const response = await page.goto(url.href);
      expect(response?.ok()).toBe(true);
      await expect(page).toHaveURL(url.href);
      await expect(
        page.getByRole("button", { name: "New scramble", exact: true }),
      ).toBeEnabled({ timeout: 45000 });
      const measure = () => page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      }));
      const before = await measure();
      await native.zoom(zoom);
      const after = await measure();
      console.log("NATIVE_ZOOM_PREFLIGHT", { browser: native.version, zoom, before, after });
      expect(after.dpr / before.dpr).toBeCloseTo(zoom, 2);
      expect(Math.abs(after.width - before.width / zoom)).toBeLessThan(2);
      expect(Math.abs(after.height - before.height / zoom)).toBeLessThan(2);
      for (const [width, height] of [
        [1440, 900],
        [1280, 720],
        [1024, 768],
        [900, 560],
      ]) {
        await native.resize(width, height);
        // Confirm actual zoom reduced/enlarged CSS viewport interpretation.
        await expect
          .poll(async () =>
            Math.abs((await page.evaluate(() => innerWidth)) - width / zoom),
          )
          .toBeLessThan(2);
        await expect
          .poll(async () =>
            Math.abs((await page.evaluate(() => innerHeight)) - height / zoom),
          )
          .toBeLessThan(2);
        const { rem } = await viewportGeometry(page);
        const root = await page.evaluate(() => Math.max(innerHeight * 19.2 / 900, innerWidth * 12.8 / 1440));
        expect(rem).toBeCloseTo(root, 1);
        await expect(page.locator("html")).toHaveCSS("zoom", "1");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const clock = page.getByRole("timer");
        await clock.scrollIntoViewIfNeeded();
        await expect(clock).toBeInViewport({ ratio: 0.99 });
        const clockContent = (await page
          .locator("[data-timer-clock]")
          .boundingBox())!;
        const clockSpace = (await page
          .locator("[data-timer-clock]")
          .locator("..")
          .boundingBox())!;
        expect(clockContent.height).toBeLessThanOrEqual(clockSpace.height + 1);
        const clockBox = (await clock.boundingBox())!;
        const footer = (await page
          .getByRole("region", { name: "Last solve memo" })
          .boundingBox())!;
        expect(clockBox.height).toBeGreaterThan(40 * rem / 19.2);
        expect(clockBox.y + clockBox.height).toBeLessThanOrEqual(
          footer.y + 0.5,
        );
        expect(footer.height).toBeCloseTo(84 * rem / 16, 0);
        const trigger = page.getByRole("button", {
          name: "Timer mode",
          exact: true,
        });
        await trigger.click();
        const menu = page.getByRole("dialog", { name: "Timer mode choices" });
        await expect(menu).toHaveCSS("background-color", "rgb(37, 37, 39)");
        await expect(menu).toHaveCSS("opacity", "1");
        const box = (await menu.boundingBox())!;
        const viewport = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
        }));
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        if (process.env.TIMER_REFINEMENT_DIR) {
          await mkdir(process.env.TIMER_REFINEMENT_DIR, { recursive: true });
          // Capture the compositor viewport: Playwright's CSS-pixel clip can
          // crop screenshots at native browser zoom despite correct DOM geometry.
          await native.screenshot(
            join(process.env.TIMER_REFINEMENT_DIR, `zoom-${zoom * 100}-${width}.png`),
          );
        }
        await page.keyboard.press("Escape");
        const history = page.getByRole("list", { name: "Solves", exact: true });
        await history.scrollIntoViewIfNeeded();
        await expect(history).toBeInViewport();
        const historyBox = (await history.boundingBox())!;
        expect(historyBox.height).toBeGreaterThan(20);
        expect(historyBox.height).toBeLessThanOrEqual(viewport.height);
        console.log("NATIVE_ZOOM", {
          zoom,
          width,
          height,
          viewport,
          clock: clockBox.height,
        });
      }
    } finally {
      await native.close();
    }
  });
}

import { viewportGeometry } from "./helpers/viewport";
import { chromium, expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";

// Native browser zoom, not CSS zoom, DPR overrides, pinch zoom or viewport emulation.
// Chromium stores the default partition's zoom level under "x". Source:
// https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
for (const zoom of [0.8, 1, 1.25, 1.5]) {
  test(`Timer remains usable at native ${zoom * 100}% browser zoom`, async () => {
    const profile = await mkdtemp(join(tmpdir(), "blindsolve-zoom-"));
    const profileRelativePath = relative(tmpdir(), profile);
    if (isAbsolute(profileRelativePath) || profileRelativePath.startsWith(".."))
      throw new Error("Unexpected test profile path");

    await mkdir(join(profile, "Default"));
    await writeFile(
      join(profile, "Default", "Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
      viewport: null,
      headless: true,
      args: ["--window-size=1440,900"],
    });
    try {
      const page = context.pages()[0];
      await page.goto(
        process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
      );
      await expect(
        page.getByRole("button", { name: "New scramble", exact: true }),
      ).toBeEnabled({ timeout: 45000 });
      const cdp = await context.newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      const trim = await page.evaluate(
        (factor) => ({
          width: outerWidth - innerWidth * factor,
          height: outerHeight - innerHeight * factor,
        }),
        zoom,
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 720],
        [1024, 768],
        [900, 560],
      ]) {
        await cdp.send("Browser.setWindowBounds", {
          windowId,
          bounds: {
            width: Math.round(width + trim.width),
            height: Math.round(height + trim.height),
          },
        });
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
          const capture = await cdp.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false,
          });
          await writeFile(
            join(
              process.env.TIMER_REFINEMENT_DIR,
              `zoom-${zoom * 100}-${width}.png`,
            ),
            Buffer.from(capture.data, "base64"),
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
      await context.close();
      // Only remove the unique test profile created above, inside the OS temp directory.
      await rm(profile, { recursive: true, force: true });
    }
  });
}

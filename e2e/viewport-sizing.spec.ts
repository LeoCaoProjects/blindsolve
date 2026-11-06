import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

test("viewport experiment adapts to ordinary and awkward window shapes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const output = resolve("test-results/viewport-windows");
  await mkdir(output, { recursive: true });
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [900, 560],
    [390, 844],
    [320, 568],
    [1920, 400],
    [900, 1400],
    [2560, 1080],
    [1440, 300],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of ["/", "/settings"]) {
      await page.goto(route + "?sizing=viewport");
      if (route === "/") {
        await expect(
          page.getByRole("button", { name: "New scramble", exact: true }),
        ).toBeEnabled({ timeout: 45000 });
        await expect(page.getByRole("timer")).toBeInViewport();
      } else await expect(page.locator('[data-section="cube"]')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: join(
          output,
          `${route === "/" ? "timer" : "settings"}-${width}x${height}.png`,
        ),
      });
    }
  }
});

test("viewport prototype preserves the 900px-high reference appearance", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ["/", "/settings"]) {
    const snapshots = [];
    for (const suffix of ["", "?sizing=viewport"]) {
      await page.goto(route + suffix);
      if (route === "/")
        await expect(
          page.getByRole("button", { name: "New scramble", exact: true }),
        ).toBeEnabled({ timeout: 45000 });
      else await expect(page.locator('[data-section="cube"]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveCSS("font-size", "19.2px");
      await expect(page.locator("html")).toHaveCSS("zoom", "1");
      await expect(page.locator("html")).toHaveCSS("transform", "none");
      snapshots.push(
        await page.evaluate(() => {
          const selectors = [
            'nav[aria-label="Sections"]',
            "[data-subnav-column]",
            '[role="timer"]',
            '[aria-label="Scramble"]',
            "[data-timer-cube-viewport]",
            '[aria-label="Scrambled cube"]',
            '[aria-label="Solves"]',
            '[aria-label="Last solve memo"]',
            'button[aria-label="Sticker letters"]',
            'button[aria-label="New scramble"] svg',
            ".timer-reference-column dl",
            '[data-section="cube"]',
          ];
          return selectors.flatMap((selector) =>
            Array.from(document.querySelectorAll(selector)).map((el) => {
              const { x, y, width, height } = el.getBoundingClientRect();
              return { selector, x, y, width, height };
            }),
          );
        }),
      );
    }
    expect(snapshots[1].length).toBe(snapshots[0].length);
    for (let i = 0; i < snapshots[0].length; i++) {
      for (const axis of ["x", "y", "width", "height"] as const)
        expect(
          Math.abs(snapshots[1][i][axis] - snapshots[0][i][axis]),
          `${route} ${snapshots[0][i].selector} ${axis}`,
        ).toBeLessThan(0.15);
    }
  }
});

test("prototype controls, cube and settings scroll remain interactive", async ({
  page,
}) => {
  await page.goto("/?sizing=viewport");
  const letters = page.getByRole("button", {
    name: "Sticker letters",
    exact: true,
  });
  await letters.click();
  await expect(letters).toHaveAttribute("aria-pressed", "true");
  const cube = page.getByRole("group", { name: "Scrambled cube", exact: true });
  const before = await cube.locator(":scope > div").getAttribute("style");
  const box = (await cube.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(() => cube.locator(":scope > div").getAttribute("style"))
    .not.toBe(before);
  const mode = page.getByRole("button", { name: "Timer mode", exact: true });
  await mode.click();
  const menu = page.getByRole("dialog", { name: "Timer mode choices" });
  await expect(menu).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Edges", exact: true }).click();
  await expect(menu).not.toBeVisible();
  await expect(mode).toContainText("Edges");
  await page.goto("/settings?sizing=viewport");
  const section = page.locator('[data-section="cube"]');
  await expect(section).toBeVisible();
  const scroll = section.locator("xpath=../../..");
  await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("coarse-pointer mobile keeps its existing root and layout", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/?sizing=viewport");
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-viewport-sizing",
    );
    await expect(page.locator("html")).toHaveCSS("font-size", "19.2px");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-viewport-sizing",
    );
    await expect(page.locator("html")).toHaveCSS("font-size", "19.2px");
  } finally {
    await context.close();
  }
});

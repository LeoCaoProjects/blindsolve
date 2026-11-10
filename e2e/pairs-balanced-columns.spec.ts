import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

for (const width of [1440, 390])
  test(`custom vocabulary uses balanced reading columns at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const scheme = createSpeffzScheme();
    // Different edge/corner labels produce 36 active tokens, like a customized scheme.
    for (const sticker of Object.values(scheme.stickers))
      if (sticker.pieceType === "corner" && sticker.label <= "L")
        sticker.label = `C${sticker.label}`;
    await page.addInitScript(
      (data) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false }),
        ),
      {
        scheme,
        pairs: {},
        attempts: [],
        solves: [],
        onboarded: true,
      },
    );
    await page.goto("/pairs");
    await expect(page.getByRole("grid")).toBeVisible();
    const nav = page.getByRole("button", {
      name: "Letter Pairs navigation",
      exact: true,
    });
    if (await nav.isVisible()) await nav.click();
    await page.getByRole("button", { name: /^P, \d+ of \d+ filled$/ }).click();
    const drawer = page.getByRole("dialog", {
      name: "Letter Pairs navigation",
      exact: true,
    });
    await expect(drawer).toHaveCount(0);
    const grid = page.getByRole("grid", {
      name: "Pairs starting P",
      exact: true,
    });
    const columns = grid.getByRole("rowgroup");
    await expect(columns).toHaveCount(2);
    const cells = grid.getByRole("gridcell");
    const total = await cells.count();
    expect(total).toBeGreaterThan(30);
    const split = Math.ceil(total / 2);
    await expect(columns.nth(0).getByRole("row")).toHaveCount(split);
    await expect(columns.nth(1).getByRole("row")).toHaveCount(
      Math.floor(total / 2),
    );
    const boxes = await columns.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y };
      }),
    );
    if (width >= 768) {
      expect(boxes[0].y).toBe(boxes[1].y);
      expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
      await cells.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(cells.nth(split)).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(cells.first()).toBeFocused();
    } else {
      expect(boxes[0].x).toBe(boxes[1].x);
      expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    }
    await page.screenshot({
      path: `test-results/pairs-balanced-${width}.png`,
      fullPage: true,
    });
  });

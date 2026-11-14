import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { writePairEntries } from "../src/workspace/utils/pairPersistence";
import type { AppData } from "../src/data/model";

test.beforeEach(async ({ page }) => {
  const data = writePairEntries(
    {
      scheme: createSpeffzScheme(),
      pairs: {},
      attempts: [],
      solves: [],
      onboarded: true,
    } as AppData,
    { "A|B": { shared: ["Apple"], edges: ["Arrow"], corners: ["Castle"] } },
  );
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      );
  }, data);
});
const saved = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
async function section(page: Page, name: string) {
  const mobile = page.getByRole("button", {
    name: "Settings sections",
    exact: true,
  });
  if (await mobile.isVisible()) await mobile.click();
  await page
    .getByRole("navigation", { name: "Settings sections", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Settings sections", exact: true }),
  ).toHaveCount(0);
  // Wait for the existing section-scroll animation before measuring or capturing.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const root = document.querySelector(
          "[data-settings-content]",
        )!.parentElement!;
        let previous = root.scrollTop,
          stable = 0;
        const start = performance.now();
        const sample = () => {
          stable =
            performance.now() - start > 200 &&
            Math.abs(root.scrollTop - previous) < 0.5
              ? stable + 1
              : 0;
          previous = root.scrollTop;
          if (stable >= 6 || performance.now() - start > 1500) resolve();
          else requestAnimationFrame(sample);
        };
        sample();
      }),
  );
}

test("preferences persist immediately, radios support arrows and cube edits autosave", async ({
  page,
}) => {
  await page.goto("/settings");
  for (const label of [
    "Show live timer",
    "Multiphase timing",
    "Automatically swap M2 targets",
  ]) {
    const toggle = page.getByRole("switch", { name: label, exact: true });
    const old = await toggle.getAttribute("aria-checked");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute(
      "aria-checked",
      old === "true" ? "false" : "true",
    );
  }
  const order = page.getByRole("radiogroup", {
    name: "Memo order",
    exact: true,
  });
  await order
    .getByRole("radio", { name: "Corners first", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    order.getByRole("radio", { name: "Edges first", exact: true }),
  ).toBeFocused();
  await expect(order.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Unsaved changes", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Show live timer", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  const data = await saved(page);
  expect(data).toMatchObject({
    showLiveTimer: false,
    multiphaseTiming: false,
    m2SecondTargetSwap: true,
    memoOrder: "edges-first",
  });
  await page.getByRole("radio", { name: "Lettering", exact: true }).click();
  await page
    .getByRole("group", { name: "Your cube", exact: true })
    .locator('[data-sticker-id="U0"]')
    .click();
  const token = page.getByRole("textbox", { name: "Letter", exact: true });
  await token.fill("CH");
  expect((await saved(page)).scheme).toEqual(data.scheme);
  await expect(
    page.getByRole("region", { name: "Unsaved changes", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("blindsolve-settings-draft-v1:guest"),
        ),
      { timeout: 10000 },
    )
    .toBeNull();
  await page.reload();
  expect(
    Object.values((await saved(page)).scheme.stickers).some(
      (s) => s.label === "CH",
    ),
  ).toBe(true);
});

test("reset and destructive actions retain shared confirmations, cancellation and persistence", async ({
  page,
}) => {
  await page.goto("/settings");
  const before = await saved(page);
  await page.getByRole("radio", { name: "Lettering", exact: true }).click();
  await page
    .getByRole("group", { name: "Your cube", exact: true })
    .locator('[data-sticker-id="U0"]')
    .click();
  await page.getByRole("textbox", { name: "Letter", exact: true }).fill("CH");
  await page.getByRole("button", { name: "Use Speffz", exact: true }).click();
  const reset = page.getByRole("alertdialog", {
    name: "Replace your lettering with Speffz?",
    exact: true,
  });
  await expect(
    reset.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(reset).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Letter", exact: true }),
  ).toHaveValue("CH");
  await page.getByRole("button", { name: "Use Speffz", exact: true }).click();
  await reset.getByRole("button", { name: "Use Speffz", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Letter", exact: true }),
  ).toHaveValue("A");
  await section(page, "Data");
  await page.getByRole("button", { name: "Clear all…", exact: true }).click();
  const clear = page.getByRole("alertdialog", {
    name: /Clear all .*saved word/,
  });
  await expect(clear).toContainText(
    "Every Default word and Edge or Corner override",
  );
  await page.keyboard.press("Escape");
  await expect(clear).toHaveCount(0);
  expect((await saved(page)).pairs).toEqual(before.pairs);
  await page.getByRole("button", { name: "Clear all…", exact: true }).click();
  await clear.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(clear).toHaveCount(0);
  await page.reload();
  expect((await saved(page)).pairs).toEqual({});
  await section(page, "Data");
  await expect(
    page.getByRole("button", { name: "Clear all…", exact: true }),
  ).toBeDisabled();
});

test("Settings owns shortcuts after visiting each practice route and saves completed edits on navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (const label of ["Training", "Letter Pairs", "Flashcards", "Settings"])
    await page.getByRole("link", { name: label, exact: true }).click();
  await page
    .getByRole("heading", { name: "Cube & lettering", exact: true })
    .click();
  await page.keyboard.press("Space");
  for (const key of ["1", "2", "3", "A", "B", "Delete"])
    await page.keyboard.press(key);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await saved(page)).attempts).toHaveLength(0);
  expect((await saved(page)).solves).toHaveLength(0);
  await page.getByRole("radio", { name: "Lettering", exact: true }).click();
  await page
    .getByRole("group", { name: "Your cube", exact: true })
    .locator('[data-sticker-id="U0"]')
    .click();
  await page.getByRole("textbox", { name: "Letter", exact: true }).fill("CH");
  await page.getByRole("link", { name: "Flashcards", exact: true }).click();
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await expect(
    page.getByRole("link", { name: "Flashcards", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(
    Object.values((await saved(page)).scheme.stickers).some(
      (s) => s.label === "CH",
    ),
  ).toBe(true);
  for (const name of ["Timer", "Training", "Letter Pairs", "Flashcards"]) {
    await page.getByRole("link", { name, exact: true }).click();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Cube & lettering", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-subnav-column]")).toHaveCount(1);
  }
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 568],
])
  test(`Settings retains its structure and fits all controls at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/settings");
    await expect(page.locator("[data-settings-content] h2")).toHaveText([
      "Cube & lettering",
      "Methods",
      "Timer",
      "Account & sync",
      "Data",
      "Support",
    ]);
    await page.screenshot({ path: test.info().outputPath("cube.png") });
    await page.getByRole("radio", { name: "Cube view", exact: true }).click();
    const colors = page.getByRole("radiogroup", {
      name: "Top face",
      exact: true,
    });
    for (const color of await colors.getByRole("radio").all()) {
      const r = (await color.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
    }
    await section(page, "Timer");
    await expect(
      page.getByRole("switch", { name: "Show live timer", exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath("preferences.png") });
    await section(page, "Data");
    const clear = page.getByRole("button", { name: "Clear all…", exact: true });
    await clear.scrollIntoViewIfNeeded();
    const r = (await clear.boundingBox())!;
    expect(r.x + r.width).toBeLessThanOrEqual(width);
    await clear.click();
    const dialog = (await page.getByRole("alertdialog").boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: test.info().outputPath("confirmation.png") });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("uniform viewport scaling preserves Settings geometry and real narrowing remains responsive", async ({
  page,
}) => {
  await page.goto("/settings");
  const read = () =>
    page.evaluate(() => {
      const unit = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return [
        "[data-settings-content]",
        '[aria-label="Your cube"]',
        "[data-subnav-column]",
      ].map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return [r.x / unit, r.y / unit, r.width / unit, r.height / unit];
      });
    });
  const normal = await read();
  for (const [width, height] of [
    [720, 450],
    [2880, 1800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const scaled = await read();
    // The long document's auto height accumulates browser line-box rounding;
    // column anchors and the fixed cube must keep their reference geometry.
    for (let i = 0; i < normal.length; i++)
      for (let j = 0; j < 4; j++)
        expect(
          Math.abs(normal[i][j] - scaled[i][j]),
          JSON.stringify({
            width,
            height,
            i,
            j,
            normal: normal[i],
            scaled: scaled[i],
          }),
        ).toBeLessThan(i === 0 && j === 3 ? 1 : 0.15);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-subnav-column]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Settings sections", exact: true }),
  ).toBeVisible();
});

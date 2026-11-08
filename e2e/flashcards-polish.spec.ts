import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import {
  writePairEntries,
  pairsFromStore,
} from "../src/magic/utils/pairPersistence";
import type { AppData } from "../src/lib/repository";

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
    Math.random = () => 0.72;
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      );
  }, data);
});
const stored = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
const input = (page: Page) =>
  page.getByRole("textbox", { name: "Default word", exact: true });
const save = (page: Page) =>
  page.getByRole("button", { name: "Save", exact: true });
const cancel = (page: Page) =>
  page.getByRole("button", { name: "Cancel", exact: true });
const outer = (page: Page) => page.locator("[data-flashcard-interaction]");
async function open(page: Page) {
  await page.goto("/flashcards");
  await page.getByRole("button", { name: /^Reveal/ }).waitFor();
  await page.waitForTimeout(240);
}
async function edit(page: Page) {
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /^Remembered/ })).toBeVisible();
  await page.keyboard.press("3");
  await expect(input(page)).toBeFocused();
}

test("reveal crossfades controls within fixed bounds without moving workspace, panel or cube", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  const samples = page.evaluate(
    () =>
      new Promise<any[]>((resolve) => {
        const frames: any[] = [],
          start = performance.now();
        const sample = () => {
          const bounds = [
            "[data-flashcard-controls]",
            "[data-flashcard-interaction]",
            '[aria-label="Flashcard"]',
            "[data-workspace-reference]",
            "aside [data-pair-cube]",
          ].map((selector) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          const review = document.querySelector<HTMLElement>(
            '[data-flashcard-state="review"]',
          );
          const exiting = document.querySelector<HTMLElement>(
            '[data-flashcard-state="reveal"]',
          );
          frames.push({
            bounds,
            opacity: review ? Number(getComputedStyle(review).opacity) : null,
            exitingInert: exiting?.inert,
          });
          if (performance.now() - start < 450) requestAnimationFrame(sample);
          else resolve(frames);
        };
        sample();
      }),
  );
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  const frames = await samples;
  for (const f of frames) expect(f.bounds).toEqual(frames[0].bounds);
  expect(frames.some((f) => f.opacity > 0 && f.opacity < 1)).toBe(true);
  expect(frames.some((f) => f.exitingInert === true)).toBe(true);
  expect((await stored(page)).attempts).toHaveLength(0);
  await page.keyboard.press("1");
  expect((await stored(page)).attempts).toHaveLength(1);
});

test("edit loads actual Default, cancels safely, saves Default only and immediately restores shortcuts", async ({
  page,
}) => {
  await open(page);
  const bounds = await outer(page).boundingBox();
  const cube = await page.locator("aside [data-pair-cube]").boundingBox();
  await edit(page);
  await expect(input(page)).toHaveValue("Apple");
  await expect(page.locator('[data-flashcard-state="editing"]')).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: test.info().outputPath("desktop-editor.png") });
  await expect(
    page.getByText("Used for both Edges and Corners", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Save as default", { exact: true })).toHaveCount(
    0,
  );
  expect((await save(page).boundingBox())!.height).toEqual(
    (await cancel(page).boundingBox())!.height,
  );
  expect(
    await save(page).evaluate((el) => el.classList.contains("bg-ink")),
  ).toBe(true);
  expect(
    await cancel(page).evaluate((el) => el.classList.contains("h-9")),
  ).toBe(true);
  await input(page).fill("");
  await input(page).pressSequentially("123 word");
  expect((await stored(page)).attempts).toHaveLength(0);
  await cancel(page).click();
  await page.keyboard.press("3");
  await expect(input(page)).toHaveValue("Apple");
  await input(page).fill("Anchor");
  await save(page).click();
  expect(pairsFromStore(await stored(page))["A|B"]).toEqual({
    shared: ["Anchor"],
    edges: ["Arrow"],
    corners: ["Castle"],
  });
  expect(await outer(page).boundingBox()).toEqual(bounds);
  expect(await page.locator("aside [data-pair-cube]").boundingBox()).toEqual(
    cube,
  );
  await page.keyboard.press("1");
  expect((await stored(page)).attempts).toHaveLength(1);
});

test("shared suggestions float without layout changes and save only Default", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  const bounds = await outer(page).boundingBox();
  const panel = await page.locator("[data-workspace-reference]").boundingBox();
  const button = await save(page).boundingBox();
  const suggest = page.getByRole("button", {
    name: "Suggest words for default word",
    exact: true,
  });
  await suggest.click();
  const popup = page.getByRole("dialog", {
    name: "Suggestions for AB",
    exact: true,
  });
  await expect(popup).toBeVisible();
  await page.keyboard.press("3");
  expect((await stored(page)).attempts).toHaveLength(0);
  expect(await outer(page).boundingBox()).toEqual(bounds);
  expect(
    await page.locator("[data-workspace-reference]").boundingBox(),
  ).toEqual(panel);
  expect(await save(page).boundingBox()).toEqual(button);
  const choice = popup.getByRole("list").getByRole("button").first();
  const word = (await choice.textContent())!.trim();
  await choice.click();
  await expect(input(page)).toHaveValue(word);
  await expect(popup).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await save(page).click();
  expect(pairsFromStore(await stored(page))["A|B"]).toEqual({
    shared: [word],
    edges: ["Arrow"],
    corners: ["Castle"],
  });
  await page.screenshot({ path: test.info().outputPath("revealed.png") });
});

for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test(`compact editor stays within reserved geometry at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const bounds = await outer(page).boundingBox();
    await edit(page);
    await page.waitForTimeout(200);
    expect(await outer(page).boundingBox()).toEqual(bounds);
    for (const control of [input(page), save(page), cancel(page)]) {
      const r = (await control.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: test.info().outputPath("editor.png") });
  });

test("keyboard editor exit leaves no frame ring and history clearly labels outcomes", async ({
  page,
}) => {
  await open(page);
  await edit(page);
  const frame = page.getByRole("region", { name: "Flashcard", exact: true });
  await input(page).press("Escape");
  await expect(frame).toBeFocused();
  await expect(frame).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  await page.keyboard.press("3");
  await expect(input(page)).toHaveValue("Apple");
  await input(page).fill("Anchor");
  await input(page).press("Enter");
  await expect(frame).toBeFocused();
  await expect(frame).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
  await page.keyboard.press("1");
  const rows = page.locator("[data-flashcard-row]");
  await expect(rows.first()).toContainText("Correct");
  await page.keyboard.press("Space");
  await page.waitForTimeout(240);
  await page.keyboard.press("2");
  await expect(rows.first()).toContainText("Incorrect");
  await expect(rows.first()).toHaveCSS("cursor", "default");
  const before = await stored(page);
  await rows.first().click();
  expect((await stored(page)).attempts).toEqual(before.attempts);
  await page.locator('[aria-label="Recent cards"] button').first().click();
  expect((await stored(page)).attempts).toHaveLength(1);
  await page.screenshot({
    path: test.info().outputPath("history-outcomes.png"),
  });
});

test("reduced motion uses instant state changes with identical outer geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const bounds = await outer(page).boundingBox();
  await edit(page);
  await input(page).press("Escape");
  await expect(page.locator('[data-flashcard-state="editing"]')).toHaveCount(0);
  expect(await outer(page).boundingBox()).toEqual(bounds);
  await page.keyboard.press("2");
  expect((await stored(page)).attempts).toHaveLength(1);
});

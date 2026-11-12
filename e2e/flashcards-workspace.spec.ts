import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { writePairEntries } from "../src/workspace/utils/pairPersistence";
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
    {
      "A|B": { shared: ["Apple"], edges: ["Arrow"], corners: ["Castle"] },
      "T|D": { shared: ["Toad"] },
      "O|R": { shared: ["Oar"] },
      "W|X": { shared: ["Wax"] },
    },
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
const attempts = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts,
  );
const card = (page: Page) =>
  page.getByRole("region", { name: "Flashcard", exact: true });
async function reveal(page: Page) {
  await page.getByRole("button", { name: /^Reveal/ }).waitFor();
  await page.waitForTimeout(240);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /^Remembered/ })).toBeVisible();
}

test("stable reveal, shared buttons, 1/2/3, repeat/typing/modal guards and passive history", async ({
  page,
}) => {
  await page.goto("/flashcards");
  await expect(card(page)).toBeVisible();
  await expect(page.locator("main h1, main h2")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/#\s*1|\d+ cards/);
  const box = await card(page).boundingBox();
  await reveal(page);
  expect(await card(page).boundingBox()).toEqual(box);
  await page.keyboard.press("Space");
  expect(await attempts(page)).toHaveLength(0);
  for (const kind of ["input", "textarea", "contenteditable"]) {
    await page.evaluate((kind) => {
      const el = document.createElement(
        kind === "contenteditable" ? "div" : kind,
      );
      el.id = "typing-guard-fixture";
      if (kind === "contenteditable") el.contentEditable = "true";
      document.querySelector("main")!.append(el);
      el.focus();
    }, kind);
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await page.keyboard.press("3");
    await page.keyboard.press("Space");
    expect(await attempts(page)).toHaveLength(0);
    await page.evaluate(() =>
      document.getElementById("typing-guard-fixture")!.remove(),
    );
    await expect(
      page.getByRole("button", { name: /^Remembered/ }),
    ).toBeVisible();
  }
  await page.keyboard.down("1");
  await expect(page.locator("[data-flashcard-row]")).toHaveCount(1);
  await page.keyboard.down("1");
  await page.keyboard.up("1");
  expect(await attempts(page)).toHaveLength(1);
  await reveal(page);
  await page.keyboard.press("2");
  expect((await attempts(page))[0].correct).toBe(false);
  await reveal(page);
  await page.keyboard.press("3");
  const input = page.getByRole("textbox", { name: "Default word", exact: true });
  await expect(input).toBeFocused();
  await input.fill("123 Word");
  await input.press("Space");
  expect(await attempts(page)).toHaveLength(2);
  await input.press("Escape");
  await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
  await page.keyboard.press("1");
  expect(await attempts(page)).toHaveLength(2);
  await page.keyboard.press("Escape");
  const row = page.locator("[data-flashcard-row]").first();
  await expect(row).toHaveCSS("cursor", "default");
  await row.hover();
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await row.click();
  await expect(page.getByRole("button", { name: /^Remembered/ })).toBeVisible();
  await expect(
    page.locator("[data-flashcard-row] svg, [data-flashcard-row] button"),
  ).toHaveCount(0);
  await page.locator('[aria-label="Recent cards"] button').first().click();
  expect(await attempts(page)).toHaveLength(1);
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await page.getByRole("link", { name: "Flashcards", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Reveal/ })).toBeVisible();
});

test("same persistent panel and cube geometry across Timer, Execution, Guided and Flashcards", async ({
  page,
}) => {
  await page.goto("/");
  const panel = page.locator("[data-workspace-reference]");
  await expect(panel).toBeVisible();
  const original = await panel.elementHandle();
  const box = await panel.boundingBox();
  const cubeBox = await page
    .locator("[data-timer-cube-viewport]")
    .boundingBox();
  const timerCube = await page
    .getByRole("group", { name: "Scrambled cube", exact: true })
    .boundingBox();
  for (const label of [
    "Training",
    "Timer",
    "Flashcards",
    "Training",
    "Flashcards",
    "Timer",
    "Flashcards",
  ]) {
    const samples = page.evaluate(
      () =>
        new Promise<{ x: number; width: number }[]>((resolve) => {
          const values: { x: number; width: number }[] = [];
          const start = performance.now();
          const sample = () => {
            const r = document
              .querySelector("[data-workspace-reference]")!
              .getBoundingClientRect();
            values.push({ x: r.x, width: r.width });
            if (performance.now() - start < 500) requestAnimationFrame(sample);
            else resolve(values);
          };
          sample();
        }),
    );
    await page.getByRole("link", { name: label, exact: true }).click();
    for (const r of await samples) {
      expect(r.x).toBeCloseTo(box!.x, 2);
      expect(r.width).toBeCloseTo(box!.width, 2);
    }
    expect(
      await original!.evaluate(
        (el) => el === document.querySelector("[data-workspace-reference]"),
      ),
    ).toBe(true);
    expect(
      await page.locator("[data-timer-cube-viewport]").boundingBox(),
    ).toEqual(cubeBox);
    if (label === "Training") {
      await page
        .getByRole("radio", { name: "Guided Solve", exact: true })
        .click();
      expect(await panel.boundingBox()).toEqual(box);
    }
  }
  const wrapper = page.locator("aside [data-pair-cube]");
  const main = wrapper.locator('[role="group"]').first();
  expect(await main.boundingBox()).toEqual(await wrapper.boundingBox());
  const r = (await wrapper.boundingBox())!;
  expect(r.x + r.width / 2).toBeCloseTo(timerCube!.x + timerCube!.width / 2, 1);
  await page.screenshot({ path: test.info().outputPath("desktop.png") });
  await reveal(page);
  await page.screenshot({
    path: test.info().outputPath("desktop-revealed.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("main [data-pair-cube]")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remembered/ })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(panel).toBeVisible();
  expect(await panel.boundingBox()).toEqual(box);
});

test("Flashcards read both explicit overrides while leaving Default untouched", async ({
  page,
}) => {
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
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      ),
    data,
  );
  await page.goto("/flashcards");
  await reveal(page);
  await expect(card(page).getByText("Castle", { exact: true })).toBeVisible();
  await page.keyboard.press("1");
  await reveal(page);
  await expect(card(page).getByText("Arrow", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.pairs,
    ),
  ).toEqual(data.pairs);
});

test("far-side cube shares the root-unit shell and stays inside it", async ({
  page,
}) => {
  const data = writePairEntries(
    {
      scheme: createSpeffzScheme(),
      pairs: {},
      attempts: [],
      solves: [],
      onboarded: true,
    } as AppData,
    { "A|U": { shared: ["Australia"] } },
  );
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      ),
    data,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/flashcards");
  const shell = page.locator("aside [data-pair-cube]");
  const inset = shell.locator("figure [role=group]");
  await expect(inset).toBeVisible();
  await page.waitForTimeout(220);
  const outer = (await shell.boundingBox())!,
    inner = (await inset.boundingBox())!;
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.width).toBeCloseTo(outer.x + outer.width, 1);
  expect(inner.y + inner.height).toBeCloseTo(outer.y + outer.height, 1);
  await page.screenshot({ path: test.info().outputPath("far-side.png") });
});

for (const [width, height] of [
  [390, 844],
  [320, 568],
  [1280, 720],
]) {
  test(`Flashcards responsive cube and controls ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/flashcards");
    await reveal(page);
    for (const label of [/^Remembered/, /^Forgot/, /^Edit/]) {
      const button = page.getByRole("button", { name: label });
      await expect(button).toBeVisible();
      const r = (await button.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
    }
    const parent =
      width < 768
        ? page.locator("main [data-pair-cube]")
        : page.locator("aside [data-pair-cube]");
    await expect(parent).toBeVisible();
    expect(await parent.boundingBox()).toEqual(
      await parent.locator('[role="group"]').first().boundingBox(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${width}.png`) });
  });
}

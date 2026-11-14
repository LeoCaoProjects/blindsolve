import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { mkdir } from "node:fs/promises";
const output = "test-results/guided-workspace";
test.beforeEach(async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            attempts: [],
            solves: [],
            defaultCubeView: { top: "white", front: "green" },
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});
async function selectGuided(page: Page) {
  await page.goto("/training");
  const chooser = page.getByRole("button", {
    name: "Training controls",
    exact: true,
  });
  if (await chooser.isVisible()) await chooser.click();
  await page.getByRole("radio", { name: "Guided Solve", exact: true }).click();
  const sheet = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await sheet.isVisible())
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
}
async function touchHold(page: Page) {
  const clock = await page
    .getByRole("timer", { name: "Hold Space to start" })
    .boundingBox();
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: clock!.x + 20, y: clock!.y + 20 }],
  });
  await page.waitForTimeout(320);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
async function flow(page: Page, width: number, dnf = false) {
  await selectGuided(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main .max-h-full[style]")).toHaveCSS(
    "transform",
    "none",
  );
  const idleClock = await page
    .getByRole("timer", { name: "Hold Space to start" })
    .boundingBox();
  const identity = await page
    .locator("[data-training-challenge-id]")
    .getAttribute("data-training-challenge-id");
  const touch = await page.evaluate(
    () => !matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  if (touch) await touchHold(page);
  else {
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
  }
  await expect(
    page.getByRole("timer", { name: "Memorisation", exact: true }),
  ).toBeVisible();
  const sequence = await page
    .locator("main ol[aria-label]")
    .evaluateAll((lists: Element[]) =>
      lists.map((list) => list.getAttribute("aria-label")!),
    );
  expect(sequence.length).toBeGreaterThan(0);

  const advance = page.getByRole("button", { name: /Start execution/ });
  if (touch) await expect(advance).toBeInViewport();
  else await expect(advance).not.toBeVisible();
  await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
    "transform",
    "none",
  );
  await page.screenshot({ path: `${output}/memo-${width}.png` });
  if (touch) await advance.click();
  else await page.keyboard.press("Space");
  await expect(page.getByText("Executing", { exact: true })).toBeVisible();
  await expect(page.locator("main ol").first()).not.toBeVisible();
  expect(
    await page.getByRole("timer", { name: "Execution" }).boundingBox(),
  ).toEqual(idleClock);
  if (touch)
    await expect(page.getByRole("button", { name: /^Stop/ })).toBeInViewport();
  else
    await expect(page.getByRole("button", { name: /^Stop/ })).not.toBeVisible();
  expect(
    await page
      .locator("[data-training-challenge-id]")
      .getAttribute("data-training-challenge-id"),
  ).toBe(identity);
  await page.screenshot({ path: `${output}/execution-${width}.png` });
  if (touch) await page.getByRole("button", { name: /^Stop/ }).click();
  else await page.keyboard.press("Space");
  const dialog = page.getByRole("dialog", {
    name: "Guided Solve result",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Solved", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("main").getByText("Did you solve the cube?", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(0);
  await expect(
    dialog.getByRole("radio", { name: "OK", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("radio", { name: "+2", exact: true }),
  ).toHaveCount(0);
  if (dnf)
    await dialog.getByRole("radio", { name: "DNF", exact: true }).click();
  await expect(
    dialog.getByRole("radio", { name: dnf ? "DNF" : "OK", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  const normalise = (values: string[]) =>
    values.join("").replaceAll("cycle break at ", "").replaceAll(/\s/g, "");
  const shown = await dialog
    .locator(".mt-8.border-t.pt-7 ol > li > span:first-child")
    .allTextContents();
  expect(normalise(shown)).toBe(normalise(sequence));
  await expect(dialog.getByRole("definition")).toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "Phase times" })).toHaveCount(
    0,
  );
  await expect(dialog.getByText("memo", { exact: true })).toBeVisible();
  await expect(dialog.getByText("exec", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Next|Continue|Done/ }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^Close/ })).toBeInViewport();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `${output}/result-${dnf ? "dnf-" : ""}${width}.png`,
  });
  await dialog.getByRole("button", { name: /^Close/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts[0],
  );
  expect(saved.trainingMode).toBe("guided");
  expect(saved.correct).toBe(!dnf);
  expect(
    Math.abs(saved.memoMs + saved.executionMs - saved.durationMs),
  ).toBeLessThanOrEqual(1);
  expect(Object.keys(saved).sort()).toEqual(
    [
      "id",
      "kind",
      "correct",
      "trainingMode",
      "durationMs",
      "memoMs",
      "executionMs",
      "targets",
      "pairs",
      "scope",
      "scramble",
      "rawTargets",
      "executionTargets",
      "tokenSnapshot",
      "memoOrder",
      "createdAt",
    ].sort(),
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(1);

  return saved;
}
test("Guided phases, completion and passive history use the shared UI with unchanged saved data", async ({
  page,
}) => {
  await flow(page, 1440);
  const history = page.getByRole("list", { name: "Attempts", exact: true });
  const row = history.locator("[data-attempt-row]");
  await expect(row).toHaveCSS("cursor", "default");
  await expect(row.locator("svg,button")).toHaveCount(0);
  const bg = await row.evaluate((e) => getComputedStyle(e).backgroundColor);
  await row.hover();
  await expect(row).not.toHaveCSS("background-color", bg);
  await row.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const remove = history.getByRole("button", { name: /Delete attempt/ });
  await expect(remove).toHaveCSS("cursor", "pointer");
  await remove.click();
  await expect(row).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(0);
});
for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test(`Guided flow and result fit ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width, height },
    });
    const page = await context.newPage();
    await page.addInitScript(
      (scheme) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              onboarded: true,
              pairs: {},
              attempts: [],
              solves: [],
            },
            revision: 0,
            dirty: false,
          }),
        ),
      createSpeffzScheme(),
    );
    await flow(page, width);
    await page
      .getByRole("button", { name: "Training controls", exact: true })
      .click();
    await page
      .getByRole("radio", { name: "Execution Sprint", exact: true })
      .click();
    const sheet = page.getByRole("dialog", {
      name: "Training controls",
      exact: true,
    });
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await touchHold(page);
    await expect(page.locator("[data-training-targets]")).toBeVisible();
    await page.getByRole("button", { name: /^Stop/ }).tap();
    const result = page.getByRole("dialog", {
      name: "Execution Sprint result",
      exact: true,
    });
    await expect(result).toBeVisible();
    await result.getByRole("button", { name: /^Close/ }).tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });

test("Guided DNF is reported inside the Timer popup and saved once on Close", async ({
  page,
}) => {
  await flow(page, 1440, true);
});

test("Guided memo uses Execution active timer geometry exactly", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const start = async () => {
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
  };
  const geometry = () =>
    page.evaluate(() => {
      const r = (s: string) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
      };
      const style = getComputedStyle(
        document.querySelector('main [role="timer"]')!,
      );
      return {
        timer: r('main [role="timer"]'),
        cube: r("[data-timer-cube-viewport]"),
        panel: r("[data-workspace-reference]"),
        utility: r('button[aria-label="Sticker letters"]'),
        font: [
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.lineHeight,
          style.color,
        ],
      };
    });
  await start();
  await expect(page.locator("[data-training-timed-stage]")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Stop/ })).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
    "transform",
    "none",
  );
  const execution = await geometry();
  await page.screenshot({ path: `${output}/execution-reference.png` });
  await page.keyboard.press("Space");
  await page
    .getByRole("dialog", { name: "Execution Sprint result" })
    .getByRole("button", { name: /^Close/ })
    .click();
  await page.getByRole("radio", { name: "Guided Solve", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await start();
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
    "transform",
    "none",
  );
  const guided = await geometry();
  expect(guided.font).toEqual(execution.font);
  for (const key of ["timer", "cube", "panel", "utility"] as const)
    guided[key].forEach((value: number, i: number) =>
      expect(Math.abs(value - execution[key][i])).toBeLessThan(0.15),
    );
  await page.screenshot({ path: `${output}/memo-reference.png` });
});

test("Space owns focused navigation, fresh mode switches, and cancels a stale hold", async ({
  page,
}) => {
  await page.goto("/training");
  const ready = () =>
    expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
  const hold = async () => {
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
  };
  await ready();
  // Switch during an armed hold: releasing the old key must not start either mode.
  await page
    .getByRole("radio", { name: "Execution Sprint", exact: true })
    .click();
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.getByRole("radio", { name: "Guided Solve", exact: true }).click();
  await page.keyboard.up("Space");
  await ready();
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "Execution Sprint", exact: true })
    .click();
  await ready();
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();

  for (const mode of [
    "Guided Solve",
    "Execution Sprint",
    "Guided Solve",
    "Execution Sprint",
  ]) {
    const tab = page.getByRole("radio", { name: mode, exact: true });
    await tab.click();
    await ready();
    await expect(tab).toBeFocused();
    await hold();
    await expect(page.locator("[data-training-timed-stage]")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Stop|Start execution/ }),
    ).not.toBeVisible();
    await page.keyboard.press("Space");
    if (mode === "Guided Solve") {
      await expect(page.getByText("Executing", { exact: true })).toBeVisible();
      await page.keyboard.press("Space");
    }
    const result = page.getByRole("dialog", {
      name: `${mode} result`,
      exact: true,
    });
    await expect(result).toBeVisible();
    await result.getByRole("button", { name: /^Close/ }).click();
    await ready();
  }
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(4);
});

test("native editable controls retain Space without starting or progressing Training", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  for (const mode of ["Execution Sprint", "Guided Solve"]) {
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    // Native controls mounted in the live workspace exercise the real window listeners.
    for (const tag of ["input", "textarea", "select", "div"]) {
      await page.evaluate((tag) => {
        const element = document.createElement(tag);
        element.id = "space-edit-fixture";
        if (tag === "div") element.contentEditable = "true";
        document.querySelector("main")!.append(element);
        element.focus();
      }, tag);
      await page.keyboard.down("Space");
      await page.waitForTimeout(320);
      await page.keyboard.up("Space");
      await expect(
        page.getByRole("timer", { name: "Hold Space to start" }),
      ).toBeVisible();
      if (tag === "input" || tag === "textarea")
        await expect(page.locator("#space-edit-fixture")).toHaveValue(" ");
      if (tag === "div")
        expect(await page.locator("#space-edit-fixture").textContent()).toBe(
          "\u00a0",
        );
      await page
        .locator("#space-edit-fixture")
        .evaluate((element) => element.remove());
    }
  }
});

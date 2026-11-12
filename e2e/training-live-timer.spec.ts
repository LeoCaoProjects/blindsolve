import { test, expect, type Page } from "@playwright/test";
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
            attempts: [],
            solves: [],
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
}
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
async function choose(page: Page, mode: string) {
  const trigger = page.getByRole("button", {
    name: "Training controls",
    exact: true,
  });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole("radio", { name: mode, exact: true }).click();
  const sheet = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await sheet.isVisible()) {
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
  await ready(page);
}
async function rects(page: Page) {
  return page.evaluate(() =>
    [
      "[data-workspace-reference]",
      "[data-timer-cube-viewport]",
      "[data-subnav-column]",
      'button[aria-label="Sticker letters"]',
    ].map((s) => {
      const b = document.querySelector(s)?.getBoundingClientRect();
      return b ? [b.x, b.y, b.width, b.height] : null;
    }),
  );
}
for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 568],
])
  test(`Guided execution reuses exact idle geometry at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/training");
    await choose(page, "Guided Solve");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("main .max-h-full[style]")).toHaveCSS(
      "transform",
      "none",
    );
    const idle = page.getByRole("timer", { name: "Hold Space to start" });
    const box = await idle.boundingBox();
    const font = await idle.evaluate((el) => getComputedStyle(el).fontSize);
    await hold(page);
    const memo = page.getByRole("timer", { name: "Memorisation" });
    await expect(memo).toBeVisible();
    expect(
      parseFloat(await memo.evaluate((el) => getComputedStyle(el).fontSize)),
    ).toBeLessThan(parseFloat(font));
    await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
      "transform",
      "none",
    );
    const before = await rects(page);
    if (width === 1440) {
      const placement = await page
        .locator("[data-training-timed-stage]")
        .evaluate((el) => {
          const r = el.getBoundingClientRect(),
            target = el
              .querySelector("[data-training-targets]")!
              .getBoundingClientRect();
          return {
            height: r.height,
            row: parseFloat(getComputedStyle(el).gridTemplateRows),
            target: target.y,
          };
        });
      expect(placement.row / placement.height).toBeCloseTo(0.27, 2);
      console.log(
        "Targets raised",
        placement.height * 0.1,
        "px from previous 37% track",
      );
    }
    await page.keyboard.press("Space");
    const exec = page.getByRole("timer", { name: "Execution" });
    await expect(exec).toBeVisible();
    expect(await exec.boundingBox()).toEqual(box);
    expect(await exec.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      font,
    );
    expect(await rects(page)).toEqual(before);
    await page.screenshot({
      path: `test-results/guided-idle-anchor-${width}.png`,
    });
  });
test("Execution and Guided keep their mounted cube visible throughout timing like Timer", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await hold(page);
  await expect(page.locator("[data-workspace-reference]")).toHaveCSS(
    "opacity",
    "0.1",
  );
  await page.getByRole("link", { name: "Training", exact: true }).click();
  for (const mode of ["Execution Sprint", "Guided Solve"]) {
    await choose(page, mode);
    const cube = page.locator("[data-timer-cube-viewport] [data-cube-view]");
    await expect(cube).toBeVisible();
    const node = await cube.elementHandle();
    const before = await rects(page);
    await page.keyboard.down("Space");
    await expect(
      page.getByRole("timer", { name: "Ready, release to start" }),
    ).toBeVisible();
    await expect(cube).toBeVisible();
    expect(await rects(page)).toEqual(before);
    await page.keyboard.up("Space");
    await expect(cube).toBeVisible();
    await expect(page.locator("[data-workspace-reference]")).toHaveCSS(
      "opacity",
      "0.1",
    );
    expect(await rects(page)).toEqual(before);
    if (mode === "Guided Solve") {
      await page.keyboard.press("Space");
      await expect(
        page.getByRole("timer", { name: "Execution" }),
      ).toBeVisible();
      await expect(cube).toBeVisible();
      expect(await rects(page)).toEqual(before);
    }
    expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
    await page.screenshot({
      path: `test-results/active-cube-${mode.replaceAll(" ", "-")}.png`,
    });
    await page.keyboard.press("Space");
    const popup = page.getByRole("dialog", {
      name: `${mode} result`,
      exact: true,
    });
    await expect(popup).toBeVisible();
    await expect(cube).toBeVisible();
    await page.keyboard.press("Space");
    await expect(popup).toHaveCount(0);
  }
});
test("Training shares Show live timer changes without reload, hides running values only", async ({
  page,
}) => {
  await page.goto("/settings");
  const toggle = page.getByRole("switch", {
    name: "Show live timer",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  for (const enabled of [false, true]) {
    for (const mode of ["Execution Sprint", "Guided Solve"]) {
      await choose(page, mode);
      await hold(page);
      const clock =
        mode === "Guided Solve"
          ? page.getByRole("timer", { name: "Memorisation" })
          : page.locator("main [role=timer]");
      if (enabled) await expect(clock).toHaveText(/\d+\.\d{2}/);
      else await expect(clock).toHaveText("Solve");
      if (mode === "Guided Solve") {
        await page.keyboard.press("Space");
        const exec = page.getByRole("timer", { name: "Execution" });
        if (enabled) await expect(exec).toHaveText(/\d+\.\d{2}/);
        else await expect(exec).toHaveText("Solve");
      }
      await page.keyboard.press("Space");
      const popup = page.getByRole("dialog", {
        name: `${mode} result`,
        exact: true,
      });
      await expect(popup).toBeVisible();
      await expect(popup.locator(".font-timer").first()).toHaveText(
        /\d+\.\d{2}/,
      );
      if (mode === "Execution Sprint")
        await expect(popup.getByRole("definition").last()).toHaveText(
          /\d+\.\d{2}/,
        );
      await page.keyboard.press("Space");
      await expect(popup).toHaveCount(0);
    }
    if (!enabled) {
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await toggle.click();
      await page.getByRole("link", { name: "Training", exact: true }).click();
    }
  }
  // Updating the shared setting also changes a preserved active session immediately.
  await choose(page, "Guided Solve");
  await hold(page);
  await expect(page.locator('main .h-full.min-h-0[style]')).toHaveCSS('transform', 'none');
  const memoBox = await page
    .getByRole("timer", { name: "Memorisation" })
    .boundingBox();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await toggle.click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(page.getByRole("timer", { name: "Memorisation" })).toHaveText(
    "Solve",
  );
  await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
    "transform",
    "none",
  );
  expect(
    await page.getByRole("timer", { name: "Memorisation" }).boundingBox(),
  ).toEqual(memoBox);
  await page.keyboard.press("Space");
  const exec = page.getByRole("timer", { name: "Execution" });
  await expect(exec).toHaveText("Solve");
  const execBox = await exec.boundingBox();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await toggle.click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(exec).toHaveText(/\d+\.\d{2}/);
  expect(await exec.boundingBox()).toEqual(execBox);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog", { name: "Guided Solve result" }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(5);
});

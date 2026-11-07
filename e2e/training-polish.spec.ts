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
            solves: [
              {
                id: "50000000-0000-4000-8000-000000000011",
                scramble: "R U F",
                memoMs: 10000,
                executionMs: 20000,
                totalMs: 30000,
                result: "success",
                memoSnapshot: { edges: [], corners: [] },
                edgeMemo: [],
                cornerMemo: [],
                cycleBreaks: { edges: [], corners: [] },
                schemeSnapshot: scheme,
                createdAt: "2026-11-05T01:02:00Z",
              },
            ],
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
async function anchors(page: Page) {
  return page.evaluate(() =>
    [
      "[data-workspace-reference]",
      "[data-timer-cube-viewport]",
      "[data-subnav-column]",
      'button[aria-label="Sticker letters"]',
    ].map((s) => {
      const b = document.querySelector(s)!.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height];
    }),
  );
}
for (const mode of ["Execution Sprint", "Guided Solve"])
  test(`${mode} hold matches Timer dimming and keeps the mounted cube geometry`, async ({
    page,
  }) => {
    await page.goto("/");
    await ready(page);
    await page.keyboard.down("Space");
    await expect(page.locator("[data-workspace-reference]")).toHaveCSS(
      "opacity",
      "0.4",
    );
    const timerTransition = await page
      .locator("[data-workspace-reference]")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    await expect(page.locator("[data-cube-view]").first()).toBeVisible();
    await page.goto("/training");
    await page.keyboard.up("Space");
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await ready(page);
    const cube = page.locator("[data-timer-cube-viewport] [data-cube-view]");
    await expect(cube).toBeVisible();
    const node = await cube.elementHandle();
    const before = await anchors(page);
    await page.keyboard.down("Space");
    await expect(
      page.getByRole("timer", { name: "Ready, release to start" }),
    ).toBeVisible();
    await expect(page.locator("[data-subnav-column]")).toHaveCSS(
      "opacity",
      "0.4",
    );
    await expect(page.locator("[data-workspace-reference]")).toHaveCSS(
      "opacity",
      "0.4",
    );
    await expect(cube).toBeVisible();
    expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
    expect(await anchors(page)).toEqual(before);
    expect(
      await page
        .locator("[data-workspace-reference]")
        .evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe(timerTransition);
    await page.screenshot({
      path: `test-results/hold-${mode.replaceAll(" ", "-")}.png`,
    });
    await page.keyboard.up("Space");
    await expect(page.locator("[data-training-targets]")).toBeVisible();
  });
test("Guided execution exactly matches the idle timer anchor", async ({
  page,
}) => {
  await page.goto("/training");
  await page.getByRole("radio", { name: "Guided Solve", exact: true }).click();
  await ready(page);
  await expect(page.locator("main .max-h-full[style]")).toHaveCSS(
    "transform",
    "none",
  );
  const idle = await page
    .getByRole("timer", { name: "Hold Space to start" })
    .boundingBox();
  await hold(page);
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  const before = await anchors(page);
  await page.keyboard.press("Space");
  expect(
    await page.getByRole("timer", { name: "Execution" }).boundingBox(),
  ).toEqual(idle);
  expect(await anchors(page)).toEqual(before);
});
for (const mode of ["Execution Sprint", "Guided Solve"])
  test(`${mode} popup owns a fresh Space and ignores the opening press and repeats`, async ({
    page,
  }) => {
    await page.goto("/training");
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await ready(page);
    await hold(page);
    if (mode === "Guided Solve") await page.keyboard.press("Space");
    await page.keyboard.down("Space");
    const popup = page.getByRole("dialog", {
      name: `${mode} result`,
      exact: true,
    });
    await expect(popup).toBeVisible();
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(popup).toBeVisible();
    await page.keyboard.down("Space");
    await expect(popup).toHaveCount(0);
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await expect(
      page.getByRole("timer", { name: "Hold Space to start" }),
    ).toBeVisible();
    await page.waitForTimeout(350);
    await expect(
      page.getByRole("timer", { name: "Hold Space to start" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
            .length,
      ),
    ).toBe(1);
    // A fresh press works again, and Escape retains the same completion semantics.
    await ready(page);
    await hold(page);
    if (mode === "Guided Solve") await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
  });
test("Timer solve popup Space close preserves data, editable fields and focused controls", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const entry = page
    .getByRole("list", { name: "Solves", exact: true })
    .getByRole("button")
    .first();
  await entry.click();
  const popup = page.getByRole("dialog", { name: "Solve 1", exact: true });
  await expect(popup).toBeVisible();
  // Native text fields inside the real shared popup exercise capture-phase exclusions.
  for (const tag of ["input", "textarea", "div", "select"]) {
    await popup.evaluate((root, tag) => {
      const el = document.createElement(tag);
      el.id = "popup-edit";
      if (tag === "div") el.contentEditable = "true";
      root.append(el);
      el.focus();
    }, tag);
    await page.keyboard.press("Space");
    await expect(popup).toBeVisible();
    if (tag === "input" || tag === "textarea")
      await expect(page.locator("#popup-edit")).toHaveValue(" ");
    if (tag === "div")
      expect(await page.locator("#popup-edit").textContent()).toBe("\u00a0");
    await page.locator("#popup-edit").evaluate((el) => el.remove());
  }
  const dnf = popup.getByRole("radio", { name: "DNF", exact: true });
  await dnf.focus();
  await page.keyboard.press("Space");
  await expect(popup).toBeVisible();
  await expect(dnf).toHaveAttribute("aria-checked", "true");
  const ok = popup.getByRole("radio", { name: "OK", exact: true });
  await ok.click();
  await popup.evaluate((el) => {
    el.tabIndex = -1;
    el.focus();
  });
  await page.keyboard.down("Space");
  await expect(popup).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await page.waitForTimeout(350);
  await expect(page.locator("[data-timer-clock] [role=timer]")).toHaveText(
    "0.00",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.solves
          .length,
    ),
  ).toBe(1);
  await entry.click();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
});

import { test, expect, type Page, type Locator } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
test.use({ hasTouch: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript((scheme) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            attempts: [],
            solves: [],
            multiphaseTiming: false,
          },
          revision: 0,
          dirty: false,
        }),
      );
  }, createSpeffzScheme());
});
const visual = (page: Page) =>
  page.locator("[data-timing-visual]").filter({ visible: true }).first();
async function ready(page: Page) {
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
}
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await expect(
    page.locator('[role="timer"].text-accent').filter({ visible: true }),
  ).toBeVisible();
  await page.keyboard.up("Space");
  await expect(visual(page)).toHaveAttribute("data-timing-visual", "running");
}
async function coordinated(page: Page, state: string) {
  await expect(visual(page)).toHaveAttribute("data-timing-visual", state);
  const surfaces = page.locator(".timing-recede").filter({ visible: true });
  expect(await surfaces.count()).toBeGreaterThanOrEqual(3);
  for (const node of await surfaces.all()) {
    await expect(node).toHaveClass(new RegExp(`timing-${state}`));
    await expect(node).toHaveCSS("transition-duration", "0.2s");
    await expect(node).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.23, 1, 0.32, 1)",
    );
  }
}
async function mouseHold(page: Page, target: Locator) {
  const b = (await target.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  // Wait beyond the readiness threshold: this is the behavior under test.
  await page.waitForTimeout(320);
  await page.mouse.up();
}
async function touchHold(page: Page, target: Locator) {
  const client = await page.context().newCDPSession(page);
  const b = (await target.boundingBox())!;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await expect(
    page.locator('[role="timer"].text-accent').filter({ visible: true }),
  ).toBeVisible();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
test("Timer ignores mouse/trackpad, coordinates hold/cancel, and preserves real touch", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const clock = page.locator("[data-timer-clock]");
  await mouseHold(page, clock);
  await coordinated(page, "idle");
  // Cancel before readiness within one event turn; no timing-dependent screenshot assertion.
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
    );
    window.dispatchEvent(new Event("blur"));
  });
  await coordinated(page, "idle");
  await page.keyboard.down("Space");
  await coordinated(page, "holding");
  await expect(
    page.getByRole("region", { name: "Scramble", exact: true }),
  ).toHaveClass(/timing-holding/);
  await page.keyboard.up("Space");
  // If released before ready, start intentionally with a complete hold.
  if ((await visual(page).getAttribute("data-timing-visual")) === "idle")
    await hold(page);
  await coordinated(page, "running");
  await mouseHold(page, clock);
  await coordinated(page, "running");
  await page.keyboard.press("Space");
  const result = page.getByRole("dialog", {
    name: "Memo reconstruction",
    exact: true,
  });
  await expect(result).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(result).toHaveCount(0);
  await ready(page);
  await touchHold(page, clock);
  await coordinated(page, "running");
  await clock.tap();
  await expect(result).toBeVisible();
  // Normal result controls remain mouse-clickable.
  await result.getByRole("radio", { name: "+2", exact: true }).click();
  await expect(
    result.getByRole("radio", { name: "+2", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});
for (const mode of [
  "Execution Sprint",
  "Guided Solve",
  "Target Recognition",
  "Trace Sprint",
  "Memo Recall",
])
  test(`${mode}: mouse cannot start/stop; all hold visuals coordinate; touch starts`, async ({
    page,
  }) => {
    await page.goto("/training");
    await page.getByRole("radio", { name: mode, exact: true }).click();
    if (["Execution Sprint", "Guided Solve", "Trace Sprint"].includes(mode))
      await ready(page);
    if (mode === "Target Recognition")
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
    const clock = page.getByRole("timer", {
      name: "Hold Space to start",
      exact: true,
    });
    await mouseHold(page, clock);
    await coordinated(page, "idle");
    await page.keyboard.down("Space");
    await coordinated(page, "holding");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.keyboard.up("Space");
    await coordinated(page, "idle");
    await touchHold(page, clock);
    await expect(visual(page)).toHaveAttribute("data-timing-visual", "running");
    const active = page.locator("[data-training-challenge-id] main").first();
    await active.click({ position: { x: 10, y: 10 } });
    await expect(visual(page)).toHaveAttribute("data-timing-visual", "running");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (mode === "Execution Sprint") {
      await active.tap({ position: { x: 10, y: 10 } });
      await expect(page.getByRole("dialog")).toBeVisible();
    }
  });
const records = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.solves,
  );
async function completed(page: Page) {
  await page.goto("/");
  await ready(page);
  await hold(page);
  await page.keyboard.press("Space");
  const result = page.getByRole("dialog", {
    name: "Memo reconstruction",
    exact: true,
  });
  await expect(result).toBeVisible();
  // Some scrambles open a word field; number shortcuts must not consume typing.
  const resultControl = result.getByRole("radio", { name: "OK", exact: true });
  await resultControl.focus();
  await expect(resultControl).toBeFocused();
  await page.keyboard.press("2");
  await expect(
    result.getByRole("radio", { name: "+2", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(result).toHaveCount(0);
  await expect.poll(async () => (await records(page))[0]?.result).toBe("+2");
}
test("post-result keys update the same persisted solve, respect typing, and pause while timing", async ({
  page,
}) => {
  await completed(page);
  const original = (await records(page))[0];
  for (const [key, result] of [
    ["3", "dnf"],
    ["1", "success"],
    ["2", "+2"],
  ]) {
    await page.keyboard.press(key);
    await expect.poll(async () => (await records(page))[0].result).toBe(result);
    const saved = await records(page);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(original.id);
    expect(saved[0].totalMs).toBe(original.totalMs);
    if (result === "dnf")
      await expect(page.locator("[data-timer-clock]")).toContainText("DNF");
  }
  for (const tag of ["input", "textarea", "div"]) {
    await page.evaluate((tag) => {
      const input = document.createElement(tag);
      input.id = "typing-guard";
      if (tag === "div") {
        input.contentEditable = "true";
        input.tabIndex = 0;
      }
      document.body.append(input);
      input.focus();
    }, tag);
    await page.keyboard.press("3");
    expect((await records(page))[0].result).toBe("+2");
    await page.evaluate(() =>
      document.getElementById("typing-guard")?.remove(),
    );
  }
  await ready(page);
  await hold(page);
  await page.keyboard.press("3");
  expect((await records(page))[0].result).toBe("+2");
});
test("returning to Timer keeps latest-solve number shortcuts available", async ({ page }) => {
  await completed(page);
  await page.getByRole("link", { name: "Letter Pairs", exact: true }).click();
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await expect(page.locator("[data-timer-clock]")).toBeVisible();
  await ready(page);
  await page.keyboard.press("3");
  await expect.poll(async () => (await records(page))[0].result).toBe("dnf");
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 600 },
  { width: 390, height: 568 },
]) {
  test(`timing surfaces remain coordinated at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await ready(page);
    for (const mode of ["Timer", "Training"]) {
      if (mode === "Training") {
        await page.getByRole("link", { name: "Training", exact: true }).click();
        if (viewport.width < 768)
          await page
            .getByRole("button", { name: "Training controls", exact: true })
            .click();
        await page
          .getByRole("radio", { name: "Execution Sprint", exact: true })
          .click();
        if (viewport.width < 768)
          await page
            .getByRole("dialog", { name: "Training controls", exact: true })
            .getByRole("button", { name: "Close", exact: true })
            .click();
        await ready(page);
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("timer").filter({ visible: true }).click();
      await page.mouse.move(0, 0);
      await page.keyboard.down("Space");
      await coordinated(page, "holding");
      await expect(
        page.getByRole("region", { name: "Scramble", exact: true }),
      ).toHaveCSS("opacity", "0.4");
      await page.screenshot({
        path: info.outputPath(
          `${mode.toLowerCase()}-holding-${viewport.width}.png`,
        ),
      });
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.keyboard.up("Space");
      await coordinated(page, "idle");
      await expect(
        page.getByRole("region", { name: "Scramble", exact: true }),
      ).toHaveCSS("opacity", "1");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}

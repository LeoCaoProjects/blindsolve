import type { Locator } from "@playwright/test";
import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
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
            multiphaseTiming: true,
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});

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
  const controls = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await controls.isVisible()) {
    await controls.getByRole("button", { name: "Close", exact: true }).click();
    await expect(controls).toHaveCount(0);
  }
}
test("Guided uses the same Timer multiphase feedback without moving its corrected anchor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await hold(page);
  await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByText("Executing", { exact: true })).toBeVisible();
  const feedback = () =>
    page.locator(".timer-execution-cue").evaluate((el) => {
      const s = getComputedStyle(el);
      const cue = document.querySelector('[aria-live="polite"] p')!;
      return {
        name: s.animationName,
        duration: s.animationDuration,
        easing: s.animationTimingFunction,
        label: cue.textContent,
        class: cue.className,
        color: getComputedStyle(cue).color,
      };
    });
  const reference = await feedback();
  expect(reference.name).toBe("timer-execution-cue");
  expect(reference.duration).toBe("0.45s");
  await page.screenshot({ path: "test-results/timer-phase-reference.png" });
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await choose(page, "Guided Solve");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await expect(page.locator("main .max-h-full[style]")).toHaveCSS(
    "transform",
    "none",
  );
  const idleTimer = page.getByRole("timer", { name: "Hold Space to start" });
  // The readout's own layout animation can outlast the outer entrance animation.
  await expect(idleTimer.locator("..")).toHaveCSS("transform", "none");
  const idle = await idleTimer.boundingBox();
  await hold(page);
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
  const geometry = () =>
    page.evaluate(() =>
      [
        "[data-subnav-column]",
        "[data-workspace-reference]",
        "[data-timer-cube-viewport]",
        'button[aria-label="Sticker letters"]',
      ].map((s) => {
        const b = document.querySelector(s)!.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
      }),
    );
  const before = await geometry();
  await page.keyboard.press("Space");
  await expect(page.getByText("Executing", { exact: true })).toBeVisible();
  expect(await feedback()).toEqual(reference);
  expect(await geometry()).toEqual(before);
  expect(
    await page.getByRole("timer", { name: "Execution" }).boundingBox(),
  ).toEqual(idle);
  await page.screenshot({ path: "test-results/guided-shared-phase-cue.png" });
});
for (const [width, height] of [
  [1440, 900],
  [320, 568],
])
  test(`shared help and keybind reference popups fit ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/training");
    const style = async (dialog: Locator) =>
      dialog.evaluate((el: Element) => {
        const s = getComputedStyle(el);
        return {
          width: el.getBoundingClientRect().width,
          padding: s.padding,
          bg: s.backgroundColor,
          border: s.border,
          radius: s.borderRadius,
          shadow: s.boxShadow,
          font: s.fontFamily,
          titleClass: el.querySelector("h2")!.className,
          closeClass: el.querySelector('button[aria-label="Close"]')!.className,
        };
      });
    let reference: Awaited<ReturnType<typeof style>> | undefined;
    for (const [mode, phrase] of [
      ["Execution Sprint", "memo supplied"],
      ["Guided Solve", "begin execution"],
      ["Memo Recall", "Type the targets in order"],
      ["Trace Sprint", "right view shows its back"],
    ]) {
      await choose(page, mode);
      const helpTrigger = page.getByRole("button", { name: "How it works", exact: true });
      if (mode === 'Execution Sprint') await helpTrigger.press('Space');
      else await helpTrigger.click();
      const help = page.getByRole("dialog", {
        name: `How ${mode} works`,
        exact: true,
      });
      await expect(help).toBeVisible();
      await expect(
        help.getByRole("heading", { name: "How it works", exact: true }),
      ).toBeVisible();
      await expect(help).toContainText(phrase);
      expect(await help.getByRole("term").count()).toBeGreaterThanOrEqual(3);
      const current = await style(help);
      if (!reference) reference = current;
      else expect(current).toEqual(reference);
      expect(
        await help.evaluate((el: Element) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      if (width === 1440)
        expect(
          await help
            .locator(".scroll-quiet")
            .evaluate((el: Element) => el.scrollHeight <= el.clientHeight),
        ).toBe(true);
      await expect(help).toHaveCSS('opacity', '1');
      await page.screenshot({
        path: `test-results/help-${mode.replaceAll(" ", "-")}-${width}.png`,
      });
      if (mode === "Execution Sprint")
        await help.getByRole("button", { name: "Close", exact: true }).click();
      else
        await page.keyboard.press(mode === "Guided Solve" ? "Space" : "Escape");
      await expect(help).toHaveCount(0);
      // Each mode gets only its own real shortcuts, in the exact same shell.
      await page.keyboard.press("?");
      const keys = page.getByRole("dialog", {
        name: "Keyboard shortcuts",
        exact: true,
      });
      await expect(keys).toBeVisible();
      expect(await style(keys)).toEqual(reference);
      await expect(
        keys.getByRole("heading", { name: "Keybinds", exact: true }),
      ).toBeVisible();
      await expect(keys).toContainText("Close non-editing popup");
      await expect(keys).not.toContainText("save without questions");
      await expect(keys).not.toContainText("T / W");
      if (mode === "Guided Solve")
        await expect(keys).toContainText("End memo or stop execution");
      if (mode === "Trace Sprint")
        await expect(keys).not.toContainText("New scramble");
      expect(
        await keys.evaluate((el: Element) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await expect(keys).toHaveCSS('opacity', '1');
      await page.screenshot({
        path: `test-results/keybinds-${mode.replaceAll(" ", "-")}-${width}.png`,
      });
      await page.keyboard.press("Space");
      await expect(keys).toHaveCount(0);
    }
    // Native editing inside the new shared reference shell keeps Space.
    await page.keyboard.press("?");
    const popup = page.getByRole("dialog", {
      name: "Keyboard shortcuts",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await popup.evaluate((el: Element) => {
      const input = document.createElement("input");
      input.id = "reference-edit";
      el.append(input);
      input.focus();
    });
    await page.keyboard.press("Space");
    await expect(page.locator("#reference-edit")).toHaveValue(" ");
    await expect(popup).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
  });

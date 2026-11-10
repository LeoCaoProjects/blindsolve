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
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(330);
  await page.keyboard.up("Space");
}
for (const [index, mode] of [
  "Execution Sprint",
  "Guided Solve",
  "Target Recognition",
  "Trace Sprint",
  "Memo Recall",
].entries()) {
  test(`${mode}: closing How it works restores hold-to-start`, async ({
    page,
  }) => {
    await page.goto("/training");
    await page.getByRole("radio", { name: mode, exact: true }).click();
    if (["Execution Sprint", "Guided Solve", "Trace Sprint"].includes(mode))
      await expect(
        page.getByRole("button", { name: "New scramble", exact: true }),
      ).toBeEnabled({ timeout: 45000 });
    if (mode === "Target Recognition")
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
    await page
      .getByRole("button", { name: "How it works", exact: true })
      .click();
    const help = page.getByRole("dialog", {
      name: `How ${mode} works`,
      exact: true,
    });
    await expect(help).toBeVisible();
    if (index % 2) await page.keyboard.press("Escape");
    else await help.getByRole("button", { name: "Close", exact: true }).click();
    await expect(help).toHaveCount(0);
    await expect(page.locator("[data-workspace-main]")).toBeFocused();
    await hold(page);
    await expect(
      page.getByRole("timer", { name: "Hold Space to start", exact: true }),
    ).toHaveCount(0);
  });
}
for (const path of ["/", "/flashcards"]) {
  test(`${path}: reference sheet returns focus to the workspace`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    const sheet = page.getByRole("dialog", {
      name: "Keyboard shortcuts",
      exact: true,
    });
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.locator("[data-workspace-main]")).toBeFocused();
    if (path === "/") {
      await expect(
        page.getByRole("button", { name: "New scramble", exact: true }),
      ).toBeEnabled({ timeout: 45000 });
      await hold(page);
      await expect(page.locator("[data-timer-clock]")).not.toContainText(
        "0.00",
      );
    }
  });
}

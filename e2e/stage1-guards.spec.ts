import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

test.beforeEach(async ({ page }) => {
  await page.route(/supabase\.(co|in)/, (route) => route.abort());
  await page.addInitScript((scheme) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            pairs: {},
            solves: [],
            attempts: [],
            onboarded: true,
          },
          revision: 0,
          dirty: false,
        }),
      );
  }, createSpeffzScheme());
});

test("held Timer Space cannot survive rapid root workspace navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.keyboard.down("Space");
  await page.waitForTimeout(350);
  const nav = page
    .getByRole("navigation", { name: "Sections" })
    .filter({ visible: true });
  for (const name of ["Training", "Letter Pairs", "Timer"])
    await nav.getByRole("link", { name, exact: true }).click();
  await page.keyboard.up("Space");
  await expect(page.locator("[data-timer-clock]")).toContainText("0.00");
  await page.waitForTimeout(350);
  await expect(page.locator("[data-timer-clock]")).toContainText("0.00");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.solves,
    ),
  ).toHaveLength(0);
});

test("Training composing Space and Escape cannot start or submit recall", async ({
  page,
}) => {
  await page.goto("/training");
  await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Space",
        isComposing: true,
        bubbles: true,
      }),
    );
  });
  await page.waitForTimeout(350);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        code: "Space",
        isComposing: true,
        bubbles: true,
      }),
    ),
  );
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();
  await page.keyboard.down("Space");
  await page.waitForTimeout(350);
  await page.keyboard.up("Space");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("timer", { name: "Recall", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        isComposing: true,
        bubbles: true,
      }),
    ),
  );
  await expect(
    page.getByRole("timer", { name: "Recall", exact: true }),
  ).toBeVisible();
});

test("about redirect and unknown route stay distinct", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/stage1-missing-route");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to the BlindSolve timer" })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("unconfigured sign-in reports failure and keeps local data", async ({
  page,
}) => {
  await page.goto("/signin");
  const before = await page.evaluate(() =>
    localStorage.getItem("cubeiq-bld-v2:guest"),
  );
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Sign-in is not configured",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("cubeiq-bld-v2:guest")),
  ).toBe(before);
  await page.getByRole("link", { name: "Continue without signing in" }).click();
  await expect(page).toHaveURL(/\/$/);
});

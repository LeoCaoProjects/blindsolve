import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

async function setup(page: Page, multi = false) {
  const scheme = createSpeffzScheme();
  if (multi)
    Object.values(scheme.stickers).forEach((s) => {
      s.label = `${s.label}H`;
    });
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
    scheme,
  );
  await page.goto("/training");
  const trigger = page.getByRole("button", {
    name: "Training controls",
    exact: true,
  });
  if (await trigger.isVisible()) await trigger.click();
  await page
    .getByRole("radio", { name: "Target Recognition", exact: true })
    .click();
  const sheet = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await sheet.isVisible())
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 45000 });
  // Remove focus from mode controls without invoking a start.
  await page.getByRole("timer", { name: "Hold Space to start" }).click();
}
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(330);
  await page.keyboard.up("Space");
}
test("single-key answers remain silent; completion, history, deletion and start guards", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("group", { name: "Recognition piece", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.waitForTimeout(330);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("Space");
  await expect(page.getByLabel("Target label", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Control+Space");
  await hold(page);
  const input = page.getByLabel("Target label", { exact: true });
  await expect(input).toBeAttached();
  await expect(page.locator('[data-recognition-sticker="source"]')).toHaveCount(
    1,
  );
  await input.dispatchEvent("keydown", {
    key: "Q",
    code: "KeyQ",
    repeat: true,
  });
  await input.dispatchEvent("keydown", {
    key: "Q",
    code: "KeyQ",
    isComposing: true,
  });
  await input.press("Control+a");
  await expect(page.locator("[data-recognition-progress]")).toContainText("1/");
  await input.press("Z");
  await expect(page.locator("[data-recognition-progress]")).toContainText("2/");
  await expect(
    page.getByText(/Correct|Incorrect|Expected/, { exact: true }),
  ).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/recognition-desktop.png" });
  const text = await page.locator("[data-recognition-progress]").innerText();
  const count = Number(text.split("/")[1]);
  for (let i = 1; i < count; i++) await input.press("Z");
  const result = page.getByRole("dialog", {
    name: "Target Recognition result",
  });
  await expect(result).toBeVisible();
  await expect(result.getByText(`0/${count}`, { exact: true })).toBeVisible();
  await expect(
    result.getByText("Time per target", { exact: true }),
  ).toBeVisible();
  await expect(result.locator("[data-recall-error]")).not.toHaveCount(0);
  await result.getByRole("button", { name: /^Close/ }).click();
  const row = page.locator("[data-attempt-row]");
  await expect(row).toContainText("DNF");
  await row.click();
  await expect(result).toHaveCount(0);
  const attempt = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts[0],
  );
  expect(attempt.recognitionAnswers).toBeUndefined();
  expect(attempt.scramble).toBeUndefined();
  await row.hover();
  await page
    .getByRole("button", { name: "Delete attempt 1", exact: true })
    .click();
  await expect(page.locator("[data-attempt-row]")).toHaveCount(0);
});
test("mobile multi-character tokens use Enter and route changes abandon input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, true);
  await hold(page);
  const input = page.getByLabel("Target label", { exact: true });
  await expect(input).toBeAttached();
  await input.fill("SH");
  await expect(page.locator("[data-recognition-progress]")).toContainText("1/");
  await input.press("Enter");
  await expect(page.locator("[data-recognition-progress]")).toContainText("2/");
  await expect(input).toHaveValue("");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/recognition-mobile.png" });
  await input.fill("S");
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(input).toHaveCount(0);
  await hold(page);
  await expect(input).toHaveValue("");
  await expect(page.locator("[data-recognition-progress]")).toContainText("1/");
});

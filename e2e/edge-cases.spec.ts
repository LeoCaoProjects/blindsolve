import { test, expect } from "@playwright/test";
async function startTimer(page: import("@playwright/test").Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
test("empty flashcards are useful and do not crash", async ({ page }) => {
  await page.goto("/flashcards");
  await expect(
    page.getByRole("heading", { name: "Add your first mnemonic" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open letter pairs" }).click();
  await expect(page).toHaveURL(/\/pairs$/);
});
test("running timer guards internal navigation and shortcuts in dialogs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await startTimer(page);
  await page.getByRole("link", { name: "Letter Pairs", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Leave this solve?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay here" }).click();
  await expect(
    page.getByRole("button", { name: "Begin execution", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
});
test("backup validation, merge preview and restoration", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Use these defaults" }).click();
  await page.getByLabel("U:UB edge token", { exact: true }).fill("CH");
  await page.getByRole("button", { name: "Save setup" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(file).toBeTruthy();
  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99,"data":{}}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Unsupported backup version",
  );
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(
    page.getByRole("dialog", { name: "Review backup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back up & merge" }).click();
  await expect(page.getByText(/Backup merged/)).toBeVisible();
  await expect(page.getByLabel("U:UB edge token", { exact: true })).toHaveValue(
    "CH",
  );
});
test.describe("mobile touch and reduced motion", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  test("pair dialog traps focus and accepts a long custom token", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Use these defaults" }).tap();
    await page
      .getByLabel("U:UB edge token", { exact: true })
      .fill("CHOCOLATE123");
    await page.getByRole("button", { name: "Save setup" }).tap();
    await page.getByRole("link", { name: "Letter pairs", exact: true }).tap();
    await page
      .getByRole("button", {
        name: "CHOCOLATE123 CHOCOLATE123: empty",
        exact: true,
      })
      .tap();
    await page
      .getByLabel("Primary mnemonic", { exact: true })
      .fill("chocolate");
    await page.getByRole("button", { name: "Save", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: /^Close CHOCOLATE/ }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    await page.getByRole("link", { name: "Flashcards", exact: true }).tap();
    await expect(page.getByRole("button", { name: /^Reveal/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "docs/screenshots/v2/mobile-long-token.png",
    });
  });
});

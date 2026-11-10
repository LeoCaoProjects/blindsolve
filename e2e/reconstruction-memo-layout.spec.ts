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
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});

for (const width of [1440, 390])
  test(`word entry and saved-style reconstruction review at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole("region", { name: "Scramble", exact: true })
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.down("Space");
    await page.waitForTimeout(350);
    await page.keyboard.up("Space");
    await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByText("Executing", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    const popup = page.getByRole("dialog", {
      name: "Memo reconstruction",
      exact: true,
    });
    await expect(popup).toBeVisible();
    for (
      let i = 0;
      i < 30 &&
      (await popup.getByRole("heading", { name: /cycle break/ }).count());
      i++
    )
      await popup
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    const input = popup.getByPlaceholder("Enter word");
    await expect(input).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const pair = (await popup.locator("[data-word-entry-pair]").boundingBox())!;
    const field = (await popup
      .locator("[data-word-entry-field]")
      .boundingBox())!;
    expect(
      Math.abs(pair.y + pair.height / 2 - field.y - field.height / 2),
    ).toBeLessThan(1);
    const suggest = popup.getByRole("button", { name: /^Suggest word for/ });
    const icon = (await suggest.boundingBox())!;
    expect(icon.x).toBeGreaterThan(field.x);
    expect(icon.x + icon.width).toBeLessThanOrEqual(field.x + field.width + 1);
    expect(icon.y).toBeGreaterThanOrEqual(field.y);
    expect(icon.y + icon.height).toBeLessThanOrEqual(
      field.y + field.height + 1,
    );
    await expect(popup.getByText("Suggest", { exact: true })).toHaveCount(0);
    await suggest.click();
    const suggestions = page.getByRole("dialog", { name: /^Suggestions for/ });
    await expect(suggestions).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(suggestions).toHaveCount(0);
    await input.fill("Apple");
    await page.screenshot({
      path: `test-results/reconstruction-entry-${width}.png`,
    });
    for (let i = 0; i < 30 && (await input.count()); i++) {
      const label = await input.getAttribute("aria-label");
      if (!(await input.inputValue())) await input.fill(`Memo${i}`);
      await input.press("Enter");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document
                .querySelector('input[placeholder="Enter word"]')
                ?.getAttribute("aria-label") ?? "",
          ),
        )
        .not.toBe(label);
    }
    const section = popup.locator("[data-solve-memo-section]");
    await expect(section).toBeVisible();
    await expect(section.getByText("Apple", { exact: true })).not.toHaveCount(
      0,
    );
    await expect(
      popup.getByText(/Word edits save|join your letter pairs/),
    ).toHaveCount(0);
    await expect(popup.getByLabel("new pair")).toHaveCount(0);
    expect(await popup.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const before = await section.textContent();
    await page.screenshot({
      path: `test-results/reconstruction-review-${width}.png`,
    });
    await popup
      .getByRole("button", { name: "Save solve", exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    await page
      .getByRole("list", { name: "Solves", exact: true })
      .getByRole("button")
      .first()
      .click();
    const saved = page.locator('[role="dialog"] [data-solve-memo-section]');
    await expect(saved).toBeVisible();
    await expect(saved).toHaveText(before);
  });

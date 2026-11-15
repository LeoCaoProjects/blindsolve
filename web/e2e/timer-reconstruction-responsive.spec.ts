import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

const attempts = ["exec", "guided", "recall", "trace", "flashcard"].map(
  (mode, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`,
    kind: mode === "flashcard" ? "flashcard" : "memo",
    ...(mode === "flashcard"
      ? { pairKey: "AB", pairPiece: "edges" }
      : { trainingMode: mode, scope: "both" }),
    correct: true,
    durationMs: 3000,
    createdAt: "2026-11-05T00:00:00.000Z",
  }),
);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
        );
    },
    {
      scheme: createSpeffzScheme(),
      solves: [],
      attempts,
      pairs: {},
      onboarded: true,
    },
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
])
  test(`reconstruction input and footer actions fit ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page
      .getByRole("region", { name: "Scramble", exact: true })
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.down("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up("Space");
    await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByText("Executing", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    const panel = page.getByRole("dialog", { name: "Memo reconstruction" });
    await expect(
      panel.getByRole("region", { name: "Solve summary" }),
    ).toBeVisible();
    for (
      let i = 0;
      i < 20 &&
      (await panel.getByRole("heading", { name: /cycle break/ }).count());
      i++
    )
      await panel
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    const input = panel.getByPlaceholder("Enter word");
    await expect(input).toBeVisible();
    await expect(panel.getByText("Not in your letter pairs yet")).toHaveCount(
      0,
    );
    await expect(
      panel.getByRole("button", { name: "Skip", exact: true }),
    ).toHaveCount(0);
    const skip = panel.getByRole("button", {
      name: "Skip to save",
      exact: true,
    });
    const next = panel.getByRole("button", { name: "Continue", exact: true });
    const a = (await skip.boundingBox())!,
      b = (await next.boundingBox())!;
    const panelBox = (await panel.boundingBox())!;
    expect(a.x - panelBox.x).toBeLessThan(width < 600 ? 35 : 60);
    expect(b.x).toBeGreaterThan(a.x + a.width);
    expect(a.y + a.height).toBeLessThanOrEqual(height);
    expect(b.x + b.width).toBeLessThanOrEqual(width);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await input.fill("Mnemonic");
    if (process.env.TIMER_REVIEW_DIR) {
      await mkdir(process.env.TIMER_REVIEW_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.TIMER_REVIEW_DIR, `reconstruction-${width}.png`),
      });
    }
    await input.press("Enter");
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await skip.click();
    await expect(panel).toHaveCount(0);
  });

test("all Training and Flashcard headers disappear while clear shortcuts still work", async ({
  page,
}) => {
  await page.goto("/training");
  for (const mode of [
    "Execution Sprint",
    "Guided Solve",
    "Memo Recall",
    "Trace Sprint",
  ]) {
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Clear", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("list", { name: "Attempts", exact: true })
        .locator("[data-virtual-row]"),
    ).toHaveCount(1);
    await page.keyboard.press("Shift+Backspace");
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation).toBeVisible();
    await confirmation
      .getByRole("button", { name: "Clear all", exact: true })
      .click();
    await expect(
      page
        .getByRole("list", { name: "Attempts", exact: true })
        .locator("[data-virtual-row]"),
    ).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Flashcards", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("list", { name: "Recent cards", exact: true })
      .locator("[data-virtual-row]"),
  ).toHaveCount(1);
  await page.keyboard.press("Shift+Backspace");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Recent cards", exact: true })
      .locator("[data-virtual-row]"),
  ).toHaveCount(0);
});

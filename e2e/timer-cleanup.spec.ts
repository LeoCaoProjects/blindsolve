import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import {
  stateFromScramble,
  CORNER_SLOTS,
  EDGE_SLOTS,
} from "../src/magic/utils/cube";

const sizes = [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
];
const legacy = {
  id: "30000000-0000-4000-8000-000000000001",
  scramble: "R U F",
  memoMs: 410640,
  executionMs: 98020,
  totalMs: 508660,
  result: "dnf",
  edgeMemo: [],
  cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
  createdAt: "2026-10-25T02:00:00.000Z",
  sessionId: "old-practice",
};
const records = [
  legacy,
  {
    ...legacy,
    id: "30000000-0000-4000-8000-000000000002",
    sessionId: "today",
    result: "success",
  },
  {
    ...legacy,
    id: "30000000-0000-4000-8000-000000000003",
    timerMode: "edges",
    result: "success",
  },
  {
    ...legacy,
    id: "30000000-0000-4000-8000-000000000004",
    timerMode: "corners",
    result: "success",
  },
];
async function seed(page: Page) {
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
      pairs: {},
      attempts: [],
      solves: records,
      onboarded: true,
    },
  );
}
async function contained(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function screenshot(page: Page, name: string) {
  if (!process.env.TIMER_REVIEW_DIR) return;
  await mkdir(process.env.TIMER_REVIEW_DIR, { recursive: true });
  await page.screenshot({
    path: join(process.env.TIMER_REVIEW_DIR, name + ".png"),
  });
}
for (const [width, height] of sizes)
  test(`Timer and saved result stay clean at ${width}x${height}`, async ({
    page,
  }) => {
    await seed(page);
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    const modes = page.getByRole("radiogroup", { name: "Timer mode" });
    await expect(modes.getByRole("radio")).toHaveCount(3);
    await expect(page.getByRole("button", { name: /^Clear/ })).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Scramble", exact: true }),
    ).not.toContainText(/#\d|⇧⌫/);
    await expect(
      page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
    ).toHaveCount(2);
    expect((await modes.boundingBox())!.y).toBeLessThan(40);
    await contained(page);
    await screenshot(page, `timer-${width}`);
    await page
      .getByRole("list", { name: "Solves", exact: true })
      .locator("li")
      .first()
      .getByRole("button")
      .first()
      .click();
    const panel = page.getByRole("dialog");
    const summary = panel.getByRole("region", { name: "Solve summary" });
    await expect(summary).toContainText("8:28.66");
    await expect(summary).toContainText("Memorisation");
    await expect(summary).toContainText("Execution");
    await expect(summary.locator("time")).toContainText(/2026, \d\d:\d\d/);
    await expect(summary).not.toContainText(/#\d|·|key [123]/);
    await expect(
      panel.getByRole("button", { name: "Delete solve", exact: true }),
    ).toBeVisible();
    const close = panel.getByRole("button", { name: /^Close/ });
    await expect(close).toBeVisible();
    const bounds = await close.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    await contained(page);
    await screenshot(page, `details-${width}`);
    await page.keyboard.press("2");
    await expect(
      summary.getByRole("radio", { name: "+2", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(summary).toContainText("8:30.66");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

for (const mode of ["Edges", "Corners"])
  test(`${mode} uses real restricted scrambles and separate durable history`, async ({
    page,
  }) => {
    await seed(page);
    await page.goto("/");
    const modes = page.getByRole("radiogroup", { name: "Timer mode" });
    await modes.getByRole("radio", { name: mode, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await expect(
      page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
    ).toHaveCount(1);
    await page
      .getByRole("region", { name: "Scramble", exact: true })
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.down("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up("Space");
    await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
    await expect(
      modes.getByRole("radio", { name: "3BLD", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Space");
    await expect(page.getByText("Executing", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    const panel = page.getByRole("dialog", { name: "Memo reconstruction" });
    await expect(
      panel.getByRole("region", { name: "Solve summary" }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Skip", exact: true }),
    ).toHaveCount(0);
    await expect(panel.getByText("Not in your letter pairs yet")).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: /Skip to save|Save solve/ }).click();
    await expect(panel).toHaveCount(0);
    const data = await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
    );
    const saved = data.solves.find(
      (s: { id: string }) => !records.some((r) => r.id === s.id),
    );
    expect(saved.timerMode).toBe(mode.toLowerCase());
    expect(saved[mode === "Edges" ? "cornerMemo" : "edgeMemo"]).toEqual([]);
    expect(saved.memoSnapshot[mode === "Edges" ? "corners" : "edges"]).toEqual(
      [],
    );
    expect(data.solves.find((s: { id: string }) => s.id === legacy.id)).toEqual(
      legacy,
    );
    const state = stateFromScramble(saved.scramble);
    const slots = mode === "Edges" ? CORNER_SLOTS : EDGE_SLOTS;
    for (const [face, stickers] of Object.entries(state))
      for (const slot of slots) expect(stickers[slot]).toBe(face);
    await page.reload();
    await expect(
      modes.getByRole("radio", { name: mode, exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
    ).toHaveCount(2);
  });

test("clear shortcut removes only current Timer mode and does not resurrect after reload", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await expect(
    page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
  ).toHaveCount(2);
  await page.keyboard.press("Shift+Backspace");
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("Clear all 2 solves");
  await confirmation
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await page.reload();
  await expect(
    page
      .getByRole("list", { name: "Solves", exact: true })
      .locator("[data-virtual-row]"),
  ).toHaveCount(0);
  await page.getByRole("radio", { name: "Edges", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
  ).toHaveCount(1);
  await page.getByRole("radio", { name: "Corners", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Solves", exact: true }).locator("li"),
  ).toHaveCount(1);
  await page.getByRole("radio", { name: "3BLD", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Solves", exact: true })
      .locator("[data-virtual-row]"),
  ).toHaveCount(0);
});

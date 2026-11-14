import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { writePairEntries } from "../src/workspace/utils/pairPersistence";
import type { AppData } from "../src/data/model";

const modes = [
  "Execution Sprint",
  "Guided Solve",
  "Memo Recall",
  "Trace Sprint",
];
const modeIds = ["exec", "guided", "recall", "trace"];
test.beforeEach(async ({ page }) => {
  const createdAt = (i: number) => `2026-11-08T00:00:0${i}Z`;
  const data = writePairEntries(
    {
      scheme: createSpeffzScheme(),
      onboarded: true,
      pairs: {},
      attempts: [
        ...modeIds.flatMap((trainingMode) =>
          [0, 1, 2].map((i) => ({
            id: crypto.randomUUID(),
            kind: "memo",
            trainingMode,
            durationMs: 12000,
            correct: true,
            targets: 12,
            pairs: 6,
            createdAt: createdAt(i),
          })),
        ),
        ...[0, 1, 2].map((i) => ({
          id: crypto.randomUUID(),
          kind: "flashcard",
          pairKey: "A|B",
          pairPiece: "edges",
          correct: true,
          createdAt: createdAt(i),
        })),
      ],
      solves: [0, 1, 2].map((i) => ({
        id: crypto.randomUUID(),
        scramble: "R U F",
        memoMs: 10000,
        executionMs: 20000,
        totalMs: 30000,
        result: "success",
        edgeMemo: [],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: createdAt(i),
      })),
    } as AppData,
    { "A|B": { shared: ["Apple"] } },
  );
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, dirty: false, revision: 0 }),
      );
  }, data);
});
const saved = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
for (const [width, height] of [
  [1440, 900],
  [390, 844],
])
  test(`pointer route changes do not leave a nav focus ring after deleting at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    for (const destination of ["Training", "Timer", "Flashcards"]) {
      const link = page.getByRole("link", { name: destination, exact: true });
      await link.click();
      await expect(link).not.toBeFocused();
      await page.keyboard.press("Delete");
      const popup = page.getByRole("alertdialog");
      await expect(
        popup.getByRole("button", { name: "Delete", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(popup).toHaveCount(0);
      expect(
        await page.evaluate(
          () => !!document.activeElement?.closest('nav[aria-label="Sections"]'),
        ),
      ).toBe(false);
    }
    // Ordinary keyboard navigation still gets its visible focus indicator.
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const el = document.activeElement!;
      return {
        visible: el.matches(":focus-visible"),
        outline: getComputedStyle(el).outlineColor,
      };
    });
    expect(focus.visible).toBe(true);
    expect(focus.outline).not.toBe("rgba(0, 0, 0, 0)");
  });
for (const destination of ["Timer", ...modes, "Flashcards"])
  test(`${destination}: Enter confirms Delete and Shift+Delete, then restores focus`, async ({
    page,
  }) => {
    const timer = destination === "Timer",
      flash = destination === "Flashcards";
    await page.goto(timer ? "/" : flash ? "/flashcards" : "/training");
    const trigger = timer
      ? page.getByRole("link", { name: "Timer", exact: true })
      : flash
        ? page.getByRole("button", { name: /^Reveal/ })
        : page.getByRole("radio", { name: destination, exact: true });
    if (!timer && !flash) await trigger.click();
    const history = page.getByRole("list", {
      name: timer ? "Solves" : flash ? "Recent cards" : "Attempts",
      exact: true,
    });
    await expect(history.locator("[data-virtual-row]")).toHaveCount(3);
    await trigger.focus();
    await page.keyboard.press("Delete");
    const popup = page.getByRole("alertdialog");
    await expect(
      popup.getByRole("button", { name: "Delete", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popup).toHaveCount(0);
    await expect(history.locator("[data-virtual-row]")).toHaveCount(2);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "none");
    // Escape still cancels and returns focus without removing records.
    await page.keyboard.press("Shift+Delete");
    await expect(
      popup.getByRole("button", { name: "Clear all", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(history.locator("[data-virtual-row]")).toHaveCount(2);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "none");
    // Backspace remains an alias for Delete, including its Shift variant.
    await page.keyboard.press("Shift+Backspace");
    await expect(
      popup.getByRole("button", { name: "Clear all", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popup).toHaveCount(0);
    await expect(history.locator("[data-virtual-row]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "none");
    await page.keyboard.press("Tab");
    await expect(trigger).not.toHaveAttribute("data-quiet-focus-return");
    const data = await saved(page);
    if (timer) expect(data.solves).toHaveLength(0);
    else if (flash)
      expect(
        data.attempts.filter((a: { kind: string }) => a.kind === "flashcard"),
      ).toHaveLength(0);
    else
      expect(
        data.attempts.filter(
          (a: { trainingMode?: string }) => a.trainingMode === modeIds[modes.indexOf(destination)],
        ),
      ).toHaveLength(0);
  });

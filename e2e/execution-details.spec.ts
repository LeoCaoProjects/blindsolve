import { test, expect } from "@playwright/test";
import { createSpeffzScheme, stickersFor } from "../src/domain/bld/speffz";
import { pairKey } from "../src/domain/letterPairs";
import { mkdir } from "node:fs/promises";
import { formatTime } from "../src/magic/utils/time";
const out = "test-results/execution-details";
test.beforeEach(async ({ page }) => {
  await mkdir(out, { recursive: true });
  const scheme = createSpeffzScheme(),
    edges = stickersFor(scheme, "edge");
  const pairs = Object.fromEntries(
    [
      ["T", "D", "Toad"],
      ["O", "R", "Oar"],
      ["W", "X", "Wax"],
    ].map(([a, b, word]) => {
      const first = edges.find((s) => s.label === a)!,
        second = edges.find((s) => s.label === b)!;
      return [
        pairKey(first.id, second.id),
        {
          id: crypto.randomUUID(),
          firstStickerId: first.id,
          secondStickerId: second.id,
          firstToken: a,
          secondToken: b,
          primaryMnemonic: word,
          updatedAt: "2026-11-06T00:00:00Z",
        },
      ];
    }),
  );
  const reconstructionPair = (
    piece: "edge" | "corner",
    a: string,
    b: string,
    word: string,
  ) => {
    const stickers = stickersFor(scheme, piece);
    const first = stickers.find((s) => s.label === a)!,
      second = stickers.find((s) => s.label === b)!;
    return {
      firstStickerId: first.id,
      secondStickerId: second.id,
      firstToken: a,
      secondToken: b,
      mnemonic: word,
    };
  };
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false }),
        );
    },
    {
      scheme,
      pairs,
      onboarded: true,
      defaultCubeView: { top: "white", front: "green" },
      attempts: [
        {
          id: "50000000-0000-4000-8000-000000000010",
          kind: "memo",
          trainingMode: "exec",
          durationMs: 21000,
          targets: 18,
          pairs: 9,
          correct: true,
          createdAt: "2026-11-05T01:02:00Z",
        },
      ],
      solves: [
        {
          id: "50000000-0000-4000-8000-000000000011",
          scramble: "R U F",
          memoMs: 10000,
          executionMs: 20000,
          totalMs: 30000,
          result: "success",
          memoSnapshot: {
            edges: [reconstructionPair("edge", "T", "D", "Toad")],
            corners: [reconstructionPair("corner", "O", "R", "Oar")],
          },
          edgeMemo: [],
          cornerMemo: [],
          cycleBreaks: { edges: [], corners: [] },
          schemeSnapshot: scheme,
          createdAt: "2026-11-05T01:02:00Z",
        },
      ],
    },
  );
});
async function complete(page: any) {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
  const sequences = await page
    .locator("main ol[aria-label]")
    .evaluateAll((els: Element[]) =>
      els.map((e) => e.getAttribute("aria-label")!.split(" ")),
    );
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog", { name: "Execution Sprint result" }),
  ).toBeVisible();
  return sequences;
}
test("Flashcards snap on entry and animate only subsequent card orientations, resetting on re-entry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.72;
    (window as any).__rotations = [];
    document.addEventListener(
      "transitionrun",
      (e) => {
        if (
          (e as TransitionEvent).propertyName === "transform" &&
          (e.target as Element).parentElement
            ?.getAttribute("aria-label")
            ?.startsWith("Where ")
        )
          (window as any).__rotations.push(
            (e.target as HTMLElement).style.transform,
          );
      },
      true,
    );
  });
  await page.goto("/flashcards");
  const cubes = page.locator('aside [role="group"][aria-label^="Where "]');
  await expect(cubes).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__rotations.length)).toBe(0);
  const initial = await cubes.getAttribute("aria-label");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /^Reveal/ }).click();
    await page.getByRole("button", { name: /^Remembered/ }).click();
    await page.waitForTimeout(300);
  }
  expect(
    await page.evaluate(() => (window as any).__rotations.length),
  ).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await page.evaluate(() => ((window as any).__rotations = []));
  await page.getByRole("link", { name: "Flashcards", exact: true }).click();
  await expect(cubes).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__rotations.length)).toBe(0);
  await expect(cubes.locator(":scope > div").first()).toHaveCSS(
    "transition-duration",
    "0.26s",
  );
  await page.screenshot({ path: `${out}/flashcards.png` });
});
test("Execution completion is rich, history passive, and date matches Timer exactly", async ({
  page,
}) => {
  const sequences = await complete(page);
  const dialog = page.getByRole("dialog", { name: "Execution Sprint result" });
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts[0],
  );
  expect(Object.keys(saved).sort()).toEqual(
    [
      "id",
      "kind",
      "correct",
      "trainingMode",
      "durationMs",
      "targets",
      "pairs",
      "createdAt",
    ].sort(),
  );
  await expect(dialog.getByRole("definition")).toHaveText([
    String(saved.targets),
    String(saved.pairs),
    formatTime(saved.durationMs / saved.targets),
  ]);
  const reconstruction = dialog.locator(".mt-8.border-t.pt-7");
  const displayed = await reconstruction
    .locator("ol > li > span:first-child")
    .allTextContents();
  expect(
    displayed.join("").replaceAll("cycle break at ", "").replaceAll(/\s/g, ""),
  ).toBe(sequences.flat().join(""));
  const styles = await reconstruction
    .locator("ol")
    .first()
    .getAttribute("class");
  const rowStyle = await reconstruction
    .locator("section")
    .first()
    .getAttribute("class");
  await expect(
    dialog.getByRole("button", { name: /Next|Continue/ }),
  ).toHaveCount(0);
  const close = dialog.getByRole("button", { name: /^Close/ });
  await expect(close).toBeVisible();
  const buttonClass = await close.getAttribute("class");
  const dateStyle = async (d: any) =>
    d.locator("time").evaluate((e: Element) => {
      const style = getComputedStyle(e),
        r = e.getBoundingClientRect(),
        modal = e.closest('[role="dialog"]')!.getBoundingClientRect();
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        x: Math.round((r.x - modal.x) * 1000) / 1000,
        y: Math.round((r.y - modal.y) * 1000) / 1000,
      };
    });
  const completionDate = await dateStyle(dialog);
  await expect(dialog.locator("time")).toHaveText(
    /\w{3} \d{1,2} \w{3} \d{4}, \d{2}:\d{2}/,
  );
  const shell = await dialog.evaluate((e) => ({
    width: Math.round(e.getBoundingClientRect().width * 100) / 100,
    background: getComputedStyle(e).backgroundColor,
    border: getComputedStyle(e).borderLeft,
    shadow: getComputedStyle(e).boxShadow,
  }));
  await dialog.getByRole("radio", { name: "DNF", exact: true }).click();
  await page.screenshot({ path: `${out}/completion.png` });
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();
  const history = page.getByRole("list", { name: "Attempts", exact: true });
  const rows = history.locator("[data-attempt-row]");
  await expect(rows).toHaveCount(2);
  await expect(rows.locator("svg")).toHaveCount(0);
  await expect(rows.locator('button,a,[role="button"]')).toHaveCount(0);
  await expect(
    history.getByRole("button", { name: /Execution Sprint attempt/ }),
  ).toHaveCount(0);
  const row = rows.first();
  await expect(row).toHaveCSS("cursor", "default");
  const background = await row.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await row.hover();
  await expect(row).not.toHaveCSS("background-color", background);
  await row.click();
  await expect(dialog).toHaveCount(0);
  const deleteControl = row
    .locator("..")
    .getByRole("button", { name: /Delete attempt/ });
  await expect(deleteControl).toHaveCSS("cursor", "pointer");
  await expect(deleteControl).toHaveCSS("opacity", "1");
  await deleteControl.click();
  await expect(rows).toHaveCount(1);
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(
          localStorage.getItem("cubeiq-bld-v2:guest")!,
        ).data.attempts.some((a: any) => a.id === id),
      saved.id,
    ),
  ).toBe(false);
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await history.locator("[data-attempt-row]").first().click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("link", { name: "Timer", exact: true }).click();
  await page
    .getByRole("list", { name: "Solves", exact: true })
    .getByRole("button")
    .first()
    .click();
  const timer = page.getByRole("dialog", { name: "Solve 1", exact: true });
  await expect(timer).toBeVisible();
  expect(
    await timer.evaluate((e) => ({
      width: Math.round(e.getBoundingClientRect().width * 100) / 100,
      background: getComputedStyle(e).backgroundColor,
      border: getComputedStyle(e).borderLeft,
      shadow: getComputedStyle(e).boxShadow,
    })),
  ).toEqual(shell);
  expect(
    await timer.locator(".mt-8.border-t.pt-7 ol").first().getAttribute("class"),
  ).toBe(styles);
  expect(
    await timer
      .locator(".mt-8.border-t.pt-7 section")
      .first()
      .getAttribute("class"),
  ).toBe(rowStyle);
  expect(
    await timer.getByRole("button", { name: /^Close/ }).getAttribute("class"),
  ).toBe(buttonClass);
  const timerDate = await dateStyle(timer);
  expect(timerDate.x).toBeCloseTo(completionDate.x, 1);
  expect(timerDate.y).toBeCloseTo(completionDate.y, 1);
  expect({ ...timerDate, x: 0, y: 0 }).toEqual({ ...completionDate, x: 0, y: 0 });
  await expect(
    timer.getByRole("radio", { name: "+2", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${out}/timer.png` });
});
test("Execution details keep actions visible and scroll internally on a narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await complete(page);
  const dialog = page.getByRole("dialog", { name: "Execution Sprint result" });
  await expect(
    dialog.getByRole("button", { name: "Delete attempt", exact: true }),
  ).toBeInViewport();
  await expect(dialog.getByRole("button", { name: /^Close/ })).toBeInViewport();
  expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
    true,
  );
  const header = dialog.locator(":scope > div").first();
  const result = dialog.getByRole("radiogroup", { name: "Result" });
  expect(
    (await result.boundingBox())!.y + (await result.boundingBox())!.height,
  ).toBeLessThanOrEqual(
    (await header.boundingBox())!.y + (await header.boundingBox())!.height,
  );
  await page.screenshot({ path: `${out}/phone.png` });
  await dialog.getByRole("button", { name: /^Close/ }).click();
  await expect(dialog).toHaveCount(0);
});

import { test, expect } from "@playwright/test";
import { createSpeffzScheme, stickersFor } from "../src/domain/bld/speffz";
import { pairKey, type LetterPair } from "../src/domain/letterPairs";
const scheme = createSpeffzScheme(),
  edges = stickersFor(scheme, "edge"),
  pairs: Record<string, LetterPair> = {};
const words: Record<string, string> = {
  AB: "airbag",
  AC: "acorn",
  AD: "adder",
  AF: "air force",
  AG: "alligator",
  AH: "ant hill",
  AK: "ankle",
  AL: "alien",
  AM: "ambulance",
  AN: "anchor",
  AP: "apple",
  AR: "arrow",
  AS: "astronaut",
  AT: "atlas",
  AW: "airway",
  AX: "axe",
  BA: "banana",
  BC: "bicycle",
  BD: "bird",
  BF: "butterfly",
  BG: "bagel",
  BH: "beehive",
  BL: "balloon",
  BM: "Batman",
  BN: "banana",
  BP: "bagpipe",
  BR: "bear",
  BS: "bus",
  BT: "bat",
  BW: "bow",
  CA: "cat",
  CD: "CD player",
  CF: "coffee",
  CH: "chair",
  CL: "clown",
  CP: "cup",
  CR: "crab",
  CT: "coat",
  DA: "dart",
  DG: "dog",
  DR: "dragon",
  TW: "tow",
  WC: "World Cup",
};
let n = 0;
for (const [letters, word] of Object.entries(words)) {
  const a = edges.find((s) => s.label === letters[0])!,
    b = edges.find((s) => s.label === letters[1])!;
  pairs[pairKey(a.id, b.id)] = {
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    firstStickerId: a.id,
    secondStickerId: b.id,
    firstToken: a.label,
    secondToken: b.label,
    primaryMnemonic: word,
    alternates: letters === "TW" ? ["tower"] : [],
    encounters: 0,
    forgotten: 0,
    updatedAt: "2026-09-25T00:00:00Z",
  };
}
// Isolated, explicitly fictional screenshot fixture; never written to a real user account.
test("dense matrix and long-word flashcard remain contained on mobile", async ({
  page,
}) => {
  const dense: Record<string, LetterPair> = {};
  for (const first of edges)
    for (const second of edges)
      dense[pairKey(first.id, second.id)] = {
        id: crypto.randomUUID(),
        firstStickerId: first.id,
        secondStickerId: second.id,
        firstToken: first.label,
        secondToken: second.label,
        primaryMnemonic: "ExtraordinarilyLongMnemonic".repeat(8),
        alternates: [],
        encounters: 0,
        forgotten: 0,
        updatedAt: "2026-09-25T00:00:00Z",
      };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ({ scheme, pairs }) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          revision: 0,
          dirty: false,
          data: {
            scheme,
            pairs,
            solves: [],
            attempts: [],
            onboarded: true,
            schemeUpdatedAt: "2026-09-25T00:00:00Z",
          },
        }),
      ),
    { scheme, pairs: dense },
  );
  await page.goto("/pairs");
  await expect(page.locator(".coverage")).toContainText("576");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/flashcards");
  await page.getByRole("button", { name: /^Reveal/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/v2/mobile-long-mnemonic.png",
    fullPage: true,
  });
});
test("responsive visual review and route overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    ({ scheme, pairs }) => {
      localStorage.setItem("cubeiq-theme", "light");
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          revision: 0,
          dirty: false,
          data: {
            scheme,
            pairs,
            solves: [],
            attempts: [],
            onboarded: true,
            schemeUpdatedAt: "2026-09-25T00:00:00Z",
          },
        }),
      );
    },
    { scheme, pairs },
  );
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of [
      ["timer", "/"],
      ["pairs", "/pairs"],
      ["flashcards", "/flashcards"],
      ["memo", "/memo"],
      ["settings", "/settings"],
    ]) {
      await page.goto(path);
      if (name === "timer") {
        await expect(page.getByRole("heading", { name: "Timer" })).toBeAttached();
        await expect(
          page.getByRole("button", { name: "Start timer", exact: true }),
        ).toBeEnabled({ timeout: 45000 });
        if (width > 620) {
          await page.getByRole("group", { name: "Scrambled cube" }).waitFor({ state: "visible" });
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollHeight <= window.innerHeight,
          ),
        ).toBe(true);
      } else await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/v2/${width}-${name}.png`,
        fullPage: true,
        animations:"disabled",
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pairs");
  await page.getByRole("button", { name: "T W: tow", exact: true }).click();
  await page.screenshot({ path: "docs/screenshots/v2/pair-editor.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page.screenshot({ path: "docs/screenshots/v2/dark-pairs.png" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByRole("group", { name: "Scrambled cube" }).waitFor({ state: "visible" });
  await page.screenshot({ path: "docs/screenshots/v2/1440-timer-dark.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  await page.goto("/memo");
  await page.getByRole("button", { name: "Start exercise" }).click();
  await expect(page.getByRole("button", { name: /^Ready/ })).toBeVisible({
    timeout: 45000,
  });
  await page.screenshot({ path: "docs/screenshots/v2/memo-study.png" });
  await page.getByRole("button", { name: /^Ready/ }).click();
  await page.screenshot({ path: "docs/screenshots/v2/memo-recall.png" });
  await page.getByRole("button", { name: /Check memo/ }).click();
  await page.screenshot({
    path: "docs/screenshots/v2/memo-result.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

import { test, expect, type Page } from "@playwright/test";
import type { AppData } from "../src/lib/repository";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import {
  writePairEntries,
  pairsFromStore,
} from "../src/workspace/utils/pairPersistence";

test.beforeEach(async ({ page }) => {
  const data = {
    scheme: createSpeffzScheme(),
    pairs: {},
    attempts: [],
    solves: [],
    onboarded: true,
    memoOrder: "edges-first" as const,
    m2SecondTargetSwap: true,
  } as AppData;
  data.scheme.edgeMethod = "m2";
  data.scheme.edgeBuffer = "D:DF";
  const labels = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");
  const entries = Object.fromEntries(
    labels.flatMap((a) =>
      labels.map((b) => [`${a}|${b}`, { shared: ["Apple"] }]),
    ),
  );
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      ),
    writePairEntries(data, entries),
  );
  // A legal fixture makes cycle-break selection deterministic; production generation is unchanged.
  await page.route("**/src/domain/bld/cubing.ts", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const replacement = source.replace(
      'return (await randomScrambleForEvent("333bf")).toString();',
      'return "R U F";',
    );
    expect(replacement).not.toBe(source);
    await route.fulfill({ response, body: replacement });
  });
});

async function reconstruct(page: Page, checkHelp = false) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  if (checkHelp) {
    await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(help.getByText("Confirm a cycle-break sticker or letter")).toBeVisible();
    await expect(help.getByText(/After reconstruction, click any word/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
    await expect(page.locator("[data-workspace-main]")).toBeFocused();
  } else {
    await page
      .getByRole("region", { name: "Scramble", exact: true })
      .click({ position: { x: 5, y: 5 } });
  }
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
  return popup;
}

test("Settings cube selects a visible cell on first click without moving or committing", async ({
  page,
}) => {
  const popup = await reconstruct(page, true);
  await expect(
    popup.getByRole("heading", { name: /cycle break/ }),
  ).toBeVisible();
  const cube = popup.getByRole("group", { name: "Cube at the start of memo" });
  // R leaves its own top row red; U moves that row to F and F turns it into its right column.
  await expect(cube.locator('[data-sticker-id="F2"]')).toHaveCSS(
    "background-color",
    "rgb(199, 60, 52)",
  );
  await expect(cube.locator('[data-selected="true"]')).toHaveCount(1);
  const breakGroup = popup.getByRole("radiogroup", { name: "Cycle break sticker" });
  const options = breakGroup.getByRole("radio");
  expect((await cube.locator("button[data-sticker-id]").allTextContents()).sort()).toEqual(
    (await options.allTextContents()).sort(),
  );
  await page.waitForTimeout(300);
  const id = await cube.evaluate(
    (el) =>
      [
        ...el.querySelectorAll<HTMLButtonElement>("button[data-sticker-id]"),
      ].find((button) => {
        if (button.dataset.selected === "true") return false;
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return hit && button.contains(hit);
      })?.dataset.stickerId,
  );
  expect(id).toBeTruthy();
  const transform = () =>
    cube
      .locator(":scope > div")
      .evaluate((el) => (el as HTMLElement).style.transform);
  const before = await transform();
  const cell = cube.locator(`button[data-sticker-id="${id}"]`);
  await cell.click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  expect(await transform()).toBe(before);
  await expect(
    popup.getByRole("heading", { name: /cycle break/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/reconstruction-cube-selection.png",
  });
  await cell.dblclick();
  await expect(cube.locator(`button[data-sticker-id="${id}"]`)).toHaveCount(0);
  await popup.getByRole("button", { name: "Back", exact: true }).click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await expect(
    popup.getByRole("button", { name: "Back", exact: true }),
  ).toHaveCount(0);
  const selected = options.filter({ hasText: await cell.innerText() });
  await selected.dblclick();
  await expect(cube.locator(`button[data-sticker-id="${id}"]`)).toHaveCount(0);
  await popup.getByRole("button", { name: "Back", exact: true }).click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await cube.focus();
  const angle = await transform();
  await page.keyboard.press("ArrowRight");
  await expect.poll(transform).not.toBe(angle);
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("ArrowRight");
  const arrowChoice = (await breakGroup.getByRole("radio", { checked: true }).innerText()).trim();
  expect(arrowChoice).not.toBe((await cell.innerText()).trim());
  await page.keyboard.press("Enter");
  await popup.getByRole("button", { name: "Back", exact: true }).click();
  await expect(breakGroup.getByRole("radio", { checked: true })).toHaveText(arrowChoice);
  await page.keyboard.press(arrowChoice.toLowerCase());
  await expect(cube.locator(`button[data-sticker-id="${id}"]`)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  const solves = await page.evaluate(() => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.solves);
  expect(solves).toHaveLength(1);
  expect(solves[0].reconstruction).toBe("complete");
});

for (const width of [1440, 390])
  test(`multiple word decisions use compact menus and preserve Default choices at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const popup = await reconstruct(page);
    for (
      let i = 0;
      i < 30 &&
      (await popup.getByRole("heading", { name: /cycle break/ }).count());
      i++
    )
      await popup
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    const editors = popup.getByRole("button", { name: /^Edit word used for/ });
    await expect(editors.first()).toBeVisible();
    const firstLabel = await editors.first().getAttribute("aria-label");
    await editors.first().click();
    let field = popup.getByRole("textbox", { name: /^Word used for/ });
    await field.fill("Orchard");
    await field.press("Enter");
    const second = editors;
    const secondIndex = (
      await second.evaluateAll((elements) =>
        elements.map((el) => el.getAttribute("aria-label")),
      )
    ).findIndex((label) => label !== firstLabel);
    const secondLabel = await second
      .nth(secondIndex)
      .getAttribute("aria-label");
    await second.nth(secondIndex).click();
    field = popup.getByRole("textbox", { name: /^Word used for/ });
    await field.fill("Discard me");
    await field.press("Escape");
    await expect(popup).toBeVisible();
    await expect(second.nth(secondIndex)).toContainText("Apple");
    await second.nth(secondIndex).click();
    field = popup.getByRole("textbox", { name: /^Word used for/ });
    await field.fill("Lantern");
    await field.blur();
    const updates = popup.getByRole("region", { name: "Default word updates" });
    await expect(
      updates.getByRole("heading", {
        name: "Overwrite Default words",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      updates.getByRole("button", { name: /Default word for/ }),
    ).toHaveCount(2);
    await expect(
      updates
        .getByRole("button", { name: /Default word for/ })
        .filter({ hasText: "Save as Default" }),
    ).toHaveCount(2);
    await updates
      .getByRole("button", { name: /Default word for/ })
      .filter({ hasText: "Save as Default" })
      .first()
      .click();
    const menu = page.getByRole("menu", { name: /^Default word for/ });
    const label = await menu.getAttribute("aria-label");
    const keepWord = label?.endsWith(
      firstLabel!.replace("Edit word used for ", ""),
    )
      ? "Orchard"
      : "Lantern";
    await menu
      .getByRole("menuitemradio", {
        name: "Keep Apple",
        exact: true,
      })
      .click();
    await expect(menu).toHaveCount(0);
    await page.screenshot({
      path: `test-results/reconstruction-word-decisions-${width}.png`,
    });
    expect(await popup.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await popup
      .getByRole("button", { name: "Save solve", exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    const data = await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
    );
    const pairs = pairsFromStore(data);
    const first = firstLabel!.replace("Edit word used for ", "");
    const other = secondLabel!.replace("Edit word used for ", "");
    expect(pairs[`${first[0]}|${first[1]}`]?.shared).toEqual([
      keepWord === "Orchard" ? "Apple" : "Orchard",
    ]);
    expect(pairs[`${other[0]}|${other[1]}`]?.shared).toEqual([
      keepWord === "Lantern" ? "Apple" : "Lantern",
    ]);
    expect(
      [
        ...data.solves[0].memoSnapshot.edges,
        ...data.solves[0].memoSnapshot.corners,
      ].map((item: { mnemonic: string }) => item.mnemonic),
    ).toEqual(expect.arrayContaining(["Orchard", "Lantern"]));
    await page.getByRole("list", { name: "Solves", exact: true }).getByRole("button").first().click();
    const saved = page.getByRole("dialog", { name: "Solve 1", exact: true });
    const kept = saved.locator("li").filter({ hasText: keepWord });
    await expect(kept).toContainText("now Apple");
    await expect(saved.locator("[data-solve-memo-section]").getByText("Scramble R U F", { exact: true })).toBeAttached();
    await expect(saved.locator("[data-solve-memo] h3")).toHaveText(["Edges", "Corners"]);
    await expect(saved.getByText("cycle break at", { exact: true }).first()).toBeAttached();
  });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1440, height: 640 },
  { width: 390, height: 900 },
  { width: 390, height: 640 },
])
  test(`only overwrite words scroll at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const popup = await reconstruct(page);
    const header = popup
      .getByRole("region", { name: "Solve summary", exact: true })
      .locator("../..");
    const originalHeader = await header.boundingBox();
    for (
      let i = 0;
      i < 30 &&
      (await popup.getByRole("heading", { name: /cycle break/ }).count());
      i++
    )
      await popup
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    const editors = popup.getByRole("button", { name: /^Edit word used for/ });
    await expect(editors.first()).toBeVisible();
    if (viewport.width === 390 && viewport.height === 640) {
      for (const [width, height, compact] of [
        [639, 720, true], [640, 720, false], [639, 721, false], [639, 720, true],
      ] as const) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(() => header.evaluate((el) => el.classList.contains("h-[150px]")))
          .toBe(compact);
      }
      await page.setViewportSize(viewport);
    }
    if (viewport.width >= 640) {
      const completedHeader = await header.boundingBox();
      expect(completedHeader!.height).toBeCloseTo(originalHeader!.height, 0);
      const memoTop = await popup
        .locator("[data-solve-memo]")
        .evaluate((el) => el.getBoundingClientRect().top);
      const originalGap = await popup.evaluate(
        () =>
          2 * parseFloat(getComputedStyle(document.documentElement).fontSize),
      );
      expect(
        memoTop - (completedHeader!.y + completedHeader!.height),
      ).toBeCloseTo(originalGap, 0);
    }
    const labels = [
      ...new Set(
        await editors.evaluateAll((els) =>
          els.map((el) => el.getAttribute("aria-label")!),
        ),
      ),
    ];
    for (const [index, label] of labels.entries()) {
      await popup
        .getByRole("button", { name: label, exact: true })
        .first()
        .click();
      const field = popup.getByRole("textbox", { name: /^Word used for/ });
      await field.fill(`Word ${index}`);
      await field.press("Enter");
    }
    const list = popup.getByRole("region", {
      name: "Words to overwrite",
      exact: true,
    });
    await expect(list).toBeVisible();
    const memo = popup.locator("[data-solve-memo]");
    const before = await memo.boundingBox();
    await expect
      .poll(() => list.evaluate((el) => el.clientHeight))
      .toBeGreaterThan(40);
    await expect
      .poll(() => list.evaluate((el) => el.scrollHeight > el.clientHeight))
      .toBe(true);
    await list.hover();
    await page.mouse.wheel(0, 2000);
    await expect
      .poll(() => list.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(await memo.boundingBox()).toEqual(before);
    const save = popup.getByRole("button", { name: "Save solve", exact: true });
    await expect(save).toBeInViewport();
    await expect(
      list.getByRole("button", { name: /Default word for/ }).last(),
    ).toBeInViewport();
    await page.screenshot({
      path: `test-results/reconstruction-scroll-${viewport.width}-${viewport.height}.png`,
    });
  });

for (const input of ["mouse", "Enter"] as const)
  test(`Continue spam cannot save the completed reconstruction with ${input}`, async ({
    page,
  }) => {
    const popup = await reconstruct(page);
    let continueBox;
    for (
      let i = 0;
      i < 30 &&
      (await popup.getByRole("heading", { name: /cycle break/ }).count());
      i++
    ) {
      const next = popup.getByRole("button", { name: "Continue", exact: true });
      continueBox = await next.boundingBox();
      await next.click();
    }
    const save = popup.getByRole("button", { name: "Save solve", exact: true });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    for (let i = 0; i < 10; i++) {
      if (input === "mouse")
        await page.mouse.click(
          continueBox!.x + continueBox!.width / 2,
          continueBox!.y + continueBox!.height / 2,
        );
      else await page.keyboard.down("Enter");
      await page.waitForTimeout(100);
    }
    await expect(popup).toBeVisible();
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toBeEnabled();
    if (input === "Enter") {
      // A held key must remain harmless even after the pause has elapsed.
      await page.keyboard.down("Enter");
      await expect(popup).toBeVisible();
      await page.keyboard.up("Enter");
      await expect(save).toBeEnabled();
      for (const key of ["Shift+Enter", "Alt+Enter", "Control+Enter", "Shift+Space"]) {
        await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
        await page.keyboard.press(key);
        await expect(popup).toBeVisible();
      }
      await page.keyboard.press("Enter");
    } else await save.click();
    await expect(popup).toHaveCount(0);
    const count = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.solves
          .length,
    );
    expect(count).toBe(1);
  });

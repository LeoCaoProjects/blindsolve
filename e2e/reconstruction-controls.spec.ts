import { test, expect, type Page } from "@playwright/test";
import type { AppData } from "../src/lib/repository";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import {
  writePairEntries,
  pairsFromStore,
} from "../src/magic/utils/pairPersistence";

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

async function reconstruct(page: Page) {
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
  return popup;
}

test("Settings cube selects a visible cell on first click without moving or committing", async ({
  page,
}) => {
  const popup = await reconstruct(page);
  await expect(
    popup.getByRole("heading", { name: /cycle break/ }),
  ).toBeVisible();
  const cube = popup.getByRole("group", { name: "Cube at the start of memo" });
  await expect(cube.locator('[data-selected="true"]')).toHaveCount(1);
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
  const options = popup.getByRole("radio");
  const selected = options.filter({ hasText: await cell.innerText() });
  await selected.dblclick();
  await expect(cube.locator(`button[data-sticker-id="${id}"]`)).toHaveCount(0);
  await popup.getByRole("button", { name: "Back", exact: true }).click();
  await expect(cell).toHaveAttribute("aria-pressed", "true");
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
    await field.fill("Lantern");
    await field.press("Enter");
    const updates = popup.getByRole("region", { name: "Default word updates" });
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
  });

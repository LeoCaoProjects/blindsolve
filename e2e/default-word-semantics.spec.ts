import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import type { AppData } from "../src/lib/repository";
import {
  pairsFromStore,
  writePairEntries,
} from "../src/magic/utils/pairPersistence";
const base = {
  scheme: createSpeffzScheme(),
  pairs: {},
  solves: [],
  attempts: [],
  onboarded: true,
} as AppData;
const read = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
async function seed(page: Page, data = base) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, dirty: false, revision: 0, pending: {} }),
      );
  }, data);
}
async function hold(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.down("Space");
  await page.waitForTimeout(400);
  await page.keyboard.up("Space");
}
async function assertDefault(page: Page, pair: string) {
  await page.reload();
  expect(
    pairsFromStore(await read(page))[`${pair[0]}|${pair.slice(1)}`],
  ).toEqual({ shared: ["Apple"] });
}
for (const piece of ["Edges", "Corners"]) {
  test(`Timer ${piece} reconstruction creates Default after reload`, async ({
    page,
  }) => {
    await seed(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Timer mode", exact: true }).click();
    await page.getByRole("menuitemradio", { name: piece, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await hold(page);
    await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByText("Executing", { exact: true })).toBeVisible();
    await page.waitForTimeout(30);
    await page.keyboard.press("Space");
    const popup = page.getByRole("dialog", { name: "Memo reconstruction" });
    await expect(popup).toBeVisible();
    for (
      let i = 0;
      i < 30 &&
      (await popup
        .getByRole("textbox", { name: /^Word you used for/ })
        .count()) === 0;
      i++
    ) {
      const continueButton = popup.getByRole("button", { name: /^Continue/ });
      if (!(await continueButton.count())) break;
      await continueButton.click();
    }
    const input = popup.getByRole("textbox", { name: /^Word you used for/ });
    await expect(input).toBeVisible();
    const pair = (await input.getAttribute("aria-label"))!.replace(
      "Word you used for ",
      "",
    );
    await input.fill("Apple");
    await popup
      .getByRole("button", { name: /Skip to save|Save solve/ })
      .click();
    await expect(popup).toHaveCount(0);
    expect((await read(page)).solves).toHaveLength(1);
    await assertDefault(page, pair);
  });
  test(`Memo Recall ${piece} creation writes only Default`, async ({
    page,
  }) => {
    await seed(page);
    await page.goto("/training");
    await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
    await page.getByRole("radio", { name: piece, exact: true }).click();
    await expect(
      page.locator("[data-training-region][data-transitioning=true]"),
    ).toHaveCount(0);
    await hold(page);
    await expect(
      page.getByRole("timer", { name: "Memorisation" }),
    ).toBeVisible();
    const sequences = await page
      .locator("[data-training-targets] ol[aria-label]")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-label")!.split(" ").join("")),
      );
    await page.keyboard.press("Space");
    const answers = page.getByRole("textbox", {
      name: /Recall (corners|edges)/,
    });
    for (let i = 0; i < sequences.length; i++) {
      await answers.nth(i).fill(sequences[i]);
      await answers.nth(i).press("Enter");
    }
    const popup = page.getByRole("dialog", {
      name: "Memo Recall review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    const input = popup.getByRole("textbox", { name: /^Word for/ }).first();
    const pair = (await input.getAttribute("aria-label"))!.replace(
      "Word for ",
      "",
    );
    await input.fill("Apple");
    await popup.getByRole("button", { name: /^Save/ }).click();
    await expect(popup).toHaveCount(0);
    expect((await read(page)).attempts).toHaveLength(1);
    await assertDefault(page, pair);
  });
}
test("Flashcards ordinary editing preserves both explicit overrides", async ({
  page,
}) => {
  const data = writePairEntries(base, {
    "A|B": { shared: ["Apple"], edges: ["Arrow"], corners: ["Castle"] },
  });
  await seed(page, data);
  await page.goto("/flashcards");
  await page.getByRole("button", { name: /^Reveal/ }).click();
  await expect(
    page.getByText(/^(Arrow|Castle)$/, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Edit/ }).click();
  await page.getByRole("textbox", { name: "Word", exact: true }).fill("Anchor");
  await page.getByRole("button", { name: /^Save as default/ }).click();
  await page.reload();
  expect(pairsFromStore(await read(page))["A|B"]).toEqual({
    shared: ["Anchor"],
    edges: ["Arrow"],
    corners: ["Castle"],
  });
});
test("pair jumps work across route entry, navigation focus, editor close and history", async ({
  page,
}) => {
  await seed(
    page,
    writePairEntries(base, { "A|B": { shared: ["Apple"], edges: ["Arrow"] } }),
  );
  await page.goto("/pairs");
  const jump = async (pair: string) => {
    await page.keyboard.type(pair);
    await expect(
      page.getByRole("gridcell", { name: new RegExp(`^${pair},`) }),
    ).toBeFocused();
  };
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await jump("AB");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with A", exact: true }),
  ).toBeVisible();
  for (const route of ["Timer", "Training", "Flashcards"]) {
    await page
      .getByRole("navigation", { name: "Sections", exact: true })
      .getByRole("link", { name: route, exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Sections", exact: true })
      .getByRole("link", { name: "Letter Pairs", exact: true })
      .click();
    await expect(page.getByRole("heading",{name:"Pairs starting with A",exact:true})).toBeVisible();
    await jump("AB");
  }
  await page.getByRole("radio", { name: "Overrides", exact: true }).click();
  await jump("AB");
  await page.getByRole("button", { name: /^C, / }).click();
  await page.keyboard.type("AB");
  await expect(page.getByRole("gridcell", { name: /^AB,/ })).toBeFocused();
  await page.keyboard.press("Enter");
  const popup = page.getByRole("dialog", { name: "Pair AB", exact: true });
  await expect(
    popup.getByText("Used for both Edges and Corners", { exact: true }),
  ).toBeVisible();
  await popup
    .getByRole("textbox", { name: "Default word", exact: true })
    .fill("AB typing stays here");
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await jump("AB");
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .getByRole("link", { name: "Timer", exact: true })
    .click();
  await page.goBack();
  await jump("AB");
  await page.goForward();
  await page.goBack();
  await jump("AB");
});
test("partial jump expires and resets on editor, input, view and route changes", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/pairs");
  await page.keyboard.type("A");
  await page.waitForTimeout(1000);
  await page.keyboard.type("B");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^A, / }).click();
  await page.keyboard.type("A");
  await page.getByRole("gridcell", { name: /^AC,/ }).click();
  const popup = page.getByRole("dialog", { name: "Pair AC", exact: true });
  await popup
    .getByRole("textbox", { name: "Default word", exact: true })
    .fill("B");
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await page.keyboard.type("B");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
  await page.keyboard.type("A");
  await page.getByRole("radio", { name: "Overrides", exact: true }).click();
  await page.keyboard.type("B");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Default", exact: true }).click();
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.setAttribute("aria-label", "Search safety probe");
    document.querySelector("main")!.append(input);
    input.focus();
  });
  await page.keyboard.type("AC");
  await expect(
    page.getByRole("textbox", { name: "Search safety probe" }),
  ).toHaveValue("AC");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search safety probe" })
    .evaluate((el) => el.remove());
  await page.keyboard.type("A");
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .getByRole("link", { name: "Timer", exact: true })
    .click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .getByRole("link", { name: "Letter Pairs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pairs starting with A", exact: true }),
  ).toBeVisible();
  await page.keyboard.type("B");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
});

import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { resolveWords } from "../src/magic/utils/pairs";
import {
  pairsFromStore,
  writePairEntries,
} from "../src/magic/utils/pairPersistence";
import type { AppData } from "../src/lib/repository";
const fixture = writePairEntries(
  {
    scheme: createSpeffzScheme(),
    pairs: {},
    solves: [],
    attempts: [],
    onboarded: true,
    pairSharing: "separate",
    preferencesUpdatedAt: "2026-11-07T00:00:00.000Z",
  } as AppData,
  {
    "A|B": {
      shared: ["Apple", "Apricot"],
      edges: ["Arrow"],
      corners: ["Castle"],
    },
    "A|D": { shared: ["Airport"] },
    "A|E": { shared: ["Atlas"] },
    "A|F": {
      shared: [
        "A very long word that should remain readable without pushing the pair or controls off screen",
      ],
    },
  },
  "2026-11-07T01:00:00.000Z",
);
async function seed(page: Page) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
      );
  }, fixture);
  await page.goto("/pairs");
}
async function choose(page: Page, label: string) {
  const trigger = page.getByRole("button", {
    name: "Letter Pairs navigation",
    exact: true,
  });
  if (await trigger.isVisible()) await trigger.click();
  await page
    .getByRole("radiogroup", { name: "Vocabulary", exact: true })
    .getByRole("radio", { name: label, exact: true })
    .click();
  const navigation = page.getByRole("dialog", {
    name: "Letter Pairs navigation",
    exact: true,
  });
  if (await navigation.isVisible())
    await navigation
      .getByRole("button", { name: "Close", exact: true })
      .click();
  await expect(
    page.getByRole("dialog", { name: "Letter Pairs navigation", exact: true }),
  ).toHaveCount(0);
}
const row = (page: Page, pair: string) =>
  page.getByRole("gridcell", { name: new RegExp(`^${pair},`) });
async function editor(page: Page, pair = "AB") {
  await row(page, pair).click();
  const modal = page.getByRole("dialog", { name: `Pair ${pair}`, exact: true });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveCSS("transform", "none");
  await expect(modal.locator("..")).toHaveCSS("opacity", "1");
  return modal;
}

test("Default is primary; Overrides lists only exceptions and keeps letter navigation", async ({
  page,
}) => {
  await seed(page);
  const nav = page.locator("[data-subnav-column]");
  await expect(
    nav.getByRole("radio", { name: "Default", exact: true }),
  ).toBeChecked();
  await expect(nav.getByRole("radio")).toHaveCount(2);
  await expect(row(page, "AB")).toContainText("Apple");
  await expect(row(page, "AB")).toContainText("2 overrides");
  await expect(row(page, "AD")).not.toContainText(/missing|override/i);
  await expect(row(page, "AD")).toHaveCSS("cursor", "pointer");
  const old = await row(page, "AD").evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await row(page, "AD").hover();
  await expect(row(page, "AD")).not.toHaveCSS("background-color", old);
  await choose(page, "Overrides");
  await expect(page.getByRole("gridcell")).toHaveCount(1);
  await expect(row(page, "AB")).toContainText("Arrow");
  await expect(row(page, "AB")).toContainText("Castle");
  await expect(row(page, "AD")).toHaveCount(0);
  await page.screenshot({ path: "test-results/pairs-overrides-desktop.png" });
  await row(page, "AB").click();
  let modal = page.getByRole("dialog", { name: "Pair AB", exact: true });
  await expect(
    modal.getByRole("textbox", { name: "Default word", exact: true }),
  ).toHaveValue("Apple");
  await expect(
    modal.getByRole("textbox", { name: "Edge override", exact: true }),
  ).toHaveValue("Arrow");
  await expect(
    modal.getByRole("textbox", { name: "Corner override", exact: true }),
  ).toHaveValue("Castle");
  await expect(modal.locator("..")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/pairs-unified-editor.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^B, / }).click();
  await expect(page.getByText("No overrides", { exact: true })).toBeVisible();
  await choose(page, "Default");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with B", exact: true }),
  ).toBeVisible();
  await row(page, "BA").focus();
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "BC")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(row(page, "BA")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(row(page, "BN")).toBeFocused();
  await choose(page, "Overrides");
  await page
    .getByRole("combobox", { name: "Add override", exact: true })
    .selectOption("0");
  modal = page.getByRole("dialog", { name: "Pair BA", exact: true });
  await expect(modal.getByRole("textbox", { name: /override/i })).toHaveCount(
    0,
  );
  await expect(
    modal.getByRole("button", { name: "Add edge override", exact: true }),
  ).toBeVisible();
  await modal
    .getByRole("button", { name: "Add edge override", exact: true })
    .click();
  await modal
    .getByRole("textbox", { name: "Edge override", exact: true })
    .fill("Boat");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row(page, "BA")).toContainText("Boat");
  const column = await nav.boundingBox();
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await expect(
    nav.getByRole("heading", { name: "Training", exact: true }),
  ).toBeVisible();
  expect(await nav.boundingBox()).toEqual(column);
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .getByRole("link", { name: "Letter Pairs", exact: true })
    .click();
  await expect(
    nav.getByRole("radio", { name: "Default", exact: true }),
  ).toBeChecked();
  await expect(
    nav
      .getByRole("navigation", { name: "First letter", exact: true })
      .getByRole("button"),
  ).toHaveCount(24);
  await expect(page.locator("[data-page-workspace]")).toHaveCSS(
    "transform",
    "none",
  );
  await page.screenshot({ path: "test-results/pairs-default-desktop.png" });
});

test("One Save edits Default and both optional overrides; Use default removes only its exception", async ({
  page,
}) => {
  await seed(page);
  let modal = await editor(page, "AD");
  const input = modal.getByRole("textbox", {
    name: "Default word",
    exact: true,
  });
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.pairs,
  );
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.pairs,
    ),
  ).toEqual(original);
  modal = await editor(page, "AD");
  await expect(input).toHaveValue("Airport");
  const before = await input.boundingBox(),
    footer = await modal.locator("footer").boundingBox();
  await input.fill("Air");
  await input.press("Space");
  await input.pressSequentially("port");
  await expect(input).toHaveValue("Air port");
  expect(await input.boundingBox()).toEqual(before);
  expect(await modal.locator("footer").boundingBox()).toEqual(footer);
  await modal
    .getByRole("button", { name: "Add edge override", exact: true })
    .click();
  await modal
    .getByRole("textbox", { name: "Edge override", exact: true })
    .fill("Arrow");
  await modal
    .getByRole("button", { name: "Add corner override", exact: true })
    .click();
  await modal
    .getByRole("textbox", { name: "Corner override", exact: true })
    .fill("Castle");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  modal = await editor(page, "AD");
  await expect(input).toHaveValue("Air port");
  await expect(
    modal.getByRole("textbox", { name: "Edge override", exact: true }),
  ).toHaveValue("Arrow");
  await expect(
    modal.getByRole("textbox", { name: "Corner override", exact: true }),
  ).toHaveValue("Castle");
  await modal
    .getByRole("region", { name: "Edge override", exact: true })
    .getByRole("button", { name: "Use default", exact: true })
    .click();
  await expect(
    modal.getByRole("textbox", { name: "Edge override", exact: true }),
  ).toHaveCount(0);
  await expect(input).toHaveValue("Air port");
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  const entry = pairsFromStore(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
    ),
  )["A|D"];
  expect(entry).toEqual({ shared: ["Air port"], corners: ["Castle"] });
  expect(resolveWords(entry, "edges").words).toEqual(["Air port"]);
});

test("Default retains alternates, suggestions, Enter and safe Escape", async ({
  page,
}) => {
  await seed(page);
  let modal = await editor(page);
  await modal
    .getByRole("button", {
      name: "Alternative words for default word",
      exact: true,
    })
    .click();
  const tools = page.getByRole("dialog", {
    name: "Alternative words for default word",
    exact: true,
  });
  const alternate = tools.getByRole("textbox", {
    name: "Add alternate",
    exact: true,
  });
  await alternate.fill("Anchor");
  await alternate.press("Enter");
  await expect(
    tools.getByRole("button", { name: "Anchor", exact: true }),
  ).toBeVisible();
  await tools.getByRole("button", { name: "Apricot", exact: true }).click();
  await expect(
    modal.getByRole("textbox", { name: "Default word", exact: true }),
  ).toHaveValue("Apricot");
  await tools
    .getByRole("button", { name: "Remove Apple", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(tools).toHaveCount(0);
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row(page, "AB")).toContainText("Apricot");
  modal = await editor(page, "AC");
  await modal
    .getByRole("button", {
      name: "Suggest words for default word",
      exact: true,
    })
    .click();
  const suggestions = page.getByRole("dialog", {
    name: "Suggestions for AC",
    exact: true,
  });
  await suggestions.getByRole("list").getByRole("button").first().click();
  await expect(suggestions).toHaveCount(0);
  await expect(
    modal.getByRole("textbox", { name: "Default word", exact: true }),
  ).not.toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(row(page, "AC")).toContainText("No word");
});

for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test(`Default and optional overrides remain usable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await seed(page);
    await choose(page, "Overrides");
    const modal = await editor(page);
    await expect(
      modal.getByRole("textbox", { name: "Default word", exact: true }),
    ).toHaveValue("Apple");
    await expect(
      modal.getByRole("button", { name: "Save", exact: true }),
    ).toBeInViewport();
    const input = modal.getByRole("textbox", {
      name: "Default word",
      exact: true,
    });
    await input.fill("Apple test");
    await input.press("Space");
    await expect(modal).toBeVisible();
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/pairs-unified-editor-${width}.png`,
    });
    await modal
      .getByRole("textbox", { name: "Corner override", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      modal.getByRole("textbox", { name: "Corner override", exact: true }),
    ).toBeInViewport();
    await expect(
      modal.getByRole("button", { name: "Save", exact: true }),
    ).toBeInViewport();
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await choose(page, "Default");
    await expect(row(page, "AB")).toContainText("Apple test");
    await page
      .getByRole("button", { name: "Letter Pairs navigation", exact: true })
      .click();
    const nav = page.getByRole("dialog", {
      name: "Letter Pairs navigation",
      exact: true,
    });
    await nav.getByRole("button", { name: /^X, / }).click();
    await choose(page, "Overrides");
    await expect(
      page.getByRole("heading", { name: "Pairs starting with X", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No overrides", { exact: true })).toBeVisible();
  });

test("Desktop native zoom preserves pair columns and contextual navigation", async () => {
  const { nativeBrowser } =
    await import("../scripts/native-browser-session.mjs");
  const native = await nativeBrowser("chrome");
  try {
    const page = native.page as Page;
    await page.addInitScript(
      (data) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
        ),
      fixture,
    );
    await native.resize(1440, 900);
    await native.navigate(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5186"}/pairs`,
    );
    const geometry = () =>
      page.evaluate(() => {
        const dpr = window.devicePixelRatio;
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * dpr));
        };
        return {
          subnav: box(document.querySelector("[data-subnav-column]")!),
          rows: [
            ...document.querySelectorAll("[data-pair-grid] [role=gridcell]"),
          ].map(box),
        };
      });
    const before = await geometry();
    await native.zoom(1.5);
    const after = await geometry();
    expect(after.rows.length).toBe(before.rows.length);
    for (let i = 0; i < after.rows.length; i++)
      for (let j = 0; j < 4; j++)
        expect(
          Math.abs(after.rows[i][j] - before.rows[i][j]),
        ).toBeLessThanOrEqual(3);
    for (let j = 0; j < 4; j++)
      expect(Math.abs(after.subnav[j] - before.subnav[j])).toBeLessThanOrEqual(
        3,
      );
    await native.screenshot("test-results/pairs-native150.png");
  } finally {
    await native.close();
  }
});

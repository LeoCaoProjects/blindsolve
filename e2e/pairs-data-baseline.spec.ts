import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((scheme) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
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
      );
  }, createSpeffzScheme());
  await page.goto("/pairs");
  await selectA(page);
});
async function selectA(page: Page) {
  await page.getByRole("button", { name: /^A, \d+ of \d+ filled$/ }).click();
}
const cell = (page: Page) => page.getByRole("gridcell", { name: /^AB,/ });
async function scope(page: Page, value: string) {
  await page
    .getByRole("radiogroup", { name: "Vocabulary", exact: true })
    .getByRole("radio", { name: value, exact: true })
    .click();
}
async function edit(page: Page, value: string, word: string) {
  await scope(page, value);
  await cell(page).click();
  const editor = page.getByRole("dialog", { name: "Pair AB", exact: true });
  const start = editor.getByRole("button", {
    name: `Different word for ${value.toLowerCase()}`,
    exact: true,
  });
  if (await start.isVisible()) await start.click();
  await editor.getByRole("textbox", { name: "Word", exact: true }).fill(word);
  await editor.getByRole("button", { name: /^Save/ }).click();
  await expect(editor).toHaveCount(0);
}
async function persisted(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!),
  );
}
async function reloadAndCheck(
  page: Page,
  expected: { Shared: string; Edges: string; Corners: string },
) {
  const before = await persisted(page);
  await page.reload();
  await selectA(page);
  for (const [value, word] of Object.entries(expected)) {
    await scope(page, value);
    await expect(cell(page).locator("span[title]").first()).toHaveText(word);
  }
  const after = await persisted(page);
  expect(after.data.pairs).toEqual(before.data.pairs);
  expect(after.pending).toEqual(before.pending);
  expect(Object.keys(after.data.pairs)).toHaveLength(2);
}
async function removeOverride(page: Page, value: "Edges" | "Corners") {
  await scope(page, value);
  await cell(page).click();
  const editor = page.getByRole("dialog", { name: "Pair AB", exact: true });
  await editor
    .getByRole("button", { name: "Use shared instead", exact: true })
    .click();
  await editor.getByRole("button", { name: /^Save/ }).click();
  await expect(editor).toHaveCount(0);
}
test("Shared, Edge/Corner overrides, edits and removals survive UI save and reload", async ({
  page,
}) => {
  await edit(page, "Shared", "Apple");
  await reloadAndCheck(page, {
    Shared: "Apple",
    Edges: "Apple",
    Corners: "Apple",
  });
  await edit(page, "Edges", "Arrow");
  await reloadAndCheck(page, {
    Shared: "Apple",
    Edges: "Arrow",
    Corners: "Apple",
  });
  await edit(page, "Corners", "Castle");
  await reloadAndCheck(page, {
    Shared: "Apple",
    Edges: "Arrow",
    Corners: "Castle",
  });
  await edit(page, "Shared", "Anchor");
  await reloadAndCheck(page, {
    Shared: "Anchor",
    Edges: "Arrow",
    Corners: "Castle",
  });
  await edit(page, "Edges", "Axe");
  await reloadAndCheck(page, {
    Shared: "Anchor",
    Edges: "Axe",
    Corners: "Castle",
  });
  await edit(page, "Corners", "Church");
  await reloadAndCheck(page, {
    Shared: "Anchor",
    Edges: "Axe",
    Corners: "Church",
  });
  await removeOverride(page, "Edges");
  await reloadAndCheck(page, {
    Shared: "Anchor",
    Edges: "Anchor",
    Corners: "Church",
  });
  await removeOverride(page, "Corners");
  await reloadAndCheck(page, {
    Shared: "Anchor",
    Edges: "Anchor",
    Corners: "Anchor",
  });
  await page.screenshot({ path: "test-results/pairs-persistence-fixed.png" });
});
test("Shared plus Corner alone retains inherited Edge and does not create an Edge override", async ({
  page,
}) => {
  await edit(page, "Shared", "Apple");
  await edit(page, "Corners", "Castle");
  await reloadAndCheck(page, {
    Shared: "Apple",
    Edges: "Apple",
    Corners: "Castle",
  });
  const data = (await persisted(page)).data;
  const edge = Object.values(data.pairs).find(
    (p: any) => data.scheme.stickers[p.firstStickerId].pieceType === "edge",
  ) as any;
  expect(edge.vocabulary.override).toBeUndefined();
  await scope(page, "Edges");
  await cell(page).click();
  await expect(
    page.getByRole("dialog", { name: "Pair AB", exact: true }),
  ).toContainText("Uses shared");
});

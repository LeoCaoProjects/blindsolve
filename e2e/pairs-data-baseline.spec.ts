import { test, expect, type Page } from "@playwright/test";
import { pairsFromStore } from "../src/magic/utils/pairPersistence";
import { resolveWords } from "../src/magic/utils/pairs";
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
async function edit(page: Page, value: string, word: string) {
  await cell(page).click();
  const editor = page.getByRole("dialog", { name: "Pair AB", exact: true });
  const field =
    value === "Shared"
      ? "Default word"
      : value === "Edges"
        ? "Edge override"
        : "Corner override";
  const input = editor.getByRole("textbox", { name: field, exact: true });
  if (!(await input.isVisible()))
    await editor
      .getByRole("button", {
        name: value === "Edges" ? "Add edge override" : "Add corner override",
        exact: true,
      })
      .click();
  await input.fill(word);
  await editor.getByRole("button", { name: "Save", exact: true }).click();
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
  await expect(cell(page).locator("span[title]").first()).toHaveText(
    expected.Shared,
  );
  const decoded = pairsFromStore((await persisted(page)).data)["A|B"];
  for (const [scope, word] of [
    ["shared", expected.Shared],
    ["edges", expected.Edges],
    ["corners", expected.Corners],
  ] as const)
    expect(resolveWords(decoded, scope).words[0]).toBe(word);
  const after = await persisted(page);
  expect(after.data.pairs).toEqual(before.data.pairs);
  expect(after.pending).toEqual(before.pending);
  expect(Object.keys(after.data.pairs)).toHaveLength(2);
}
async function removeOverride(page: Page, value: "Edges" | "Corners") {
  await cell(page).click();
  const editor = page.getByRole("dialog", { name: "Pair AB", exact: true });
  await editor
    .getByRole("region", {
      name: value === "Edges" ? "Edge override" : "Corner override",
      exact: true,
    })
    .getByRole("button", { name: "Use default", exact: true })
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
  await cell(page).click();
  await expect(
    page
      .getByRole("dialog", { name: "Pair AB", exact: true })
      .getByRole("button", { name: "Add edge override", exact: true }),
  ).toBeVisible();
});

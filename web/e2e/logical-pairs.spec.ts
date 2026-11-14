import { test, expect, type Page } from "@playwright/test";
import type { AppData } from "../src/data/model";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { writePairEntries } from "../src/workspace/utils/pairPersistence";

async function seed(page: Page, custom: boolean) {
  let data = {
    scheme: createSpeffzScheme(),
    pairs: {},
    attempts: [],
    solves: [],
    onboarded: true,
  } as AppData;
  if (custom) {
    // U0 is the initially selected corner. Leave T active only in Corners.
    for (const sticker of Object.values(data.scheme.stickers)) {
      if (sticker.pieceType === "edge" && sticker.label === "T")
        sticker.label = "ET";
      if (sticker.pieceType === "corner") {
        if (sticker.label === "A") sticker.label = "T";
        else if (sticker.label === "T") sticker.label = "A";
      }
    }
  }
  data = writePairEntries(data, {
    "T|B": { shared: ["Tub"], edges: ["Timber"], corners: ["Tower"] },
    "SH|B": { shared: ["Old ship"] },
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({ data, revision: 0, dirty: false }),
      );
  }, data);
}
const stored = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
const rail = (page: Page, label: string) =>
  page.getByRole("button", {
    name: new RegExp(`^${label}, \\d+ of \\d+ filled$`),
  });
const row = (page: Page, pair: string) =>
  page.getByRole("gridcell", { name: new RegExp(`^${pair},`) });
async function lettering(page: Page) {
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .getByRole("radiogroup", { name: "Cube mode", exact: true })
    .getByRole("radio", { name: "Lettering", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Your cube", exact: true })
    .locator('[data-sticker-id="U0"]')
    .click();
  return page.getByRole("textbox", { name: "Letter", exact: true });
}

test("guest relabel/edit/reload/revert preserves logical words and custom navigation boundaries", async ({
  page,
}) => {
  let remoteRequests = 0;
  await page.route(/supabase\.(co|in)/, async (route) => {
    remoteRequests++;
    await route.abort();
  });
  await seed(page, true);
  await page.goto("/pairs");
  const original = await stored(page);
  const field = await lettering(page);
  await expect(field).toHaveValue("T");
  await field.fill("SH");
  await page.getByRole("link", { name: "Letter Pairs", exact: true }).click();
  await expect(rail(page, "T")).toHaveCount(0);
  await rail(page, "SH").click();
  await expect(row(page, "SHB")).toContainText("Old ship");
  await expect(row(page, "SHET")).toHaveCount(0); // No Edge-only/Corner-only cross product.
  expect((await stored(page)).logicalPairs).toEqual(original.logicalPairs);
  await row(page, "SHB").focus();
  await page.keyboard.type("ab");
  await expect(
    page.getByRole("grid", { name: "Pairs starting A", exact: true }),
  ).toBeVisible();
  await expect(row(page, "AB")).toBeFocused();
  await page.keyboard.type("sh");
  await expect(row(page, "SH")).toBeFocused(); // S + H, not the custom SH label.
  await rail(page, "SH").click();
  await row(page, "SHB").click();
  const popup = page.getByRole("dialog", { name: "Pair SHB", exact: true });
  await expect(
    popup.getByRole("textbox", { name: "Edge override", exact: true }),
  ).toBeDisabled();
  await popup
    .getByRole("textbox", { name: "Default word", exact: true })
    .fill("Ship");
  await popup.getByRole("button", { name: "Save", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.reload();
  await rail(page, "SH").click();
  await expect(row(page, "SHB")).toContainText("Ship");
  const revert = await lettering(page);
  await expect(revert).toHaveValue("SH");
  await revert.fill("T");
  await page.getByRole("link", { name: "Letter Pairs", exact: true }).click();
  await page.reload();
  await expect(rail(page, "SH")).toHaveCount(0);
  await rail(page, "T").click();
  await expect(row(page, "TB")).toContainText("Tub");
  await row(page, "TB").click();
  const restored = page.getByRole("dialog", { name: "Pair TB", exact: true });
  await expect(
    restored.getByRole("textbox", { name: "Corner override", exact: true }),
  ).toHaveValue("Tower");
  const saved = await stored(page);
  expect(saved.pairs).toEqual(original.pairs);
  expect(
    Object.values((saved as AppData).logicalPairs ?? {}).find((r) => r.firstToken === "SH"),
  ).toMatchObject({ primaryMnemonic: "Ship" });
  await page.screenshot({
    path: test.info().outputPath("restored-logical-pair.png"),
  });
  expect(remoteRequests).toBe(0);
});

test("standard single-character two-key navigation still jumps to the pair", async ({
  page,
}) => {
  await seed(page, false);
  await page.goto("/pairs");
  await expect(page.getByRole("heading", { name: "Pairs starting with A", exact: true })).toBeVisible();
  await page.keyboard.type("tb");
  await expect(
    page.getByRole("grid", { name: "Pairs starting T", exact: true }),
  ).toBeVisible();
  await expect(row(page, "TB")).toBeFocused();
  await expect(row(page, "TB")).toContainText("Tub");
});

import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import {
  pairsFromStore,
  writePairEntries,
} from "../src/magic/utils/pairPersistence";
import type { AppData } from "../src/lib/repository";
const data = writePairEntries(
  {
    scheme: createSpeffzScheme(),
    pairs: {},
    solves: [],
    attempts: [],
    onboarded: true,
  } as AppData,
  { "A|B": { shared: ["Apple"] } },
  "2026-11-08T00:00:00.000Z",
);
for (const [width, height] of [
  [1440, 900],
  [320, 568],
])
  test(`Pair editor geometry stays fixed across every tool at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript((seed) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: seed,
            revision: 0,
            dirty: false,
            pending: {},
          }),
        );
    }, data);
    await page.goto("/pairs");
    await page.getByRole("gridcell", { name: /^AB,/ }).click();
    const modal = page.getByRole("dialog", { name: "Pair AB", exact: true });
    await expect(modal).toHaveCSS("transform", "none");
    await expect(modal.locator("..")).toHaveCSS("opacity", "1");
    const geometry = async () =>
      Promise.all([
        modal.boundingBox(),
        modal.locator("header").boundingBox(),
        modal.locator("footer").boundingBox(),
      ]);
    const original = await geometry();
    const stable = async () => expect(await geometry()).toEqual(original);
    const rowHeight = await modal
      .locator('[data-override-row="edges"]')
      .evaluate((el) => el.getBoundingClientRect().height);
    const defaultInput = modal.getByRole("textbox", {
      name: "Default word",
      exact: true,
    });
    await expect(defaultInput).toBeFocused();
    await defaultInput.fill("Apple pie");
    await defaultInput.press("Space");
    await expect(defaultInput).toHaveValue("Apple pie ");
    await stable();
    const suggest = (name: string) =>
      modal.getByRole("button", {
        name: `Suggest words for ${name}`,
        exact: true,
      });
    let menu = page.getByRole("dialog", {
      name: "Suggestions for AB",
      exact: true,
    });
    await suggest("default word").click();
    await expect(menu).toBeVisible();
    await stable();
    await page.keyboard.press("ArrowDown");
    const selected = await menu
      .getByRole("list")
      .getByRole("button")
      .first()
      .innerText();
    await menu.getByRole("list").getByRole("button").first().click();
    await expect(defaultInput).toHaveValue(selected);
    await expect(menu).toHaveCount(0);
    await stable();
    await modal
      .getByRole("button", { name: "Add edge override", exact: true })
      .click();
    await stable();
    expect(
      await modal
        .locator('[data-override-row="edges"]')
        .evaluate((el) => el.getBoundingClientRect().height),
    ).toBe(rowHeight);
    const edge = modal.getByRole("textbox", {
      name: "Edge override",
      exact: true,
    });
    await expect(edge).toBeFocused();
    await suggest("edge override").click();
    await stable();
    await expect(menu).toHaveCount(1);
    const edgeWord = await menu
      .getByRole("list")
      .getByRole("button")
      .nth(1)
      .innerText();
    await menu.getByRole("list").getByRole("button").nth(1).click();
    await expect(edge).toHaveValue(edgeWord);
    await expect(defaultInput).toHaveValue(selected);
    await stable();
    await modal
      .getByRole("button", { name: "Add corner override", exact: true })
      .click();
    await stable();
    const corner = modal.getByRole("textbox", {
      name: "Corner override",
      exact: true,
    });
    const controls = await Promise.all(
      [defaultInput, edge, corner].map((input) =>
        input.evaluate((el) => {
          const s = getComputedStyle(el);
          return [
            s.height,
            s.fontSize,
            s.borderRadius,
            s.paddingLeft,
            s.paddingRight,
          ];
        }),
      ),
    );
    expect(controls[1]).toEqual(controls[0]);
    expect(controls[2]).toEqual(controls[0]);
    await suggest("default word").focus();
    await suggest("default word").press("Enter");
    await expect(menu).toHaveCount(1);
    await stable();
    await suggest("corner override").focus();
    await suggest("corner override").press("Enter");
    await expect(menu).toHaveCount(1);
    await stable();
    await menu.getByRole("list").getByRole("button").first().click();
    await expect(corner).toHaveValue(selected);
    await stable();
    await suggest("default word").focus();
    await suggest("default word").press("Enter");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(modal).toBeVisible();
    await stable();
    await suggest("default word").click();
    await modal.locator("header").click();
    await expect(menu).toHaveCount(0);
    await stable();
    await modal
      .getByRole("region", { name: "Edge override", exact: true })
      .getByRole("button", { name: "Use default", exact: true })
      .click();
    await expect(edge).toHaveCount(0);
    await stable();
    await modal
      .getByRole("region", { name: "Corner override", exact: true })
      .getByRole("button", { name: "Use default", exact: true })
      .click();
    await expect(corner).toHaveCount(0);
    await stable();
    await modal
      .getByRole("button", {
        name: "Alternative words for default word",
        exact: true,
      })
      .click();
    const alternatives = page.getByRole("dialog", {
      name: "Alternative words for default word",
      exact: true,
    });
    await expect(alternatives).toBeVisible();
    await stable();
    const alt = alternatives.getByRole("textbox", {
      name: "Add alternate",
      exact: true,
    });
    await alt.fill("Anchor point");
    await alt.press("Space");
    await expect(alt).toHaveValue("Anchor point ");
    await alt.press("Enter");
    await expect(
      alternatives.getByRole("button", { name: "Anchor point", exact: true }),
    ).toBeVisible();
    await stable();
    await alternatives
      .getByRole("button", { name: "Anchor point", exact: true })
      .click();
    await expect(defaultInput).toHaveValue("Anchor point");
    await stable();
    await page.keyboard.press("Escape");
    await expect(alternatives).toHaveCount(0);
    await stable();
    await expect(
      modal.getByRole("button", { name: "Save", exact: true }),
    ).toBeInViewport();
    await page.screenshot({
      path: `test-results/pairs-stable-editor-${width}.png`,
    });
    await modal.getByRole("button", { name: "Save", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    const entry = pairsFromStore(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
      ),
    )["A|B"];
    expect(entry.shared).toEqual(["Anchor point", selected]);
    expect(entry.edges).toBeUndefined();
    expect(entry.corners).toBeUndefined();
  });

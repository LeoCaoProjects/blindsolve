import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

async function seed(page: Page) {
  await page.addInitScript((scheme) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            solves: [],
            attempts: [],
            defaultCubeView: { top: "white", front: "green" },
          },
          dirty: false,
          revision: 0,
        }),
      );
  }, createSpeffzScheme());
  await page.goto("/settings");
}
const data = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
const tab = async (page: Page, name: string) => {
  await page
    .getByRole("radiogroup", { name: "Cube mode", exact: true })
    .getByRole("radio", { name, exact: true })
    .click();
  if (name === "Lettering")
    await page
      .getByRole("group", { name: "Your cube", exact: true })
      .locator('[data-sticker-id="U0"]')
      .click();
};
const status = (page: Page) =>
  page.getByRole("status", { name: "Setup save status" });
const draft = (page: Page) =>
  page.evaluate(() =>
    localStorage.getItem("blindsolve-settings-draft-v1:guest"),
  );

test("unfinished legacy setup history loads intact and autosaving stays silent", async ({
  page,
}) => {
  const scheme = createSpeffzScheme();
  const archived = structuredClone(scheme);
  archived.stickers["U:UB"].label = "";
  await page.addInitScript(
    ({ scheme, archived }) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              schemeHistory: [
                { scheme: archived, updatedAt: new Date(0).toISOString() },
              ],
              onboarded: true,
              pairs: {},
              solves: [],
              attempts: [],
            },
            dirty: false,
            revision: 0,
          }),
        );
    },
    { scheme, archived },
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("alert", { name: "Browser storage warning" }),
  ).toHaveCount(0);
  expect((await data(page)).schemeHistory[0].scheme).toEqual(archived);
  await tab(page, "Lettering");
  await page.getByRole("textbox", { name: "Letter", exact: true }).fill("CH");
  await expect.poll(() => draft(page)).not.toBeNull();
  await expect(status(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => draft(page), { timeout: 10000 }).toBeNull();
  await expect(status(page)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("alert", { name: "Browser storage warning" }),
  ).toHaveCount(0);
  const restored = await data(page);
  expect(restored.schemeHistory[0].scheme).toEqual(archived);
  expect(
    Object.values(restored.scheme.stickers).some((s: any) => s.label === "CH"),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("silent-saving.png") });
});

test("complete edits recover across reload, batch once and view-only changes do not add scheme history", async ({
  page,
}) => {
  await seed(page);
  const initial = await data(page);
  await tab(page, "Lettering");
  await page.getByRole("textbox", { name: "Letter", exact: true }).fill("CH");
  await expect.poll(() => draft(page)).not.toBeNull();
  expect((await data(page)).scheme).toEqual(initial.scheme);
  await page.reload();
  await tab(page, "Lettering");
  await expect(
    page.getByRole("textbox", { name: "Letter", exact: true }),
  ).toHaveValue("CH");
  await expect.poll(() => draft(page), { timeout: 10000 }).toBeNull();
  await expect(status(page)).toHaveCount(0);
  const committed = await data(page);
  expect(committed.schemeHistory).toHaveLength(1);
  expect(await draft(page)).toBeNull();
  await tab(page, "Cube view");
  await page
    .getByRole("radiogroup", { name: "Front face", exact: true })
    .getByRole("radio", { name: "Blue", exact: true })
    .click();
  await expect.poll(() => draft(page), { timeout: 10000 }).toBeNull();
  await expect(status(page)).toHaveCount(0);
  const viewOnly = await data(page);
  expect(viewOnly.defaultCubeView).toEqual({ top: "white", front: "blue" });
  expect(viewOnly.schemeHistory).toEqual(committed.schemeHistory);
  expect(viewOnly.schemeUpdatedAt).toBe(committed.schemeUpdatedAt);
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("quiet-autosave.png") });
});

test("blank and duplicate letters show errors and revert on blur or exit", async ({
  page,
}) => {
  await seed(page);
  const initial = await data(page);
  await tab(page, "Lettering");
  const input = page.getByRole("textbox", { name: "Letter", exact: true });
  const first = await input.inputValue();
  await input.fill("");
  await expect(page.locator("#lettering-field-help")).toHaveText(
    "Enter a letter. The previous label will be kept if you leave it blank.",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveCSS("border-color", "rgb(240, 100, 98)");
  await expect(page.locator("#lettering-field-help")).toHaveCSS(
    "color",
    "rgb(240, 100, 98)",
  );
  await expect(page.locator("#lettering-label-rule")).toHaveCount(0);
  await expect(status(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(page).toHaveURL(/training/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect((await data(page)).scheme).toEqual(initial.scheme);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await tab(page, "Lettering");
  await expect(input).toHaveValue(first);
  await page.getByRole("button", { name: "Next sticker", exact: true }).click();
  const second = await input.inputValue();
  await page
    .getByRole("button", { name: "Previous sticker", exact: true })
    .click();
  await input.fill(second);
  await expect(page.locator("#lettering-field-help")).toContainText(
    "Choose another label",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveCSS("border-color", "rgb(240, 100, 98)");
  await expect(page.locator("#lettering-field-help")).toHaveCSS(
    "color",
    "rgb(240, 100, 98)",
  );
  await expect(status(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(
    0,
  );
  await page.waitForTimeout(5200);
  expect((await data(page)).scheme).toEqual(initial.scheme);
  await page.getByRole("button", { name: "Next sticker", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous sticker", exact: true })
    .click();
  await expect(input).toHaveValue(first);
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await input.fill(second);
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(page).toHaveURL(/training/);
  expect((await data(page)).scheme).toEqual(initial.scheme);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await tab(page, "Lettering");
  await expect(input).toHaveValue(first);
  // A usable intermediate edit is the value restored, even before autosave's idle delay.
  await input.fill("CH");
  await input.fill(second);
  await input.blur();
  await expect(input).toHaveValue("CH");
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect
    .poll(async () => (await data(page)).schemeHistory?.length)
    .toBe(1);
  expect(await draft(page)).toBeNull();
});

test("rightward dragging and arrow keys stay visually consistent upright and upside down", async ({
  page,
}) => {
  await seed(page);
  const cube = page.getByRole("group", { name: "Your cube", exact: true });
  const camera = cube.locator(":scope > div").first();
  const rotation = () =>
    camera.evaluate((el) => {
      const transform = (el as HTMLElement).style.transform;
      const x = Number(transform.match(/rotateX\(([-\d.]+)/)![1]);
      const y = Number(transform.match(/rotateY\(([-\d.]+)/)![1]);
      const z =
        Math.cos((x * Math.PI) / 180) * Math.cos((y * Math.PI) / 180) > 0
          ? 100
          : -100;
      return {
        x,
        y,
        z,
        screenX: new DOMMatrix(transform).transformPoint(new DOMPoint(0, 0, z))
          .x,
      };
    });
  for (let turn = 0; turn < 4; turn++) {
    await cube.focus();
    if (turn)
      for (let step = 0; step < 12; step++)
        await page.keyboard.press("ArrowUp");
    const before = await rotation();
    const direction = Math.cos((before.x * Math.PI) / 180) < 0 ? -1 : 1;
    await page.waitForTimeout(300);
    const box = (await cube.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    const after = await rotation();
    expect(after.y - before.y).toBeCloseTo(36 * direction, 3);
    expect(after.screenX).toBeGreaterThan(before.screenX);
    await cube.focus();
    await page.keyboard.press("ArrowRight");
    expect((await rotation()).y - after.y).toBeCloseTo(15 * direction, 3);
    await page.keyboard.press("ArrowLeft");
    expect((await rotation()).y).toBeCloseTo(after.y, 3);
  }
});

test("all editable cube tabs rotate vertically past both poles; Cube View stays fixed", async ({
  page,
}) => {
  await seed(page);
  const cube = page.getByRole("group", { name: "Your cube", exact: true });
  const camera = cube.locator(":scope > div").first();
  const angle = () =>
    camera.evaluate((el) =>
      Number(
        (el as HTMLElement).style.transform.match(/rotateX\(([-\d.]+)/)![1],
      ),
    );
  for (const name of [
    "Overview",
    "Lettering",
    "Edge buffer",
    "Corner buffer",
  ]) {
    await tab(page, name);
    await page.waitForTimeout(350);
    await cube.focus();
    const before = await angle();
    for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowUp");
    expect(await angle()).toBe(before + 450);
    for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowDown");
    expect(await angle()).toBe(before - 450);
  }
  await tab(page, "Overview");
  const before = await angle();
  const box = (await cube.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 250, {
    steps: 12,
  });
  await page.mouse.up();
  expect(await angle()).toBeCloseTo(before - 112.5, 0);
  await tab(page, "Cube view");
  const fixed = await angle();
  expect(((fixed % 360) + 360) % 360).toBe(333);
  await expect(cube).toHaveCSS("cursor", "default");
  const fixedStyle = await camera.getAttribute("style");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 100,
    box.y + box.height / 2 + 100,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(await camera.getAttribute("style")).toBe(fixedStyle);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("mobile-cube-view.png"),
  });
});

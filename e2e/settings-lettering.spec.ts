import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { stickerInView } from "../src/magic/utils/scheme";
import { faceDepth } from "../src/magic/utils/camera";
import type { Face } from "../src/magic/utils/cube";

async function seed(page: Page, front: "green" | "blue" = "green") {
  const scheme = createSpeffzScheme();
  scheme.edgeBuffer = "U:UL";
  scheme.edgeMethod = "old-pochmann";
  await page.addInitScript(
    ({ scheme, front }) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              defaultCubeView: { top: "white", front },
              onboarded: true,
              pairs: {},
              solves: [],
              attempts: [],
            },
            dirty: false,
            revision: 0,
          }),
        );
      (window as any).__settingsRotations = [];
      document.addEventListener(
        "transitionrun",
        (event) => {
          if (
            (event as TransitionEvent).propertyName === "transform" &&
            (event.target as Element).parentElement?.getAttribute(
              "aria-label",
            ) === "Your cube"
          )
            (window as any).__settingsRotations.push(
              (event.target as HTMLElement).style.transform,
            );
        },
        true,
      );
    },
    { scheme, front },
  );
}
const cube = (page: Page) =>
  page.getByRole("group", { name: "Your cube", exact: true });
const stored = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
const mode = (page: Page, name: string) =>
  page
    .getByRole("radiogroup", { name: "Cube mode", exact: true })
    .getByRole("radio", { name, exact: true })
    .click();
const selected = (page: Page) => cube(page).locator('[data-selected="true"]');

for (const front of ["green", "blue"] as const)
  test(`lettering selection rotates to expose physical stickers with ${front} front`, async ({
    page,
  }) => {
    await seed(page, front);
    await page.goto("/settings");
    await mode(page, "Lettering");
    await expect(selected(page)).toHaveAttribute("data-sticker-id", "U0");
    await expect(page.locator("[data-lettering-position]")).toHaveAttribute(
      "data-lettering-position",
      stickerInView("U0", { top: "white", front }).id,
    );
    const entryCount = await page.evaluate(
      () => (window as any).__settingsRotations.length,
    );
    const entryTarget = await cube(page)
      .locator(":scope > div")
      .first()
      .evaluate((el) => (el as HTMLElement).style.transform);
    // Blue-front U0 occupies the third view-relative top slot; pass the last
    // top sticker before the next side sticker actually needs a camera turn.
    for (let i = 0; i < (front === "blue" ? 2 : 1); i++) {
      await page
        .getByRole("button", {
          name: front === "green" ? "Previous sticker" : "Next sticker",
          exact: true,
        })
        .click();
    }
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__settingsRotations.length),
      )
      .toBeGreaterThan(entryCount);
    const physical = (await selected(page).getAttribute("data-sticker-id"))!;
    expect(physical).not.toBe("U0");
    const target = await cube(page)
      .locator(":scope > div")
      .first()
      .evaluate((el) => (el as HTMLElement).style.transform);
    const [, x, y] = target.match(
      /rotateX\((-?[\d.]+)deg\) rotateY\((-?[\d.]+)deg\)/,
    )!;
    expect(
      faceDepth(
        physical[0] as Face,
        { x: Number(x), y: Number(y) },
        { top: "white", front },
      ),
    ).toBeGreaterThan(0.2);
    await expect(selected(page)).toHaveCSS("opacity", "1");
    expect(
      await selected(page).evaluate(
        (el) => (el as HTMLElement).style.boxShadow,
      ),
    ).toContain("var(--accent)");
    await expect(page.locator("[data-lettering-position]")).toContainText(
      stickerInView(physical, { top: "white", front }).piece,
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: test.info().outputPath("lettering.png") });
    for (let i = 0; i < (front === "blue" ? 2 : 1); i++) {
      await page
        .getByRole("button", {
          name: front === "green" ? "Next sticker" : "Previous sticker",
          exact: true,
        })
        .click();
    }
    await expect(selected(page)).toHaveAttribute("data-sticker-id", "U0");
    await mode(page, "Overview");
    await page.evaluate(() => ((window as any).__settingsRotations = []));
    await mode(page, "Lettering");
    await page.waitForTimeout(300);
    expect(
      await cube(page)
        .locator(":scope > div")
        .first()
        .evaluate((el) => (el as HTMLElement).style.transform),
    ).toBe(entryTarget);
  });

test("orientation updates displayed positions and quick choices without relabelling physical stickers", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/settings");
  const before = await stored(page);
  await expect(page.locator('[data-buffer-position="edge"]')).toHaveText("UL");
  await expect(cube(page).locator('[data-buffer="edge"]')).toHaveAttribute(
    "data-sticker-id",
    "U3",
  );
  expect(
    await cube(page)
      .locator('[data-buffer="edge"]')
      .evaluate((el) => (el as HTMLElement).style.boxShadow),
  ).toContain("var(--ink)");
  await mode(page, "Cube view");
  await page
    .getByRole("radiogroup", { name: "Front face", exact: true })
    .getByRole("radio", { name: "Blue", exact: true })
    .click();
  await mode(page, "Overview");
  await expect(cube(page)).toHaveAttribute("data-cube-view", "white/blue");
  await expect(page.locator('[data-buffer-position="edge"]')).toHaveText("UR");
  await expect(cube(page).locator('[data-buffer="edge"]')).toHaveAttribute(
    "data-sticker-id",
    "U3",
  );
  expect((await stored(page)).scheme).toEqual(before.scheme);
  await page.screenshot({ path: test.info().outputPath("overview-blue.png") });
  await mode(page, "Edge buffer");
  await expect(page.getByText("Common", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/usually uses/)).toHaveCount(0);
  await page.getByRole("button", { name: "UL", exact: true }).click();
  await expect(cube(page).locator('[data-buffer="edge"]')).toHaveAttribute(
    "data-sticker-id",
    "U5",
  );
  await expect(page.locator("[data-current-buffer]")).toHaveText("UL");
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("blindsolve-settings-draft-v1:guest"),
        ),
      { timeout: 10000 },
    )
    .toBeNull();
  await page.reload();
  const after = await stored(page);
  expect(after.scheme.edgeBuffer).toBe("U:UR");
  expect(after.scheme.stickers).toEqual(before.scheme.stickers);
  expect(after.scheme.cornerBuffer).toBe(before.scheme.cornerBuffer);
  expect(after.defaultCubeView).toEqual({ top: "white", front: "blue" });
  await expect(page.locator('[data-buffer-position="edge"]')).toHaveText("UL");
});

test("lettering name identifies backups and Cube View uses explicit colour controls", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/settings");
  await mode(page, "Lettering");
  await page.getByRole("textbox", { name: "Letter", exact: true }).fill("CH");
  const name = page.getByRole("textbox", {
    name: "Lettering name",
    exact: true,
  });
  await expect(
    page.getByText("Shown in backup previews", { exact: true }),
  ).toBeVisible();
  await name.fill("Travel lettering");
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("blindsolve-settings-draft-v1:guest"),
        ),
      { timeout: 10000 },
    )
    .toBeNull();
  expect((await stored(page)).scheme.name).toBe("Travel lettering");
  await page
    .getByRole("button", { name: "Preview a sample backup", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("alertdialog", { name: "Import backup", exact: true }),
  ).toContainText("Travel lettering");
  await page.keyboard.press("Escape");
  await mode(page, "Cube view");
  await expect(
    page.getByRole("button", { name: /^Use displayed view/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/Drag the cube/)).toHaveCount(0);
  await page
    .getByRole("radiogroup", { name: "Front face", exact: true })
    .getByRole("radio", { name: "Orange", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("blindsolve-settings-draft-v1:guest"),
        ),
      { timeout: 10000 },
    )
    .toBeNull();
  expect((await stored(page)).defaultCubeView).toEqual({
    top: "white",
    front: "orange",
  });
  await page.screenshot({ path: test.info().outputPath("cube-view.png") });
});

test("Lettering transitions animate both ways, other tabs retain the view, and Cube View cannot drag", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/settings");
  const camera = cube(page).locator(":scope > div").first();
  const angle = () =>
    camera.evaluate((el) => (el as HTMLElement).style.transform);
  const rotations = () =>
    page.evaluate(() => (window as any).__settingsRotations.length);
  const defaultAngle = await angle();
  await mode(page, "Lettering");
  await page
    .getByRole("button", { name: "Previous sticker", exact: true })
    .click();
  const target = await angle();
  expect(target).not.toBe(defaultAngle);
  await page.waitForTimeout(300);
  for (const tab of ["Overview", "Edge buffer", "Corner buffer", "Cube view"]) {
    const before = await rotations();
    await mode(page, tab);
    await expect(
      page
        .getByRole("radiogroup", { name: "Cube mode" })
        .getByRole("radio", { name: tab, exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect.poll(rotations).toBeGreaterThan(before);
    expect(await angle()).toBe(defaultAngle);
    await page.waitForTimeout(300);
    const returned = await rotations();
    await mode(page, "Lettering");
    await expect.poll(rotations).toBeGreaterThan(returned);
    expect(await angle()).toBe(target);
    await page.waitForTimeout(300);
  }
  await mode(page, "Cube view");
  await page.waitForTimeout(300);
  const before = await rotations();
  await page
    .getByRole("radiogroup", { name: "Front face", exact: true })
    .getByRole("radio", { name: "Blue", exact: true })
    .click();
  await expect.poll(rotations).toBeGreaterThan(before);
  await page.waitForTimeout(300);
  const configured = await angle(),
    settled = await rotations();
  for (const tab of ["Overview", "Edge buffer", "Corner buffer", "Cube view"]) {
    await mode(page, tab);
    expect(await angle()).toBe(configured);
  }
  expect(await rotations()).toBe(settled);
  const box = (await cube(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 30,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(await angle()).toBe(configured);
  await expect(cube(page)).toHaveCSS("cursor", "default");
  await expect(
    page.getByRole("button", { name: /Use displayed view/ }),
  ).toHaveCount(0);
  // Ordinary tabs retain manual previews; Cube View returns to its configured camera.
  await mode(page, "Overview");
  await cube(page).focus();
  await page.keyboard.press("ArrowRight");
  const preview = await angle();
  expect(preview).not.toBe(configured);
  for (const tab of ["Edge buffer", "Corner buffer"]) {
    await mode(page, tab);
    expect(await angle()).toBe(preview);
  }
  await page.waitForTimeout(300);
  const beforeReset = await rotations();
  await mode(page, "Cube view");
  await expect.poll(rotations).toBeGreaterThan(beforeReset);
  expect(await angle()).toBe(configured);
  const reset = page.getByRole("button", { name: "Reset view", exact: true });
  await expect(reset).toBeVisible();
  await expect(reset).toHaveCSS("border-top-style", "solid");
  await reset.click();
  await expect(cube(page)).toHaveAttribute("data-cube-view", "white/green");
  await expect(reset).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toHaveCount(0);
});

test("Cube and Lettering remains usable on mobile with alternate orientation", async ({
  page,
}) => {
  await seed(page, "blue");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(page.locator('[data-buffer-position="edge"]')).toHaveText("UR");
  await page.screenshot({
    path: test.info().outputPath("mobile-overview.png"),
  });
  await mode(page, "Lettering");
  const input = page.getByRole("textbox", { name: "Letter", exact: true });
  await expect(input).toBeVisible();
  await input.fill("CH");
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          localStorage.getItem("blindsolve-settings-draft-v1:guest"),
        ),
      { timeout: 10000 },
    )
    .toBeNull();
  expect(
    Object.values((await stored(page)).scheme.stickers).some(
      (s: any) => s.label === "CH",
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            pairs: {},
            attempts: [],
            solves: [],
            onboarded: true,
          },
          revision: 0,
          dirty: false,
          pending: {},
        }),
      ),
    createSpeffzScheme(),
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
]) {
  test(`shared sizing and reachable pages at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    for (const route of [
      "/",
      "/training",
      "/settings",
      "/pairs",
      "/flashcards",
    ]) {
      await page.goto(route);
      await expect(page).toHaveTitle("BlindSolve");
      const root = await page.evaluate(() => ({
        font: getComputedStyle(document.documentElement).fontSize,
        zoom: getComputedStyle(document.documentElement).zoom,
        transform: getComputedStyle(document.documentElement).transform,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(root).toEqual({
        font: "19.2px",
        zoom: "1",
        transform: "none",
        overflow: false,
      });
      if (route === "/") {
        await expect(
          page.getByRole("button", { name: "New scramble", exact: true }),
        ).toBeEnabled({ timeout: 45000 });
        await expect(page.getByRole("timer")).toBeInViewport();
        const clock = (await page.getByRole("timer").boundingBox())!;
        expect(clock.height).toBeGreaterThan(40);
        const footer = (await page
          .getByRole("region", { name: "Last solve memo" })
          .boundingBox())!;
        expect(clock.y + clock.height).toBeLessThanOrEqual(footer.y);
        if (width >= 768)
          expect(
            (await page
              .getByRole("group", { name: "Scrambled cube", exact: true })
              .boundingBox())!.width,
          ).toBe(
            (
              { 1440: 272, 1280: 222, 1024: 230, 900: 165 } as Record<
                number,
                number
              >
            )[width],
          );
      }
      if (process.env.GLOBAL_UI_DIR) {
        await mkdir(process.env.GLOBAL_UI_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.GLOBAL_UI_DIR,
            `${route.slice(1) || "timer"}-${width}.png`,
          ),
        });
      }
    }
  });
}

test("canonical title survives all entry routes and SPA navigation", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/training",
    "/pairs",
    "/flashcards",
    "/settings",
    "/signin",
    "/setup",
    "/admin/feedback",
    "/about",
    "/memo",
    "/not-a-route",
  ]) {
    await page.goto(route);
    await expect(page).toHaveTitle("BlindSolve");
  }
  await page.goto("/");
  for (const name of [
    "Training",
    "Letter Pairs",
    "Flashcards",
    "Settings",
    "Timer",
  ]) {
    await page
      .getByRole("navigation", { name: "Sections", exact: true })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveTitle("BlindSolve");
  }
});

test("selection is disabled for UI and preserved for editable fields and browser zoom shortcuts", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("navigation", { name: "Sections", exact: true }),
  ).toHaveCSS("user-select", "none");
  // Exercise the central policy against native and nested genuine editing surfaces.
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML =
      '<input aria-label="Selection input" value="editable text"><textarea aria-label="Selection area">editable text</textarea><div contenteditable="true" role="textbox" aria-label="Selection editor"><span>editable text</span></div>';
    document.body.append(fixture);
  });
  for (const name of [
    "Selection input",
    "Selection area",
    "Selection editor",
  ]) {
    const field = page.getByRole("textbox", { name, exact: true });
    await expect(field).toHaveCSS("user-select", "text");
    await field.focus();
    await page.keyboard.press("Control+a");
    expect(
      await field.evaluate((el) =>
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
          : window.getSelection()?.toString(),
      ),
    ).toBe("editable text");
    await page.keyboard.type("replacement");
    if (name === "Selection editor")
      await expect(field).toHaveText("replacement");
    else await expect(field).toHaveValue("replacement");
  }
  expect(
    await page.evaluate(() =>
      ["+", "-", "0"].every((key) =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      ),
    ),
  ).toBe(true);
});

test("standard 3BLD favicon references resolve", async ({ page, request }) => {
  await page.goto("/");
  await expect(
    page.locator('link[rel="icon"][type="image/svg+xml"]'),
  ).toHaveAttribute("href", "/favicon-3bld.svg");
  for (const asset of [
    "favicon-3bld.svg",
    "favicon-16.png",
    "favicon-32.png",
    "favicon.ico",
    "apple-touch-icon.png",
  ]) {
    const response = await request.get(`/${asset}`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
});

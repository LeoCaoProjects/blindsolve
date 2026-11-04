import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { trainingModes } from "../src/magic/data/trainingModes";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((scheme) => {
    if (!localStorage.getItem("cubeiq-bld-v2:guest"))
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            pairs: {},
            solves: [],
            attempts: [],
            onboarded: true,
            schemeUpdatedAt: "2026-11-04T00:00:00.000Z",
            defaultCubeView: { top: "white", front: "green" },
          },
          revision: 0,
          dirty: false,
        }),
      );
  }, createSpeffzScheme());
});

test("rail and mobile dock navigate all real routes and follow browser history", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 900, height: 420 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Sections" });
    for (const [label, path] of [
      ["Training", "/training"],
      ["Letter Pairs", "/pairs"],
      ["Flashcards", "/flashcards"],
      ["Settings", "/settings"],
      ["Timer", "/"],
    ]) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const bounds = await link.boundingBox();
      expect(
        bounds &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= viewport.width &&
          bounds.y + bounds.height <= viewport.height,
      ).toBeTruthy();
    }
    await page.goBack();
    await expect(
      nav.getByRole("link", { name: "Settings", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.goForward();
    await expect(
      nav.getByRole("link", { name: "Timer", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
});

test("new Training selectors keep real modes, scopes and original tutorials", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 900, height: 420 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/training");
    for (const mode of trainingModes) {
      const chooser = page.getByRole("button", {
        name: "Choose Training mode",
      });
      if (await chooser.isVisible()) await chooser.click();
      await page.getByRole("radio", { name: mode.label, exact: true }).click();
      for (const scope of ["Both", "Edges", "Corners"]) {
        const radio = page
          .getByRole("radiogroup", { name: "Pieces" })
          .getByRole("radio", { name: scope, exact: true });
        await radio.click();
        await expect(radio).toHaveAttribute("aria-checked", "true");
      }
      const pieces = page.getByRole('radiogroup', {name:'Pieces'});
      await pieces.getByRole('radio', {name:'Corners',exact:true}).press('ArrowRight');
      await expect(pieces.getByRole('radio', {name:'Both',exact:true})).toHaveAttribute('aria-checked','true');
      await pieces.getByRole('radio', {name:'Both',exact:true}).press('ArrowLeft');
      await expect(pieces.getByRole('radio', {name:'Corners',exact:true})).toHaveAttribute('aria-checked','true');
      await page
        .getByRole("button", { name: "How it works", exact: true })
        .click();
      const help = page.getByRole("dialog", {
        name: `How ${mode.label} works`,
      });
      await expect(help).toBeVisible();
      await expect(help.getByRole("listitem")).toHaveText(mode.steps);
      await expect(help).toContainText(mode.tests);
      await page.keyboard.press("Escape");
      await expect(help).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test('rail and dock preserve the existing Settings leave guard', async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/settings');
    await page.getByRole('radiogroup', { name: 'Edge method' }).getByRole('radio', { name: 'OP', exact: true }).click();
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Save setup changes?' });
    await expect(confirm).toBeVisible();
    await expect(page).toHaveURL(/\/settings$/);
    await confirm.getByRole('button', { name: 'Stay', exact: true }).click();
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await confirm.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page).toHaveURL(/\/training$/);
  }
});

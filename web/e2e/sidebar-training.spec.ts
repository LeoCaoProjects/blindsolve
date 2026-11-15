import { viewportGeometry } from "./helpers/viewport";
import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { trainingModes } from "../src/workspace/data/trainingModes";

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
      await expect(page).toHaveURL(
        new URL(path === "/settings" ? path : "/", page.url()).href,
      );
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

test("new Training selectors keep real modes, scopes and shared help copy", async ({
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
        name: "Training controls", exact: true,
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
      const panel = page.getByRole('dialog', {name:'Training controls',exact:true});
      if (await panel.isVisible()) await panel.getByRole('button',{name:'Close',exact:true}).click();
      await page
        .getByRole("button", { name: "How it works", exact: true })
        .click();
      const help = page.getByRole("dialog", {
        name: `How ${mode.label} works`,
      });
      await expect(help).toBeVisible();
      await expect(help.getByRole("term")).toHaveText(mode.steps.map(step => step.label));
      await expect(help.getByRole("definition")).toHaveText(mode.steps.map(step => step.text));
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

test('rail and dock persist completed Settings edits on navigation', async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/settings');
    const method = page.getByRole('radiogroup', { name: 'Edge method' });
    const op = method.getByRole('radio', { name: 'OP', exact: true });
    const m2 = method.getByRole('radio', { name: 'M2', exact: true });
    const next = await op.getAttribute('aria-checked') === 'true' ? 'M2' : 'OP';
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "blindsolve-settings-draft-v1:guest" &&
            document.documentElement.hasAttribute("data-test-draft-blocked")) {
          throw new DOMException("Synthetic quota", "QuotaExceededError");
        }
        return setItem.call(this, key, value);
      };
      document.documentElement.setAttribute("data-test-draft-blocked", "");
    });
    await (next === 'M2' ? m2 : op).click();
    await expect(page.getByRole('status', { name: 'Setup save status' })).toContainText('draft');
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.evaluate(() => document.documentElement.removeAttribute("data-test-draft-blocked"));
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Setup save status' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Training', exact: true }).click();
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    await expect(page.getByRole("link", { name: "Training", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(method.getByRole('radio', { name: next, exact: true })).toHaveAttribute('aria-checked', 'true');
  }
});

test('Training controls occupy a secondary desktop sidebar and preserve Show state', async ({ page }) => {
  for (const viewport of [{width:1440,height:900},{width:1024,height:768},{width:390,height:844},{width:320,height:568},{width:900,height:420}]) {
    await page.setViewportSize(viewport);
    await page.goto('/training');
    const chooser = page.getByRole('button',{name:'Training controls',exact:true});
    const { contextual, rem } = await viewportGeometry(page);
    if (contextual) {
      await expect(chooser).toHaveCount(0);
      const globalNav = await page.getByRole('navigation',{name:'Sections'}).boundingBox();
      const sidebar = page.getByRole('complementary',{name:'Training controls',exact:true});
      await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeCloseTo(224 * rem / 16, 1);
      const side = await sidebar.boundingBox();
      const main = await page.getByRole('main').boundingBox();
      expect(side && globalNav && main && side.x >= globalNav.x + globalNav.width && main.x >= side.x + side.width).toBeTruthy();
      await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeCloseTo(224 * rem / 16, 1);
      for (const label of ['Drill','Pieces','Show']) await expect(page.getByRole('main').getByRole('radiogroup',{name:label,exact:true})).toHaveCount(0);
      const modes = await sidebar.getByRole('radiogroup',{name:'Drill'}).getByRole('radio').all();
      for (let i=1;i<modes.length;i++) {
        const before = await modes[i-1].boundingBox();
        const after = await modes[i].boundingBox();
        expect(before && after && after.y >= before.y + before.height).toBeTruthy();
      }
      const pieces = await sidebar.getByRole('radiogroup',{name:'Pieces'}).boundingBox();
      const show = await sidebar.getByRole('radiogroup',{name:'Show'}).boundingBox();
      expect(pieces && show && show.y > pieces.y).toBeTruthy();
    } else {
      await expect(page.getByRole('complementary',{name:'Training controls',exact:true})).toHaveCount(0);
      await chooser.click();
    }
    const id = await page.locator('[data-training-challenge-id]').getAttribute('data-training-challenge-id');
    await page.getByRole('radiogroup',{name:'Show'}).getByRole('radio',{name:'Words',exact:true}).click();
    await expect(page.locator('[data-training-challenge-id]')).toHaveAttribute('data-training-challenge-id',id!);
    await page.getByRole('radio',{name:'Guided Solve',exact:true}).click();
    await expect(page.getByRole('radiogroup',{name:'Show'})).toHaveCount(0);
    await page.getByRole('radio',{name:'Execution Sprint',exact:true}).click();
    await expect(page.getByRole('radiogroup',{name:'Show'}).getByRole('radio',{name:'Words',exact:true})).toHaveAttribute('aria-checked','true');
    await page.getByRole('radiogroup',{name:'Show'}).getByRole('radio',{name:'Letters',exact:true}).click();
    await expect(page.getByRole('radiogroup',{name:'Show'}).getByRole('radio',{name:'Letters',exact:true})).toHaveAttribute('aria-checked','true');
    const panel = page.getByRole('dialog',{name:'Training controls',exact:true});
    if (await panel.isVisible()) await panel.getByRole('button',{name:'Close',exact:true}).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { mkdir, writeFile } from "node:fs/promises";

const output = "test-results/training-continuity/after";
test.beforeEach(async ({ page }) => {
  await mkdir(output, { recursive: true });
  await page.addInitScript((scheme) => {
    if (localStorage.getItem("cubeiq-bld-v2:guest")) return;
    const stamp = Date.parse("2026-11-06T00:00:00Z");
    const data = {
      scheme,
      onboarded: true,
      pairs: {},
      defaultCubeView: { top: "white", front: "green" },
      solves: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          scramble: "R U F",
          memoMs: 10000,
          executionMs: 20000,
          totalMs: 30000,
          result: "success",
          edgeMemo: [],
          cornerMemo: [],
          cycleBreaks: { edges: [], corners: [] },
          schemeSnapshot: scheme,
          createdAt: new Date(stamp).toISOString(),
        },
      ],
      attempts: ["exec", "guided", "recall", "trace"].map(
        (trainingMode, i) => ({
          id: `50000000-0000-4000-8000-00000000001${i}`,
          kind: "memo",
          trainingMode,
          mode: "both",
          durationMs: 21000 + i,
          correct: true,
          targets: 20,
          pairs: 10,
          createdAt: new Date(stamp - i * 1000).toISOString(),
        }),
      ),
    };
    localStorage.setItem(
      "cubeiq-bld-v2:guest",
      JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
    );
  }, createSpeffzScheme());
});
async function landmarks(page: Page) {
  return page.evaluate(() => {
    const rect = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return Object.fromEntries(
      [
        'section[aria-label="Scramble"]',
        "[data-workspace-reference]",
        "[data-timer-cube-viewport]",
        '[data-timer-cube-viewport] [role="group"]:last-child',
        'button[aria-label="Sticker letters"]',
        "[data-virtual-history]",
        "[data-virtual-row]",
      ].map((s) => [s, rect(document.querySelector(s)!)]),
    );
  });
}
function closeGeometry(actual: Awaited<ReturnType<typeof landmarks>>, reference: Awaited<ReturnType<typeof landmarks>>, training = false) {
  for (const s in reference)
    for (const axis of ["x", "y", "width", "height"] as const) {
      // Attempt rows span one column; solve history has two. All rows have the same density.
      if (s === "[data-virtual-row]" && axis === "width") continue;
      // Training's contextual column intentionally narrows/moves the shared header.
      if (training && s === 'section[aria-label="Scramble"]') continue;
      expect(
        Math.abs(actual[s][axis] - reference[s][axis]),
        `${s} ${axis}`,
      ).toBeLessThan(0.15);
    }
}
test("shared header, cube, Aa and panel persist through repeated Timer Training switching", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const before = await landmarks(page);
  const cube = await page.locator("[data-timer-cube-viewport]").elementHandle();
  const reference = await page.locator("[data-workspace-reference]").elementHandle();
  const aa = page.getByRole("button", { name: "Sticker letters", exact: true });
  await aa.click();
  const nav = page.getByRole("navigation", { name: "Sections", exact: true });
  const results: { mode: string; landmarks: Awaited<ReturnType<typeof landmarks>>; samples: number }[] = [];
  for (const mode of ["Execution Sprint", "Guided Solve", "Execution Sprint"]) {
    await page.evaluate(() => {
      const panel = document.querySelector("[data-workspace-reference]")!;
      const start = performance.now();
      const samples: [number, number, number][] = [];
      (window as Window & { __panelTrace: [number, number, number][] }).__panelTrace = samples;
      const frame = () => {
        const r = panel.getBoundingClientRect();
        samples.push([r.x, r.y, r.width]);
        if (performance.now() - start < 450) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await nav.getByRole("link", { name: "Training", exact: true }).click();
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await expect(
      page.getByRole("button", { name: "Timer mode", exact: true }),
    ).toHaveCount(0);
    await expect(aa).toHaveAttribute("aria-pressed", "true");
    expect(await reference!.evaluate(e =>
      e === document.querySelector("[data-workspace-reference]"),
    )).toBe(true);
    expect(await cube!.evaluate(e =>
      e === document.querySelector("[data-timer-cube-viewport]"),
    )).toBe(true);
    await expect(page.getByRole("region", { name: "Scramble", exact: true })).toHaveCount(1);
    await expect(page.locator("[data-page-workspace]")).toHaveCSS(
      "transform",
      "none",
    );
    closeGeometry(await landmarks(page), before, true);
    const workspace = await page.locator("[data-page-workspace]").boundingBox();
    const shiftedHeader = await page
      .getByRole("region", { name: "Scramble", exact: true })
      .boundingBox();
    expect(shiftedHeader!.x).toBeCloseTo(workspace!.x, 1);
    expect(shiftedHeader!.width).toBeCloseTo(workspace!.width, 1);
    expect(shiftedHeader!.y).toBe(before['section[aria-label="Scramble"]'].y);
    expect(
      await page
        .getByRole("button", { name: "New scramble", exact: true })
        .innerText(),
    ).toBe("");
    await page.waitForTimeout(460);
    const samples = await page.evaluate(() => (window as Window & { __panelTrace: [number, number, number][] }).__panelTrace);
    for (const sample of samples) expect(sample).toEqual([1048, 0, 392]);
    results.push({
      mode,
      landmarks: await landmarks(page),
      samples: samples.length,
    });
    await page.screenshot({
      path: `${output}/${mode.replaceAll(" ", "-")}.png`,
    });
    await nav.getByRole("link", { name: "Timer", exact: true }).click();
    await expect(page.locator("[data-page-workspace]")).toHaveCSS(
      "transform",
      "none",
    );
    const timerHeader = page.getByRole("region", { name: "Scramble", exact: true });
    await expect.poll(async () => (await timerHeader.boundingBox())?.x)
      .toBeCloseTo(before['section[aria-label="Scramble"]'].x, 1);
    closeGeometry(await landmarks(page), before);
  }
  await writeFile(
    `${output}/switching.json`,
    JSON.stringify({ timer: before, results }, null, 2),
  );
  await page.screenshot({ path: `${output}/Timer.png` });
});
for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test(`shared workspace remains usable at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await expect(page.getByRole("timer")).toBeInViewport();
    await page.screenshot({ path: `${output}/timer-${width}.png` });
    await page.getByRole("link", { name: "Training", exact: true }).click();
    for (const mode of [
      "Execution Sprint",
      "Guided Solve",
      "Memo Recall",
      "Trace Sprint",
    ]) {
      await page
        .getByRole("button", { name: "Training controls", exact: true })
        .click();
      await page.getByRole("radio", { name: mode, exact: true }).click();
      await page
        .getByRole("dialog", { name: "Training controls", exact: true })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect(
        page.getByRole("timer", { name: "Hold Space to start" }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "How it works", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (mode === "Execution Sprint" || mode === "Guided Solve" || mode === "Trace Sprint")
        await expect(
          page.getByRole("button", { name: "New scramble", exact: true }),
        ).toBeInViewport();
      else
        await expect(
          page.getByRole("region", { name: "Scramble", exact: true }),
        ).toHaveCount(0);
      await page.screenshot({
        path: `${output}/${mode.replaceAll(" ", "-")}-${width}.png`,
      });
    }
  });

test("header uses the workspace slide in both directions without moving the reference panel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    (window as Window & { __slides: Animation[] }).__slides = [];
    Element.prototype.animate = function (...args) {
      const animation = original.apply(this, args);
      if (this.hasAttribute("data-page-workspace")) {
        animation.pause();
        animation.currentTime = 0;
        (window as Window & { __slides: Animation[] }).__slides.push(animation);
      }
      return animation;
    };
  });
  const header = page.getByRole("region", { name: "Scramble", exact: true });
  const nav = page.getByRole("navigation", { name: "Sections", exact: true });
  const reference = page.locator("[data-workspace-reference]");
  const panel = await reference.boundingBox();
  const slideCount = () => page.evaluate(() =>
    (window as Window & { __slides: Animation[] }).__slides.length,
  );
  async function switchAndSample(destination: "Timer" | "Training") {
    const before = (await header.boundingBox())!.x;
    const count = await slideCount();
    await nav.getByRole("link", { name: destination, exact: true }).click();
    await expect.poll(slideCount).toBe(count + 1);
    const samples = await page.evaluate(async () => {
      const animation = (window as Window & { __slides: Animation[] }).__slides.at(-1)!;
      await animation.ready;
      const duration = Number(animation.effect!.getTiming().duration);
      const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      return [0, duration / 2, duration - 0.01].map(time => {
        animation.currentTime = time;
        return {
          header: rect('section[aria-label="Scramble"]').x,
          workspace: rect("[data-page-workspace]").x,
          panel: rect("[data-workspace-reference]").x,
          duration,
        };
      });
    });
    for (const sample of samples) {
      expect(sample.header).toBeCloseTo(sample.workspace, 2);
      expect(sample.panel).toBe(panel!.x);
      expect(sample.duration).toBe(180);
    }
    const [first, middle, last] = samples;
    expect(first.header).toBeCloseTo(before, 1);
    expect(middle.header).toBeGreaterThan(Math.min(first.header, last.header));
    expect(middle.header).toBeLessThan(Math.max(first.header, last.header));
    await page.evaluate(() => (window as Window & { __slides: Animation[] }).__slides.at(-1)!.finish());
    await expect(page.locator("[data-page-workspace]")).toHaveCSS("transform", "none");
    expect(last.header).toBeCloseTo((await header.boundingBox())!.x, 1);
  }
  for (const mode of ["Execution Sprint", "Guided Solve"]) {
    await switchAndSample("Training");
    await page.getByRole("radio", { name: mode, exact: true }).click();
    await switchAndSample("Timer");
  }
  expect(await slideCount()).toBe(4);
  await switchAndSample("Training");
  await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
  await expect(header).toHaveCount(0);
  await expect(page.locator("[data-page-workspace]")).toHaveCSS(
    "transform",
    "none",
  );
});

test("cube orientation snaps on drag reset, route/mode switches and preference changes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const cube = page.locator(
    "[data-timer-cube-viewport] > div:last-child > div",
  );
  const camera = cube.locator(":scope > div").first();
  const initial = await camera.evaluate(
    (e) => (e as HTMLElement).style.transform,
  );
  const box = (await cube.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 + 20,
    { steps: 3 },
  );
  await page.mouse.up();
  expect(
    await camera.evaluate((e) => (e as HTMLElement).style.transform),
  ).not.toBe(initial);
  const nav = page.getByRole("navigation", { name: "Sections", exact: true });
  for (const route of ["Training", "Timer", "Training"]) {
    await nav.getByRole("link", { name: route, exact: true }).click();
    if (route === "Training")
      await page
        .getByRole("radio", { name: "Guided Solve", exact: true })
        .click();
    await expect(camera).toHaveCSS("transition-duration", "0s");
    expect(
      await camera.evaluate((e) => {
        const actual = new DOMMatrixReadOnly(
          getComputedStyle(e).transform,
        ).toFloat64Array();
        const target = new DOMMatrixReadOnly(
          (e as HTMLElement).style.transform,
        ).toFloat64Array();
        return actual.every(
          (value, i) => Math.abs(value - target[i]) < 0.00001,
        );
      }),
    ).toBe(true);
    expect(
      await camera.evaluate(
        (e) =>
          e
            .getAnimations()
            .filter(
              (a) => (a as CSSTransition).transitionProperty === "transform",
            ).length,
      ),
    ).toBe(0);
  }
  await nav.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Cube view", exact: true }).click();
  const settingsCamera = page
    .getByRole("group", { name: "Your cube", exact: true })
    .locator(":scope > div")
    .first();
  await expect(settingsCamera).toHaveCSS("transition-duration", "0.26s");
  await page.getByRole("radio", { name: "Orange", exact: true }).last().click();
  await expect.poll(() => settingsCamera.evaluate((e) => {
      const actual = new DOMMatrixReadOnly(
        getComputedStyle(e).transform,
      ).toFloat64Array();
      const target = new DOMMatrixReadOnly(
        (e as HTMLElement).style.transform,
      ).toFloat64Array();
      return actual.every((value, i) => Math.abs(value - target[i]) < 0.00001);
    })).toBe(true);
  await nav.getByRole("link", { name: "Timer", exact: true }).click();
  await expect(cube).toHaveAttribute("data-cube-view", "white/orange");
  await expect(camera).toHaveCSS("transition-duration", "0s");
});

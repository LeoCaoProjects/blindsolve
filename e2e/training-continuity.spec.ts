import { test, expect, type Page } from "@playwright/test";
import { formatTime } from "../src/magic/utils/time";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
const scheme = createSpeffzScheme();
function seed(scheme: any) {
  localStorage.setItem(
    "cubeiq-bld-v2:guest",
    JSON.stringify({
      data: { scheme, onboarded: true, pairs: {}, attempts: [], solves: [] },
      revision: 0,
      dirty: false,
    }),
  );
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(seed, scheme);
});
async function choose(page: Page, mode: string) {
  const trigger = page.getByRole("button", {
    name: "Training controls",
    exact: true,
  });
  if (await trigger.isVisible()) await trigger.click();
  await page.getByRole("radio", { name: mode, exact: true }).click();
  const sheet = page.getByRole("dialog", {
    name: "Training controls",
    exact: true,
  });
  if (await sheet.isVisible()) {
    await sheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(sheet).toHaveCount(0);
  }
  await expect(page.locator("[data-training-region=scramble]")).toHaveCSS(
    "height",
    mode === "Execution Sprint" || mode === "Guided Solve" ? /^(?!0px)/ : "0px",
  );
  await expect(
    page.locator('[data-training-region][data-transitioning="true"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }).locator(".."),
  ).toHaveCSS("transform", "none");
}
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
test("all Training layout transitions retain their real timer, cube and history with intermediate geometry", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const pairs = [
    ["Execution Sprint", "Memo Recall"],
    ["Memo Recall", "Execution Sprint"],
    ["Guided Solve", "Memo Recall"],
    ["Memo Recall", "Guided Solve"],
    ["Execution Sprint", "Trace Sprint"],
    ["Trace Sprint", "Execution Sprint"],
    ["Guided Solve", "Trace Sprint"],
    ["Trace Sprint", "Guided Solve"],
    ["Memo Recall", "Trace Sprint"],
    ["Trace Sprint", "Memo Recall"],
  ];
  for (const [from, to] of pairs) {
    await choose(page, from);
    const samples = await page.evaluate(async (to) => {
      const timer = document.querySelector("main [role=timer]")!,
        cube = document.querySelector("[data-timer-cube-viewport]")!,
        history = document.querySelector("[data-training-history]")!;
      const rect = (selector: string) => {
        const b = document.querySelector(selector)!.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height];
      };
      const snapshot = () => ({
        header: rect("[data-training-region=scramble]")[3],
        cube: rect("[data-training-region=cube]")[3],
        timer: rect("main [role=timer]")[1],
        history: rect("[data-training-history]")[1],
        panel: rect("[data-workspace-reference]"),
        subnav: rect("[data-subnav-column]"),
        same:
          timer === document.querySelector("main [role=timer]") &&
          cube === document.querySelector("[data-timer-cube-viewport]") &&
          history === document.querySelector("[data-training-history]"),
      });
      const samples = [snapshot()];
      (
        document.querySelector(
          `button[role=radio][aria-label="${to}"]`,
        ) as HTMLElement
      ).click();
      for (let index = 0; index < 19; index++) {
        await new Promise(requestAnimationFrame);
        samples.push(snapshot());
      }
      for (
        let index = 0;
        index < 60 &&
        document.querySelector(
          '[data-training-region][data-transitioning="true"]',
        );
        index++
      )
        await new Promise(requestAnimationFrame);
      samples.push(snapshot());
      return samples;
    }, to);
    const first = samples[0],
      last = samples.at(-1)!;
    for (const sample of samples) {
      expect(sample.same, `${from} -> ${to}: mounted identity`).toBe(true);
      expect(sample.subnav).toEqual(first.subnav);
      expect(sample.panel).toEqual(first.panel);
    }
    const headerChange =
      ["Execution Sprint", "Guided Solve"].includes(from) !==
      ["Execution Sprint", "Guided Solve"].includes(to);
    if (headerChange) {
      expect(Math.abs(last.header - first.header)).toBeGreaterThan(50);
      expect(
        samples.some(
          (s) =>
            s.header > Math.min(first.header, last.header) + 1 &&
            s.header < Math.max(first.header, last.header) - 1,
        ),
        `${from} -> ${to}: header moves`,
      ).toBe(true);
      expect(
        samples.some(
          (s) =>
            s.timer > Math.min(first.timer, last.timer) + 1 &&
            s.timer < Math.max(first.timer, last.timer) - 1,
        ),
        `${from} -> ${to}: timer travels`,
      ).toBe(true);
    }
    if ((from === "Trace Sprint") !== (to === "Trace Sprint")) {
      expect(Math.abs(last.history - first.history)).toBeGreaterThan(100);
      expect(
        samples.some(
          (s) =>
            s.history > Math.min(first.history, last.history) + 1 &&
            s.history < Math.max(first.history, last.history) - 1,
        ),
        `${from} -> ${to}: history travels`,
      ).toBe(true);
    }
    if (to === "Trace Sprint") {
      expect(last.cube).toBe(0);
      await expect(
        page.getByRole("button", { name: "Sticker letters", exact: true }),
      ).toHaveCount(0);
    }
    console.log(
      from,
      "->",
      to,
      "header",
      first.header,
      last.header,
      "timer",
      first.timer,
      last.timer,
      "history",
      first.history,
      last.history,
    );
  }
  await page.screenshot({ path: "test-results/recall-shared-idle.png" });
});
for (const showLiveTimer of [true, false])
  test(`Memo Recall keeps its input/result flow with live timer ${showLiveTimer}`, async ({
    page,
  }) => {
    await page.addInitScript((show) => {
      const data = JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!);
      data.data.showLiveTimer = show;
      localStorage.setItem("cubeiq-bld-v2:guest", JSON.stringify(data));
    }, showLiveTimer);
    await page.goto("/training");
    await choose(page, "Memo Recall");
    const cube = page.locator("[data-timer-cube-viewport] [data-cube-view]");
    await expect(cube).toBeVisible();
    const cubeBox = await cube.boundingBox();
    await page.keyboard.down("Space");
    await expect(
      page.getByRole("timer", { name: "Ready, release to start" }),
    ).toBeVisible();
    await expect(page.locator("[data-subnav-column]")).toHaveCSS(
      "opacity",
      "0.4",
    );
    await expect(cube).toBeVisible();
    await page.keyboard.up("Space");
    const memo = page.getByRole("timer", { name: "Memorisation" });
    await expect(memo).toBeVisible();
    if (showLiveTimer) await expect(memo).toHaveText(/\d+\.\d{2}/);
    else await expect(memo).toHaveText("Solve");
    await expect(page.locator("main > .border-b")).toHaveCount(0);
    expect(await cube.boundingBox()).toEqual(cubeBox);
    if (showLiveTimer)
      await page.screenshot({ path: "test-results/recall-central-study.png" });
    const sequences = await page
      .locator("[data-training-targets] ol[aria-label]")
      .evaluateAll((elements) =>
        elements.map((el) => el.getAttribute("aria-label")!),
      );
    await page.keyboard.press("Space");
    const recall = page.getByRole("timer", { name: "Recall" });
    await expect(recall).toBeVisible();
    if (!showLiveTimer) await expect(recall).toHaveText("Solve");
    if (showLiveTimer)
      await page.screenshot({ path: "test-results/recall-central-entry.png" });
    const inputs = page.getByRole("textbox", {
      name: /Recall (corners|edges)/,
    });
    await expect(inputs).toHaveCount(sequences.length);
    for (let i = 0; i < sequences.length; i++) {
      await inputs.nth(i).fill(sequences[i]);
      await inputs.nth(i).press("Space");
      await expect(recall).toBeVisible();
      await inputs.nth(i).press("Enter");
    }
    const popup = page.getByRole("dialog", {
      name: "Memo Recall result",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await expect(
      popup.getByRole("region", { name: "Solve summary" }),
    ).toBeVisible();
    await expect(popup.locator("time")).toBeVisible();
    await expect(popup.locator(".font-timer").first()).toHaveText(/\d+\.\d{2}/);
    await expect(popup.getByRole("definition")).toHaveCount(1);
    await expect(popup.getByText("Correct", { exact: true })).toHaveCount(0);
    const saved = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
      );
    expect((await saved()).attempts).toHaveLength(1);
    expect((await saved()).attempts[0].correct).toBe(true);
    await expect(popup.locator(".font-timer").first()).toHaveText(
      formatTime((await saved()).attempts[0].durationMs),
    );
    await expect(
      popup.getByRole("button", { name: /No word|Show all words|Save|Next/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/recall-review-live-${showLiveTimer}.png`,
    });
    await popup.getByRole("button", { name: /^Close/ }).click();
    await expect(popup).toHaveCount(0);
    await expect(
      page.getByRole("timer", { name: "Hold Space to start" }),
    ).toBeVisible();
    const row = page.locator("[data-attempt-row]").first();
    await expect(row).toHaveCSS("cursor", "default");
    const bg = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    await expect(row).not.toHaveCSS("background-color", bg);
    await row.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await row
      .locator("..")
      .getByRole("button", { name: /Delete attempt/ })
      .click();
    await expect(row).toHaveCount(0);
  });
for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test(`Recall review and Trace touch flow remain usable at ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript(seed, scheme);
    try {
      await page.goto("/training");
      await choose(page, "Memo Recall");
      const touchHold = async () => {
        const box = await page
          .getByRole("timer", { name: "Hold Space to start" })
          .boundingBox();
        const client = await context.newCDPSession(page);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: box!.x + 15, y: box!.y + 15 }],
        });
        await page.waitForTimeout(320);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await client.detach();
      };
      await touchHold();
      await expect(
        page.getByRole("timer", { name: "Memorisation" }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Ready/ }).tap();
      const inputs = page.getByRole("textbox", {
        name: /Recall (corners|edges)/,
      });
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        await inputs.nth(i).fill("AB");
        await inputs.nth(i).press("Enter");
      }
      const popup = page.getByRole("dialog", {
        name: "Memo Recall result",
        exact: true,
      });
      await expect(popup).toBeVisible();
      await expect(
        popup.getByRole("region", { name: "Solve summary" }),
      ).toBeVisible();
      expect(
        await popup.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await expect(
        popup.getByRole("button", { name: /^Close/ }),
      ).toBeInViewport();
      await page.screenshot({
        path: `test-results/recall-review-${width}.png`,
      });
      await popup.getByRole("button", { name: /^Close/ }).tap();
      await expect(popup).toHaveCount(0);
      await choose(page, "Trace Sprint");
      await expect(
        page.getByRole("region", { name: "Scramble", exact: true }),
      ).toHaveCount(0);
      await touchHold();
      await expect(
        page.getByRole("textbox", { name: "Corners targets", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: /^Submit/ }).tap();
      const trace = page.getByRole("dialog", {
        name: "Trace Sprint review",
        exact: true,
      });
      await expect(trace).toBeVisible();
      await trace.getByRole("button", { name: /^Next/ }).tap();
      await expect(trace).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

test("one native 150% Training zoom sanity check preserves settled layout", async () => {
  const { nativeBrowser } =
    await import("../scripts/native-browser-session.mjs");
  const native = await nativeBrowser("chrome");
  try {
    const page = native.page as Page;
    await page.addInitScript(seed, scheme);
    await native.resize(1440, 900);
    await native.navigate(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5186"}/training`,
    );
    await choose(page, "Memo Recall");
    const geometry = () =>
      page.evaluate(() => ({
        layout: document.documentElement.getAttribute("data-viewport-layout"),
        boxes: [
          "[data-subnav-column]",
          "[data-workspace-reference]",
          "[data-timer-cube-viewport]",
          "main [role=timer]",
        ].map((selector) => {
          const box = document.querySelector(selector)!.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height];
        }),
      }));
    const before = await geometry();
    await native.zoom(1.5);
    await expect(page.locator("html")).toHaveAttribute("data-zoom-ack", "1.5");
    await expect(page.locator("html")).toHaveCSS("zoom", "1");
    await expect(
      page.locator('[data-training-region][data-transitioning="true"]'),
    ).toHaveCount(0);
    const after = await geometry();
    expect(after.layout).toBe(before.layout);
    for (let index = 0; index < before.boxes.length; index++)
      for (let coord = 0; coord < 4; coord++)
        expect(
          Math.abs(
            after.boxes[index][coord] * 1.5 - before.boxes[index][coord],
          ),
        ).toBeLessThan(2);
    await native.screenshot("test-results/training-continuity-native150.png");
  } finally {
    await native.close();
  }
});

test("rapid reversals and reduced motion keep the shared workspace anchored", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  const samples = await page.evaluate(async () => {
    const h = document.querySelector("[data-training-history]")!,
      nav = document.querySelector("[data-subnav-column]")!;
    const rows: number[][] = [];
    const snap = () =>
      rows.push([
        h.getBoundingClientRect().y,
        nav.getBoundingClientRect().x,
        nav.getBoundingClientRect().y,
      ]);
    snap();
    (
      document.querySelector(
        'button[role=radio][aria-label="Trace Sprint"]',
      ) as HTMLElement
    ).click();
    for (let index = 0; index < 6; index++) {
      await new Promise(requestAnimationFrame);
      snap();
    }
    (
      document.querySelector(
        'button[role=radio][aria-label="Execution Sprint"]',
      ) as HTMLElement
    ).click();
    for (let index = 0; index < 60; index++) {
      await new Promise(requestAnimationFrame);
      snap();
    }
    return rows;
  });
  for (let index = 1; index < samples.length; index++) {
    expect(Math.abs(samples[index][0] - samples[index - 1][0])).toBeLessThan(
      160,
    );
    expect(samples[index].slice(1)).toEqual(samples[0].slice(1));
  }
  await expect(
    page.locator('[data-training-region][data-transitioning="true"]'),
  ).toHaveCount(0);
  expect(samples.at(-1)![0]).toBeCloseTo(samples[0][0], 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await choose(page, "Trace Sprint");
  await expect(page.locator("[data-training-region=cube]")).toHaveCSS(
    "height",
    "0px",
  );
  await expect(page.locator("[data-training-region=scramble]")).toHaveCSS(
    "height",
    "0px",
  );
  await expect(
    page.locator('[data-training-region][data-transitioning="true"]'),
  ).toHaveCount(0);
});

test("switching a held Space into Memo Recall cancels the old hold and preserves editable input ownership", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page
    .getByRole("radio", { name: "Execution Sprint", exact: true })
    .click();
  await page.keyboard.down("Space");
  await expect(
    page.getByRole("timer", { name: "Ready, release to start" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
  await page.keyboard.up("Space");
  await expect(
    page.locator('[data-training-region][data-transitioning="true"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("timer", { name: "Hold Space to start" }),
  ).toBeVisible();
  await hold(page);
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  await page.keyboard.press("Space");
  const input = page
    .getByRole("textbox", { name: /Recall (corners|edges)/ })
    .first();
  await expect(input).toBeFocused();
  const clock = page.getByRole("timer", { name: "Recall" });
  const before = await clock.textContent();
  await input.press("Space");
  await expect(clock).not.toHaveText(before!);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
          .length,
    ),
  ).toBe(0);
});

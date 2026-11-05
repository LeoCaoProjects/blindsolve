import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

const scheme = createSpeffzScheme();
const section = (piece: "edge" | "corner", count: number) => {
  const stickers = Object.values(scheme.stickers).filter(
    (s) => s.pieceType === piece,
  );
  return Array.from({ length: count }, (_, i) => ({
    firstStickerId: stickers[(i * 2) % stickers.length].id,
    secondStickerId: stickers[(i * 2 + 1) % stickers.length].id,
    firstToken: stickers[(i * 2) % stickers.length].label,
    secondToken: stickers[(i * 2 + 1) % stickers.length].label,
    mnemonic:
      count === 1
        ? "Mnemonic 1"
        : `Mnemonic ${i + 1} � Operating Room and Experience orb with a deliberately long complete phrase`,
  }));
};
const base = {
  scramble: "R U F",
  memoMs: 410640,
  executionMs: 98020,
  totalMs: 508660,
  result: "dnf",
  edgeMemo: [],
  cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
  schemeSnapshot: scheme,
  createdAt: "2026-11-05T00:00:00.000Z",
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (data) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
        );
    },
    {
      scheme,
      pairs: {},
      attempts: [],
      onboarded: true,
      memoOrder: "edges-first",
      solves: [
        {
          ...base,
          id: "50000000-0000-4000-8000-000000000001",
          memoSnapshot: {
            edges: section("edge", 1),
            corners: section("corner", 1),
          },
        },
        {
          ...base,
          id: "50000000-0000-4000-8000-000000000002",
          timerMode: "edges",
          memoSnapshot: { edges: section("edge", 20), corners: [] },
        },
      ],
    },
  );
});

for (const [width, height] of [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
])
  test(`mode changes preserve Timer geometry at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const icon = page.getByRole("button", {
      name: "New scramble",
      exact: true,
    });
    await expect(icon).toBeEnabled({ timeout: 45000 });
    await expect(icon).toHaveText("");
    const scramble = page.getByRole("region", {
      name: "Scramble",
      exact: true,
    });
    const footer = page.getByRole("region", { name: "Last solve memo" });
    const clock = page.locator("[data-timer-clock]");
    const phase = clock.locator('[aria-live="polite"]');
    const modes = page.getByRole("radiogroup", { name: "Timer mode" });
    const measure = async () =>
      Promise.all([
        scramble.boundingBox(),
        icon.boundingBox(),
        clock.boundingBox(),
        phase.boundingBox(),
        footer.boundingBox(),
        modes.boundingBox(),
      ]);
    const before = await measure();
    console.log("TIMER_STRIP_GEOMETRY", {
      width,
      height,
      header: before[0]!.height,
      footer: before[4]!.height,
      selector: before[5]!.height,
    });
    const scrambleContent = (await scramble
      .locator(":scope > div")
      .first()
      .boundingBox())!;
    expect(before[5]!.y).toBeGreaterThanOrEqual(
      scrambleContent.y + scrambleContent.height,
    );
    expect(before[2]!.x).toBe(width >= 768 ? 168 : 24);
    expect(
      (await scramble.locator(":scope > div").first().boundingBox())!.x,
    ).toBe(before[2]!.x);
    expect(
      (await footer.getByRole("heading", { name: "Last memo" }).boundingBox())!
        .x,
    ).toBe(before[2]!.x);
    expect(before[1]!.y).toBeLessThan(before[0]!.y + 40);
    expect(before[5]!.height).toBe(24);
    expect(before[4]!.height).toBe(80);
    expect(before[5]!.y).toBeGreaterThan(before[0]!.y);
    expect(before[5]!.y + before[5]!.height).toBeLessThanOrEqual(
      before[0]!.y + before[0]!.height,
    );
    expect(before[5]!.width).toBeLessThan(170);
    await expect(footer).not.toContainText("DNF");
    await expect(footer).not.toContainText("8:28.66");
    expect(
      await footer
        .getByLabel("Previous memo content")
        .evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);
    const edges = footer.getByRole("region", { name: "Previous edges memo" });
    const corners = footer.getByRole("region", {
      name: "Previous corners memo",
    });
    if (width >= 768) {
      const a = (await edges.boundingBox())!,
        b = (await corners.boundingBox())!;
      expect(b.x - a.x - a.width).toBeLessThanOrEqual(34);
    }
    for (const mode of ["Edges", "Corners", "3BLD"]) {
      await modes.getByRole("radio", { name: mode, exact: true }).click();
      await expect(icon).toBeEnabled({ timeout: 45000 });
      const after = await measure();
      for (let i = 0; i < before.length; i++)
        for (const key of ["x", "y", "width", "height"] as const)
          expect(
            Math.abs(after[i]![key] - before[i]![key]),
            `${mode} ${i} ${key}`,
          ).toBeLessThan(1);
      await expect(page.getByRole("timer")).toHaveText("0.00");
      if (mode === "Corners")
        await expect(footer.getByLabel("No previous memo")).toBeVisible();
      if (mode === "Edges") {
        const content = footer.getByLabel("Previous memo content");
        expect(
          await content.evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBe(true);
        expect(
          await content.evaluate((el) => el.scrollHeight <= el.clientHeight),
        ).toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (
        process.env.TIMER_REFINEMENT_DIR &&
        (width === 320 || width === 1440)
      ) {
        await mkdir(process.env.TIMER_REFINEMENT_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.TIMER_REFINEMENT_DIR,
            `${mode.toLowerCase()}-${width}.png`,
          ),
        });
      }
    }
    if (process.env.TIMER_REFINEMENT_DIR) {
      await mkdir(process.env.TIMER_REFINEMENT_DIR, { recursive: true });
      await page.screenshot({
        path: join(process.env.TIMER_REFINEMENT_DIR, `timer-${width}.png`),
      });
    }
  });

for (const mode of ["3bld", "corners"] as const)
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [900, 560],
    [390, 844],
    [320, 568],
  ])
    test(`long ${mode} memo remains readable in its reserved footer at ${width}`, async ({
      page,
    }) => {
      await page.addInitScript(
        (data) =>
          localStorage.setItem(
            "cubeiq-bld-v2:guest",
            JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
          ),
        {
          scheme,
          pairs: {},
          attempts: [],
          onboarded: true,
          activeTimerMode: mode,
          solves: [
            {
              ...base,
              id: "50000000-0000-4000-8000-000000000003",
              timerMode: mode,
              memoSnapshot: {
                edges: mode === "3bld" ? section("edge", 20) : [],
                corners: section("corner", 20),
              },
            },
          ],
        },
      );
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const footer = page.getByRole("region", { name: "Last solve memo" });
      const content = footer.getByLabel("Previous memo content");
      await expect(
        footer.getByRole("region", { name: "Previous corners memo" }),
      ).toBeVisible();
      const before = await footer.boundingBox();
      expect(before!.height).toBe(80);
      const label = footer.getByRole("heading", { name: "Last memo" });
      const labelBefore = await label.boundingBox();
      const entries = footer.locator("li");
      const rows = await entries.evaluateAll((elements) =>
        elements.map((el) => ({
          y: el.getBoundingClientRect().y,
          height: el.getBoundingClientRect().height,
          whiteSpace: getComputedStyle(el).whiteSpace,
        })),
      );
      expect(rows.length).toBeGreaterThanOrEqual(20);
      expect(new Set(rows.map((row) => row.y)).size).toBe(1);
      expect(
        rows.every((row) => row.whiteSpace === "nowrap" && row.height <= 20),
      ).toBe(true);
      expect(
        await content.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      await content.hover();
      if (width === 320) {
        const box = (await content.boundingBox())!;
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: box.x + box.width - 10, y: box.y + box.height / 2 },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: box.x + 10, y: box.y + box.height / 2 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await expect
          .poll(() => content.evaluate((el) => el.scrollLeft))
          .toBeGreaterThan(0);
        await cdp.detach();
        await content.evaluate((el) => {
          el.scrollLeft = 0;
        });
      }
      await page.mouse.wheel(0, 220);
      await expect
        .poll(() => content.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(0);
      expect(await label.boundingBox()).toEqual(labelBefore);
      const last = footer
        .getByRole("region", { name: "Previous corners memo" })
        .getByText(/^Mnemonic 20 � Operating Room/);
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect(
        await content.evaluate((el) => el.scrollHeight <= el.clientHeight),
      ).toBe(true);
      const after = await footer.boundingBox();
      expect(after).toEqual(before);
      expect(await label.boundingBox()).toEqual(labelBefore);
      expect(
        await last.evaluate(
          (el) =>
            el.scrollWidth <= el.clientWidth &&
            getComputedStyle(el).textOverflow !== "ellipsis",
        ),
      ).toBe(true);
      if (process.env.TIMER_REFINEMENT_DIR) {
        await mkdir(process.env.TIMER_REFINEMENT_DIR, { recursive: true });
        await page.screenshot({
          path: join(
            process.env.TIMER_REFINEMENT_DIR,
            `long-${mode}-${width}.png`,
          ),
        });
      }
    });

for (const reduced of [false, true])
  test(`execution feedback is immediate${reduced ? " with reduced motion" : ""}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    if (reduced)
      await page
        .getByRole("region", { name: "Scramble", exact: true })
        .click({ position: { x: 5, y: 5 } });
    else {
      await page.getByRole("radio", { name: "Edges", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "New scramble", exact: true }),
      ).toBeEnabled({ timeout: 45000 });
    }
    await page.keyboard.down("Space");
    await page.waitForTimeout(400);
    await page.keyboard.up("Space");
    await expect(page.getByText("Memorising", { exact: true })).toBeVisible();
    const before = await page.getByRole("timer").boundingBox();
    await page.keyboard.press("Space");
    await expect(page.getByText("Executing", { exact: true })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveClass(/timer-execution-cue/);
    expect(
      await page
        .getByRole("timer")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe(reduced ? "none" : "timer-execution-cue");
    const after = await page.getByRole("timer").boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    await page.keyboard.press("Space");
    await expect(
      page
        .getByRole("dialog", { name: "Memo reconstruction" })
        .getByRole("region", { name: "Solve summary" }),
    ).toBeVisible();
  });

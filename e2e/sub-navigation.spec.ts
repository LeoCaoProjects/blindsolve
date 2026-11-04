import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme, stickersFor } from "../src/domain/bld/speffz";
import { pairKey } from "../src/domain/letterPairs";

test.beforeEach(async ({ page }) => {
  const scheme = createSpeffzScheme();
  const stickers = stickersFor(scheme, "edge");
  const first = stickers.find((sticker) => sticker.label === "T")!;
  const second = stickers.find((sticker) => sticker.label === "W")!;
  await page.addInitScript(
    ({ scheme, key, first, second }) => {
      if (!localStorage.getItem("cubeiq-bld-v2:guest"))
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              onboarded: true,
              solves: [],
              attempts: [],
              pairs: {
                [key]: {
                  id: crypto.randomUUID(),
                  firstStickerId: first.id,
                  secondStickerId: second.id,
                  firstToken: "T",
                  secondToken: "W",
                  primaryMnemonic: "tow",
                  alternates: [],
                  encounters: 0,
                  forgotten: 0,
                  updatedAt: "2026-11-05T00:00:00.000Z",
                },
              },
              defaultCubeView: { top: "white", front: "green" },
            },
            revision: 0,
            dirty: false,
          }),
        );
    },
    { scheme, key: pairKey(first.id, second.id), first, second },
  );
});

type Sample = {
  width: number;
  x: number;
  overflow: boolean;
  headingX: number | null;
};
async function recordNavigation(page: Page, label: string) {
  await page.evaluate(() => {
    const recorder = window as unknown as { navFrames: Sample[] };
    recorder.navFrames = [];
    const sample = () => {
      recorder.navFrames.push({
        width:
          document
            .querySelector("[data-subnav-column]")
            ?.getBoundingClientRect().width ?? 0,
        x: document
          .querySelector("[data-page-workspace]")!
          .getBoundingClientRect().x,
        overflow: document.documentElement.scrollWidth > innerWidth,
        headingX:
          document
            .querySelector('[data-section="cube"] h2')
            ?.getBoundingClientRect().x ?? null,
      });
      if (recorder.navFrames.length < 40) requestAnimationFrame(sample);
    };
    document.addEventListener("click", () => requestAnimationFrame(sample), {
      once: true,
      capture: true,
    });
  });
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link", { name: label, exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { navFrames: Sample[] }).navFrames.length,
      ),
    )
    .toBe(40);
  return page.evaluate(
    () => (window as unknown as { navFrames: Sample[] }).navFrames,
  );
}

test("shared sub nav moves the real workspace and stays stable between contextual pages", async ({
  page,
}) => {
  await page.goto("/");
  for (const [label, from, to] of [
    ["Training", 0, 224],
    ["Timer", 224, 0],
    ["Settings", 0, 224],
    ["Training", 224, 224],
    ["Letter Pairs", 224, 224],
    ["Timer", 224, 0],
  ] as const) {
    const frames = await recordNavigation(page, label);
    expect(
      frames.every(
        (frame) =>
          !frame.overflow &&
          (Math.abs(frame.width) < 1 || Math.abs(frame.width - 224) < 1) &&
          frame.x >= 71 &&
          frame.x <= 297,
      ),
    ).toBe(true);
    expect(Math.abs(frames.at(-1)!.width - to)).toBeLessThan(0.5);
    expect(Math.abs(frames.at(-1)!.x - 72 - to)).toBeLessThan(0.5);
    if (from === to)
      expect(frames.every((frame) => Math.abs(frame.width - 224) < 0.5)).toBe(
        true,
      );
    else
      expect(frames.some((frame) => frame.x > 73 && frame.x < 295)).toBe(true);
    if (label === "Settings") {
      const headings = frames.flatMap((frame) =>
        frame.headingX === null ? [] : [frame.headingX],
      );
      expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(20);
    }
    expect(
      Math.max(...frames.slice(-5).map((frame) => frame.x)) -
        Math.min(...frames.slice(-5).map((frame) => frame.x)),
    ).toBeLessThan(0.5);
  }
});

test("sliding selection is shared, responsive and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/training");
  for (const [group, label] of [
    ["Pieces", "Edges"],
    ["Show", "Words"],
  ]) {
    const control = page.getByRole("radiogroup", { name: group, exact: true });
    const old = (await control
      .locator("[data-selection-indicator]")
      .boundingBox())!;
    const trace = page.evaluate(
      (group) =>
        new Promise<number[]>((resolve) => {
          const positions: number[] = [];
          const sample = () => {
            const indicator = document.querySelector(
              `[role="radiogroup"][aria-label="${group}"] [aria-checked="true"] [data-selection-indicator]`,
            );
            if (indicator) positions.push(indicator.getBoundingClientRect().x);
            if (positions.length < 30) requestAnimationFrame(sample);
            else resolve(positions);
          };
          requestAnimationFrame(sample);
        }),
      group,
    );
    await control.getByRole("radio", { name: label, exact: true }).click();
    await expect(
      control.getByRole("radio", { name: label, exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(
        async () => await control.locator("[data-selection-indicator]").count(),
      )
      .toBe(1);
    await expect
      .poll(
        async () =>
          (await control.locator("[data-selection-indicator]").boundingBox())!
            .x,
      )
      .toBeGreaterThan(old.x + 10);
    const positions = await trace;
    const final = (await control
      .locator("[data-selection-indicator]")
      .boundingBox())!.x;
    expect(positions.some((x) => x > old.x + 1 && x < final - 1)).toBe(true);
    expect(positions.every((x) => x >= old.x - 1 && x <= final + 1)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const frames = await recordNavigation(page, "Settings");
  expect(frames.every((frame) => frame.width < 1 || frame.width > 223)).toBe(
    true,
  );
});

test("contextual navigation remains usable at every requested viewport", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 900, height: 560 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    for (const [path, label] of [
      ["/training", "Training controls"],
      ["/settings", "Settings sections"],
      ["/pairs", "Letter Pairs navigation"],
    ]) {
      await page.goto(path);
      if (viewport.width >= 1024) {
        await expect
          .poll(
            async () =>
              (
                await page
                  .getByRole("complementary", { name: label, exact: true })
                  .boundingBox()
              )?.width,
          )
          .toBe(224);
      } else {
        await page.getByRole("button", { name: label, exact: true }).click();
        const sheet = page.getByRole("dialog", { name: label, exact: true });
        await expect(sheet).toBeVisible();
        if (path === "/training") {
          await expect(
            sheet.getByRole("radio", { name: "Trace Sprint", exact: true }),
          ).toBeVisible();
          await sheet
            .getByRole("radiogroup", { name: "Show" })
            .getByRole("radio", { name: "Words", exact: true })
            .click();
        }
        if (path === "/settings")
          await expect(
            sheet.getByRole("link", { name: "Run first-use setup" }),
          ).toHaveAttribute("href", "/setup");
        if (path === "/pairs")
          await sheet
            .getByRole("button", { name: /^X, / })
            .scrollIntoViewIfNeeded();
        await sheet.getByRole("button", { name: "Close", exact: true }).click();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("Settings sections and setup utility retain their real actions", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/settings");
    for (const label of [
      "Cube & lettering",
      "Methods",
      "Timer",
      "Account & sync",
      "Data",
      "Support",
    ]) {
      if (width < 1024)
        await page
          .getByRole("button", { name: "Settings sections", exact: true })
          .click();
      await page
        .getByRole("navigation", { name: "Settings sections", exact: true })
        .getByRole("button", { name: label, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeInViewport();
    }
    if (width < 1024)
      await page
        .getByRole("button", { name: "Settings sections", exact: true })
        .click();
    await page
      .getByRole("link", { name: "Run first-use setup", exact: true })
      .click();
    await expect(page).toHaveURL(/\/setup$/);
  }
});

test("Letter Pairs keeps every token, live counts and workspace keyboard navigation", async ({
  page,
}) => {
  await page.goto("/pairs");
  const index = page.getByRole("navigation", { name: "First letter" });
  await expect(
    index.getByRole("button", { name: "T, 1 of 23 filled", exact: true }),
  ).toBeVisible();
  const buttons = await index.getByRole("button").all();
  for (const button of buttons) {
    const token = (await button.getAttribute("aria-label"))!.split(",")[0];
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "true");
    await expect(
      page.getByRole("heading", {
        name: `Pairs starting with ${token}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await index.getByRole("button", { name: /^A, / }).press("ArrowDown");
  await expect(index.getByRole("button", { name: /^B, / })).toBeFocused();
  await page.getByRole("gridcell", { name: /^BA,/ }).focus();
  await page.keyboard.press("]");
  await expect(
    page.getByRole("heading", { name: "Pairs starting with C", exact: true }),
  ).toBeVisible();
});

test("reversing a sidebar transition preserves its current visual position", async ({
  page,
}) => {
  await page.goto("/training");
  await expect(
    page.getByRole("region", { name: "Scramble" }).locator(".sr-only"),
  ).toContainText("Scramble ");
  const positions = await page.evaluate(async () => {
    const workspace = document.querySelector<HTMLElement>(
      "[data-page-workspace]",
    )!;
    const outgoing = await new Promise<Animation>((resolve) => {
      const observer = new MutationObserver(() => {
        const animation = workspace.getAnimations()[0];
        if (!animation) return;
        animation.pause();
        animation.currentTime = 45;
        observer.disconnect();
        resolve(animation);
      });
      observer.observe(document.querySelector("[data-subnav-column]")!, {
        attributes: true,
        attributeFilter: ["style"],
      });
      document
        .querySelector<HTMLAnchorElement>(
          'nav[aria-label="Sections"] a[href="/"]',
        )!
        .click();
    });
    const before = workspace.getBoundingClientRect().x;
    const after = await new Promise<number>((resolve) => {
      const observer = new MutationObserver(() => {
        const incoming = workspace
          .getAnimations()
          .find((animation) => animation !== outgoing);
        if (!incoming) return;
        incoming.pause();
        incoming.currentTime = 0;
        observer.disconnect();
        resolve(workspace.getBoundingClientRect().x);
        incoming.finish();
      });
      observer.observe(document.querySelector("[data-subnav-column]")!, {
        attributes: true,
        attributeFilter: ["style"],
      });
      document
        .querySelector<HTMLAnchorElement>(
          'nav[aria-label="Sections"] a[href="/training"]',
        )!
        .click();
    });
    return { before, after };
  });
  expect(Math.abs(positions.before - positions.after)).toBeLessThan(1);
  await expect
    .poll(
      async () =>
        (await page.locator("[data-page-workspace]").boundingBox())!.x,
    )
    .toBe(296);
});

// Local investigation only. Native page zoom is set through browser privileges;
// the application never receives those privileges or a zoom-detection shortcut.
import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const levels = process.env.ZOOM_LEVELS
  ? process.env.ZOOM_LEVELS.split(",").map(Number)
  : process.env.ZOOM_BASELINE_ONLY
    ? [1]
    : [1, 0.5, 0.67, 0.8, 0.9, 1.1, 1.25, 1.5, 1.75, 2];
export const modes = process.env.ZOOM_MODES?.split(",") ?? [
  "baseline",
  "zoom",
  "transform",
];
export const routes = process.env.ZOOM_ROUTES
  ? process.env.ZOOM_ROUTES.split(",")
  : process.env.ZOOM_VIEWPORT
    ? ["/", "/settings"]
    : [
        "/",
        "/training",
        "/settings",
        "/pairs",
        "/flashcards",
        "/signin",
      ];
export const sizes = [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
  ...(process.env.ZOOM_VIEWPORT
    ? [
        [1920, 400],
        [900, 1400],
        [2560, 1080],
        [1440, 300],
      ]
    : []),
];
export const base = process.env.ZOOM_BASE_URL ?? "http://127.0.0.1:5186";
export const output = resolve(
  process.env.ZOOM_OUTPUT ?? "test-results/zoom-audit",
);
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export function measure() {
  const visible = (el) =>
    el &&
    el.getBoundingClientRect().width > 0 &&
    el.getBoundingClientRect().height > 0;
  const selectors = {
    nav: 'nav[aria-label="Sections"]',
    subnav: "[data-subnav-column]",
    timer: '[role="timer"]',
    scramble: '[aria-label="Scramble"]',
    cube: "[data-timer-cube-viewport]",
    cubeDrawing: '[role="group"][aria-label="Scrambled cube"]',
    history: '[aria-label="Solves"]',
    footer: '[aria-label="Last solve memo"]',
    button: 'button[aria-label="New scramble"]',
    buttonIcon: 'button[aria-label="New scramble"] svg',
    aa: 'button[aria-label="Sticker letters"]',
    main: "main",
    workspace: "[data-page-workspace]",
    settingsSection: '[data-section="cube"]',
    dialog: '[role="dialog"]',
    input: "input",
    stats: ".timer-reference-column dl",
    navText: 'nav[aria-label="Sections"] a',
  };
  const elements = {};
  for (const [key, selector] of Object.entries(selectors)) {
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) {
      elements[key] = null;
      continue;
    }
    const r = el.getBoundingClientRect(),
      css = getComputedStyle(el);
    let ink = null;
    if (key === "timer") {
      const range = document.createRange();
      range.selectNodeContents(el);
      const b = range.getBoundingClientRect();
      ink = { width: b.width, height: b.height };
    }
    elements[key] = {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      font: parseFloat(css.fontSize),
      ink,
    };
  }
  return {
    url: location.pathname,
    dpr: devicePixelRatio,
    inner: [innerWidth, innerHeight],
    outer: [outerWidth, outerHeight],
    screen: [screen.width, screen.height],
    visualScale: visualViewport?.scale,
    sizingActive: document.documentElement.hasAttribute("data-viewport-sizing"),
    rootTransform: getComputedStyle(document.documentElement).transform,
    cssZoom: getComputedStyle(document.documentElement).zoom,
    resetSupported: CSS.supports("zoom", "reset"),
    rootFont: getComputedStyle(document.documentElement).fontSize,
    bodyFont: getComputedStyle(document.body).fontSize,
    breakpoints: [
      matchMedia("(min-width:768px)").matches,
      matchMedia("(min-width:1024px)").matches,
    ],
    overflow: document.documentElement.scrollWidth > innerWidth,
    elements,
  };
}
export function prototype({ mode, zoom }) {
  const root = document.documentElement;
  root.style.cssText = "";
  if (mode === "viewport-root") root.style.fontSize = "2.133333333333vh";
  if (mode === "viewport-bounded")
    root.style.fontSize = "clamp(12px, 2.133333333333vh, 32px)";
  if (mode === "zoom") root.style.zoom = String(1 / zoom);
  if (mode === "transform") {
    root.style.transformOrigin = "0 0";
    root.style.transform = `scale(${1 / zoom})`;
    root.style.width = `${100 * zoom}%`;
    root.style.height = `${100 * zoom}%`;
  }
}

async function runChromium() {
  await mkdir(output, { recursive: true });
  const rows = [],
    responsive = [];
  for (const zoom of levels) {
    const profile = await mkdtemp(join(tmpdir(), "blindsolve-chrome-zoom-"));
    await mkdir(join(profile, "Default"));
    await writeFile(
      join(profile, "Default", "Preferences"),
      JSON.stringify({
        partition: {
          default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) },
        },
      }),
    );
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      viewport: null,
      args: ["--window-size=1440,987"],
    });
    try {
      const page = context.pages()[0];
      await page.emulateMedia({ reducedMotion: "reduce" });
      const cdp = await context.newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      await page.goto(base);
      await page.locator('[role="timer"]').waitFor();
      await pause(700);
      const trim = await page.evaluate(
        (z) => ({
          width: outerWidth - innerWidth * z,
          height: outerHeight - innerHeight * z,
        }),
        zoom,
      );
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: {
          width: Math.round(1440 + trim.width),
          height: Math.round(900 + trim.height),
        },
      });
      const actual = await page.evaluate(() => devicePixelRatio);
      if (Math.abs(actual - zoom) > 0.02)
        throw Error(`Native zoom not applied: expected ${zoom}, DPR ${actual}`);
      for (const route of routes) {
        await page.goto(base + route);
        await page.locator("body").waitFor();
        await pause(700);
        if (
          (process.env.ZOOM_BASELINE_ONLY || process.env.ZOOM_VIEWPORT) &&
          ["/", "/training"].includes(route)
        )
          await page
            .getByRole("button", { name: "New scramble", exact: true })
            .waitFor({ state: "visible" })
            .then(async () => {
              await page.waitForFunction(
                () =>
                  !document.querySelector('button[aria-label="New scramble"]')
                    ?.disabled,
                {},
                { timeout: 45000 },
              );
            });
        for (const mode of modes) {
          if (mode === "viewport") {
            await page.goto(base + route + "?sizing=viewport");
            await pause(700);
            if (route === "/")
              await page.waitForFunction(
                () =>
                  !document.querySelector('button[aria-label="New scramble"]')
                    ?.disabled,
                {},
                { timeout: 45000 },
              );
          }
          await page.evaluate(prototype, { mode, zoom });
          await pause(200);
          const row = {
            browser: await context.browser().version(),
            zoom,
            mode,
            ...(await page.evaluate(measure)),
          };
          rows.push(row);
          if (process.env.ZOOM_BASELINE_ONLY && mode === "baseline") {
            const capture = await cdp.send("Page.captureScreenshot", {
              format: "png",
              captureBeyondViewport: false,
            });
            await writeFile(
              join(output, `chromium-ready-${route.slice(1) || "timer"}.png`),
              Buffer.from(capture.data, "base64"),
            );
          }
          if (route === "/" && mode !== "transform") {
            const screenshot = await cdp.send("Page.captureScreenshot", {
              format: "png",
              captureBeyondViewport: false,
            });
            await writeFile(
              join(output, `chromium-${zoom}-${mode}.png`),
              Buffer.from(screenshot.data, "base64"),
            );
          }
          if (route === "/" && mode !== "transform") {
            const trigger = page.getByRole("button", {
              name: "Timer mode",
              exact: true,
            });
            if (await trigger.isVisible()) {
              await trigger.click();
              await pause(250);
              rows.push({
                browser: "chromium",
                zoom,
                mode,
                overlay: "popover",
                ...(await page.evaluate(measure)),
              });
              await page.keyboard.press("Escape");
              await pause(200);
            }
            const shortcuts = page.getByRole("button", {
              name: "Keyboard shortcuts  ?",
            });
            if (await shortcuts.isVisible()) {
              await shortcuts.click();
              await pause(250);
              rows.push({
                browser: "chromium",
                zoom,
                mode,
                overlay: "sheet",
                ...(await page.evaluate(measure)),
              });
              await page.keyboard.press("Escape");
              await pause(200);
            }
          }
        }
        await page.evaluate(prototype, { mode: "baseline", zoom });
      }
      if (zoom === 1 && !process.env.ZOOM_SKIP_RESIZE) {
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          for (const route of routes.slice(0, 5)) {
            await page.goto(
              base +
                route +
                (process.env.ZOOM_VIEWPORT ? "?sizing=viewport" : ""),
            );
            await pause(400);
            responsive.push({
              width,
              height,
              ...(await page.evaluate(measure)),
            });
          }
        }
      }
      console.log("Chromium measured", zoom);
      await writeFile(
        join(
          output,
          process.env.ZOOM_BASELINE_ONLY
            ? "chromium-baseline.json"
            : "chromium.json",
        ),
        JSON.stringify({ rows, responsive }, null, 2),
      );
    } finally {
      await context.close();
    }
  }
}
async function runDisplayScaleProbe() {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const displayScale of [1, 1.25, 2]) {
    const context = await chromium.launchPersistentContext("", {
      channel: "chrome",
      headless: true,
      viewport: null,
      args: [
        `--force-device-scale-factor=${displayScale}`,
        "--window-size=1440,987",
      ],
    });
    try {
      const page = context.pages()[0];
      await page.goto(base);
      rows.push({
        displayScale,
        pageZoom: 1,
        ...(await page.evaluate(measure)),
      });
    } finally {
      await context.close();
    }
  }
  await writeFile(
    join(output, "display-scale.json"),
    JSON.stringify(rows, null, 2),
  );
  console.log(
    rows.map(({ displayScale, dpr, visualScale }) => ({
      displayScale,
      dpr,
      visualScale,
    })),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.env.ZOOM_DPI_ONLY) await runDisplayScaleProbe();
  else await runChromium();
}

import { nativeBrowser, pause } from "./native-browser-session.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const engine = process.env.ZOOM_ENGINE ?? "chrome";
const phase = process.env.ZOOM_PHASE ?? "before";
const output = resolve("test-results/responsive-zoom", phase);
await mkdir(output, { recursive: true });
const browser = await nativeBrowser(engine);
const resize = process.env.ZOOM_NATIVE_WINDOW
  ? browser.resizeWindow
  : browser.resize;
const base = process.env.ZOOM_BASE_URL ?? "http://127.0.0.1:5186";
const routes = process.env.ZOOM_ROUTES?.split(",") ?? [
  "/",
  "/training",
  "/pairs",
  "/flashcards",
  "/settings",
  "/signin",
];
const levels = [1, 0.5, 0.8, 1.25, 1.5, 2, 1];
function snapshot() {
  const rect = (el) => {
    const r = el.getBoundingClientRect(),
      s = getComputedStyle(el);
    return {
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      display: s.display,
      columns: s.gridTemplateColumns,
      direction: s.flexDirection,
      transform: s.transform,
    };
  };
  const groups = {};
  for (const selector of [
    'nav[aria-label="Sections"]',
    "[data-subnav-column]",
    "[data-page-workspace]",
    '[role="timer"]',
    "[data-timer-cube-viewport]",
    '[role="group"]',
    '[data-section="cube"]',
    "main",
    "aside",
    '[role="dialog"]',
  ])
    groups[selector] = Array.from(document.querySelectorAll(selector))
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map(rect);
  const rootFont = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return {
    dpr: devicePixelRatio,
    inner: [innerWidth, innerHeight],
    outer: [outerWidth, outerHeight],
    screen: [screen.width, screen.height],
    available: [screen.availWidth, screen.availHeight],
    aspect: innerWidth / innerHeight,
    normalizedWidth: (innerWidth * 19.2) / rootFont,
    rootFont,
    layout: document.documentElement.getAttribute("data-viewport-layout"),
    groups,
    inputs: [...document.querySelectorAll("input,textarea")].map((el) => ({
      name: el.getAttribute("aria-label") ?? el.getAttribute("name"),
      value: el.value,
    })),
    selected: [
      ...document.querySelectorAll(
        '[aria-selected="true"],[aria-current="true"],[aria-checked="true"]',
      ),
    ].map((el) => el.textContent?.trim()),
    scroll: [...document.querySelectorAll(".scroll-quiet")].map(
      (el) => el.scrollTop * devicePixelRatio,
    ),
    animations: document
      .getAnimations()
      .filter((a) => a.playState === "running").length,
  };
}
function beginTrace() {
  const frames = [],
    events = [];
  window.__responsiveAudit = { frames, events };
  const original = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    if (this.matches("[data-page-workspace]"))
      events.push({ type: "workspace-animation", at: performance.now(), args });
    return original.apply(this, args);
  };
  const until = performance.now() + 850;
  const frame = () => {
    const sub = document.querySelector("[data-subnav-column]"),
      work = document.querySelector("[data-page-workspace]"),
      cube = document.querySelector('[role="group"].touch-none');
    const r = (el) =>
      el
        ? {
            x: el.getBoundingClientRect().x * devicePixelRatio,
            width: el.getBoundingClientRect().width * devicePixelRatio,
            transform: getComputedStyle(el).transform,
            style: el.getAttribute("style"),
          }
        : null;
    frames.push({
      at: performance.now(),
      dpr: devicePixelRatio,
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      sub: r(sub),
      work: r(work),
      cube: r(cube),
    });
    if (performance.now() < until) requestAnimationFrame(frame);
    else Element.prototype.animate = original;
  };
  requestAnimationFrame(frame);
}
const rows = [],
  windows = [];
try {
  await browser.navigate(base + "/?sizing=viewport");
  await browser.zoom(1);
  await resize(1440, 900);
  await pause(300);
  for (const route of routes) {
    await browser.zoom(1);
    await browser.navigate(base + route + "?sizing=viewport");
    await pause(1200);
    for (let attempt = 0; attempt < 60; attempt++) {
      if (
        await browser.evaluate(
          () =>
            !!document.querySelector("#root")?.childElementCount &&
            !document.querySelector("vite-error-overlay"),
        )
      )
        break;
      if (attempt === 59) throw Error(`Application did not render at ${route}`);
      await pause(100);
    }
    await browser.evaluate(async () => {
      await document.fonts.ready;
    });
    for (const zoom of levels) {
      await browser.evaluate(beginTrace);
      await browser.zoom(zoom);
      await pause(950);
      const row = {
        engine,
        version: browser.version,
        route,
        zoom,
        ...(await browser.evaluate(snapshot)),
        trace: await browser.evaluate(() => window.__responsiveAudit),
      };
      rows.push(row);
      if ([1, 2].includes(zoom))
        await browser.screenshot(
          join(output, `${engine}-${route.slice(1) || "timer"}-${zoom}.png`),
        );
    }
    console.log(engine, phase, "measured", route);
    await writeFile(
      join(output, `${engine}.json`),
      JSON.stringify({ rows, windows }, null, 2),
    );
  }
  await browser.zoom(1);
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [900, 560],
    [390, 844],
    [320, 568],
    [1440, 900],
  ]) {
    await resize(width, height);
    await pause(250);
    for (const route of ["/training", "/settings"]) {
      await browser.navigate(base + route + "?sizing=viewport");
      await pause(500);
      windows.push({
        width,
        height,
        route,
        ...(await browser.evaluate(snapshot)),
      });
    }
  }
  await writeFile(
    join(output, `${engine}.json`),
    JSON.stringify({ rows, windows }, null, 2),
  );
} finally {
  await browser.close();
}

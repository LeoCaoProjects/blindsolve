import { nativeBrowser, pause } from "./native-browser-session.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createSpeffzScheme } from "../src/domain/bld/speffz.ts";
const engine = process.env.ZOOM_ENGINE ?? "chrome",
  phase = process.env.ZOOM_PHASE ?? "state-before";
const output = resolve("test-results/responsive-zoom", phase);
await mkdir(output, { recursive: true });
const browser = await nativeBrowser(engine),
  base = process.env.ZOOM_BASE_URL ?? "http://127.0.0.1:5186";
const rows = [];
function state() {
  const font = parseFloat(getComputedStyle(document.documentElement).fontSize),
    history = document.querySelector('[aria-label="Solves"]'),
    memo = document.querySelector('[aria-label="Previous memo content"]');
  return {
    root: font,
    historyRow: history?.scrollTop / ((36 * font) / 16),
    memoOffset: memo?.scrollLeft / (font / 16),
    popup: !!document.querySelector('[aria-label="Timer mode choices"]'),
    timer: document.querySelector('[role="timer"]')?.textContent,
    solves: JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest"))?.data.solves
      .length,
  };
}
try {
  await browser.navigate(base + "/?sizing=viewport");
  await browser.zoom(1);
  await browser.resize(1440, 900);
  await pause(1400);
  await browser.evaluate((scheme) => {
    const stored = {
      data: { scheme, pairs: {}, attempts: [], solves: [], onboarded: true },
      revision: 0,
      dirty: false,
      pending: {},
    };
    const stickers = Object.values(scheme.stickers).filter(
      (value) => value.pieceType === "edge",
    );
    const memo = Array.from({ length: 24 }, (_, i) => ({
      firstStickerId: stickers[(2 * i) % stickers.length].id,
      secondStickerId: stickers[(2 * i + 1) % stickers.length].id,
      firstToken: stickers[(2 * i) % stickers.length].label,
      secondToken: stickers[(2 * i + 1) % stickers.length].label,
      mnemonic: `Audit mnemonic ${i + 1} with long horizontal content`,
    }));
    stored.data.solves = Array.from({ length: 180 }, (_, i) => ({
      id: `50000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      scramble: "R U F",
      memoMs: 1000,
      executionMs: 2000,
      totalMs: 3000,
      result: "success",
      edgeMemo: [],
      cornerMemo: [],
      cycleBreaks: { edges: [], corners: [] },
      schemeSnapshot: scheme,
      memoSnapshot: { edges: memo, corners: [] },
      createdAt: new Date(Date.UTC(2026, 10, 5, 0, 0, i)).toISOString(),
    }));
    localStorage.setItem("cubeiq-bld-v2:guest", JSON.stringify(stored));
  }, createSpeffzScheme());
  await browser.navigate(base + "/?sizing=viewport");
  await pause(1800);
  await browser.evaluate(() => {
    document.querySelector('[aria-label="Solves"]').scrollTop = 900;
    document.querySelector('[aria-label="Previous memo content"]').scrollLeft =
      500;
  });
  await pause(200);
  await browser.click('button[aria-label="Timer mode"]');
  await pause(250);
  for (const zoom of [1, 0.5, 0.8, 1.25, 1.5, 2, 1]) {
    await browser.zoom(zoom);
    await pause(400);
    rows.push({
      test: "scroll-popup-history",
      zoom,
      ...(await browser.evaluate(state)),
    });
  }
  await browser.key("Escape");
  await browser.evaluate(() => {
    document.activeElement?.blur();
  });
  await browser.key("Space", 420);
  await pause(450);
  for (const zoom of [1, 2, 0.5, 1]) {
    await browser.zoom(zoom);
    await pause(450);
    rows.push({
      test: "running-timer",
      zoom,
      ...(await browser.evaluate(state)),
    });
  }
  await browser.key("Space");
  await browser.key("Space");
  await browser.navigate(base + "/training?sizing=viewport");
  await pause(900);
  await browser.evaluate(() => {
    const button = [
      ...document.querySelectorAll("[data-subnav-column] button"),
    ].find((el) => el.textContent.includes("Memo Recall"));
    if (!button) throw Error("Training mode control missing");
    button.click();
  });
  await pause(900);
  for (const zoom of [1, 2, 0.5, 1]) {
    await browser.zoom(zoom);
    await pause(300);
    rows.push({
      test: "training-mode",
      zoom,
      ...(await browser.evaluate(() => ({
        mode: document
          .querySelector(
            '[data-subnav-column] button[aria-label="Memo Recall"][aria-checked="true"]',
          )
          ?.getAttribute("aria-label"),
        challenge: document
          .querySelector("[data-training-challenge-id]")
          ?.getAttribute("data-training-challenge-id"),
      }))),
    });
  }
  await browser.evaluate(() => {
    const link = [
      ...document.querySelectorAll(
        'nav[aria-label="Sections"] a[href="/settings"]',
      ),
    ].find((el) => el.getBoundingClientRect().width > 0);
    link.click();
  });
  await pause(800);
  await browser.evaluate(() => {
    const button = [
      ...document.querySelectorAll('[aria-label="Cube mode"] button'),
    ].find((el) => el.textContent.trim() === "Lettering");
    if (!button) throw Error("Lettering control missing");
    button.click();
  });
  await pause(250);
  await browser.click('input[aria-label="Token"]');
  await browser.evaluate(() => {
    const input = document.querySelector('input[aria-label="Token"]');
    input.select();
    window.__auditTokenInput = input;
  });
  await browser.key("Z");
  await pause(150);
  for (const zoom of [1, 0.5, 0.8, 1.25, 1.5, 2, 1]) {
    await browser.zoom(zoom);
    await pause(250);
    rows.push({
      test: "settings-form",
      zoom,
      ...(await browser.evaluate(() => ({
        value: document.querySelector('input[aria-label="Token"]')?.value,
        sameInput:
          window.__auditTokenInput ===
          document.querySelector('input[aria-label="Token"]'),
        tab: document.querySelector(
          '[aria-label="Cube mode"] [aria-checked="true"]',
        )?.textContent,
      }))),
    });
  }
  await browser.evaluate(() => {
    const button = [
      ...document.querySelectorAll("[data-subnav-column] button"),
    ].find((el) => el.textContent.trim() === "Timer");
    if (!button) throw Error("Settings section control missing");
    button.click();
  });
  await pause(1000);
  for (const zoom of [1, 2, 0.5, 1]) {
    await browser.zoom(zoom);
    await pause(400);
    rows.push({
      test: "settings-section",
      zoom,
      ...(await browser.evaluate(() => ({
        section: document
          .querySelector('[data-subnav-column] [aria-current="true"]')
          ?.textContent?.trim(),
      }))),
    });
  }
  await browser.evaluate(() => {
    const section = document.querySelector('[data-section="methods"]'),
      scroll = section.closest(".scroll-quiet");
    scroll.scrollTop +=
      section.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      210;
  });
  await pause(400);
  for (const zoom of [1, 2, 0.5, 1]) {
    await browser.zoom(zoom);
    await pause(400);
    rows.push({
      test: "settings-section-boundary",
      zoom,
      ...(await browser.evaluate(() => ({
        section: document
          .querySelector('[data-subnav-column] [aria-current="true"]')
          ?.textContent?.trim(),
      }))),
    });
  }
  await writeFile(
    join(output, `${engine}-state.json`),
    JSON.stringify(rows, null, 2),
  );
  if (phase.includes("after")) {
    for (const name of ["settings-section", "settings-section-boundary"]) {
      const sections = rows.filter((row) => row.test === name);
      if (sections.some((row) => row.section !== sections[0].section))
        throw Error(`Zoom changed ${name}`);
    }
    const scroll = rows.filter((row) => row.test === "scroll-popup-history"),
      start = scroll[0];
    if (
      scroll.some(
        (row) =>
          !row.popup ||
          row.solves !== 180 ||
          Math.abs(row.historyRow - start.historyRow) > 0.02 ||
          Math.abs(row.memoOffset - start.memoOffset) > 0.1,
      )
    )
      throw Error("Zoom changed a scroll anchor, popup, or history");
    const running = rows.filter((row) => row.test === "running-timer");
    if (
      running.some(
        (row, i) =>
          !Number(row.timer) ||
          (i && Number(row.timer) <= Number(running[i - 1].timer)),
      )
    )
      throw Error("Running Timer stopped or reset");
    if (
      rows
        .filter((row) => row.test === "training-mode")
        .some((row) => !row.mode?.includes("Memo Recall"))
    )
      throw Error("Training mode reset");
    if (
      rows
        .filter((row) => row.test === "settings-form")
        .some(
          (row) =>
            row.value !== "Z" ||
            !row.sameInput ||
            row.tab?.trim() !== "Lettering",
        )
    )
      throw Error("Settings draft or tab reset");
  }
  console.log(engine, phase, "state checks recorded:", rows.length);
} finally {
  await browser.close();
}

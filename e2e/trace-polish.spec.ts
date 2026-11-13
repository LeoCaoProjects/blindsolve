import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { challengeFromScramble } from "../src/workspace/utils/bld";
import { ALL_STICKERS, speffzScheme } from "../src/workspace/utils/scheme";
import { orderedChallengeGroups } from "../src/workspace/utils/challengeTargets";
import { formatTime, formatTimePerTarget } from "../src/workspace/utils/time";
const scheme = createSpeffzScheme();
const letters = speffzScheme();
const slot = (id: string) =>
  ALL_STICKERS.find(
    (s) =>
      s.type === scheme.stickers[id].pieceType &&
      letters[s.id] === scheme.stickers[id].label,
  )!.id;
async function seed(page: Page, live = true) {
  await page.addInitScript(
    ({ scheme, live }) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            attempts: [],
            solves: [],
            showLiveTimer: live,
          },
          revision: 0,
          dirty: false,
        }),
      ),
    { scheme, live },
  );
  await page.goto("/training");
}
async function choose(page: Page, mode: string) {
  await page.getByRole("radio", { name: mode, exact: true }).click();
  await expect(
    page.locator("[data-training-region][data-transitioning=true]"),
  ).toHaveCount(0);
  if (mode === "Trace Sprint")
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
}
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
async function stored(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
}
async function answers(page: Page, wrong = false) {
  const id = await page
    .locator("[data-training-challenge-id]")
    .getAttribute("data-training-challenge-id");
  const seed = Number(id!.split(":").at(-1));
  const scramble = (await page
    .locator('[aria-label="Scramble"] .sr-only')
    .textContent())!.replace(/^Scramble /, "");
  const challenge = challengeFromScramble(scramble, "both", seed, {
    scheme: letters,
    edgeBuffer: slot(scheme.edgeBuffer),
    cornerBuffer: slot(scheme.cornerBuffer),
    edgeMethod: "m2",
    cornerMethod: "op",
  });
  const groups = orderedChallengeGroups(
    challenge,
    "trace",
    "both",
    "corners-first",
  );
  for (let i = 0; i < groups.length; i++) {
    const tokens = [...groups[i].tokens];
    if (wrong && i === 0) tokens[0] = tokens[0] === "A" ? "B" : "A";
    const input = page
      .getByRole("textbox", { name: /(Corners|Edges) targets/ })
      .nth(i);
    await input.fill(tokens.join(""));
    await input.press("Enter");
  }
  return groups.reduce((n, g) => n + g.tokens.length, 0);
}
for (const wrong of [false, true])
  test(`Trace ${wrong ? "failed" : "successful"} completion uses shared popup and passive history`, async ({
    page,
  }) => {
    await seed(page);
    await choose(page, "Trace Sprint");
    await hold(page);
    await expect(
      page.getByRole("timer", { name: "Trace", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main [data-cube-view]")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(1);
    const total = await answers(page, wrong);
    const popup = page.getByRole("dialog", {
      name: "Trace Sprint review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await expect(popup).toHaveCSS("transform", "none");
    const data = await stored(page);
    const attempt = data.attempts[0];
    expect(attempt.correct).toBe(!wrong);
    expect(attempt.targets).toBe(total);
    await expect(popup.getByRole("definition")).toHaveText([
      `${total - (wrong ? 1 : 0)}/${total}`,
      formatTimePerTarget(attempt.durationMs, total)!,
    ]);
    await expect(popup.locator(".font-timer").first()).toContainText(
      wrong ? "DNF" : formatTime(attempt.durationMs),
    );
    await expect(popup.getByRole("textbox")).toHaveCount(0);
    await expect(
      popup.getByRole("button", { name: /Suggest|Save/ }),
    ).toHaveCount(0);
    await expect(popup.locator("svg")).toHaveCount(0);
    await expect(popup.locator("[data-recall-error]")).toHaveCount(
      wrong ? 1 : 0,
    );
    await expect(popup.locator(".text-accent.underline")).toHaveCount(0);
    expect(Object.keys(attempt).sort()).toEqual(
      [
        "id",
        "kind",
        "correct",
        "accuracy",
        "trainingMode",
        "durationMs",
        "targets",
        "createdAt",
      ].sort(),
    );
    await page.screenshot({
      path: `test-results/trace-popup-${wrong ? "dnf" : "ok"}.png`,
    });
    await popup.getByRole("button", { name: /^Close/ }).click();
    await expect(popup).toHaveCount(0);
    const row = page.locator("[data-attempt-row]").first();
    await expect(row).toContainText(
      wrong ? "DNF" : formatTime(attempt.durationMs),
    );
    await expect(row.locator("svg")).toHaveCount(0);
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
    await expect(page.locator("[data-attempt-row]")).toHaveCount(0);
  });
for (const live of [true, false])
  test(`Trace shares Memo timer typography and Submit styling with live timer ${live}`, async ({
    page,
  }) => {
    await seed(page, live);
    await choose(page, "Memo Recall");
    await hold(page);
    await page.keyboard.press("Space");
    const metrics = async (label: string) => ({
      timer: await page
        .getByRole("timer", { name: label, exact: true })
        .evaluate((el) => {
          const r = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return [r.x, r.y, r.width, r.height, s.fontSize, s.fontFamily];
        }),
      button: await page
        .getByRole("button", { name: "Submit", exact: true })
        .evaluate((el) => ({
          box: [
            el.getBoundingClientRect().width,
            el.getBoundingClientRect().height,
          ],
          class: el.className,
        })),
    });
    const memo = await metrics("Recall");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Memo Recall review", exact: true })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await choose(page, "Trace Sprint");
    await hold(page);
    const timer = page.getByRole("timer", { name: "Trace", exact: true });
    await expect(timer).toHaveText(live ? /\d+\.\d{2}/ : "Solve");
    const trace = await metrics("Trace");
    expect(trace.button).toEqual(memo.button);
    expect(trace.timer.slice(4)).toEqual(memo.timer.slice(4));
    const inputs = page.getByRole("textbox", {
      name: /(Corners|Edges) targets/,
    });
    await inputs.first().press("Space");
    await expect(timer).toBeVisible();
    for (const input of await inputs.all()) {
      await input.fill("ABCD");
      expect(
        await input.evaluate((el) => {
          const r = el.getBoundingClientRect();
          let n = el.parentElement;
          while (n && getComputedStyle(n).overflowY !== "auto")
            n = n.parentElement;
          const clip = n!.getBoundingClientRect();
          return r.right <= clip.right && r.left >= clip.left;
        }),
      ).toBe(true);
    }
    const gap = await page
      .getByRole("button", { name: "Submit", exact: true })
      .evaluate(
        (el) =>
          el.getBoundingClientRect().top -
          [...document.querySelectorAll('input[aria-label$=" targets"]')]
            .at(-1)!
            .getBoundingClientRect().bottom,
      );
    expect(gap).toBeGreaterThan(8);
    expect(gap).toBeLessThan(48);
    await page.screenshot({ path: `test-results/trace-active-${live}.png` });
  });

test("Trace cube-free history transition retains shared workspace and subnav", async ({
  page,
}) => {
  await seed(page);
  for (const other of ["Memo Recall", "Execution Sprint", "Guided Solve"]) {
    await choose(page, other);
    const subnav = await page.locator("[data-subnav-column]").boundingBox();
    const before = await page.locator("[data-training-history]").boundingBox();
    await page.evaluate(() => {
      (window as Window & { __traceHistory: Element | null }).__traceHistory = document.querySelector(
        "[data-training-history]",
      );
    });
    await choose(page, "Trace Sprint");
    await expect(page.locator("[data-training-region=cube]")).toHaveCSS(
      "height",
      "0px",
    );
    await expect(page.locator("[data-training-region=scramble]")).toHaveCSS(
      "height",
      /^(?!0px)/,
    );
    expect(await page.locator("[data-subnav-column]").boundingBox()).toEqual(
      subnav,
    );
    expect(
      (await page.locator("[data-training-history]").boundingBox())!.y,
    ).toBeLessThan(before!.y);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { __traceHistory: Element | null }).__traceHistory ===
          document.querySelector("[data-training-history]"),
      ),
    ).toBe(true);
  }
});

test("Trace answer fields remain unclipped after narrowing the real viewport", async ({
  page,
}) => {
  await seed(page);
  await choose(page, "Trace Sprint");
  await hold(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const inputs = page.getByRole("textbox", { name: /(Corners|Edges) targets/ });
  for (const input of await inputs.all()) {
    await input.fill("ABCD");
    await input.focus();
    const fit = await input.evaluate((el) => {
      const r = el.getBoundingClientRect();
      let n = el.parentElement;
      while (n && getComputedStyle(n).overflowY !== "auto") n = n.parentElement;
      const b = n!.getBoundingClientRect(),
        s = getComputedStyle(el);
      const ring = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
      return Math.min(r.left - b.left, b.right - r.right) >= ring - 0.1;
    });
    expect(fit).toBe(true);
  }
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const popup = page.getByRole("dialog", {
    name: "Trace Sprint review",
    exact: true,
  });
  await expect(popup).toBeVisible();
  expect(await popup.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await expect(popup.getByRole("button", { name: /^Close/ })).toBeInViewport();
  await page.screenshot({ path: "test-results/trace-narrow-popup.png" });
});

import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { formatTime } from "../src/workspace/utils/time";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs: {},
            attempts: [],
            solves: [],
          },
          revision: 0,
          dirty: false,
        }),
      ),
    createSpeffzScheme(),
  );
});
async function hold(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
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
  await expect(
    page.locator('[data-training-region][data-transitioning="true"]'),
  ).toHaveCount(0);
}
async function start(page: Page) {
  await page.goto("/training");
  await choose(page, "Memo Recall");
  await hold(page);
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  return page
    .locator("[data-training-targets] ol[aria-label]")
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("aria-label")!.split(" ")),
    );
}
async function finish(
  page: Page,
  sequences: string[][],
  wrong = false,
  byButton = false,
) {
  await page.keyboard.press("Space");
  await expect(page.getByRole("timer", { name: "Recall" })).toBeVisible();
  const inputs = page.getByRole("textbox", { name: /Recall (corners|edges)/ });
  for (let index = 0; index < sequences.length; index++) {
    const answer = [...sequences[index]];
    if (wrong && index === 0) answer[0] = answer[0] === "A" ? "B" : "A";
    await inputs.nth(index).fill(answer.join(""));
    if (!byButton) await inputs.nth(index).press("Enter");
  }
  if (byButton)
    await page.getByRole("button", { name: "Submit", exact: true }).click();
  const popup = page.getByRole("dialog", {
    name: "Memo Recall review",
    exact: true,
  });
  await expect(popup).toBeVisible();
  return popup;
}
for (const wrong of [false, true])
  test(`Recall ${wrong ? "incorrect" : "correct"} result uses target accuracy, restored comparison/shared footer and passive history`, async ({
    page,
  }) => {
    const sequences = await start(page);
    await expect(
      page.getByRole("button", { name: /^Ready/ }),
    ).not.toBeVisible();
    const popup = await finish(page, sequences, wrong);
    const total = sequences.flat().length;
    await expect(popup.getByRole("definition").first()).toHaveText(
      `${total - (wrong ? 1 : 0)}/${total}`,
    );
    const data = await page.evaluate(
      () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
    );
    const saved = data.attempts[0];
    expect(saved.accuracy).toBe((total - (wrong ? 1 : 0)) / total);
    expect(Object.keys(saved).sort()).toEqual(
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
    for (const text of [
      "Correct",
      "Incorrect",
      "Expected",
      "Yours",
      "Worth a look",
      "Show all words",
      "without a word",
    ])
      await expect(popup.getByText(text, { exact: true })).toHaveCount(0);
    await expect(
      popup.getByRole("button", { name: /Next|Show all words/ }),
    ).toHaveCount(0);
    await expect(popup.getByRole("heading", { name: /^Edges/ })).toBeVisible();
    await expect(
      popup.getByRole("heading", { name: /^Corners/ }),
    ).toBeVisible();
    await expect(popup.locator('ol > li [aria-label^="yours "]').first()).toBeVisible();
    const errors = popup.locator("[data-recall-error]");
    await expect(errors).toHaveCount(wrong ? 1 : 0);
    if (wrong) {
      const style = await errors.first().evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          style: s.outlineStyle,
          color: s.outlineColor,
          letters: [...el.querySelectorAll("span")].map(
            (n) => getComputedStyle(n).textDecorationLine,
          ),
        };
      });
      expect(style.style).toBe("solid");
      expect(style.color).not.toBe("rgb(232, 119, 79)");
      expect(style.letters.every((value) => value === "none")).toBe(true);
      await expect(popup.locator(".font-timer").first()).toContainText("DNF");
    } else
      await expect(popup.locator(".font-timer").first()).toHaveText(
        formatTime(saved.durationMs),
      );
    const footerClass = await popup.locator("footer").getAttribute("class");
    const buttons = await popup
      .locator("footer button")
      .evaluateAll((elements) =>
        elements.map((el) => ({
          text: el.textContent?.replace(/^Save/, "Close").replace(/Esc$/, ""),
          class: el.className.replace(" min-w-[84px] justify-center", "").trim(),
        })),
      );
    await page.screenshot({
      path: `test-results/memo-cleanup-${wrong ? "dnf" : "ok"}.png`,
    });
    await page.keyboard.press("Space");
    await expect(popup).toHaveCount(0);
    const row = page.locator("[data-attempt-row]").first();
    await expect(row.locator("svg")).toHaveCount(0);
    await expect(row).toContainText(
      wrong ? "DNF" : formatTime(saved.durationMs),
    );
    await expect(row).toContainText(
      `${total - (wrong ? 1 : 0)}/${total} targets`,
    );
    await expect(row).toHaveCSS("cursor", "default");
    const bg = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    await expect(row).not.toHaveCSS("background-color", bg);
    await row.click();
    await expect(popup).toHaveCount(0);
    await choose(page, "Guided Solve");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await hold(page);
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    const guided = page.getByRole("dialog", {
      name: "Guided Solve result",
      exact: true,
    });
    await expect(guided).toBeVisible();
    expect(await guided.locator("footer").getAttribute("class")).toBe(
      footerClass,
    );
    expect(
      await guided
        .locator("footer button")
        .evaluateAll((elements) =>
          elements.map((el) => ({
            text: el.textContent?.replace(/^Save/, "Close").replace(/Esc$/, ""),
            class: el.className.replace(" min-w-[84px] justify-center", "").trim(),
          })),
        ),
    ).toEqual(buttons);
    await page.keyboard.press("Escape");
    await expect(guided).toHaveCount(0);
    await choose(page, "Memo Recall");
    const deleteControl = page
      .locator("[data-attempt-row]")
      .first()
      .locator("..")
      .getByRole("button", { name: /Delete attempt/ });
    await deleteControl.click();
    await expect(page.locator("[data-attempt-row]")).toHaveCount(0);
  });
for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [320, 568],
])
  test(`Recall answer fields and single attached action fit ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const sequences = await start(page);
    await page.keyboard.press("Space");
    const inputs = page.getByRole("textbox", {
      name: /Recall (corners|edges)/,
    });
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Show answer/ })).toHaveCount(
      0,
    );
    for (let index = 0; index < (await inputs.count()); index++) {
      await inputs.nth(index).focus();
      await inputs.nth(index).press("Space");
      const fit = await inputs.nth(index).evaluate((el) => {
        const b = el.getBoundingClientRect(),
          style = getComputedStyle(el);
        let n = el.parentElement;
        while (n && getComputedStyle(n).overflowY !== "auto")
          n = n.parentElement;
        const clip = n!.getBoundingClientRect();
        return {
          left: b.left - clip.left,
          right: clip.right - b.right,
          outline:
            parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
          minWidth: style.minWidth,
        };
      });
      expect(fit.left).toBeGreaterThanOrEqual(fit.outline);
      expect(fit.right).toBeGreaterThanOrEqual(fit.outline);
      expect(fit.minWidth).toBe("0px");
      await inputs.nth(index).fill(sequences[index].join(""));
    }
    const gap = await page
      .getByRole("button", { name: "Submit", exact: true })
      .evaluate((el) => {
        const button = el.getBoundingClientRect(),
          fields = [
            ...document.querySelectorAll('input[aria-label^="Recall "]'),
          ];
        return button.top - fields.at(-1)!.getBoundingClientRect().bottom;
      });
    expect(gap).toBeGreaterThan(8);
    expect(gap).toBeLessThan(48);
    await page.screenshot({
      path: `test-results/memo-cleanup-fields-${width}.png`,
    });
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const popup = page.getByRole("dialog", {
      name: "Memo Recall review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    expect(await popup.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    await expect(popup.getByRole("button", { name: /^Save/ })).toBeInViewport();
    await popup
      .getByRole("button", { name: "Delete attempt", exact: true })
      .click();
    await expect(popup).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts
            .length,
      ),
    ).toBe(0);
  });
for (const enabled of [true, false])
  test(`Memo study matches Guided memo and uses shared live timer ${enabled}`, async ({
    page,
  }) => {
    await page.addInitScript((enabled) => {
      const d = JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!);
      d.data.showLiveTimer = enabled;
      localStorage.setItem("cubeiq-bld-v2:guest", JSON.stringify(d));
    }, enabled);
    await page.goto("/training");
    await choose(page, "Guided Solve");
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await hold(page);
    const geometry = () =>
      page.getByRole("timer", { name: "Memorisation" }).evaluate((el) => {
        const b = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          font: s.fontSize,
          family: s.fontFamily,
          weight: s.fontWeight,
          line: s.lineHeight,
        };
      });
    await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
      "transform",
      "none",
    );
    const guided = await geometry();
    await page.keyboard.press("Space");
    await page.keyboard.press("Space");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await choose(page, "Memo Recall");
    await hold(page);
    const memo = page.getByRole("timer", { name: "Memorisation" });
    await expect(memo).toHaveText(enabled ? /\d+\.\d{2}/ : "Solve");
    await expect(page.locator("main .h-full.min-h-0[style]")).toHaveCSS(
      "transform",
      "none",
    );
    expect(await geometry()).toEqual(guided);
    await expect(
      page.getByRole("button", { name: /^Ready/ }),
    ).not.toBeVisible();
    await expect(
      page.locator("[data-timer-cube-viewport] [data-cube-view]"),
    ).toBeVisible();
  });

test("extra recalled tokens remain DNF without inflating expected-target accuracy", async ({
  page,
}) => {
  const sequences = await start(page);
  const total = sequences.flat().length;
  const withExtra = sequences.map((tokens) => [...tokens]);
  withExtra[withExtra.length - 1].push("A");
  const popup = await finish(page, withExtra);

  await expect(popup.getByRole("definition").first()).toHaveText(
    `${total}/${total}`,
  );
  await expect(popup.locator("[data-recall-error]")).toHaveCount(1);
  await expect(popup.locator("[data-recall-error]")).toContainText("A");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts[0],
  );
  expect(saved.accuracy).toBe(1);
  expect(saved.correct).toBe(false);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
});

test("answer focus outline remains inside the scrollport at native 200% zoom", async () => {
  const { nativeBrowser } =
    await import("../scripts/native-browser-session.mjs");
  const native = await nativeBrowser("chrome");
  try {
    const page = native.page as Page;
    await page.addInitScript(
      (scheme) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              onboarded: true,
              pairs: {},
              attempts: [],
              solves: [],
            },
            revision: 0,
            dirty: false,
          }),
        ),
      createSpeffzScheme(),
    );
    await native.resize(1440, 900);
    await native.navigate(
      `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5186"}/training`,
    );
    await choose(page, "Memo Recall");
    await hold(page);
    await expect(
      page.getByRole("timer", { name: "Memorisation" }),
    ).toBeVisible();
    await page.keyboard.press("Space");
    await native.zoom(2);
    const input = page
      .getByRole("textbox", { name: /Recall (corners|edges)/ })
      .first();
    await input.focus();
    const fit = await input.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      let n = el.parentElement;
      while (n && getComputedStyle(n).overflowY !== "auto") n = n.parentElement;
      const b = n!.getBoundingClientRect();
      return {
        gap: b.right - r.right,
        ring: parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset),
      };
    });
    expect(fit.gap).toBeGreaterThanOrEqual(fit.ring - 0.05);
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible();
    await native.screenshot("test-results/memo-fields-native200.png");
  } finally {
    await native.close();
  }
});

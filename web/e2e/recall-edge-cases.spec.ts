import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
const cases = [
  "correct",
  "wrong-corners",
  "wrong-edges",
  "wrong-both",
  "empty",
  "missing",
  "extra",
  "corrected",
] as const;
for (const scenario of cases)
  test(`Memo Recall interaction edge case: ${scenario}`, async ({ page }) => {
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
    await page.goto("/training");
    await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
    await expect(
      page.locator("[data-training-region][data-transitioning=true]"),
    ).toHaveCount(0);
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
    const groups = await page
      .locator("[data-training-targets] ol[aria-label]")
      .evaluateAll((nodes) =>
        nodes.map((el) => ({
          piece: el
            .parentElement!.textContent?.toLowerCase()
            .includes("corners")
            ? "corners"
            : "edges",
          tokens: el.getAttribute("aria-label")!.split(" "),
        })),
      );
    // Match the actual answer labels, so memo order cannot silently mix sections.
    await page.keyboard.press("Space");
    const inputs = page.getByRole("textbox", {
      name: /Recall (corners|edges)/,
    });
    await expect(inputs.first()).toBeFocused();
    const answers = groups.map((g) => [...g.tokens]);
    if (scenario === "empty") answers.forEach((a) => a.splice(0));
    if (scenario === "missing") answers.at(-1)!.pop();
    if (scenario === "extra") answers.at(-1)!.push("A");
    if (scenario.startsWith("wrong-"))
      for (let i = 0; i < answers.length; i++) {
        if (
          scenario === "wrong-both" ||
          scenario === `wrong-${i === 0 ? "corners" : "edges"}`
        )
          answers[i][Math.min(2, answers[i].length - 1)] =
            answers[i][Math.min(2, answers[i].length - 1)] === "A" ? "B" : "A";
      }
    if (scenario === "corrected") {
      await inputs.first().fill("ZZZZ");
      await inputs.first().press("Enter");
      await expect(inputs.last()).toBeFocused();
      await inputs.first().focus();
    }
    for (let i = 0; i < answers.length; i++) {
      await inputs.nth(i).fill(answers[i].join("").toLowerCase());
      if (i === 0) {
        await inputs.nth(i).press("Space");
        await expect(
          page.getByRole("timer", { name: "Recall", exact: true }),
        ).toBeVisible();
        await inputs.nth(i).press("Enter");
        await expect(inputs.last()).toBeFocused();
      }
    }
    const correct = groups.every(
      (g, i) => g.tokens.join("") === answers[i].join(""),
    );
    const numerator = groups.reduce(
        (n, g, i) => n + g.tokens.filter((t, j) => answers[i][j] === t).length,
        0,
      ),
      total = groups.reduce((n, g) => n + g.tokens.length, 0);
    if (scenario === "corrected")
      await inputs.last().evaluate((el) => {
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
          }),
        );
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
          }),
        );
      });
    else
      await page.getByRole("button", { name: "Submit", exact: true }).click();
    const popup = page.getByRole("dialog", {
      name: "Memo Recall review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole("definition").first()).toHaveText(
      `${numerator}/${total}`,
    );
    if (!correct)
      await expect(popup.locator(".font-timer").first()).toContainText("DNF");
    else {
      await expect(popup.locator(".font-timer").first()).not.toContainText(
        "DNF",
      );
      await expect(popup.locator("[data-recall-error]")).toHaveCount(0);
    }
    await expect(
      popup.locator('ol > li [aria-label^="yours "]').first(),
    ).toBeVisible();
    const attempts = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts,
    );
    expect(attempts).toHaveLength(1);
    expect(attempts[0].correct).toBe(correct);
    expect(attempts[0].accuracy).toBe(numerator / total);
    await popup.getByRole("button", { name: "Save", exact: true }).click();
    const row = page.locator("[data-attempt-row]").first();
    if (correct) await expect(row).not.toContainText("DNF");
    else await expect(row).toContainText("DNF");
  });

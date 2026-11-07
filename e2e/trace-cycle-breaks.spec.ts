import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { scrambleToState } from "../src/domain/bld/cubing";
import { traceSection } from "../src/domain/bld/trace";
import { challengeFromScramble } from "../src/magic/utils/bld";
import { ALL_STICKERS, speffzScheme } from "../src/magic/utils/scheme";
const scheme = createSpeffzScheme(),
  letters = speffzScheme();
const slot = (id: string) =>
  ALL_STICKERS.find(
    (s) =>
      s.type === scheme.stickers[id].pieceType &&
      letters[s.id] === scheme.stickers[id].label,
  )!.id;
for (const invalid of [false, true])
  test(`Trace accepts alternate breaks${invalid ? " but rejects an extra target" : ""} and reviews the chosen path`, async ({
    page,
  }) => {
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
      scheme,
    );
    await page.goto("/training");
    await page
      .getByRole("radio", { name: "Trace Sprint", exact: true })
      .click();
    const refresh = page.getByRole("button", {
      name: "New scramble",
      exact: true,
    });
    let expected: string[][] = [],
      different = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await expect(refresh).toBeEnabled({ timeout: 45000 });
      const scramble = (await page
        .locator('[aria-label="Scramble"] .sr-only')
        .textContent())!.replace(/^Scramble /, "");
      const id = await page
        .locator("[data-training-challenge-id]")
        .getAttribute("data-training-challenge-id");
      const seed = Number(id!.split(":").at(-1));
      const state = await scrambleToState(scramble);
      const challenge = challengeFromScramble(scramble, "both", seed, {
        scheme: letters,
        edgeBuffer: slot(scheme.edgeBuffer),
        cornerBuffer: slot(scheme.cornerBuffer),
        edgeMethod: "m2",
        cornerMethod: "op",
      });
      expected = (["corner", "edge"] as const).map((type) => {
        const choices: string[] = [];
        for (let guard = 0; guard < 30; guard++) {
          const section = traceSection(state, scheme, type, choices);
          if (section.status === "complete")
            return section.targets.map((t) => t.token);
          choices.push(section.validCycleBreaks.at(-1)!);
        }
        throw new Error("fixture trace failed");
      });
      different =
        expected[0].join("") !== challenge.rawTargets.corners.tokens.join("") ||
        expected[1].join("") !== challenge.rawTargets.edges.tokens.join("");
      if (different) break;
      await page.keyboard.press("n");
    }
    expect(different).toBe(true);
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
    for (let i = 0; i < expected.length; i++) {
      const input = page
        .getByRole("textbox", { name: /(Corners|Edges) targets/ })
        .nth(i);
      await input.fill(expected[i].join("") + (invalid && i === 1 ? "A" : ""));
      await input.press("Enter");
    }
    const popup = page.getByRole("dialog", {
      name: "Trace Sprint review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data
          .attempts[0],
    );
    expect(saved.correct).toBe(!invalid);
    expect(saved.targets).toBe(expected.flat().length);
    await expect(popup.getByRole("definition").first()).toHaveText(
      `${expected.flat().length}/${expected.flat().length}`,
    );
    for (let i = 0; i < 2; i++)
      expect(
        (
          await popup
            .locator("ol")
            .nth(i)
            .locator("li > span:first-child")
            .allTextContents()
        ).join(""),
      ).toBe(expected[i].join(""));
    await expect(popup.locator("[data-recall-error]")).toHaveCount(
      invalid ? 1 : 0,
    );
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
    await page.screenshot({
      path: `test-results/trace-alternate-break-${invalid ? "invalid" : "valid"}.png`,
    });
    await popup.getByRole("button", { name: /^Close/ }).click();
    const row = page.locator("[data-attempt-row]").first();
    if (invalid) await expect(row).toContainText("DNF");
    else await expect(row).not.toContainText("DNF");
  });

test("Trace rejects choosing a sticker on a solved piece at a cycle break", async ({
  page,
}) => {
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
    scheme,
  );
  await page.goto("/training");
  await page.getByRole("radio", { name: "Trace Sprint", exact: true }).click();
  const refresh = page.getByRole("button", {
    name: "New scramble",
    exact: true,
  });
  let answers: string[][] = [],
    bad: { section: number; index: number; token: string } | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    await expect(refresh).toBeEnabled({ timeout: 45000 });
    const scramble = (await page
      .locator('[aria-label="Scramble"] .sr-only')
      .textContent())!.replace(/^Scramble /, "");
    const state = await scrambleToState(scramble);
    bad = undefined;
    answers = (["corner", "edge"] as const).map((type, sectionIndex) => {
      const choices: string[] = [];
      for (let guard = 0; guard < 30; guard++) {
        const section = traceSection(state, scheme, type, choices);
        if (section.status === "complete")
          return section.targets.map((t) => t.token);
        const buffer =
          scheme.stickers[
            type === "edge" ? scheme.edgeBuffer : scheme.cornerBuffer
          ];
        const solved = Object.values(scheme.stickers).find(
          (s) =>
            s.pieceType === type &&
            s.pieceIndex !== buffer.pieceIndex &&
            !section.validCycleBreaks.includes(s.id),
        );
        if (!bad && solved)
          bad = {
            section: sectionIndex,
            index: section.targets.length,
            token: solved.label,
          };
        choices.push(section.validCycleBreaks[0]);
      }
      throw new Error("fixture did not complete");
    });
    if (bad) break;
    await page.keyboard.press("n");
  }
  expect(bad).toBeDefined();
  answers[bad!.section][bad!.index] = bad!.token;
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
  for (let i = 0; i < answers.length; i++) {
    const input = page
      .getByRole("textbox", { name: /(Corners|Edges) targets/ })
      .nth(i);
    await input.fill(answers[i].join(""));
    await input.press("Enter");
  }
  const popup = page.getByRole("dialog", {
    name: "Trace Sprint review",
    exact: true,
  });
  await expect(popup).toBeVisible();
  await expect(popup.locator(".font-timer").first()).toContainText("DNF");
  expect(await popup.locator("[data-recall-error]").count()).toBeGreaterThan(0);
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data.attempts[0],
  );
  expect(saved.correct).toBe(false);
});

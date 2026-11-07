import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { challengeFromScramble } from "../src/magic/utils/bld";
import { FACES, STICKER_COLORS } from "../src/magic/utils/cube";
import { ALL_STICKERS, speffzScheme } from "../src/magic/utils/scheme";
import { orderedChallengeGroups } from "../src/magic/utils/challengeTargets";
const scheme = createSpeffzScheme(),
  letters = speffzScheme();
const slot = (id: string) =>
  ALL_STICKERS.find(
    (s) =>
      s.type === scheme.stickers[id].pieceType &&
      letters[s.id] === scheme.stickers[id].label,
  )!.id;
for (const filter of ["both", "corners", "edges"] as const)
  test(`Trace ${filter}: preview-free scramble stays identical for physical and virtual tracing`, async ({
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
    if (filter !== "both")
      await page
        .getByRole("radio", {
          name: filter === "corners" ? "Corners" : "Edges",
          exact: true,
        })
        .click();
    const refresh = page.getByRole("button", {
      name: "New scramble",
      exact: true,
    });
    await expect(refresh).toBeEnabled({ timeout: 45000 });
    await expect(
      page.locator("[data-training-region][data-transitioning=true]"),
    ).toHaveCount(0);
    const header = page.locator('[aria-label="Scramble"]');
    const text = () => header.locator(".sr-only").textContent();
    await expect(header).toBeVisible();
    await expect(page.locator("[data-cube-view]")).toHaveCount(0);
    if (filter === "both") {
      const old = await text();
      await page.keyboard.press("n");
      await expect(refresh).toBeEnabled({ timeout: 45000 });
      await expect.poll(text).not.toBe(old);
    }
    const scramble = (await text())!.replace(/^Scramble /, "");
    const id = await page
      .locator("[data-training-challenge-id]")
      .getAttribute("data-training-challenge-id");
    const seed = Number(id!.split(":").at(-1));
    const challenge = challengeFromScramble(scramble, filter, seed, {
      scheme: letters,
      edgeBuffer: slot(scheme.edgeBuffer),
      cornerBuffer: slot(scheme.cornerBuffer),
      edgeMethod: "m2",
      cornerMethod: "op",
    });
    await page.screenshot({
      path: `test-results/trace-scramble-setup-${filter}.png`,
    });
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
    await expect(
      page.getByRole("timer", { name: "Trace", exact: true }),
    ).toBeVisible();
    const clock = page.getByRole("timer", { name: "Trace", exact: true });
    expect(
      await clock.evaluate((el) => {
        const r = el.getBoundingClientRect();
        let n = el.parentElement;
        while (n && getComputedStyle(n).overflowY !== "auto")
          n = n.parentElement;
        return r.top >= n!.getBoundingClientRect().top;
      }),
    ).toBe(true);
    await expect(page.locator("[data-training-challenge-id]")).toHaveAttribute(
      "data-training-challenge-id",
      id!,
    );
    await expect(header.locator(".sr-only")).toHaveText(`Scramble ${scramble}`);
    const cubes = page.locator("main [data-cube-view]");
    await expect(cubes).toHaveCount(2);
    const expected = FACES.map((face) =>
      challenge.state[face].map((color) => STICKER_COLORS[color]),
    );
    const expectedRgb = await page.evaluate(
      (colors) =>
        colors.map((face) =>
          face.map((color) => {
            const e = document.createElement("div");
            e.style.backgroundColor = color;
            return e.style.backgroundColor;
          }),
        ),
      expected,
    );
    const cubeColors = () =>
      cubes
        .first()
        .evaluate((el) =>
          [...el.querySelectorAll(":scope > div > div.absolute.grid")].map(
            (face) =>
              [...face.children]
                .slice(0, 9)
                .map(
                  (sticker) => (sticker as HTMLElement).style.backgroundColor,
                ),
          ),
        );
    expect(await cubeColors()).toEqual(expectedRgb);
    await page.waitForTimeout(200);
    expect(await cubeColors()).toEqual(expectedRgb);
    await page.screenshot({
      path: `test-results/trace-scramble-active-${filter}.png`,
    });
    const groups = orderedChallengeGroups(
      challenge,
      "trace",
      filter,
      "corners-first",
    );
    for (let i = 0; i < groups.length; i++) {
      const input = page
        .getByRole("textbox", { name: /(Corners|Edges) targets/ })
        .nth(i);
      await input.fill(groups[i].tokens.join(""));
      await input.press("Enter");
    }
    const popup = page.getByRole("dialog", {
      name: "Trace Sprint review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    const attempt = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data
          .attempts[0],
    );
    expect(attempt.correct).toBe(true);
    expect(attempt.targets).toBe(
      groups.reduce((n, g) => n + g.tokens.length, 0),
    );
    await popup.getByRole("button", { name: /^Close/ }).click();
    await expect(refresh).toBeEnabled({ timeout: 45000 });
    await expect(page.locator("[data-cube-view]")).toHaveCount(0);
    await expect(
      page.locator("[data-training-challenge-id]"),
    ).not.toHaveAttribute("data-training-challenge-id", id!);
    if (filter === "both") {
      await page
        .getByRole("button", { name: "How it works", exact: true })
        .click();
      const help = page.getByRole("dialog", {
        name: "How Trace Sprint works",
        exact: true,
      });
      await expect(help).toContainText("physical cube");
      await expect(help).toContainText("Do not inspect");
      await page.keyboard.press("Escape");
      await expect(help).toHaveCount(0);
    }
  });

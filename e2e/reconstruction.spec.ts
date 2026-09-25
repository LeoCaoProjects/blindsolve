import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { scrambleToState } from "../src/domain/bld/cubing";
import { traceWithCanonicalBreaks } from "../src/domain/bld/trace";
import { pairKey } from "../src/domain/letterPairs";

test("automatic reconstruction reconciles words and preserves its historical snapshot", async ({
  page,
}) => {
  const scheme = createSpeffzScheme();
  const scramble = "R U R' F2 D L2 B U2 F'";
  const { trace, choices } = traceWithCanonicalBreaks(
    await scrambleToState(scramble),
    scheme,
  );
  const first = trace.corners.targets[0];
  const second = trace.corners.targets[1];
  const key = pairKey(first.stickerId, second.stickerId);
  const stamp = "2026-09-25T00:00:00Z";
  const solveId = crypto.randomUUID();
  const data = {
    scheme,
    onboarded: true,
    schemeUpdatedAt: stamp,
    attempts: [],
    pairs: {
      [key]: {
        id: crypto.randomUUID(),
        firstStickerId: first.stickerId,
        secondStickerId: second.stickerId,
        firstToken: first.token,
        secondToken: second.token,
        primaryMnemonic: "toilet",
        alternates: [],
        encounters: 0,
        forgotten: 0,
        updatedAt: stamp,
      },
    },
    solves: [
      {
        id: solveId,
        scramble,
        memoMs: 32000,
        executionMs: 61000,
        totalMs: 93000,
        result: "success",
        cornerMemo: [],
        edgeMemo: [],
        cycleBreaks: choices,
        schemeSnapshot: scheme,
        reconstruction: "pending",
        createdAt: stamp,
        engineVersion: 3,
        multiphase: true,
      },
    ],
  };
  await page.addInitScript((workspace) => {
    localStorage.setItem(
      "cubeiq-bld-v2:guest",
      JSON.stringify({ data: workspace, revision: 0, dirty: false }),
    );
  }, data);
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Memo reconstruction" }),
  ).toBeVisible();

  await expect(page.locator('input[aria-label^="Word you used for"]:visible').first()).toBeVisible({ timeout: 10000 });
  for (let index = 0; index < 48; index++) {
    const input = page.locator('input[aria-label^="Word you used for"]:visible').first();
    if (!(await input.isVisible())) break;
    const label = await input.getAttribute("aria-label");
    await input.fill(`image ${index + 1}`);
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByLabel(label!, { exact: true })).toBeHidden();
    await page.waitForTimeout(220);
  }
  await page.getByRole("button", { name: "toilet", exact: true }).click();
  const changed = page.getByLabel(`${first.token} ${second.token} mnemonic used`);
  await changed.fill("World Cup");
  await changed.press("Enter");
  await page.getByRole("radio", { name: "Add alternate" }).click();
  await page.getByRole("button", { name: "Save solve" }).click();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!),
  );
  expect(stored.data.pairs[key].primaryMnemonic).toBe("toilet");
  expect(stored.data.pairs[key].alternates).toContain("World Cup");
  expect(stored.data.solves[0].memoSnapshot.corners[0].mnemonic).toBe(
    "World Cup",
  );

  await page.locator(".workspace-history li button").first().click();
  await expect(page.getByRole("dialog", { name: /Solve \d+/ })).toContainText(
    "World Cup",
  );
  await expect(page.getByRole("dialog", { name: /Solve \d+/ })).toContainText(
    "now toilet",
  );
});

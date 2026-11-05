import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
const count = Number(process.env.PERF_RECORDS || 10000);
const baseline = process.env.PERF_BASELINE === "1";
for (const surface of ["timer", "training"] as const)
  test(`large ${surface} history stays bounded with ${count} records`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const stamp = Date.parse("2026-11-05T00:00:00.000Z");
    const ids = Array.from({ length: count }, () => crypto.randomUUID());
    const data = {
      scheme: createSpeffzScheme(),
      pairs: {},
      onboarded: true,
      solves:
        surface === "timer"
          ? ids.map((id, i) => ({
              id,
              scramble: "R U",
              memoMs: 1000,
              executionMs: 10000 + i,
              totalMs: 11000 + i,
              result: "success",
              edgeMemo: [],
              cornerMemo: [],
              cycleBreaks: { edges: [], corners: [] },
              createdAt: new Date(stamp - i * 1000).toISOString(),
            }))
          : [],
      attempts:
        surface === "training"
          ? ids.map((id, i) => ({
              id,
              kind: "memo",
              correct: i % 3 !== 0,
              createdAt: new Date(stamp - i * 1000).toISOString(),
              trainingMode: ["exec", "guided", "recall", "trace"][i % 4],
              durationMs: 20000 + i,
              targets: 20,
              pairs: 10,
            }))
          : [],
      defaultCubeView: { top: "white", front: "green" },
    };
    await page.addInitScript(
      (data) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({ data, revision: 0, dirty: false, pending: {} }),
        ),
      data,
    );
    const session = await page.context().newCDPSession(page);
    await session.send("Performance.enable");
    const start = performance.now();
    await page.goto(surface === "timer" ? "/" : "/training");
    const list = page.getByRole("list", {
      name: surface === "timer" ? "Solves" : "Attempts",
      exact: true,
    });
    await expect(list).toBeVisible({ timeout: 90000 });
    await expect(list.getByRole("listitem").first()).toBeVisible({
      timeout: 90000,
    });
    const readyMs = performance.now() - start;
    const rows = await list.getByRole("listitem").count();
    const metrics = async () =>
      Object.fromEntries(
        (await session.send("Performance.getMetrics")).metrics.map(
          (metric: { name: string; value: number }) => [
            metric.name,
            metric.value,
          ],
        ),
      );
    const before = await metrics();
    const action = performance.now();
    if (surface === "training") {
      await page
        .getByRole("radio", { name: "Guided Solve", exact: true })
        .click();
      await expect(
        page.getByRole("radio", { name: "Guided Solve", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
    } else {
      await page.getByRole("link", { name: "Training", exact: true }).click();
      await expect(
        page.getByRole("radio", { name: "Execution Sprint", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
    }
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const interactionMs = performance.now() - action;
    await page.waitForTimeout(300);
    const after = await metrics();
    const result = {
      surface,
      records: count,
      baseline,
      readyMs,
      interactionMs,
      rows,
      nodes: after.Nodes,
      heapMB: after.JSHeapUsedSize / 1048576,
      interactionLayoutMs:
        1000 * (after.LayoutDuration - before.LayoutDuration),
      interactionScriptMs:
        1000 * (after.ScriptDuration - before.ScriptDuration),
      interactionTaskMs: 1000 * (after.TaskDuration - before.TaskDuration),
    };
    console.log("HISTORY_PROFILE " + JSON.stringify(result));
    await writeFile(
      info.outputPath("performance.json"),
      JSON.stringify(result, null, 2),
    );
    if (!baseline) {
      expect(rows).toBeLessThan(100);
      expect(interactionMs).toBeLessThan(1200);
      if (surface === "timer")
        await page.getByRole("link", { name: "Timer", exact: true }).click();
      const current = page.getByRole("list", {
        name: surface === "timer" ? "Solves" : "Attempts",
        exact: true,
      });
      await current.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const expected = surface === "timer" ? count : Math.ceil(count / 4);
      await expect(
        current.locator(`[data-virtual-index="${expected - 1}"]`),
      ).toBeVisible();
      expect(await current.locator("[data-virtual-row]").count()).toBeLessThan(
        100,
      );
      if (surface === "timer") {
        const last = current
          .locator(`[data-virtual-index="${count - 1}"] button`)
          .first();
        await last.focus();
        await last.press("Home");
        await expect(
          current.locator('[data-virtual-index="0"] button').first(),
        ).toBeFocused();
        await current
          .locator('[data-virtual-index="0"] button')
          .first()
          .press("End");
        await expect(
          current.locator(`[data-virtual-index="${count - 1}"] button`).first(),
        ).toBeFocused();
      }
    }
  });

import { test, expect } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import { writeFile, mkdir, readFile } from "node:fs/promises";
for (const live of [true, false])
  test(`restored Trace structure and shared controls live ${live}`, async ({
    page,
  }) => {
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
      { scheme: createSpeffzScheme(), live },
    );
    await page.goto("/training");
    await page
      .getByRole("radio", { name: "Trace Sprint", exact: true })
      .click();
    await expect(
      page.locator("[data-training-region][data-transitioning=true]"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "New scramble", exact: true }),
    ).toBeEnabled({ timeout: 45000 });
    await page.keyboard.down("Space");
    await page.waitForTimeout(320);
    await page.keyboard.up("Space");
    const inputs = page.getByRole("textbox", {
      name: /(Corners|Edges) targets/,
    });
    await expect(inputs).toHaveCount(2);
    await expect(page.locator("main [data-cube-view]")).toHaveCount(2);
    await expect(
      page.getByRole("main").getByText("Corners", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Edges", { exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(300);
    const geometry = await inputs.evaluateAll((nodes) =>
      nodes.map((el) => {
        const b = el.getBoundingClientRect();
        return {
          width: b.width,
          height: b.height,
          class: el.className,
          label: el.getAttribute("aria-label"),
        };
      }),
    );
    await mkdir("test-results/trace-restoration", { recursive: true });
    if (process.env.TRACE_RESTORE_BASELINE) {
      await page.screenshot({
        path: "test-results/trace-restoration/before.png",
      });
      await writeFile(
        "test-results/trace-restoration/before.json",
        JSON.stringify(geometry),
      );
      return;
    }
    if (process.env.TRACE_COMPARE_RESTORED) {
      const before = JSON.parse(
        await readFile("test-results/trace-restoration/before.json", "utf8"),
      );
      expect(geometry).toEqual(before);
    }
    const timer = page.getByRole("timer", { name: "Trace", exact: true });
    await expect(timer).toHaveText(live ? /\d+\.\d{2}/ : "Solve");
    await expect(timer).toHaveClass(/font-timer/);
    const submit = page.getByRole("button", { name: "Submit", exact: true });
    await expect(submit).toHaveText("Submit");
    await expect(submit).toHaveClass(/h-9/);
    const gap = await submit.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        document
          .querySelector('input[aria-label="Edges targets"]')!
          .getBoundingClientRect().bottom,
    );
    expect(gap).toBeGreaterThan(8);
    expect(gap).toBeLessThan(48);
    await inputs.first().fill("ABCD");
    await inputs.first().press("Space");
    await expect(timer).toBeVisible();
    await expect(
      page.locator("main .tnum").filter({ hasText: /^4$/ }),
    ).toHaveCount(0);
    await inputs.first().press("Enter");
    await expect(inputs.last()).toBeFocused();
    await inputs.last().fill("AB");
    await page.screenshot({
      path: `test-results/trace-restoration/after-${live}.png`,
    });
    await inputs.last().press("Enter");
    const popup = page.getByRole("dialog", {
      name: "Trace Sprint review",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await expect(
      popup.getByText("Time per target", { exact: true }),
    ).toBeVisible();
    await expect(popup.getByRole("textbox")).toHaveCount(0);
    await expect(popup.locator(".font-timer").first()).toContainText("DNF");
    await popup.getByRole("button", { name: /^Close/ }).click();
    const row = page.locator("[data-attempt-row]").first();
    await expect(row).toContainText("DNF");
    await expect(row.locator("svg")).toHaveCount(0);
  });

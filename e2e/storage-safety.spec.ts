import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

for (const surface of ["Timer", "Training"]) {
  test(`${surface} quota failure preserves disk, exports memory and recovers`, async ({
    page,
  }) => {
    // This isolated Playwright context intercepts writes; never fill real storage.
    await page.addInitScript(
      (data) => {
        if (!localStorage.getItem("cubeiq-bld-v2:guest"))
          localStorage.setItem(
            "cubeiq-bld-v2:guest",
            JSON.stringify({ data, dirty: false, revision: 0, pending: {} }),
          );
      },
      {
        scheme: createSpeffzScheme(),
        pairs: {},
        solves: [],
        attempts: [],
        onboarded: true,
      },
    );
    await page.goto(surface === "Timer" ? "/" : "/training");
    await expect(
      page.getByRole("button", { name: "New scramble" }),
    ).toBeEnabled({ timeout: 45000 });
    const original = await page.evaluate(() => {
      const bytes = localStorage.getItem("cubeiq-bld-v2:guest");
      const set = Storage.prototype.setItem;
      (window as unknown as { restoreStorage: () => void }).restoreStorage =
        () => {
          Storage.prototype.setItem = set;
        };
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith("cubeiq-bld-v2:"))
          throw new DOMException("Test quota", "QuotaExceededError");
        return set.call(this, key, value);
      };
      return bytes;
    });
    await page.locator("body").click({ position: { x: 800, y: 80 } });
    await page.keyboard.down("Space");
    await page.waitForTimeout(600);
    await page.keyboard.up("Space");
    if (surface === "Timer") await page.keyboard.press("Space");
    await page.waitForTimeout(40);
    await page.keyboard.press("Space");
    if (surface === "Timer")
      await page
        .getByRole("button", { name: /Skip to save|Save solve/ })
        .click();
    else
      await page
        .getByRole("dialog", { name: "Execution Sprint result" })
        .getByRole("button", { name: /^Next/ })
        .click();
    const warning = page.getByRole("alert", {
      name: "Browser storage warning",
    });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("only in this tab");
    expect(
      await page.evaluate(() => localStorage.getItem("cubeiq-bld-v2:guest")),
    ).toBe(original);
    const download = page.waitForEvent("download");
    await warning
      .getByRole("button", { name: "Export this workspace" })
      .click();
    const exported = await download;
    expect(exported.suggestedFilename()).toMatch(/^blindsolve-recovery-/);
    const backup = JSON.parse(await readFile((await exported.path())!, "utf8"));
    const category = surface === "Timer" ? "solves" : "attempts";
    expect(backup.data[category]).toHaveLength(1);
    expect(backup.localRecovery.envelope.data[category]).toHaveLength(1);
    await page.evaluate(() =>
      (window as unknown as { restoreStorage: () => void }).restoreStorage(),
    );
    await warning.getByRole("button", { name: "Retry saving" }).click();
    await expect(warning).toHaveCount(0);
    expect(
      await page.evaluate(
        (kind) =>
          JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data[kind]
            .length,
        category,
      ),
    ).toBe(1);
    await page.reload();
    await expect(
      page
        .getByRole("list", {
          name: surface === "Timer" ? "Solves" : "Attempts",
          exact: true,
        })
        .locator("li"),
    ).toHaveCount(1);
  });
}

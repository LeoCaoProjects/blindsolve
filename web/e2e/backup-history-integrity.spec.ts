import { expect, test } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import type { AppData } from "../src/data/model";

test("backup history conflicts and unknown additions block merge; a compatible import can retry", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  await page.context().route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  const key = "cubeiq-bld-v2:guest";
  const attempt: AppData["attempts"][number] = {
    id: "4c8b15b6-937d-4820-b214-439ac7bba673",
    createdAt: "2026-11-08T00:00:00Z",
    kind: "memo",
    trainingMode: "recognition",
    correct: true,
    durationMs: 1000,
  };
  const data = {
    scheme: createSpeffzScheme(), pairs: {}, solves: [], attempts: [attempt], onboarded: true,
  };
  const original = JSON.stringify({ data, dirty: false, revision: 0 });
  await page.addInitScript(({ key, original }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, original);
  }, { key, original });
  await page.goto("/settings");
  const read = () => page.evaluate((key) => localStorage.getItem(key), key);
  const choose = (bytes: Buffer) => page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name: "backup.json", mimeType: "application/json", buffer: bytes,
  });
  const dialog = page.getByRole("alertdialog", { name: "Import backup" });
  const conflict = Buffer.from(JSON.stringify({
    version: 3, data: { ...data, attempts: [{ ...attempt, durationMs: 9999 }] },
  }));
  await choose(conflict);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(attempt.id);
  expect(await read()).toBe(original);
  await page.keyboard.press("Escape");

  const newAttempt = { ...attempt, id: "4898b0d9-34c9-4af7-a4b3-f71dba15ad29" };
  await choose(Buffer.from(JSON.stringify({
    version: 3, data: { ...data, attempts: [attempt, newAttempt] },
  })));
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("unknown deletion status");
  expect(await read()).toBe(original);
  await page.keyboard.press("Escape");

  const valid = Buffer.from(JSON.stringify({
    version: 3, data: {
      ...data, showLiveTimer: false, preferencesUpdatedAt: "2026-11-09T00:00:00Z",
    },
  }));
  await page.evaluate((key) => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Test quota", "QuotaExceededError");
      write.call(this, name, value);
    };
    window.addEventListener("restore-test-storage", () => {
      Storage.prototype.setItem = write;
    }, { once: true });
  }, key);
  await choose(valid);
  await dialog.getByText("Merge, keep mine where they differ", { exact: true }).click();
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  const warning = page.getByRole("alert", { name: "Browser storage warning" });
  await expect(warning).toContainText("only in this tab");
  expect(await read()).toBe(original);
  await page.evaluate(() => window.dispatchEvent(new Event("restore-test-storage")));
  await warning.getByRole("button", { name: "Retry saving" }).click();
  await expect(warning).toHaveCount(0);
  const persisted = await read();
  expect(JSON.parse(persisted!).data.attempts).toEqual([attempt]);
  expect(JSON.parse(persisted!).data.showLiveTimer).toBe(false);

  await choose(valid);
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  expect(await read()).toBe(persisted);
});

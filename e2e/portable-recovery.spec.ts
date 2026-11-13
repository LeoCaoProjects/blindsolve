import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
import type { AppData } from "../src/lib/repository";

const guestKey = "cubeiq-bld-v2:guest";
const prefix = "blindsolve-recovered-v1:";
const selectionKey = "blindsolve-selected-recovery-v1";
const date = "2026-11-09T00:00:00Z";
const attemptId = "4c8b15b6-937d-4820-b214-439ac7bba673";
const solveId = "4898b0d9-34c9-4af7-a4b3-f71dba15ad29";
const liveId = "6efac164-bac7-4340-8cc9-aa12a9903eec";
const solve = {
  id: solveId, createdAt: date, scramble: "R U", memoMs: 1000, executionMs: 2000,
  totalMs: 3000, result: "success", edgeMemo: [], cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
} satisfies AppData["solves"][number];
const attempt = {
  id: attemptId, kind: "memo", trainingMode: "recognition",
  durationMs: 1234, correct: true, createdAt: date,
} satisfies AppData["attempts"][number];
const data = { scheme: createSpeffzScheme(), pairs: {}, solves: [], attempts: [], onboarded: true };
const older = { version: 3, data: { ...data, solves: [solve], attempts: [attempt] } };
const markers = { [`solve:${solveId}`]: date, [`attempt:${attemptId}`]: date };

async function setup(context: BrowserContext, baseURL: string, envelope: unknown) {
  const origin = new URL(baseURL).origin;
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await context.addInitScript(({ guestKey, envelope }) => {
    if (!localStorage.getItem(guestKey)) localStorage.setItem(guestKey, JSON.stringify(envelope));
  }, { guestKey, envelope });
}

const choose = async (page: Page, file: unknown) => {
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({
    name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)),
  });
  return page.getByRole("alertdialog", { name: "Import backup" });
};
const selectRestore = async (page: Page, file: unknown) => {
  const dialog = await choose(page, file);
  await dialog.getByRole("radio", { name: "Open as a separate local workspace" }).click();
  return dialog.getByRole("button", { name: "Restore as separate workspace" });
};
const exportBackup = async (page: Page) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, "utf8"));
};
const recoveryCount = (page: Page) => page.evaluate((prefix) =>
  Object.keys(localStorage).filter((key) => key.startsWith(prefix)).length, prefix,
);
const recovered = (page: Page) => page.getByRole("button", { name: "Return to original workspace" });

test("cross-profile restore preserves UUID deletions, reload, re-export and tab isolation", async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const source = await browser.newContext({ baseURL, serviceWorkers: "block" });
  const destination = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    await setup(source, baseURL!, {
      data: {
        ...data, solves: [{ ...solve, id: liveId }],
        attempts: [{ ...attempt, id: liveId, trainingMode: "exec" }],
      },
      tombstones: markers, dirty: false, revision: 0,
    });
    await setup(destination, baseURL!, { data: older.data, dirty: false, revision: 0 });
    const from = await source.newPage();
    await from.goto("/settings");
    const backup = await exportBackup(from);
    expect(backup.version).toBe(4);
    expect(backup.tombstones).toEqual(markers);

    const page = await destination.newPage();
    await page.goto("/settings");
    const original = await page.evaluate((key) => localStorage.getItem(key), guestKey);
    const foreign = await choose(page, { ...backup, data });
    await foreign.getByRole("button", { name: "Import", exact: true }).click();
    await expect(foreign).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), guestKey)).toBe(original);
    await (await selectRestore(page, backup)).click();
    await expect(recovered(page)).toBeVisible();
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
    const id = await page.evaluate((key) => sessionStorage.getItem(key), selectionKey);
    expect(id).toBeTruthy();
    expect(await recoveryCount(page)).toBe(1);

    await page.goto("/");
    await expect(page.getByRole("list", { name: "Solves" }).locator("[data-virtual-row]")).toHaveCount(1);
    await page.keyboard.press("Delete");
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("list", { name: "Solves" }).locator("[data-virtual-row]")).toHaveCount(0);
    await page.reload();
    await expect(recovered(page)).toBeVisible();
    await page.goto("/training");
    await page.getByRole("radio", { name: "Execution Sprint", exact: true }).click();
    await expect(page.getByRole("list", { name: "Attempts" }).locator("[data-virtual-row]")).toHaveCount(1);
    await page.keyboard.press("Delete");
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("list", { name: "Attempts" }).locator("[data-virtual-row]")).toHaveCount(0);
    await page.goto("/settings");
    const stale = await choose(page, older);
    await stale.getByRole("button", { name: "Import", exact: true }).click();
    await expect(stale).toHaveCount(0);
    const replay = await exportBackup(page);
    expect(replay.data.attempts).toEqual([]);
    expect(replay.data.solves).toEqual([]);
    expect(replay.tombstones).toMatchObject(markers);
    expect(replay.tombstones[`solve:${liveId}`]).toBeTruthy();
    expect(replay.tombstones[`attempt:${liveId}`]).toBeTruthy();

    const second = await destination.newPage();
    await second.goto("/settings");
    const locks = (tab: Page) => tab.evaluate(async () => (await navigator.locks.query()).held?.map((lock) => lock.name));
    expect(await locks(page)).toContain(prefix + id);
    expect(await locks(second)).toContain(prefix + id);
    await second.getByRole("button", { name: "Open recovered workspace" }).click();
    await expect(second.getByRole("alert")).toContainText("open in another tab");
    await Promise.all([
      second.waitForEvent("domcontentloaded"),
      recovered(second).click(),
    ]);
    await expect(recovered(second)).toHaveCount(0);
    await expect(second.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
    await (await selectRestore(second, older)).click();
    await expect(recovered(second)).toBeVisible();
    await expect(second.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
    expect((await exportBackup(second)).history).toBe("legacy-incomplete");
    expect((await exportBackup(page)).tombstones).toEqual(replay.tombstones);
    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      recovered(page).click(),
    ]);
    await expect(recovered(page)).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), guestKey)).toBe(original);
  } finally {
    await Promise.all([source.close(), destination.close()]);
  }
});

test("restore survives quota failure and interruption before tab selection", async ({ context, page, baseURL }) => {
  await setup(context, baseURL!, { data, dirty: false, revision: 0 });
  await page.goto("/settings");
  const bytes = await page.evaluate((key) => localStorage.getItem(key), guestKey);
  await page.evaluate(({ prefix, selectionKey }) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith(prefix)) throw new DOMException("Test quota", "QuotaExceededError");
      set.call(this, key, value);
    };
    window.addEventListener("interrupt-selection", () => {
      Storage.prototype.setItem = function (key, value) {
        if (key === selectionKey) throw new DOMException("Test interruption", "QuotaExceededError");
        set.call(this, key, value);
      };
    }, { once: true });
  }, { prefix, selectionKey });
  const restore = await selectRestore(page, older);
  await restore.click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toBeVisible();
  expect(await recoveryCount(page)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), guestKey)).toBe(bytes);
  await page.evaluate(() => window.dispatchEvent(new Event("interrupt-selection")));
  await restore.click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText("Test interruption");
  await expect.poll(() => recoveryCount(page)).toBe(1);
  await expect(recovered(page)).toHaveCount(0);
  await restore.click();
  expect(await recoveryCount(page)).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Open recovered workspace" }).click();
  await expect(recovered(page)).toBeVisible();
  const exported = await exportBackup(page);
  expect(exported.history).toBe("legacy-incomplete");
  expect(exported.data.attempts).toEqual([attempt]);
  expect(exported.data.solves).toEqual([solve]);
});

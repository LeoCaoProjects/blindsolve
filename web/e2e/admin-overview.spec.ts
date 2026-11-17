import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const owner = "a0000000-0000-4000-8000-000000000001";
const report = {
  updatedAt: "2026-11-16T10:00:00Z",
  since: "2026-11-09T10:00:00Z",
  registeredAccounts: 18,
  newAccounts: 4,
  activeUsers: 12,
  solves: 84,
  training: 120,
  undatedSolves: 0,
  undatedTraining: 0,
  trend: [
    { day: "2026-11-11", accounts: 1, solves: 9, training: 12 },
    { day: "2026-11-12", accounts: 0, solves: 8, training: 9 },
    { day: "2026-11-13", accounts: 0, solves: 14, training: 20 },
    { day: "2026-11-14", accounts: 1, solves: 11, training: 15 },
    { day: "2026-11-15", accounts: 0, solves: 16, training: 24 },
    { day: "2026-11-10", accounts: 0, solves: 6, training: 5 },
    { day: "2026-11-16", accounts: 2, solves: 20, training: 35 },
  ].sort((a, b) => a.day.localeCompare(b.day)),
  modes: [
    { mode: "recognition", attempts: 70 },
    { mode: "exec", attempts: 30 },
    { mode: "guided", attempts: 20 },
  ],
  feedback: { new: 3, open: 7, resolved: 12, archived: 4 },
};

/** Browser-only synthetic provider: no hosted API or real account is ever contacted.
 * Production modules are unmodified; the Vite module's configuration is replaced
 * by Playwright before evaluation, with every loopback API request intercepted.
 */
async function fixture(page: Page, role: "admin" | "user" | "guest" = "admin") {
  let state: "populated" | "empty" | "error" | "loading" = "populated";
  const periods: string[] = [];
  let permission = role === "admin",
    permissionCalls = 0;
  let permissionWait: Promise<void> | undefined;
  let finishPermission: (() => void) | undefined;
  let holdRanges = false;
  const held = new Map<string, (report: unknown) => void>();
  let overview: Omit<typeof report, "since"> & { since: string | null } =
    report;
  let rows = [
    {
      id: "d0000000-0000-4000-8000-000000000001",
      user_id: null,
      contact_email: null,
      category: "bug",
      message: "Synthetic feedback: timer keyboard check",
      status: "new",
      source_page: "Timer",
      technical_context: null,
      screenshot_path: "fixture.png",
      screenshot_name: "fixture.png",
      admin_note: "Existing private note",
      submitter_name: null,
      submitter_detail: null,
      submitter_provider: null,
      created_at: "2026-11-15T10:00:00Z",
    },
  ];
  await page.route("**/src/lib/supabase.ts*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/const url = [^;]+;/, 'const url = "http://127.0.0.1:54321";')
      .replace(
        /const anonKey = [^;]+;/,
        'const anonKey = "synthetic-public-key";',
      );
    await route.fulfill({ response, body });
  });
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic@example.invalid",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  if (role !== "guest")
    await page.addInitScript(
      ({ user }) => {
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: user.id, exp, role: "authenticated" }))}.synthetic`;
        localStorage.setItem(
          "sb-127-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "synthetic",
            expires_at: exp,
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
        );
      },
      { user },
    );
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    if (path.endsWith("/auth/v1/user")) return fulfill(user);
    if (path.endsWith("/is_feedback_admin")) {
      permissionCalls++;
      const answer = permission;
      if (permissionWait) await permissionWait;
      return fulfill(answer);
    }
    if (path.endsWith("/get_bld_sync_snapshot"))
      return fulfill({ records: [], revision: 0 });
    if (path.endsWith("/get_bld_workspace"))
      return fulfill({ data: null, revision: 0 });
    if (path.endsWith("/admin_overview")) {
      const period = request.postDataJSON().period;
      periods.push(period);
      if (holdRanges)
        return fulfill(
          await new Promise((resolve) => held.set(period, resolve)),
        );
      if (state === "loading")
        await new Promise((resolve) => setTimeout(resolve, 800));
      if (state === "error")
        return fulfill({ message: "Synthetic error" }, 503);
      return fulfill(
        state === "empty"
          ? {
              ...report,
              activeUsers: 0,
              newAccounts: 0,
              solves: 0,
              training: 0,
              trend: [],
              modes: [],
            }
          : overview,
      );
    }
    if (path.includes("/storage/v1/object/sign/")) {
      if (request.method() === "POST")
        return fulfill({
          signedURL:
            "/object/sign/feedback-screenshots/fixture.png?token=synthetic",
        });
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NQAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    }
    if (path.endsWith("/feedback")) {
      if (request.method() === "PATCH") {
        const patch = request.postDataJSON();
        rows = rows.map((row) => ({ ...row, ...patch }));
        return fulfill({ id: rows[0]?.id }, 200);
      }
      if (request.method() === "DELETE") {
        const deleted = rows[0];
        rows = [];
        return fulfill({ id: deleted?.id }, 200);
      }
      if (request.headers()["accept"]?.includes("vnd.pgrst.object"))
        return fulfill(rows[0] ?? null);
      return fulfill(rows);
    }
    return fulfill([]);
  });
  return {
    periods,
    permissionCalls: () => permissionCalls,
    allow: (allowed: boolean) => {
      permission = allowed;
    },
    holdPermission: () => {
      permissionWait = new Promise((resolve) => {
        finishPermission = resolve;
      });
    },
    releasePermission: () => {
      finishPermission?.();
      permissionWait = undefined;
    },
    holdRanges: () => {
      holdRanges = true;
    },
    releaseRange: (period: string, solves: number) => {
      held.get(period)?.({ ...report, solves });
      held.delete(period);
    },
    setReport: (next: typeof overview) => {
      overview = next;
    },
    setState: (next: typeof state) => {
      state = next;
    },
  };
}

test("guest and non-admin cannot see or enter Admin", async ({ page }) => {
  await fixture(page, "user");
  await page.goto("/admin");
  await expect(page).toHaveURL(/settings/);
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Admin" })).toHaveCount(0);
});
test("guest direct routes are blocked and Settings has no analytics control", async ({
  page,
}) => {
  await fixture(page, "guest");
  for (const path of ["/admin", "/admin/feedback"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/settings/);
    await expect(
      page.getByRole("link", { name: "Admin", exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("switch", { name: "Share anonymous usage analytics" }),
  ).toHaveCount(0);
  await expect(page.getByText("Feedback inbox", { exact: true })).toHaveCount(
    0,
  );
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 600 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 390, height: 568 },
]) {
  test(`Admin overview and preserved feedback at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    const f = await fixture(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await page
      .getByRole("button", { name: "About usage", exact: true })
      .click();
    await expect(
      page.getByText(
        "Usage reflects signed-in/cloud activity. Guest activity is not tracked.",
      ),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(
        "Usage reflects signed-in/cloud activity. Guest activity is not tracked.",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Current totals" }),
    ).toContainText("Accounts");
    await expect(
      page.getByRole("region", { name: "Current totals" }),
    ).toContainText("Open feedback");
    await expect(
      page
        .getByRole("link", { name: "Admin", exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Active accounts", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Target Recognition", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText("Completed attempts · 7 days", { exact: true }),
    ).toBeVisible();
    const values = page.getByRole("group", {
      name: "Solves values; use arrow keys to explore",
    });
    await values.getByRole("button").last().focus();
    await page.keyboard.press("Home");
    await expect(values.getByRole("button").first()).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(values.getByRole("button").nth(1)).toBeFocused();
    await values.getByRole("button").last().hover();
    await expect(page.locator("figcaption")).toContainText("20 solves");
    await page.getByRole("heading", { name: "Admin" }).click();
    await page.screenshot({
      path: info.outputPath(`overview-${viewport.width}.png`),
      fullPage: false,
    });
    await page
      .getByRole("region", { name: "Training activity" })
      .scrollIntoViewIfNeeded();
    const spacing = await page.getByRole("main", { name: "Overview" }).evaluate(main => {
      main.scrollTop = main.scrollHeight;
      const training = main.querySelector('[aria-labelledby="training-heading"]')!;
      return { gap: main.getBoundingClientRect().bottom - training.getBoundingClientRect().bottom, padding: parseFloat(getComputedStyle(main).paddingBottom) };
    });
    expect(spacing.gap).toBeGreaterThanOrEqual(spacing.padding - 2);
    expect(spacing.padding).toBeGreaterThan(32);

    await page.screenshot({
      path: info.outputPath(`overview-training-${viewport.width}.png`),
    });
    await page
      .getByRole("radiogroup", { name: "Overview period" })
      .getByRole("radio", { name: "30 days", exact: true })
      .click();
    await expect.poll(() => f.periods.at(-1)).toBe("30d");
    await page.getByRole("link", { name: "Feedback", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Feedback", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Synthetic feedback: timer keyboard check", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`feedback-${viewport.width}.png`),
      fullPage: false,
    });
    await page
      .getByRole("searchbox", { name: "Search feedback" })
      .fill("no match");
    await expect(page.getByText("Nothing matches that search.")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search feedback" }).fill("");
    await page
      .getByText("Synthetic feedback: timer keyboard check", { exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "Screenshot: fixture.png" }),
    ).toBeVisible();
    await expect(page.getByLabel("Private note")).toHaveValue(
      "Existing private note",
    );
    await expect(
      page.getByRole("dialog", { name: "Bug feedback", exact: true }),
    ).toHaveCSS("opacity", "1");
    const detail = page.getByRole("dialog", {
      name: "Bug feedback",
      exact: true,
    });
    const box = await detail.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
      2,
    );
    expect(
      Math.abs(box!.y + box!.height / 2 - viewport.height / 2),
    ).toBeLessThan(2);
    await expect(
      detail.getByRole("button", { name: "Close", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      detail.getByRole("button", { name: "Archive", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      detail.getByRole("button", { name: "Close", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await expect(
      page
        .getByRole("list", { name: "Feedback", exact: true })
        .getByRole("button")
        .first(),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(detail).toHaveCSS("opacity", "1");
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detail).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(detail).toHaveCSS("opacity", "1");
    await page.mouse.click(2, 2);
    await expect(detail).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(detail).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: info.outputPath(`detail-${viewport.width}.png`),
      fullPage: false,
    });
    await page
      .getByRole("button", { name: "Status: New", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Reviewing", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Status: Reviewing", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Private note").fill("Updated synthetic note");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("No feedback.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Status: Not archived", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Archived", exact: true })
      .click();
    await page
      .getByText("Synthetic feedback: timer keyboard check", { exact: true })
      .click();
    await expect(page.getByLabel("Private note")).toHaveValue(
      "Updated synthetic note",
    );
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await expect(
      page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(detail).toBeVisible();
    await expect(
      detail.getByRole("button", { name: "Delete permanently", exact: true }),
    ).toBeFocused();
    await detail
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByText("No feedback yet.", { exact: true }),
    ).toBeVisible();
  });
}
test("Overview loading, empty and failure states; old link compatibility", async ({
  page,
}) => {
  const f = await fixture(page);
  f.setState("loading");
  await page.goto("/admin");
  await expect(page.getByText("Loading overview…")).toBeVisible();
  await expect(
    page.getByText("Active accounts", { exact: true }),
  ).toBeVisible();
  f.setState("empty");
  await page
    .getByRole("button", { name: "Refresh overview", exact: true })
    .click();
  await expect(page.getByText("No activity in this period.")).toBeVisible();
  f.setState("error");
  await page
    .getByRole("button", { name: "Refresh overview", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Refresh failed. Showing the previous period.",
  );
  await page.goto("/settings/feedback");
  await expect(page).toHaveURL(/\/admin\/feedback$/);
  await expect(
    page.getByRole("heading", { name: "Feedback", exact: true }),
  ).toBeVisible();
});

test("Overview controls support keyboard use and exact chart values", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/admin");
  const range = page.getByRole("radiogroup", { name: "Overview period" });
  await range.getByRole("radio", { name: "7 days", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => f.periods.at(-1)).toBe("30d");
  await expect(
    range.getByRole("radio", { name: "30 days", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "About active accounts", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "About active accounts" }),
  ).toContainText("Not visits");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "About active accounts", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("radiogroup", { name: "Activity metric" })
    .getByRole("radio", { name: "Training", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Training by day/ }),
  ).toBeVisible();
  await page.getByText("Daily values", { exact: true }).click();
  await expect(
    page.getByRole("row", { name: "2026-11-16 2 20 35", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open feedback", exact: true }).click();
  const status = page.getByRole("button", {
    name: "Status: Not archived",
    exact: true,
  });
  await status.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitemradio", { name: "Not archived", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Status: New", exact: true }),
  ).toBeFocused();
});

test("Admin content and Feedback dialog pass WCAG checks including contrast", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/admin");
  await expect(
    page.getByText("Active accounts", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .include("header")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await expect(
    page.getByText("Synthetic feedback: timer keyboard check", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include("main")
        .include("header")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByText("Synthetic feedback: timer keyboard check", { exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Bug feedback",
    exact: true,
  });
  await expect(dialog).toHaveCSS("opacity", "1");
  await dialog.getByText("Details", { exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("chart ranges preserve daily precision, reduce date labels, and bound All-time groups", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const f = await fixture(page);
  await page.goto("/admin");
  await expect(
    page.getByText("Active accounts", { exact: true }),
  ).toBeVisible();
  const period = page.getByRole("radiogroup", { name: "Overview period" });
  f.setReport({
    ...report,
    since: "2026-11-15T10:00:00Z",
    trend: [{ day: "2026-11-16", accounts: 1, solves: 4, training: 3 }],
  });
  await period.getByRole("radio", { name: "24 hours", exact: true }).click();
  await expect(page.getByText("Last 24 hours", { exact: true })).toBeVisible();
  const values = page.getByRole("group", {
    name: "Solves values; use arrow keys to explore",
  });
  await expect(values).toHaveCount(0);
  await expect(
    page.getByText("4", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  f.setReport({
    ...report,
    since: "2026-10-17T10:00:00Z",
    trend: [
      ...report.trend,
      { day: "2026-10-17", accounts: 0, solves: 1, training: 0 },
    ],
  });
  await period.getByRole("radio", { name: "30 days", exact: true }).click();
  await expect(values.getByRole("button")).toHaveCount(31);
  expect(
    await page.getByLabel("Chart dates").locator(":scope > span").count(),
  ).toBeLessThanOrEqual(5);
  f.setReport({
    ...report,
    since: null,
    trend: [
      { day: "2020-01-02", accounts: 2, solves: 3, training: 4 },
      { day: "2026-11-16", accounts: 5, solves: 6, training: 7 },
    ],
  });
  await period.getByRole("radio", { name: "All time", exact: true }).click();
  await expect(
    page.getByText("Monthly groups · UTC", { exact: true }),
  ).toBeVisible();
  expect(await values.getByRole("button").count()).toBeLessThanOrEqual(36);
  await values.getByRole("button").last().focus();
  await page.keyboard.press("Home");
  await expect(page.locator("figcaption")).toContainText("3 solves");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("overlapping ranges keep November daily solves identical and Training follows each response", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const f = await fixture(page);
  const november = [
    { day: "2026-11-10", accounts: 1, solves: 4, training: 2 },
    { day: "2026-11-12", accounts: 0, solves: 7, training: 3 },
    { day: "2026-11-16", accounts: 0, solves: 2, training: 4 },
  ];
  f.setReport({
    ...report,
    solves: 13,
    training: 9,
    since: "2026-10-17T10:00:00Z",
    trend: november,
    modes: [
      { mode: "guided", attempts: 2 },
      { mode: "exec", attempts: 0 },
      { mode: "recognition", attempts: 7 },
    ],
  });
  await page.goto("/admin");
  const period = page.getByRole("radiogroup", { name: "Overview period" });
  await period.getByRole("radio", { name: "30 days", exact: true }).click();
  const training = page.getByRole("region", { name: "Training activity" });
  await expect(training).toContainText("Completed attempts · 30 days");
  await expect(training.getByRole("listitem")).toHaveText([
    "Target Recognition7",
    "Guided Solve2",
  ]);
  const values = page.getByRole("group", {
    name: "Solves values; use arrow keys to explore",
  });
  const recent = await values
    .getByRole("button")
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  expect(recent).toHaveLength(7);
  expect(recent.at(-1)).toMatch(/2 solves/);
  await page.screenshot({
    path: info.outputPath("overview-30-days-desktop.png"),
  });
  f.setReport({
    ...report,
    solves: 13,
    training: 59,
    since: null,
    trend: [
      { day: "2020-01-01", accounts: 1, solves: 0, training: 50 },
      ...november,
    ],
    modes: [
      { mode: "recognition", attempts: 7 },
      { mode: "guided", attempts: 52 },
    ],
  });
  await period.getByRole("radio", { name: "All time", exact: true }).click();
  await expect(training).toContainText("Completed attempts · All time");
  await expect(training.getByRole("listitem")).toHaveText([
    "Guided Solve52",
    "Target Recognition7",
  ]);
  await expect(
    page.getByText("Daily totals · UTC", { exact: true }),
  ).toBeVisible();
  expect(
    await values
      .getByRole("button")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label"))),
  ).toEqual(recent);
  await page.screenshot({
    path: info.outputPath("overview-all-time-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await training.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("overview-all-time-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

async function authEvent(page: Page, event: string, nextOwner?: string) {
  await page.evaluate(
    async ({ event, nextOwner }) => {
      const path = "/src/lib/supabase.ts";
      const { supabase } = await import(/* @vite-ignore */ path);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const next =
        event === "SIGNED_OUT"
          ? null
          : nextOwner
            ? { ...session, user: { ...session.user, id: nextOwner } }
            : session;
      await supabase.auth._notifyAllSubscribers(event, next);
    },
    { event, nextOwner },
  );
}
for (const width of [1440, 390])
  test(`Admin remains mounted across tab returns, token refresh and rapid periods at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const f = await fixture(page);
    const initialInbox = page.waitForResponse(
      (response) =>
        response.url().includes("/storage/v1/object/sign/") &&
        response.request().method() === "POST",
    );
    await page.goto("/admin");
    await (await initialInbox).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect(
      page.getByText("Active accounts", { exact: true }),
    ).toBeVisible();
    const nav = page
      .getByRole("link", { name: "Admin", exact: true })
      .filter({ visible: true });
    await page.evaluate(() => {
      const root = document.querySelector('main[aria-label="Overview"]')!;
      const nav = [...document.querySelectorAll('a[href="/admin"]')].find(
        (n) => n.getClientRects().length,
      )!;
      const refs = { root, nav, disconnected: false };
      (window as unknown as { adminRefs: typeof refs }).adminRefs = refs;
      new MutationObserver(() => {
        if (!root.isConnected || !nav.isConnected) refs.disconnected = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    const other = await context.newPage();
    for (let i = 0; i < 3; i++) {
      const before = f.permissionCalls();
      f.holdPermission();
      await other.bringToFront();
      await page.bringToFront();
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect.poll(f.permissionCalls).toBe(before + 1);
      await authEvent(page, "TOKEN_REFRESHED");
      await expect(nav).toBeVisible();
      await expect(
        page.getByText("Active accounts", { exact: true }),
      ).toBeVisible();
      expect(f.permissionCalls()).toBe(before + 1);
      // Inbox refresh also signs attachments; a feedback-row response alone
      // is not completion. Wait for that final response and its UI frame.
      const inboxDone = page.waitForResponse(
        (response) =>
          response.url().includes("/storage/v1/object/sign/") &&
          response.request().method() === "POST",
      );
      f.releasePermission();
      await (await inboxDone).finished();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
    }
    await other.close();
    f.holdRanges();
    const metric = page.getByRole("radiogroup", { name: "Activity metric" });
    await metric.getByRole("radio", { name: "Training", exact: true }).click();
    for (const [label, period] of [
      ["24 hours", "24h"],
      ["7 days", "7d"],
      ["30 days", "30d"],
      ["All time", "all"],
    ]) {
      await page
        .getByRole("radiogroup", { name: "Overview period" })
        .getByRole("radio", { name: label, exact: true })
        .click();
      await expect.poll(() => f.periods.at(-1)).toBe(period);
      await expect(
        page.locator("dd").filter({ hasText: /^84$/ }),
      ).toBeVisible();
      await expect(nav).toBeVisible();
      await expect(page.getByText("Loading overview…")).toHaveCount(0);
    }
    f.releaseRange("all", 444);
    await expect(page.locator("dd").filter({ hasText: /^444$/ })).toBeVisible();
    for (const period of ["30d", "7d", "24h"]) f.releaseRange(period, 999);
    await expect(
      metric.getByRole("radio", { name: "Training", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Completed attempts · All time")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { adminRefs: { disconnected: boolean } })
            .adminRefs.disconnected,
      ),
    ).toBe(false);
    await expect(page.locator("dd").filter({ hasText: /^999$/ })).toHaveCount(
      0,
    );
  });
test("confirmed revocation removes Admin after a stable background check", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/admin");
  await expect(
    page.getByText("Active accounts", { exact: true }),
  ).toBeVisible();
  f.allow(false);
  f.holdPermission();
  const before = f.permissionCalls();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(f.permissionCalls).toBe(before + 1);
  await expect(
    page.getByRole("heading", { name: "Admin", exact: true }),
  ).toBeVisible();
  f.releasePermission();
  await expect(page).toHaveURL(/settings/);
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toHaveCount(0);
});
for (const event of ["SIGNED_OUT", "SIGNED_IN"])
  test(`${event} clears the old account's Admin state`, async ({ page }) => {
    const f = await fixture(page);
    await page.goto("/admin");
    await expect(
      page.getByText("Active accounts", { exact: true }),
    ).toBeVisible();
    f.allow(false);
    await authEvent(
      page,
      event,
      event === "SIGNED_IN"
        ? "b0000000-0000-4000-8000-000000000002"
        : undefined,
    );
    await expect(
      page.getByRole("link", { name: "Admin", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("main", { name: "Overview" })).toHaveCount(0);
  });

for (const width of [1440, 390]) {
  for (const reduced of [false, true]) {
    test(`Overview period indicator stays vertically aligned at ${width}${reduced ? " reduced" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
      const f = await fixture(page);
      f.holdRanges();
      const control = page.getByRole("radiogroup", { name: "Overview period" });
      const sample = () => page.evaluate(() => new Promise<{ x: number; yError: number; targetX: number; groupY: number }[]>((resolve) => {
        const frames: { x: number; yError: number; targetX: number; groupY: number }[] = [];
        const tick = () => {
          const group = document.querySelector('[role="radiogroup"][aria-label="Overview period"]')!;
          const target = group.querySelector('[aria-checked="true"]')!.getBoundingClientRect();
          const indicator = group.querySelector('.bg-selected')!.getBoundingClientRect();
          frames.push({ x: indicator.x, yError: indicator.y - target.y, targetX: target.x, groupY: group.getBoundingClientRect().y });
          if (frames.length === 30) resolve(frames); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      for (let visit = 0; visit < 3; visit++) {
        if (visit === 0) await page.goto("/admin");
        else await page.getByRole("link", { name: "Overview", exact: true }).click();
        await expect(control.getByRole("radio", { name: "7 days", exact: true })).toHaveAttribute("aria-checked", "true");
        await expect.poll(() => f.periods.filter(p => p === "7d").length).toBe(visit * 2 + 1);
        const beforeY = (await control.boundingBox())!.y;
        const loadingFrames = sample();
        f.releaseRange("7d", 84);
        await expect(page.getByRole("region", { name: "Current totals" })).toBeVisible();
        const frames = await loadingFrames;
        expect(Math.max(...frames.map(f => Math.abs(f.yError)))).toBeLessThan(1);
        expect((await control.boundingBox())!.y).toBeGreaterThan(beforeY + 20);
        for (const label of ["24 hours", "30 days", "All time", "7 days"]) {
          const oldX = (await control.locator('.bg-selected').boundingBox())!.x;
          const moving = sample();
          await control.getByRole("radio", { name: label, exact: true }).click();
          const positions = await moving;
          const finalX = (await control.getByRole("radio", { name: label, exact: true }).boundingBox())!.x;
          expect(Math.max(...positions.map(f => Math.abs(f.yError)))).toBeLessThan(1);
          expect(Math.abs(positions.at(-1)!.x - finalX)).toBeLessThan(1);
          const intermediate = positions.some(f => f.x > Math.min(oldX, finalX) + 1 && f.x < Math.max(oldX, finalX) - 1);
          expect(intermediate).toBe(!reduced);
        }
        await page.getByRole("link", { name: "Feedback", exact: true }).click();
      }
    });
  }
}

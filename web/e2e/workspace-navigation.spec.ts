import { test, expect, type Page } from "@playwright/test";

const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Sections" }).filter({ visible: true });
const active = (page: Page, name: string) =>
  navigation(page).getByRole("link", { name, exact: true });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`workspace tabs preserve root URL and history at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    for (const name of ["Training", "Letter Pairs", "Flashcards", "Timer"]) {
      await active(page, name).click();
      await expect(active(page, name)).toHaveAttribute("aria-current", "page");
      await expect(page).toHaveURL(new URL("/", page.url()).href);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
    await page.goBack();
    await expect(active(page, "Flashcards")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.reload();
    await expect(active(page, "Flashcards")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goBack();
    await expect(active(page, "Letter Pairs")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goForward();
    await expect(active(page, "Flashcards")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await active(page, "Settings").click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.goBack();
    await expect(active(page, "Flashcards")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page).toHaveURL(new URL("/", page.url()).href);
  });
}

for (const [path, name] of [
  ["/training", "Training"],
  ["/pairs", "Letter Pairs"],
  ["/flashcards", "Flashcards"],
  ["/memo", "Training"],
]) {
  test(`legacy link ${path} opens its workspace and cleans the URL`, async ({
    page,
  }) => {
    await page.goto(`${path}?sizing=legacy`);
    await expect(active(page, name)).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(new URL("/?sizing=legacy", page.url()).href);
    await page.reload();
    await expect(active(page, name)).toHaveAttribute("aria-current", "page");
  });
}

test("workspace state cannot select the admin screen and guest admin access still redirects", async ({
  page,
}) => {
  await page.addInitScript(() => {
    history.replaceState(
      { ...history.state, usr: { workspace: "/admin/feedback" } },
      "",
    );
  });
  await page.goto("/");
  await expect(active(page, "Timer")).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Feedback", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/feedback");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Feedback", exact: true }),
  ).toHaveCount(0);
  await page.goto("/signin");
  await expect(page).toHaveURL(/\/signin$/);
});

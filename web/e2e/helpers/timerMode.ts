import { expect, type Page } from "@playwright/test";
export async function chooseTimerMode(page: Page, value: string) {
  const label =
    value === "3bld" ? "3BLD" : value === "edges" ? "Edges" : "Corners";
  await page.getByRole("button", { name: "Timer mode", exact: true }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  // Keyboard timing stays blocked until the exiting dialog is unmounted.
  await expect(page.getByRole("dialog", { name: "Timer mode choices", exact: true, includeHidden: true })).toHaveCount(0);
}

import { type Page } from "@playwright/test";
export async function chooseTimerMode(page: Page, value: string) {
  const label =
    value === "3bld" ? "3BLD" : value === "edges" ? "Edges" : "Corners";
  await page.getByRole("button", { name: "Timer mode", exact: true }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
}

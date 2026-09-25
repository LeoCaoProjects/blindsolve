import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page, path = "/pairs") {
  await page.goto(path);
  const defaults = page.getByRole("button", { name: "Use these defaults" });
  if (await defaults.isVisible()) await defaults.click();
}
async function startTimer(page: Page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
}
async function addPair(page: Page, word = "tow") {
  await page.getByRole("button", { name: "T W: empty", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "tower", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Primary mnemonic", { exact: true }).fill(word);
  await page.getByLabel("Alternate mnemonic", { exact: true }).fill("tower");
  await page.getByRole("button", { name: "Save", exact: true }).click();
}
test("pairs: keyboard, suggestions, aliases, search, edit, persistence and clear", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "A A: empty", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "B A: empty", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "B A: empty", exact: true }),
  ).toBeFocused();
  await addPair(page);
  await page.getByRole("searchbox", { name: "Search pairs" }).fill("tow");
  await expect(
    page.getByRole("cell", { name: "tow", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "T W: tow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "T W: tow", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Can't think of one? Show suggestions",
      exact: true,
    })
    .click();
  await expect(page.locator(".suggestions")).toBeVisible();
  await page.getByRole("button", { name: "Clear fields", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "T W: empty", exact: true }),
  ).toBeVisible();
});
test("flashcards: reveal, edit in place, scoring, route history", async ({
  page,
}) => {
  await setup(page);
  await addPair(page);
  await page.getByRole("link", { name: "Flashcards", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Reveal/ })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "tow", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit mnemonic" }).click();
  await page.getByLabel("Primary mnemonic", { exact: true }).fill("towel");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "towel", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByText("1 reviewed this session")).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("1");
  await expect(page.getByText("2 reviewed this session")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/pairs$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/flashcards$/);
});
test("memo: real state, hide, correct recall, unknown words and incorrect answer", async ({
  page,
}) => {
  await setup(page, "/memo");
  await page.getByRole("button", { name: "Start exercise" }).click();
  await expect(page.getByRole("button", { name: /^Ready/ })).toBeVisible({
    timeout: 45000,
  });
  const corners = await page
      .locator('.memo-study [aria-label^="Corners:"]')
      .getAttribute("aria-label"),
    edges = await page
      .locator('.memo-study [aria-label^="Edges:"]')
      .getAttribute("aria-label");
  await page.getByRole("button", { name: /^Ready/ }).click();
  await expect(page.locator(".memo-study")).toHaveCount(0);
  await page
    .getByLabel("Corners", { exact: true })
    .fill(corners!.replace("Corners: ", ""));
  await page
    .getByLabel("Edges", { exact: true })
    .fill(edges!.replace("Edges: ", ""));
  await page.getByRole("button", { name: /Check memo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Correct", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No mnemonic saved").first()).toBeVisible();
  await page.getByRole("button", { name: "Next exercise" }).click();
  await page.getByRole("button", { name: /^Ready/ }).click();
  await page.getByLabel("Corners", { exact: true }).fill("WRONG");
  await page.getByRole("button", { name: /Check memo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Memo differs" }),
  ).toBeVisible();
});
test("timer: keyboard split, automatic reconstruction, DNF and saved memo", async ({
  page,
}) => {
  await setup(page, "/");
  await expect(
    page.getByRole("button", { name: "Start timer", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.getByRole("heading", { name: "Timer", exact: true }).focus();
  await startTimer(page);
  await expect(
    page.getByRole("button", { name: "Begin execution", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("dialog", { name: "Memo reconstruction" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /DNF/ }).click();
  for (let i = 0; i < 20; i++) {
    const candidate = page.locator(".cycle-token-list button").first();
    if (!(await candidate.isVisible())) break;
    await page.keyboard.press((await candidate.innerText()).trim());
    await page.waitForTimeout(240);
  }
  await expect(page.locator('input[aria-label^="Word you used for"]:visible').first()).toBeVisible({ timeout: 10000 });
  for (let index = 0; index < 48; index++) {
    const word = page.locator('input[aria-label^="Word you used for"]:visible').first();
    if (!(await word.isVisible())) break;
    const label = await word.getAttribute("aria-label");
    await word.fill(`image ${index + 1}`);
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByLabel(label!, { exact: true })).toBeHidden();
    await page.waitForTimeout(220);
  }
  await expect(page.getByRole("heading", { name: "Corners" })).toBeVisible();
  await page.getByRole("button", { name: "Save solve" }).click();
  await expect(page.getByRole("dialog", { name: "Memo reconstruction" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".workspace-history").getByRole("button", { name: /DNF/ })).toBeVisible();
});
test("settings: draft validation, custom tokens, buffer, theme and reload", async ({
  page,
}) => {
  await setup(page, "/settings");
  await page.getByLabel("U:UB edge token", { exact: true }).fill("CH");
  await page.getByLabel("Edge buffer", { exact: true }).selectOption("U:UF");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByText("Setup is up to date")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("U:UB edge token", { exact: true })).toHaveValue(
    "CH",
  );
  await expect(page.getByLabel("Edge buffer", { exact: true })).toHaveValue(
    "U:UF",
  );
  await page.getByLabel("Front colour", { exact: true }).selectOption("D");
  await page.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByRole("alert")).toContainText("adjacent");
  await page.getByRole("button", { name: "Use light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

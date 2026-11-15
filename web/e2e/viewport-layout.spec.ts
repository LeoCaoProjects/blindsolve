import { expect, test } from "@playwright/test";

test("intentional subnav navigation animates while root-size changes do not restart it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeEnabled({ timeout: 45000 });
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    document.documentElement.setAttribute("data-audit-slides", "0");
    Element.prototype.animate = function (...args) {
      if (this.hasAttribute("data-page-workspace"))
        document.documentElement.setAttribute(
          "data-audit-slides",
          String(
            Number(document.documentElement.getAttribute("data-audit-slides")) +
              1,
          ),
        );
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("navigation", { name: "Sections", exact: true })
    .filter({ visible: true })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-audit-slides", "1");
  await page.setViewportSize({ width: 1440, height: 720 });
  await expect(page.locator("html")).toHaveCSS("font-size", "15.36px");
  await expect(page.locator("[data-page-workspace]")).toHaveCSS(
    "transform",
    "none",
  );
  await expect(page.locator("html")).toHaveAttribute("data-audit-slides", "1");
});

test("real narrowing collapses navigation and restoring the window brings it back", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings");
  await expect(page.locator("[data-subnav-column]")).toHaveCount(1);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator("[data-subnav-column]")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-viewport-sizing",
  );
  const nav = page
    .getByRole("navigation", { name: "Sections", exact: true })
    .filter({ visible: true });
  expect((await nav.boundingBox())!.y).toBeGreaterThan(700);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("[data-subnav-column]")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute(
    "data-viewport-layout",
    /context/,
  );
});

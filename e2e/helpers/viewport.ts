import type { Page } from "@playwright/test";

export function viewportGeometry(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return {
      rem: parseFloat(getComputedStyle(root).fontSize),
      contextual: root.hasAttribute("data-viewport-sizing")
        ? (root.getAttribute("data-viewport-layout") ?? "").split(" ").includes("context")
        : innerWidth >= 1024,
    };
  });
}

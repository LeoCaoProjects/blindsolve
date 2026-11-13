import { viewportGeometry } from "./helpers/viewport";
import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";
const sizes = [
  [1440, 900],
  [1280, 720],
  [1024, 768],
  [900, 560],
  [390, 844],
  [320, 568],
];
const destinations = [
  "Training",
  "Timer",
  "Settings",
  "Timer",
  "Letter Pairs",
  "Timer",
  "Training",
  "Settings",
  "Letter Pairs",
  "Training",
];
async function recordTransition(page: Page, label: string) {
  const frames = page.evaluate(
    () =>
      new Promise<
        {
          x: number;
          y: number;
          width: number;
          height: number;
          visible: boolean;
          sameNode: boolean;
          transformed: boolean;
          count: number;
          column: number;
          workspace: number;
        }[]
      >((resolve) => {
        const visibleNavs = () =>
          Array.from(
            document.querySelectorAll<HTMLElement>(
              'nav[aria-label="Sections"]',
            ),
          ).filter(
            (nav) =>
              nav.getBoundingClientRect().width > 0 &&
              nav.getBoundingClientRect().height > 0,
          );
        const original = visibleNavs()[0];
        const frames: {
          x: number;
          y: number;
          width: number;
          height: number;
          visible: boolean;
          sameNode: boolean;
          transformed: boolean;
          count: number;
          column: number;
          workspace: number;
        }[] = [];
        const sample = () => {
          const navs = visibleNavs(),
            nav = navs[0];
          const rect = nav.getBoundingClientRect();
          let transformed = false;
          for (
            let node: HTMLElement | null = nav;
            node;
            node = node.parentElement
          ) {
            const style = getComputedStyle(node);
            if (
              style.transform !== "none" ||
              style.translate !== "none" ||
              style.scale !== "none"
            )
              transformed = true;
          }
          const hit = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + Math.min(28, rect.height / 2),
          );
          frames.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            visible:
              getComputedStyle(nav).visibility === "visible" &&
              Number(getComputedStyle(nav).opacity) === 1 &&
              !!hit &&
              nav.contains(hit),
            sameNode: nav === original,
            transformed,
            count: navs.length,
            column:
              document
                .querySelector("[data-subnav-column]")
                ?.getBoundingClientRect().width ?? 0,
            workspace: document
              .querySelector("[data-page-workspace]")!
              .getBoundingClientRect().x,
          });
          if (frames.length < 24) requestAnimationFrame(sample);
          else resolve(frames);
        };
        document.addEventListener(
          "click",
          () => requestAnimationFrame(sample),
          { once: true, capture: true },
        );
      }),
  );
  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link", { name: label, exact: true })
    .click();
  return frames;
}
for (const [width, height] of sizes)
  test(`global navigation is a static anchor through all contextual transitions at ${width}x${height}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    await page.addInitScript(
      (scheme) =>
        localStorage.setItem(
          "cubeiq-bld-v2:guest",
          JSON.stringify({
            data: {
              scheme,
              pairs: {},
              solves: [],
              attempts: [],
              onboarded: true,
            },
            revision: 0,
            dirty: false,
            pending: {},
          }),
        ),
      createSpeffzScheme(),
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "New scramble" }),
    ).toBeEnabled({ timeout: 45000 });
    const initial = (await page
      .getByRole("navigation", { name: "Sections" })
      .filter({ visible: true })
      .boundingBox())!;
    let previous = "Timer";
    for (const label of destinations) {
      const frames = await recordTransition(page, label);
      expect(
        frames.every(
          (frame) =>
            frame.count === 1 &&
            frame.sameNode &&
            frame.visible &&
            !frame.transformed,
        ),
        `${previous} → ${label}: permanent visible node outside transforms`,
      ).toBe(true);
      expect(
        frames.every(
          (frame) =>
            Math.abs(frame.x - initial.x) < 0.1 &&
            Math.abs(frame.y - initial.y) < 0.1 &&
            Math.abs(frame.width - initial.width) < 0.1 &&
            Math.abs(frame.height - initial.height) < 0.1,
        ),
        `${previous} → ${label}: unchanged global navigation rectangle`,
      ).toBe(true);
      const { rem, contextual } = await viewportGeometry(page);
      const expected = contextual && label !== "Timer" ? 224 * rem / 16 : 0;
      expect(frames.at(-1)!.column).toBeCloseTo(expected, 1);
      if (contextual && previous !== "Timer" && label !== "Timer") {
        expect(
          frames.every(
            (frame) =>
              Math.abs(frame.column - 224 * rem / 16) < 0.1 &&
              Math.abs(frame.workspace - 296 * rem / 16) < 0.1,
          ),
        ).toBe(true);
      }
      previous = label;
    }
  });

test("persistent global shortcuts still open the current page dialog", async ({
  page,
}) => {
  await page.addInitScript(
    (scheme) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            pairs: {},
            solves: [],
            attempts: [],
            onboarded: true,
          },
          revision: 0,
          dirty: false,
          pending: {},
        }),
      ),
    createSpeffzScheme(),
  );
  await page.goto("/");
  for (const label of [
    "Training",
    "Settings",
    "Letter Pairs",
    "Flashcards",
    "Timer",
  ]) {
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await page.getByRole("button", { name: /Keyboard shortcuts/ }).click();
    const dialog = page.getByRole("dialog", {
      name: "Keyboard shortcuts",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

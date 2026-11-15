import { useSyncExternalStore } from "react";
import {
  layoutTokens,
  referenceViewportWidth,
  viewportLayoutPolicy,
} from "./viewportLayoutPolicy";

/** Default sizing baseline. ?sizing=legacy is a development comparison fallback.
 * No browser zoom or display-DPI detection. */
export const viewportSizingEnabled =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("sizing") !== "legacy";

// Shape and input capability survive desktop page zoom. Keep touch/portrait
// layouts on their existing root sizing rather than following address-bar height.
export const viewportSizingQuery =
  "(min-aspect-ratio: 1/1) and (hover: hover) and (pointer: fine)";
let active = false;
let tokens = "";
const listeners = new Set<() => void>();
export const isViewportSizingActive = () => active;
export const viewportReferenceScale = () =>
  active
    ? (parseFloat(getComputedStyle(document.documentElement).fontSize) ||
        viewportLayoutPolicy.referenceRoot) / viewportLayoutPolicy.referenceRoot
    : 1;
export const subscribeViewportLayout = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};
export const hasViewportLayout = (name: string) =>
  tokens.split(" ").includes(name);

if (viewportSizingEnabled) {
  const media = window.matchMedia(viewportSizingQuery);
  const scrollPositions = new Map<HTMLElement, { x: number; y: number }>();
  let lastRootFont =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 19.2;
  const rememberScroll = (event: Event) => {
    const element = event.target;
    if (!(element instanceof HTMLElement)) return;
    const font =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 19.2;
    // A zoom-generated scroll event must not overwrite the pre-zoom anchor.
    if (Math.abs(font - lastRootFont) > 0.001) return;
    scrollPositions.set(element, {
      x: element.scrollLeft / font,
      y: element.scrollTop / font,
    });
  };
  const update = () => {
    const root = document.documentElement;
    const nextActive = media.matches;
    root.toggleAttribute("data-viewport-sizing", nextActive);
    const rootFont = parseFloat(getComputedStyle(root).fontSize) || 19.2;
    const next = nextActive
      ? layoutTokens(
          referenceViewportWidth(innerWidth, rootFont),
          active ? tokens : undefined,
        )
      : "";
    const changed = nextActive !== active || next !== tokens;
    active = nextActive;
    tokens = next;
    if (root.getAttribute("data-viewport-layout") !== next)
      root.setAttribute("data-viewport-layout", next);
    for (const [element, position] of scrollPositions) {
      if (!element.isConnected) {
        scrollPositions.delete(element);
        continue;
      }
      if (Math.abs(rootFont - lastRootFont) > 0.001) {
        element.scrollLeft = position.x * rootFont;
        element.scrollTop = position.y * rootFont;
      }
    }
    lastRootFont = rootFont;
    if (changed) listeners.forEach((notify) => notify());
  };
  let frame = 0;
  const schedule = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
  };
  update();
  schedule();
  media.addEventListener("change", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("scroll", rememberScroll, {
    capture: true,
    passive: true,
  });
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      media.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", rememberScroll, true);
      cancelAnimationFrame(frame);
    });
}

const subscribe = (notify: () => void) => {
  if (!viewportSizingEnabled) return () => {};
  return subscribeViewportLayout(notify);
};

export const useViewportSizingActive = () =>
  useSyncExternalStore(subscribe, isViewportSizingActive, () => false);

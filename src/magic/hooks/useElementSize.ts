import { useCallback, useRef, useState } from "react";
import { useViewportSizingActive } from "../utils/viewportSizing";
import { viewportLayoutPolicy } from "../utils/viewportLayoutPolicy";

type Size = { width: number; height: number };

/**
 * Content-box size of an element; drives canvas-like pieces (cubes) that need numeric sizes.
 *
 * Uses a callback ref, so it follows the element itself: whenever the measured element mounts,
 * unmounts or is replaced (e.g. a panel that only exists in some modes), it re-measures and
 * re-observes. The first measurement happens synchronously when the element attaches, which
 * React flushes before paint, so there's no frame drawn at a stale or fallback size.
 */
export function useElementSize<T extends HTMLElement>(
  fallback: Size = { width: 800, height: 600 },
) {
  const rootUnits = useViewportSizingActive();
  const [size, setSize] = useState<Size>(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (el: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el) return;
      const update = (measuredWidth: number, measuredHeight: number) => {
        // Box and root come from one layout delivery, never independent states.
        const unit = rootUnits
          ? parseFloat(getComputedStyle(document.documentElement).fontSize) /
            viewportLayoutPolicy.referenceRoot
          : 1;
        const normalize = (value: number) =>
          rootUnits ? Math.round((value / unit) * 2) / 2 : value;
        const width = normalize(measuredWidth),
          height = normalize(measuredHeight);
        setSize((prev) =>
          Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
            ? prev
            : { width, height },
        );
      };
      const style = getComputedStyle(el);
      const padX =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      update(el.clientWidth - padX, el.clientHeight - padY);
      const ro = new ResizeObserver(([entry]) =>
        update(entry.contentRect.width, entry.contentRect.height),
      );
      ro.observe(el);
      observer.current = ro;
    },
    [rootUnits],
  );

  return [ref, size] as const;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

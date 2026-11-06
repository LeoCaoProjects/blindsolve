import { useCallback, useEffect, useState } from "react";

const readDesignScale = () =>
  (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;

/** Bridge rem-based design tokens into pixel-based DOM measurements/windowing.
 * Reads CSS typography, never browser zoom or devicePixelRatio.
 */
export function useDesignPixels() {
  const [scale, setScale] = useState(readDesignScale);
  useEffect(() => {
    const update = () => setScale(readDesignScale());
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(document.documentElement);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return useCallback((designPixels: number) => designPixels * scale, [scale]);
}

export const designRem = (pixels: number) => `${pixels / 16}rem`;

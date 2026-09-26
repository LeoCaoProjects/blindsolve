import { useEffect, useRef, useState } from 'react';

/** Content-box size of an element; drives canvas-like pieces (cubes) that need numeric sizes. */
export function useElementSize<T extends HTMLElement>(fallback = { width: 800, height: 600 }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
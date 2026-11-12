import { useElementSize } from "./useElementSize";

export function useElementWidth<T extends HTMLElement>(fallback = 400) {
  const [ref, size] = useElementSize<T>({ width: fallback, height: 0 });
  return [ref, size.width] as const;
}

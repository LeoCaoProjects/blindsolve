import policy from "../../styles/viewport-layout.json";
export { policy as viewportLayoutPolicy };
/** Available width in the same reference units as the naturally scaled UI.
 * Both viewport width and root font shrink with native zoom; their ratio holds.
 */
export const referenceViewportWidth = (width: number, rootFont: number) =>
  (width * policy.referenceRoot) / rootFont;
export function layoutTokens(width: number, previous?: string) {
  const held = new Set(previous?.split(" ") ?? []);
  return Object.entries(policy.breakpoints)
    .filter(([name, threshold]) => {
      if (previous === undefined) return width >= threshold;
      return held.has(name)
        ? width >= threshold - policy.hysteresis
        : width >= threshold + policy.hysteresis;
    })
    .map(([name]) => name)
    .join(" ");
}

import type { CSSProperties } from "react";
import { viewportLayoutPolicy } from "./viewportLayoutPolicy";
const lengths = new Set([
  "width",
  "height",
  "left",
  "right",
  "top",
  "bottom",
  "perspective",
  "gap",
  "padding",
  "borderRadius",
  "fontSize",
]);
/** Reference-pixel cube geometry becomes rem geometry, so CSS can paint a zoom
 * immediately without waiting for a second React/ResizeObserver measurement.
 * Unitless opacity/rotation/state values are never converted.
 */
export function cubeGeometry(
  style: CSSProperties,
  rootUnits: boolean,
): CSSProperties {
  if (!rootUnits) return style;
  const rem = (value: number) =>
    `${value / viewportLayoutPolicy.referenceRoot}rem`;
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [
      key,
      typeof value === "number" && lengths.has(key)
        ? rem(value)
        : typeof value === "string" &&
            (key === "transform" || key === "boxShadow")
          ? value.replace(/(-?(?:\d*\.)?\d+)px\b/g, (_, amount) =>
              rem(Number(amount)),
            )
          : value,
    ]),
  ) as CSSProperties;
}

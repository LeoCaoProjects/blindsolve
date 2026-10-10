import { methodRelativeEdgeStickerId } from "../../domain/bld/orientation";
import { CubeViewPref, EdgeMethod } from "../types/app";
import { COLOR_FACE } from "./view";

export const CONVENTIONAL_METHOD_BUFFER: Record<EdgeMethod, string> = {
  m2: "D:DF",
  op: "U:UL",
};

/**
 * One-time settings convenience only. The returned directed sticker is physical;
 * once saved, the cube view has no further effect on execution semantics.
 */
export function conventionalPhysicalEdgeBuffer(
  method: EdgeMethod,
  view: CubeViewPref,
): string {
  const physical = methodRelativeEdgeStickerId(
    CONVENTIONAL_METHOD_BUFFER[method],
    {
      up: COLOR_FACE[view.top],
      front: COLOR_FACE[view.front],
    },
  );
  if (!physical)
    throw new Error("Default Cube View is not a valid orientation");
  return physical;
}

import { describe, expect, it } from "vitest";
import { conventionalPhysicalEdgeBuffer } from "./methodBuffers";

describe("conventional method buffers through Default Cube View", () => {
  it.each([
    ["m2", "white", "green", "D:DF"],
    ["op", "white", "green", "U:UL"],
    ["m2", "white", "orange", "D:DL"],
    ["op", "white", "orange", "U:UB"],
    ["m2", "green", "white", "B:UB"],
    ["op", "green", "white", "F:FR"],
  ] as const)(
    "%s with %s top / %s front maps to %s",
    (method, top, front, physical) => {
      expect(conventionalPhysicalEdgeBuffer(method, { top, front })).toBe(
        physical,
      );
    },
  );
});

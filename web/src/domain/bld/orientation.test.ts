import { it, expect } from "vitest";
import {
  canonicalEdgeStickerToMethodId,
  inferM2OrientationFromBuffer,
  methodRelativeEdgeStickerId,
  orientationFaceMap,
} from "./orientation";
it("maps physical colours for a red-front and green-up hold", () => {
  expect(orientationFaceMap({ up: "U", front: "R" })).toEqual({
    U: "U",
    D: "D",
    F: "R",
    B: "L",
    R: "B",
    L: "F",
  });
  expect(orientationFaceMap({ up: "F", front: "D" })).toEqual({
    U: "F",
    D: "B",
    F: "D",
    B: "U",
    R: "R",
    L: "L",
  });
  expect(orientationFaceMap({ up: "U", front: "D" })).toBeNull();
});
it("admits exactly the 24 distinct cube orientations", () => {
  const maps = [];
  for (const up of "UDLRFB")
    for (const front of "UDLRFB") {
      const m = orientationFaceMap({ up, front });
      if (m) maps.push(JSON.stringify(m));
    }
  expect(new Set(maps).size).toBe(24);
});

it("maps method-relative edge stickers through a white-top orange-front frame", () => {
  const orientation = { up: "U", front: "L" };
  expect(methodRelativeEdgeStickerId("U:UF", orientation)).toBe("U:UL");
  expect(methodRelativeEdgeStickerId("D:DB", orientation)).toBe("D:DR");
  expect(methodRelativeEdgeStickerId("F:UF", orientation)).toBe("L:UL");
  expect(methodRelativeEdgeStickerId("B:DB", orientation)).toBe("R:DR");
  expect(methodRelativeEdgeStickerId("D:DF", orientation)).toBe("D:DL");
  expect(canonicalEdgeStickerToMethodId("L:UL", orientation)).toBe("F:UF");
  expect(canonicalEdgeStickerToMethodId("R:DR", orientation)).toBe("B:DB");
});

it("infers a unique M2 frame from every directed physical edge buffer", () => {
  const orientations = [];
  const buffers = new Set<string>();
  for (const up of "UDLRFB") {
    for (const front of "UDLRFB") {
      const orientation = { up, front };
      if (!orientationFaceMap(orientation)) continue;
      orientations.push(orientation);
      const buffer = methodRelativeEdgeStickerId("D:DF", orientation)!;
      buffers.add(buffer);
      const inferred = inferM2OrientationFromBuffer(buffer);
      expect(inferred).toEqual(orientation);
      expect(methodRelativeEdgeStickerId("D:DF", inferred!)).toBe(buffer);
    }
  }
  expect(orientations).toHaveLength(24);
  expect(buffers.size).toBe(24);
});

it("infers white-top orange-front from the physical D:DL buffer", () => {
  expect(inferM2OrientationFromBuffer("D:DL")).toEqual({
    up: "U",
    front: "L",
  });
});

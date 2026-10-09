import { it, expect } from "vitest";
import {
  canonicalEdgeStickerToMethodId,
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

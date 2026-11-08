import { describe, expect, it } from "vitest";
import {
  ALL_STICKERS,
  ALL_COLORS,
  stickerInView,
  stickerFromView,
} from "./scheme";
import { isValidView, COLOR_FACE } from "./view";
import { EDGE_PIECES } from "../../domain/bld/speffz";
import { methodRelativeEdgeStickerId } from "../../domain/bld/orientation";

describe("physical lettering through the configured view", () => {
  it("maps UL to different physical stickers for green and blue fronts", () => {
    const green = { top: "white", front: "green" } as const;
    const blue = { top: "white", front: "blue" } as const;
    expect(stickerFromView("U3", green).id).toBe("U3");
    expect(stickerFromView("U3", blue).id).toBe("U5");
    expect(stickerInView("U3", blue).piece).toBe("UR");
    expect(stickerInView("U5", blue).piece).toBe("UL");
  });
  it("is a bijection for every sticker under all 24 valid orientations", () => {
    let count = 0;
    for (const top of ALL_COLORS)
      for (const front of ALL_COLORS) {
        const view = { top, front };
        if (!isValidView(view)) continue;
        count++;
        expect(
          new Set(ALL_STICKERS.map((s) => stickerInView(s.id, view).id)).size,
        ).toBe(48);
        for (const physical of ALL_STICKERS) {
          const slot = stickerInView(physical.id, view);
          expect(slot.type).toBe(physical.type);
          expect(stickerFromView(slot.id, view).id).toBe(physical.id);
        }
      }
    expect(count).toBe(24);
  });
  it("agrees with the existing domain physical-buffer mapping for every edge", () => {
    const canonicalPiece = (piece: string) =>
      EDGE_PIECES.find(
        (p) => [...p].sort().join("") === [...piece].sort().join(""),
      )!;
    for (const top of ALL_COLORS)
      for (const front of ALL_COLORS) {
        const view = { top, front };
        if (!isValidView(view)) continue;
        for (const slot of ALL_STICKERS.filter((s) => s.type === "edge")) {
          const physical = stickerFromView(slot.id, view);
          expect(`${physical.face}:${canonicalPiece(physical.piece)}`).toBe(
            methodRelativeEdgeStickerId(
              `${slot.face}:${canonicalPiece(slot.piece)}`,
              { up: COLOR_FACE[top], front: COLOR_FACE[front] },
            ),
          );
        }
      }
  });
});

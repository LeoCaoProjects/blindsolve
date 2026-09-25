import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSpeffzScheme } from "../domain/bld/speffz";
import { RailCube3D } from "./RailCube3D";

describe("RailCube3D", () => {
  it("draws the user's physical sticker tokens directly on the cube", () => {
    const scheme = createSpeffzScheme();
    scheme.stickers["U:UB"] = { ...scheme.stickers["U:UB"], label: "CH" };
    render(<RailCube3D scramble="R U" scheme={scheme} size={272} showLetters />);
    expect(screen.getByText("CH")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /sticker letters/i })).toBeNull();
  });

  it("uses the physical sticker id when a highlighted sticker is picked", () => {
    const scheme = createSpeffzScheme();
    scheme.stickers["U:UB"] = { ...scheme.stickers["U:UB"], label: "CH" };
    const onPick = vi.fn();
    render(
      <RailCube3D
        scramble=""
        scheme={scheme}
        size={260}
        highlight={{ type: "edge", stickerIds: ["U:UB"], onPick }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sticker CH" }));
    expect(onPick).toHaveBeenCalledWith("U:UB");
  });
});

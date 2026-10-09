import React from "react";
import type { BldFace, BldSetup, FaceColor } from "../../types/app";
import {
  ALL_COLORS,
  COLOR_NAMES,
  REFERENCE_COLORS,
  stickerById,
  validFronts,
} from "../../utils/scheme";
import { classicM2BufferId, isClassicM2Setup } from "../../utils/bld";

const faceForColor = (color: FaceColor) =>
  (Object.entries(REFERENCE_COLORS).find(([, value]) => value === color)?.[0] ??
    "U") as BldFace;

export function BldOrientationPanel({
  setup,
  onChange,
}: {
  setup: BldSetup;
  onChange: (orientation: BldSetup["orientation"]) => void;
}) {
  const top = REFERENCE_COLORS[setup.orientation.up];
  const front = REFERENCE_COLORS[setup.orientation.front];
  const fronts = validFronts(top);
  const expectedBuffer = classicM2BufferId(setup);
  const compatible = isClassicM2Setup(setup);
  const updateTop = (nextTop: FaceColor) => {
    const valid = validFronts(nextTop);
    const nextFront = valid.includes(front) ? front : valid[0];
    onChange({ up: faceForColor(nextTop), front: faceForColor(nextFront) });
  };

  return (
    <div className="mt-8 border-t border-line pt-6">
      <h3 className="text-[12px] text-ink-3">BLD orientation</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
        Defines method-relative targets and buffers. This is independent of Cube view.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[12px] text-ink-3">
          Top
          <select
            aria-label="BLD orientation top"
            value={top}
            onChange={(event) => updateTop(event.target.value as FaceColor)}
            className="h-9 rounded-[4px] border border-line bg-surface px-2 text-[13px] text-ink"
          >
            {ALL_COLORS.map((color) => (
              <option key={color} value={color}>{COLOR_NAMES[color]}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[12px] text-ink-3">
          Front
          <select
            aria-label="BLD orientation front"
            value={front}
            onChange={(event) =>
              onChange({ ...setup.orientation, front: faceForColor(event.target.value as FaceColor) })
            }
            className="h-9 rounded-[4px] border border-line bg-surface px-2 text-[13px] text-ink"
          >
            {fronts.map((color) => (
              <option key={color} value={color}>{COLOR_NAMES[color]}</option>
            ))}
          </select>
        </label>
      </div>
      {setup.edgeMethod === "m2" && !compatible && expectedBuffer && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-amber-700 dark:text-amber-300" role="status">
          Classic M2 auto-swap requires the method-relative DF buffer. For this orientation,
          choose {stickerById(expectedBuffer).piece}; the current buffer is {stickerById(setup.edgeBuffer).piece}.
        </p>
      )}
    </div>
  );
}

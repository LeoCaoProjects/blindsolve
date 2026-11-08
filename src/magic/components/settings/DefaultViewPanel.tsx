import React from "react";
import { CubeViewPref, FaceColor } from "../../types/app";
import {
  ALL_COLORS,
  COLOR_HEX,
  COLOR_NAMES,
  validFronts,
} from "../../utils/scheme";
import { FACE_COLOR, STANDARD_VIEW, sameView } from "../../utils/view";
import type { CubeView } from "../cube/SchemeCube";
import { SecondaryButton, QuietButton } from "../common/PrimaryButton";

interface DefaultViewPanelProps {
  value: CubeViewPref;
  /** What the cube currently shows, including any manual rotation */
  live: CubeView;
  onChange: (v: CubeViewPref) => void;
  onResetRotation: () => void;
}

export function DefaultViewPanel({
  value,
  live,
  onChange,
  onResetRotation,
}: DefaultViewPanelProps) {
  const liveView: CubeViewPref = {
    top: FACE_COLOR[live.up],
    front: FACE_COLOR[live.front],
  };
  const liveValid = validFronts(liveView.top).includes(liveView.front);
  const rotated = liveValid && !sameView(liveView, value);

  return (
    <div>
      <p className="text-[14px] text-ink">
        {COLOR_NAMES[value.top]} top, {COLOR_NAMES[value.front]} front
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">
        Choose your top and front colours.
      </p>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[12.5px] text-ink-3">
          Drag the cube to try another view.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {rotated && (
            <SecondaryButton
              onClick={() => {
                onChange(liveView);
                onResetRotation();
              }}
              className="h-auto min-h-9 flex-wrap justify-start py-2"
            >
              Use displayed view
              {rotated && (
                <span className="ml-2 text-ink-3">
                  {COLOR_NAMES[liveView.top].toLowerCase()} top,{" "}
                  {COLOR_NAMES[liveView.front].toLowerCase()} front
                </span>
              )}
            </SecondaryButton>
          )}
          {rotated && (
            <QuietButton onClick={onResetRotation}>Reset</QuietButton>
          )}
        </div>
      </div>

      <div className="mt-7">
        <h4 className="text-[12px] text-ink-3">Top</h4>
        <ColorRow
          label="Top face"
          value={value.top}
          onChange={(top) =>
            onChange({
              top,
              front: validFronts(top).includes(value.front)
                ? value.front
                : validFronts(top)[0],
            })
          }
        />
      </div>
      <div className="mt-5">
        <h4 className="text-[12px] text-ink-3">Front</h4>
        <ColorRow
          label="Front face"
          value={value.front}
          enabled={validFronts(value.top)}
          onChange={(front) => onChange({ ...value, front })}
        />
      </div>

      {!sameView(value, STANDARD_VIEW) && (
        <QuietButton
          onClick={() => onChange(STANDARD_VIEW)}
          className="mt-6 h-auto min-h-9 text-left"
        >
          Back to white top, green front
        </QuietButton>
      )}
    </div>
  );
}

function ColorRow({
  label,
  value,
  enabled,
  onChange,
}: {
  label: string;
  value: FaceColor;
  enabled?: FaceColor[];
  onChange: (c: FaceColor) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="mt-2 flex flex-wrap gap-2"
    >
      {ALL_COLORS.map((c) => {
        const active = c === value;
        const disabled = enabled ? !enabled.includes(c) : false;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={COLOR_NAMES[c]}
            title={COLOR_NAMES[c]}
            disabled={disabled}
            onClick={() => onChange(c)}
            className="flex h-9 w-9 items-center justify-center rounded-[4px] transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-20"
            style={{ boxShadow: active ? "0 0 0 1.5px var(--ink)" : undefined }}
          >
            <span
              className="h-6 w-6 rounded-[3px]"
              style={{ background: COLOR_HEX[c] }}
            />
          </button>
        );
      })}
    </div>
  );
}

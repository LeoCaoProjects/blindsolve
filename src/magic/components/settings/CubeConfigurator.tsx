import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BldSetup, CubeMode, CubeViewPref } from "../../types/app";
import { useElementWidth } from "../../hooks/useElementWidth";
import { EASE_OUT } from "../../utils/keyboard";
import {
  COLOR_NAMES,
  REFERENCE_COLORS,
  isSpeffz,
  stickerById,
} from "../../utils/scheme";
import { Segmented } from "../common/Segmented";
import { SecondaryButton, QuietButton } from "../common/PrimaryButton";
import { TEXT_INPUT_STYLE } from "../common/formStyles";
import { CubeView, SchemeCube } from "../cube/SchemeCube";
import { BufferPanel } from "./BufferPanel";
import { DefaultViewPanel } from "./DefaultViewPanel";
import { StickerEditor } from "./StickerEditor";
import { StickerSwatch } from "./StickerSwatch";

interface CubeConfiguratorProps {
  setup: BldSetup;
  onChange: (patch: Partial<BldSetup>) => void;
  view: CubeViewPref;
  onViewChange: (v: CubeViewPref) => void;
  mode: CubeMode;
  onModeChange: (m: CubeMode) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUseSpeffz: () => void;
}

const MODES: { value: CubeMode; label: string }[] = [
  { value: "view", label: "Overview" },
  { value: "lettering", label: "Lettering" },
  { value: "edge-buffer", label: "Edge buffer" },
  { value: "corner-buffer", label: "Corner buffer" },
  { value: "cube-view", label: "Cube view" },
];

export function CubeConfigurator({
  setup,
  onChange,
  view,
  onViewChange,
  mode,
  onModeChange,
  selected,
  onSelect,
  onUseSpeffz,
}: CubeConfiguratorProps) {
  const colors = REFERENCE_COLORS;
  const reduced = useReducedMotion();
  const [live, setLive] = useState<CubeView>({ up: "U", front: "F" });
  const [resetSignal, setResetSignal] = useState(0);
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>(560);
  const cubeSize = Math.max(120, Math.min(380, stageWidth - 48));
  const speffz = isSpeffz(setup.scheme);

  const pick = (id: string) => {
    if (mode === "lettering") onSelect(id);
    if (mode === "edge-buffer") onChange({ edgeBuffer: id });
    if (mode === "corner-buffer") onChange({ cornerBuffer: id });
  };

  return (
    <div className="grid min-w-0 grid-cols-1 border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
        <div className="scroll-none overflow-x-auto border-b border-line px-4 py-3">
          <Segmented
            label="Cube mode"
            options={MODES}
            value={mode}
            onChange={onModeChange}
          />
        </div>
        <div
          ref={stageRef}
          className="relative flex min-w-0 items-center justify-center h-[340px] md:h-[440px]"
        >
          <SchemeCube
            scheme={setup.scheme}
            colors={colors}
            size={cubeSize}
            view={view}
            mode={mode}
            selected={mode === "lettering" ? selected : null}
            edgeBuffer={setup.edgeBuffer}
            cornerBuffer={setup.cornerBuffer}
            showBuffers={mode !== "lettering"}
            onPick={pick}
            onViewChange={setLive}
            resetSignal={resetSignal}
            label="Your cube"
          />

          <p className="absolute bottom-3 left-4 flex gap-4 font-mono text-[11px] text-ink-3">
            <span>
              <span className="mr-1.5 inline-block h-[9px] w-[9px] translate-y-[1px] rounded-[2px] shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.7),0_0_0_1px_var(--ink)]" />
              buffers {stickerById(setup.edgeBuffer)?.piece} ·{" "}
              {stickerById(setup.cornerBuffer)?.piece}
            </span>
          </p>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode + (mode === "lettering" ? (selected ?? "") : "")}
            initial={{ opacity: 0, x: reduced ? 0 : 3 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.14, ease: EASE_OUT }}
          >
            {mode === "view" && (
              <div className="grid gap-0">
                <SummaryRow
                  label="Lettering"
                  onChange={() => onModeChange("lettering")}
                >
                  <span className="text-ink">
                    {speffz ? "Speffz" : setup.schemeName || "Custom"}
                  </span>
                </SummaryRow>
                <SummaryRow
                  label="Edge buffer"
                  onChange={() => onModeChange("edge-buffer")}
                >
                  <BufferValue
                    id={setup.edgeBuffer}
                    token={setup.scheme[setup.edgeBuffer]}
                  />
                </SummaryRow>
                <SummaryRow
                  label="Corner buffer"
                  onChange={() => onModeChange("corner-buffer")}
                >
                  <BufferValue
                    id={setup.cornerBuffer}
                    token={setup.scheme[setup.cornerBuffer]}
                  />
                </SummaryRow>
                <SummaryRow
                  label="Cube view"
                  onChange={() => onModeChange("cube-view")}
                >
                  <span className="text-ink">
                    {COLOR_NAMES[view.top]} top · {COLOR_NAMES[view.front]}{" "}
                    front
                  </span>
                </SummaryRow>
              </div>
            )}

            {mode === "lettering" && (
              <div>
                {selected ? (
                  <StickerEditor
                    scheme={setup.scheme}
                    colors={colors}
                    selected={selected}
                    onSelect={onSelect}
                    onChange={(id, token) =>
                      onChange({ scheme: { ...setup.scheme, [id]: token } })
                    }
                  />
                ) : (
                  <p className="text-[13.5px] text-ink-2">Select a sticker</p>
                )}
                <div className="mt-8 border-t border-line pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-ink-2">
                      {speffz ? "Speffz" : "Custom"}
                    </span>
                    <SecondaryButton disabled={speffz} onClick={onUseSpeffz}>
                      Use Speffz
                    </SecondaryButton>
                  </div>
                  {!speffz && (
                    <label className="mt-5 block">
                      <span className="text-[12px] text-ink-3">Name</span>
                      <input
                        value={setup.schemeName}
                        onChange={(e) =>
                          onChange({ schemeName: e.target.value })
                        }
                        placeholder="Custom"
                        className={`${TEXT_INPUT_STYLE} mt-2`}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {mode === "edge-buffer" && (
              <BufferPanel
                type="edge"
                setup={setup}
                colors={colors}
                onSet={(id) => onChange({ edgeBuffer: id })}
              />
            )}
            {mode === "corner-buffer" && (
              <BufferPanel
                type="corner"
                setup={setup}
                colors={colors}
                onSet={(id) => onChange({ cornerBuffer: id })}
              />
            )}
            {mode === "cube-view" && (
              <DefaultViewPanel
                value={view}
                live={live}
                onChange={onViewChange}
                onResetRotation={() => setResetSignal((n) => n + 1)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );

  function BufferValue({ id, token }: { id: string; token?: string }) {
    const info = stickerById(id);
    return (
      <span className="flex items-center gap-2.5">
        <StickerSwatch color={colors[info.face]} token={token} size={20} ring />
        <span className="font-mono text-ink">{info.piece}</span>
      </span>
    );
  }
}

function SummaryRow({
  label,
  children,
  onChange,
}: {
  label: string;
  children: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3.5 first:pt-0 last:border-b-0">
      <div>
        <div className="text-[12px] text-ink-3">{label}</div>
        <div className="mt-1 text-[13.5px]">{children}</div>
      </div>
      <QuietButton onClick={onChange}>Change</QuietButton>
    </div>
  );
}

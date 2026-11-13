import React, { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { CubeViewPref, FaceColor, LetterScheme } from "../../types/app";
import { Face } from "../../utils/cube";
import {
  ALL_STICKERS,
  FACE_NAMES,
  stickerById,
  stickerInView,
  stickerFromView,
} from "../../utils/scheme";
import { IconButton } from "../common/IconButton";
import { TEXT_INPUT_STYLE } from "../common/formStyles";
import { useDefaultView } from "../../contexts/AppDataContext";
import { StickerSwatch } from "./StickerSwatch";
import { normalizeLabel } from "../../../domain/letterPairs/identity";

interface StickerEditorProps {
  scheme: LetterScheme;
  savedScheme?: LetterScheme;
  colors: Record<Face, FaceColor>;
  selected: string;
  view?: CubeViewPref;
  onChange: (id: string, token: string) => void;
  onSelect: (id: string) => void;
}

export function StickerEditor({
  scheme,
  savedScheme = scheme,
  colors,
  selected,
  view: draftView,
  onChange,
  onSelect,
}: StickerEditorProps) {
  const savedView = useDefaultView();
  const view = draftView ?? savedView;
  const info = stickerById(selected);
  const display = stickerInView(selected, view);
  const token = scheme[selected] ?? "";
  const previousLetters = useRef<Record<string, string>>({});
  const latest = useRef({ scheme, savedScheme, onChange });
  latest.current = { scheme, savedScheme, onChange };
  const order = ALL_STICKERS.filter((s) => s.type === info.type).map(
    (s) => stickerFromView(s.id, view).id,
  );
  const pos = order.indexOf(selected);
  const move = (d: number) =>
    onSelect(order[(pos + d + order.length) % order.length]);
  const duplicates = ALL_STICKERS.filter(
    (s) =>
      s.type === info.type &&
      s.id !== selected &&
      token &&
      normalizeLabel(scheme[s.id] ?? "") === normalizeLabel(token),
  );
  const validToken = (value: string) => !!value && /^[^\s,·|/]+$/.test(value);
  const otherProblem = ALL_STICKERS.find(
    (s) =>
      s.id !== selected &&
      (!validToken(scheme[s.id] ?? "") ||
        ALL_STICKERS.some(
          (other) =>
            other.id !== s.id &&
            other.type === s.type &&
            normalizeLabel(scheme[other.id] ?? "") ===
              normalizeLabel(scheme[s.id] ?? ""),
        )),
  );
  const problem = !token
    ? "Enter a letter. The previous label will be kept if you leave it blank."
    : !validToken(token)
      ? "Use letters or numbers without separators."
      : duplicates.length
        ? `Already used on ${stickerInView(duplicates[0].id, view).piece}. Choose another label.`
        : null;
  if (token && !problem) previousLetters.current[selected] = token;
  const restoreInvalid = (id: string) => {
    const current = latest.current;
    const value = current.scheme[id] ?? "";
    const type = stickerById(id).type;
    const duplicate = ALL_STICKERS.some(
      (s) =>
        s.id !== id &&
        s.type === type &&
        normalizeLabel(current.scheme[s.id] ?? "") === normalizeLabel(value),
    );
    if (validToken(value) && !duplicate) return;
    const previous = previousLetters.current[id] || current.savedScheme[id];
    if (previous) current.onChange(id, previous);
  };
  useEffect(() => () => restoreInvalid(selected), [selected]);

  return (
    <div>
      <div className="flex items-center gap-4">
        <StickerSwatch color={colors[info.face]} token={token} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] capitalize text-ink">{info.type}</p>
          <p
            data-lettering-position={display.id}
            className="mt-0.5 text-[12px] text-ink-3"
            title={`${display.piece}, ${FACE_NAMES[display.face]} sticker`}
          >
            {FACE_NAMES[display.face]} face,{" "}
            <span className="font-mono">{display.piece}</span>
          </p>
        </div>
        <div className="flex">
          <IconButton label="Previous sticker" onClick={() => move(-1)}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton label="Next sticker" onClick={() => move(1)}>
            <ChevronRightIcon />
          </IconButton>
        </div>
      </div>

      <label
        htmlFor="lettering-label"
        className="mt-6 block text-[12px] text-ink-2"
      >
        Letter
      </label>
      <input
        id="lettering-label"
        key={selected}
        autoFocus
        aria-invalid={!!problem}
        aria-describedby="lettering-field-help"
        value={token}
        maxLength={3}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => restoreInvalid(selected)}
        onChange={(e) =>
          onChange(selected, normalizeLabel(e.target.value).slice(0, 3))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
            e.preventDefault();
            move(1);
          } else if (e.key === "Tab" && e.shiftKey) {
            e.preventDefault();
            move(-1);
          }
        }}
        style={problem ? { borderColor: "var(--danger)" } : undefined}
        className={`${TEXT_INPUT_STYLE} mt-2 max-w-[160px] font-mono !text-[22px] tracking-[0.1em]`}
      />

      <div
        id="lettering-field-help"
        className={`mt-2.5 h-[40px] text-[12.5px] ${problem ? "text-[var(--danger)]" : "text-ink-3"}`}
      >
        {problem ??
          (otherProblem ? (
            <button
              type="button"
              className="text-left underline underline-offset-2 hover:text-ink"
              onClick={() => onSelect(otherProblem.id)}
            >
              Check {stickerInView(otherProblem.id, view).piece} (
              {FACE_NAMES[stickerInView(otherProblem.id, view).face]} face).
            </button>
          ) : null)}
      </div>
    </div>
  );
}

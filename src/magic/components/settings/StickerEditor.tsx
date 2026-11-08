import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { FaceColor, LetterScheme } from "../../types/app";
import { Face } from "../../utils/cube";
import { ALL_STICKERS, FACE_NAMES, stickerById } from "../../utils/scheme";
import { IconButton } from "../common/IconButton";
import { TEXT_INPUT_STYLE } from "../common/formStyles";
import { StickerSwatch } from "./StickerSwatch";

interface StickerEditorProps {
  scheme: LetterScheme;
  colors: Record<Face, FaceColor>;
  selected: string;
  onChange: (id: string, token: string) => void;
  onSelect: (id: string) => void;
}

export function StickerEditor({
  scheme,
  colors,
  selected,
  onChange,
  onSelect,
}: StickerEditorProps) {
  const info = stickerById(selected);
  const token = scheme[selected] ?? "";
  const order = ALL_STICKERS.filter((s) => s.type === info.type).map(
    (s) => s.id,
  );
  const pos = order.indexOf(selected);
  const move = (d: number) =>
    onSelect(order[(pos + d + order.length) % order.length]);
  const duplicates = ALL_STICKERS.filter(
    (s) =>
      s.type === info.type &&
      s.id !== selected &&
      token &&
      scheme[s.id] === token,
  );

  return (
    <div>
      <div className="flex items-center gap-4">
        <StickerSwatch color={colors[info.face]} token={token} size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] capitalize text-ink">{info.type}</p>
          <p
            className="mt-0.5 text-[12px] text-ink-3"
            title={`${info.piece} · ${FACE_NAMES[info.face]} sticker`}
          >
            {FACE_NAMES[info.face]} face ·{" "}
            <span className="font-mono">{info.piece}</span>
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

      <input
        key={selected}
        autoFocus
        aria-label="Token"
        value={token}
        maxLength={3}
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) =>
          onChange(selected, e.target.value.toUpperCase().replace(/\s/g, ""))
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
        className={`${TEXT_INPUT_STYLE} mt-6 max-w-[160px] font-mono !text-[22px] tracking-[0.1em]`}
      />

      <div className="mt-2.5 min-h-[20px] text-[12.5px]">
        {!token ? (
          <span className="text-ink-3">Unlabelled</span>
        ) : duplicates.length ? (
          <span className="text-ink-2">
            <span
              aria-hidden
              className="mr-2 inline-block h-[5px] w-[5px] -translate-y-[2px] rounded-full bg-accent"
            />
            Also on {duplicates.map((d) => d.piece).join(", ")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

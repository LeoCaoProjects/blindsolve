import { BldSetup, CubeViewPref, FaceColor } from "../../types/app";
import { Face } from "../../utils/cube";
import {
  ALL_STICKERS,
  stickerById,
  stickerFromView,
  stickerInView,
} from "../../utils/scheme";
import { StickerSwatch } from "./StickerSwatch";
import { useDefaultView } from "../../contexts/AppDataContext";

interface BufferPanelProps {
  type: "edge" | "corner";
  setup: BldSetup;
  colors: Record<Face, FaceColor>;
  view?: CubeViewPref;
  onSet: (id: string) => void;
}

// Shortcuts, not method recommendations. These are positions in the user's view.
const QUICK_CHOICES = {
  edge: ["UL", "DF", "UF", "UR", "UB"],
  corner: ["UBL", "UFR", "UFL", "DFR"],
};

export function BufferPanel({
  type,
  setup,
  colors,
  view: draftView,
  onSet,
}: BufferPanelProps) {
  const savedView = useDefaultView();
  const view = draftView ?? savedView;
  const current = type === "edge" ? setup.edgeBuffer : setup.cornerBuffer;
  const physical = stickerById(current);
  const display = stickerInView(current, view);
  const choices = QUICK_CHOICES[type].map((piece) => {
    const slot = ALL_STICKERS.find(
      (sticker) =>
        sticker.type === type &&
        sticker.face === piece[0] &&
        [...sticker.piece].sort().join("") === [...piece].sort().join(""),
    )!;
    return { slot, physical: stickerFromView(slot.id, view) };
  });
  return (
    <div>
      <p className="text-[12.5px] text-ink-3">
        Click a sticker to set the buffer.
      </p>
      <div className="mt-5 flex items-center gap-4">
        <StickerSwatch
          color={colors[physical.face]}
          token={setup.scheme[current]}
          size={44}
          ring
        />
        <div>
          <p className="text-[12px] text-ink-3">Your {type} buffer</p>
          <p
            data-current-buffer
            className="mt-1.5 font-mono text-[26px] leading-none tracking-[0.06em] text-ink"
          >
            {display.piece}
          </p>
        </div>
      </div>
      <div className="mt-7">
        <h4 className="text-[12px] text-ink-3">Quick choices</h4>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {choices.map(({ slot, physical: choice }) => (
            <button
              key={slot.id}
              type="button"
              aria-pressed={current === choice.id}
              onClick={() => onSet(choice.id)}
              className={`h-8 min-w-[52px] rounded-[4px] border px-2.5 font-mono text-[12.5px] transition-colors duration-150 ease-out ${current === choice.id ? "border-line-strong bg-selected text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"}`}
            >
              {slot.piece}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import {
  shortcutSections,
  popupShortcuts,
  trainingShortcuts,
} from "../../data/shortcuts";
import type { TrainMode } from "../../data/trainingModes";
import { ReferenceModal } from "./ReferenceModal";

export function ShortcutSheet({
  open,
  onClose,
  page = "timer",
  trainingMode = "exec",
}: {
  open: boolean;
  onClose: () => void;
  page?: string;
  trainingMode?: TrainMode;
}) {
  const items =
    page === "training"
      ? trainingShortcuts(trainingMode)
      : (shortcutSections.find((section) => section.id === page)?.items ?? []);
  return (
    <ReferenceModal
      open={open}
      onClose={onClose}
      label="Keyboard shortcuts"
      title="Keybinds"
    >
      <dl className="space-y-3">
        {[...items, ...popupShortcuts].map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] items-baseline gap-5"
          >
            <dt>
              <kbd className="font-mono text-[12px] text-ink">
                {item.keys.join(" / ")}
              </kbd>
            </dt>
            <dd className="text-ink-2">{item.label}</dd>
          </div>
        ))}
      </dl>
      {page === "timer" && (
        <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-3">
          After reconstruction, click any word beneath Edges or Corners to edit
          it.
        </p>
      )}
    </ReferenceModal>
  );
}

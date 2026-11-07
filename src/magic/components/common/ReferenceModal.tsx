import type { ReactNode } from "react";
import { Sheet } from "./Sheet";

/** One compact reference surface for Training instructions and page keybinds. */
export function ReferenceModal({
  open,
  onClose,
  label,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={label}
      title={title}
      width={440}
    >
      <div className="text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </Sheet>
  );
}

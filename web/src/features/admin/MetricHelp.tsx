import { useRef, useState } from "react";
import { InfoIcon } from "lucide-react";
import { IconButton } from "../../workspace/components/common/IconButton";
import { Popover } from "../../workspace/components/common/Popover";

export function MetricHelp({
  label = "About active accounts",
  children = "Accounts with a cloud save or deletion in this period. Not visits.",
}: {
  label?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <IconButton
        buttonRef={anchor}
        size="sm"
        style={{ height: "1rem", width: "1rem" }}
        label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <InfoIcon />
      </IconButton>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        label={label}
        className="theme-workspace"
      >
        <p className="p-3 text-[13px] leading-relaxed text-ink-2">{children}</p>
      </Popover>
    </>
  );
}

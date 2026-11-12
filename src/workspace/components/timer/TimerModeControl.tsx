import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { TIMER_MODES, type TimerMode } from "../../utils/timerModes";
import { CubeUtilityButton } from "../cube/CubeUtilityButton";
import { Popover, onMenuKeyDown } from "../common/Popover";

export function TimerModeControl({
  value,
  onChange,
  disabled,
}: {
  value: TimerMode;
  onChange: (mode: TimerMode) => void;
  disabled: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <>
      <CubeUtilityButton
        buttonRef={trigger}
        autoWidth
        label="Timer mode"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        pressed={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if ([" ", "Enter", "ArrowDown", "ArrowUp"].includes(event.key))
            event.stopPropagation();
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter")
            event.stopPropagation();
        }}
        className="cube-utility-mode"
      >
        <span>{TIMER_MODES.find((mode) => mode.value === value)!.label}</span>
        <ChevronDownIcon aria-hidden strokeWidth={1.75} />
      </CubeUtilityButton>
      <Popover
        className="theme-workspace"
        open={open && !disabled}
        onClose={close}
        anchorRef={trigger}
        label="Timer mode choices"
        width={112}
      >
        <div
          ref={menu}
          role="menu"
          aria-label="Timer modes"
          onKeyUp={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            onMenuKeyDown(event);
            if (event.key === "Tab") {
              close();
              // Let native Tab continue from the trigger, not a removed portal item.
              trigger.current?.focus();
            }
            if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const choices =
                event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "button",
                );
              choices[event.key === "Home" ? 0 : choices.length - 1]?.focus();
            }
          }}
        >
          {TIMER_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="menuitemradio"
              aria-checked={mode.value === value}
              onClick={() => {
                onChange(mode.value);
                close();
                trigger.current?.focus();
              }}
              className={`flex h-7 w-full items-center rounded-[4px] px-2 text-left text-[11px] transition-colors duration-150 hover:bg-hover hover:text-ink focus-visible:bg-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${mode.value === value ? "bg-selected text-ink" : "text-ink-2"}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

import React, { useId } from "react";
import { motion } from "framer-motion";
import { Penalty } from "../../types/solve";
import { EASE_OUT } from "../../utils/keyboard";

interface ResultControlProps {
  value: Penalty;
  onChange: (p: Penalty) => void;
  className?: string;
  size?: "sm" | "md" | "original";
  options?: { value: Penalty; label: string }[];
}

const OPTIONS: { value: Penalty; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "+2", label: "+2" },
  { value: "dnf", label: "DNF" },
];

export function ResultControl({
  value,
  onChange,
  className = "",
  size = "md",
  options = OPTIONS,
}: ResultControlProps) {
  const id = useId();
  return (
    <div
      data-result-control
      role="radiogroup"
      aria-label="Result"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next =
          (options.findIndex((option) => option.value === value) +
            (event.key === "ArrowRight" ? 1 : -1) +
            options.length) %
          options.length;
        onChange(options[next].value);
        const buttons =
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        buttons[next]?.focus();
      }}
      className={`inline-flex rounded-[5px] border border-line p-[3px] ${className}`}
    >
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => onChange(o.value)}
            className={`relative rounded-[3px] transition-colors duration-150 ease-out ${
              size === "original"
                ? "h-7 min-w-[46px] px-3 font-mono text-[12.5px]"
                : size === "sm"
                  ? "h-7 min-w-[38px] px-2 text-[12px]"
                  : "h-8 min-w-[48px] px-3 text-[13px]"
            } ${active ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
          >
            {active && (
              <motion.span
                layoutId={`result-${id}`}
                className="absolute inset-0 rounded-[3px] bg-selected"
                transition={{ duration: 0.18, ease: EASE_OUT }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

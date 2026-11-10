import React from "react";

interface CycleBreakOptionsProps {
  options: string[];
  focused?: string | null;
  selected?: string | null;
  onPick: (letter: string) => void;
  size?: "md" | "lg";
  className?: string;
}

export function CycleBreakOptions({
  options,
  focused,
  selected,
  onPick,
  size = "md",
  className = "",
}: CycleBreakOptionsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Cycle break sticker"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {options.map((letter) => {
        const isSelected = selected === letter;
        const isFocused = !selected && focused === letter;
        return (
          <button
            key={letter}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onPick(letter)}
            className={`flex items-center justify-center rounded-[4px] border font-mono transition-colors duration-150 ease-out ${
              size === "lg" ? "h-12 w-12 text-[19px]" : "h-10 w-10 text-[15px]"
            } ${
              isSelected
                ? "border-accent text-accent"
                : isFocused
                  ? "border-line-strong bg-hover text-ink"
                  : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
            }`}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

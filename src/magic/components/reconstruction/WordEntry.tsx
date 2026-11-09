import React, { useRef } from "react";
import { SuggestPopover } from "../common/SuggestWords";
import { displayMemoPair } from "../../../domain/letterPairs/identity";

interface WordEntryProps {
  pair: string;
  first: string;
  second: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  size?: "md" | "lg";
  className?: string;
}

export function WordEntry({
  pair,
  first,
  second,
  value,
  onChange,
  onSubmit,
  size = "md",
  className = "",
}: WordEntryProps) {
  const lg = size === "lg";
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className={`flex items-baseline ${lg ? "gap-8" : "gap-6"}`}>
        <span
          className={`font-mono leading-none tracking-[0.14em] text-ink ${lg ? "text-[64px]" : "text-[44px]"}`}
        >
          {displayMemoPair(pair)}
        </span>
        <input
          ref={inputRef}
          autoFocus
          aria-label={`Word you used for ${displayMemoPair(pair)}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter word"
          className={`min-w-0 flex-1 border-b border-line-strong bg-transparent pb-2 text-ink outline-none transition-colors duration-150 ease-out placeholder:text-ink-3 focus:border-accent ${
            lg ? "text-[28px]" : "text-[22px]"
          }`}
        />
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        Saves as Default for both Edges and Corners.
      </p>
      <div className="mt-3 flex justify-end text-[12.5px]">
        <div className="flex items-center gap-2">
          <SuggestPopover
            first={first}
            second={second}
            current={value}
            onPick={(w) => {
              onChange(w);
              inputRef.current?.focus();
            }}
          />
        </div>
      </div>
    </form>
  );
}

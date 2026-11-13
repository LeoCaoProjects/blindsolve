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
      <div className={`flex items-center ${lg ? "gap-8" : "gap-6"}`}>
        <span
          data-word-entry-pair
          className={`flex h-14 shrink-0 items-center font-mono leading-none tracking-[0.14em] text-ink ${lg ? "text-[64px]" : "text-[44px]"}`}
        >
          {displayMemoPair(pair)}
        </span>
        <div
          data-word-entry-field
          className="relative flex h-14 min-w-0 flex-1 items-center border-b border-line-strong transition-colors duration-150 ease-out focus-within:border-accent"
        >
          <input
            ref={inputRef}
            autoFocus
            aria-label={`Word you used for ${displayMemoPair(pair)}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter word"
            style={{ outline: "none", boxShadow: "none" }}
            className={`h-full w-full min-w-0 rounded-none border-0 bg-transparent py-0 pl-0 pr-11 leading-none text-ink placeholder:text-ink-3 ${lg ? "text-[28px]" : "text-[22px]"}`}
          />
          <SuggestPopover
            iconOnly
            first={first}
            second={second}
            current={value}
            className="absolute right-0 top-1/2 !h-10 w-10 -translate-y-1/2 justify-center !p-0 [&_svg]:h-4 [&_svg]:w-4"
            onPick={(word) => {
              onChange(word);
              inputRef.current?.focus();
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        Saves as Default for both Edges and Corners.
      </p>
    </form>
  );
}

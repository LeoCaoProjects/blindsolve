import { useEffect, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Popover } from "../common/Popover";
import { SuggestionMenu } from "../common/SuggestWords";

export const PAIR_WORD_FIELD =
  "h-11 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface pl-3 pr-10 text-[16px] text-ink caret-accent outline-none placeholder:text-ink-3 focus:rounded-[4px] focus:border-ink-3";

/** Default-only field and floating suggestions shared by pair and practice editors. */
export function DefaultWordField({
  first,
  second,
  value,
  onChange,
  onSubmit,
  suggestionsOpen = false,
}: {
  first: string;
  second: string;
  value: string;
  onChange: (word: string) => void;
  onSubmit: () => void;
  suggestionsOpen?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(suggestionsOpen);
  useEffect(() => {
    if (suggestionsOpen) setOpen(true);
  }, [suggestionsOpen]);
  return (
    <div className="relative h-11">
      <input
        ref={input}
        data-dialog-autofocus
        autoFocus
        aria-label="Default word"
        value={value}
        placeholder="Enter word"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className={PAIR_WORD_FIELD}
      />
      <button
        ref={anchor}
        type="button"
        aria-label="Suggest words for default word"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="absolute right-1 top-1 flex h-9 w-8 items-center justify-center rounded-[4px] text-ink-3 transition-colors hover:bg-hover hover:text-ink"
      >
        <SparklesIcon size={14} strokeWidth={1.75} aria-hidden />
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchor}
        width={260}
        label={`Suggestions for ${first}${second}`}
        className="theme-workspace"
      >
        <div className="scroll-quiet max-h-[min(320px,65dvh)] overflow-y-auto">
          <SuggestionMenu
            first={first}
            second={second}
            current={value}
            onPick={(word) => {
              onChange(word);
              setOpen(false);
              input.current?.focus();
            }}
          />
        </div>
      </Popover>
    </div>
  );
}

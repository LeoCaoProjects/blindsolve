import React, { useEffect, useRef } from "react";
interface FirstTokenRailProps {
  tokens: string[];
  active: string;
  filled: Record<string, number>;
  total: number;
  onSelect: (token: string) => void;
}
/** Scheme order, compact enough to scan beside scope navigation. */
export function FirstTokenRail({
  tokens,
  active,
  filled,
  total,
  onSelect,
}: FirstTokenRailProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const keyboardFocus = useRef(false);
  useEffect(() => {
    refs.current[tokens.indexOf(active)]?.scrollIntoView({ block: "nearest" });
    if (keyboardFocus.current) {
      keyboardFocus.current = false;
      refs.current[tokens.indexOf(active)]?.focus({ preventScroll: true });
    }
  }, [active, tokens]);
  return (
    <nav aria-label="First letter" data-pair-index>
      <p className="mb-2 px-3 text-[11px] text-ink-3">First letter</p>
      <ul className="grid grid-cols-2 gap-x-1 gap-y-0.5">
        {tokens.map((token, index) => (
          <li key={token}>
            <button
              type="button"
              ref={(el) => {
                refs.current[index] = el;
              }}
              tabIndex={token === active ? 0 : -1}
              aria-current={token === active ? "true" : undefined}
              aria-label={`${token}, ${filled[token] ?? 0} of ${total} filled`}
              onClick={() => onSelect(token)}
              onKeyDown={(event) => {
                if (
                  ![
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "Home",
                    "End",
                  ].includes(event.key)
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tokens.length - 1
                      : (index +
                          (["ArrowRight", "ArrowDown"].includes(event.key)
                            ? 1
                            : -1) +
                          tokens.length) %
                        tokens.length;
                keyboardFocus.current = true;
                onSelect(tokens[next]);
                refs.current[next]?.focus();
              }}
              className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-3 text-left transition-colors duration-150 ${token === active ? "bg-selected text-ink" : "text-ink-2 hover:bg-hover hover:text-ink"}`}
            >
              <span className="font-mono text-[13px] font-medium">{token}</span>
              <span aria-hidden className="text-[10.5px] text-ink-3 tnum">
                {filled[token] ?? 0}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

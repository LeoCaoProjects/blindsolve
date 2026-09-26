import React from 'react';

interface FirstTokenRailProps {
  tokens: string[];
  active: string;
  filled: Record<string, number>;
  total: number;
  onSelect: (token: string) => void;
}

/** The first letter of every pair. One column, calm; the fill count is the only metadata. */
export function FirstTokenRail({ tokens, active, filled, total, onSelect }: FirstTokenRailProps) {
  return (
    <nav aria-label="First letter" className="scroll-quiet min-h-0 overflow-y-auto border-line md:border-r">
      <ul className="scroll-none flex overflow-x-auto px-3 py-2 md:block md:overflow-visible md:px-0 md:py-3">
        {tokens.map((t) => {
          const isActive = t === active;
          const n = filled[t] ?? 0;
          return (
            <li key={t}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onSelect(t)}
                aria-current={isActive ? 'true' : undefined}
                className={`relative flex h-9 w-full min-w-[44px] items-center justify-between gap-3 px-3 transition-colors duration-150 ease-out md:h-[30px] md:pl-6 md:pr-5 ${
                isActive ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
                }>
                
                {isActive &&
                <span aria-hidden className="absolute inset-x-3 bottom-0 h-px bg-ink md:inset-y-1.5 md:left-0 md:right-auto md:h-auto md:w-px" />
                }
                <span className="font-mono text-[13.5px] tracking-[0.06em]">{t}</span>
                <span className={`hidden font-mono text-[10.5px] tnum md:inline ${n === total ? 'text-ink-3' : n === 0 ? 'text-ink-3 opacity-50' : 'text-ink-3'}`}>
                  {n}
                </span>
              </button>
            </li>);

        })}
      </ul>
    </nav>);

}
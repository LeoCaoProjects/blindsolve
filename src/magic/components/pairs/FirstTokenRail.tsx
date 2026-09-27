import React, { useEffect, useRef, useState } from 'react';

interface FirstTokenRailProps {
  tokens: string[];
  active: string;
  filled: Record<string, number>;
  total: number;
  onSelect: (token: string) => void;
}

/**
 * The first letter of every pair. Scrolls on its own — vertically on desktop, horizontally on
 * narrow screens — with edge fades only while more letters exist in that direction.
 */
export function FirstTokenRail({ tokens, active, filled, total, onSelect }: FirstTokenRailProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = () => {
    const el = scrollRef.current;
    if (!el) return;
    const vertical = el.scrollHeight > el.clientHeight + 1;
    const pos = vertical ? el.scrollTop : el.scrollLeft;
    const max = vertical ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    setEdges({ start: pos > 2, end: pos < max - 2 });
  };

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tokens.length]);

  // Keep the selected letter in view when it changes by keyboard or type-to-jump.
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const fade = edges.start && edges.end ? 'md:fade-both' : edges.start ? 'md:fade-top' : edges.end ? 'md:fade-bottom' : '';

  return (
    <nav aria-label="First letter" className="flex h-full min-h-0 flex-col border-line md:border-r">
      <ul
        ref={scrollRef}
        onScroll={measure}
        className={`scroll-quiet flex min-h-0 flex-1 overflow-x-auto overscroll-contain px-3 py-2 md:block md:overflow-y-auto md:overflow-x-hidden md:px-0 md:py-3 ${fade}`}>
        
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
                aria-label={`${t}, ${n} of ${total} filled`}
                className={`relative flex h-10 w-full min-w-[44px] items-center justify-between gap-3 px-3 transition-colors duration-150 ease-out md:h-[30px] md:pl-6 md:pr-5 ${
                isActive ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
                }>
                
                {isActive &&
                <span aria-hidden className="absolute inset-x-3 bottom-0 h-px bg-ink md:inset-y-1.5 md:left-0 md:right-auto md:h-auto md:w-px" />
                }
                <span className="font-mono text-[13.5px] tracking-[0.06em]">{t}</span>
                <span className={`hidden font-mono text-[10.5px] text-ink-3 tnum md:inline ${n === 0 ? 'opacity-50' : ''}`}>{n}</span>
              </button>
            </li>);

        })}
      </ul>
    </nav>);

}
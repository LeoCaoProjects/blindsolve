import React, { useEffect, useRef } from 'react';
import { SUB_NAV_ITEM } from '../layout/SubNavigation';

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
  const keyboardFocus = useRef(false);
  // Keep the selected letter in view when it changes by keyboard or type-to-jump.
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const list = scrollRef.current;
    if (!el || !list) return;
    let frame = 0;
    if (keyboardFocus.current) {
      keyboardFocus.current = false;
      frame = requestAnimationFrame(()=>el.focus({preventScroll:true}));
    }
    const top = el.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + el.offsetHeight - list.clientHeight;
    return ()=>cancelAnimationFrame(frame);
  }, [active]);

  return (
    <nav aria-label="First letter" className="flex h-full min-h-0 flex-col">
      <ul
        ref={scrollRef}
        className="scroll-quiet min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        
        {tokens.map((t) => {
          const isActive = t === active;
          const n = filled[t] ?? 0;
          return (
            <li key={t}>
              <button
                type="button"
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(t)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={`${t}, ${n} of ${total} filled`}
                onKeyDown={(event)=>{
                  const direction = event.key==='ArrowDown' ? 1 : event.key==='ArrowUp' ? -1 : 0;
                  if (!direction && event.key!=='Home' && event.key!=='End') return;
                  event.preventDefault();event.stopPropagation();
                  const next = event.key==='Home' ? 0 : event.key==='End' ? tokens.length-1 : (tokens.indexOf(t)+direction+tokens.length)%tokens.length;
                  keyboardFocus.current = true;
                  onSelect(tokens[next]);
                  scrollRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
                }}
                className={`${SUB_NAV_ITEM} h-8 ${isActive ? 'bg-selected text-ink' : 'text-ink-2'}`}>
                <span className="font-mono text-[14px] font-medium tracking-[0.02em]">{t}</span>
                <span className="font-mono text-[11px] text-ink-2 tnum">{n}</span>
              </button>
            </li>);

        })}
      </ul>
    </nav>);

}
import React, { useLayoutEffect, useRef } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionGroupProps<T extends string> {
  label: string;
  /** Show the label beside the control (hidden on the smallest screens) */
  showLabel?: boolean;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A small setting, not navigation: a quiet label and a compact framed switch in the same
 * language as the Timer's OK · +2 · DNF control. Reads as a different kind of thing from the tabs.
 */
export function OptionGroup<T extends string>({ label, showLabel = true, options, value, onChange, disabled, className = '' }: OptionGroupProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const indicator = useAnimationControls();
  const reduced = useReducedMotion();
  const previous = useRef<string | null>(null);
  const optionKey = JSON.stringify(options);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    const selected = refs.current.find(button => button?.getAttribute('aria-checked') === 'true');
    if (!selected) return;
    const position = { x: selected.offsetLeft, width: selected.offsetWidth };
    // Only selection changes animate. Vertical placement belongs to the container.
    if (previous.current !== null && previous.current !== value && !reduced) {
      void indicator.start({ ...position, transition: { duration: 0.18, ease: EASE_OUT } });
    } else {
      indicator.set(position);
    }
    previous.current = value;
  }, [value, optionKey, reduced, indicator]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      const selected = refs.current.find(button => button?.getAttribute('aria-checked') === 'true');
      if (selected) indicator.set({ x: selected.offsetLeft, width: selected.offsetWidth });
    });
    if (group.current) observer.observe(group.current);
    return () => observer.disconnect();
  }, [indicator]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    e.stopPropagation();
    const i = options.findIndex((o) => o.value === value);
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div className={`flex items-center gap-2.5 ${disabled ? 'pointer-events-none opacity-40' : ''} ${className}`}>
      {showLabel && <span className="hidden text-[11.5px] text-ink-3 sm:inline">{label}</span>}
      <div ref={group} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="relative inline-flex rounded-[5px] border border-line p-[2px]">
        <motion.span
          aria-hidden
          initial={false}
          animate={indicator}
          className="pointer-events-none absolute bottom-[2px] left-0 top-[2px] rounded-[3px] bg-selected"
        />
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`relative h-7 whitespace-nowrap rounded-[3px] px-2.5 text-[12px] transition-colors duration-150 ease-out ${
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
              }>
              <span className="relative">{o.label}</span>
            </button>);

        })}
      </div>
    </div>);

}

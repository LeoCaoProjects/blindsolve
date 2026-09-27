import React, { useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Quiet marker, e.g. an override exists */
  marked?: boolean;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Quiet text tabs with a hairline underline — the same language as the section bar.
 * Arrow keys move the selection (radio group semantics).
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className = '' }: SegmentedProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    e.stopPropagation();
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={`inline-flex items-stretch gap-x-4 md:gap-x-5 ${className}`}>
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex items-center whitespace-nowrap transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
            size === 'sm' ? 'h-8 text-[12.5px]' : 'h-9 text-[13px]'} ${
            active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
            
            <span className="inline-flex items-center gap-1.5">
              {o.label}
              {o.marked &&
              <>
                  <span aria-hidden className="h-[5px] w-[5px] border-r border-t border-current opacity-70" />
                  <span className="sr-only">(has override)</span>
                </>
              }
            </span>
            {active &&
            <motion.span
              aria-hidden
              layoutId={`seg-${id}`}
              className="absolute inset-x-0 bottom-[3px] h-px bg-ink"
              transition={{ duration: 0.18, ease: EASE_OUT }} />

            }
          </button>);

      })}
    </div>);

}

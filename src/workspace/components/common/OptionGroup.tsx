import React, { useId, useRef } from 'react';
import { motion } from 'framer-motion';
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
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
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
      <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="inline-flex rounded-[5px] border border-line p-[2px]">
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
              
              {active &&
              <motion.span
                aria-hidden
                layoutId={`opt-${id}`}
                className="absolute inset-0 rounded-[3px] bg-selected"
                transition={{ duration: 0.18, ease: EASE_OUT }} />

              }
              <span className="relative">{o.label}</span>
            </button>);

        })}
      </div>
    </div>);

}

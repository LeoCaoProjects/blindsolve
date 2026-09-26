import React, { useId } from 'react';
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

/** Same construction as the Timer's result control, generalised. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className = '' }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[5px] border border-line p-[3px] ${className}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative whitespace-nowrap rounded-[3px] transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
            size === 'sm' ? 'h-6 px-2.5 text-[12px]' : 'h-7 px-3 text-[12.5px]'} ${
            active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
            
            {active &&
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-[3px] bg-selected"
              transition={{ duration: 0.18, ease: EASE_OUT }} />

            }
            <span className="relative inline-flex items-center gap-1.5">
              {o.label}
              {o.marked &&
              <>
                  <span aria-hidden className="h-[5px] w-[5px] border-r border-t border-current opacity-70" />
                  <span className="sr-only">(has override)</span>
                </>
              }
            </span>
          </button>);

      })}
    </div>);

}
import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { Penalty } from '../../types/solve';
import { EASE_OUT } from '../../utils/keyboard';

interface ResultControlProps {
  value: Penalty;
  onChange: (p: Penalty) => void;
  className?: string;
  size?: 'sm' | 'md';
}

const OPTIONS: {value: Penalty;label: string;}[] = [
{ value: 'ok', label: 'OK' },
{ value: '+2', label: '+2' },
{ value: 'dnf', label: 'DNF' }];


export function ResultControl({ value, onChange, className = '', size = 'md' }: ResultControlProps) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label="Result" className={`inline-flex rounded-[5px] border border-line p-[3px] ${className}`}>
      {OPTIONS.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative rounded-[3px] font-mono transition-colors duration-150 ease-out ${
            size === 'sm' ? 'h-6 min-w-[38px] px-2 text-[11.5px]' : 'h-7 min-w-[46px] px-3 text-[12.5px]'} ${
            active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`}>
            
            {active &&
            <motion.span
              layoutId={`result-${id}`}
              className="absolute inset-0 rounded-[3px] bg-selected"
              transition={{ duration: 0.18, ease: EASE_OUT }} />

            }
            <span className="relative">{o.label}</span>
            <span className="sr-only">, key {i + 1}</span>
          </button>);

      })}
    </div>);

}
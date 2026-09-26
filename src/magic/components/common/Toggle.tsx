import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-150 ease-out ${
      checked ? 'bg-ink' : 'bg-line-strong'}`
      }>
      
      <span
        aria-hidden
        className={`h-[14px] w-[14px] rounded-full transition-transform duration-150 ease-out ${
        checked ? 'translate-x-[17px] bg-bg' : 'translate-x-[3px] bg-ink-2'}`
        } />
      
    </button>);

}

interface RadioRowProps<T extends string> {
  name: string;
  value: T;
  options: {value: T;label: string;hint?: string;}[];
  onChange: (v: T) => void;
  className?: string;
}

export function RadioRows<T extends string>({ name, value, options, onChange, className = '' }: RadioRowProps<T>) {
  return (
    <div role="radiogroup" aria-label={name} className={`grid gap-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="group -mx-3 flex items-start gap-3 rounded-[4px] px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-hover">
            
            <span
              aria-hidden
              className={`mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
              active ? 'border-ink' : 'border-line-strong group-hover:border-ink-3'}`
              }>
              
              {active && <span className="h-[6px] w-[6px] rounded-full bg-ink" />}
            </span>
            <span>
              <span className={`block text-[13.5px] ${active ? 'text-ink' : 'text-ink-2'}`}>{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-[12.5px] text-ink-3">{o.hint}</span>}
            </span>
          </button>);

      })}
    </div>);

}
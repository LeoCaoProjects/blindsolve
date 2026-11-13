import React, { useRef } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-150 ease-out motion-reduce:transition-none ${
        checked ? "bg-ink" : "bg-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span
        aria-hidden
        className={`h-[14px] w-[14px] rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none ${
          checked ? "translate-x-[17px] bg-bg" : "translate-x-[3px] bg-ink-2"
        }`}
      />
    </button>
  );
}

interface RadioRowProps<T extends string> {
  name: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  className?: string;
}

export function RadioRows<T extends string>({
  name,
  value,
  options,
  onChange,
  className = "",
}: RadioRowProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      onKeyDown={(event) => {
        const direction = ["ArrowDown", "ArrowRight"].includes(event.key)
          ? 1
          : ["ArrowUp", "ArrowLeft"].includes(event.key)
            ? -1
            : 0;
        if (!direction || !options.length) return;
        event.preventDefault();
        event.stopPropagation();
        const next =
          (options.findIndex((option) => option.value === value) +
            direction +
            options.length) %
          options.length;
        onChange(options[next].value);
        refs.current[next]?.focus();
      }}
      role="radiogroup"
      aria-label={name}
      className={`grid gap-0.5 ${className}`}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            ref={(el) => {
              refs.current[i] = el;
            }}
            tabIndex={active ? 0 : -1}
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="group -mx-3 flex items-start gap-3 rounded-[4px] px-3 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-hover"
          >
            <span
              aria-hidden
              className={`mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                active
                  ? "border-ink"
                  : "border-line-strong group-hover:border-ink-3"
              }`}
            >
              {active && (
                <span className="h-[6px] w-[6px] rounded-full bg-ink" />
              )}
            </span>
            <span>
              <span
                className={`block text-[13.5px] ${active ? "text-ink" : "text-ink-2"}`}
              >
                {o.label}
              </span>
              {o.hint && (
                <span className="mt-0.5 block text-[12.5px] text-ink-3">
                  {o.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

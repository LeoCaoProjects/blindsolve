import React from 'react';

export function StepTicks({ total, index, className = '' }: {total: number;index: number;className?: string;}) {
  if (total <= 1) return null;
  return (
    <ol aria-label={`Step ${index + 1} of ${total}`} className={`flex items-center gap-1.5 ${className}`}>
      {Array.from({ length: total }).map((_, i) =>
      <li
        key={i}
        className={`h-[2px] w-5 rounded-full transition-colors duration-200 ease-out ${
        i < index ? 'bg-ink-2' : i === index ? 'bg-accent' : 'bg-line-strong'}`
        } />

      )}
    </ol>);

}
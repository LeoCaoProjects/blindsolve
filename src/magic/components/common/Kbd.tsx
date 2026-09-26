import React from 'react';

export function Kbd({ children, className = '' }: {children: React.ReactNode;className?: string;}) {
  return (
    <kbd
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border border-line-strong px-1 font-mono text-[10.5px] leading-none text-ink-3 ${className}`}>
      
      {children}
    </kbd>);

}
import React from 'react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
}

export function PrimaryButton({ children, onClick, disabled, hint = '↵', className = '' }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2.5 rounded-[4px] bg-ink px-4 text-[13px] font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-30 ${className}`}>
      
      {children}
      {hint && <span className="font-mono text-[11px] opacity-50">{hint}</span>}
    </button>);

}

export function QuietButton({ children, onClick, className = '' }: {children: React.ReactNode;onClick: () => void;className?: string;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 ${className}`}>
      
      {children}
    </button>);

}
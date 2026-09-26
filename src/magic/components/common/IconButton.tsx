import React from 'react';

interface IconButtonProps {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  pressed?: boolean;
  size?: 'sm' | 'md';
}

export function IconButton({ label, onClick, children, className = '', pressed, size = 'md' }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] transition-colors duration-150 ease-out hover:bg-hover hover:text-ink [&_svg]:h-[15px] [&_svg]:w-[15px] ${
      size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'} ${
      pressed ? 'bg-selected text-ink' : 'text-ink-3'} ${className}`}>
      
      {children}
    </button>);

}
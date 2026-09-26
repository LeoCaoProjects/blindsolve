import React from 'react';

interface WordEntryProps {
  pair: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  size?: 'md' | 'lg';
  className?: string;
}

export function WordEntry({ pair, value, onChange, onSubmit, onSkip, size = 'md', className = '' }: WordEntryProps) {
  const lg = size === 'lg';
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}>
      
      <div className={`flex items-baseline ${lg ? 'gap-8' : 'gap-6'}`}>
        <span className={`font-mono leading-none tracking-[0.14em] text-ink ${lg ? 'text-[64px]' : 'text-[44px]'}`}>{pair}</span>
        <input
          autoFocus
          aria-label={`Word you used for ${pair}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="the image you used"
          className={`min-w-0 flex-1 border-b border-line-strong bg-transparent pb-2 text-ink outline-none transition-colors duration-150 ease-out placeholder:text-ink-3 focus:border-accent ${
          lg ? 'text-[28px]' : 'text-[22px]'}`
          } />
        
      </div>
      <div className="mt-3 flex items-center justify-between text-[12.5px]">
        <span className="text-ink-3">Not in your letter pairs yet</span>
        <button type="button" onClick={onSkip} className="text-ink-3 transition-colors duration-150 ease-out hover:text-ink-2">
          Skip
        </button>
      </div>
    </form>);

}
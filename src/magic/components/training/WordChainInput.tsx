import React, { forwardRef, useState } from 'react';
import { FieldFrame } from '../memo/RecallInput';

interface WordChainInputProps {
  label: string;
  caption?: string;
  words: string[];
  onChange: (words: string[]) => void;
  /** Enter or Tab on an empty field */
  onAdvance: () => void;
  autoFocus?: boolean;
}

/**
 * One field for the whole memo: Enter commits a word, Backspace on empty pulls the last one back.
 * Words build up inline so the chain reads like the memo itself.
 */
export const WordChainInput = forwardRef<HTMLInputElement, WordChainInputProps>(function WordChainInput(
{ label, caption, words, onChange, onAdvance, autoFocus },
ref)
{
  const [draft, setDraft] = useState('');

  const commit = () => {
    const w = draft.trim();
    if (!w) return false;
    onChange([...words, w]);
    setDraft('');
    return true;
  };

  return (
    <FieldFrame caption={caption} count={words.length ? `${words.length} ${words.length === 1 ? 'word' : 'words'}` : undefined}>
      <div className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 py-3">
        {words.map((w, i) =>
        <span key={i} className="flex items-baseline gap-2 text-[17px] leading-snug text-ink-2">
            {w}
            <span aria-hidden className="text-ink-3">
              ·
            </span>
          </span>
        )}
        <input
          ref={ref}
          autoFocus={autoFocus}
          aria-label={label}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          placeholder={words.length ? '' : 'First word'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!commit()) onAdvance();
            } else if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              commit();
              onAdvance();
            } else if (e.key === 'Backspace' && !draft && words.length) {
              e.preventDefault();
              setDraft(words[words.length - 1]);
              onChange(words.slice(0, -1));
            }
          }}
          className="min-w-[7rem] flex-1 bg-transparent text-[17px] leading-snug text-ink caret-accent outline-none placeholder:text-ink-3" />
        
      </div>
    </FieldFrame>);

});
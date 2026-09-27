import React from 'react';

/** A pair set as type. Multi-character tokens get a visible gap so "CH A" never reads as "CHA". */
export function PairTokens({ first, second, className = '' }: {first: string;second: string;className?: string;}) {
  const spaced = first.length > 1 || second.length > 1;
  return (
    <span className={`font-mono ${className}`} aria-label={`${first} ${second}`}>
      <span aria-hidden>{first}</span>
      <span aria-hidden className={spaced ? 'ml-[0.35em]' : ''}>
        {second}
      </span>
    </span>);

}
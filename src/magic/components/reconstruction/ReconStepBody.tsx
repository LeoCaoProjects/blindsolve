import React from 'react';
import { Reconstruction } from '../../hooks/useReconstruction';
import { MemoTrace } from '../solve/MemoTrace';
import { CycleBreakOptions } from './CycleBreakOptions';
import { ReviewMemo } from './ReviewMemo';
import { WordEntry } from './WordEntry';

interface ReconStepBodyProps {
  r: Reconstruction;
  size?: 'md' | 'lg';
  /** Hide the letter buttons when the cube itself is the primary picker */
  showOptions?: boolean;
}

export function ReconStepBody({ r, size = 'md', showOptions = true }: ReconStepBodyProps) {
  const lg = size === 'lg';
  const { step, sample } = r;

  if (step.kind === 'break') {
    const pairs = step.piece === 'corners' ? sample.corners : sample.edges;
    const br = step.piece === 'corners' ? sample.cornerBreak : sample.edgeBreak;
    const picked = r.breaks[step.piece];
    return (
      <div>
        <h2 className={`text-ink ${lg ? 'text-[30px] font-normal tracking-[-0.01em]' : 'text-[19px] font-medium'}`}>
          {step.piece === 'corners' ? 'Corner' : 'Edge'} cycle break
        </h2>
        <p className={`mt-2 text-ink-2 ${lg ? 'text-[16px]' : 'text-[14px]'}`}>Which sticker did you start the new cycle on?</p>
        <MemoTrace
          className={lg ? 'mt-10' : 'mt-8'}
          size={lg ? 'xl' : 'lg'}
          pairs={pairs}
          breakAt={br?.at ?? null}
          resolved={!!picked}
          hideWords />
        
        {showOptions &&
        <CycleBreakOptions
          className={lg ? 'mt-10' : 'mt-8'}
          size={lg ? 'lg' : 'md'}
          options={step.options}
          focused={step.options[r.optionFocus]}
          selected={picked}
          onPick={r.pickBreak} />

        }
      </div>);

  }

  if (step.kind === 'word') {
    const pairs = step.piece === 'corners' ? sample.corners : sample.edges;
    const br = step.piece === 'corners' ? sample.cornerBreak : sample.edgeBreak;
    return (
      <div>
        <MemoTrace
          size="md"
          pairs={pairs}
          breakAt={br?.at ?? null}
          activePair={step.pair}
          renderWord={(pair) =>
          pair === step.pair ? <span className="text-accent">?</span> : r.wordFor(pair) || <span className="text-ink-3">—</span>
          } />
        
        <WordEntry
          key={step.pair}
          className={lg ? 'mt-14' : 'mt-10'}
          size={size}
          pair={step.pair}
          first={step.first}
          second={step.second}
          value={r.words[step.pair] ?? ''}
          onChange={(w) => r.setWord(step.pair, w)}
          onSubmit={r.next}
          onSkip={r.next} />
        
      </div>);

  }

  return <ReviewMemo r={r} size={size} />;
}

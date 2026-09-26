import React from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { GroupResult } from '../../utils/training';

export function ResultHeadline({ results, children }: {results: GroupResult[];children?: React.ReactNode;}) {
  const correct = results.every((g) => g.correct);
  const wrong = results.reduce((n, g) => n + g.wrong, 0);
  const total = results.reduce((n, g) => n + g.actual.length, 0);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <p className="flex items-center gap-3 text-[22px] text-ink">
        {correct ?
        <CheckIcon size={20} strokeWidth={1.75} className="self-center text-ink-2" aria-hidden /> :

        <XIcon size={20} strokeWidth={1.75} className="self-center text-accent" aria-hidden />
        }
        {correct ? 'Correct' : 'Incorrect'}
      </p>
      {!correct &&
      <span className="text-[14px] text-ink-3 tnum">
          {total - Math.min(wrong, total)} of {total} targets
        </span>
      }
      {children}
    </div>);

}
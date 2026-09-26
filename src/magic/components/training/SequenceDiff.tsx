import React from 'react';
import { GroupResult } from '../../utils/training';
import { SequenceView } from '../memo/SequenceView';

/** "yours" over "actual", with only the differences marked. */
export function SequenceDiff({ result }: {result: GroupResult;}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline gap-4">
        <span className="w-12 shrink-0 text-[11.5px] text-ink-3">yours</span>
        {result.typed.length ?
        <SequenceView tokens={result.typed} marks={result.typedMarks} size="md" /> :

        <span className="text-[14px] text-ink-3">—</span>
        }
      </div>
      <div className="flex items-baseline gap-4">
        <span className="w-12 shrink-0 text-[11.5px] text-ink-3">actual</span>
        <SequenceView tokens={result.actual} marks={result.actualMarks} size="md" />
      </div>
    </div>);

}
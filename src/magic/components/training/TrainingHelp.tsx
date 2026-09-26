import React from 'react';
import { TrainMode, modeInfo } from '../../data/trainingModes';
import { Sheet } from '../common/Sheet';

/** Help for the current drill only. */
export function TrainingHelp({ open, onClose, mode }: {open: boolean;onClose: () => void;mode: TrainMode;}) {
  const info = modeInfo(mode);
  return (
    <Sheet open={open} onClose={onClose} label={`How ${info.label} works`} title={info.label} width={440}>
      <p className="text-[13px] text-ink-3">{info.tests}</p>
      <ol className="mt-4 border-t border-line">
        {info.steps.map((s) =>
        <li key={s} className="border-b border-line py-2.5 text-[13.5px] leading-relaxed text-ink-2">
            {s}
          </li>
        )}
      </ol>
    </Sheet>);

}
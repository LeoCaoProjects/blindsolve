import React from 'react';

/** Three-cell readout — same construction as the Timer's best / mo3 / success strip. */
export function SessionReadout({ cells }: {cells: [string, string][];}) {
  return (
    <dl className="grid shrink-0 grid-cols-3 border-b border-line">
      {cells.map(([label, value], i) =>
      <div key={label} className={`px-5 py-3.5 ${i > 0 ? 'border-l border-line' : ''}`}>
          <dt className="text-[11px] text-ink-3">{label}</dt>
          <dd className={`mt-1 font-mono text-[14px] tnum ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>{value}</dd>
        </div>
      )}
    </dl>);

}
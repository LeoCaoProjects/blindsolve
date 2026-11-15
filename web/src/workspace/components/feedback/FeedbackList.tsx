import React from 'react';
import { ImageIcon } from 'lucide-react';
import { CATEGORY_LABEL, Feedback, STATUS_LABEL } from '../../types/feedback';

export function formatStamp(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!withTime) return date;
  return `${date} ${d.getFullYear()}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Dense list for an internal tool. Desktop reads like a table on a shared grid; below md each
 * row stacks into two lines instead of scrolling sideways.
 */
export function FeedbackList({ items, onOpen }: {items: Feedback[];onOpen: (id: string) => void;}) {
  return (
    <div role="table" aria-label="Feedback" className="min-w-0">
      <div
        role="row"
        className="hidden grid-cols-[112px_minmax(0,1fr)_170px_150px_92px_64px] gap-4 border-b border-line px-3 pb-2 text-[11.5px] text-ink-3 lg:grid">
        
        <span role="columnheader">Type</span>
        <span role="columnheader">Message</span>
        <span role="columnheader">Page</span>
        <span role="columnheader">From</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="text-right">
          Date
        </span>
      </div>
      <ul>
        {items.map((f) => {
          const unread = f.status === 'new';
          return (
            <li key={f.id} role="row" className="border-b border-line">
              <button
                type="button"
                onClick={() => onOpen(f.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-3 py-3 text-left transition-colors duration-150 ease-out hover:bg-hover lg:grid-cols-[112px_minmax(0,1fr)_170px_150px_92px_64px] lg:items-center lg:py-2.5">
                
                <span role="cell" className={`order-1 flex items-center gap-2 text-[12.5px] ${f.category === 'bug' ? 'text-accent' : 'text-ink-2'}`}>
                  {unread && <span aria-label="New" className="h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />}
                  {CATEGORY_LABEL[f.category]}
                </span>
                <span role="cell" className={`order-3 col-span-2 flex min-w-0 items-center gap-2 text-[13.5px] lg:order-2 lg:col-span-1 ${unread ? 'text-ink' : 'text-ink-2'}`}>
                  <span className="truncate">{f.message}</span>
                  {f.screenshot && <ImageIcon size={13} className="shrink-0 text-ink-3" aria-label="Has screenshot" />}
                </span>
                <span role="cell" className="order-4 hidden truncate text-[12.5px] text-ink-3 lg:order-3 lg:block">
                  {f.source}
                </span>
                <span role="cell" className="order-5 hidden truncate text-[12.5px] text-ink-3 lg:order-4 lg:block">
                  {f.user?.name ?? f.contact ?? 'Signed out'}
                </span>
                <span role="cell" className="order-6 hidden text-[12.5px] text-ink-2 lg:order-5 lg:block">
                  {STATUS_LABEL[f.status]}
                </span>
                <span role="cell" className="order-2 text-right font-mono text-[11.5px] text-ink-3 lg:order-6">
                  <span className="lg:hidden">{STATUS_LABEL[f.status]} · </span>
                  {formatStamp(f.createdAt)}
                </span>
              </button>
            </li>);

        })}
      </ul>
    </div>);

}
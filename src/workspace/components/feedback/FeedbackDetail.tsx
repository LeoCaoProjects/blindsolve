import React, { useEffect, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { CATEGORY_LABEL, Feedback, STATUS_LABEL, STATUS_ORDER } from '../../types/feedback';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { IconButton } from '../common/IconButton';
import { Inspector } from '../common/Inspector';
import { OptionGroup } from '../common/OptionGroup';
import { formatStamp } from './FeedbackList';

/**
 * One submission: the message first, then who, where and when, then technical details.
 * Status changes apply at once (any status to any other). Archive is the normal way out;
 * permanent delete sits apart and asks first.
 */
export function FeedbackDetail({ item, onClose }: {item: Feedback;onClose: () => void;}) {
  const { updateFeedback, deleteFeedback } = useAppData();
  const [note, setNote] = useState(item.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const run = async (action: () => Promise<void>, close = false) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError('');
    try {
      await action();
      if (live.current && close) onClose();
    } catch {
      if (live.current) setError('Feedback could not be updated. Your changes are still here; please retry.');
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  };
  const noteDirty = note.trim() !== (item.note ?? '').trim();

  return (
    <Inspector label={`${CATEGORY_LABEL[item.category]} feedback`} onClose={onClose} width={580}>
      {error && <p role="alert" className="px-6 pt-4 text-sm">{error}</p>}
      {pending && <p role="status" className="px-6 pt-2 text-sm">Saving feedback...</p>}
      <header className="relative shrink-0 border-b border-line bg-surface px-6 pb-4 pt-5 md:px-8">
        <IconButton label="Close" onClick={onClose} className="absolute right-3 top-3">
          <XIcon />
        </IconButton>
        <p className="flex flex-wrap items-baseline gap-x-3 pr-10 text-[12.5px] text-ink-3">
          <span className={item.category === 'bug' ? 'text-accent' : 'text-ink-2'}>{CATEGORY_LABEL[item.category]}</span>
          <span>{formatStamp(item.createdAt, true)}</span>
          <span className="font-mono text-[11.5px]">{item.id}</span>
        </p>
        <OptionGroup
          className="mt-4"
          label="Status"
          value={item.status}
          onChange={(status) => { void run(() => updateFeedback(item.id, { status })); }}
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        
      </header>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-6 md:px-8">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{item.message}</p>

        {item.screenshot &&
        <a href={item.screenshot.url} target="_blank" rel="noreferrer" className="mt-6 block overflow-hidden rounded-[4px] border border-line">
            <img src={item.screenshot.url} alt={`Screenshot: ${item.screenshot.name}`} className="max-h-[260px] w-full object-cover object-top" />
            <span className="block border-t border-line px-3 py-1.5 font-mono text-[11.5px] text-ink-3">{item.screenshot.name}</span>
          </a>
        }

        <dl className="mt-7 grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 border-t border-line pt-5 text-[13px]">
          <dt className="text-ink-3">From</dt>
          <dd className="min-w-0 text-ink">
            {item.user ?
            <>
                {item.user.name}
                <span className={`ml-2 text-ink-3 ${item.user.provider === 'wca' ? 'font-mono text-[12px]' : ''}`}>{item.user.detail}</span>
                <span className="ml-2 text-ink-3">{item.user.provider === 'wca' ? 'WCA' : 'Google'}</span>
              </> :

            <span className="text-ink-3">Signed out</span>
            }
          </dd>
          {item.contact &&
          <>
              <dt className="text-ink-3">Reply to</dt>
              <dd className="min-w-0 truncate">
                <a href={`mailto:${item.contact}`} className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-3">
                  {item.contact}
                </a>
              </dd>
            </>
          }
          <dt className="text-ink-3">Page</dt>
          <dd className="text-ink">{item.source}</dd>
          <dt className="text-ink-3">Submitted</dt>
          <dd className="text-ink">{formatStamp(item.createdAt, true)}</dd>
        </dl>

        {item.context &&
        <section className="mt-6">
            <h3 className="text-[12px] text-ink-3">Technical details</h3>
            <dl className="mt-2 grid grid-cols-[96px_minmax(0,1fr)] gap-y-1 font-mono text-[12px]">
              {item.context.training &&
            <>
                  <dt className="text-ink-3">Training</dt>
                  <dd className="text-ink-2">{item.context.training}</dd>
                </>
            }
              <dt className="text-ink-3">Build</dt>
              <dd className="text-ink-2">{item.context.build}</dd>
              <dt className="text-ink-3">Browser</dt>
              <dd className="text-ink-2">{item.context.browser}</dd>
              <dt className="text-ink-3">System</dt>
              <dd className="text-ink-2">
                {item.context.os} · {item.context.device}
              </dd>
              <dt className="text-ink-3">Window</dt>
              <dd className="text-ink-2">{item.context.viewport}</dd>
            </dl>
          </section>
        }

        <section className="mt-7 border-t border-line pt-5">
          <label htmlFor={`note-${item.id}`} className="flex items-baseline justify-between text-[12px] text-ink-3">
            Private note
            <span>Only admins see this</span>
          </label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Need to reproduce on Safari mobile"
            className="mt-2 w-full resize-y rounded-[4px] border border-line-strong bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink caret-accent outline-none placeholder:text-ink-3 focus:border-ink-3" />
          
          {noteDirty &&
          <div className="mt-2 flex justify-end gap-2">
              <button
              type="button"
              onClick={() => setNote(item.note ?? '')}
              className="inline-flex h-8 items-center rounded-[4px] px-2.5 text-[12.5px] text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink-2">
              
                Cancel
              </button>
              <button
              type="button"
              onClick={() => { void run(() => updateFeedback(item.id, { note: note.trim() || undefined })); }}
              className="inline-flex h-8 items-center rounded-[4px] border border-line-strong px-3 text-[12.5px] text-ink transition-colors duration-150 hover:bg-hover">
              
                Save note
              </button>
            </div>
          }
        </section>
      </div>

      <footer className="dock-inset flex shrink-0 items-center justify-between border-t border-line px-6 pt-3.5">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="inline-flex h-8 items-center rounded-[4px] px-2 text-[12.5px] text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink-2">
          
          Delete permanently
        </button>
        {item.status === 'archived' ?
        <button
          type="button"
          onClick={() => { void run(() => updateFeedback(item.id, { status: 'new' })); }}
          className="inline-flex h-9 items-center rounded-[4px] border border-line-strong px-3.5 text-[13px] text-ink transition-colors duration-150 hover:bg-hover">
          
            Restore
          </button> :

        <button
          type="button"
          onClick={() => {
            void run(() => updateFeedback(item.id, { status: 'archived' }), true);
          }}
          className="inline-flex h-9 items-center rounded-[4px] border border-line-strong px-3.5 text-[13px] text-ink transition-colors duration-150 hover:bg-hover">
          
            Archive
          </button>
        }
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete feedback permanently?"
        body="This can’t be undone. Archive keeps it out of the inbox without deleting it."
        onCancel={() => setConfirmDelete(false)}
        confirm={{
          label: 'Delete',
          tone: 'danger',
          onClick: () => {
            setConfirmDelete(false);
            void run(() => deleteFeedback(item.id), true);
          }
        }} />
      
    </Inspector>);

}

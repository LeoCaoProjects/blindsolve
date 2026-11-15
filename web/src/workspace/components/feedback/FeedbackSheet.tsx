import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ImagePlusIcon, Loader2Icon, XIcon } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { useStore } from '../../../app/Store';
import { FeedbackCategory } from '../../types/feedback';
import { sourceLabel, techContext } from '../../utils/feedbackContext';
import { EASE_OUT } from '../../utils/keyboard';
import { IconButton } from '../common/IconButton';
import { OptionGroup } from '../common/OptionGroup';
import { Sheet } from '../common/Sheet';

type Phase = 'idle' | 'sending' | 'failed' | 'sent';

interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  /** Prototype only: make the next send fail, to show the error state */
  failFirst?: boolean;
  initialCategory?: FeedbackCategory;
}

/**
 * Give feedback: type, message, and (only when useful) an optional email or screenshot.
 * Signed-in users are attached automatically. Bug reports include basic app and device details.
 * A failed send keeps everything that was typed.
 */
export function FeedbackSheet({ open, onClose, failFirst = false, initialCategory = 'bug' }: FeedbackSheetProps) {
  const { account, submitFeedback } = useAppData();
  const owner = useStore().user?.id;
  const request = useRef(0);
  const [category, setCategory] = useState<FeedbackCategory>(initialCategory);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [shot, setShot] = useState<{name: string;url: string;file: File;} | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [showIncluded, setShowIncluded] = useState(false);
  const failNext = useRef(failFirst);
  const sending = useRef(false);
  useEffect(() => {
    request.current++;
    sending.current = false;
    setPhase('idle');
    return () => { request.current++; };
  }, [open, owner]);
  const fileRef = useRef<HTMLInputElement>(null);
  const signedIn = !!account.provider;
  const isBug = category === 'bug';
  const canSend = message.trim().length > 0 && phase !== 'sending';

  const reset = useCallback(() => {
    sending.current = false;
    setCategory(initialCategory);
    setMessage('');
    setEmail('');
    setShot(null);
    setPhase('idle');
    setShowIncluded(false);
  }, [initialCategory]);

  useEffect(
    () => () => {
      if (shot) URL.revokeObjectURL(shot.url);
    },
    [shot],
  );

  const close = () => {
    if (phase === 'sending') return;
    onClose();
    if (phase === 'sent') window.setTimeout(reset, 200);
  };

  // Small confirmation, then out of the way.
  useEffect(() => {
    if (phase !== 'sent') return;
    let resetTimer: number | undefined;
    const id = window.setTimeout(() => {
      onClose();
      resetTimer = window.setTimeout(reset, 200);
    }, 1800);
    return () => {
      window.clearTimeout(id);
      if (resetTimer !== undefined) window.clearTimeout(resetTimer);
    };
  }, [onClose, phase, reset]);

  const send = async () => {
    if (!canSend || sending.current) return;
    const ticket = ++request.current;
    sending.current = true;
    setPhase('sending');
    try {
      if (failNext.current) {
        failNext.current = false;
        throw new Error('Previewed failure');
      }
      await submitFeedback({
        category,
        message: message.trim(),
        contact: email.trim() || undefined,
        screenshot: isBug && shot ? shot : undefined,
        source: sourceLabel(),
        context: isBug ? techContext() : undefined
      });
      if (ticket === request.current) setPhase('sent');
    } catch {
      if (ticket === request.current) setPhase('failed');
    } finally {
      if (ticket === request.current) sending.current = false;
    }
  };

  const context = open && isBug ? techContext() : null;

  return (
    <Sheet
      open={open}
      onClose={close}
      label="Give feedback"
      title={phase === 'sent' ? undefined : 'Give feedback'}
      width={500}
      footer={
      phase === 'sent' ? undefined :
      <>
            <p role="status" className="min-w-0 truncate pl-2 text-[12.5px]">
              {phase === 'failed' &&
          <span className="flex items-center gap-2 text-ink">
                  <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
                  Couldn’t send feedback. Try again.
                </span>
          }
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
            type="button"
            onClick={close}
            className="inline-flex h-9 items-center rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
            
                Cancel
              </button>
              <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="inline-flex h-9 items-center gap-2 rounded-[4px] bg-ink px-4 text-[13px] font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-40">
            
                {phase === 'sending' && <Loader2Icon size={13} className="animate-spin motion-reduce:animate-none" aria-hidden />}
                {phase === 'sending' ? 'Sending' : phase === 'failed' ? 'Try again' : 'Send feedback'}
              </button>
            </div>
          </>

      }>
      
      {phase === 'sent' ?
      <div role="status" className="flex items-start gap-3 py-1">
          <CheckIcon size={16} className="mt-0.5 shrink-0 text-ink-2" aria-hidden />
          <div>
            <p className="text-[14px] text-ink">Feedback sent</p>
            <p className="mt-1 text-[13px] text-ink-3">Thanks for helping improve BlindSolve.</p>
          </div>
        </div> :

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="grid gap-5">
        
          <OptionGroup
          label="Type"
          showLabel={false}
          value={category}
          onChange={setCategory}
          options={[
          { value: 'bug', label: 'Bug' },
          { value: 'feature', label: 'Feature request' },
          { value: 'general', label: 'General feedback' }]
          } />
        

          <label className="grid gap-1.5">
            <span className="text-[12px] text-ink-3">Message</span>
            <textarea
            autoFocus
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            rows={5}
            placeholder={isBug ? 'What happened, and what did you expect?' : category === 'feature' ? 'What would you like BlindSolve to do?' : 'What’s on your mind?'}
            className="min-h-[112px] w-full resize-y rounded-[4px] border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink caret-accent outline-none transition-colors duration-150 ease-out placeholder:text-ink-3 focus:border-ink-3" />
          
          </label>

          {signedIn ?
        <p className="text-[12.5px] text-ink-3">
              Sent as <span className="text-ink-2">{account.name}</span> · <span className={account.provider === 'wca' ? 'font-mono' : ''}>{account.detail}</span>
            </p> :

        <label className="grid gap-1.5">
              <span className="flex items-baseline justify-between gap-3 text-[12px] text-ink-3">
                Email (optional)
                <span>Only if you’d like a reply</span>
              </span>
              <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-9 w-full rounded-[4px] border border-line-strong bg-surface px-3 text-[13.5px] text-ink caret-accent outline-none transition-colors duration-150 ease-out placeholder:text-ink-3 focus:border-ink-3" />
          
            </label>
        }

          <AnimatePresence initial={false}>
            {isBug &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="overflow-hidden">
            
                <div className="grid gap-3">
                  {shot ?
              <div className="flex items-center gap-3 rounded-[4px] border border-line p-2">
                      <img src={shot.url} alt="" className="h-10 w-16 shrink-0 rounded-[3px] object-cover" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-2">{shot.name}</span>
                      <IconButton size="sm" label="Remove screenshot" onClick={() => setShot(null)}>
                        <XIcon />
                      </IconButton>
                    </div> :

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-8 w-fit items-center gap-2 rounded-[4px] px-2 -ml-2 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
                
                      <ImagePlusIcon size={14} strokeWidth={1.75} aria-hidden />
                      Add screenshot
                    </button>
              }
                  <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setShot({ name: f.name, url: URL.createObjectURL(f), file: f });
                  e.target.value = '';
                }} />
              
                  <p className="text-[12px] leading-relaxed text-ink-3">
                    Basic app and device information will be included to help diagnose bugs.{' '}
                    <button
                  type="button"
                  aria-expanded={showIncluded}
                  onClick={() => setShowIncluded((v) => !v)}
                  className="text-ink-3 underline decoration-line-strong underline-offset-2 transition-colors duration-150 hover:text-ink-2">
                  
                      {showIncluded ? 'Hide' : 'What’s included'}
                    </button>
                  </p>
                  {showIncluded && context &&
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-[11.5px] text-ink-3">
                      <dt>Page</dt>
                      <dd className="text-ink-2">{sourceLabel()}</dd>
                      {context.training &&
                <>
                          <dt>Training</dt>
                          <dd className="text-ink-2">{context.training}</dd>
                        </>
                }
                      <dt>Build</dt>
                      <dd className="text-ink-2">{context.build}</dd>
                      <dt>Browser</dt>
                      <dd className="text-ink-2">
                        {context.browser} · {context.os} · {context.device}
                      </dd>
                      <dt>Window</dt>
                      <dd className="text-ink-2">{context.viewport}</dd>
                    </dl>
              }
                </div>
              </motion.div>
          }
          </AnimatePresence>
        </form>
      }
    </Sheet>);

}

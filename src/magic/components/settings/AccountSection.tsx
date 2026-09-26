import React, { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { LOCAL_ACCOUNT, useAppData } from '../../contexts/AppDataContext';
import { SignInStep, useSignInFlow } from '../../hooks/useSignInFlow';
import { MergeDialog } from '../auth/MergeDialog';
import { ProviderButtons } from '../auth/ProviderButtons';
import { GoogleMark, WcaMark } from '../auth/ProviderMarks';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SecondaryButton, SettingsRow } from './SettingsSection';

export function AccountSection({ initialStep }: {initialStep?: SignInStep;}) {
  const { account, setAccount } = useAppData();
  const flow = useSignInFlow({ initial: initialStep });
  const [confirmOut, setConfirmOut] = useState(false);

  if (account.status === 'unconfigured') {
    return (
      <SettingsRow label="Local" hint="Sign-in isn’t available on this server — everything stays on this device">
        <span />
      </SettingsRow>);

  }

  if (!account.provider) {
    return (
      <div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[13.5px] text-ink">Sign in to sync</p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">Stored on this device until you do</p>
          </div>
          <ProviderButtons layout="row" pending={flow.step === 'redirecting' ? flow.provider : null} onStart={flow.start} />
        </div>
        {flow.error && <p className="mt-3 text-[12.5px] leading-relaxed text-accent" role="alert">{flow.error}</p>}
        <MergeDialog flow={flow} />
      </div>);

  }

  const initials = account.name.
  split(' ').
  map((p) => p[0]).
  join('').
  slice(0, 2);

  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-selected text-[13px] font-medium text-ink-2">
            
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] text-ink">{account.name}</p>
            <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className={account.provider === 'wca' ? 'font-mono' : ''}>{account.detail}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                {account.provider === 'wca' ? <WcaMark size={12} /> : <GoogleMark size={12} />}
                {account.provider === 'wca' ? 'WCA account' : 'Google'}
              </span>
            </p>
          </div>
        </div>
        <SecondaryButton onClick={() => setConfirmOut(true)}>Sign out</SecondaryButton>
      </div>

      {account.status !== 'idle' &&
      <div className="mt-5 flex items-center justify-between gap-6 border-t border-line pt-4 text-[13px]" role="status">
          {account.status === 'saving' &&
        <span className="flex items-center gap-2 text-ink-2">
              <Loader2Icon size={13} className="animate-spin motion-reduce:animate-none" /> Saving
            </span>
        }
          {account.status === 'offline' && <span className="text-ink-2">Offline — changes are kept here and sync when you reconnect</span>}
          {account.status === 'failed' &&
        <>
              <span className="flex items-center gap-2 text-ink">
                <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-accent" />
                Sync failed
                <span className="text-ink-3">· last tried 14:02</span>
              </span>
              <SecondaryButton
            onClick={() => {
              setAccount({ ...account, status: 'saving' });
              window.setTimeout(() => setAccount({ ...account, status: 'idle' }), 1100);
            }}>
            
                Retry
              </SecondaryButton>
            </>
        }
          {account.status === 'conflict' &&
        <>
              <span className="flex items-center gap-2 text-ink">
                <span aria-hidden className="h-[6px] w-[6px] rounded-full bg-accent" />3 pairs changed on another device
              </span>
              <SecondaryButton onClick={() => setAccount({ ...account, status: 'idle' })}>Keep this device’s</SecondaryButton>
            </>
        }
        </div>
      }

      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        body="Your data stays on this device."
        onCancel={() => setConfirmOut(false)}
        confirm={{
          label: 'Sign out',
          onClick: () => {
            setAccount(LOCAL_ACCOUNT);
            setConfirmOut(false);
          }
        }} />
      
    </div>);

}

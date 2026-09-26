import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MergeDialog } from '../components/auth/MergeDialog';
import { ProviderButtons } from '../components/auth/ProviderButtons';
import { SignInStep, useSignInFlow } from '../hooks/useSignInFlow';
import { AuthProvider } from '../types/app';
import { useScreenInit } from '../useScreenInit';

/** OAuth only: WCA first, Google second. First sign-in creates the account. */
export function SignIn() {
  const init = useScreenInit() as {signin?: SignInStep;provider?: AuthProvider;};
  const navigate = useNavigate();
  const flow = useSignInFlow({ initial: init.signin, provider: init.provider, onDone: () => navigate('/') });

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-bg font-sans text-ink">
      <header className="flex h-11 shrink-0 items-center justify-end border-b border-line px-3">
        <Link
          to="/"
          className="inline-flex h-7 items-center rounded-[4px] px-2.5 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
          
          Continue without signing in
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[320px]">
          <h1 className="text-[19px] font-medium text-ink">Sign in</h1>
          <div className="mt-7">
            <ProviderButtons pending={flow.step === 'redirecting' ? flow.provider : null} onStart={flow.start} />
          </div>
          {flow.error && <p className="mt-4 text-[12.5px] leading-relaxed text-accent" role="alert">{flow.error}</p>}
          {flow.step === 'redirecting' &&
          <button type="button" onClick={flow.cancel} className="mt-4 text-[12.5px] text-ink-3 transition-colors duration-150 hover:text-ink-2">
              Cancel
            </button>
          }
        </div>
      </main>
      <MergeDialog flow={flow} />
    </div>);

}

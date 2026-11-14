import React from 'react';
import { SignInFlow } from '../../hooks/useSignInFlow';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { RadioRows } from '../common/Toggle';

/** Shown after sign-in when this device already has data. Nothing is discarded silently. */
export function MergeDialog({ flow }: {flow: SignInFlow;}) {
  const { pairs, solves } = flow.localCounts;
  return (
    <ConfirmDialog
      open={flow.step === 'merge'}
      width={460}
      title="This device already has data"
      body={
      <>
          {pairs} letter pairs and {solves} solves are stored here.
        </>
      }
      onCancel={flow.continueWithAccount}
      cancelLabel="Continue with account data"
      confirm={{ label: 'Continue', onClick: flow.confirmMerge }}>
      
      <RadioRows
        className="mt-4"
        name="What to do with this device’s data"
        value={flow.choice}
        onChange={flow.setChoice}
        options={[
        { value: 'merge', label: 'Merge into my account', hint: 'Newer words win conflicts. The guest copy stays on this device.' },
        { value: 'account', label: 'Use my account’s data', hint: 'Leave the guest copy unchanged.' }]
        } />
      
    </ConfirmDialog>);

}

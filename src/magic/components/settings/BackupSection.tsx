import React, { useRef, useState } from 'react';
import { useStore } from '../../../app/Store';
import { downloadBackup, parseBackup, type AppData } from '../../../lib/repository';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SecondaryButton, SettingsRow } from './SettingsSection';

/** Latest Magic presentation connected to the versioned production backup format. */
export function BackupSection({ preview: _preview }: {preview?: 'valid' | 'invalid';}) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{name: string;data: AppData;} | null>(null);
  const [problem, setProblem] = useState<{name: string;message: string;} | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };
  const onFile = async (file: File) => {
    try {
      setPending({ name: file.name, data: parseBackup(await file.text()) });
    } catch (error) {
      setProblem({ name: file.name, message: error instanceof Error ? error.message : 'Invalid backup' });
    }
  };

  return <div>
    <SettingsRow label="Export backup" hint="Setup, lettering, letter pairs, solves and practice history">
      <SecondaryButton onClick={() => { downloadBackup(store.data); flash('Backup saved to downloads'); }}>Export</SecondaryButton>
    </SettingsRow>
    <SettingsRow label="Import backup" hint="You’ll see what’s inside before anything changes">
      <SecondaryButton onClick={() => fileRef.current?.click()}>Import…</SecondaryButton>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void onFile(file);
        event.target.value = '';
      }} />
    </SettingsRow>
    <p className="h-5 pt-1 text-[12.5px] text-ink-2" role="status">{notice}</p>
    {pending && <ConfirmDialog open width={520} title="Import backup" onCancel={() => setPending(null)} confirm={{
      label: 'Merge backup', onClick: () => {
        store.importData(pending.data);
        flash(`Imported ${Object.keys(pending.data.pairs).length} pairs`);
        setPending(null);
      },
    }}>
      <p className="mt-1 font-mono text-[12px] text-ink-3">{pending.name}</p>
      <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-2.5 border-y border-line py-4 text-[13px]">
        <dt className="text-ink-3">Letter pairs</dt><dd className="text-right tnum">{Object.keys(pending.data.pairs).length}</dd>
        <dt className="text-ink-3">Solves</dt><dd className="text-right tnum">{pending.data.solves.length}</dd>
        <dt className="text-ink-3">Practice history</dt><dd className="text-right tnum">{pending.data.attempts.length}</dd>
      </dl>
      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">Existing data is retained; differing mnemonics are preserved as alternates.</p>
    </ConfirmDialog>}
    {problem && <ConfirmDialog open title="Can’t import this file" body={<><span className="font-mono text-[12px] text-ink-3">{problem.name}</span><span className="mt-3 block">{problem.message}</span></>} onCancel={() => setProblem(null)} cancelLabel="Close" confirm={{ label: 'Choose another file', onClick: () => { setProblem(null); fileRef.current?.click(); } }} />}
  </div>;
}

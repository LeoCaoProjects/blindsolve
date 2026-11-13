import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../../../app/Store";
import { deletionIndex } from "../../../lib/repository";
import { createRecovered, listRecovered, portableSnapshot, selectRecovery } from "../../../lib/portableRecovery";
import {
  ImportSummary,
  MergeStrategy,
  buildBackup,
  downloadJson,
  mergeBackup,
  summarize,
} from "../../utils/backup";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { RadioRows } from "../common/Toggle";
import { SettingsRow } from "./SettingsSection";
import { SecondaryButton } from "../common/PrimaryButton";

export function BackupSection({ preview }: { preview?: "valid" | "invalid" }) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewWorkspace = useRef("");
  const published = useRef<string | null>(null);
  const fileGeneration = useRef(0);
  const restoring = useRef(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [strategy, setStrategy] = useState<Exclude<MergeStrategy, "replace"> | "restore">("keep-mine");
  const [notice, setNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<ReturnType<typeof listRecovered>>([]);

  useEffect(() => {
    previewWorkspace.current = store.workspaceIdentity();
    try { setWorkspaces(listRecovered()); } catch { /* The import will report unavailable storage. */ }
    if (preview === "valid")
      setSummary(
        summarize("3bld-backup.json", buildBackup(store.data), store.data),
      );
    if (preview === "invalid")
      setSummary(
        summarize(
          "cstimer_export.json",
          { properties: {}, session1: [] },
          store.data,
        ),
      );
    return () => { fileGeneration.current++; };
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const onFile = async (file: File) => {
    const generation = ++fileGeneration.current;
    previewWorkspace.current = store.workspaceIdentity();
    published.current = null;
    setStrategy("keep-mine");
    setImportError(null);
    setSummary(null);
    if (file.size > 25 * 1024 * 1024) {
      setSummary({
        ok: false,
        fileName: file.name,
        problems: ["backup is larger than 25 MB"],
      });
      return;
    }
    try {
      const json = JSON.parse(await file.text());
      if (generation === fileGeneration.current) setSummary(summarize(file.name, json, store.data));
    } catch {
      if (generation !== fileGeneration.current) return;
      setSummary({
        ok: false,
        fileName: file.name,
        problems: ["not valid JSON"],
      });
    }
  };

  const doImport = async () => {
    if (!summary?.ok || restoring.current) return;
    const generation = fileGeneration.current;
    let saved: boolean;
    try {
      if (!store.ready || previewWorkspace.current !== store.workspaceIdentity())
        throw new Error("The workspace changed. Choose the backup file again.");
      if (strategy === "restore") {
        if (store.storageIssue) throw new Error("Save the current workspace before opening a recovered workspace.");
        restoring.current = true;
        const id = published.current ?? await createRecovered(summary.file);
        if (generation !== fileGeneration.current) return;
        published.current = id;
        setWorkspaces(listRecovered());
        if (previewWorkspace.current !== store.workspaceIdentity())
          throw new Error("The snapshot was saved. Open it from the recovered workspace list.");
        selectRecovery(id);
        return;
      }
      saved = store.update((current) =>
        mergeBackup(current, summary.file.data, strategy, deletionIndex(store.recoveryEnvelope())),
      );
    } catch (error) {
      if (generation === fileGeneration.current)
        setImportError(error instanceof Error ? error.message : "Import failed.");
      return;
    } finally {
      restoring.current = false;
    }
    setSummary(null);
    flash(
      saved
        ? `Imported ${summary.pairs.total} pairs`
        : "Import is only in this tab. Export a backup or retry saving.",
    );
  };

  return (
    <div>
      <SettingsRow
        label="Export backup"
        hint="Setup, lettering, letter pairs, solves and practice history"
      >
        <SecondaryButton
          disabled={!store.ready || !!store.storageIssue}
          onClick={() => {
            try {
              const { envelope, legacyIncomplete } = store.durableRecovery();
              downloadJson(
                portableSnapshot(envelope, legacyIncomplete),
                `3bld-backup-${new Date().toISOString().slice(0, 10)}.json`,
              );
              flash("Backup saved to downloads");
            } catch (error) {
              flash(error instanceof Error ? error.message : "Backup could not be exported.");
            }
          }}
        >
          Export
        </SecondaryButton>
      </SettingsRow>
      {workspaces.filter(({ id }) => id !== store.recoveredId).map(({ id, restoredAt }) => (
        <SettingsRow key={id} label="Recovered workspace" hint={restoredAt}>
          <SecondaryButton disabled={!!store.storageIssue} onClick={() => {
            try { selectRecovery(id); } catch { flash("Could not open the recovered workspace."); }
          }}>Open recovered workspace</SecondaryButton>
        </SettingsRow>
      ))}
      <SettingsRow
        label="Import backup"
        hint="You’ll see what’s inside before anything changes"
      >
        <SecondaryButton onClick={() => fileRef.current?.click()}>
          Import…
        </SecondaryButton>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </SettingsRow>
      <p className="h-5 pt-1 text-[12.5px] text-ink-2" role="status">
        {notice}
      </p>
      <button
        type="button"
        onClick={() => {
          fileGeneration.current++;
          previewWorkspace.current = store.workspaceIdentity();
          published.current = null;
          setImportError(null);
          setSummary(
            summarize("3bld-backup.json", buildBackup(store.data), store.data),
          );
        }}
        className="sr-only focus:not-sr-only focus:text-[12px] focus:text-ink-3"
      >
        Preview a sample backup
      </button>

      {summary && summary.ok && (
        <ConfirmDialog
          open
          width={520}
          title="Import backup"
          onCancel={() => { fileGeneration.current++; setSummary(null); }}
          confirm={{
            label: strategy === "restore" ? "Restore as separate workspace" : "Import",
            onClick: doImport,
          }}
        >
          {importError && <p role="alert">{importError}</p>}
          <p className="mt-1 font-mono text-[12px] text-ink-3">
            {summary.fileName} · {summary.exportedAt.slice(0, 10)}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-3">
            {summary.file.history === "legacy-incomplete"
              ? "This backup lacks complete deletion history. Open it separately to review any history missing from this workspace."
              : "Known deletions apply only in a separate restored workspace. A merge never applies deletions from the file."}
          </p>
          <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-2.5 border-y border-line py-4 text-[13px]">
            <dt className="text-ink-3">Known deletion markers</dt>
            <dd className="text-right text-ink">{Object.keys(summary.file.tombstones).length}</dd>
            <dt className="text-ink-3">Lettering</dt>
            <dd className="text-right text-ink">{summary.lettering}</dd>
            <dt className="text-ink-3">Buffers</dt>
            <dd className="text-right font-mono text-ink">{summary.buffers}</dd>
            <dt className="text-ink-3">Letter pairs</dt>
            <dd className="text-right text-ink tnum">
              {summary.pairs.total}
              <span className="ml-2 text-ink-3">
                {summary.pairs.added} new · {summary.pairs.conflicts} differ
              </span>
            </dd>
            <dt className="text-ink-3">Solves</dt>
            <dd className="text-right text-ink tnum">
              {summary.solves.toLocaleString()}
            </dd>
            <dt className="text-ink-3">Practice history</dt>
            <dd className="text-right text-ink tnum">
              {summary.practice.toLocaleString()}
            </dd>
          </dl>
          <RadioRows
            className="mt-4"
            name="How to open this backup"
            value={strategy}
            onChange={setStrategy}
            options={[
              {
                value: "keep-mine",
                label: "Merge, keep mine where they differ",
              },
              {
                value: "prefer-backup",
                label: "Merge, use the backup where they differ",
              },
              { value: "restore", label: "Open as a separate local workspace" },
            ]}
          />
        </ConfirmDialog>
      )}

      {summary && !summary.ok && (
        <ConfirmDialog
          open
          title="Can’t import this file"
          onCancel={() => setSummary(null)}
          cancelLabel="Close"
          confirm={{
            label: "Choose another file",
            onClick: () => {
              setSummary(null);
              fileRef.current?.click();
            },
          }}
          body={
            <>
              <span className="font-mono text-[12px] text-ink-3">
                {summary.fileName}
              </span>
              <span className="mt-2 block text-[12.5px] text-ink-3">
                {summary.problems.join(" · ")}
              </span>
            </>
          }
        />
      )}
    </div>
  );
}

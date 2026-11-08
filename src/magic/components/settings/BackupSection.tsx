import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../../../app/Store";
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
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [strategy, setStrategy] = useState<MergeStrategy>("keep-mine");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const onFile = async (file: File) => {
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
      setSummary(summarize(file.name, json, store.data));
    } catch {
      setSummary({
        ok: false,
        fileName: file.name,
        problems: ["not valid JSON"],
      });
    }
  };

  const doImport = () => {
    if (!summary?.ok) return;
    const saved = store.update((current) =>
      mergeBackup(current, summary.file.data, strategy),
    );
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
          onClick={() => {
            downloadJson(
              buildBackup(store.data),
              `3bld-backup-${new Date().toISOString().slice(0, 10)}.json`,
            );
            flash("Backup saved to downloads");
          }}
        >
          Export
        </SecondaryButton>
      </SettingsRow>
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
        onClick={() =>
          setSummary(
            summarize("3bld-backup.json", buildBackup(store.data), store.data),
          )
        }
        className="sr-only focus:not-sr-only focus:text-[12px] focus:text-ink-3"
      >
        Preview a sample backup
      </button>

      {summary && summary.ok && (
        <ConfirmDialog
          open
          width={520}
          title="Import backup"
          onCancel={() => setSummary(null)}
          confirm={{
            label: strategy === "replace" ? "Replace my data" : "Import",
            onClick: doImport,
            tone: strategy === "replace" ? "danger" : "default",
          }}
        >
          <p className="mt-1 font-mono text-[12px] text-ink-3">
            {summary.fileName} · {summary.exportedAt.slice(0, 10)}
          </p>
          <dl className="mt-5 grid grid-cols-[1fr_auto] gap-y-2.5 border-y border-line py-4 text-[13px]">
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
            name="When pairs differ"
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
              { value: "replace", label: "Replace everything with the backup" },
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
              <span className="mt-3 block">
                This isn’t a backup from this app.
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

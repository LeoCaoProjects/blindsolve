import { useStore } from "./Store";
import { downloadJson } from "../workspace/utils/backup";
import { portableSnapshot } from "../data/portableRecovery";
import { useState } from "react";

/** Persistent across routes; separate from transient notices and cloud status. */
export function StorageWarning() {
  const store = useStore();
  const [exportError, setExportError] = useState("");
  if (!store.storageIssue) return null;
  return (
    <aside
      role="alert"
      aria-label="Browser storage warning"
      className="fixed inset-x-2 top-2 z-[200] mx-auto max-w-2xl rounded border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg"
    >
      <p>{store.storageIssue}</p>
      <div className="mt-2 flex flex-wrap gap-4">
        <button
          className="underline"
          onClick={() => {
            try {
              downloadJson(
                portableSnapshot(store.recoveryEnvelope(), true),
                `blindsolve-recovery-${new Date().toISOString().slice(0, 10)}.json`,
              );
              setExportError("");
            } catch {
              setExportError("The tab copy could not be exported. Keep this tab open and retry saving.");
            }
          }}
        >
          Export this workspace
        </button>
        <button className="underline" onClick={store.retryStorage}>
          Retry saving
        </button>
      </div>
      {exportError && <p>{exportError}</p>}
    </aside>
  );
}

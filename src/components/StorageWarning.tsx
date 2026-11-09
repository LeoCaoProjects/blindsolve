import { useStore } from "../app/Store";
import { buildBackup, downloadJson } from "../magic/utils/backup";

function originalStorage(owner: string | null) {
  const key = `cubeiq-bld-v2:${owner ?? "guest"}`;
  try {
    return {
      key,
      raw: localStorage.getItem(key),
      settingsDraft: localStorage.getItem(
        `blindsolve-settings-draft-v1:${owner ?? "guest"}`,
      ),
    };
  } catch {
    return { key, unavailable: true };
  }
}

/** Persistent across routes; separate from transient notices and cloud status. */
export function StorageWarning() {
  const store = useStore();
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
          onClick={() =>
            downloadJson(
              {
                ...buildBackup(store.data),
                // Include deletion/outbox evidence in the recovery file as well as the
                // standard importable backup. Export still works if reads fail.
                localRecovery: {
                  owner: store.user?.id ?? null,
                  envelope: store.recoveryEnvelope(),
                  originalStorage: originalStorage(store.user?.id ?? null),
                },
              },
              `blindsolve-recovery-${new Date().toISOString().slice(0, 10)}.json`,
            )
          }
        >
          Export this workspace
        </button>
        <button className="underline" onClick={store.retryStorage}>
          Retry saving
        </button>
      </div>
    </aside>
  );
}

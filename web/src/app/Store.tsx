import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { withAccountCloudLock } from "../data/cloudLock";
import {
  loadRecovered,
  recoveredKey,
  saveRecovered,
  type RecoveredWorkspace,
} from "../data/portableRecovery";
import { emptyData, hasMeaningfulData, type AppData } from "../data/model";
import {
  loadLocal,
  saveLocal,
  loadCloud,
  loadLegacyRecovery,
  saveCloudChanges,
  mergeData,
  coalesceSyncChanges,
  reconcileSync,
  reconcilePeer,
  trackDeletions,
  applyTombstones,
  deletionIndex,
  diffSyncChanges,
  syncRetryDelay,
  SyncConflictError,
  type LocalEnvelope,
} from "../data/repository";

type SyncState = "local" | "loading" | "saving" | "saved" | "offline" | "error";
interface StoreValue {
  data: AppData;
  user: User | null;
  ready: boolean;
  sync: SyncState;
  lastAttemptAt: string | null;
  message: string;
  storageIssue: string;
  retryStorage: () => void;
  recoveryEnvelope: () => LocalEnvelope;
  durableRecovery: () => { envelope: LocalEnvelope; legacyIncomplete: boolean };
  workspaceIdentity: () => string;
  readLegacyRecovery: (account: string) => ReturnType<typeof loadLegacyRecovery>;
  recoveredId?: string;
  recoveryError?: string;
  notify: (s: string) => void;
  update: (fn: (d: AppData) => AppData) => boolean;
  retry: () => void;
  focus: boolean;
  setFocus: (focus: boolean) => void;
  guestMigration: { pairs: number; solves: number } | null;
  resolveGuestMigration: (choice: "merge" | "account") => void;
}
const Context = createContext<StoreValue | null>(null);
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing app store");
  return ctx;
}
export function StoreProvider({ children, recoveredId }: { children: ReactNode; recoveredId?: string }) {
  const [data, setData] = useState(emptyData),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [sync, setSync] = useState<SyncState>("loading"),
    [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null),
    [message, notify] = useState(""),
    [storageIssue, setStorageIssue] = useState(""),
    [focus, setFocus] = useState(false),
    [guestMigration, setGuestMigration] =
      useState<StoreValue["guestMigration"]>(null);
  const current = useRef<LocalEnvelope>({
      data: emptyData(),
      dirty: false,
      revision: 0,
      pending: {},
    }),
    owner = useRef<string | null>(null),
    epoch = useRef(0),
    saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    retryAttempts = useRef(0),
    saving = useRef(false),
    connected = useRef(false),
    initialized = useRef(false);
  const guestForMigration = useRef<AppData | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const storageReadable = useRef(true);
  const storageReadReason = useRef("");
  const recovered = useRef<RecoveredWorkspace["metadata"] | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  // A failed atomic setItem must not discard new work on an account transition.
  // These copies live only in this tab; the persistent warning/unload guard says so.
  const unsaved = useRef(new Map<string | null, LocalEnvelope>());
  const unreadableOwners = useRef(new Set<string | null>());
  const readAccount = useCallback((account: string, generation: number) =>
    withAccountCloudLock(account, () => loadCloud({
      owner: account,
      isCurrent: () => epoch.current === generation && owner.current === account,
    })), []);
  const persist = useCallback(() => {
    try {
      if (!storageReadable.current)
        throw new Error("Original data requires recovery");
      if (recoveredId) {
        if (!recovered.current) throw new Error("Workspace is not open for writing.");
        saveRecovered(recovered.current, current.current);
      } else saveLocal(owner.current, current.current);
      unsaved.current.delete(owner.current);
      setStorageIssue(
        unsaved.current.size
          ? "Another account has changes only in this tab. Switch back to save or export them before closing."
          : "",
      );
      return true;
    } catch {
      unsaved.current.set(owner.current, current.current);
      setStorageIssue(
        storageReadable.current
          ? "Changes are only in this tab: browser storage is full or unavailable. Keep this tab open, export a backup, then retry saving."
          : `Saved data could not be read${storageReadReason.current ? ` (${storageReadReason.current})` : ""}. The original copy is preserved. Export this tab’s data before closing; do not clear browser storage.`,
      );
      return false;
    }
  }, [recoveredId]);
  const markAttempt = useCallback(() => {
    const attemptedAt = new Date().toISOString();
    current.current = { ...current.current, lastAttemptAt: attemptedAt };
    setLastAttemptAt(attemptedAt);
    persist();
    return attemptedAt;
  }, [persist]);
  const flush = useCallback(async () => {
    if (
      !owner.current ||
      !connected.current ||
      saving.current ||
      !current.current.dirty
    )
      return;
    // Never dispatch an outbox which has not been committed on this device.
    if (!persist()) return;
    const generation = epoch.current,
      snapshot = current.current,
      batch = Object.values(snapshot.pending ?? {});
    if (!batch.length) {
      current.current = { ...current.current, dirty: false };
      setSync("saved");
      persist();
      return;
    }
    saving.current = true;
    markAttempt();
    setSync("saving");
    try {
      const account = owner.current;
      const write = () => {
        if (generation !== epoch.current || owner.current !== account)
          throw new Error("Account changed before sync");
        return saveCloudChanges(batch, snapshot.revision, {
          owner: account,
          isCurrent: () =>
            epoch.current === generation && owner.current === account,
        });
      };
      const revision = await withAccountCloudLock(account, write);
      if (generation !== epoch.current) return;
      const sent = new Map(
        batch.map((change) => [
          `${change.kind}:${change.recordId}`,
          JSON.stringify(change),
        ]),
      );
      const pending = Object.fromEntries(
        Object.entries(current.current.pending ?? {}).filter(
          ([key, change]) => sent.get(key) !== JSON.stringify(change),
        ),
      );
      current.current = {
        ...current.current,
        revision,
        pending,
        dirty: Object.keys(pending).length > 0,
      };
      retryAttempts.current = 0;
      setSync(current.current.dirty ? "saving" : "saved");
      // Migration is a copy. A cloud acknowledgement cannot atomically
      // compare and clear another tab's guest storage or its deletion evidence.
      persist();
    } catch (error) {
      if (generation === epoch.current) {
        if (error instanceof SyncConflictError) {
          try {
            const remote = await readAccount(owner.current!, generation);
            if (generation !== epoch.current) return;
            const merged = reconcileSync(current.current, remote);
            current.current = merged;
            setData(merged.data);
            persist();
            if (merged.conflicts)
              notify(
                `${merged.conflicts} word conflicts were resolved. Review the resulting words.`,
              );
            if (current.current.dirty) {
              setSync("error");
              if (retryAttempts.current < 5) {
                const delay = syncRetryDelay(retryAttempts.current++);
                clearTimeout(retryTimer.current);
                retryTimer.current = setTimeout(
                  () => void flushRef.current(),
                  delay,
                );
              }
            } else {
              retryAttempts.current = 0;
              setSync("saved");
            }
            return;
          } catch {
            // Fall through to the bounded retry path below.
          }
        }
        if (generation !== epoch.current) return;
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setSync(offline ? "offline" : "error");
        notify(
          `Changes remain on this device. ${offline ? "Sync resumes when you reconnect." : "Cloud sync is temporarily unavailable. Retrying safely in the background."}`,
        );
        if (!offline && retryAttempts.current < 5) {
          const delay = syncRetryDelay(retryAttempts.current++);
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => void flushRef.current(), delay);
        }
      }
    } finally {
      if (generation === epoch.current) {
        saving.current = false;
        setData({ ...current.current.data });
      }
    }
  }, [markAttempt, persist, readAccount]);
  flushRef.current = flush;
  useEffect(() => {
    if (!recoveredId) return;
    let disposed = false;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    const waiting = window.setTimeout(() => {
      setRecoveryError("Waiting for exclusive access. If this workspace is open in another tab, close it there.");
    }, 350);
    const open = async () => {
      try {
        if (!navigator.locks) throw new Error("This browser cannot safely open an isolated workspace.");
        await navigator.locks.request(recoveredKey(recoveredId), { signal: controller.signal }, async () => {
          if (disposed) return;
          window.clearTimeout(waiting);
          const saved = loadRecovered(recoveredId);
          await new Promise<void>((done) => {
            release = done;
            recovered.current = saved.metadata;
            current.current = saved.envelope;
            setData(saved.envelope.data);
            setSync("local");
            setRecoveryError("");
            setReady(true);
          });
        });
      } catch (error) {
        window.clearTimeout(waiting);
        if (!disposed) setRecoveryError(error instanceof Error ? error.message : "Workspace could not be opened.");
      }
    };
    void open();
    return () => {
      disposed = true;
      window.clearTimeout(waiting);
      controller.abort();
      recovered.current = null;
      release?.();
    };
  }, [recoveredId]);
  useEffect(() => {
    if (recoveredId) return;
    let disposed = false;
    const switchOwner = async (nextUser: User | null) => {
      if (disposed) return;
      const generation = ++epoch.current;
      initialized.current = true;
      connected.current = false;
      saving.current = false;
      storageReadable.current = !unreadableOwners.current.has(
        nextUser?.id ?? null,
      );
      clearTimeout(saveTimer.current);
      clearTimeout(retryTimer.current);
      retryAttempts.current = 0;
      owner.current = nextUser?.id ?? null;
      setStorageIssue(
        unsaved.current.size
          ? "Changes remain only in this tab. Retry saving or export a backup before closing."
          : "",
      );
      setGuestMigration(null);
      guestForMigration.current = null;
      notify("");
      setUser(nextUser);
      setReady(false);
      setSync(nextUser ? "loading" : "local");
      let local: LocalEnvelope = unsaved.current.get(owner.current) ?? {
        data: emptyData(),
        revision: 0,
        dirty: false,
        pending: {},
      };
      try {
        const stored = loadLocal(owner.current);
        local = unsaved.current.has(owner.current)
          ? reconcilePeer(local, stored)
          : stored;
      } catch (e) {
        const error = e as Error & {
          issues?: Array<{ path?: PropertyKey[]; message: string }>;
        };
        const issue = error.issues?.[0];
        storageReadReason.current = (
          issue ? `${issue.path?.join(".")}: ${issue.message}` : error.message
        ).slice(0, 240);
        storageReadable.current = false;
        unreadableOwners.current.add(owner.current);
        unsaved.current.set(owner.current, local);
        setStorageIssue(
          `Saved data could not be read (${storageReadReason.current}). The original copy is preserved. Do not clear browser storage.`,
        );
        notify(
          `Saved data could not be read: ${(e as Error).message}. The original storage has been preserved.`,
        );
      }
      current.current = local;
      setLastAttemptAt(local.lastAttemptAt ?? null);
      setData(local.data);
      if (nextUser) {
        try {
          markAttempt();
          const remote = await readAccount(nextUser.id, generation);
          if (disposed || generation !== epoch.current) return;
          const latestLocal = current.current;
          let merged = reconcileSync(latestLocal, remote);
          const guest = loadLocal(null).data;
          const guestHasData = hasMeaningfulData(guest);
          const accountHasData =
            hasMeaningfulData(local.data) || hasMeaningfulData(remote.data);
          if (guestHasData && !accountHasData) {
            const imported = mergeData(merged.data, guest);
            merged = reconcileSync({ ...merged, data: imported.data }, remote);
          } else if (guestHasData && accountHasData) {
            guestForMigration.current = guest;
            setGuestMigration({
              pairs: Object.keys(guest.pairs).length,
              solves: guest.solves.filter((solve) => !solve.deleted).length,
            });
          } else {
            guestForMigration.current = null;
          }
          connected.current = true;
          current.current = merged;
          const pending = merged.pending ?? {};
          setData(merged.data);
          setSync(Object.keys(pending).length ? "saving" : "saved");
          if (merged.conflicts)
            notify(
              `${merged.conflicts} word conflicts were resolved. Review them before continuing.`,
            );
          persist();
        } catch {
          if (generation === epoch.current) {
            setSync("error");
            notify(
              "Cloud data could not load. Your device copy is still available. Retry when the connection is stable.",
            );
          }
        }
      }
      if (generation === epoch.current) setReady(true);
    };
    if (!supabase) {
      void switchOwner(null);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setTimeout(() => {
          if (
            !disposed &&
            ((session?.user.id ?? null) !== owner.current ||
              !initialized.current)
          )
            void switchOwner(session?.user ?? null);
        }, 0);
      },
    );
    return () => {
      disposed = true;
      clearTimeout(saveTimer.current);
      clearTimeout(retryTimer.current);
      listener.subscription.unsubscribe();
    };
    // Auth owns account transitions. No data/effect dependency: subscriptions must stay stable.
  }, [markAttempt, persist, recoveredId]);
  useEffect(() => {
    if (sync === "saving" && !saving.current && current.current.dirty) {
      saveTimer.current = setTimeout(() => void flush(), 750);
      return () => clearTimeout(saveTimer.current);
    }
  }, [data, sync, flush]);
  useEffect(() => {
    if (recoveredId) return;
    const changed = (event: StorageEvent) => {
      if (
        event.key !== `cubeiq-bld-v2:${owner.current ?? "guest"}` ||
        !event.newValue
      )
        return;
      try {
        const incoming = loadLocal(owner.current);
        const merged = reconcilePeer(current.current, incoming);
        current.current = merged;
        setData(merged.data);
        // Reconciled data differences are represented by pending operations.
        // Dictionary insertion order must not cause tabs to rebroadcast forever.
        const equalEntries = (
          left: Record<string, unknown> = {},
          right: Record<string, unknown> = {},
        ) =>
          Object.keys(left).length === Object.keys(right).length &&
          Object.entries(left).every(
            ([key, value]) =>
              JSON.stringify(value) === JSON.stringify(right[key]),
          );
        if (
          merged.revision !== incoming.revision ||
          !equalEntries(merged.tombstones, incoming.tombstones) ||
          !equalEntries(merged.pending, incoming.pending)
        )
          persist();
        if (owner.current)
          setSync(
            current.current.dirty && connected.current ? "saving" : "saved",
          );
        if (merged.conflicts)
          notify(
            "Changes from another tab were merged; word conflicts use the most recently updated values.",
          );
      } catch {
        notify(
          "Changes from another tab could not be read. Export a backup before reloading.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [readAccount, recoveredId]);
  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
      if (recoveredId && !recovered.current) return false;
      const previous = current.current.data;
      const next = fn(previous);
      if (next.scheme !== previous.scheme)
        next.schemeHistory = [
          ...(next.schemeHistory ?? []),
          {
            scheme: previous.scheme,
            updatedAt: previous.schemeUpdatedAt,
          },
        ].slice(-20);
      const changes = diffSyncChanges(previous, next);
      if (!changes.length)
        return unsaved.current.has(owner.current) ? persist() : true;
      const tombstones = trackDeletions(
        deletionIndex(current.current),
        changes,
      );
      const safeNext = applyTombstones(next, tombstones);
      const pending = owner.current
        ? coalesceSyncChanges(
            current.current.pending,
            changes.filter(
              (change) =>
                change.deleted ||
                !tombstones[`${change.kind}:${change.recordId}`],
            ),
          )
        : {};

      current.current = {
        ...current.current,
        data: safeNext,
        tombstones,
        pending,
        dirty: !!owner.current && Object.keys(pending).length > 0,
      };
      setData(safeNext);
      if (owner.current)
        setSync(
          connected.current
            ? navigator.onLine
              ? "saving"
              : "offline"
            : "error",
        );
      return persist();
    },
    [persist, recoveredId],
  );
  const retry = async () => {
    if (!owner.current) {
      markAttempt();
      setSync("error");
      notify(
        "Sync could not start because there is no authenticated account. Sign in again.",
      );
      return;
    }
    if (saving.current) {
      notify("A sync attempt is already in progress.");
      return;
    }
    const generation = epoch.current;
    markAttempt();
    setSync("loading");
    try {
      const remote = await readAccount(owner.current, generation);
      if (generation !== epoch.current) return;
      const merged = reconcileSync(current.current, remote);
      connected.current = true;
      current.current = merged;
      setData(merged.data);
      persist();
      if (merged.conflicts)
        notify(
          `${merged.conflicts} word conflicts were resolved. Review the resulting words.`,
        );
      retryAttempts.current = 0;
      if (current.current.dirty) await flush();
      else setSync("saved");
    } catch {
      if (generation === epoch.current) {
        setSync("error");
        notify(
          "Cloud sync is temporarily unavailable. Your device copy is still available.",
        );
      }
    }
  };
  const retryStorage = () => {
    if (!storageReadable.current) {
      try {
        const stored = loadLocal(owner.current);
        // The temporary fallback is not an authoritative saved setup. On equal
        // legacy timestamps keep the recovered scheme/preferences, while merging
        // genuinely newer edits and history retained in this tab.
        current.current = reconcilePeer(stored, current.current);
        setData(current.current.data);
        storageReadable.current = true;
        unreadableOwners.current.delete(owner.current);
      } catch {
        return; // Never replace an unreadable original with a default document.
      }
    }
    if (!persist()) return;
    if (!owner.current) setSync("local");
    else if (connected.current && current.current.dirty) {
      if (navigator.onLine) void flushRef.current();
      else setSync("offline");
    }
  };
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!unsaved.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, []);
  useEffect(() => {
    const online = () => {
      retryAttempts.current = 0;
      if (!owner.current) return;
      if (connected.current) {
        if (current.current.dirty) setSync("saving");
      } else void retry();
    };
    const offline = () => {
      clearTimeout(retryTimer.current);
      if (owner.current && current.current.dirty) setSync("offline");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
    // Account ownership is held in refs so listeners remain stable.
  }, [flush]);
  const resolveGuestMigration = useCallback(
    (choice: "merge" | "account") => {
      const guest = guestForMigration.current;
      guestForMigration.current = null;
      setGuestMigration(null);
      if (choice !== "merge" || !guest || !owner.current) return;
      const merged = mergeData(current.current.data, guest);
      update(() => merged.data);
      if (merged.conflicts)
        notify(
          `${merged.conflicts} word conflicts were resolved. Review the resulting words.`,
        );
    },
    [update],
  );
  return (
    <Context.Provider
      value={{
        data,
        user,
        ready,
        sync: storageIssue ? "error" : sync,
        lastAttemptAt,
        message,
        storageIssue,
        retryStorage,
        recoveryEnvelope: () => current.current,
        durableRecovery: () => {
          if (!ready || !storageReadable.current || unsaved.current.has(owner.current))
            throw new Error("Save the current workspace before exporting its durable backup.");
          if (recoveredId) {
            const saved = loadRecovered(recoveredId);
            return { envelope: saved.envelope, legacyIncomplete: saved.metadata.legacyIncomplete };
          }
          return { envelope: loadLocal(owner.current), legacyIncomplete: false };
        },
        workspaceIdentity: () => recoveredId ? recoveredKey(recoveredId) : `owner:${owner.current ?? "guest"}:${epoch.current}`,
        readLegacyRecovery: (account) => {
          const generation = epoch.current;
          return loadLegacyRecovery({
            owner: account,
            isCurrent: () => !recoveredId && owner.current === account && epoch.current === generation,
          });
        },
        recoveredId,
        recoveryError,
        notify,
        update,
        retry: () => void retry(),
        focus,
        setFocus,
        guestMigration,
        resolveGuestMigration,
      }}
    >
      {children}
    </Context.Provider>
  );
}

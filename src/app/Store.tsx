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
import {
  emptyData,
  loadLocal,
  saveLocal,
  loadCloud,
  saveCloudChanges,
  mergeData,
  coalesceSyncChanges,
  diffSyncChanges,
  seedSyncChanges,
  syncRetryDelay,
  SyncConflictError,
  type AppData,
  type LocalEnvelope,
} from "../lib/repository";
import type { LetterPair } from "../domain/letterPairs";
import { pairKey } from "../domain/letterPairs";

type SyncState = "local" | "loading" | "saving" | "saved" | "offline" | "error";
interface StoreValue {
  data: AppData;
  user: User | null;
  ready: boolean;
  sync: SyncState;
  lastAttemptAt: string | null;
  message: string;
  notify: (s: string) => void;
  update: (fn: (d: AppData) => AppData) => void;
  upsertPair: (p: LetterPair) => void;
  retry: () => void;
  importData: (data: AppData) => void;
  focus: boolean;
  setFocus: (focus: boolean) => void;
}
const Context = createContext<StoreValue | null>(null);
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing app store");
  return ctx;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(emptyData),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [sync, setSync] = useState<SyncState>("loading"),
    [lastAttemptAt, setLastAttemptAt] = useState<string | null>(null),
    [message, notify] = useState(""),
    [focus, setFocus] = useState(false);
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
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const storageReadable = useRef(true);
  const persist = useCallback(() => {
    try {
      if (!storageReadable.current)
        throw new Error("Original data requires recovery");
      saveLocal(owner.current, current.current);
      return true;
    } catch {
      setSync("error");
      notify(
        "Browser storage is full or unavailable. Export a backup before closing this tab.",
      );
      return false;
    }
  }, []);
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
      const revision = await saveCloudChanges(batch, snapshot.revision);
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
      persist();
    } catch (e) {
      if (generation === epoch.current) {
        let failure = e;
        if (e instanceof SyncConflictError) {
          try {
            const remote = await loadCloud();
            if (generation !== epoch.current) return;
            const merged = mergeData(current.current.data, remote.data);
            const pending = coalesceSyncChanges(
              current.current.pending,
              diffSyncChanges(remote.data, merged.data),
            );
            current.current = {
              data: merged.data,
              revision: remote.revision,
              pending,
              dirty: Object.keys(pending).length > 0,
            };
            setData(merged.data);
            persist();
            if (merged.conflicts)
              notify(
                `${merged.conflicts} differing mnemonics were preserved as alternates.`,
              );
            retryAttempts.current = 0;
            setSync(current.current.dirty ? "saving" : "saved");
            return;
          } catch (reloadError) {
            failure = reloadError;
          }
        }
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setSync(offline ? "offline" : "error");
        notify(
          `Changes remain on this device. ${(failure as Error).message}.${offline ? " Sync resumes when you reconnect." : " Retrying safely in the background."}`,
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
  }, [markAttempt, persist]);
  flushRef.current = flush;
  useEffect(() => {
    let disposed = false;
    const switchOwner = async (nextUser: User | null) => {
      if (disposed) return;
      const generation = ++epoch.current;
      initialized.current = true;
      connected.current = false;
      saving.current = false;
      storageReadable.current = true;
      clearTimeout(saveTimer.current);
      clearTimeout(retryTimer.current);
      retryAttempts.current = 0;
      owner.current = nextUser?.id ?? null;
      notify("");
      setUser(nextUser);
      setReady(false);
      setSync(nextUser ? "loading" : "local");
      let local: LocalEnvelope = {
        data: emptyData(),
        revision: 0,
        dirty: false,
        pending: {},
      };
      try {
        local = loadLocal(owner.current);
      } catch (e) {
        storageReadable.current = false;
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
          const remote = await loadCloud();
          if (disposed || generation !== epoch.current) return;
          const merged = mergeData(local.data, remote.data);
          const pending = coalesceSyncChanges(
            local.pending,
            remote.pending === undefined
              ? seedSyncChanges(merged.data)
              : diffSyncChanges(remote.data, merged.data),
          );
          connected.current = true;
          current.current = {
            data: merged.data,
            revision: remote.revision,
            pending,
            dirty: Object.keys(pending).length > 0,
          };
          setData(merged.data);
          setSync(Object.keys(pending).length ? "saving" : "saved");
          if (merged.conflicts)
            notify(
              `${merged.conflicts} differing mnemonics were preserved as alternates. Review them before continuing.`,
            );
          persist();
        } catch (e) {
          if (generation === epoch.current) {
            setSync("error");
            notify(
              `Cloud data could not load: ${(e as Error).message}. Your device copy is still available.`,
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
  }, [markAttempt, persist]);
  useEffect(() => {
    if (sync === "saving" && !saving.current && current.current.dirty) {
      saveTimer.current = setTimeout(() => void flush(), 750);
      return () => clearTimeout(saveTimer.current);
    }
  }, [data, sync, flush]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        event.key !== `cubeiq-bld-v2:${owner.current ?? "guest"}` ||
        !event.newValue
      )
        return;
      try {
        const incoming = loadLocal(owner.current);
        const merged = mergeData(current.current.data, incoming.data);
        const pending = coalesceSyncChanges(
          coalesceSyncChanges(
            current.current.pending,
            Object.values(incoming.pending ?? {}),
          ),
          diffSyncChanges(current.current.data, merged.data),
        );
        current.current = {
          data: merged.data,
          revision: Math.max(current.current.revision, incoming.revision),
          pending,
          dirty: Object.keys(pending).length > 0,
        };
        setData(merged.data);
        if (owner.current)
          setSync(
            current.current.dirty && connected.current ? "saving" : "saved",
          );
        if (merged.conflicts)
          notify(
            "Changes from another tab were merged; differing words are preserved as alternates.",
          );
      } catch {
        notify(
          "Changes from another tab could not be read. Export a backup before reloading.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const update = useCallback(
    (fn: (d: AppData) => AppData) => {
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
      const changes = owner.current ? diffSyncChanges(previous, next) : [];
      const pending = coalesceSyncChanges(current.current.pending, changes);
      current.current = {
        ...current.current,
        data: next,
        pending,
        dirty: !!owner.current && Object.keys(pending).length > 0,
      };
      setData(next);
      if (owner.current)
        setSync(
          connected.current
            ? navigator.onLine
              ? "saving"
              : "offline"
            : "error",
        );
      persist();
    },
    [persist],
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
      const remote = await loadCloud();
      if (generation !== epoch.current) return;
      const merged = mergeData(current.current.data, remote.data);
      const pending = coalesceSyncChanges(
        current.current.pending,
        remote.pending === undefined
          ? seedSyncChanges(merged.data)
          : diffSyncChanges(remote.data, merged.data),
      );
      connected.current = true;
      current.current = {
        data: merged.data,
        revision: remote.revision,
        pending,
        dirty: Object.keys(pending).length > 0,
      };
      setData(merged.data);
      persist();
      if (merged.conflicts)
        notify(
          `${merged.conflicts} differences preserved as alternate mnemonics.`,
        );
      retryAttempts.current = 0;
      if (current.current.dirty) await flush();
      else setSync("saved");
    } catch (e) {
      if (generation === epoch.current) {
        setSync("error");
        notify((e as Error).message);
      }
    }
  };
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
  const upsertPair = useCallback(
    (pair: LetterPair) =>
      update((d) => ({
        ...d,
        pairs: {
          ...d.pairs,
          [pairKey(pair.firstStickerId, pair.secondStickerId)]: pair,
        },
      })),
    [update],
  );
  const importData = (incoming: AppData) => {
    const result = mergeData(current.current.data, incoming);
    update(() => result.data);
    notify(
      `Backup merged. ${result.conflicts} differing mnemonics preserved as alternates.`,
    );
  };
  return (
    <Context.Provider
      value={{
        data,
        user,
        ready,
        sync,
        lastAttemptAt,
        message,
        notify,
        update,
        upsertPair,
        retry: () => void retry(),
        importData,
        focus,
        setFocus,
      }}
    >
      {children}
    </Context.Provider>
  );
}

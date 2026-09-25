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
  saveCloud,
  mergeData,
  type AppData,
  type LocalEnvelope,
} from "../lib/repository";
import type { LetterPair } from "../domain/letterPairs";
import { pairKey } from "../domain/letterPairs";

type SyncState = "local" | "loading" | "saving" | "saved" | "error";
interface StoreValue {
  data: AppData;
  user: User | null;
  ready: boolean;
  sync: SyncState;
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
    [message, notify] = useState(""),
    [focus, setFocus] = useState(false);
  const current = useRef<LocalEnvelope>({
      data: emptyData(),
      dirty: false,
      revision: 0,
    }),
    owner = useRef<string | null>(null),
    epoch = useRef(0),
    saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    saving = useRef(false),
    connected = useRef(false),
    initialized = useRef(false);
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
  const flush = useCallback(async () => {
    if (
      !owner.current ||
      !connected.current ||
      saving.current ||
      !current.current.dirty
    )
      return;
    const generation = epoch.current,
      snapshot = current.current;
    saving.current = true;
    setSync("saving");
    try {
      const revision = await saveCloud(snapshot.data, snapshot.revision);
      if (generation !== epoch.current) return;
      current.current = {
        ...current.current,
        revision,
        dirty: current.current.data !== snapshot.data,
      };
      setSync(current.current.dirty ? "saving" : "saved");
      persist();
    } catch (e) {
      if (generation === epoch.current) {
        setSync("error");
        notify(
          `Changes remain on this device. ${(e as Error).message}. Use Retry sync in Settings.`,
        );
      }
    } finally {
      if (generation === epoch.current) {
        saving.current = false;
        setData({ ...current.current.data });
      }
    }
  }, [persist]);
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
      owner.current = nextUser?.id ?? null;
      notify("");
      setUser(nextUser);
      setReady(false);
      setSync(nextUser ? "loading" : "local");
      let local: LocalEnvelope = {
        data: emptyData(),
        revision: 0,
        dirty: false,
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
      setData(local.data);
      if (nextUser) {
        try {
          const remote = await loadCloud();
          if (disposed || generation !== epoch.current) return;
          const merged = mergeData(local.data, remote.data);
          connected.current = true;
          current.current = {
            data: merged.data,
            revision: remote.revision,
            dirty: local.dirty,
          };
          setData(merged.data);
          setSync(local.dirty ? "saving" : "saved");
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
      listener.subscription.unsubscribe();
    };
    // Auth owns account transitions. No data/effect dependency: subscriptions must stay stable.
  }, [persist]);
  useEffect(() => {
    if (sync === "saving" && !saving.current && current.current.dirty) {
      saveTimer.current = setTimeout(() => void flush(), 500);
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
        current.current = {
          data: merged.data,
          revision: Math.max(current.current.revision, incoming.revision),
          dirty: current.current.dirty || incoming.dirty,
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
      const next = fn(current.current.data);
      if (next.scheme !== current.current.data.scheme)
        next.schemeHistory = [
          ...(next.schemeHistory ?? []),
          {
            scheme: current.current.data.scheme,
            updatedAt: current.current.data.schemeUpdatedAt,
          },
        ].slice(-20);
      current.current = {
        ...current.current,
        data: next,
        dirty: !!owner.current,
      };
      setData(next);
      if (owner.current) setSync(connected.current ? "saving" : "error");
      persist();
    },
    [persist],
  );
  const retry = async () => {
    if (!owner.current || saving.current) return;
    const generation = epoch.current;
    setSync("loading");
    try {
      const remote = await loadCloud();
      if (generation !== epoch.current) return;
      const merged = mergeData(current.current.data, remote.data);
      connected.current = true;
      current.current = {
        data: merged.data,
        revision: remote.revision,
        dirty: true,
      };
      setData(merged.data);
      persist();
      if (merged.conflicts)
        notify(
          `${merged.conflicts} differences preserved as alternate mnemonics.`,
        );
      await flush();
    } catch (e) {
      if (generation === epoch.current) {
        setSync("error");
        notify((e as Error).message);
      }
    }
  };
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

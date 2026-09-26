import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useStore } from "../../app/Store";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { pairKey as physicalPairKey } from "../../domain/letterPairs";
import type { SolveRecord } from "../../lib/repository";
import type {
  Account,
  BldSetup,
  CubeViewPref,
  PairDb,
  PairEntry,
  PairScope,
  Prefs,
  SyncStatus,
} from "../types/app";
import type { LetterPairDb, Solve } from "../types/solve";
import { pairKey, splitKey, toTimerDb } from "../utils/pairs";
import { ALL_STICKERS, speffzScheme } from "../utils/scheme";
import { supabase } from "../../lib/supabase";

type NavGuard = ((path: string) => boolean) | null;
interface AppDataValue {
  pairs: PairDb;
  savePair: (key: string, entry: PairEntry | null) => void;
  addWord: (key: string, scope: PairScope, word: string) => void;
  usage: Record<string, number>;
  timerDb: LetterPairDb;
  applyTimerDbUpdates: (updates: LetterPairDb) => void;
  solves: Solve[];
  setSolves: React.Dispatch<React.SetStateAction<Solve[]>>;
  sessions: Array<{ id: string; name: string }>;
  activeSessionId: string;
  sessionCounts: Record<string, number>;
  setActiveSession: (id: string) => void;
  createSession: (name: string) => string;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  setup: BldSetup;
  saveSetup: (setup: BldSetup) => void;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  account: Account;
  setAccount: (a: Account) => void;
  replacePairs: (db: PairDb) => void;
  navGuard: NavGuard;
  setNavGuard: (g: NavGuard) => void;
}
const AppDataContext = createContext<AppDataValue | null>(null);
const canonical = createSpeffzScheme();
const magicSpeffz = speffzScheme();
const MAGIC_TO_PHYSICAL = Object.fromEntries(
  ALL_STICKERS.map((slot) => {
    const token = magicSpeffz[slot.id];
    const physical = Object.values(canonical.stickers).find(
      (s) => s.pieceType === slot.type && s.label === token,
    );
    return [slot.id, physical!.id];
  }),
);
const PHYSICAL_TO_MAGIC = Object.fromEntries(
  Object.entries(MAGIC_TO_PHYSICAL).map(([a, b]) => [b, a]),
);

export const defaultSetup = (): BldSetup => ({
  scheme: speffzScheme(),
  schemeName: "Speffz",
  edgeBuffer: PHYSICAL_TO_MAGIC[canonical.edgeBuffer],
  cornerBuffer: PHYSICAL_TO_MAGIC[canonical.cornerBuffer],
  edgeMethod: "m2",
  cornerMethod: "op",
  flippedEdges: "cycle",
  twistedCorners: "cycle",
});
function setupFromStore(data: ReturnType<typeof useStore>["data"]): BldSetup {
  const s = data.scheme;
  return {
    scheme: Object.fromEntries(
      Object.entries(MAGIC_TO_PHYSICAL).map(([slot, id]) => [
        slot,
        s.stickers[id]?.label ?? magicSpeffz[slot],
      ]),
    ),
    schemeName: s.name,
    edgeBuffer: PHYSICAL_TO_MAGIC[s.edgeBuffer] ?? defaultSetup().edgeBuffer,
    cornerBuffer:
      PHYSICAL_TO_MAGIC[s.cornerBuffer] ?? defaultSetup().cornerBuffer,
    edgeMethod:
      s.edgeMethod === "m2"
        ? "m2"
        : s.edgeMethod === "3style"
          ? "3style"
          : "op",
    cornerMethod: s.cornerMethod === "3style" ? "3style" : "op",
    flippedEdges: data.flippedEdges ?? "cycle",
    twistedCorners: data.twistedCorners ?? "cycle",
  };
}
function pairsFromStore(data: ReturnType<typeof useStore>["data"]): PairDb {
  const out: PairDb = {};
  Object.values(data.pairs).forEach((p) => {
    const type = data.scheme.stickers[p.firstStickerId]?.pieceType;
    const key = pairKey(p.firstToken, p.secondToken),
      words = [p.primaryMnemonic, ...p.alternates].filter(Boolean);
    const previous = out[key] ?? { shared: [] };
    if ((data.pairSharing ?? "shared") === "shared")
      out[key] = {
        ...previous,
        shared: previous.shared.length ? previous.shared : words,
      };
    else
      out[key] = {
        ...previous,
        [type === "edge" ? "edges" : "corners"]: words,
      };
  });
  return out;
}
function solveFromStore(s: SolveRecord, index: number): Solve {
  const make = (kind: "corners" | "edges") => {
    const snapshot = s.memoSnapshot?.[kind];
    if (snapshot)
      return snapshot.map((p) => ({
        pair: `${p.firstToken}${p.secondToken ?? ""}`,
        word: p.mnemonic,
      }));
    const tokens = kind === "corners" ? s.cornerMemo : s.edgeMemo;
    return Array.from({ length: Math.ceil(tokens.length / 2) }, (_, i) => ({
      pair: (tokens[i * 2] ?? "") + (tokens[i * 2 + 1] ?? ""),
      word: "",
    }));
  };
  const c = s.memoSnapshot?.corners ?? [],
    e = s.memoSnapshot?.edges ?? [];
  const cb = c.findIndex((p) => p.firstCycleBreak || p.secondCycleBreak),
    eb = e.findIndex((p) => p.firstCycleBreak || p.secondCycleBreak);
  return {
    id: s.id,
    index,
    time: s.totalMs,
    memoTime: s.multiphase === false ? undefined : s.memoMs,
    penalty: s.result === "success" ? "ok" : s.result,
    scramble: s.scramble,
    date: s.createdAt,
    memo: {
      corners: make("corners"),
      edges: make("edges"),
      ...(cb >= 0 ? { cornerBreakAt: cb * 2 } : {}),
      ...(eb >= 0 ? { edgeBreakAt: eb * 2 } : {}),
    },
  };
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const store = useStore(),
    data = store.data;
  const [navGuard, setNavGuardState] = useState<NavGuard>(null);
  const pairs = useMemo(() => pairsFromStore(data), [data]);
  const setup = useMemo(() => setupFromStore(data), [data]);
  const sessions = useMemo(
    () =>
      data.timerSessions?.length
        ? data.timerSessions
        : [
            {
              id: "today",
              name: "Today",
              createdAt: new Date(0).toISOString(),
            },
          ],
    [data.timerSessions],
  );
  const activeSessionId = sessions.some(
    (s) => s.id === data.activeTimerSessionId,
  )
    ? data.activeTimerSessionId!
    : sessions[0].id;
  const solves = useMemo(
    () =>
      data.solves
        .filter(
          (s) => !s.deleted && (s.sessionId ?? "today") === activeSessionId,
        )
        .map((s, i, all) => solveFromStore(s, all.length - i)),
    [data.solves, activeSessionId],
  );
  const sessionCounts = useMemo(
    () =>
      Object.fromEntries(
        sessions.map((s) => [
          s.id,
          data.solves.filter(
            (solve) => !solve.deleted && (solve.sessionId ?? "today") === s.id,
          ).length,
        ]),
      ),
    [data.solves, sessions],
  );
  const usage = useMemo(() => {
    const result: Record<string, number> = {};
    Object.values(data.pairs).forEach((p) => {
      const key = pairKey(p.firstToken, p.secondToken);
      result[key] = (result[key] ?? 0) + p.encounters;
    });
    return result;
  }, [data.pairs]);
  const prefs: Prefs = {
    sharing: data.pairSharing ?? "shared",
    multiphase: data.multiphaseTiming,
    defaultView: data.defaultCubeView ?? { top: "white", front: "green" },
  };
  const writeEntry = useCallback(
    (key: string, entry: PairEntry | null) => {
      const [first, second] = splitKey(key);
      store.update((current) => {
        const next = { ...current.pairs };
        (["edge", "corner"] as const).forEach((type) => {
          const a = Object.values(current.scheme.stickers).find(
            (s) => s.pieceType === type && s.label === first,
          );
          const b = Object.values(current.scheme.stickers).find(
            (s) => s.pieceType === type && s.label === second,
          );
          if (!a || !b) return;
          const id = physicalPairKey(a.id, b.id),
            scoped = type === "edge" ? entry?.edges : entry?.corners;
          const words = scoped?.length ? scoped : (entry?.shared ?? []);
          if (!entry || !words.length) {
            delete next[id];
            return;
          }
          const old = next[id];
          next[id] = {
            id: old?.id ?? crypto.randomUUID(),
            firstStickerId: a.id,
            secondStickerId: b.id,
            firstToken: first,
            secondToken: second,
            primaryMnemonic: words[0],
            alternates: words.slice(1),
            encounters: old?.encounters ?? 0,
            forgotten: old?.forgotten ?? 0,
            updatedAt: new Date().toISOString(),
          };
        });
        return { ...current, pairs: next };
      });
    },
    [store],
  );
  const saveSetup = useCallback(
    (draft: BldSetup) =>
      store.update((current) => {
        const stickers = Object.fromEntries(
          Object.entries(current.scheme.stickers).map(([id, sticker]) => [
            id,
            { ...sticker },
          ]),
        );
        Object.entries(MAGIC_TO_PHYSICAL).forEach(([slot, id]) => {
          if (stickers[id]) stickers[id].label = draft.scheme[slot];
        });
        return {
          ...current,
          scheme: {
            ...current.scheme,
            name: draft.schemeName,
            stickers,
            edgeBuffer:
              MAGIC_TO_PHYSICAL[draft.edgeBuffer] ?? current.scheme.edgeBuffer,
            cornerBuffer:
              MAGIC_TO_PHYSICAL[draft.cornerBuffer] ??
              current.scheme.cornerBuffer,
            edgeMethod:
              draft.edgeMethod === "op" ? "old-pochmann" : draft.edgeMethod,
            cornerMethod:
              draft.cornerMethod === "op" ? "old-pochmann" : draft.cornerMethod,
          },
          flippedEdges: draft.flippedEdges,
          twistedCorners: draft.twistedCorners,
          schemeUpdatedAt: new Date().toISOString(),
          onboarded: true,
        };
      }),
    [store],
  );
  const setSolves: React.Dispatch<React.SetStateAction<Solve[]>> = useCallback(
    (action) => {
      const next = typeof action === "function" ? action(solves) : action,
        byId = new Map(next.map((s) => [s.id, s]));
      store.update((current) => ({
        ...current,
        solves: current.solves.map((s) => {
          const view = byId.get(s.id);
          if (!view)
            return { ...s, deleted: true, updatedAt: new Date().toISOString() };
          return {
            ...s,
            totalMs: view.time,
            executionMs: Math.max(0, view.time - (view.memoTime ?? 0)),
            memoMs: view.memoTime ?? 0,
            result: view.penalty === "ok" ? "success" : view.penalty,
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
    },
    [solves, store],
  );
  const setActiveSession = useCallback(
    (id: string) => store.update((d) => ({ ...d, activeTimerSessionId: id })),
    [store],
  );
  const createSession = useCallback(
    (name: string) => {
      const id = crypto.randomUUID();
      store.update((d) => ({
        ...d,
        timerSessions: [
          ...(d.timerSessions?.length
            ? d.timerSessions
            : [
                {
                  id: "today",
                  name: "Today",
                  createdAt: new Date(0).toISOString(),
                },
              ]),
          {
            id,
            name: name.trim() || "Untitled",
            createdAt: new Date().toISOString(),
          },
        ],
        activeTimerSessionId: id,
      }));
      return id;
    },
    [store],
  );
  const renameSession = useCallback(
    (id: string, name: string) => {
      if (name.trim())
        store.update((d) => ({
          ...d,
          timerSessions: (d.timerSessions ?? []).map((s) =>
            s.id === id ? { ...s, name: name.trim() } : s,
          ),
        }));
    },
    [store],
  );
  const deleteSession = useCallback(
    (id: string) =>
      store.update((d) => {
        const remaining = (d.timerSessions ?? []).filter((s) => s.id !== id);
        const next = remaining.length
          ? remaining
          : [
              {
                id: "today",
                name: "Today",
                createdAt: new Date().toISOString(),
              },
            ];
        return {
          ...d,
          timerSessions: next,
          activeTimerSessionId:
            d.activeTimerSessionId === id ? next[0].id : d.activeTimerSessionId,
          solves: d.solves.map((s) =>
            (s.sessionId ?? "today") === id
              ? { ...s, deleted: true, updatedAt: new Date().toISOString() }
              : s,
          ),
        };
      }),
    [store],
  );
  const setPrefs = useCallback(
    (p: Partial<Prefs>) =>
      store.update((d) => ({
        ...d,
        pairSharing: p.sharing ?? d.pairSharing ?? "shared",
        multiphaseTiming: p.multiphase ?? d.multiphaseTiming,
        defaultCubeView: p.defaultView ??
          d.defaultCubeView ?? { top: "white", front: "green" },
        preferencesUpdatedAt: new Date().toISOString(),
      })),
    [store],
  );
  const accountStatus: SyncStatus =
    store.sync === "saved"
      ? "idle"
      : store.sync === "error"
        ? "failed"
        : store.sync === "loading"
          ? "saving"
          : store.sync;
  const value: AppDataValue = {
    pairs,
    savePair: writeEntry,
    addWord: (key, scope, word) => {
      const entry = pairs[key] ?? { shared: [] },
        list = scope === "shared" ? entry.shared : (entry[scope] ?? []);
      writeEntry(key, {
        ...entry,
        [scope]: [word, ...list.filter((v) => v !== word)],
      });
    },
    usage,
    timerDb: toTimerDb(pairs),
    applyTimerDbUpdates: (updates) =>
      Object.entries(updates).forEach(([flat, words]) =>
        writeEntry(pairKey(flat[0], flat.slice(1)), { shared: words }),
      ),
    solves,
    setSolves,
    sessions: sessions.map(({ id, name }) => ({ id, name })),
    activeSessionId,
    sessionCounts,
    setActiveSession,
    createSession,
    renameSession,
    deleteSession,
    setup,
    saveSetup,
    prefs,
    setPrefs,
    account: store.user
      ? {
          provider:
            store.user.app_metadata.provider === "google" ? "google" : "wca",
          name: String(
            store.user.user_metadata.full_name ??
              store.user.user_metadata.name ??
              store.user.email ??
              "Signed in",
          ),
          detail: String(
            store.user.user_metadata.wca_id ?? store.user.email ?? "",
          ),
          status: accountStatus,
        }
      : {
          provider: null,
          name: "",
          detail: "",
          status: !supabase ? "unconfigured" : "local",
        },
    setAccount: (account) => {
      if (!supabase) return;
      if (!account.provider) void supabase.auth.signOut();
      else if (account.status === "saving") store.retry();
    },
    replacePairs: (db) =>
      Object.entries(db).forEach(([key, entry]) => writeEntry(key, entry)),
    navGuard,
    setNavGuard: (g) => setNavGuardState(() => g),
  };
  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}
export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}

export const LOCAL_ACCOUNT: Account = {
  provider: null,
  name: "",
  detail: "",
  status: "local",
};
export const SAMPLE_ACCOUNTS = {
  wca: { provider: "wca", name: "WCA account", detail: "" },
  google: { provider: "google", name: "Google account", detail: "" },
} as const;

export function useDefaultView(): CubeViewPref {
  return (
    useContext(AppDataContext)?.prefs.defaultView ?? {
      top: "white",
      front: "green",
    }
  );
}

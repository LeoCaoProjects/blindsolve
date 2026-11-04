import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import type { Feedback, NewFeedback } from "../types/feedback";
import {
  deleteFeedback as deleteFeedbackRemote,
  feedbackAdmin,
  listFeedback,
  submitFeedback as submitFeedbackRemote,
  updateFeedback as updateFeedbackRemote,
} from "../../lib/feedback";

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
  retrySync: () => void;
  syncMessage: string;
  replacePairs: React.Dispatch<React.SetStateAction<PairDb>>;
  navGuard: NavGuard;
  setNavGuard: (g: NavGuard) => void;
  feedback: Feedback[];
  submitFeedback: (feedback: NewFeedback) => Promise<Feedback>;
  updateFeedback: (
    id: string,
    patch: Partial<Pick<Feedback, "status" | "note">>,
  ) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
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
export const magicStickerForPhysical = (stickerId: string) =>
  PHYSICAL_TO_MAGIC[stickerId];

export const defaultSetup = (): BldSetup => ({
  scheme: speffzScheme(),
  schemeName: "Speffz",
  edgeBuffer: PHYSICAL_TO_MAGIC[canonical.edgeBuffer],
  cornerBuffer: PHYSICAL_TO_MAGIC[canonical.cornerBuffer],
  edgeMethod: "m2",
  cornerMethod: "op",
});
export function setupFromStore(
  data: ReturnType<typeof useStore>["data"],
): BldSetup {
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
    // Legacy unsupported values remain persisted; only the active view falls back.
    edgeMethod: s.edgeMethod === "m2" ? "m2" : "op",
    cornerMethod: "op",
  };
}
export function pairsFromStore(
  data: ReturnType<typeof useStore>["data"],
): PairDb {
  const gathered: Record<string, { edges?: string[]; corners?: string[] }> = {};
  Object.values(data.pairs).forEach((p) => {
    const type = data.scheme.stickers[p.firstStickerId]?.pieceType;
    const key = pairKey(p.firstToken, p.secondToken),
      words = [p.primaryMnemonic, ...p.alternates].filter(Boolean);
    gathered[key] = {
      ...gathered[key],
      [type === "edge" ? "edges" : "corners"]: words,
    };
  });
  return Object.fromEntries(
    Object.entries(gathered).map(([key, value]) => {
      const edge = value.edges,
        corner = value.corners;
      if (edge && corner && JSON.stringify(edge) === JSON.stringify(corner))
        return [key, { shared: edge }];
      if (edge && corner) return [key, { shared: edge, corners: corner }];
      // Retired one-vocabulary data used lone physical records as shared. New edits
      // switch the hidden storage discriminator to separate, avoiding ambiguity.
      if ((data.pairSharing ?? "shared") === "shared" && (edge || corner))
        return [key, { shared: edge ?? corner! }];
      return [
        key,
        {
          shared: [],
          ...(edge ? { edges: edge } : {}),
          ...(corner ? { corners: corner } : {}),
        },
      ];
    }),
  );
}
export function solveFromStore(s: SolveRecord, index: number): Solve {
  let hasExecutionTargets = false;
  const make = (kind: "corners" | "edges") => {
    const snapshot = s.memoSnapshot?.[kind];
    if (snapshot) {
      const sectionHasExecution =
        kind === "edges" &&
        snapshot.some((p) => {
          const rawFirst =
              s.schemeSnapshot?.stickers[p.firstStickerId]?.label ??
              p.firstToken,
            rawSecond = p.secondStickerId
              ? (s.schemeSnapshot?.stickers[p.secondStickerId]?.label ??
                p.secondToken ??
                "")
              : "";
          return Boolean(
            p.firstExecutionStickerId ||
            p.secondExecutionStickerId ||
            (p.firstExecutionToken ?? p.firstToken) !== rawFirst ||
            (p.secondExecutionToken ?? p.secondToken ?? "") !== rawSecond,
          );
        });
      hasExecutionTargets ||= sectionHasExecution;
      return snapshot.map((p) => {
        const rawFirst =
            s.schemeSnapshot?.stickers[p.firstStickerId]?.label ?? p.firstToken,
          rawSecond = p.secondStickerId
            ? (s.schemeSnapshot?.stickers[p.secondStickerId]?.label ??
              p.secondToken ??
              "")
            : "",
          first = p.firstExecutionToken ?? p.firstToken,
          second = p.secondExecutionToken ?? p.secondToken ?? "";
        return {
          pair: `${sectionHasExecution ? first : rawFirst}${
            sectionHasExecution ? second : rawSecond
          }`,
          word: p.mnemonic,
        };
      });
    }
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
      ...(s.schemeSnapshot?.edgeMethod === "m2" && s.edgeMemo.length % 2 === 1
        ? { hasM2Parity: true }
        : {}),
      targetRepresentation: hasExecutionTargets ? "m2-execution" : "raw",
    },
  };
}

/** Apply only explicit view changes; don't retimestamp untouched or newly hydrated solves. */
export function applySolveViews(
  records: SolveRecord[],
  before: Solve[],
  after: Solve[],
  sessionId: string,
  updatedAt = new Date().toISOString(),
) {
  const known = new Set(before.map((solve) => solve.id));
  const next = new Map(after.map((solve) => [solve.id, solve]));
  return records.map((record) => {
    if ((record.sessionId ?? "today") !== sessionId || !known.has(record.id))
      return record;
    const view = next.get(record.id);
    if (!view)
      return record.deleted ? record : { ...record, deleted: true, updatedAt };
    const result: SolveRecord["result"] =
      view.penalty === "ok" ? "success" : view.penalty;
    const memoMs = view.memoTime ?? 0;
    const executionMs = Math.max(0, view.time - memoMs);
    if (
      record.totalMs === view.time &&
      record.memoMs === memoMs &&
      record.executionMs === executionMs &&
      record.result === result
    )
      return record;
    return {
      ...record,
      totalMs: view.time,
      memoMs,
      executionMs,
      result,
      updatedAt,
    };
  });
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const store = useStore(),
    data = store.data;
  const [navGuard, setNavGuardState] = useState<NavGuard>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const pairs = useMemo(
    () => pairsFromStore(data),
    [data.pairs, data.scheme, data.pairSharing],
  );
  const setup = useMemo(() => setupFromStore(data), [data.scheme]);
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
  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      sessions.map((session) => [session.id, 0]),
    );
    for (const solve of data.solves)
      if (!solve.deleted) {
        const id = solve.sessionId ?? "today";
        counts[id] = (counts[id] ?? 0) + 1;
      }
    return counts;
  }, [data.solves, sessions]);
  const usage = useMemo(() => {
    const result: Record<string, number> = {};
    Object.values(data.pairs).forEach((p) => {
      const key = pairKey(p.firstToken, p.secondToken);
      result[key] = (result[key] ?? 0) + p.encounters;
    });
    return result;
  }, [data.pairs]);
  const prefs: Prefs = {
    multiphase: data.multiphaseTiming,
    showLiveTimer: data.showLiveTimer,
    m2SecondTargetSwap: data.m2SecondTargetSwap,
    memoOrder: data.memoOrder,
    defaultView: data.defaultCubeView ?? { top: "white", front: "green" },
  };
  useEffect(() => {
    const userId = store.user?.id;
    if (!userId) {
      setIsAdmin(false);
      setFeedback([]);
      return;
    }
    let live = true;
    void feedbackAdmin(userId).then(async (allowed) => {
      if (!live) return;
      setIsAdmin(allowed);
      if (allowed) {
        try {
          const items = await listFeedback();
          if (live) setFeedback(items);
        } catch {
          if (live) setFeedback([]);
        }
      } else {
        setFeedback([]);
      }
    });
    return () => {
      live = false;
    };
  }, [store.user?.id]);
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
        return {
          ...current,
          pairs: next,
          pairSharing: "separate",
          preferencesUpdatedAt:
            current.pairSharing === "separate"
              ? current.preferencesUpdatedAt
              : new Date().toISOString(),
        };
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
          schemeUpdatedAt: new Date().toISOString(),
          onboarded: true,
        };
      }),
    [store],
  );
  const setSolves: React.Dispatch<React.SetStateAction<Solve[]>> = useCallback(
    (action) => {
      const next = typeof action === "function" ? action(solves) : action;
      store.update((current) => ({
        ...current,
        solves: applySolveViews(current.solves, solves, next, activeSessionId),
      }));
    },
    [activeSessionId, solves, store],
  );
  const setActiveSession = useCallback(
    (id: string) =>
      store.update((d) => ({
        ...d,
        activeTimerSessionId: id,
        preferencesUpdatedAt: new Date().toISOString(),
      })),
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
        preferencesUpdatedAt: new Date().toISOString(),
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
          preferencesUpdatedAt: new Date().toISOString(),
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
          preferencesUpdatedAt: new Date().toISOString(),
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
        multiphaseTiming: p.multiphase ?? d.multiphaseTiming,
        showLiveTimer: p.showLiveTimer ?? d.showLiveTimer,
        m2SecondTargetSwap: p.m2SecondTargetSwap ?? d.m2SecondTargetSwap,
        memoOrder: p.memoOrder ?? d.memoOrder,
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
      Object.entries(updates).forEach(([encoded, words]) => {
        const scoped = encoded.match(/^(edges|corners):(.*)$/),
          flat = scoped?.[2] ?? encoded;
        const key = pairKey(flat[0], flat.slice(1)),
          entry = pairs[key] ?? { shared: [] };
        writeEntry(
          key,
          scoped
            ? { ...entry, [scoped[1]]: words }
            : { ...entry, shared: words },
        );
      }),
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
            store.user.user_metadata.auth_source === "wca" ? "wca" : "google",
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
          lastAttemptAt: store.lastAttemptAt,
          role: isAdmin ? "admin" : "user",
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
    retrySync: store.retry,
    syncMessage: store.message,
    replacePairs: (action) => {
      const db = typeof action === "function" ? action(pairs) : action;
      store.update((current) => {
        const next: typeof current.pairs = {};
        Object.entries(db).forEach(([key, entry]) => {
          const [first, second] = splitKey(key);
          (["edge", "corner"] as const).forEach((type) => {
            const a = Object.values(current.scheme.stickers).find(
              (s) => s.pieceType === type && s.label === first,
            );
            const b = Object.values(current.scheme.stickers).find(
              (s) => s.pieceType === type && s.label === second,
            );
            if (!a || !b) return;
            const id = physicalPairKey(a.id, b.id);
            const scoped = type === "edge" ? entry.edges : entry.corners;
            const words = scoped?.length ? scoped : entry.shared;
            if (!words.length) return;
            const old = current.pairs[id];
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
        });
        return {
          ...current,
          pairs: next,
          pairSharing: "separate",
          preferencesUpdatedAt:
            current.pairSharing === "separate"
              ? current.preferencesUpdatedAt
              : new Date().toISOString(),
        };
      });
    },
    navGuard,
    setNavGuard: (g) => setNavGuardState(() => g),
    feedback,
    submitFeedback: async (input) => {
      const created = await submitFeedbackRemote(input, store.user);
      if (isAdmin) setFeedback((items) => [created, ...items]);
      return created;
    },
    updateFeedback: async (id, patch) => {
      await updateFeedbackRemote(id, patch);
      setFeedback((items) =>
        items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    deleteFeedback: async (id) => {
      await deleteFeedbackRemote(id);
      setFeedback((items) => items.filter((item) => item.id !== id));
    },
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

/** User lettering keyed by physical sticker id, shared by every cube renderer. */
export function useLetterScheme() {
  return useContext(AppDataContext)?.setup.scheme ?? magicSpeffz;
}

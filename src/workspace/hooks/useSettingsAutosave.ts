import { useEffect, useRef, useState } from "react";
import { useStore } from "../../app/Store";
import { useAppData } from "../contexts/AppDataContext";
import type { BldSetup, CubeViewPref } from "../types/app";
import {
  readSettingsDraft,
  sameSettings,
  settingsDraftKey,
  setupDraftError,
  type SettingsDraft,
} from "../utils/settingsDraft";

/** Drafts are durable immediately; only complete setups enter the existing sync outbox. */
export function useSettingsAutosave() {
  const app = useAppData();
  const store = useStore();
  const owner = store.recoveredId ? `recovered:${store.recoveredId}` : store.user?.id ?? "guest";
  const [record, setRecord] = useState<SettingsDraft | null>(null);
  const [storageError, setStorageError] = useState("");
  const [failed, setFailed] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const current = useRef({ app, store, owner, record });
  current.current = { app, store, owner, record };
  const active = store.ready && record?.owner === owner;
  const dirty =
    !!active &&
    !sameSettings(record.setup, record.view, record.baseSetup, record.baseView);
  const invalid = active ? setupDraftError(record.setup) : null;
  const conflict =
    !!active &&
    dirty &&
    !sameSettings(
      record.baseSetup,
      record.baseView,
      app.setup,
      app.prefs.defaultView,
    ) &&
    !sameSettings(record.setup, record.view, app.setup, app.prefs.defaultView);

  useEffect(() => {
    if (!store.ready) return;
    const base: SettingsDraft = {
      version: 1,
      owner,
      setup: app.setup,
      view: app.prefs.defaultView,
      baseSetup: app.setup,
      baseView: app.prefs.defaultView,
    };
    setStorageError("");
    setFailed(false);
    setRecoveryError("");
    try {
      setRecord(
        readSettingsDraft(
          localStorage.getItem(settingsDraftKey(owner)),
          owner,
        ) ?? base,
      );
    } catch (error) {
      setRecord(base);
      setRecoveryError(String(error));
    }
  }, [owner, store.ready]);

  const recordKey = JSON.stringify(record);
  const savedKey = JSON.stringify([app.setup, app.prefs.defaultView]);
  useEffect(() => {
    if (!active || !record || recoveryError) return;
    // Adopt remote/imported changes only when there is no local edit to overwrite.
    if (
      !dirty &&
      !sameSettings(record.setup, record.view, app.setup, app.prefs.defaultView)
    ) {
      setRecord({
        ...record,
        setup: app.setup,
        view: app.prefs.defaultView,
        baseSetup: app.setup,
        baseView: app.prefs.defaultView,
      });
      return;
    }
    try {
      if (dirty)
        localStorage.setItem(settingsDraftKey(owner), JSON.stringify(record));
      else localStorage.removeItem(settingsDraftKey(owner));
      setStorageError("");
    } catch {
      setStorageError(
        "Couldn’t keep this draft on your device. Free some browser storage and retry before leaving.",
      );
    }
  }, [recordKey, savedKey, active, dirty, recoveryError]);

  // This callback reads the latest owner and draft so neither timers nor cleanup
  // can save an old account's draft into the next account.
  const commit = (force = false) => {
    const {
      app: latest,
      store: s,
      owner: account,
      record: r,
    } = current.current;
    if (
      !r ||
      !s.ready ||
      r.owner !== account ||
      recoveryError ||
      s.storageIssue
    )
      return;
    if (sameSettings(r.setup, r.view, r.baseSetup, r.baseView)) return;
    if (
      !force &&
      !sameSettings(
        r.baseSetup,
        r.baseView,
        latest.setup,
        latest.prefs.defaultView,
      ) &&
      !sameSettings(r.setup, r.view, latest.setup, latest.prefs.defaultView)
    )
      return;
    try {
      localStorage.setItem(settingsDraftKey(account), JSON.stringify(r));
      setStorageError("");
    } catch {
      setStorageError(
        "Couldn’t keep this draft on your device. Free some browser storage and retry before leaving.",
      );
      return;
    }
    if (setupDraftError(r.setup)) return;
    if (!latest.saveSetup(r.setup, r.view)) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setRecord({ ...r, baseSetup: r.setup, baseView: r.view });
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(
    () => () => {
      if (current.current.owner === owner) commitRef.current();
    },
    [owner],
  );
  useEffect(() => {
    if (
      !active ||
      !dirty ||
      invalid ||
      conflict ||
      storageError ||
      store.storageIssue ||
      failed ||
      recoveryError
    )
      return;
    // Settings-only idle batching. The shared outbox keeps its normal cadence.
    const timer = setTimeout(() => commitRef.current(), 5000);
    return () => clearTimeout(timer);
  }, [
    recordKey,
    active,
    dirty,
    invalid,
    conflict,
    storageError,
    store.storageIssue,
    failed,
    recoveryError,
  ]);
  const previousStorageIssue = useRef(store.storageIssue);
  useEffect(() => {
    if (previousStorageIssue.current && !store.storageIssue) setFailed(false);
    previousStorageIssue.current = store.storageIssue;
  }, [store.storageIssue]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (!storageError) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    // A healthy durable draft needs no confirmation on normal navigation.
    app.setNavGuard(() => {
      if (storageError) {
        store.notify(storageError);
        return false;
      }
      // Completed edits are available to practice immediately on leaving.
      // Incomplete/conflicting edits stay in their recoverable local draft.
      commitRef.current();
      return true;
    });
    return () => {
      window.removeEventListener("beforeunload", protect);
      app.setNavGuard(null);
    };
  }, [storageError]);

  const edit = (change: (draft: SettingsDraft) => SettingsDraft) => {
    if (!active || recoveryError) return;
    setFailed(false);
    setRecord((r) => (r?.owner === owner ? change(r) : r));
  };
  const useSaved = () => {
    if (!record || !active) return;
    setFailed(false);
    setRecord({
      ...record,
      setup: app.setup,
      view: app.prefs.defaultView,
      baseSetup: app.setup,
      baseView: app.prefs.defaultView,
    });
  };
  const status = store.storageIssue
    ? ""
    : recoveryError ||
      storageError ||
      (conflict
        ? "Your saved setup changed elsewhere. Choose which version to use."
        : failed
          ? "Your changes are safe on this device. Couldn’t save them — retry."
          : "");
  return {
    draft: active ? record.setup : app.setup,
    draftView: active ? record.view : app.prefs.defaultView,
    setDraft: (action: BldSetup | ((d: BldSetup) => BldSetup)) =>
      edit((r) => ({
        ...r,
        setup: typeof action === "function" ? action(r.setup) : action,
      })),
    setDraftView: (view: CubeViewPref) => edit((r) => ({ ...r, view })),
    ready: !!active && !recoveryError,
    hydrated: !!active,
    dirty,
    invalid,
    conflict,
    status,
    needsRetry: !store.storageIssue && (!!storageError || failed),
    retry: () => {
      store.retryStorage();
      commitRef.current();
    },
    useDraft: () => commitRef.current(true),
    useSaved,
  };
}

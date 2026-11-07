import { useState } from "react";
import { useStore } from "../app/Store";
import { cloudConfigured, supabase } from "../lib/supabase";
import {
  downloadBackup,
  parseBackup,
  validateScheme,
  loadLocal,
  type AppData,
} from "../lib/repository";
import { createSpeffzScheme, stickersFor } from "../domain/bld/speffz";
import type { LetteringScheme } from "../domain/bld/types";
import { SchemeNet } from "../components/SchemeNet";
import { Dialog } from "../components/Dialog";
import { LeaveGuard } from "../components/LeaveGuard";

export default function SettingsPage() {
  const { data, user, sync, update, notify, retry, importData } = useStore();
  const [draft, setDraft] = useState(() => structuredClone(data.scheme)),
    [error, setError] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [mail, setMail] = useState(""),
    [incoming, setIncoming] = useState<AppData | null>(null),
    [preset, setPreset] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.scheme);
  const [importSetup, setImportSetup] = useState(false);
  const change = (value: Partial<LetteringScheme>) =>
    setDraft((s) => ({ ...s, ...value }));
  const save = () => {
    const error = validateScheme(draft);
    setError(error ?? "");
    if (error) return;
    update((d) => ({
      ...d,
      scheme: structuredClone(draft),
      schemeUpdatedAt: new Date().toISOString(),
      onboarded: true,
    }));
    notify(
      "BLD setup saved. Existing solves keep the setup used when they were timed.",
    );
  };
  const readFile = async (file: File) => {
    try {
      if (file.size > 20_000_000)
        throw new Error("Backup exceeds the 20 MB limit.");
      setIncoming(parseBackup(await file.text()));
      setError("");
    } catch (e) {
      setError(`Import rejected: ${(e as Error).message}`);
    }
  };
  const login = async () => {
    if (!supabase) return;
    setBusy(true);
    setMail("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + "/settings" },
      });
      if (error) throw error;
      setMail(
        "Check your email for a sign-in link. You can keep practising on this device.",
      );
    } catch (e) {
      setMail((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-page">
      <LeaveGuard
        active={dirty}
        title="Discard setup changes?"
        message="Your unsaved lettering and buffer changes will be lost."
      />
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Your cube, memory system, and data.</p>
        </div>
      </div>
      <section className="settings-section" id="setup">
        <div className="settings-caption">
          <h2>BLD setup</h2>
          <p>Used for new memo challenges and solves.</p>
        </div>
        <div className="settings-content">
          <label className="checkbox-label timer-preference">
            <input
              type="checkbox"
              checked={data.multiphaseTiming}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  multiphaseTiming: e.target.checked,
                  preferencesUpdatedAt: new Date().toISOString(),
                }))
              }
            />
            <span>
              <strong>Multiphase timing</strong>
              <small>Record memo and execution separately.</small>
            </span>
          </label>
          <div className="form-grid">
            <label>
              Edge buffer
              <select
                aria-label="Edge buffer"
                value={draft.edgeBuffer}
                onChange={(e) => change({ edgeBuffer: e.target.value })}
              >
                {stickersFor(draft, "edge").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Corner buffer
              <select
                aria-label="Corner buffer"
                value={draft.cornerBuffer}
                onChange={(e) => change({ cornerBuffer: e.target.value })}
              >
                {stickersFor(draft, "corner").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Top colour
              <select
                aria-label="Top colour"
                value={draft.orientation.up}
                onChange={(e) =>
                  change({
                    orientation: { ...draft.orientation, up: e.target.value },
                  })
                }
              >
                {Object.entries({
                  U: "White",
                  D: "Yellow",
                  F: "Green",
                  B: "Blue",
                  R: "Red",
                  L: "Orange",
                }).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label} ({id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Front colour
              <select
                aria-label="Front colour"
                value={draft.orientation.front}
                onChange={(e) =>
                  change({
                    orientation: {
                      ...draft.orientation,
                      front: e.target.value,
                    },
                  })
                }
              >
                {Object.entries({
                  U: "White",
                  D: "Yellow",
                  F: "Green",
                  B: "Blue",
                  R: "Red",
                  L: "Orange",
                }).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label} ({id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Edge method
              <select
                aria-label="Edge method"
                value={draft.edgeMethod}
                onChange={(e) =>
                  change({
                    edgeMethod: e.target.value as LetteringScheme["edgeMethod"],
                  })
                }
              >
                <option value="m2">M2</option>
                <option value="old-pochmann">Old Pochmann</option>
              </select>
            </label>
            <label>
              Corner method
              <select
                aria-label="Corner method"
                value={draft.cornerMethod}
                onChange={(e) =>
                  change({
                    cornerMethod: e.target
                      .value as LetteringScheme["cornerMethod"],
                  })
                }
              >
                <option value="old-pochmann">Old Pochmann</option>
              </select>
            </label>
          </div>
          <details>
            <summary>Memo and execution conventions</summary>
            <p>
              Memo is raw, sticker-oriented buffer tracing. Flips and twists are
              included as explicit targets. Cycle breaks are chosen by you after
              a solve, or canonically in the memo trainer.
            </p>
            <p>
              Method selections describe your setup; they do not change raw
              targets. M2 even-target substitutions and Old Pochmann setup
              algorithms are handled separately from raw tracing. Odd
              edge/corner target counts indicate permutation parity, not an
              execution algorithm.
            </p>
          </details>
        </div>
      </section>
      <section className="settings-section" id="lettering">
        <div className="settings-caption">
          <h2>Lettering</h2>
          <p>
            One token per sticker. Edges and corners may use the same alphabet.
          </p>
          <button onClick={() => setPreset(true)}>Use Speffz preset</button>
        </div>
        <div className="settings-content">
          <label>
            Scheme name
            <input
              value={draft.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <p className="subtle">
            Edit the net. Double outline = buffer. Tokens may contain several
            characters, but no spaces or separators.
          </p>
          <div className="net-scroll">
            <SchemeNet
              scheme={draft}
              onLabel={(id, label) =>
                change({
                  stickers: {
                    ...draft.stickers,
                    [id]: { ...draft.stickers[id], label },
                  },
                })
              }
            />
          </div>
          <p className="subtle">
            Pairs stay attached to physical stickers when you rename tokens.
          </p>
          {!!data.schemeHistory?.length && (
            <details>
              <summary>Previous setups</summary>
              <p>
                Recovered from edits or sync. Applying one changes only your
                draft.
              </p>
              {data.schemeHistory.map((old, i) => (
                <p key={i}>
                  <button
                    className="text-button"
                    onClick={() => setDraft(structuredClone(old.scheme))}
                  >
                    Use {old.scheme.name} · {old.scheme.edgeBuffer} /{" "}
                    {old.scheme.cornerBuffer} ·{" "}
                    {new Date(old.updatedAt).toLocaleDateString()}
                  </button>
                </p>
              ))}
            </details>
          )}
        </div>
      </section>
      <div className="settings-save">
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <span className="subtle">
          {dirty ? "Unsaved setup changes" : "Setup is up to date"}
        </span>
        <button
          disabled={!dirty && data.onboarded}
          className="primary"
          onClick={save}
        >
          Save setup
        </button>
        {dirty && (
          <button
            onClick={() => {
              setDraft(structuredClone(data.scheme));
              setError("");
            }}
          >
            Discard changes
          </button>
        )}
      </div>
      <section className="settings-section" id="account">
        <div className="settings-caption">
          <h2>Account & sync</h2>
          <p>Local and signed-in workspaces are separate.</p>
        </div>
        <div className="settings-content">
          {user ? (
            <>
              <p>
                Signed in as <strong>{user.email}</strong>
              </p>
              <p aria-live="polite">
                {sync === "saved"
                  ? "All changes saved to your account."
                  : sync === "saving"
                    ? "Saving changes…"
                    : sync === "error"
                      ? "Sync needs attention. Your changes remain on this device."
                      : "Connecting to your account…"}
              </p>
              <div className="actions">
                <button
                  onClick={retry}
                  disabled={sync === "loading" || sync === "saving"}
                >
                  Retry sync
                </button>
                <button
                  onClick={async () => {
                    const { error } = await supabase!.auth.signOut();
                    if (error) notify(error.message);
                  }}
                >
                  Sign out
                </button>
                <button
                  onClick={() => {
                    try {
                      setIncoming(loadLocal(null).data);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Import device workspace
                </button>
              </div>
            </>
          ) : cloudConfigured ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Sending…" : "Send sign-in link"}
              </button>
              <p className="subtle">
                Signing in does not upload your device workspace automatically.
              </p>
              <p role="status">{mail}</p>
            </form>
          ) : (
            <>
              <p>Cloud sync is not configured on this installation.</p>
              <p className="subtle">
                You can use every training tool locally. Export a backup before
                clearing browser data. Connect Supabase using the installation
                guide to enable accounts.
              </p>
            </>
          )}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-caption">
          <h2>Backup & restore</h2>
          <p>
            A portable copy of your setup, pairs, solves, and practice history.
          </p>
        </div>
        <div className="settings-content">
          <div className="actions">
            <button onClick={() => downloadBackup(data)}>Export JSON</button>
            <label className="button file-button">
              Choose backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="subtle">
            Imports are validated and previewed before merging. Existing solves
            are retained; word conflicts use the most recently updated values.
          </p>
        </div>
      </section>
      {preset && (
        <Dialog title="Use Speffz lettering?" onClose={() => setPreset(false)}>
          <p>
            This replaces the 48 labels in your draft. Buffers and methods are
            unchanged. Existing pairs remain attached to their physical
            stickers.
          </p>
          <div className="actions">
            <button onClick={() => setPreset(false)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                change({
                  name: "Speffz",
                  stickers: createSpeffzScheme().stickers,
                });
                setPreset(false);
              }}
            >
              Apply to draft
            </button>
          </div>
        </Dialog>
      )}
      {incoming && (
        <Dialog title="Review backup" onClose={() => setIncoming(null)}>
          <p>
            {
              Object.values(incoming.pairs).filter((p) => p.primaryMnemonic)
                .length
            }{" "}
            filled pairs · {incoming.solves.filter((s) => !s.deleted).length}{" "}
            solves · {incoming.attempts.length} practice attempts
          </p>
          <p>
            Words and history will be merged; newer words become primary and
            word conflicts use the most recently updated values.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={importSetup}
              onChange={(e) => setImportSetup(e.target.checked)}
            />
            Also restore the backup’s lettering and buffers (
            {incoming.scheme.name})
          </label>
          <p className="subtle">
            A backup of your current workspace will download before import.
          </p>
          <div className="actions">
            <button onClick={() => setIncoming(null)}>Cancel</button>
            <button
              className="primary"
              onClick={() => {
                downloadBackup(data);
                importData({
                  ...incoming,
                  scheme: importSetup ? incoming.scheme : data.scheme,
                  schemeUpdatedAt: importSetup
                    ? new Date().toISOString()
                    : data.schemeUpdatedAt,
                });
                if (importSetup) setDraft(structuredClone(incoming.scheme));
                setIncoming(null);
              }}
            >
              Back up & merge
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

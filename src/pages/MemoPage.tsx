import { useEffect, useRef, useState } from "react";
import { useStore } from "../app/Store";
import type { MemoTrace } from "../domain/bld/types";
import { checkTokenAnswer, pairKey } from "../domain/letterPairs";
import { MemoStrip, targetPairs } from "../components/MemoStrip";
import { PairEditor, type PairSelection } from "../components/PairEditor";
import { typingTarget } from "../lib/interaction";

export default function MemoPage() {
  const { data, update, setFocus } = useStore(),
    [trace, setTrace] = useState<MemoTrace | null>(null),
    [stage, setStage] = useState<
      "idle" | "loading" | "study" | "recall" | "result"
    >("idle"),
    [error, setError] = useState(""),
    [answers, setAnswers] = useState({ corners: "", edges: "" }),
    [editing, setEditing] = useState<PairSelection | null>(null);
  const recall = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      setFocus(false);
    },
    [setFocus],
  );
  const next = async () => {
    const seq = ++generation.current;
    setStage("loading");
    setError("");
    try {
      const { generateBlindScramble, scrambleToState } =
        await import("../domain/bld/cubing");
      const { traceWithCanonicalBreaks } = await import("../domain/bld/trace");
      const state = await scrambleToState(
        await generateBlindScramble(),
      );
      const result = traceWithCanonicalBreaks(state, data.scheme);
      if (seq !== generation.current) return;
      setTrace(result.trace);
      setAnswers({ corners: "", edges: "" });
      setStage("study");
      setFocus(true);
    } catch (e) {
      if (seq === generation.current) {
        setStage("idle");
        setError(`Could not generate memo: ${(e as Error).message}`);
      }
    }
  };
  const ready = () => {
    setStage("recall");
    requestAnimationFrame(() => recall.current?.focus());
  };
  const checks = trace
    ? {
        corners: checkTokenAnswer(
          trace.corners.targets.map((t) => t.token),
          answers.corners,
        ),
        edges: checkTokenAnswer(
          trace.edges.targets.map((t) => t.token),
          answers.edges,
        ),
      }
    : null;
  const submit = () => {
    if (!checks) return;
    const items = [...checks.corners.items, ...checks.edges.items];
    update((d) => ({
      ...d,
      attempts: [
        ...d.attempts,
        {
          id: crypto.randomUUID(),
          kind: "memo",
          correct: checks.corners.correct && checks.edges.correct,
          accuracy: items.length
            ? items.filter((i) => i.correct).length / items.length
            : 1,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setStage("result");
    setFocus(false);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || typingTarget(e.target) || e.ctrlKey || e.metaKey) return;
      if (stage === "study" && (e.code === "Space" || e.key === "Enter")) {
        e.preventDefault();
        ready();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <section className="practice-page memo-page">
      <div className="page-heading">
        <div>
          <h1>Memo trainer</h1>
          <p>One legal cube state. Your buffers and lettering.</p>
        </div>
        <span className="subtle">
          {stage === "study"
            ? "Study"
            : stage === "recall"
              ? "Recall"
              : stage === "result"
                ? "Result"
                : "3×3 blindfolded"}
        </span>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {(stage === "idle" || stage === "loading") && (
        <div className="empty-state">
          <h2>
            {stage === "loading"
              ? "Generating a cube state…"
              : "Memorise a complete solve"}
          </h2>
          <p>
            Study corners and edges, hide them, then recall each sequence.
            <br />
            Cycle breaks use the first available sticker in your scheme.
          </p>
          <button
            className="primary"
            disabled={stage === "loading"}
            onClick={() => void next()}
          >
            {stage === "loading" ? "Generating…" : "Start exercise"}
          </button>
        </div>
      )}
      {stage === "study" && trace && (
        <div className="memo-study">
          <MemoStrip
            tokens={trace.corners.targets.map((t) => t.token)}
            label="Corners"
            large
          />
          <MemoStrip
            tokens={trace.edges.targets.map((t) => t.token)}
            label="Edges"
            large
          />
          <div className="practice-actions">
            <button className="primary" onClick={ready}>
              Ready <kbd>Space</kbd>
            </button>
          </div>
          <p className="subtle centered">
            {trace.corners.targets.length + trace.edges.targets.length} targets
            · Raw sticker memo
          </p>
        </div>
      )}
      {stage === "recall" && (
        <form
          className="recall-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <h2>Enter your memo</h2>
          <p className="subtle">
            Separate tokens with spaces, including multi-character labels.
          </p>
          <label>
            Corners
            <input
              className="mono"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              ref={recall}
              value={answers.corners}
              onChange={(e) =>
                setAnswers({ ...answers, corners: e.target.value })
              }
            />
          </label>
          <label>
            Edges
            <input
              className="mono"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={answers.edges}
              onChange={(e) =>
                setAnswers({ ...answers, edges: e.target.value })
              }
            />
          </label>
          <button className="primary">
            Check memo <kbd>Enter</kbd>
          </button>
        </form>
      )}
      {stage === "result" && trace && checks && (
        <div className="memo-results">
          <div className="result-heading" role="status">
            <h2>
              {checks.corners.correct && checks.edges.correct
                ? "Correct"
                : "Memo differs"}
            </h2>
            <span>
              {checks.corners.items.length + checks.edges.items.length === 0
                ? 100
                : Math.round(
                    ([...checks.corners.items, ...checks.edges.items].filter(
                      (i) => i.correct,
                    ).length /
                      Math.max(
                        1,
                        checks.corners.items.length + checks.edges.items.length,
                      )) *
                      100,
                  )}
              % of targets correct
            </span>
          </div>
          {(["corners", "edges"] as const).map((key) => (
            <div className="memo-result-section" key={key}>
              <h3>{key === "corners" ? "Corners" : "Edges"}</h3>
              <div className="answer-diff">
                <span>Your answer</span>
                <div>
                  {checks[key].items.map((item, i) => (
                    <span
                      key={i}
                      className={
                        item.correct ? "correct-token" : "incorrect-token"
                      }
                      title={
                        item.correct
                          ? "Correct"
                          : `Expected ${item.expected ?? "nothing"}`
                      }
                    >
                      {item.actual ?? "—"}
                      {!item.correct && (
                        <small>≠ {item.expected ?? "extra"}</small>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <MemoStrip
                label="Correct memo"
                tokens={trace[key].targets.map((t) => t.token)}
              />
              <div className="memo-lookup">
                {targetPairs(trace[key].targets).map(({ first, second }, i) => {
                  const pair = second
                    ? data.pairs[pairKey(first.stickerId, second.stickerId)]
                    : undefined;
                  return (
                    <div key={i}>
                      <span className="mono">
                        {first.token}
                        {second ? ` · ${second.token}` : ""}
                      </span>
                      <span>
                        {second ? (
                          pair?.primaryMnemonic || (
                            <span className="subtle">No word saved</span>
                          )
                        ) : (
                          <span className="subtle">Single trailing target</span>
                        )}
                      </span>
                      {second && (
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditing([first.stickerId, second.stickerId])
                          }
                        >
                          {pair?.primaryMnemonic ? "Edit" : "Add word"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="primary" onClick={() => void next()}>
            Next exercise
          </button>
        </div>
      )}
      {editing && <PairEditor ids={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

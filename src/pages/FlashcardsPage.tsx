import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/Store";
import { pairKey } from "../domain/letterPairs";
import { randomIndex, typingTarget } from "../lib/interaction";
import { PairEditor } from "../components/PairEditor";
export default function FlashcardsPage() {
  const { data, update } = useStore(),
    filled = useMemo(
      () => Object.values(data.pairs).filter((p) => p.primaryMnemonic),
      [data.pairs],
    );
  const [key, setKey] = useState(() => {
      const p = filled.length ? filled[randomIndex(filled.length)] : undefined;
      return p ? pairKey(p.firstStickerId, p.secondStickerId) : "";
    }),
    [revealed, setRevealed] = useState(false),
    [editing, setEditing] = useState(false),
    [count, setCount] = useState({ remembered: 0, forgot: 0 });
  const card = data.pairs[key]?.primaryMnemonic ? data.pairs[key] : undefined;
  useEffect(() => {
    if (!card && filled.length) {
      const p = filled[randomIndex(filled.length)];
      setKey(pairKey(p.firstStickerId, p.secondStickerId));
      setRevealed(false);
    }
  }, [filled, card]);
  const next = () => {
    const p = filled[randomIndex(filled.length)];
    setKey(pairKey(p.firstStickerId, p.secondStickerId));
    setRevealed(false);
  };
  const mark = (forgot: boolean) => {
    if (!card || !revealed) return;
    update((d) => ({
      ...d,
      pairs: {
        ...d.pairs,
        [pairKey(card.firstStickerId, card.secondStickerId)]: {
          ...card,
          encounters: card.encounters + 1,
          forgotten: card.forgotten + Number(forgot),
          updatedAt: new Date().toISOString(),
        },
      },
      attempts: [
        ...d.attempts,
        {
          id: crypto.randomUUID(),
          kind: "flashcard",
          correct: !forgot,
          accuracy: Number(!forgot),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setCount((c) => ({
      ...c,
      [forgot ? "forgot" : "remembered"]:
        c[forgot ? "forgot" : "remembered"] + 1,
    }));
    next();
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        editing ||
        typingTarget(e.target) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (!card) return;
      if ((e.code === "Space" || e.key === "Enter") && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && (e.key === "1" || e.key === "2")) {
        e.preventDefault();
        mark(e.key === "1");
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  return (
    <section className="practice-page">
      <div className="page-heading">
        <div>
          <h1>Flashcards</h1>
          <p>Uniform random selection from your saved pairs.</p>
        </div>
        <span className="subtle">{filled.length} available</span>
      </div>
      {!card && filled.length ? (
        <p role="status">Choosing a pair…</p>
      ) : !card ? (
        <div className="empty-state">
          <h2>Add your first word</h2>
          <p>Save a word in Letter pairs to start practising.</p>
          <Link className="button primary" to="/pairs">
            Open letter pairs
          </Link>
        </div>
      ) : (
        <>
          <div className="flash-stage">
            <p className="subtle">
              {revealed ? "Your word" : "Recall the image"}
            </p>
            <div
              className="flash-pair mono"
              style={{
                fontSize:
                  Math.max(
                    data.scheme.stickers[card.firstStickerId].label.length,
                    data.scheme.stickers[card.secondStickerId].label.length,
                  ) > 4
                    ? "clamp(24px, 5vw, 48px)"
                    : undefined,
              }}
            >
              <span className="flash-token">
                {data.scheme.stickers[card.firstStickerId].label}
              </span>
              <span className="pair-separator">·</span>
              <span className="flash-token">
                {data.scheme.stickers[card.secondStickerId].label}
              </span>
            </div>
            <div className="answer-slot" aria-live="polite">
              {revealed ? (
                <>
                  <h2>{card.primaryMnemonic}</h2>

                  <button
                    className="text-button"
                    onClick={() => setEditing(true)}
                  >
                    Edit word
                  </button>
                </>
              ) : (
                <p className="subtle">Think of your word, then reveal.</p>
              )}
            </div>
            <div className="practice-actions">
              {revealed ? (
                <>
                  <button onClick={() => mark(true)}>
                    Forgot <kbd>1</kbd>
                  </button>
                  <button className="primary" onClick={() => mark(false)}>
                    Remembered <kbd>2</kbd>
                  </button>
                </>
              ) : (
                <button className="primary" onClick={() => setRevealed(true)}>
                  Reveal <kbd>Space</kbd>
                </button>
              )}
            </div>
          </div>
          <div className="practice-footer">
            <span>{count.remembered + count.forgot} reviewed this session</span>
            <span>
              {count.remembered} remembered · {count.forgot} forgot
            </span>
          </div>
          {editing && (
            <PairEditor
              ids={[card.firstStickerId, card.secondStickerId]}
              onClose={() => setEditing(false)}
            />
          )}
        </>
      )}
    </section>
  );
}

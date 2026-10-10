import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { PairScope } from '../types/app';
import { pairKey, resolveWords, splitKey } from '../utils/pairs';
import { tokensOf } from '../utils/scheme';
import { isTypingTarget } from '../utils/keyboard';
import { useStore } from '../../app/Store';

export type CardPiece = 'edges' | 'corners';
export type CardPhase = 'question' | 'revealed' | 'editing' | 'adding';

/** One card = one pair in one piece context. */
export interface Card {
  key: string;
  piece: CardPiece;
}

export interface CardLog {
  id: number;
  key: string;
  piece: CardPiece;
  result: 'remembered' | 'forgot';
}

interface Options {
  /** Screen seeding only: which piece context the seeded card uses */
  scope?: CardPiece | 'both';
  card?: string;
  phase?: CardPhase;
}

const PIECES: CardPiece[] = ['edges', 'corners'];
const idOf = (c: Card) => `${c.key}#${c.piece}`;

/** User-visible cards are distinct pair/answer associations, not piece render variants. */
export function distinctMnemonicCardCount(
  cards: Card[],
  wordsFor: (key: string, piece: CardPiece) => string[]
) {
  return new Set(
    cards.map(({ key, piece }) =>
      `${key}\u0000${wordsFor(key, piece)
        .map((word) => word.trim().toLocaleLowerCase())
        .join('\u0001')}`
    )
  ).size;
}

/**
 * Uniform random practice over every eligible (pair, piece) card: a pair usable for both edges
 * and corners is two cards, each with the same chance as any other. "Forgot" is recorded,
 * never used to weight selection.
 */
export function useFlashcards(opts: Options) {
  const store = useStore();
  const { pairs, setup, savePair } = useAppData();
  const [log, setLog] = useState<CardLog[]>(() => store.data.attempts
    .filter((attempt) => attempt.kind === 'flashcard' && attempt.pairKey)
    .map((attempt) => ({
      id: Date.parse(attempt.createdAt), key: attempt.pairKey!,
      piece: attempt.pairPiece ?? 'edges', result: attempt.correct ? 'remembered' : 'forgot',
    })));
  const [phase, setPhase] = useState<CardPhase>(opts.phase ?? 'question');
  const idRef = useRef(1);

  const wordsFor = useCallback(
    (key: string, piece: CardPiece) => resolveWords(pairs[key], piece).words,
    [pairs]
  );

  // A card is only valid if both tokens exist in that piece's own lettering.
  const vocab = useMemo(
    () => ({ edges: new Set(tokensOf(setup.scheme, 'edge')), corners: new Set(tokensOf(setup.scheme, 'corner')) }),
    [setup.scheme]
  );

  const eligible = useMemo(() => {
    const out: Card[] = [];
    Object.keys(pairs).forEach((key) => {
      const [a, b] = splitKey(key);
      if (a === b) return;
      PIECES.forEach((piece) => {
        if (vocab[piece].has(a) && vocab[piece].has(b) && wordsFor(key, piece).length > 0) out.push({ key, piece });
      });
    });
    return out;
  }, [pairs, vocab, wordsFor]);

  const pick = useCallback(
    (exclude?: Card | null) => {
      const pool = eligible.length > 1 && exclude ? eligible.filter((c) => idOf(c) !== idOf(exclude)) : eligible;
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },
    [eligible]
  );

  const visibleCount = useMemo(
    () => distinctMnemonicCardCount(eligible, wordsFor),
    [eligible, wordsFor]
  );

  const [card, setCard] = useState<Card | null>(() =>
  opts.card && pairs[opts.card] ? { key: opts.card, piece: opts.scope === 'corners' ? 'corners' : 'edges' } : null
  );

  useEffect(() => {
    if (!card || !eligible.some((c) => idOf(c) === idOf(card))) {
      if (phase === 'editing' || phase === 'adding') return;
      setCard(pick(null));
      setPhase('question');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible]);

  const words = card ? wordsFor(card.key, card.piece) : [];

  // A card has to be on screen for a moment before it can be answered: no skimming by accident.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [card]);

  const next = useCallback(
    (result: 'remembered' | 'forgot') => {
      if (!card || performance.now() - shownAt.current < 220) return;
      const createdAt = new Date().toISOString();
      const id = Date.parse(createdAt);
      idRef.current++;
      setLog((l) => [{ id, key: card.key, piece: card.piece, result }, ...l].slice(0, 200));
      const [first, second] = splitKey(card.key);
      store.update((data) => ({
        ...data,
        pairs: Object.fromEntries(Object.entries(data.pairs).map(([key, pair]) => {
          const type = data.scheme.stickers[pair.firstStickerId]?.pieceType;
          const matchesPiece = card.piece === 'edges' ? type === 'edge' : type === 'corner';
          return [key, matchesPiece && pair.firstToken === first && pair.secondToken === second ? {
            ...pair, encounters: pair.encounters + 1,
            forgotten: pair.forgotten + (result === 'forgot' ? 1 : 0), updatedAt: createdAt,
          } : pair];
        })),
        attempts: [{
          id: crypto.randomUUID(), kind: 'flashcard', correct: result === 'remembered',
          accuracy: result === 'remembered' ? 1 : 0, pairKey: card.key, pairPiece: card.piece, createdAt,
        }, ...data.attempts],
      }));
      setCard(pick(card));
      setPhase('question');
    },
    [card, pick, store]
  );

  /** Which stored list the visible word came from, so edits land in the right place. */
  const targetScope = useCallback(
    (c: Card): PairScope => {
      const r = resolveWords(pairs[c.key], c.piece);
      return r.source === 'override' ? c.piece : 'shared';
    },
    [pairs]
  );

  const updateWords = useCallback(
    (c: Card, nextWords: string[]) => {
      const entry = pairs[c.key] ?? { shared: [] };
      const target = targetScope(c);
      savePair(c.key, target === 'shared' ? { ...entry, shared: nextWords } : { ...entry, [target]: nextWords });
    },
    [pairs, savePair, targetScope]
  );

  const editPrimary = (word: string) => {
    if (!card || !word.trim()) return;
    updateWords(card, [word.trim(), ...words.slice(1).filter((w) => w !== word.trim())]);
    setPhase('revealed');
  };

  const addAlternate = (word: string) => {
    if (!card || !word.trim()) return setPhase('revealed');
    if (!words.some((w) => w.toLowerCase() === word.trim().toLowerCase())) updateWords(card, [...words, word.trim()]);
    setPhase('revealed');
  };

  const review = (entry: CardLog) => {
    setCard({ key: entry.key, piece: entry.piece });
    setPhase('revealed');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      // Holding a key never cycles through cards.
      if (e.repeat) {
        if (e.code === 'Space' || e.key === 'Enter') e.preventDefault();
        return;
      }
      const key = e.key.toLowerCase();
      if (phase === 'question' && (e.code === 'Space' || e.key === 'Enter')) {
        if (e.target instanceof HTMLButtonElement && e.key === 'Enter') return;
        e.preventDefault();
        if (card) setPhase('revealed');
      } else if (phase === 'revealed') {
        if (e.key === 'Enter' || e.code === 'Space') {
          if (e.target instanceof HTMLButtonElement) return;
          e.preventDefault();
          next('remembered');
        } else if (key === 'f') next('forgot');else
        if (key === 'e') {
          e.preventDefault();
          setPhase('editing');
        } else if (key === 'a') {
          e.preventDefault();
          setPhase('adding');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, next, phase]);

  const remembered = log.filter((l) => l.result === 'remembered').length;

  return {
    card,
    cardId: card ? idOf(card) : null,
    cardTokens: card ? splitKey(card.key) : null,
    cardType: card ? (card.piece === 'edges' ? 'edge' : 'corner') as 'edge' | 'corner' : null,
    words,
    phase,
    setPhase,
    reveal: () => setPhase('revealed'),
    next,
    editPrimary,
    addAlternate,
    review,
    eligibleCount: visibleCount,
    log,
    removeLog: (id: number) => {
      setLog((l) => l.filter((x) => x.id !== id));
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => Date.parse(attempt.createdAt) !== id) }));
    },
    removeLatestLog: () => {
      const latest = log[0];
      if (!latest) return;
      setLog((l) => l.slice(1));
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => Date.parse(attempt.createdAt) !== latest.id) }));
    },
    clearLog: () => {
      setLog([]);
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => attempt.kind !== 'flashcard') }));
    },
    stats: { seen: log.length, remembered, forgot: log.length - remembered },
    wordsForLog: (entry: CardLog) => wordsFor(entry.key, entry.piece),
    keyOf: pairKey
  };
}

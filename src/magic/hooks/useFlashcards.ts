import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { PairScope } from '../types/app';
import { anyWords, pairKey, resolveWords, splitKey } from '../utils/pairs';
import { isTypingTarget } from '../utils/keyboard';
import { useStore } from '../../app/Store';

export type CardScope = 'all' | 'edges' | 'corners';
export type CardPhase = 'question' | 'revealed' | 'editing' | 'adding';

export interface CardLog {
  id: number;
  key: string;
  result: 'remembered' | 'forgot';
}

interface Options {
  scope?: CardScope;
  card?: string;
  phase?: CardPhase;
}

/** Uniform random practice. "Forgot" is recorded, never used to weight selection. */
export function useFlashcards(opts: Options) {
  const store = useStore();
  const { pairs, prefs, savePair } = useAppData();
  const [scope, setScope] = useState<CardScope>(opts.scope ?? 'all');
  const [log, setLog] = useState<CardLog[]>([]);
  const [phase, setPhase] = useState<CardPhase>(opts.phase ?? 'question');
  const idRef = useRef(1);

  const wordsFor = useCallback(
    (key: string) => {
      const entry = pairs[key];
      if (scope === 'all') return anyWords(entry);
      return resolveWords(entry, scope, prefs.sharing).words;
    },
    [pairs, scope, prefs.sharing]
  );

  const eligible = useMemo(
    () =>
    Object.keys(pairs).filter((key) => {
      const [a, b] = splitKey(key);
      return a !== b && wordsFor(key).length > 0;
    }),
    [pairs, wordsFor]
  );

  const pick = useCallback(
    (exclude?: string | null) => {
      const pool = eligible.length > 1 ? eligible.filter((k) => k !== exclude) : eligible;
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },
    [eligible]
  );

  const [card, setCard] = useState<string | null>(() => opts.card && pairs[opts.card] ? opts.card : null);

  useEffect(() => {
    if (!card || !eligible.includes(card)) {
      if (phase === 'editing' || phase === 'adding') return;
      setCard(pick(null));
      setPhase('question');
    }
  }, [eligible]);

  const words = card ? wordsFor(card) : [];

  const next = useCallback(
    (result: 'remembered' | 'forgot') => {
      if (!card) return;
      setLog((l) => [{ id: idRef.current++, key: card, result }, ...l].slice(0, 200));
      const [first, second] = splitKey(card);
      store.update((data) => ({ ...data,
        pairs: Object.fromEntries(Object.entries(data.pairs).map(([key, pair]) => {
          const type = data.scheme.stickers[pair.firstStickerId]?.pieceType;
          const inScope = scope === 'all' || scope === 'edges' && type === 'edge' || scope === 'corners' && type === 'corner';
          return [key, inScope && pair.firstToken === first && pair.secondToken === second ? { ...pair, encounters: pair.encounters + 1, forgotten: pair.forgotten + (result === 'forgot' ? 1 : 0), updatedAt: new Date().toISOString() } : pair];
        })),
        attempts: [{ id: crypto.randomUUID(), kind: 'flashcard', correct: result === 'remembered', accuracy: result === 'remembered' ? 1 : 0, createdAt: new Date().toISOString() }, ...data.attempts]
      }));
      setCard(pick(card));
      setPhase('question');
    },
    [card, pick, scope, store]
  );

  /** Which stored list the visible word came from, so edits land in the right place. */
  const targetScope = useCallback(
    (key: string): PairScope => {
      const entry = pairs[key];
      if (scope === 'all') return entry?.shared.length ? 'shared' : entry?.edges?.length ? 'edges' : 'corners';
      const r = resolveWords(entry, scope, prefs.sharing);
      return r.source === 'override' || prefs.sharing === 'separate' ? scope : 'shared';
    },
    [pairs, scope, prefs.sharing]
  );

  const updateWords = useCallback(
    (key: string, nextWords: string[]) => {
      const entry = pairs[key] ?? { shared: [] };
      const target = targetScope(key);
      savePair(key, target === 'shared' ? { ...entry, shared: nextWords } : { ...entry, [target]: nextWords });
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

  const review = (key: string) => {
    setCard(key);
    setPhase('revealed');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
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
    scope,
    setScope: (s: CardScope) => {
      setScope(s);
      setPhase('question');
    },
    card,
    cardTokens: card ? splitKey(card) : null,
    words,
    phase,
    setPhase,
    reveal: () => setPhase('revealed'),
    next,
    editPrimary,
    addAlternate,
    review,
    eligibleCount: eligible.length,
    log,
    stats: { seen: log.length, remembered, forgot: log.length - remembered },
    wordsForKey: (key: string) => anyWords(pairs[key]),
    keyOf: pairKey
  };
}

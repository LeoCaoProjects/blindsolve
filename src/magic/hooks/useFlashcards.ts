import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { PairScope } from '../types/app';
import { anyWords, pairKey, resolveWords, splitKey } from '../utils/pairs';
import { isTypingTarget } from '../utils/keyboard';
import { useStore } from '../../app/Store';

export type CardScope = 'both' | 'edges' | 'corners';
export type CardPhase = 'question' | 'revealed' | 'editing' | 'adding';

export interface CardLog {
  id: number;
  key: string;
  type: 'edges' | 'corners';
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
  const [scope, setScope] = useState<CardScope>(opts.scope ?? 'both');
  const [log, setLog] = useState<CardLog[]>(() => store.data.attempts.filter((attempt) => attempt.kind === 'flashcard' && attempt.pairKey).map((attempt) => ({ id: Date.parse(attempt.createdAt), key: attempt.pairKey!, type: attempt.pairPiece ?? 'edges', result: attempt.correct ? 'remembered' : 'forgot' })));
  const [phase, setPhase] = useState<CardPhase>(opts.phase ?? 'question');
  const idRef = useRef(1);

  const wordsFor = useCallback(
    (key: string, type?: 'edges' | 'corners') => {
      const entry = pairs[key];
      const resolvedType = type ?? (scope === 'both' ? undefined : scope);
      return resolvedType ? resolveWords(entry, resolvedType, prefs.sharing).words : anyWords(entry);
    },
    [pairs, scope, prefs.sharing]
  );

  const eligible = useMemo(
    () => Object.keys(pairs).flatMap((key) => {
      const [a, b] = splitKey(key);
      if (a === b) return [];
      const types: ('edges' | 'corners')[] = scope === 'both' ? ['edges', 'corners'] : [scope];
      return types.filter((type) => wordsFor(key, type).length > 0).map((type) => ({ key, type }));
    }),
    [pairs, wordsFor]
  );

  const pick = useCallback(
    (exclude?: {key: string;type: 'edges' | 'corners'} | null) => {
      const pool = eligible.length > 1 ? eligible.filter((candidate) => !exclude || candidate.key !== exclude.key || candidate.type !== exclude.type) : eligible;
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    },
    [eligible]
  );

  const initialCandidate = opts.card ? eligible.find((candidate) => candidate.key === opts.card) ?? null : null;
  const [card, setCard] = useState<string | null>(initialCandidate?.key ?? null);
  const [cardType, setCardType] = useState<'edges' | 'corners'>(initialCandidate?.type ?? 'edges');

  useEffect(() => {
    if (!card || !eligible.some((candidate) => candidate.key === card && candidate.type === cardType)) {
      if (phase === 'editing' || phase === 'adding') return;
      const candidate = pick(null);
      setCard(candidate?.key ?? null);
      if (candidate) setCardType(candidate.type);
      setPhase('question');
    }
  }, [eligible]);

  const words = card ? wordsFor(card, cardType) : [];

  const next = useCallback(
    (result: 'remembered' | 'forgot') => {
      if (!card) return;
      const createdAt = new Date().toISOString();
      const id = Date.parse(createdAt);
      idRef.current++;
      setLog((l) => [{ id, key: card, type: cardType, result }, ...l].slice(0, 200));
      const [first, second] = splitKey(card);
      store.update((data) => ({ ...data,
        pairs: Object.fromEntries(Object.entries(data.pairs).map(([key, pair]) => {
          const type = data.scheme.stickers[pair.firstStickerId]?.pieceType;
          const inScope = scope === 'both' || scope === 'edges' && type === 'edge' || scope === 'corners' && type === 'corner';
          return [key, inScope && pair.firstToken === first && pair.secondToken === second ? { ...pair, encounters: pair.encounters + 1, forgotten: pair.forgotten + (result === 'forgot' ? 1 : 0), updatedAt: new Date().toISOString() } : pair];
        })),
        attempts: [{ id: crypto.randomUUID(), kind: 'flashcard', correct: result === 'remembered', accuracy: result === 'remembered' ? 1 : 0, pairKey: card, pairPiece: cardType, createdAt }, ...data.attempts]
      }));
      const candidate = pick({ key: card, type: cardType });
      setCard(candidate?.key ?? null);
      if (candidate) setCardType(candidate.type);
      setPhase('question');
    },
    [card, cardType, pick, scope, store]
  );

  /** Which stored list the visible word came from, so edits land in the right place. */
  const targetScope = useCallback(
    (key: string): PairScope => {
      const entry = pairs[key];
      if (scope === 'both') return entry?.shared.length ? 'shared' : cardType;
      const r = resolveWords(entry, scope, prefs.sharing);
      return r.source === 'override' || prefs.sharing === 'separate' ? scope : 'shared';
    },
    [pairs, scope, prefs.sharing, cardType]
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

  const review = (key: string, type?: 'edges' | 'corners') => {
    setCard(key);
    if (type) setCardType(type);
    setPhase('revealed');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
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
    scope,
    setScope: (s: CardScope) => {
      setScope(s);
      setPhase('question');
    },
    card,
    cardType,
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
    removeLog: (id: number) => {
      setLog((entries) => entries.filter((entry) => entry.id !== id));
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => Date.parse(attempt.createdAt) !== id) }));
    },
    removeLatestLog: () => {
      const latest = log[0]; if (!latest) return;
      setLog((entries) => entries.slice(1));
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => Date.parse(attempt.createdAt) !== latest.id) }));
    },
    clearLog: () => {
      setLog([]);
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => attempt.kind !== 'flashcard') }));
    },
    stats: { seen: log.length, remembered, forgot: log.length - remembered },
    wordsForKey: (key: string, type?: 'edges' | 'corners') => type ? resolveWords(pairs[key], type, prefs.sharing).words : anyWords(pairs[key]),
    keyOf: pairKey
  };
}

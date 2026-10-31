import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyData, type AppData, type PracticeAttempt } from '../../lib/repository';
import { useTrainingSession } from './useTrainingSession';
import { useFlashcards } from './useFlashcards';

const store = vi.hoisted(() => ({ data: {} as AppData, update: vi.fn() }));
vi.mock('../../app/Store', () => ({ useStore: () => store }));
vi.mock('./useExecScramble', () => ({ useExecScramble: () => 'R' }));
vi.mock('../contexts/AppDataContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/AppDataContext')>();
  return { ...actual, useAppData: () => ({
    setup: actual.defaultSetup(), pairs: {}, savePair: vi.fn(),
    prefs: { memoOrder: 'corners-first', m2SecondTargetSwap: true },
  }) };
});

const attempt = (trainingMode: PracticeAttempt['trainingMode']): PracticeAttempt => ({
  id: crypto.randomUUID(), kind: 'memo', trainingMode,
  correct: true, durationMs: 4200, targets: 12, pairs: 6,
  createdAt: '2026-10-31T00:00:00.000Z',
});
beforeEach(() => {
  store.data = emptyData();
  store.update.mockImplementation((fn: (data: AppData) => AppData) => { store.data = fn(store.data); });
});
afterEach(cleanup);

describe('saved practice history follows the store', () => {
  it.each(['exec', 'guided', 'recall', 'trace'] as const)('%s restores asynchronously loaded history and follows account replacement', (mode) => {
    const { result, rerender } = renderHook(() => useTrainingSession({ mode }));
    expect(result.current.history).toHaveLength(0);
    const older = attempt(mode);
    const newer = { ...attempt(mode), createdAt: '2026-10-31T01:00:00.000Z' };
    store.data = { ...store.data, attempts: [older, newer] };
    rerender();
    expect(result.current.history.map(a => a.id)).toEqual([newer.id, older.id]);
    store.data = emptyData();
    rerender();
    expect(result.current.history).toHaveLength(0);
  });

  it('training deletion preserves other records with the same creation timestamp', () => {
    const first = attempt('exec');
    const second = attempt('trace');
    store.data.attempts = [first, second];
    const { result } = renderHook(() => useTrainingSession({ mode: 'exec' }));
    act(() => result.current.removeAttempt(first.id));
    expect(store.data.attempts.map(a => a.id)).toEqual([second.id]);
  });

  it('Solved/DNF updates the submitted execution attempt even when sync changes the record order', () => {
    const { result, rerender } = renderHook(() => useTrainingSession({ mode: 'exec', phase: 'active' }));
    act(() => result.current.submit());
    const submitted = store.data.attempts[0];
    const other = attempt('exec');
    store.data = { ...store.data, attempts: [other, submitted] };
    rerender();
    act(() => result.current.setExecResult('dnf'));
    expect(store.data.attempts.find(a => a.id === submitted.id)?.correct).toBe(false);
    expect(store.data.attempts.find(a => a.id === other.id)?.correct).toBe(true);
    act(() => result.current.removeAttempt(submitted.id));
    act(() => result.current.setExecResult('dnf'));
    expect(store.data.attempts[0].correct).toBe(true);
  });

  it('flashcards restore loaded history, follow cloud changes and delete by UUID', () => {
    const { result, rerender } = renderHook(() => useFlashcards({}));
    expect(result.current.log).toHaveLength(0);
    const training = attempt('trace');
    const card: PracticeAttempt = { ...attempt(undefined), kind: 'flashcard', pairKey: 'A\u0000B', pairPiece: 'edges' };
    store.data = { ...store.data, attempts: [training, card] };
    rerender();
    expect(result.current.log[0].id).toBe(card.id);
    act(() => result.current.removeLog(card.id));
    expect(store.data.attempts.map(a => a.id)).toEqual([training.id]);
    rerender();
    expect(result.current.log).toHaveLength(0);
  });
});

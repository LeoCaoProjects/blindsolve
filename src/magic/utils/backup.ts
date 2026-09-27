import { BldSetup, PairDb, Prefs } from '../types/app';
import { Solve } from '../types/solve';
import { pairKey } from './pairs';
import { isSpeffz, stickerById } from './scheme';

export interface BackupFile {
  app: '3bld-trainer';
  version: number;
  exportedAt: string;
  setup?: BldSetup;
  prefs?: Prefs;
  pairs?: PairDb;
  solves?: unknown[];
  practice?: {flashcards: number;memo: number;};
}

export type MergeStrategy = 'keep-mine' | 'prefer-backup' | 'replace';

export type ImportSummary =
{
  ok: true;
  fileName: string;
  exportedAt: string;
  lettering: string;
  buffers: string;
  pairs: {total: number;added: number;conflicts: number;};
  alternates: number;
  solves: number;
  practice: number;
  file: BackupFile;
} |
{ok: false;fileName: string;problems: string[];};

export function buildBackup(setup: BldSetup, prefs: Prefs, pairs: PairDb, solves: Solve[]): BackupFile {
  return {
    app: '3bld-trainer',
    version: 1,
    exportedAt: new Date().toISOString(),
    setup,
    prefs,
    pairs,
    solves,
    practice: { flashcards: 412, memo: 57 }
  };
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** A realistic backup from another device, used to preview the import flow. */
export function sampleBackup(current: PairDb, setup: BldSetup): BackupFile {
  const pairs: PairDb = JSON.parse(JSON.stringify(current));
  const added: Record<string, string[]> = {
    JV: ['Java'], TX: ['Texas'], NS: ['Nessie'], PW: ['paw'], RV: ['raven'], SU: ['sushi'], VK: ['Viking'], QK: ['quokka'],
    IH: ['ice hockey'], GJ: ['G.I. Joe'], XE: ['Xena'], NB: ['New Balance'], OD: ['odometer'], PH: ['phone booth'],
    RG: ['rug'], SW: ['sword'], TU: ['tuna'], UL: ['ukulele']
  };
  Object.entries(added).forEach(([flat, words]) => pairs[pairKey(flat[0], flat[1])] = { shared: words });
  pairs[pairKey('T', 'W')] = { shared: ['tower', 'tow'] };
  pairs[pairKey('H', 'P')] = { shared: ['HP Sauce'] };
  pairs[pairKey('D', 'F')] = { shared: ['dolphin', 'dumbbell'] };
  pairs[pairKey('E', 'K')] = { shared: ['Ekko'] };
  return {
    app: '3bld-trainer',
    version: 1,
    exportedAt: '2026-09-19T08:12:44Z',
    setup,
    pairs,
    solves: Array.from({ length: 1204 }, (_, i) => ({ i })),
    practice: { flashcards: 2890, memo: 311 }
  };
}

export function summarize(fileName: string, raw: unknown, current: PairDb): ImportSummary {
  const problems: string[] = [];
  const file = raw as Partial<BackupFile> | null;
  if (!file || typeof file !== 'object') return { ok: false, fileName, problems: ['not a JSON object'] };
  if (file.app !== '3bld-trainer') problems.push('not exported from this app');
  if (typeof file.version !== 'number') problems.push('missing version');
  if (!file.pairs || typeof file.pairs !== 'object') problems.push('missing letter pairs');
  if (!file.setup) problems.push('missing lettering and buffers');
  if (problems.length) return { ok: false, fileName, problems };

  const incoming = file.pairs as PairDb;
  let added = 0;
  let conflicts = 0;
  let alternates = 0;
  Object.entries(incoming).forEach(([key, entry]) => {
    alternates += Math.max(0, entry.shared.length - 1);
    const mine = current[key];
    if (!mine) added += 1;else
    if ((mine.shared[0] ?? '') !== (entry.shared[0] ?? '')) conflicts += 1;
  });
  const setup = file.setup as BldSetup;
  return {
    ok: true,
    fileName,
    exportedAt: file.exportedAt ?? '',
    lettering: isSpeffz(setup.scheme) ? 'Speffz' : setup.schemeName || 'Custom',
    buffers: `${stickerById(setup.edgeBuffer)?.piece ?? '—'} · ${stickerById(setup.cornerBuffer)?.piece ?? '—'}`,
    pairs: { total: Object.keys(incoming).length, added, conflicts },
    alternates,
    solves: file.solves?.length ?? 0,
    practice: (file.practice?.flashcards ?? 0) + (file.practice?.memo ?? 0),
    file: file as BackupFile
  };
}

export function mergePairs(current: PairDb, incoming: PairDb, strategy: MergeStrategy): PairDb {
  if (strategy === 'replace') return incoming;
  const out: PairDb = { ...current };
  Object.entries(incoming).forEach(([key, entry]) => {
    if (!out[key] || strategy === 'prefer-backup') out[key] = entry;
  });
  return out;
}
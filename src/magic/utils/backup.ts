import type { AppData } from '../../lib/repository';
import { mergeData, parseBackup } from '../../lib/repository';

export type MergeStrategy = 'keep-mine' | 'prefer-backup' | 'replace';
export type ImportSummary =
  | { ok: true; fileName: string; exportedAt: string; lettering: string; buffers: string;
      pairs: { total: number; added: number; conflicts: number }; alternates: number;
      solves: number; practice: number; file: { data: AppData } }
  | { ok: false; fileName: string; problems: string[] };

export function buildBackup(data: AppData) {
  return { version: 3, exportedAt: new Date().toISOString(), data };
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function summarize(fileName: string, raw: unknown, current: AppData): ImportSummary {
  try {
    const incoming = parseBackup(JSON.stringify(raw));
    const rawObject = raw as { exportedAt?: string };
    let added = 0, conflicts = 0, alternates = 0;
    Object.entries(incoming.pairs).forEach(([key, pair]) => {
      alternates += pair.alternates.length;
      const mine = current.pairs[key];
      if (!mine) added += 1;
      else if (mine.primaryMnemonic.trim().toLocaleLowerCase() !== pair.primaryMnemonic.trim().toLocaleLowerCase()) conflicts += 1;
    });
    return {
      ok: true, fileName, exportedAt: rawObject.exportedAt ?? new Date(0).toISOString(),
      lettering: incoming.scheme.name || 'Custom',
      buffers: `${incoming.scheme.edgeBuffer} · ${incoming.scheme.cornerBuffer}`,
      pairs: { total: Object.keys(incoming.pairs).length, added, conflicts }, alternates,
      solves: incoming.solves.filter((solve) => !solve.deleted).length,
      practice: incoming.attempts.length, file: { data: incoming }
    };
  } catch (error) {
    return { ok: false, fileName, problems: [(error as Error).message || 'not a valid BlindSolve backup'] };
  }
}

export function mergeBackup(current: AppData, incoming: AppData, strategy: MergeStrategy): AppData {
  if (strategy === 'replace') return incoming;
  return strategy === 'prefer-backup' ? mergeData(incoming, current).data : mergeData(current, incoming).data;
}

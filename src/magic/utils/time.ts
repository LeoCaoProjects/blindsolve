import { format } from 'date-fns';
import { Penalty, SessionStats, Solve } from '../types/solve';

export function formatTime(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10);
  const minutes = Math.floor(cs / 6000);
  const seconds = Math.floor(cs % 6000 / 100);
  const hundredths = String(cs % 100).padStart(2, '0');
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}.${hundredths}`;
  return `${seconds}.${hundredths}`;
}

export function effectiveTime(time: number, penalty: Penalty): number {
  if (penalty === 'dnf') return Infinity;
  return penalty === '+2' ? time + 2000 : time;
}

export function formatSolveDate(iso: string): string {
  return format(new Date(iso), "EEE d MMM yyyy '·' HH:mm");
}

export function formatSolveClock(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

export function sessionStats(solves: Solve[]): SessionStats {
  const valid = solves.filter((s) => s.penalty !== 'dnf');
  const best = valid.length ? Math.min(...valid.map((s) => effectiveTime(s.time, s.penalty))) : null;
  let mo3 = '—';
  if (solves.length >= 3) {
    const last = solves.slice(0, 3);
    mo3 = last.some((s) => s.penalty === 'dnf') ?
    'DNF' :
    formatTime(last.reduce((sum, s) => sum + effectiveTime(s.time, s.penalty), 0) / 3);
  }
  return {
    best: best === null ? '—' : formatTime(best),
    mo3,
    success: `${valid.length}/${solves.length}`,
    count: solves.length
  };
}
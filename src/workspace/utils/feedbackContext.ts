import { FeedbackTechContext } from '../types/feedback';

/**
 * Where the user was and what they were doing, for feedback. Feedback is opened from Settings,
 * so the useful "source" is the page they came from. Training records its drill and piece
 * choice here; no answers or mnemonic content are ever recorded.
 */

export const APP_BUILD = import.meta.env.VITE_APP_VERSION ?? '0.1.0';

const PAGE_LABEL: Record<string, string> = {
  '/': 'Timer',
  '/pairs': 'Letter Pairs',
  '/flashcards': 'Flashcards',
  '/training': 'Training',
  '/settings': 'Settings',
  '/setup': 'Settings',
  '/signin': 'Sign in'
};

let lastPage = '/settings';
let training: {mode: string;scope: string;} | null = null;

export function recordPage(pathname: string) {
  if (pathname !== '/settings' && !pathname.startsWith('/admin')) lastPage = pathname;
}

export function recordTraining(mode: string, scope: string) {
  training = { mode, scope };
}

/** e.g. "Training / Trace Sprint", "Letter Pairs", or "Settings" if they started there. */
export function sourceLabel(): string {
  const page = PAGE_LABEL[lastPage] ?? 'Settings';
  return lastPage === '/training' && training ? `${page} / ${training.mode}` : page;
}

function browserName(ua: string): string {
  const pick = (re: RegExp, name: string) => {
    const m = ua.match(re);
    return m ? `${name} ${m[1].split('.')[0]}` : null;
  };
  return (
    pick(/Edg\/([\d.]+)/, 'Edge') ??
    pick(/Firefox\/([\d.]+)/, 'Firefox') ??
    pick(/Chrome\/([\d.]+)/, 'Chrome') ??
    pick(/Version\/([\d.]+).*Safari/, 'Safari') ??
    'Unknown browser');

}

function osName(ua: string): string {
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown OS';
}

export function techContext(): FeedbackTechContext {
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  const touch = navigator.maxTouchPoints > 0;
  return {
    build: APP_BUILD,
    browser: browserName(ua),
    os: osName(ua),
    device: w < 768 ? 'Phone' : touch && w < 1200 ? 'Tablet' : 'Desktop',
    viewport: `${w} × ${window.innerHeight}`,
    training: lastPage === '/training' && training ? `${training.mode} · ${training.scope}` : undefined
  };
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pages from './pages.json';

export function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/';
    const page = pages[path as keyof typeof pages];
    const indexable = page && !('noindex' in page) && location.hostname === 'blindsolve.com';
    document.title = page?.title ?? 'Page Not Found | BlindSolve';
    const meta = (selector: string, content: string) => {
      document.querySelector(selector)?.setAttribute('content', content);
    };
    meta('meta[name="description"]', page?.description ?? 'This page could not be found.');
    meta('meta[name="robots"]', indexable ? 'index, follow' : 'noindex, follow');
    meta('meta[property="og:title"]', document.title);
    meta('meta[property="og:description"]', page?.description ?? 'This page could not be found.');
    meta('meta[property="og:url"]', `https://blindsolve.com${path}`);
    meta('meta[name="twitter:title"]', document.title);
    meta('meta[name="twitter:description"]', page?.description ?? 'This page could not be found.');
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://blindsolve.com${path}`);
  }, [pathname]);
  return null;
}

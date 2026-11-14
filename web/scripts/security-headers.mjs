/** Add only the configured provider origin; unconfigured builds allow no cloud. */
export function providerHeaders(headers, { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key }) {
  if (!url || !key || url.includes('YOUR-') || key.startsWith('YOUR_')) return headers;
  const parsed = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Supabase URL must be an HTTPS origin or a local HTTP origin');
  }
  const origin = parsed.origin;
  const socket = origin.replace(/^http/, 'ws');
  return headers
    .replace("img-src 'self' data: blob:;", `img-src 'self' data: blob: ${origin};`)
    .replace("media-src 'self' blob:;", `media-src 'self' blob: ${origin};`)
    .replace("connect-src 'self';", `connect-src 'self' ${origin} ${socket};`);
}

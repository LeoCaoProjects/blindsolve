import { describe, expect, it } from 'vitest';
import { providerHeaders } from './security-headers.mjs';

const base = "img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self';";
describe('provider CSP', () => {
  it('keeps cloud-disabled and placeholder builds closed', () => {
    expect(providerHeaders(base, {})).toBe(base);
    expect(providerHeaders(base, { VITE_SUPABASE_URL: 'https://YOUR-LOCAL-PROJECT.example', VITE_SUPABASE_ANON_KEY: 'YOUR_LOCAL_PUBLIC_KEY' })).toBe(base);
  });
  it('allows only the selected origin and matching socket', () => {
    expect(providerHeaders(base, { VITE_SUPABASE_URL: 'https://test.example/', VITE_SUPABASE_ANON_KEY: 'public-test' }))
      .toBe("img-src 'self' data: blob: https://test.example; media-src 'self' blob: https://test.example; connect-src 'self' https://test.example wss://test.example;");
    expect(providerHeaders(base, { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'public-test' })).toContain('ws://127.0.0.1:54321');
  });
  it('rejects nonlocal HTTP, credentials, paths and policy injection', () => {
    for (const url of ['http://test.example', 'https://user:pass@test.example', 'https://test.example/path', 'https://test.example/?x=1', "https://test.example; script-src *"]) {
      expect(() => providerHeaders(base, { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'public-test' })).toThrow();
    }
  });
});

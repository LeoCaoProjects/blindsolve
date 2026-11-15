import { describe, expect, it } from 'vitest';
import { WCA_OAUTH_SCOPE, wcaOAuthCallbackUrl } from '../../../supabase/functions/wca-oauth/oauth';
import edgeFunctionSource from '../../../supabase/functions/wca-oauth/index.ts?raw';

describe('WCA OAuth configuration', () => {
  it('derives the exact deployed callback from SUPABASE_URL', () => {
    expect(wcaOAuthCallbackUrl('https://project.example')).toBe(
      'https://project.example/functions/v1/wca-oauth/callback',
    );
  });

  it('ignores an unrelated path on SUPABASE_URL and never downgrades HTTPS', () => {
    expect(wcaOAuthCallbackUrl('https://project.example/internal/path')).toBe(
      'https://project.example/functions/v1/wca-oauth/callback',
    );
    expect(() => wcaOAuthCallbackUrl('http://project.example')).toThrow(
      'SUPABASE_URL must use HTTPS',
    );
  });

  it('requests the public identity and email scopes used by the account bridge', () => {
    expect(WCA_OAUTH_SCOPE).toBe('public email');
  });

  it('uses the same derived callback for authorization and token exchange', () => {
    expect(edgeFunctionSource.match(/redirect_uri: callback/g)).toHaveLength(2);
    expect(edgeFunctionSource).not.toMatch(/url\.origin.*callback/);
  });

  it('enforces separate durable start and callback rate limits before provider calls', () => {
    expect(edgeFunctionSource).toContain('consumeRateLimit(admin, isCallback ? "wca-callback" : "wca-start", req)');
    expect(edgeFunctionSource).toContain('status: 429');
    expect(edgeFunctionSource).toContain('"retry-after": "600"');
  });

  it('always marks the OAuth state cookie Secure at the public Edge boundary', () => {
    expect(edgeFunctionSource).toContain('Max-Age=600; Secure');
    expect(edgeFunctionSource).not.toContain('const secure =');
  });
});

import { describe, expect, it } from 'vitest';
import { WCA_OAUTH_SCOPE, wcaOAuthCallbackUrl } from '../../supabase/functions/wca-oauth/oauth';
import edgeFunctionSource from '../../supabase/functions/wca-oauth/index.ts?raw';

describe('WCA OAuth configuration', () => {
  it('derives the exact deployed callback from SUPABASE_URL', () => {
    expect(wcaOAuthCallbackUrl('https://dvujcwvavwcflymksmuz.supabase.co')).toBe(
      'https://dvujcwvavwcflymksmuz.supabase.co/functions/v1/wca-oauth/callback',
    );
  });

  it('ignores an unrelated path on SUPABASE_URL and never downgrades HTTPS', () => {
    expect(wcaOAuthCallbackUrl('https://dvujcwvavwcflymksmuz.supabase.co/internal/path')).toBe(
      'https://dvujcwvavwcflymksmuz.supabase.co/functions/v1/wca-oauth/callback',
    );
    expect(() => wcaOAuthCallbackUrl('http://dvujcwvavwcflymksmuz.supabase.co')).toThrow(
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
});

import { describe, expect, it } from 'vitest';
import sql from '../../../supabase/migrations/202609280001_api_grants.sql?raw';
import hardenedSql from '../../../supabase/migrations/202609280002_harden_api_privileges.sql?raw';
import hardenedViewSql from '../../../supabase/migrations/202609280003_harden_solve_details_view.sql?raw';

describe('Supabase API grants', () => {
  it('grants authenticated API access while leaving row ownership to RLS', () => {
    expect(sql).toMatch(/grant select on table[\s\S]*public\.letter_pairs[\s\S]*public\.sticker_labels[\s\S]*to authenticated/i);
    expect(sql).toMatch(/grant insert on table public\.feedback to anon/i);
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.feedback to authenticated/i);
  });

  it('does not expose direct feedback admin membership access', () => {
    expect(sql).not.toMatch(/grant[^;]+public\.feedback_admins/i);
  });

  it('removes implicit destructive privileges before granting the minimum API surface', () => {
    const statements = hardenedSql.replace(/--.*$/gm, '');
    expect(hardenedSql).toMatch(/revoke truncate, references, trigger on table[\s\S]*public\.profiles[\s\S]*public\.feedback_admins[\s\S]*from anon, authenticated/i);
    expect(statements).not.toMatch(/grant[^;]+\btruncate\b/i);
    expect(statements).not.toMatch(/grant[^;]+public\.feedback_admins/i);
    expect(hardenedViewSql).toMatch(/revoke truncate, references, trigger on table public\.solve_details from anon, authenticated/i);
  });
});

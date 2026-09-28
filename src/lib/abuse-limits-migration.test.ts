import { describe, expect, it } from "vitest";
import sql from "../../supabase/migrations/202609290001_abuse_limits.sql?raw";
import videoSql from "../../supabase/migrations/202609290002_solve_video_quota.sql?raw";

describe("application abuse limits", () => {
  it("keeps edge counters private and callable only by the service role", () => {
    expect(sql).toContain("create table public.edge_rate_limits");
    expect(sql).toMatch(/consume_edge_rate_limit[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(sql).toContain("grant execute on function public.consume_edge_rate_limit(text, text) to service_role");
    expect(sql).toContain("revoke all on table public.edge_rate_limits, public.bld_sync_rate_limits from public, anon, authenticated");
  });

  it("limits WCA start and callback independently", () => {
    expect(sql).toContain("when p_scope = 'wca-start' then 30 else 15");
    expect(sql).toContain("interval '10 minutes'");
  });

  it("allows normal sync bursts but rejects sustained successful RPC abuse", () => {
    expect(sql).toContain("create table public.bld_sync_rate_limits");
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain("if sync_requests > 120 then");
    expect(sql).toContain("Sync rate limit exceeded");
    expect(sql).toContain("octet_length(changes::text) > 5000000");
  });

  it("caps aggregate private solve-video storage per account", () => {
    expect(videoSql).toMatch(/can_store_solve_video[\s\S]*security definer[\s\S]*set search_path = ''/i);
    expect(videoSql).toContain("count(*) < 100");
    expect(videoSql).toContain("+ p_size <= 2147483648");
    expect(videoSql).toContain("p_size between 1 and 262144000");
    expect(videoSql).toContain("public.owns_solve");
  });
});

import { describe, expect, it } from "vitest";
import sql from "../../../supabase/migrations/202609280005_security_hardening.sql?raw";

describe("pre-production database hardening", () => {
  it("makes the revision-checked RPC the only authenticated sync write path", () => {
    expect(sql).toMatch(
      /apply_bld_sync_changes[\s\S]*security definer[\s\S]*set search_path = ''/i,
    );
    expect(sql).toContain(
      "revoke insert, update, delete on table public.bld_sync_records from authenticated",
    );
    expect(sql).toContain(
      "revoke insert, update, delete on table public.bld_sync_state from authenticated",
    );
    expect(sql).toContain(
      "revoke execute on function public.save_bld_workspace(jsonb, bigint) from authenticated",
    );
  });

  it("binds writes to auth.uid and rejects oversized, duplicated, or malformed records", () => {
    expect(sql).toContain("select auth.uid(), x.kind, x.record_id");
    expect(sql).toContain("octet_length(changes::text) > 5000000");
    expect(sql).toContain("having count(*) > 1");
    expect(sql).toContain("x.payload->>'id' is distinct from x.record_id");
    expect(sql).toContain("x.updated_at > now() + interval '10 minutes'");
  });

  it("uses an empty search path for the feedback admin privilege helper", () => {
    expect(sql).toMatch(
      /is_feedback_admin\(\)[\s\S]*security definer[\s\S]*set search_path = ''/i,
    );
  });
});

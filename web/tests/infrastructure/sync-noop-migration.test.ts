import { describe, expect, it } from "vitest";
import sql from "../../../supabase/migrations/202609290004_sync_noop_batches.sql?raw";

describe("sync no-op database hardening", () => {
  it("returns before rate limiting and revision advancement for identical batches", () => {
    const noOpReturn = sql.search(
      /if not has_changes then\r?\n[ ]{4}return current_revision/,
    );
    const limiter = sql.indexOf("insert into public.bld_sync_rate_limits");
    const revision = sql.indexOf("set revision = revision + 1");
    expect(noOpReturn).toBeGreaterThan(-1);
    expect(noOpReturn).toBeLessThan(limiter);
    expect(limiter).toBeLessThan(revision);
  });

  it("keeps divergent stale revisions as serialization conflicts", () => {
    expect(sql).toMatch(
      /current_revision <> expected_revision[\s\S]*not has_changes[\s\S]*errcode = '40001'/,
    );
  });

  it("treats absent or tombstoned deletions as no-ops", () => {
    expect(sql).toMatch(
      /when x\.deleted then r\.user_id is not null and not r\.deleted/,
    );
  });

  it("writes only records whose logical state changed", () => {
    expect(sql.match(/where case/g)).toHaveLength(2);
    expect(sql).toContain(
      "else r.user_id is null or r.deleted or r.payload is distinct from x.payload",
    );
  });
});

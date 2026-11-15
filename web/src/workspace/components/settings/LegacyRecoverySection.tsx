import { useEffect, useRef, useState } from "react";
import { useStore } from "../../../app/Store";
import { downloadJson } from "../../utils/backup";
import { SecondaryButton } from "../common/PrimaryButton";
import { SettingsRow } from "./SettingsSection";

export function LegacyRecoverySection({ account }: { account: string }) {
  const store = useStore();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function exportRecords() {
    const workspace = store.workspaceIdentity();
    const isCurrent = () => active.current && store.workspaceIdentity() === workspace;
    setPending(true);
    setMessage("");
    try {
      const review = await store.readLegacyRecovery(account);
      if (!isCurrent()) return;
      const status = review.tables.map(({ table, status, rows }) =>
        `${table === "practice_attempts" ? "Practice attempts" : "Letter Pair aliases"}: ${status === "unavailable" ? "access unavailable" : `${rows.length} recovered${status === "partial" ? " (partial)" : ""}`}`,
      ).join(". ");
      if (review.tables.some(({ status, rows }) => status === "complete" || rows.length > 0))
        downloadJson(review, "blindsolve-v1-review.json");
      setMessage(status + ".");
    } catch (error) {
      if (isCurrent())
        setMessage(error instanceof Error ? error.message : "Legacy records could not be read.");
    } finally {
      if (active.current) setPending(false);
    }
  }

  return (
    <>
      <SettingsRow
        label="Legacy records"
        hint="Export old practice attempts and Letter Pair aliases for review."
      >
        <SecondaryButton disabled={pending} onClick={() => void exportRecords()}>
          {pending ? "Reading legacy records…" : "Export legacy records"}
        </SecondaryButton>
      </SettingsRow>
      <p role="status" className="text-sm text-ink-2">{message}</p>
    </>
  );
}

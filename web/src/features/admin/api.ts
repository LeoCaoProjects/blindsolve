import { supabase } from "../../lib/supabase";
export type AdminRange = "24h" | "7d" | "30d" | "all";
export interface AdminReport {
  updatedAt: string;
  since: string | null;
  registeredAccounts: number;
  newAccounts: number;
  activeUsers: number;
  solves: number;
  training: number;
  undatedSolves: number;
  undatedTraining: number;
  trend: { day: string; accounts: number; solves: number; training: number }[];
  modes: { mode: string; attempts: number }[];
  feedback: { new: number; open: number };
}
export async function loadOverview(
  period: AdminRange,
  signal: AbortSignal,
): Promise<AdminReport> {
  if (!supabase) throw new Error("Cloud is unavailable");
  const { data, error } = await supabase
    .rpc("admin_overview", { period })
    .abortSignal(signal);
  if (error || !data) throw error ?? new Error("Admin overview unavailable");
  return data as AdminReport;
}

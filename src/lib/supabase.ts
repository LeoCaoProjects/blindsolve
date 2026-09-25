import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes("YOUR-") && !anonKey.startsWith("YOUR_")
    ? createClient(url, anonKey)
    : null;
export const cloudConfigured = Boolean(supabase);

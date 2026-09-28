export const WCA_OAUTH_SCOPE = "public email";

export function wcaOAuthCallbackUrl(supabaseUrl: string) {
  const base = new URL(supabaseUrl);
  if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
    throw new Error("SUPABASE_URL must use HTTPS");
  }
  return new URL("/functions/v1/wca-oauth/callback", `${base.origin}/`).toString();
}

import { createClient } from "npm:@supabase/supabase-js@2";
import { WCA_OAUTH_SCOPE, wcaOAuthCallbackUrl } from "./oauth.ts";

const WCA = "https://www.worldcubeassociation.org";

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function redirect(location: string, cookie?: string) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  if (cookie) headers.set("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

function cookie(req: Request, name: string) {
  const value = req.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function safeAppUrl() {
  const value = required("APP_URL");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("APP_URL must use HTTPS");
  }
  return url.origin;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const appUrl = safeAppUrl();
  const callback = wcaOAuthCallbackUrl(required("SUPABASE_URL"));

  try {
    if (req.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET", "cache-control": "no-store" },
      });
    }
    if (!url.pathname.endsWith("/callback")) {
      const state = crypto.randomUUID();
      const authorize = new URL("/oauth/authorize", WCA);
      authorize.search = new URLSearchParams({
        client_id: required("WCA_CLIENT_ID"),
        redirect_uri: callback,
        response_type: "code",
        scope: WCA_OAUTH_SCOPE,
        state,
      }).toString();
      const secure = url.protocol === "https:" ? "; Secure" : "";
      return redirect(authorize.toString(), `wca_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
    }

    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (!state || !code || state !== cookie(req, "wca_oauth_state")) throw new Error("The WCA sign-in state was invalid or expired");

    const tokenResponse = await fetch(`${WCA}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: required("WCA_CLIENT_ID"),
        client_secret: required("WCA_CLIENT_SECRET"),
        redirect_uri: callback,
        code,
      }),
    });
    if (!tokenResponse.ok) throw new Error("WCA rejected the authorization code");
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error("WCA did not return an access token");

    const meResponse = await fetch(`${WCA}/api/v0/me`, {
      headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
    });
    if (!meResponse.ok) throw new Error("WCA account details could not be loaded");
    const body = await meResponse.json() as { me?: { id?: number; email?: string; name?: string; wca_id?: string | null } };
    const me = body.me;
    if (!me?.id || !me.email) throw new Error("The WCA account does not expose a verified email address");

    const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: me.email,
      options: { data: { provider: "wca", wca_user_id: me.id, wca_id: me.wca_id, full_name: me.name } },
    });
    if (error || !data.properties?.hashed_token) throw error ?? new Error("Supabase did not create a sign-in token");
    const { error: metadataError } = await admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: { ...data.user.user_metadata, auth_source: "wca", wca_user_id: me.id, wca_id: me.wca_id, full_name: me.name },
    });
    if (metadataError) throw metadataError;

    const destination = new URL("/signin", appUrl);
    destination.hash = new URLSearchParams({ wca_token_hash: data.properties.hashed_token }).toString();
    return redirect(destination.toString(), "wca_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
  } catch (error) {
    // Do not reflect provider, Supabase, or configuration details into the browser URL.
    console.error("WCA OAuth failed", error instanceof Error ? error.name : "UnknownError");
    const destination = new URL("/signin", appUrl);
    destination.searchParams.set("auth_error", "WCA sign-in failed. Please try again.");
    return redirect(destination.toString(), "wca_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure");
  }
});

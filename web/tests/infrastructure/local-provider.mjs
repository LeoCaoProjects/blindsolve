/** Disposable local provider contract. Never accepts a hosted URL or database. */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
export const base = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(new URL(base).protocol, "http:");
const container =
  process.env.LOCAL_SUPABASE_CONTAINER ?? "supabase_db_admin-db";
assert.match(container, /^supabase_db_[a-z0-9-]+$/);
const secret = process.env.LOCAL_SUPABASE_JWT_SECRET;
assert.ok(secret, "Supply only the disposable stack JWT secret");
export const jwt = (role, sub, expired = false) => {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      role,
      ...(sub ? { sub } : {}),
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    }),
  ).toString("base64url");
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
};
export const service = jwt("service_role");
export const anon = jwt("anon");
export const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: query, encoding: "utf8" },
  ).trim();
export const request = (path, token, body, method = "POST") =>
  fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

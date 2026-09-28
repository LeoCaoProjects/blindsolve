import { createClient, type User } from "npm:@supabase/supabase-js@2";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(["bug", "feature", "general"]);

function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function allowedOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const appOrigin = new URL(required("APP_URL")).origin;
  return origin === appOrigin ? origin : null;
}

function cors(origin: string | null) {
  return {
    ...(origin ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function json(
  status: number,
  body: Record<string, unknown>,
  origin: string | null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function clientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0] ??
    req.headers.get("x-real-ip") ??
    "unknown"
  ).trim();
}

async function fingerprint(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(required("SUPABASE_SERVICE_ROLE_KEY")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function detectedImageType(bytes: Uint8Array) {
  const starts = (...expected: number[]) =>
    expected.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { type: "image/png", extension: "png" };
  if (starts(0xff, 0xd8, 0xff)) return { type: "image/jpeg", extension: "jpg" };
  const ascii = (from: number, length: number) =>
    new TextDecoder().decode(bytes.slice(from, from + length));
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")
    return { type: "image/gif", extension: "gif" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")
    return { type: "image/webp", extension: "webp" };
  return null;
}

function cleanText(
  value: FormDataEntryValue | null,
  max: number,
  requiredValue = false,
) {
  const result = typeof value === "string" ? value.trim() : "";
  if ((requiredValue && !result) || result.length > max)
    throw new Error("invalid-input");
  return result;
}

async function authenticatedUser(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<User | null> {
  const authorization = req.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);
  if (req.method === "OPTIONS")
    return new Response(null, {
      status: origin ? 204 : 403,
      headers: cors(origin),
    });
  if (req.method !== "POST")
    return json(405, { error: "Method not allowed" }, origin);
  if (!origin) return json(403, { error: "Origin not allowed" }, null);

  const admin = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  try {
    const ipFingerprint = await fingerprint(clientIp(req));
    const { data: accepted, error: rateError } = await admin.rpc(
      "consume_feedback_submission_slot",
      {
        p_fingerprint: ipFingerprint,
      },
    );
    if (rateError) throw new Error("rate-limit-unavailable");
    if (!accepted)
      return json(
        429,
        { error: "Too many feedback submissions. Please try again later." },
        origin,
      );

    const form = await req.formData();
    const category = cleanText(form.get("category"), 20, true);
    if (!ALLOWED_CATEGORIES.has(category)) throw new Error("invalid-input");
    const message = cleanText(form.get("message"), 10_000, true);
    const contact = cleanText(form.get("contact"), 320);
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
      throw new Error("invalid-input");
    const source = cleanText(form.get("source"), 500, true);
    const contextText = cleanText(form.get("context"), 32_768);
    let context: Record<string, unknown> | null = null;
    if (contextText) {
      const parsed: unknown = JSON.parse(contextText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("invalid-input");
      context = parsed as Record<string, unknown>;
    }

    const user = await authenticatedUser(req, admin);
    const id = crypto.randomUUID();
    const screenshot = form.get("screenshot");
    let screenshotPath: string | null = null;
    let screenshotName: string | null = null;

    if (screenshot instanceof File && screenshot.size > 0) {
      if (
        screenshot.size > MAX_SCREENSHOT_BYTES ||
        screenshot.name.length > 255
      )
        throw new Error("invalid-input");
      const bytes = new Uint8Array(await screenshot.arrayBuffer());
      const image = detectedImageType(bytes);
      if (!image) throw new Error("invalid-input");
      screenshotName = screenshot.name;
      screenshotPath = `${id}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await admin.storage
        .from("feedback-screenshots")
        .upload(screenshotPath, bytes, {
          contentType: image.type,
          upsert: false,
        });
      if (error) throw new Error("upload-failed");
    }

    const provider =
      user?.user_metadata.auth_source === "wca"
        ? "wca"
        : user
          ? "google"
          : null;
    const row = {
      id,
      user_id: user?.id ?? null,
      contact_email: user ? null : contact || null,
      category,
      message,
      source_page: source,
      technical_context: context,
      screenshot_path: screenshotPath,
      screenshot_name: screenshotName,
      submitter_name: user
        ? String(
            user.user_metadata.full_name ??
              user.user_metadata.name ??
              user.email ??
              "Signed in",
          ).slice(0, 200)
        : null,
      submitter_detail: user
        ? String(user.user_metadata.wca_id ?? user.email ?? "").slice(0, 320)
        : null,
      submitter_provider: provider,
    };
    const { error } = await admin.from("feedback").insert(row);
    if (error) {
      if (screenshotPath)
        await admin.storage
          .from("feedback-screenshots")
          .remove([screenshotPath]);
      throw new Error("insert-failed");
    }

    return json(201, { id, createdAt: new Date().toISOString() }, origin);
  } catch (error) {
    const code =
      error instanceof Error &&
      [
        "invalid-input",
        "rate-limit-unavailable",
        "upload-failed",
        "insert-failed",
      ].includes(error.message)
        ? error.message
        : "unexpected";
    console.error("Feedback submission failed", code);
    const expected = code === "invalid-input";
    return json(
      expected ? 400 : 500,
      {
        error: expected
          ? "Invalid feedback submission"
          : "Feedback could not be submitted",
        code,
      },
      origin,
    );
  }
});

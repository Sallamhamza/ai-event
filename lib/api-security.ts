type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response };

interface JsonBodyOptions {
  maxBytes: number;
  invalidMessage?: string;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function checkRateLimit(
  request: Request,
  { key, limit, windowMs }: RateLimitOptions
): Response | null {
  const now = Date.now();
  const clientKey = `${key}:${getClientIp(request)}`;
  const bucket = rateBuckets.get(clientKey);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(clientKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return jsonError("Too many requests. Please wait a moment and try again.", 429, {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
  });
}

export function enforceSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (origin === new URL(request.url).origin) return null;

  return jsonError("Cross-origin requests are not allowed.", 403);
}

export async function readJsonBody(
  request: Request,
  { maxBytes, invalidMessage = "Invalid JSON request." }: JsonBodyOptions
): Promise<JsonBodyResult> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      response: jsonError("Request body is too large.", 413),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: jsonError("Could not read request body.", 400),
    };
  }

  if (text.length > maxBytes) {
    return {
      ok: false,
      response: jsonError("Request body is too large.", 413),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: jsonError(invalidMessage, 400),
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function requiredString(
  value: unknown,
  fieldName: string,
  maxLength: number
): { ok: true; value: string } | { ok: false; response: Response } {
  if (typeof value !== "string") {
    return {
      ok: false,
      response: jsonError(`Missing or invalid ${fieldName}.`, 400),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      response: jsonError(`Missing ${fieldName}.`, 400),
    };
  }

  if (trimmed.length > maxLength) {
    return {
      ok: false,
      response: jsonError(`${fieldName} is too long.`, 400),
    };
  }

  return { ok: true, value: trimmed };
}

export function requiredSafeId(
  value: unknown,
  fieldName: string
): { ok: true; value: string } | { ok: false; response: Response } {
  const parsed = requiredString(value, fieldName, 200);
  if (!parsed.ok) return parsed;

  if (!/^[A-Za-z0-9_.:-]+$/.test(parsed.value)) {
    return {
      ok: false,
      response: jsonError(`Invalid ${fieldName}.`, 400),
    };
  }

  return parsed;
}

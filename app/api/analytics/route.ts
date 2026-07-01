import {
  getAnalyticsSummary,
  isAnalyticsEventName,
  recordAnalyticsEvent,
} from "@/lib/analytics-store";
import { asRecord, checkRateLimit, enforceSameOrigin, readJsonBody } from "@/lib/api-security";

export const runtime = "nodejs";

const MAX_ANALYTICS_BODY_BYTES = 2_000;

function sanitizeMeta(value: unknown): Record<string, string | number | boolean | null> | undefined {
  const input = asRecord(value);
  if (!input) return undefined;

  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, child] of Object.entries(input).slice(0, 12)) {
    if (!/^[A-Za-z0-9_.:-]{1,40}$/.test(key)) continue;
    if (
      typeof child === "string" ||
      typeof child === "number" ||
      typeof child === "boolean" ||
      child === null
    ) {
      output[key] = typeof child === "string" ? child.slice(0, 160) : child;
    }
  }

  return Object.keys(output).length ? output : undefined;
}

export async function GET() {
  return Response.json(getAnalyticsSummary(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const originGuard = enforceSameOrigin(request);
  if (originGuard) return originGuard;

  const rateLimit = checkRateLimit(request, {
    key: "analytics",
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const bodyResult = await readJsonBody(request, {
    maxBytes: MAX_ANALYTICS_BODY_BYTES,
    invalidMessage: "Invalid analytics payload.",
  });
  if (!bodyResult.ok) return bodyResult.response;

  const body = asRecord(bodyResult.data);
  if (!body || !isAnalyticsEventName(body.event)) {
    return Response.json({ error: "Invalid analytics event." }, { status: 400 });
  }

  const language = body.language === "ar" ? "ar" : body.language === "en" ? "en" : undefined;
  recordAnalyticsEvent({
    event: body.event,
    language,
    at: Date.now(),
    meta: sanitizeMeta(body.meta),
  });

  return Response.json({ ok: true });
}

import { readEventAdminSnapshot, saveEventJson } from "@/lib/event-admin";
import { asRecord, checkRateLimit, enforceSameOrigin, readJsonBody, requiredString } from "@/lib/api-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENT_BODY_BYTES = 160_000;

export async function GET() {
  try {
    return Response.json(readEventAdminSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not read event content.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const originGuard = enforceSameOrigin(request);
  if (originGuard) return originGuard;

  const rateLimit = checkRateLimit(request, {
    key: "admin-event",
    limit: 12,
    windowMs: 60_000,
  });
  if (rateLimit) return rateLimit;

  const bodyResult = await readJsonBody(request, {
    maxBytes: MAX_EVENT_BODY_BYTES,
    invalidMessage: "Please send valid JSON.",
  });
  if (!bodyResult.ok) return bodyResult.response;

  const body = asRecord(bodyResult.data);
  if (!body) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = requiredString(body.content, "content", MAX_EVENT_BODY_BYTES);
  if (!content.ok) return content.response;

  try {
    return Response.json(saveEventJson(content.value), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not save event content.",
      },
      { status: 400 }
    );
  }
}

// app/api/did-stream/ice/route.ts
// Relays ICE candidates from the browser to D-ID.

import {
  asRecord,
  checkRateLimit,
  enforceSameOrigin,
  readJsonBody,
  requiredSafeId,
  requiredString,
} from "@/lib/api-security";

const DID_API = "https://api.d-id.com";
const MAX_ICE_BODY_BYTES = 6_000;

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const originGuard = enforceSameOrigin(req);
    if (originGuard) return originGuard;

    const rateLimit = checkRateLimit(req, {
      key: "did-stream-ice",
      limit: 120,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const bodyResult = await readJsonBody(req, { maxBytes: MAX_ICE_BODY_BYTES });
    if (!bodyResult.ok) return bodyResult.response;

    const body = asRecord(bodyResult.data);
    if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

    const streamId = requiredSafeId(body.streamId, "streamId");
    if (!streamId.ok) return streamId.response;

    const sessionId = requiredString(body.sessionId, "sessionId", 200);
    if (!sessionId.ok) return sessionId.response;

    const candidate = asRecord(body.candidate);

    const payload = candidate
      ? { ...candidate, session_id: sessionId.value }
      : { session_id: sessionId.value };

    const iceRes = await fetch(`${DID_API}/talks/streams/${streamId.value}/ice`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const iceData = await iceRes.json().catch(() => ({}));
    if (!iceRes.ok) {
      console.error("[DID/ice] D-ID rejected candidate:", iceRes.status, iceData);
    }

    return Response.json({ ok: iceRes.ok, status: iceRes.status, data: iceData });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

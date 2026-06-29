// app/api/did-stream/sdp/route.ts
// Sends the browser's SDP answer back to D-ID to complete the WebRTC handshake.

import {
  asRecord,
  checkRateLimit,
  enforceSameOrigin,
  readJsonBody,
  requiredSafeId,
  requiredString,
} from "@/lib/api-security";

const DID_API = "https://api.d-id.com";
const MAX_SDP_BODY_BYTES = 20_000;

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
      key: "did-stream-sdp",
      limit: 30,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const bodyResult = await readJsonBody(req, { maxBytes: MAX_SDP_BODY_BYTES });
    if (!bodyResult.ok) return bodyResult.response;

    const body = asRecord(bodyResult.data);
    if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

    const streamId = requiredSafeId(body.streamId, "streamId");
    if (!streamId.ok) return streamId.response;

    const sessionId = requiredString(body.sessionId, "sessionId", 200);
    if (!sessionId.ok) return sessionId.response;

    const answer = asRecord(body.answer);
    if (!answer || typeof answer.type !== "string" || typeof answer.sdp !== "string") {
      return Response.json({ error: "Invalid SDP answer." }, { status: 400 });
    }

    if (answer.sdp.length > 16_000) {
      return Response.json({ error: "SDP answer is too large." }, { status: 400 });
    }

    const res = await fetch(`${DID_API}/talks/streams/${streamId.value}/sdp`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer, session_id: sessionId.value }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: "SDP exchange failed", details: data }, { status: res.status });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

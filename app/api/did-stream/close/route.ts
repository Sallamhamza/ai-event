// app/api/did-stream/close/route.ts
// Called via navigator.sendBeacon on page unload — must be POST.
// Closes an active D-ID stream session so it doesn't count against the concurrent limit.

import { asRecord, enforceSameOrigin, readJsonBody, requiredSafeId } from "@/lib/api-security";

const DID_API = "https://api.d-id.com";
const MAX_CLOSE_BODY_BYTES = 1_000;

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) return "";
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const originGuard = enforceSameOrigin(req);
    if (originGuard) return originGuard;

    const bodyResult = await readJsonBody(req, { maxBytes: MAX_CLOSE_BODY_BYTES });
    if (!bodyResult.ok) return new Response("ok", { status: 200 });

    const body = asRecord(bodyResult.data);
    const streamId = requiredSafeId(body?.streamId, "streamId");
    if (!streamId.ok) return new Response("ok", { status: 200 });

    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : undefined;

    await fetch(`${DID_API}/talks/streams/${streamId.value}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    return new Response("ok", { status: 200 });
  } catch {
    return new Response("ok", { status: 200 }); // always 200 for beacon
  }
}

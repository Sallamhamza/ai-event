// app/api/did-stream/ice/route.ts
// Relays ICE candidates from the browser to D-ID.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, candidate } = await req.json();

    const payload = candidate
      ? { ...candidate, session_id: sessionId }
      : { session_id: sessionId };

    const iceRes = await fetch(`${DID_API}/talks/streams/${streamId}/ice`, {
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

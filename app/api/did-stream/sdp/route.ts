// app/api/did-stream/sdp/route.ts
// Sends the browser's SDP answer back to D-ID to complete the WebRTC handshake.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, answer } = await req.json();

    const res = await fetch(`${DID_API}/talks/streams/${streamId}/sdp`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer, session_id: sessionId }),
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

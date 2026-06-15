// app/api/did-agent/ice/route.ts
// Relays ICE candidates from the browser to D-ID for an Agent stream.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, candidate } = await req.json();
    const agentId = process.env.DID_AGENT_ID?.trim();
    if (!agentId) return Response.json({ error: "Missing DID_AGENT_ID" }, { status: 500 });

    const payload = candidate
      ? { ...candidate, session_id: sessionId }
      : { session_id: sessionId };

    await fetch(`${DID_API}/agents/${agentId}/streams/${streamId}/ice`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

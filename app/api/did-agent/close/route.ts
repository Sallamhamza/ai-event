// app/api/did-agent/close/route.ts
// Closes/deletes an active D-ID Agent stream session.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { streamId, sessionId } = body;
    const agentId = process.env.DID_AGENT_ID?.trim();

    if (!streamId || !agentId) return Response.json({ ok: true });

    await fetch(`${DID_API}/agents/${agentId}/streams/${streamId}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

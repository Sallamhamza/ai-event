// app/api/did-agent/talk/route.ts
// Sends text to the active D-ID Agent stream so the avatar speaks over WebRTC.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, text } = await req.json();
    const agentId = process.env.DID_AGENT_ID?.trim();
    if (!agentId) return Response.json({ error: "Missing DID_AGENT_ID" }, { status: 500 });
    if (!streamId || !text) {
      return Response.json({ error: "Missing streamId or text" }, { status: 400 });
    }

    const res = await fetch(`${DID_API}/agents/${agentId}/streams/${streamId}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        script: {
          type: "text",
          input: text,
          provider: {
            type: "microsoft",
            voice_id: process.env.DID_VOICE_ID?.trim() || "en-US-GuyNeural",
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("D-ID Agent stream talk error:", data);
      return Response.json({ error: "Agent stream talk failed", details: data }, { status: res.status });
    }
    return Response.json({ ok: true, duration: data?.duration, data });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// app/api/did-agent/stream/route.ts
// Creates a D-ID Agent WebRTC stream session.
// Flow mirrors /talks/streams but uses /agents/{id}/streams

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY in .env.local");
  return `Basic ${key}`;
}

export async function POST() {
  try {
    const agentId = process.env.DID_AGENT_ID?.trim();
    if (!agentId) {
      return Response.json({ error: "Missing DID_AGENT_ID in .env.local" }, { status: 500 });
    }

    const res = await fetch(`${DID_API}/agents/${agentId}/streams`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compatibility_mode: "auto",
        stream_warmup: true,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("D-ID Agent create stream error:", data);
      return Response.json(
        { error: data?.description ?? data?.kind ?? "Failed to create agent stream", details: data },
        { status: res.status }
      );
    }

    return Response.json({
      id:         data.id,
      sessionId:  data.session_id,
      offer:      data.jsep ?? data.offer,
      iceServers: data.ice_servers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("D-ID Agent POST error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

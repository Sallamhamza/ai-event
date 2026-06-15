// app/api/did-stream/route.ts
// D-ID Streaming Avatar — session management proxy.
// Avoids CORS issues by routing all D-ID API calls through the Next.js backend.
//
// POST   /api/did-stream          → create a new D-ID stream session
// DELETE /api/did-stream          → close an existing session

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY in .env.local");
  // D-ID keys are already base64-encoded (format: base64(email:token))
  // Just prepend "Basic " — do NOT re-encode
  return `Basic ${key}`;
}

// ── POST: create stream ───────────────────────────────────────────────────────
export async function POST() {
  try {
    const presenterUrl =
      process.env.DID_PRESENTER_URL?.trim() ||
      "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg";

    const res = await fetch(`${DID_API}/talks/streams`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: presenterUrl,
        compatibility_mode: "on",
        stream_warmup: true,
        config: { stitch: true },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("D-ID create stream error:", data);
      const didMsg = data?.description ?? data?.message ?? data?.error ?? JSON.stringify(data);
      return Response.json(
        { error: `D-ID ${res.status}: ${didMsg}`, details: data },
        { status: res.status }
      );
    }

    // Return session data the client needs for WebRTC
    return Response.json({
      id: data.id,
      sessionId: data.session_id,
      offer: data.jsep ?? data.offer, // SDP offer from D-ID
      iceServers: data.ice_servers, // STUN/TURN servers
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("D-ID POST error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE: close stream ──────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { streamId, sessionId } = await req.json();
    if (!streamId) return Response.json({ ok: true }); // nothing to close

    await fetch(`${DID_API}/talks/streams/${streamId}`, {
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

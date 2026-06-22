// app/api/did-stream/talk/route.ts
// Sends a text script to D-ID to make the streaming avatar speak.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, text, language } = await req.json();
    const lang = language === "ar" ? "ar" : "en";

    if (!streamId || !text) {
      return Response.json({ error: "Missing streamId or text" }, { status: 400 });
    }

    // Male voices: English = GuyNeural, Arabic = HamedNeural
    const voiceId = lang === "ar"
      ? (process.env.DID_VOICE_ID_AR?.trim() || "ar-SA-HamedNeural")
      : (process.env.DID_VOICE_ID?.trim()    || "en-US-GuyNeural");

    const res = await fetch(`${DID_API}/talks/streams/${streamId}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        script: {
          type:     "text",
          input:    text,
          provider: { type: "microsoft", voice_id: voiceId },
        },
        config:     { stitch: true },
        session_id: sessionId,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return Response.json({ error: "Talk request failed", details: data }, { status: res.status });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

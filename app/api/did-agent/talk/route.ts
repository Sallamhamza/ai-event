// app/api/did-agent/talk/route.ts
// Sends text to the active D-ID Agent stream so the avatar speaks over WebRTC.

import { detectLanguageFromText } from "@/lib/language";

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { streamId, sessionId, text, language } = await req.json();
    const agentId = process.env.DID_AGENT_ID?.trim();
    const fallbackLang = language === "ar" ? "ar" : "en";
    const lang = detectLanguageFromText(String(text ?? ""), fallbackLang);
    if (!agentId) return Response.json({ error: "Missing DID_AGENT_ID" }, { status: 500 });
    if (!streamId || !text) {
      return Response.json({ error: "Missing streamId or text" }, { status: 400 });
    }

    const voiceId = lang === "ar"
      ? (process.env.DID_VOICE_ID_AR?.trim() || "ar-SA-HamedNeural")
      : (process.env.DID_VOICE_ID?.trim() || "en-US-GuyNeural");

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
            voice_id: voiceId,
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("D-ID Agent stream talk error:", data);
      return Response.json({ error: "Agent stream talk failed", details: data }, { status: res.status });
    }
    return Response.json({ ok: true, language: lang, voice_id: voiceId, duration: data?.duration, data });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

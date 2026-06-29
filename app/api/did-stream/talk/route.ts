// app/api/did-stream/talk/route.ts
// Sends a text script to D-ID to make the streaming avatar speak.

import {
  asRecord,
  checkRateLimit,
  enforceSameOrigin,
  readJsonBody,
  requiredSafeId,
  requiredString,
} from "@/lib/api-security";
import { resolveDidSpeech } from "@/lib/did-voice";

const DID_API = "https://api.d-id.com";
const MAX_TALK_BODY_BYTES = 6_000;
const MAX_TALK_TEXT_CHARS = 1_500;

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const originGuard = enforceSameOrigin(req);
    if (originGuard) return originGuard;

    const rateLimit = checkRateLimit(req, {
      key: "did-stream-talk",
      limit: 20,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const bodyResult = await readJsonBody(req, { maxBytes: MAX_TALK_BODY_BYTES });
    if (!bodyResult.ok) return bodyResult.response;

    const body = asRecord(bodyResult.data);
    if (!body) return Response.json({ error: "Invalid request body" }, { status: 400 });

    const streamId = requiredSafeId(body.streamId, "streamId");
    if (!streamId.ok) return streamId.response;

    const sessionId = requiredString(body.sessionId, "sessionId", 200);
    if (!sessionId.ok) return sessionId.response;

    const text = requiredString(body.text, "text", MAX_TALK_TEXT_CHARS);
    if (!text.ok) return text.response;

    const fallbackLang = body.language === "ar" ? "ar" : "en";
    const speech = resolveDidSpeech(text.value, fallbackLang);

    // Male voices: English = GuyNeural, Arabic = HamedNeural
    const res = await fetch(`${DID_API}/talks/streams/${streamId.value}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        script: {
          type:     "text",
          input:    text.value,
          provider: { type: "microsoft", voice_id: speech.voiceId },
        },
        config:     { stitch: true },
        session_id: sessionId.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return Response.json({ error: "Talk request failed", details: data }, { status: res.status });
    }

    return Response.json({ ok: true, language: speech.language, voice_id: speech.voiceId });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

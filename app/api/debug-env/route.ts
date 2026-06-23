// app/api/debug-env/route.ts
// Diagnostic endpoint — call this on Vercel to see what's configured
import { getDidVoiceId } from "@/lib/did-voice";

export async function GET() {
  const openAIKey = process.env.OPENAI_API_KEY?.trim() || "";
  const openAIModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
  const geminiKey  = process.env.GEMINI_API_KEY?.trim() || "";
  const didKey     = process.env.DID_API_KEY?.trim() || "";
  const didAgent   = process.env.DID_AGENT_ID?.trim() || "";
  const didVoiceEn = process.env.DID_VOICE_ID?.trim() || "";
  const didVoiceAr = process.env.DID_VOICE_ID_AR?.trim() || "";
  const useMock    = process.env.USE_MOCK_AI || "not set";

  return Response.json({
    build_time:       new Date().toISOString(),
    use_mock_ai:      useMock,
    has_openai_key:   Boolean(openAIKey),
    openai_key_last4: openAIKey ? openAIKey.slice(-4) : null,
    openai_model:     openAIModel,
    has_gemini_key:   Boolean(geminiKey),
    gemini_key_last4: geminiKey ? geminiKey.slice(-4) : null,
    has_did_key:      Boolean(didKey),
    did_key_last4:    didKey ? didKey.slice(-4) : null,
    has_did_agent_id: Boolean(didAgent),
    did_agent_prefix: didAgent ? didAgent.slice(0, 8) : null,
    did_voice_id:     didVoiceEn || null,
    did_voice_id_ar:  didVoiceAr || null,
    effective_did_voice_en: getDidVoiceId("en"),
    effective_did_voice_ar: getDidVoiceId("ar"),
    node_env:         process.env.NODE_ENV,
    // Which API routes are deployed
    routes: [
      "/api/ask",
      "/api/concierge",
      "/api/did-stream/talk",
    ],
  });
}

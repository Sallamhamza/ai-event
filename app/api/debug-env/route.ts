// app/api/debug-env/route.ts
// Diagnostic endpoint — call this on Vercel to see what's configured
export async function GET() {
  const geminiKey  = process.env.GEMINI_API_KEY?.trim() || "";
  const didKey     = process.env.DID_API_KEY?.trim() || "";
  const didAgent   = process.env.DID_AGENT_ID?.trim() || "";
  const useMock    = process.env.USE_MOCK_AI || "not set";

  return Response.json({
    build_time:       new Date().toISOString(),
    use_mock_ai:      useMock,
    has_gemini_key:   Boolean(geminiKey),
    gemini_key_last4: geminiKey ? geminiKey.slice(-4) : null,
    has_did_key:      Boolean(didKey),
    did_key_last4:    didKey ? didKey.slice(-4) : null,
    has_did_agent_id: Boolean(didAgent),
    did_agent_prefix: didAgent ? didAgent.slice(0, 8) : null,
    node_env:         process.env.NODE_ENV,
    // Which API routes are deployed
    routes: [
      "/api/ask",
      "/api/concierge",
      "/api/did-stream/talk",
    ],
  });
}

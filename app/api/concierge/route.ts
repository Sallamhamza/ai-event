// app/api/concierge/route.ts
// Reads active-event.json at request time.
// Edit data/active-event.json → avatar knowledge updates immediately.

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  loadEventKnowledge,
  buildSystemPrompt,
  checkGlobalGuardrail,
  checkDrugGuardrail,
} from "@/lib/knowledge/loader";

// ── Mock responses (USE_MOCK_AI=true) ─────────────────────────────────────────
function getMockResponse(transcript: string): string {
  const t = transcript.toLowerCase();
  if (t.includes("wifi") || t.includes("wi-fi") || t.includes("password"))
    return "The Wi-Fi network is GulfPharma2026 and the password is Connect2026. Enjoy!";
  if (t.includes("lunch") || t.includes("food") || t.includes("meal"))
    return "Lunch is served in the Garden Hall — 1 PM on Day 1 and 12 PM on Day 2. Halal, vegetarian, and gluten-free options are all labelled.";
  if (t.includes("shuttle") || t.includes("airport") || t.includes("transport"))
    return "The airport shuttle runs at 6, 8, and 10 AM from Dubai International Terminals 1 and 3. Visit the transport desk in the Foyer for changes.";
  if (t.includes("schedule") || t.includes("session") || t.includes("agenda"))
    return "Day 1 starts with registration at 8 AM in the Grand Foyer, followed by the opening keynote at 9 AM in Ballroom A. Would you like details on a specific session?";
  if (t.includes("badge") || t.includes("register"))
    return "The registration desk is in the Grand Foyer on the ground floor, open from 7:30 AM today.";
  if (t.includes("cardivex") || t.includes("atorvastatin"))
    return "Cardivex is approved for the management of elevated cholesterol and mixed lipid disorders in adult patients. It is available as a once-daily tablet in 20, 40, and 80 mg strengths. For clinical details, please visit the Sanofi booth.";
  return "Welcome to Gulf Pharma Connect 2026! I am Nour, your AI concierge. You can ask me about the schedule, venue, speakers, transport, meals, or our featured products.";
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const transcript: string = (body?.transcript ?? "").trim();

    if (!transcript) {
      return Response.json({ error: "Missing transcript" }, { status: 400 });
    }

    // Load knowledge at request time — edit JSON, no redeploy needed
    const knowledge = loadEventKnowledge();

    // Global guardrail
    if (checkGlobalGuardrail(transcript)) {
      return Response.json({
        answer:  "That is outside what I can help with here. Please speak to a qualified professional or visit our registration desk.",
        blocked: true,
      });
    }

    // Drug-specific guardrail
    const blockedDrug = checkDrugGuardrail(transcript, knowledge);
    if (blockedDrug) {
      return Response.json({
        answer:  `For clinical questions about ${blockedDrug}, please speak to a medical representative at our booth. I am happy to help with event logistics.`,
        blocked: true,
      });
    }

    // Mock mode
    if (process.env.USE_MOCK_AI === "true") {
      await new Promise(r => setTimeout(r, 600));
      return Response.json({ answer: getMockResponse(transcript), mock: true });
    }

    // Gemini live mode
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const genAI     = new GoogleGenerativeAI(geminiKey);
    const model     = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const sysPrompt = buildSystemPrompt(knowledge);

    const result = await model.generateContent({
      systemInstruction: sysPrompt,
      contents: [{ role: "user", parts: [{ text: transcript }] }],
    });

    const answer = result.response.text().trim();
    return Response.json({ answer, mock: false });

  } catch (error) {
    console.error("CONCIERGE ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        error:  "Concierge request failed",
        debug:  message,
        answer: "I am sorry, I had trouble with that. Please try again or speak to a team member.",
      },
      { status: 500 }
    );
  }
}

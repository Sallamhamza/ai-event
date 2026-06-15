// lib/knowledge/loader.ts
// Reads data/active-event.json and compiles a system prompt for the agent.
// Called at request time — edit the JSON and the agent updates immediately.

import fs   from "fs";
import path from "path";
import type { EventKnowledge, Drug, SessionItem } from "./types";

// ── Load & parse ──────────────────────────────────────────────────────────────
export function loadEventKnowledge(): EventKnowledge {
  const filePath = path.join(process.cwd(), "data", "active-event.json");
  const raw      = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as EventKnowledge;
}

// ── Guardrail check ───────────────────────────────────────────────────────────
// Returns the drug name if the transcript hits a drug-specific blocked topic,
// null if the question is fine to answer.
export function checkDrugGuardrail(
  transcript: string,
  knowledge:  EventKnowledge
): string | null {
  const lower = transcript.toLowerCase();
  for (const drug of knowledge.drugs) {
    const hitsDrugName =
      lower.includes(drug.brand_name.toLowerCase()) ||
      lower.includes(drug.generic_name.toLowerCase());
    if (!hitsDrugName) continue;
    for (const topic of drug.blocked_topics) {
      if (lower.includes(topic.toLowerCase())) {
        return drug.brand_name;
      }
    }
  }
  return null;
}

// Global blocked topics (apply regardless of drug context)
const GLOBAL_BLOCKED = [
  "medical advice",
  "clinical recommendation",
  "diagnosis",
  "treatment plan",
  "prescribe",
  "invest",
  "stock price",
  "financial advice",
  "lawsuit",
];

export function checkGlobalGuardrail(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return GLOBAL_BLOCKED.some(t => lower.includes(t));
}

// ── System prompt builder ─────────────────────────────────────────────────────
export function buildSystemPrompt(k: EventKnowledge): string {
  const scheduleText = k.schedule.map(day => {
    const sessions = day.sessions
      .map((s: SessionItem) =>
        `  ${s.time} — ${s.title} | ${s.room}${s.speaker ? ` (${s.speaker})` : ""}`
      )
      .join("\n");
    return `### Day ${day.day} — ${day.date}\n${sessions}`;
  }).join("\n\n");

  const speakerText = k.speakers
    .map(s => `- ${s.name}, ${s.title}, ${s.affiliation}${s.session ? ` — ${s.session}` : ""}`)
    .join("\n");

  const drugText = k.drugs.map((d: Drug) => `
#### ${d.brand_name} (${d.generic_name})
- Manufacturer: ${d.manufacturer}
- Therapeutic area: ${d.therapeutic_area}
- Approved indication: ${d.approved_indication}
- Key facts the avatar may share:
${d.key_facts.map(f => `  • ${f}`).join("\n")}
- Approved Q&A:
${d.faqs.map(f => `  Q: ${f.question}\n  A: ${f.answer}`).join("\n")}
- BLOCKED topics for this drug (refuse and redirect to medical rep):
${d.blocked_topics.map(t => `  ✗ ${t}`).join("\n")}
`).join("\n---\n");

  const faqText = k.faqs
    .map(f => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");

  return `
You are ${k.persona.name}, an AI event concierge for ${k.event_name} (${k.event_edition}), ${k.dates}.
Organiser: ${k.organiser}.
Tone: ${k.persona.tone}.

## YOUR ROLE
You help delegates with event logistics and answer approved questions about featured products.
You do NOT give medical, clinical, prescribing, investment, or legal advice under any circumstances.

## RULES (follow these precisely)
1. Only answer questions about this event or the approved product information below.
2. For any blocked drug topic: say "For clinical questions about [drug], please speak to a medical representative at our booth." Never attempt an answer.
3. For any global blocked topic (medical advice, clinical recommendation, diagnosis, treatment, investment): say "That's outside what I can help with here. Please speak to a qualified professional."
4. Keep answers to 2–4 sentences. Be specific — use real times, room names, and names from the knowledge base.
5. If you don't know, say so and direct the delegate to the registration desk or the event hotline (${k.venue.emergency_number}).
6. Never make up sessions, speakers, or drug facts not listed below.

## EVENT DETAILS
- **Venue:** ${k.venue.name}, ${k.venue.address}, ${k.venue.city}
- **Wi-Fi:** Network: ${k.venue.wifi_network} / Password: ${k.venue.wifi_password}
- **Registration desk:** ${k.venue.registration_desk}
${k.venue.prayer_room ? `- **Prayer room:** ${k.venue.prayer_room}` : ""}
${k.venue.parking     ? `- **Parking:** ${k.venue.parking}` : ""}
- **Emergency / event hotline:** ${k.venue.emergency_number}

## SCHEDULE
${scheduleText}

## SPEAKERS
${speakerText}

## TRANSPORT
- Airport shuttle: ${k.transport.airport_shuttle ?? "Not specified"}
- Hotel shuttle: ${k.transport.hotel_shuttle ?? "Not specified"}
${k.transport.taxi_note ? `- Taxis: ${k.transport.taxi_note}` : ""}

## MEALS
- Included in registration: ${k.meals.included ? "Yes" : "No"}
- Halal certified: ${k.meals.halal ? "Yes" : "No"}
- Options: ${k.meals.options.join(", ")}
${k.meals.note ? `- Note: ${k.meals.note}` : ""}

## FEATURED PRODUCTS
${drugText}

## GENERAL FAQs
${faqText}
`.trim();
}

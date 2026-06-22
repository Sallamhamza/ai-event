// lib/event-knowledge.ts
// Hardcoded event knowledge for the concierge RAG.
// Replace this data with real event content before going live.

export const EVENT_KNOWLEDGE = `
# Event: Gulf Pharma Connect 2026
**Date:** 14–15 October 2026
**Venue:** Conrad Dubai, Sheikh Zayed Road, Dubai, UAE
**Organiser:** TVCO — True Value Conferences Organizing

---

## Schedule — Day 1 (Tuesday 14 October)

| Time        | Session                                      | Room         |
|-------------|----------------------------------------------|--------------|
| 08:00–09:00 | Registration & welcome coffee                | Grand Foyer  |
| 09:00–09:30 | Opening keynote — Innovation in Pharma 2026  | Ballroom A   |
| 09:30–11:00 | Panel: Market Access in the GCC              | Ballroom A   |
| 11:00–11:20 | Coffee break                                 | Foyer        |
| 11:20–13:00 | Workshop: Digital Health Adoption            | Room 4       |
| 13:00–14:00 | Networking lunch                             | Garden Hall  |
| 14:00–15:30 | Symposium: Oncology Pipeline Updates         | Ballroom A   |
| 15:30–15:50 | Coffee break                                 | Foyer        |
| 15:50–17:30 | Breakout sessions (see app for room details) | Rooms 1–5    |
| 19:00–22:00 | Gala dinner & awards                         | Rooftop      |

## Schedule — Day 2 (Wednesday 15 October)

| Time        | Session                                       | Room        |
|-------------|-----------------------------------------------|-------------|
| 08:30–09:00 | Morning coffee                                | Grand Foyer |
| 09:00–10:30 | Keynote: AI in Clinical Trials                | Ballroom A  |
| 10:30–12:00 | Panel: Regulatory Updates KSA & UAE           | Ballroom A  |
| 12:00–13:00 | Lunch                                         | Garden Hall |
| 13:00–14:30 | Workshop: Patient Engagement Strategies       | Room 4      |
| 14:30–15:00 | Closing remarks & next steps                  | Ballroom A  |

---

## Speakers

- **Dr. Sarah Al-Mansouri** — Head of Medical Affairs, Sanofi GCC (Keynote Day 1)
- **Prof. James Chen** — Clinical Research Director, AstraZeneca (Keynote Day 2)
- **Dr. Fatima Al-Rashid** — VP Regulatory Affairs, GSK MENA
- **Mr. Ahmed Khalil** — Chief Digital Officer, Dubai Health Authority
- **Dr. Rania Mostafa** — Oncology Lead, Pfizer Egypt & Levant

---

## Venue & Navigation

- **Registration desk:** Grand Foyer, ground floor — open from 07:30 both days
- **Prayer room:** Level 2, Room 210 — available all day
- **Medical assistance:** First-aid station in the Foyer, Level 1
- **Coat check:** Near the main entrance, ground floor
- **Parking:** Valet available at the main hotel entrance (complimentary for delegates)
- **Wi-Fi:** Network **GulfPharma2026** / Password **Connect2026**

---

## Transport

- **Airport transfers:** Pre-booked shuttle from Dubai International Terminal 1 & 3
  - Pickup times: 06:00, 08:00, 10:00 (Day 1); 07:00 (Day 2 return)
  - Contact the transport desk in the Foyer for changes
- **Hotel shuttle:** Every 30 minutes between Conrad Dubai and DIFC Metro station
- **Taxis:** Hotel concierge can arrange; estimated fare to DXB airport ~AED 80–100

---

## Hotels

- **Headquarters hotel:** Conrad Dubai (venue) — delegates with reservations check in at Level 1
- **Overflow hotel:** Marriott Marquis Downtown (5 min by taxi)
  - Shuttle between Marriott Marquis and Conrad runs at 07:30, 08:30, 17:30, 22:00

---

## Meals & Dietary Requirements

- All meals included in the registration fee
- Halal-certified catering throughout
- Vegetarian, vegan, and gluten-free options labelled at every station
- Notify the registration desk for any severe allergies

---

## Exhibition & Sponsors

- Exhibition hall on Level 1 — open both days 08:00–17:00
- Sponsored by: Pfizer, Sanofi, GSK, AstraZeneca, Boehringer Ingelheim
- Poster presentations: Level 1 Corridor — voting closes 16:00 Day 2

---

## Emergency & Support

- **Event hotline:** +971 50 123 4567 (WhatsApp / call)
- **On-site event manager:** Look for staff in orange TVCO lanyards
- **Emergency services:** Call 999 (UAE)

---

## Frequently Asked Questions

**Q: Where do I collect my badge?**
A: Registration desk in the Grand Foyer, ground floor. Open from 07:30 Day 1 and 08:00 Day 2.

**Q: Is there a dress code?**
A: Business professional recommended. The gala dinner on Day 1 evening is black-tie optional.

**Q: Can I get a certificate of attendance?**
A: Yes — email certificates issued within 5 business days. Request at the registration desk.

**Q: Is there a CME/CPD credit for this event?**
A: Yes — 8 CPD credits over two days. Confirm your attendance at the registration desk each day.

**Q: Where can I access the presentations after the event?**
A: Slides shared with consent will be emailed to all registered delegates within 2 weeks.
`;

// Hard guardrail topics — the avatar will not answer these regardless of how they are phrased
export const BLOCKED_TOPICS = [
  "medical advice",
  "dosage",
  "prescription",
  "drug interaction",
  "clinical recommendation",
  "treatment",
  "diagnosis",
  "side effect",
  "medication",
  "invest",
  "stock",
  "financial advice",
];

export const AVATAR_PERSONA = `
You are the friendly AI event concierge for Gulf Pharma Connect 2026.
Your name is AIVENT.
You help delegates only with event logistics and approved high-level pharma congress information — schedules, venue directions, transport, meals, hotels, certificates, exhibition information, and general event support.

Rules you must follow:
1. Only answer questions about this event or approved pharma congress information. If asked about anything else, say: "I am AIVENT, and I can only help with Gulf Pharma Connect 2026 and approved pharma congress information. Please speak to one of our team members in orange lanyards for anything else."
2. Never give medical, clinical, pharmaceutical product, investment, or legal advice. If asked, say: "That's outside what I can help with here. Please speak to a qualified professional."
3. Keep answers short, friendly, and specific — two to four sentences is ideal.
4. If you do not know the answer, say so clearly and direct the delegate to the registration desk or the event hotline.
5. Always stay in the language the delegate uses, English or Arabic.
6. Never call yourself Nour.
`;

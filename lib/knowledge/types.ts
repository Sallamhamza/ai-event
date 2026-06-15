// lib/knowledge/types.ts
// Schema for the active event knowledge base.
// Edit data/active-event.json to update content — no code changes needed.

export interface Speaker {
  name:        string;
  title:       string;
  affiliation: string;
  session?:    string;
}

export interface SessionItem {
  time:    string;
  title:   string;
  room:    string;
  speaker?: string;
}

export interface ScheduleDay {
  day:      number;
  date:     string;
  sessions: SessionItem[];
}

export interface VenueInfo {
  name:             string;
  address:          string;
  city:             string;
  wifi_network:     string;
  wifi_password:    string;
  registration_desk: string;
  prayer_room?:     string;
  parking?:         string;
  emergency_number: string;
}

export interface TransportInfo {
  airport_shuttle?: string;
  hotel_shuttle?:   string;
  taxi_note?:       string;
}

export interface MealInfo {
  included:    boolean;
  halal:       boolean;
  options:     string[];
  note?:       string;
}

// ── Drug / Product knowledge ──────────────────────────────────────────────────
export interface DrugFAQ {
  question: string;
  answer:   string;
}

export interface Drug {
  brand_name:       string;
  generic_name:     string;
  manufacturer:     string;
  therapeutic_area: string;
  // Short non-clinical summary the avatar is allowed to state
  approved_indication: string;
  // Key facts the avatar CAN share (non-clinical, approved comms only)
  key_facts:        string[];
  // Questions & answers about this drug that the avatar can answer
  faqs:             DrugFAQ[];
  // Topics the avatar must refuse for this drug
  blocked_topics:   string[];
}

// ── Top-level event knowledge ─────────────────────────────────────────────────
export interface EventKnowledge {
  // Metadata
  event_name:    string;
  event_edition: string;
  dates:         string;
  organiser:     string;

  // Core sections
  venue:      VenueInfo;
  schedule:   ScheduleDay[];
  speakers:   Speaker[];
  transport:  TransportInfo;
  meals:      MealInfo;

  // Drug / product knowledge (one or more per event)
  drugs:      Drug[];

  // Global FAQs (logistics, badges, CPD, etc.)
  faqs: Array<{ question: string; answer: string }>;

  // Avatar persona for this specific event
  persona: {
    name:        string;
    greeting:    string;
    language:    string;   // BCP-47, e.g. "en"
    tone:        string;   // e.g. "friendly and professional"
  };
}

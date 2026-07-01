export type AnalyticsEventName =
  | "page_view"
  | "question"
  | "answer"
  | "voice_error"
  | "settings_open"
  | "session_reset"
  | "offline_ready";

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  language?: "en" | "ar";
  at: number;
  meta?: Record<string, string | number | boolean | null>;
}

export interface AnalyticsSummary {
  totalEvents: number;
  counts: Record<AnalyticsEventName, number>;
  languages: Record<"en" | "ar", number>;
  latest: AnalyticsEvent[];
  startedAt: number;
}

const EVENT_NAMES: AnalyticsEventName[] = [
  "page_view",
  "question",
  "answer",
  "voice_error",
  "settings_open",
  "session_reset",
  "offline_ready",
];

const MAX_EVENTS = 300;
const startedAt = Date.now();
const events: AnalyticsEvent[] = [];

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && EVENT_NAMES.includes(value as AnalyticsEventName);
}

export function recordAnalyticsEvent(event: AnalyticsEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const counts = Object.fromEntries(EVENT_NAMES.map((event) => [event, 0])) as Record<
    AnalyticsEventName,
    number
  >;
  const languages: Record<"en" | "ar", number> = { en: 0, ar: 0 };

  for (const event of events) {
    counts[event.event] += 1;
    if (event.language) languages[event.language] += 1;
  }

  return {
    totalEvents: events.length,
    counts,
    languages,
    latest: events.slice(-25).reverse(),
    startedAt,
  };
}

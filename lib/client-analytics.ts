export type ClientAnalyticsEvent =
  | "page_view"
  | "question"
  | "answer"
  | "voice_error"
  | "settings_open"
  | "session_reset"
  | "offline_ready";

interface ClientAnalyticsPayload {
  event: ClientAnalyticsEvent;
  language?: "en" | "ar";
  meta?: Record<string, string | number | boolean | null>;
}

export function trackClientEvent(payload: ClientAnalyticsPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

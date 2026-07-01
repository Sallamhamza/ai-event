import fs from "node:fs";
import path from "node:path";
import {
  clearActiveEventKnowledgeCache,
  getActiveEventFilePath,
  getActiveEventId,
} from "@/lib/knowledge/active-event-mock";

const REQUIRED_EVENT_SECTIONS = [
  "conversation_policy",
  "attendee_journey",
  "information_desks",
  "venue_navigation",
  "exhibition",
  "networking",
  "certificates_and_cpd",
  "common_attendee_questions",
  "sample_dialogues",
  "fallbacks",
  "escalation",
];

export interface EventAdminSnapshot {
  eventId: string;
  relativePath: string;
  content: string;
  sections: string[];
  questionCount: number;
  sampleDialogueCount: number;
  updatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateEventJson(value: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return ["Event JSON must be an object."];
  }

  for (const section of REQUIRED_EVENT_SECTIONS) {
    if (!(section in value)) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  if (!Array.isArray(value.common_attendee_questions)) {
    errors.push("common_attendee_questions must be an array.");
  }

  if (!Array.isArray(value.sample_dialogues)) {
    errors.push("sample_dialogues must be an array.");
  }

  return errors;
}

export function readEventAdminSnapshot(): EventAdminSnapshot {
  const filePath = getActiveEventFilePath();
  const content = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const stats = fs.statSync(filePath);

  return {
    eventId: getActiveEventId(),
    relativePath: path.relative(process.cwd(), filePath),
    content: JSON.stringify(parsed, null, 2),
    sections: Object.keys(parsed),
    questionCount: Array.isArray(parsed.common_attendee_questions)
      ? parsed.common_attendee_questions.length
      : 0,
    sampleDialogueCount: Array.isArray(parsed.sample_dialogues)
      ? parsed.sample_dialogues.length
      : 0,
    updatedAt: stats.mtime ? stats.mtime.toISOString() : null,
  };
}

export function saveEventJson(content: string): EventAdminSnapshot {
  const parsed = JSON.parse(content) as unknown;
  const errors = validateEventJson(parsed);
  if (errors.length) {
    throw new Error(errors.join("; "));
  }

  const filePath = getActiveEventFilePath();
  const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, formatted, "utf8");
  clearActiveEventKnowledgeCache();

  return readEventAdminSnapshot();
}

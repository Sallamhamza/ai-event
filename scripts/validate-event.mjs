import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const EVENT_PATH = path.join(process.cwd(), "data", "active-event.json");
const ARABIC_RE = /[\u0600-\u06ff]/;
const LATIN_RE = /[A-Za-z]/;

const REQUIRED_TOP_LEVEL = [
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

const REQUIRED_FALLBACKS = [
  "unknown_answer_en",
  "unknown_answer_ar",
  "technical_issue_en",
  "technical_issue_ar",
  "out_of_scope_en",
  "out_of_scope_ar",
];

const REQUIRED_DESKS = [
  "main_information_desk",
  "transport_desk",
  "medical_information_desk",
];

const errors = [];

function addError(pathLabel, message) {
  errors.push(`${pathLabel}: ${message}`);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function expectRecord(value, pathLabel) {
  if (!isRecord(value)) {
    addError(pathLabel, "must be an object");
    return null;
  }
  return value;
}

function expectArray(value, pathLabel, minLength = 1) {
  if (!Array.isArray(value)) {
    addError(pathLabel, "must be an array");
    return [];
  }
  if (value.length < minLength) {
    addError(pathLabel, `must contain at least ${minLength} item${minLength === 1 ? "" : "s"}`);
  }
  return value;
}

function expectString(value, pathLabel) {
  if (!isNonEmptyString(value)) {
    addError(pathLabel, "must be a non-empty string");
  }
}

function expectBilingualPair(item, pathLabel, englishKey, arabicKey) {
  expectString(item?.[englishKey], `${pathLabel}.${englishKey}`);
  expectString(item?.[arabicKey], `${pathLabel}.${arabicKey}`);

  if (isNonEmptyString(item?.[arabicKey]) && !ARABIC_RE.test(item[arabicKey])) {
    addError(`${pathLabel}.${arabicKey}`, "should contain Arabic text");
  }
}

function assertNoLegacyNour(value, pathLabel = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLegacyNour(item, `${pathLabel}[${index}]`));
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === "nour") {
      addError(`${pathLabel}.${key}`, "legacy assistant key is not allowed; use `aivent`");
    }

    if (typeof child === "string" && /\bNour\b/i.test(child)) {
      addError(`${pathLabel}.${key}`, "must not refer to the assistant as Nour");
    }

    assertNoLegacyNour(child, `${pathLabel}.${key}`);
  }
}

function validateConversationPolicy(event) {
  const policy = expectRecord(event.conversation_policy, "conversation_policy");
  if (!policy) return;

  expectString(policy.primary_role, "conversation_policy.primary_role");
  expectArray(policy.answer_style, "conversation_policy.answer_style", 3).forEach((item, index) =>
    expectString(item, `conversation_policy.answer_style[${index}]`)
  );

  const safe = expectRecord(policy.safe_boundaries, "conversation_policy.safe_boundaries");
  if (!safe) return;

  expectArray(safe.allowed, "conversation_policy.safe_boundaries.allowed", 1);
  expectArray(safe.restricted, "conversation_policy.safe_boundaries.restricted", 5);
  expectBilingualPair(
    safe,
    "conversation_policy.safe_boundaries",
    "restricted_response_en",
    "restricted_response_ar"
  );
}

function validateDesks(event) {
  const desks = expectRecord(event.information_desks, "information_desks");
  if (!desks) return;

  for (const deskName of REQUIRED_DESKS) {
    const desk = expectRecord(desks[deskName], `information_desks.${deskName}`);
    if (!desk) continue;

    expectString(desk.location, `information_desks.${deskName}.location`);
    if (!isNonEmptyString(desk.hours) && !isNonEmptyString(desk.hours_day_1) && !isNonEmptyString(desk.hours_day_2)) {
      addError(`information_desks.${deskName}`, "must include hours or day-specific hours");
    }
  }
}

function validateNavigation(event) {
  const navigation = expectRecord(event.venue_navigation, "venue_navigation");
  if (!navigation) return;

  expectArray(navigation.directions, "venue_navigation.directions", 3).forEach((direction, index) => {
    const item = expectRecord(direction, `venue_navigation.directions[${index}]`);
    if (!item) return;
    expectString(item.from, `venue_navigation.directions[${index}].from`);
    expectString(item.to, `venue_navigation.directions[${index}].to`);
    expectString(item.answer, `venue_navigation.directions[${index}].answer`);
  });
}

function validateCommonQuestions(event) {
  expectArray(event.common_attendee_questions, "common_attendee_questions", 8).forEach((question, index) => {
    const item = expectRecord(question, `common_attendee_questions[${index}]`);
    if (!item) return;

    expectString(item.intent, `common_attendee_questions[${index}].intent`);
    const examples = expectArray(item.examples, `common_attendee_questions[${index}].examples`, 1);
    expectBilingualPair(item, `common_attendee_questions[${index}]`, "answer_en", "answer_ar");

    if (examples.length && !examples.some((example) => isNonEmptyString(example) && LATIN_RE.test(example))) {
      addError(`common_attendee_questions[${index}].examples`, "should include at least one English example");
    }
    if (examples.length && !examples.some((example) => isNonEmptyString(example) && ARABIC_RE.test(example))) {
      addError(`common_attendee_questions[${index}].examples`, "should include at least one Arabic example");
    }
  });
}

function validateSampleDialogues(event) {
  expectArray(event.sample_dialogues, "sample_dialogues", 1).forEach((dialogue, dialogueIndex) => {
    const item = expectRecord(dialogue, `sample_dialogues[${dialogueIndex}]`);
    if (!item) return;

    expectString(item.title, `sample_dialogues[${dialogueIndex}].title`);
    expectArray(item.conversation, `sample_dialogues[${dialogueIndex}].conversation`, 1).forEach(
      (turn, turnIndex) => {
        const pathLabel = `sample_dialogues[${dialogueIndex}].conversation[${turnIndex}]`;
        const sampleTurn = expectRecord(turn, pathLabel);
        if (!sampleTurn) return;

        expectString(sampleTurn.attendee, `${pathLabel}.attendee`);
        expectString(sampleTurn.aivent, `${pathLabel}.aivent`);
      }
    );
  });
}

function validateFallbacks(event) {
  const fallbacks = expectRecord(event.fallbacks, "fallbacks");
  if (!fallbacks) return;

  for (const key of REQUIRED_FALLBACKS) {
    expectString(fallbacks[key], `fallbacks.${key}`);
    if (key.endsWith("_ar") && isNonEmptyString(fallbacks[key]) && !ARABIC_RE.test(fallbacks[key])) {
      addError(`fallbacks.${key}`, "should contain Arabic text");
    }
  }
}

function validateDemoQuestions(event) {
  if (event.demo_questions === undefined) return;

  const demoQuestions = expectRecord(event.demo_questions, "demo_questions");
  if (!demoQuestions) return;

  expectArray(demoQuestions.english, "demo_questions.english", 1).forEach((question, index) =>
    expectString(question, `demo_questions.english[${index}]`)
  );
  expectArray(demoQuestions.arabic, "demo_questions.arabic", 1).forEach((question, index) => {
    expectString(question, `demo_questions.arabic[${index}]`);
    if (isNonEmptyString(question) && !ARABIC_RE.test(question)) {
      addError(`demo_questions.arabic[${index}]`, "should contain Arabic text");
    }
  });
}

function validateEvent(event) {
  const root = expectRecord(event, "$");
  if (!root) return;

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in root)) addError(key, "required top-level section is missing");
  }

  validateConversationPolicy(root);
  validateDesks(root);
  validateNavigation(root);
  validateCommonQuestions(root);
  validateSampleDialogues(root);
  validateFallbacks(root);
  validateDemoQuestions(root);
  assertNoLegacyNour(root);
}

let event;
try {
  event = JSON.parse(fs.readFileSync(EVENT_PATH, "utf8"));
} catch (error) {
  console.error(`Invalid JSON in ${EVENT_PATH}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

validateEvent(event);

if (errors.length) {
  console.error(`Event knowledge validation failed with ${errors.length} issue${errors.length === 1 ? "" : "s"}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Event knowledge validation passed: ${path.relative(process.cwd(), EVENT_PATH)}`);

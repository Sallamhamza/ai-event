import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { asRecord, checkRateLimit, enforceSameOrigin, readJsonBody } from "@/lib/api-security";
import { containsArabicText, type ConciergeLanguage } from "@/lib/language";
import {
  buildActiveEventSystemPrompt,
  getActiveEventIdentityAnswer,
  getActiveEventMockAnswer,
  getActiveEventOutOfScopeAnswer,
  getActiveEventRestrictedAnswer,
  loadActiveEventKnowledge,
  resolveLanguage,
  type ActiveEventKnowledge,
} from "@/lib/knowledge/active-event-mock";

function isTruthy(value: string | undefined): boolean {
  return ["true", "1", "yes"].includes((value || "").toLowerCase());
}

const MAX_QUESTION_CHARS = 1200;
const MAX_ASK_BODY_BYTES = 6_000;

function jsonAnswer(payload: {
  answer: string;
  language: ConciergeLanguage;
  refused?: boolean;
  mock?: boolean;
  fallback?: boolean;
  provider?: "openai" | "gemini" | "mock";
  model?: string;
}) {
  return Response.json({
    ...payload,
    knowledge: "active-event",
  });
}

function jsonRequestError(answer: string, language: ConciergeLanguage) {
  return Response.json(
    {
      answer,
      language,
      error: "Invalid request",
      knowledge: "active-event",
    },
    { status: 400 }
  );
}

async function parseAskRequest(request: Request): Promise<
  | { ok: true; question: string; language: ConciergeLanguage }
  | { ok: false; response: Response }
> {
  const bodyResult = await readJsonBody(request, {
    maxBytes: MAX_ASK_BODY_BYTES,
    invalidMessage: "Please send a valid JSON request.",
  });
  if (!bodyResult.ok) return bodyResult;

  const payload = asRecord(bodyResult.data);
  if (!payload) {
    return {
      ok: false,
      response: jsonRequestError("Please send a valid question.", "en"),
    };
  }

  const fallbackLanguage: ConciergeLanguage = payload.language === "ar" ? "ar" : "en";

  if (typeof payload.question !== "string") {
    return {
      ok: false,
      response: jsonRequestError(
        fallbackLanguage === "ar" ? "يرجى إرسال السؤال كنص." : "Please send the question as text.",
        fallbackLanguage
      ),
    };
  }

  const question = payload.question.trim();
  const language = resolveLanguage(question, fallbackLanguage);

  if (!question) {
    return {
      ok: false,
      response: jsonRequestError(
        language === "ar" ? "يرجى طرح سؤال عن الفعالية." : "Please ask a question about the event.",
        language
      ),
    };
  }

  if (question.length > MAX_QUESTION_CHARS) {
    return {
      ok: false,
      response: jsonRequestError(
        language === "ar"
          ? "يرجى اختصار السؤال حتى أتمكن من مساعدتك بسرعة."
          : "Please shorten the question so I can help quickly.",
        language
      ),
    };
  }

  return { ok: true, question, language };
}

function safeMockAnswer(
  question: string,
  language: ConciergeLanguage,
  knowledge: ActiveEventKnowledge | null
): string {
  try {
    return getActiveEventMockAnswer(question, language, knowledge ?? loadActiveEventKnowledge());
  } catch {
    return language === "ar"
      ? "أواجه مشكلة تقنية مؤقتة، لكن فريق الفعالية في مكتب المعلومات يمكنه مساعدتك فورًا."
      : "I am having a temporary technical issue, but the event team at the information desk can help you right away.";
  }
}

function buildUserPrompt(question: string, language: ConciergeLanguage): string {
  if (language === "ar") {
    return [
      "أجب باللغة العربية فقط.",
      "تم اختيار العربية أو تم اكتشاف سؤال عربي؛ لا ترد بالإنجليزية إلا للأسماء الرسمية والاختصارات.",
      "استخدم الإنجليزية فقط لأسماء القاعات أو العلامات التجارية أو الاختصارات الرسمية مثل Ballroom A أو CPD.",
      "اكتب كنص عادي مناسب للصوت. لا تستخدم Markdown أو النجوم أو التنسيق الغامق أو الجداول.",
      "أنت AIVENT دائمًا. لا تستخدم اسم Nour أو أي اسم آخر.",
      "أجب فقط عن معلومات الفعالية والمؤتمر الدوائي المعتمدة. ارفض أي سؤال خارج هذا النطاق.",
      "إذا لم تكن المعلومة موجودة في JSON الفعالية، قل ذلك بالعربية ووجّه الزائر إلى مكتب المعلومات.",
      "",
      `سؤال الزائر: ${question}`,
    ].join("\n");
  }

  return [
    "Answer in English only.",
    "Use only the active event JSON from the system instructions.",
    "Write plain speech-friendly text only. Do not use Markdown, asterisks, bold formatting, tables, or bullet lists.",
    "You are always AIVENT. Do not use the name Nour or any other name.",
    "Answer only event information and approved pharma congress information. Refuse anything outside that scope.",
    "",
    `Delegate question: ${question}`,
  ].join("\n");
}

function cleanForSpeech(answer: string): string {
  return answer
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function enforceAnswerLanguage(
  answer: string,
  question: string,
  language: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): { answer: string; fallback: boolean } {
  const trimmed = cleanForSpeech(answer);
  if (!trimmed) {
    return {
      answer: getActiveEventMockAnswer(question, language, knowledge),
      fallback: true,
    };
  }

  if (language === "ar" && !containsArabicText(trimmed)) {
    console.warn("AI provider returned a non-Arabic answer for an Arabic request; using active-event Arabic fallback.");
    return {
      answer: getActiveEventMockAnswer(question, "ar", knowledge),
      fallback: true,
    };
  }

  return { answer: trimmed, fallback: false };
}

export async function POST(request: Request) {
  let question = "";
  let language: ConciergeLanguage = "en";
  let knowledge: ActiveEventKnowledge | null = null;

  try {
    const originGuard = enforceSameOrigin(request);
    if (originGuard) return originGuard;

    const rateLimit = checkRateLimit(request, {
      key: "ask",
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimit) return rateLimit;

    const parsed = await parseAskRequest(request);
    if (!parsed.ok) return parsed.response;

    question = parsed.question;
    language = parsed.language;

    knowledge = loadActiveEventKnowledge();

    const restricted = getActiveEventRestrictedAnswer(question, language, knowledge);
    if (restricted) {
      return jsonAnswer({
        answer: restricted,
        language,
        refused: true,
      });
    }

    const identity = getActiveEventIdentityAnswer(question, language);
    if (identity) {
      return jsonAnswer({
        answer: identity,
        language,
        refused: false,
      });
    }

    const outOfScope = getActiveEventOutOfScopeAnswer(question, language, knowledge);
    if (outOfScope) {
      return jsonAnswer({
        answer: outOfScope,
        language,
        refused: true,
      });
    }

    if (isTruthy(process.env.USE_MOCK_AI)) {
      return jsonAnswer({
        answer: getActiveEventMockAnswer(question, language, knowledge),
        language,
        refused: false,
        mock: true,
        provider: "mock",
      });
    }

    const openAIKey = process.env.OPENAI_API_KEY?.trim();
    if (openAIKey) {
      const openAIModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
      const client = new OpenAI({ apiKey: openAIKey });
      const response = await client.responses.create({
        model: openAIModel,
        instructions: buildActiveEventSystemPrompt(knowledge, language),
        input: buildUserPrompt(question, language),
      });
      const checkedAnswer = enforceAnswerLanguage(
        response.output_text,
        question,
        language,
        knowledge
      );

      return jsonAnswer({
        answer: checkedAnswer.answer,
        language,
        refused: false,
        fallback: checkedAnswer.fallback || undefined,
        provider: "openai",
        model: openAIModel,
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      console.warn("OPENAI_API_KEY and GEMINI_API_KEY not set - using active-event mock answers");
      return jsonAnswer({
        answer: getActiveEventMockAnswer(question, language, knowledge),
        language,
        refused: false,
        mock: true,
        provider: "mock",
      });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: buildActiveEventSystemPrompt(knowledge, language),
    });

    const result = await model.generateContent(buildUserPrompt(question, language));
    const checkedAnswer = enforceAnswerLanguage(
      result.response.text(),
      question,
      language,
      knowledge
    );

    return jsonAnswer({
      answer: checkedAnswer.answer,
      language,
      refused: false,
      fallback: checkedAnswer.fallback || undefined,
      provider: "gemini",
      model: "gemini-2.0-flash",
    });
  } catch (error: unknown) {
    console.error("Ask route error:", error);
    return jsonAnswer({
      answer: safeMockAnswer(question, language, knowledge),
      language,
      refused: false,
      mock: true,
      fallback: true,
    });
  }
}

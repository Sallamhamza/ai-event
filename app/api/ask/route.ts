import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildActiveEventSystemPrompt,
  getActiveEventMockAnswer,
  getActiveEventRestrictedAnswer,
  loadActiveEventKnowledge,
  resolveLanguage,
  type ActiveEventKnowledge,
  type ConciergeLanguage,
} from "@/lib/knowledge/active-event-mock";

function isTruthy(value: string | undefined): boolean {
  return ["true", "1", "yes"].includes((value || "").toLowerCase());
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

export async function POST(request: Request) {
  let question = "";
  let language: ConciergeLanguage = "en";
  let knowledge: ActiveEventKnowledge | null = null;

  try {
    const body = await request.json();
    question = String(body.question || "").trim();
    language = body.language === "ar" ? "ar" : "en";
    language = resolveLanguage(question, language);

    if (!question) {
      return Response.json(
        {
          answer: language === "ar"
            ? "يرجى طرح سؤال عن الفعالية."
            : "Please ask a question about the event.",
        },
        { status: 400 }
      );
    }

    knowledge = loadActiveEventKnowledge();

    const restricted = getActiveEventRestrictedAnswer(question, language, knowledge);
    if (restricted) {
      return Response.json({
        answer: restricted,
        refused: true,
        knowledge: "active-event",
      });
    }

    if (isTruthy(process.env.USE_MOCK_AI)) {
      return Response.json({
        answer: getActiveEventMockAnswer(question, language, knowledge),
        refused: false,
        mock: true,
        knowledge: "active-event",
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      console.warn("GEMINI_API_KEY not set - using active-event mock answers");
      return Response.json({
        answer: getActiveEventMockAnswer(question, language, knowledge),
        refused: false,
        mock: true,
        knowledge: "active-event",
      });
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: buildActiveEventSystemPrompt(knowledge, language),
    });

    const result = await model.generateContent(question);

    return Response.json({
      answer: result.response.text(),
      refused: false,
      knowledge: "active-event",
    });
  } catch (error: unknown) {
    console.error("Ask route error:", error);
    return Response.json({
      answer: safeMockAnswer(question, language, knowledge),
      refused: false,
      mock: true,
      fallback: true,
      knowledge: "active-event",
    });
  }
}

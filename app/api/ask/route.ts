import { GoogleGenerativeAI } from "@google/generative-ai";
import { eventContent } from "@/data/eventContent";

function isMedicalOrProductQuestion(question: string) {
    const blockedTerms = [
        "drug",
        "medicine",
        "dose",
        "dosage",
        "side effect",
        "side effects",
        "treatment",
        "clinical",
        "prescription",
        "patient",
        "therapy",
        "vaccine",
        "adverse event",
        "contraindication",
        "diagnosis",
        "دواء",
        "جرعة",
        "علاج",
        "أعراض",
        "مريض",
        "تشخيص",
        "لقاح",
        "آثار جانبية",
    ];

    const q = question.toLowerCase();
    return blockedTerms.some((term) => q.includes(term.toLowerCase()));
}

function getMockAnswer(question: string, language: "en" | "ar") {
    const q = question.toLowerCase();

    if (
        q.includes("registration") ||
        q.includes("register") ||
        q.includes("تسجيل")
    ) {
        return language === "ar"
            ? "يقع مكتب التسجيل عند المدخل الرئيسي لقاعة الشيخ راشد. يرجى إحضار رمز QR أو رسالة تأكيد التسجيل وبطاقة هوية."
            : "Registration is located at the main entrance of Sheikh Rashid Hall. Please bring your QR code or registration confirmation email and a valid ID.";
    }

    if (
        q.includes("parking") ||
        q.includes("car") ||
        q.includes("موقف") ||
        q.includes("مواقف")
    ) {
        return language === "ar"
            ? "نعم، تتوفر مواقف مدفوعة في مناطق مواقف مركز دبي التجاري العالمي."
            : "Yes, paid parking is available at Dubai World Trade Centre parking areas.";
    }

    if (
        q.includes("10") ||
        q.includes("ten") ||
        q.includes("العاشرة") ||
        q.includes("10:00")
    ) {
        return language === "ar"
            ? "في الساعة 10:00، ستكون جلسة مستقبل الابتكار الدوائي في الخليج مع عمر حداد على المسرح الرئيسي."
            : "At 10:00, Omar Haddad will speak about the Future of Pharma Innovation in the GCC on the Main Stage.";
    }

    if (
        q.includes("agenda") ||
        q.includes("schedule") ||
        q.includes("program") ||
        q.includes("جدول") ||
        q.includes("برنامج")
    ) {
        return language === "ar"
            ? "يبدأ البرنامج بكلمة افتتاحية الساعة 09:00، ثم جلسة الابتكار الدوائي في الخليج الساعة 10:00، وجلسة التوجهات التنظيمية الساعة 11:30، وجلسة الذكاء الاصطناعي في الفعاليات الصحية الساعة 14:00."
            : "The agenda starts with Opening Remarks at 09:00, followed by Future of Pharma Innovation in the GCC at 10:00, Regulatory Trends and Market Access at 11:30, and AI and Digital Transformation in Healthcare Events at 14:00.";
    }

    if (
        q.includes("venue") ||
        q.includes("location") ||
        q.includes("where") ||
        q.includes("مكان") ||
        q.includes("أين")
    ) {
        return language === "ar"
            ? "تقام الفعالية في مركز دبي التجاري العالمي، قاعة الشيخ راشد. اتبع اللوحات الإرشادية من المدخل الرئيسي إلى مكتب التسجيل."
            : "The event is held at Dubai World Trade Centre, Sheikh Rashid Hall. Enter from the main DWTC entrance and follow the signs to registration.";
    }

    return language === "ar"
        ? "لا أملك هذه المعلومة في بيانات الفعالية الحالية. يرجى سؤال مكتب معلومات الفعالية."
        : "I do not have that information in the current event data. Please ask the event information desk.";
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const question = String(body.question || "").trim();
        const language = body.language === "ar" ? "ar" : "en";

        if (!question) {
            return Response.json(
                { answer: "Please ask a question about the event." },
                { status: 400 }
            );
        }

        if (isMedicalOrProductQuestion(question)) {
            const refusal =
                language === "ar"
                    ? "عذرًا، يمكنني فقط الإجابة عن أسئلة تنظيمية خاصة بالفعالية مثل الجدول، المتحدثين، التسجيل، الموقع والمواصلات. للأسئلة الطبية أو المتعلقة بالمنتجات، يرجى التوجه إلى فريق الفعالية أو الممثل الطبي المختص."
                    : "Sorry, I can only answer event logistics questions such as agenda, speakers, registration, venue, timings, and transport. For medical or product-related questions, please speak with event staff or a medical representative.";

            return Response.json({
                answer: refusal,
                refused: true,
            });
        }

        if (process.env.USE_MOCK_AI === "true") {
            return Response.json({
                answer: getMockAnswer(question, language),
                refused: false,
                mock: true,
            });
        }

        // Init Gemini lazily — only reached when USE_MOCK_AI !== 'true'
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

        const systemPrompt = `
You are an AI Event Concierge for ${eventContent.eventName}.

You must answer ONLY questions about:
- agenda
- speakers
- registration
- venue directions
- timing
- transport
- parking
- event logistics

You must NOT answer:
- medical questions
- product questions
- drug information
- treatment or dosage questions
- clinical advice

If the answer is not available in the event data, say that the attendee should ask the event information desk.

Answer in ${language === "ar" ? "Arabic" : "English"}.

Use this event data:
${JSON.stringify(eventContent, null, 2)}
`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(question);

        return Response.json({
            answer: result.response.text(),
            refused: false,
        });
    } catch (error) {
        console.error("Ask route error:", error);

        // If Gemini fails (wrong key, 429 quota, network), fall back to mock answers
        // so the kiosk always gives a useful response instead of crashing
        // Return a graceful fallback message — never show a 500 to the kiosk user
        return Response.json(
            {
                answer:
                    "I'm having trouble connecting to my knowledge base right now. Please ask the event information desk for assistance, or try again in a moment.",
                fallback: true,
            },
            { status: 200 } // return 200 so the frontend still speaks the answer
        );
    }
}

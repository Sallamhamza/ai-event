import { GoogleGenerativeAI } from "@google/generative-ai";
import { eventContent } from "@/data/eventContent";

// ── Medical / product question guard ─────────────────────────────────────────
function isMedicalOrProductQuestion(question: string) {
    const blocked = [
        "drug","medicine","dose","dosage","side effect","side effects",
        "treatment","clinical","prescription","patient","therapy","vaccine",
        "adverse event","contraindication","diagnosis",
        "دواء","جرعة","علاج","أعراض","مريض","تشخيص","لقاح","آثار جانبية",
    ];
    const q = question.toLowerCase();
    return blocked.some(t => q.includes(t.toLowerCase()));
}

// ── Smart mock answers (keyword matching against eventContent) ────────────────
// Used when: USE_MOCK_AI=true | GEMINI_API_KEY not set | Gemini fails/quota
function getMockAnswer(question: string, language: "en" | "ar"): string {
    const q = question.toLowerCase();
    const ar = language === "ar";

    if (q.match(/registr|تسجيل/))
        return ar
            ? "يقع مكتب التسجيل عند المدخل الرئيسي لقاعة الشيخ راشد. يرجى إحضار رمز QR أو تأكيد التسجيل وبطاقة هوية."
            : "Registration is at the main entrance of Sheikh Rashid Hall. Please bring your QR code or confirmation email and a valid ID.";

    if (q.match(/park|car park|موقف|مواقف/))
        return ar
            ? "تتوفر مواقف مدفوعة في مناطق مواقف مركز دبي التجاري العالمي."
            : "Paid parking is available at Dubai World Trade Centre parking areas.";

    if (q.match(/lunch|food|eat|meal|غداء|طعام|أكل/))
        return ar
            ? "يُقدَّم الغداء الساعة 13:00 في منطقة التواصل بجانب القاعة الرئيسية."
            : "Lunch is served at 13:00 in the networking area next to the main hall.";

    if (q.match(/agenda|schedule|program|session|جدول|برنامج|جلسة/))
        return ar
            ? "البرنامج: 09:00 كلمة افتتاحية، 10:00 ابتكار الدواء في الخليج، 11:30 التوجهات التنظيمية، 14:00 الذكاء الاصطناعي في الرعاية الصحية."
            : "Agenda: 09:00 Opening Remarks, 10:00 GCC Pharma Innovation, 11:30 Regulatory Trends & Market Access, 14:00 AI in Healthcare Events.";

    if (q.match(/venue|location|where|hall|مكان|أين|قاعة/))
        return ar
            ? "الفعالية في مركز دبي التجاري العالمي، قاعة الشيخ راشد. اتبع اللوحات الإرشادية من المدخل الرئيسي."
            : "The event is at Dubai World Trade Centre, Sheikh Rashid Hall. Follow signs from the main DWTC entrance.";

    if (q.match(/transport|shuttle|bus|hotel|taxi|مواصلات|حافلة|فندق/))
        return ar
            ? "تتوفر حافلات مكوك من الفنادق الشريكة. يُرجى الاستفسار من مكتب معلومات الفعالية."
            : "Shuttle buses run from selected partner hotels. Please check with the event information desk.";

    if (q.match(/speaker|presenter|who.*speak|متحدث|من.*يتحدث/))
        return ar
            ? "المتحدثون: د. ليلى المنصوري، عمر حداد، سارة خالد، وحمزة سلام."
            : "Speakers include Dr. Layla Al Mansoori, Omar Haddad, Sara Khalid, and Hamza Sallam.";

    if (q.match(/wifi|wi-fi|internet|network|واي فاي|انترنت/))
        return ar
            ? "اسم الشبكة: DWTC_Event — كلمة المرور موجودة في حزمة الترحيب."
            : "WiFi network: DWTC_Event — the password is in your welcome pack.";

    if (q.match(/time|start|begin|open|توقيت|بدء|فتح/))
        return ar
            ? "تبدأ الفعالية الساعة 09:00 وتنتهي في المساء. يُفتح مكتب التسجيل من 08:00 حتى 17:00."
            : "The event starts at 09:00. Registration desk is open from 08:00 to 17:00.";

    return ar
        ? "يسعدني مساعدتك! للمزيد من التفاصيل يُرجى التواصل مع مكتب معلومات الفعالية."
        : "I'm happy to help! For more details, please ask the event information desk.";
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
    let question = "";
    let language: "en" | "ar" = "en";

    try {
        const body = await request.json();
        question = String(body.question || "").trim();
        language = body.language === "ar" ? "ar" : "en";

        if (!question) {
            return Response.json({ answer: "Please ask a question about the event." }, { status: 400 });
        }

        // Blocked medical / product questions
        if (isMedicalOrProductQuestion(question)) {
            const refusal = language === "ar"
                ? "عذرًا، يمكنني فقط الإجابة عن أسئلة لوجستية خاصة بالفعالية. للأسئلة الطبية يرجى التوجه إلى الممثل الطبي المختص."
                : "Sorry, I can only answer event logistics questions (agenda, venue, speakers, registration, transport). For medical questions please speak with a medical representative.";
            return Response.json({ answer: refusal, refused: true });
        }

        // Mock mode flag
        if (process.env.USE_MOCK_AI === "true") {
            return Response.json({ answer: getMockAnswer(question, language), refused: false, mock: true });
        }

        // No Gemini key → use mock answers (handles missing Vercel env vars gracefully)
        const geminiKey = process.env.GEMINI_API_KEY?.trim();
        if (!geminiKey) {
            console.warn("GEMINI_API_KEY not set — using mock answers");
            return Response.json({ answer: getMockAnswer(question, language), refused: false, mock: true });
        }

        // Live Gemini path
        const genAI = new GoogleGenerativeAI(geminiKey);
        const systemPrompt = `
You are Aivent, an AI Event Concierge for ${eventContent.eventName}.

Answer ONLY event logistics questions (agenda, speakers, registration, venue, timing, transport, parking).
Do NOT answer medical, product, drug, treatment, or clinical questions.
If the answer is not in the event data, say the attendee should ask the event information desk.
Answer in ${language === "ar" ? "Arabic" : "English"}.

Event data:
${JSON.stringify(eventContent, null, 2)}
`;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: systemPrompt });
        const result = await model.generateContent(question);

        return Response.json({ answer: result.response.text(), refused: false });

    } catch (error: unknown) {
        // Any Gemini failure → smart mock answer (never a generic error message)
        console.error("Ask route error:", error);
        return Response.json({
            answer: getMockAnswer(question, language),
            refused: false,
            mock: true,
            fallback: true,
        });
    }
}

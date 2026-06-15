// app/api/did-agent/ask/route.ts
// Sends the user's question to the D-ID Agent chat API for a text answer.
// The frontend then sends that text to the active stream via /api/did-agent/talk.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) throw new Error("Missing DID_API_KEY");
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const { question, language } = await req.json();
    if (typeof question !== "string" || !question.trim()) {
      return Response.json({ error: "Missing question" }, { status: 400 });
    }
    const agentId = process.env.DID_AGENT_ID?.trim();
    if (!agentId) {
      return Response.json({
        answer: getLocalAnswer(question, language ?? "en"),
        refused: false,
        fallback: true,
      });
    }

    // Blocked medical/product questions — same guardrails as before
    const blocked = [
      "drug","medicine","dose","dosage","side effect","treatment","clinical",
      "prescription","patient","therapy","vaccine","adverse event",
      "contraindication","diagnosis","دواء","جرعة","علاج","أعراض","مريض","تشخيص","لقاح",
    ];
    const q = question.toLowerCase();
    if (blocked.some(t => q.includes(t))) {
      const refusal = language === "ar"
        ? "عذرًا، يمكنني فقط الإجابة عن أسئلة تنظيمية خاصة بالفعالية. للأسئلة الطبية يرجى التوجه إلى الممثل الطبي المختص."
        : "Sorry, I can only answer event logistics questions. For medical or product questions, please speak with a medical representative.";
      return Response.json({ answer: refusal, refused: true });
    }

    const createChatRes = await fetch(`${DID_API}/agents/${agentId}/chat`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ persist: false }),
    });

    const createChatData = await createChatRes.json().catch(() => ({}));
    const chatId =
      createChatData?.id ??
      createChatData?.chat_id ??
      createChatData?.chatId ??
      createChatData?._id;

    if (!createChatRes.ok || !chatId) {
      console.error("D-ID create chat error:", createChatData);
      return Response.json(
        { answer: getLocalAnswer(question, language ?? "en"), refused: false, fallback: true },
        { status: 200 }
      );
    }

    const res = await fetch(`${DID_API}/agents/${agentId}/chat/${chatId}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: question,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("D-ID agent chat message error:", data);
      return Response.json(
        { answer: getLocalAnswer(question, language ?? "en"), refused: false, fallback: true },
        { status: 200 }
      );
    }

    const agentAnswer: string =
      data?.result ??
      data?.output ??
      data?.message?.content ??
      data?.messages?.[0]?.content ??
      "";

    const answer = agentAnswer.trim() || getLocalAnswer(question, language ?? "en");

    return Response.json({ answer, refused: false, source: "did-agent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("D-ID ask route error:", msg);
    // Emergency fallback to local answers
    return Response.json({
      answer: "I'm having a moment — please try again.",
      refused: false,
      fallback: true,
    }, { status: 200 });
  }
}

// Local fallback answers — only used if D-ID agent is unreachable
function getLocalAnswer(question: string, language: string): string {
  const q = question.toLowerCase();
  const ar = language === "ar";

  if (q.match(/registr|تسجيل/)) return ar
    ? "يقع مكتب التسجيل عند المدخل الرئيسي لقاعة الشيخ راشد. يرجى إحضار رمز QR وبطاقة هوية."
    : "Registration is at the main entrance of Sheikh Rashid Hall. Please bring your QR code and a valid ID.";

  if (q.match(/park|car|موقف|مواقف/)) return ar
    ? "تتوفر مواقف مدفوعة في مناطق مواقف مركز دبي التجاري العالمي."
    : "Paid parking is available at Dubai World Trade Centre parking areas.";

  if (q.match(/lunch|food|eat|غداء|طعام/)) return ar
    ? "يُقدَّم الغداء الساعة 13:00 في منطقة التواصل بجانب القاعة الرئيسية."
    : "Lunch is served at 13:00 in the networking area next to the main hall.";

  if (q.match(/agenda|schedule|program|جدول|برنامج/)) return ar
    ? "يبدأ البرنامج بكلمة افتتاحية 09:00، ثم جلسة الابتكار الدوائي 10:00، والتوجهات التنظيمية 11:30، والذكاء الاصطناعي 14:00."
    : "Agenda: 09:00 Opening Remarks, 10:00 GCC Pharma Innovation, 11:30 Regulatory Trends, 14:00 AI in Healthcare.";

  if (q.match(/venue|location|where|hall|مكان|أين|قاعة/)) return ar
    ? "الفعالية في مركز دبي التجاري العالمي، قاعة الشيخ راشد."
    : "The event is at Dubai World Trade Centre, Sheikh Rashid Hall.";

  if (q.match(/transport|shuttle|hotel|مواصلات|حافلة/)) return ar
    ? "تتوفر حافلات مكوك من الفنادق الشريكة. استفسر من مكتب معلومات الفعالية."
    : "Shuttle buses run from selected partner hotels. Check with the event information desk.";

  if (q.match(/speaker|presenter|متحدث/)) return ar
    ? "يشمل المتحدثون د. ليلى المنصوري، عمر حداد، سارة خالد، وحمزة سلام."
    : "Speakers include Dr. Layla Al Mansoori, Omar Haddad, Sara Khalid, and Hamza Sallam.";

  if (q.match(/wifi|internet|net|واي فاي/)) return ar
    ? "شبكة الواي فاي: DWTC_Event — كلمة المرور في حزمة الترحيب."
    : "WiFi network: DWTC_Event — password in your welcome pack.";

  return ar
    ? "يسعدني المساعدة! يرجى التواصل مع مكتب معلومات الفعالية لمزيد من التفاصيل."
    : "I'm happy to help! Please check with the event information desk for more details.";
}

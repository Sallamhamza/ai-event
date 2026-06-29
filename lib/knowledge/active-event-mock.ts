import fs from "fs";
import path from "path";
import {
  detectSpokenLanguage,
  type ConciergeLanguage,
} from "@/lib/language";

interface SafeBoundaries {
  restricted?: string[];
  restricted_response_en?: string;
  restricted_response_ar?: string;
}

interface ConversationPolicy {
  primary_role?: string;
  answer_style?: string[];
  safe_boundaries?: SafeBoundaries;
}

interface AttendeeJourney {
  arrival_flow?: string[];
  day_1_recommendation?: string;
  day_2_recommendation?: string;
  late_arrival_guidance?: string;
}

interface DeskInfo {
  location?: string;
  hours?: string;
  hours_day_1?: string;
  hours_day_2?: string;
  services?: string[];
  purpose?: string;
}

interface InformationDesks {
  main_information_desk?: DeskInfo;
  transport_desk?: DeskInfo;
  medical_information_desk?: DeskInfo;
}

interface DirectionInfo {
  from?: string;
  to?: string;
  answer?: string;
}

interface VenueNavigation {
  directions?: DirectionInfo[];
  accessibility?: {
    wheelchair_access?: string;
    elevator_access?: string;
    quiet_area?: string;
  };
}

interface ExhibitionZone {
  zone?: string;
  booths?: string[];
  description?: string;
}

interface ExhibitionInfo {
  location?: string;
  hours_day_1?: string;
  hours_day_2?: string;
  zones?: ExhibitionZone[];
  booth_guidance?: string;
}

interface NetworkingInfo {
  recommended_times?: string[];
  meeting_points?: string[];
  business_card_note?: string;
}

interface CertificatesAndCpd {
  certificate_process?: string;
  cpd_process?: string;
  missing_certificate_response?: string;
  cpd_credit_total?: string;
}

interface CommonQuestion {
  intent?: string;
  examples?: string[];
  answer_en?: string;
  answer_ar?: string;
}

interface SampleTurn {
  attendee?: string;
  aivent?: string;
  nour?: string;
}

interface SampleDialogue {
  title?: string;
  conversation?: SampleTurn[];
}

interface Fallbacks {
  unknown_answer_en?: string;
  unknown_answer_ar?: string;
  out_of_scope_en?: string;
  out_of_scope_ar?: string;
  technical_issue_en?: string;
  technical_issue_ar?: string;
}

interface EscalationInfo {
  escalation_script_en?: string;
  escalation_script_ar?: string;
  emergency_script_en?: string;
  emergency_script_ar?: string;
}

export interface ActiveEventKnowledge {
  conversation_policy?: ConversationPolicy;
  attendee_journey?: AttendeeJourney;
  information_desks?: InformationDesks;
  venue_navigation?: VenueNavigation;
  exhibition?: ExhibitionInfo;
  networking?: NetworkingInfo;
  certificates_and_cpd?: CertificatesAndCpd;
  common_attendee_questions?: CommonQuestion[];
  sample_dialogues?: SampleDialogue[];
  fallbacks?: Fallbacks;
  escalation?: EscalationInfo;
}

interface Candidate {
  en: string[];
  ar: string[];
  answerEn: string;
  answerAr: string;
}

const ARABIC_RE = /[\u0600-\u06ff]/;
const KNOWLEDGE_CACHE_TTL_MS = 30_000;

let cachedKnowledge: ActiveEventKnowledge | null = null;
let cachedKnowledgeExpiresAt = 0;

const EN_STOPWORDS = new Set([
  "the", "and", "for", "with", "what", "where", "when", "how", "can",
  "you", "tell", "about", "are", "is", "there", "this", "that", "have",
  "get", "please", "need", "want", "from", "back",
]);

const AR_STOPWORDS = new Set([
  "ما", "ماذا", "متى", "اين", "أين", "كيف", "هل", "من", "هو", "هي",
  "في", "إلى", "الى", "على", "عن", "هذه", "هذا", "ال", "أريد",
]);

export function loadActiveEventKnowledge(): ActiveEventKnowledge {
  const now = Date.now();
  if (cachedKnowledge && cachedKnowledgeExpiresAt > now) {
    return cachedKnowledge;
  }

  const filePath = path.join(process.cwd(), "data", "active-event.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedKnowledge = JSON.parse(raw) as ActiveEventKnowledge;
  cachedKnowledgeExpiresAt = now + KNOWLEDGE_CACHE_TTL_MS;
  return cachedKnowledge;
}

export function resolveLanguage(question: string, language: ConciergeLanguage): ConciergeLanguage {
  return detectSpokenLanguage(question, language);
}

export function getActiveEventIdentityAnswer(
  question: string,
  language: ConciergeLanguage
): string | null {
  const q = normalize(question);
  const lang = resolveLanguage(question, language);
  const isIdentityQuestion = matchesAny(q, [
    "who are you",
    "what is your name",
    "your name",
    "introduce yourself",
    "what can you do",
    "help me",
    "من انت",
    "من أنت",
    "ما اسمك",
    "اسمك",
    "عرف نفسك",
    "ماذا تستطيع",
    "بماذا تساعد",
  ]);

  if (!isIdentityQuestion) return null;

  return lang === "ar"
    ? "أنا AIVENT، مساعدك الذكي للفعالية. أستطيع مساعدتك فقط في معلومات Gulf Pharma Connect 2026 مثل الجدول، المتحدثين، الموقع، التسجيل، المواصلات، الواي فاي، الوجبات، الشهادات ومعلومات المؤتمر الدوائي المعتمدة."
    : "I am AIVENT, your AI event concierge. I can help only with Gulf Pharma Connect 2026 information such as the agenda, speakers, venue, registration, transport, Wi-Fi, meals, certificates, and approved pharma congress details.";
}

export function getActiveEventOutOfScopeAnswer(
  question: string,
  language: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): string | null {
  const q = normalize(question);
  const lang = resolveLanguage(question, language);

  if (getActiveEventIdentityAnswer(question, lang)) return null;
  if (isAllowedEventOrPharmaQuestion(q)) return null;

  return lang === "ar"
    ? knowledge.fallbacks?.out_of_scope_ar ?? "أنا AIVENT، ويمكنني فقط المساعدة في معلومات الفعالية والمؤتمر الدوائي المعتمدة. يرجى توجيه أي موضوع آخر إلى فريق الفعالية."
    : knowledge.fallbacks?.out_of_scope_en ?? "I am AIVENT, and I can only help with event information and approved pharma congress details. Please ask the event team about anything outside that scope.";
}

export function getActiveEventRestrictedAnswer(
  question: string,
  language: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): string | null {
  const q = normalize(question);
  const lang = resolveLanguage(question, language);

  if (matchesAny(q, [
    "medical information desk",
    "medical desk",
    "booth m1",
    "where is medical",
    "مكتب المعلومات الطبية",
    "اين مكتب المعلومات الطبية",
    "أين مكتب المعلومات الطبية",
  ])) {
    return null;
  }

  const restricted = [
    "medical advice",
    "clinical recommendation",
    "diagnosis",
    "dose",
    "dosage",
    "side effect",
    "side effects",
    "adverse event",
    "drug interaction",
    "interaction",
    "contraindication",
    "off label",
    "patient specific",
    "patient",
    "prescribe",
    "prescription",
    "treatment plan",
    "safety",
    "is it safe",
    "can i take",
    "can my patient",
    "جرعة",
    "الجرعة",
    "أعراض جانبية",
    "اعراض جانبية",
    "الآثار الجانبية",
    "اثار جانبية",
    "تشخيص",
    "علاج",
    "وصفة",
    "تداخل",
    "موانع",
    "سلامة",
    "مريض",
  ];

  const configured = knowledge.conversation_policy?.safe_boundaries?.restricted ?? [];
  const shouldRefuse = [...restricted, ...configured].some(term => q.includes(normalize(term)));
  if (!shouldRefuse) return null;

  const safe = knowledge.conversation_policy?.safe_boundaries;
  return lang === "ar"
    ? safe?.restricted_response_ar ?? "عذرًا، لا يمكنني الإجابة عن الأسئلة الطبية أو السريرية. يرجى التوجه إلى مكتب المعلومات الطبية."
    : safe?.restricted_response_en ?? "I cannot answer medical, safety, dosing, or patient-specific questions. Please speak with the official medical representative.";
}

export function getActiveEventMockAnswer(
  question: string,
  language: ConciergeLanguage,
  knowledge: ActiveEventKnowledge = loadActiveEventKnowledge()
): string {
  const lang = resolveLanguage(question, language);
  const restricted = getActiveEventRestrictedAnswer(question, lang, knowledge);
  if (restricted) return restricted;

  const identity = getActiveEventIdentityAnswer(question, lang);
  if (identity) return identity;

  const outOfScope = getActiveEventOutOfScopeAnswer(question, lang, knowledge);
  if (outOfScope) return outOfScope;

  const common = findCommonQuestionAnswer(question, lang, knowledge);
  if (common) return common;

  const sample = findSampleDialogueAnswer(question, lang, knowledge);
  if (sample) return sample;

  const structured = findStructuredAnswer(question, lang, knowledge);
  if (structured) return structured;

  return fallback(knowledge, lang);
}

export function buildActiveEventSystemPrompt(
  knowledge: ActiveEventKnowledge,
  language: ConciergeLanguage
): string {
  const answerLanguage = language === "ar" ? "Arabic" : "English";

  return `
You are AIVENT, the AI event concierge for the active event.

Answer in ${answerLanguage}.
Your name is always AIVENT. Never call yourself Nour or any other name.
Use only the active event JSON below as your source of truth.
Help delegates only with pharma-event topics: event logistics, agenda, speakers, venue directions, registration, transport, Wi-Fi, meals, certificates, CPD credits, exhibition areas, information desks, and approved high-level pharma congress information from the active event JSON.

Rules:
1. Keep answers concise and professional, usually under 3 sentences.
2. Never invent rooms, speakers, timings, product claims, sponsor claims, or medical facts.
3. Refuse medical, safety, dosing, adverse-event, drug-interaction, patient-specific, or clinical-decision questions.
4. If a product or medical question needs clinical detail, direct the delegate to the medical information desk or official medical representative.
5. If the answer is not in the JSON, say you do not have it and direct the delegate to the information desk.
6. Return plain speech-friendly text only. Do not use Markdown, asterisks, bold formatting, tables, or bullet lists.
7. Refuse any question outside this pharma event scope, including general knowledge, entertainment, politics, sports, coding, weather, finance, legal, or unrelated personal advice.
8. If asked who you are, say you are AIVENT, the AI event concierge.

Active event JSON:
${JSON.stringify(knowledge, null, 2)}
`.trim();
}

function findCommonQuestionAnswer(
  question: string,
  lang: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): string | null {
  let best: { score: number; answer: string } | null = null;

  for (const item of knowledge.common_attendee_questions ?? []) {
    const answer = lang === "ar" ? item.answer_ar : item.answer_en;
    if (!answer) continue;

    const source = [item.intent, ...(item.examples ?? [])].filter(Boolean).join(" ");
    const score = scoreCandidate(question, source);
    if (!best || score > best.score) best = { score, answer };
  }

  return best && best.score >= 3 ? best.answer : null;
}

function findSampleDialogueAnswer(
  question: string,
  lang: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): string | null {
  let best: { score: number; answer: string } | null = null;

  for (const dialogue of knowledge.sample_dialogues ?? []) {
    for (const turn of dialogue.conversation ?? []) {
      const assistantAnswer = turn.aivent ?? turn.nour;
      if (!turn.attendee || !assistantAnswer) continue;
      if (lang === "ar" && !ARABIC_RE.test(assistantAnswer)) continue;
      if (lang === "en" && ARABIC_RE.test(assistantAnswer)) continue;

      const score = scoreCandidate(question, `${dialogue.title ?? ""} ${turn.attendee}`);
      if (!best || score > best.score) best = { score, answer: assistantAnswer };
    }
  }

  return best && best.score >= 3 ? best.answer : null;
}

function findStructuredAnswer(
  question: string,
  lang: ConciergeLanguage,
  knowledge: ActiveEventKnowledge
): string | null {
  const candidates = buildCandidates(knowledge);
  let best: { score: number; answer: string } | null = null;

  for (const candidate of candidates) {
    const source = [...candidate.en, ...candidate.ar].join(" ");
    const score = scoreCandidate(question, source);
    if (!best || score > best.score) {
      best = {
        score,
        answer: lang === "ar" ? candidate.answerAr : candidate.answerEn,
      };
    }
  }

  return best && best.score >= 3 ? best.answer : null;
}

function buildCandidates(k: ActiveEventKnowledge): Candidate[] {
  const desks = k.information_desks ?? {};
  const journey = k.attendee_journey ?? {};
  const exhibition = k.exhibition ?? {};
  const networking = k.networking ?? {};
  const certs = k.certificates_and_cpd ?? {};
  const escalation = k.escalation ?? {};
  const candidates: Candidate[] = [];

  addCandidate(candidates, {
    en: ["agenda", "schedule", "program", "highlight", "highlights", "today", "opening keynote", "what is happening", "sessions"],
    ar: ["جدول", "برنامج", "أبرز", "ابرز", "اليوم", "الجلسات", "المحاضرة الافتتاحية"],
    answerEn: [
      journey.day_1_recommendation,
      "Known highlights include the 11:20 Digital Health Adoption workshop in Room 4, lunch in Garden Hall, and the Day 1 gala dinner from 19:00 to 22:00.",
      journey.day_2_recommendation,
    ].filter(Boolean).join(" "),
    answerAr: "في اليوم الأول يُفضّل الوصول بين 08:00 و08:30 لاستلام البطاقة والقهوة الترحيبية قبل المحاضرة الافتتاحية الساعة 09:00 في Ballroom A. من أبرز المحطات ورشة Digital Health Adoption الساعة 11:20 في Room 4، والغداء في Garden Hall، وحفل العشاء من 19:00 إلى 22:00. في اليوم الثاني يُفضّل الوصول قبل 08:30 استعدادًا لمحاضرة 09:00 حول الذكاء الاصطناعي في التجارب السريرية.",
  });

  addCandidate(candidates, {
    en: ["arrival", "arrive", "first", "where should i go", "badge first", "late arrival"],
    ar: ["وصلت", "الوصول", "أين أذهب", "اين اذهب", "متأخر", "وصلت متأخر"],
    answerEn: journey.arrival_flow?.length
      ? `${journey.arrival_flow.join(" ")} ${journey.late_arrival_guidance ?? ""}`.trim()
      : "Please proceed to the Grand Foyer registration desk first, then follow signs to Ballroom A.",
    answerAr: "عند الوصول إلى المدخل الرئيسي في Conrad Dubai، توجّه إلى الردهة الكبرى في الطابق الأرضي لاستلام البطاقة من مكتب التسجيل، ثم اتبع اللوحات إلى Ballroom A. إذا وصلت متأخرًا، استلم بطاقتك أولًا واسأل فريق التسجيل إن كانت الجلسة الحالية بدأت قبل الدخول.",
  });

  addCandidate(candidates, deskCandidate(
    ["main information desk", "information desk", "help desk", "lost and found", "support", "event team"],
    ["مكتب المعلومات", "مكتب المساعدة", "الدعم", "المفقودات", "فريق الفعالية"],
    desks.main_information_desk,
    "main information desk",
    "مكتب المعلومات الرئيسي"
  ));

  addCandidate(candidates, deskCandidate(
    ["transport desk", "airport shuttle", "taxi", "metro", "hotel shuttle", "transport", "airport"],
    ["مكتب المواصلات", "المطار", "تاكسي", "المترو", "الحافلة", "المواصلات"],
    desks.transport_desk,
    "transport desk",
    "مكتب المواصلات",
    "For airport return, the transport desk can help with shuttle changes and taxis. The sample event guidance estimates a taxi to Dubai International Airport at AED 80 to 100.",
    "للعودة إلى المطار، يمكن لمكتب المواصلات مساعدتك في الحافلات أو سيارات الأجرة. حسب إرشادات الفعالية، تكلفة التاكسي إلى مطار دبي الدولي تقريبًا بين 80 و100 درهم."
  ));

  addCandidate(candidates, deskCandidate(
    ["medical information desk", "medical desk", "booth m1", "medical representative", "where is medical"],
    ["مكتب المعلومات الطبية", "الممثل الطبي", "جناح m1", "أين مكتب المعلومات الطبية"],
    desks.medical_information_desk,
    "medical information desk",
    "مكتب المعلومات الطبية"
  ));

  for (const direction of k.venue_navigation?.directions ?? []) {
    if (!direction.answer) continue;
    addCandidate(candidates, {
      en: [
        "directions",
        "how do i get",
        "where is",
        direction.from ?? "",
        direction.to ?? "",
      ],
      ar: [
        "اتجاهات",
        "كيف أصل",
        "كيف اصل",
        "أين",
        "اين",
        direction.from ?? "",
        direction.to ?? "",
      ],
      answerEn: direction.answer,
      answerAr: translateDirection(direction),
    });
  }

  addCandidate(candidates, {
    en: ["wheelchair", "accessible", "accessibility", "elevator", "quiet area", "special assistance"],
    ar: ["كرسي متحرك", "ذوي الاحتياجات", "مصعد", "هدوء", "مساعدة خاصة"],
    answerEn: [
      k.venue_navigation?.accessibility?.wheelchair_access,
      k.venue_navigation?.accessibility?.elevator_access,
      k.venue_navigation?.accessibility?.quiet_area,
    ].filter(Boolean).join(" "),
    answerAr: "مناطق المؤتمر في Conrad Dubai مناسبة للكراسي المتحركة، وتتوفر المصاعد إلى الطابق الثاني ومناطق السطح. إذا احتجت مساعدة أو منطقة هادئة، يرجى مراجعة مكتب المعلومات في الردهة الكبرى.",
  });

  addCandidate(candidates, {
    en: ["certificate", "attendance certificate", "cpd", "credits", "credit confirmation"],
    ar: ["شهادة", "شهادة الحضور", "اعتماد", "ساعات الاعتماد", "نقاط cpd"],
    answerEn: [
      certs.certificate_process,
      certs.cpd_process,
      certs.cpd_credit_total ? `Total: ${trimSentence(certs.cpd_credit_total)}.` : "",
    ].filter(Boolean).join(" "),
    answerAr: "سيتم إرسال شهادات الحضور عبر البريد الإلكتروني خلال 5 أيام عمل بعد الفعالية. للحصول على تأكيد ساعات CPD، يجب تأكيد الحضور في مكتب التسجيل كل يوم. إجمالي الاعتماد هو 8 ساعات CPD على مدى يومين، حسب تأكيد الحضور.",
  });

  addCandidate(candidates, {
    en: ["exhibition", "booth", "booths", "sponsor", "digital health", "networking lounge", "medical information zone"],
    ar: ["المعرض", "الأجنحة", "الجناح", "الرعاة", "الصحة الرقمية", "منطقة التواصل"],
    answerEn: `${exhibition.location ? `The exhibition is in ${exhibition.location}. ` : ""}Hours are ${exhibition.hours_day_1 ?? "not specified"} on Day 1 and ${exhibition.hours_day_2 ?? "not specified"} on Day 2. Zones include ${formatZones(exhibition.zones)}. ${exhibition.booth_guidance ?? ""}`.trim(),
    answerAr: `يقع المعرض في ${exhibition.location ?? "منطقة المعرض بجانب القاعة الرئيسية"}. المواعيد هي ${exhibition.hours_day_1 ?? "غير محددة"} في اليوم الأول و${exhibition.hours_day_2 ?? "غير محددة"} في اليوم الثاني. تشمل المناطق: ${formatZones(exhibition.zones)}. يرجى مراجعة خريطة المعرض أو مكتب المعلومات للتوزيع الدقيق للأجنحة.`,
  });

  addCandidate(candidates, {
    en: ["networking", "coffee", "business cards", "meeting point", "gala", "dinner", "rooftop"],
    ar: ["التواصل", "القهوة", "بطاقات العمل", "نقطة لقاء", "حفل العشاء", "العشاء", "السطح"],
    answerEn: `Recommended networking times: ${(networking.recommended_times ?? []).join("; ")}. Meeting points include ${(networking.meeting_points ?? []).join(", ")}.`,
    answerAr: `أفضل أوقات التواصل هي: ${(networking.recommended_times ?? []).join("؛ ")}. نقاط اللقاء تشمل: ${(networking.meeting_points ?? []).join("، ")}.`,
  });

  addCandidate(candidates, {
    en: ["speaker", "speakers", "who is speaking", "day 2 speaker", "presenter"],
    ar: ["المتحدث", "المتحدثون", "من يتحدث", "محاضر", "المحاضر"],
    answerEn: "The current active event details do not list speaker names. I can confirm Day 2 starts with the 09:00 keynote on AI in Clinical Trials in Ballroom A; for the speaker roster, please ask the information desk in the Grand Foyer.",
    answerAr: "تفاصيل الفعالية الحالية لا تعرض أسماء المتحدثين. أستطيع تأكيد أن اليوم الثاني يبدأ بمحاضرة الساعة 09:00 عن الذكاء الاصطناعي في التجارب السريرية في Ballroom A؛ ولأسماء المتحدثين يرجى مراجعة مكتب المعلومات في الردهة الكبرى.",
  });

  addCandidate(candidates, {
    en: ["cardivex", "product information", "where is cardivex discussed", "what is cardivex used for"],
    ar: ["cardivex", "كارديفكس", "معلومات المنتج", "أين يناقش", "استخدام cardivex"],
    answerEn: "The active event details only state that Cardivex is referenced in the Day 1 symposium on cardiovascular co-morbidities connected to the Oncology Pipeline Updates session in Ballroom A. For approved medical or product-use details, please visit the medical information desk at Booth M1.",
    answerAr: "تفاصيل الفعالية الحالية تذكر فقط أن Cardivex يُشار إليه في ندوة اليوم الأول حول الأمراض القلبية المصاحبة والمرتبطة بجلسة Oncology Pipeline Updates في Ballroom A. لأي معلومات طبية أو تفاصيل استخدام معتمدة، يرجى زيارة مكتب المعلومات الطبية في الجناح M1.",
  });

  addCandidate(candidates, {
    en: ["emergency", "urgent", "help immediately"],
    ar: ["طوارئ", "عاجل", "مساعدة فورية"],
    answerEn: escalation.emergency_script_en ?? "For urgent assistance, speak to the nearest event staff member immediately.",
    answerAr: escalation.emergency_script_ar ?? "للمساعدة العاجلة، يرجى التوجه فورًا إلى أقرب عضو من فريق التنظيم.",
  });

  return candidates.filter(c => c.answerEn.trim() && c.answerAr.trim());
}

function deskCandidate(
  en: string[],
  ar: string[],
  desk: DeskInfo | undefined,
  enLabel: string,
  arLabel: string,
  extraEn = "",
  extraAr = ""
): Candidate {
  const services = desk?.services?.length ? ` Services include ${desk.services.join(", ")}.` : "";
  const hours = desk?.hours ?? [desk?.hours_day_1, desk?.hours_day_2].filter(Boolean).join(" / ");

  return {
    en,
    ar,
    answerEn: `The ${enLabel} is at ${desk?.location ?? "the Grand Foyer"}.${hours ? ` Hours: ${hours}.` : ""}${desk?.purpose ? ` ${desk.purpose}` : ""}${services} ${extraEn}`.trim(),
    answerAr: `${arLabel} موجود في ${desk?.location ?? "الردهة الكبرى"}.${hours ? ` المواعيد: ${hours}.` : ""}${desk?.purpose ? ` ${desk.purpose}` : ""}${desk?.services?.length ? ` يمكنه المساعدة في: ${desk.services.join("، ")}.` : ""} ${extraAr}`.trim(),
  };
}

function addCandidate(candidates: Candidate[], candidate: Candidate): void {
  if (candidate.answerEn.trim() || candidate.answerAr.trim()) candidates.push(candidate);
}

function formatZones(zones: ExhibitionZone[] | undefined): string {
  if (!zones?.length) return "not specified";
  return zones
    .map(zone => `${zone.zone ?? "Zone"}${zone.booths?.length ? ` (${zone.booths.join(", ")})` : ""}`)
    .join(", ");
}

function isAllowedEventOrPharmaQuestion(q: string): boolean {
  const allowedTerms = [
    "gulf pharma",
    "pharma connect",
    "pharma",
    "pharmaceutical",
    "congress",
    "conference",
    "event",
    "agenda",
    "schedule",
    "program",
    "session",
    "keynote",
    "panel",
    "workshop",
    "speaker",
    "presenter",
    "opening",
    "closing",
    "registration",
    "badge",
    "check in",
    "venue",
    "direction",
    "directions",
    "room",
    "ballroom",
    "foyer",
    "conrad",
    "wifi",
    "wi fi",
    "internet",
    "password",
    "lunch",
    "dinner",
    "meal",
    "coffee",
    "halal",
    "vegetarian",
    "vegan",
    "gluten",
    "allergy",
    "prayer",
    "parking",
    "valet",
    "transport",
    "airport",
    "shuttle",
    "taxi",
    "metro",
    "hotel",
    "certificate",
    "attendance",
    "cpd",
    "credit",
    "exhibition",
    "booth",
    "sponsor",
    "poster",
    "medical information desk",
    "medical desk",
    "representative",
    "cardivex",
    "oncology",
    "clinical trials",
    "digital health",
    "regulatory",
    "market access",
    "emergency",
    "first day",
    "day 1",
    "day one",
    "day 2",
    "day two",
    "فعالية",
    "المؤتمر",
    "الدوائي",
    "فارما",
    "جدول",
    "برنامج",
    "جلسة",
    "الجلسة",
    "محاضرة",
    "المحاضرة",
    "متحدث",
    "المتحدث",
    "التسجيل",
    "بطاقة",
    "المكان",
    "القاعة",
    "غرفة",
    "كيف اصل",
    "كيف أصل",
    "واي فاي",
    "كلمة المرور",
    "انترنت",
    "الغداء",
    "العشاء",
    "القهوة",
    "حلال",
    "نباتي",
    "صلاة",
    "مواقف",
    "مواصلات",
    "المطار",
    "تاكسي",
    "المترو",
    "الفندق",
    "شهادة",
    "اعتماد",
    "المعرض",
    "جناح",
    "الرعاة",
    "مكتب المعلومات الطبية",
    "كارديفكس",
    "طوارئ",
  ];

  return allowedTerms.some(term => q.includes(normalize(term)));
}

function translateDirection(direction: DirectionInfo): string {
  const target = normalize(direction.to ?? "");

  if (target.includes("registration")) {
    return "من مدخل الفندق الرئيسي، ادخل إلى اللوبي واتبع لوحات الفعالية إلى الردهة الكبرى في الطابق الأرضي. مكتب التسجيل يقع مباشرة قبل مدخل Ballroom A.";
  }
  if (target.includes("ballroom a")) {
    return "من مكتب التسجيل، تقع Ballroom A أمامك مباشرة بعد منطقة القهوة الترحيبية. سيكون فريق الفعالية موجودًا عند المدخل للمساعدة.";
  }
  if (target.includes("room 4")) {
    return "اخرج من Ballroom A إلى الردهة، ثم انعطف يمينًا واتبع لوحات Meeting Rooms 1-5. تقع Room 4 بالقرب من نهاية الممر.";
  }
  if (target.includes("garden hall")) {
    return "اخرج من Ballroom A إلى الردهة واتبع لوحات الغداء باتجاه Garden Hall. القاعة قريبة من منطقة المؤتمر الرئيسية.";
  }
  if (target.includes("prayer")) {
    return "غرفة الصلاة في الطابق الثاني، Room 210. يمكنك استخدام المصعد أو السلالم من منطقة المؤتمر.";
  }
  if (target.includes("gala") || target.includes("rooftop")) {
    return "لحفل العشاء، استخدم مصعد الفندق إلى مستوى السطح. سيكون فريق الفعالية في اللوبي من الساعة 18:45 لإرشاد الضيوف.";
  }

  return direction.answer ?? "يرجى مراجعة مكتب المعلومات للحصول على الاتجاهات الدقيقة.";
}

function fallback(k: ActiveEventKnowledge, lang: ConciergeLanguage): string {
  return lang === "ar"
    ? k.fallbacks?.unknown_answer_ar ?? "لا تتوفر لدي هذه المعلومة ضمن تفاصيل الفعالية الحالية. يرجى مراجعة مكتب المعلومات."
    : k.fallbacks?.unknown_answer_en ?? "I do not have that information in the current event details. Please check with the information desk.";
}

function scoreCandidate(question: string, source: string): number {
  const normalizedQuestion = normalize(question);
  const normalizedSource = normalize(source);
  if (!normalizedQuestion || !normalizedSource) return 0;

  let score = 0;
  if (normalizedSource.includes(normalizedQuestion)) score += 5;

  for (const token of tokenize(normalizedQuestion)) {
    if (normalizedSource.includes(token)) score += token.length > 4 || ARABIC_RE.test(token) ? 2 : 1;
  }

  return score;
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length > 2)
    .filter(token => !EN_STOPWORDS.has(token) && !AR_STOPWORDS.has(token));
}

function matchesAny(value: string, terms: string[]): boolean {
  return terms.some(term => value.includes(normalize(term)));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064b-\u065f]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[_-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSentence(value: string): string {
  return value.replace(/[.\s]+$/g, "");
}

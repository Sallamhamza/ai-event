import OpenAI from "openai";
import { containsArabicText, type ConciergeLanguage } from "@/lib/language";

export const runtime = "nodejs";

const TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_ARABIC_VOICE = "cedar";
const DEFAULT_ENGLISH_VOICE = "onyx";
const MAX_TTS_CHARS = 4096;

const SUPPORTED_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

type SpeechVoice = (typeof SUPPORTED_VOICES)[number];
type SpeechModel = "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts" | "gpt-4o-mini-tts-2025-12-15";

const ARABIC_HOURS: Record<number, string> = {
  1: "الواحدة",
  2: "الثانية",
  3: "الثالثة",
  4: "الرابعة",
  5: "الخامسة",
  6: "السادسة",
  7: "السابعة",
  8: "الثامنة",
  9: "التاسعة",
  10: "العاشرة",
  11: "الحادية عشرة",
  12: "الثانية عشرة",
};

const ARABIC_MINUTES: Record<number, string> = {
  5: "خمس دقائق",
  10: "عشر دقائق",
  15: "الربع",
  20: "عشرون دقيقة",
  25: "خمس وعشرون دقيقة",
  35: "خمس وثلاثون دقيقة",
  40: "أربعون دقيقة",
  50: "خمسون دقيقة",
  55: "خمس وخمسون دقيقة",
};

function resolveLanguage(text: string, fallback: ConciergeLanguage): ConciergeLanguage {
  return containsArabicText(text) ? "ar" : fallback;
}

function getVoice(language: ConciergeLanguage): SpeechVoice {
  const value = (
    language === "ar"
      ? process.env.OPENAI_TTS_VOICE_AR
      : process.env.OPENAI_TTS_VOICE_EN
  )?.trim();

  if (value && SUPPORTED_VOICES.includes(value as SpeechVoice)) {
    return value as SpeechVoice;
  }

  return language === "ar" ? DEFAULT_ARABIC_VOICE : DEFAULT_ENGLISH_VOICE;
}

function getModel(): SpeechModel {
  const value = process.env.OPENAI_TTS_MODEL?.trim();
  if (
    value === "tts-1" ||
    value === "tts-1-hd" ||
    value === "gpt-4o-mini-tts" ||
    value === "gpt-4o-mini-tts-2025-12-15"
  ) {
    return value;
  }

  return TTS_MODEL;
}

function normalizePeriod(period: string | undefined): "am" | "pm" | null {
  if (!period) return null;
  const value = period.toLowerCase();
  if (value === "am" || value === "a.m." || value === "ص" || value.includes("صباح")) {
    return "am";
  }
  if (value === "pm" || value === "p.m." || value === "م" || value.includes("مساء")) {
    return "pm";
  }
  return null;
}

function resolveClockHour(hour: number, period: "am" | "pm" | null): number {
  if (period === "pm" && hour < 12) return hour + 12;
  if (period === "am" && hour === 12) return 0;
  return hour;
}

function arabicClockPeriod(hour24: number, period: "am" | "pm" | null): string {
  if (period === "am") return "صباحًا";
  if (period === "pm") return "مساءً";
  return hour24 >= 12 ? "مساءً" : "صباحًا";
}

function arabicClockHour(hour24: number): string {
  const hour12 = hour24 % 12 || 12;
  return ARABIC_HOURS[hour12];
}

function arabicMinutePhrase(minutes: number): string {
  if (minutes === 30) return "والنصف";
  if (minutes === 15) return "والربع";
  return `و${ARABIC_MINUTES[minutes] ?? `${minutes} دقيقة`}`;
}

function formatArabicClockTime(
  rawHour: string,
  rawMinutes = "00",
  rawPeriod?: string
): string {
  const parsedHour = Number(rawHour);
  const minutes = Number(rawMinutes);
  const period = normalizePeriod(rawPeriod);
  const hour24 = resolveClockHour(parsedHour, period);
  const periodText = arabicClockPeriod(hour24, period);

  if (!Number.isFinite(parsedHour) || !Number.isFinite(minutes)) {
    return `${rawHour}:${rawMinutes}`;
  }

  if (minutes === 0) {
    return `الساعة ${arabicClockHour(hour24)} ${periodText}`;
  }

  if (minutes === 45) {
    return `الساعة ${arabicClockHour(hour24 + 1)} إلا ربعًا ${periodText}`;
  }

  return `الساعة ${arabicClockHour(hour24)} ${arabicMinutePhrase(minutes)} ${periodText}`;
}

function normalizeArabicSpeechText(text: string): string {
  return text
    .replace(/\bAIVENT\b/gi, "آي فِنت")
    .replace(/\bWi[-\s]?Fi\b/gi, "واي فاي")
    .replace(/\bGCC\b/g, "جي سي سي")
    .replace(/\bCPD\b/g, "سي بي دي")
    .replace(/\bTVCO\b/g, "تي في سي أو")
    .replace(/\bD-ID\b/gi, "دي آي دي")
    .replace(/\bDay\s*1\b/gi, "اليوم الأول")
    .replace(/\bDay\s*2\b/gi, "اليوم الثاني")
    .replace(
      /\b([01]?\d|2[0-3]):([0-5]\d)\s*(AM|PM|a\.m\.|p\.m\.|صباحًا|صباحا|مساءً|مساء|ص|م)?\b/gi,
      (_match, hour: string, minutes: string, period: string | undefined) =>
        formatArabicClockTime(hour, minutes, period)
    )
    .replace(
      /\b(1[0-2]|[1-9])\s*(AM|PM|a\.m\.|p\.m\.)\b/gi,
      (_match, hour: string, period: string) => formatArabicClockTime(hour, "00", period)
    )
    .replace(/\s+/g, " ")
    .trim();
}

function buildInstructions(language: ConciergeLanguage): string {
  if (language === "ar") {
    return [
      "Speak in clear Modern Standard Arabic with a polished GCC corporate event concierge tone.",
      "Pronounce Arabic words naturally and avoid English pronunciation for Arabic sentences.",
      "Keep the pace slightly slower than normal for a busy conference kiosk.",
      "Pronounce AIVENT as آي فِنت.",
      "Read acronyms clearly letter by letter.",
      "Read clock times naturally, for example 09:00 as الساعة التاسعة صباحًا.",
      "Do not add words that are not in the input.",
    ].join(" ");
  }

  return [
    "Speak in a calm, professional male corporate event concierge tone.",
    "Keep the pace clear for a conference kiosk.",
    "Do not add words that are not in the input.",
  ].join(" ");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await request.json();
    const text = String(body.text || "").trim();
    const fallbackLanguage: ConciergeLanguage = body.language === "ar" ? "ar" : "en";
    const language = resolveLanguage(text, fallbackLanguage);

    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    if (text.length > MAX_TTS_CHARS) {
      return Response.json({ error: "Text is too long for speech generation" }, { status: 400 });
    }

    const input = language === "ar" ? normalizeArabicSpeechText(text) : text;
    const client = new OpenAI({ apiKey });
    const speech = await client.audio.speech.create({
      model: getModel(),
      voice: getVoice(language),
      input,
      instructions: buildInstructions(language),
      response_format: "mp3",
    });

    const audio = Buffer.from(await speech.arrayBuffer());

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Aivent-Speech-Language": language,
        "X-Aivent-Speech-Voice": getVoice(language),
      },
    });
  } catch (error) {
    console.error("TTS route error:", error);
    return Response.json({ error: "Speech generation failed" }, { status: 500 });
  }
}

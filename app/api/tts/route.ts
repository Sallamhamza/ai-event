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

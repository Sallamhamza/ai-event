import { detectLanguageFromText, type ConciergeLanguage } from "@/lib/language";

const DEFAULT_ENGLISH_VOICE = "en-US-GuyNeural";
const DEFAULT_ARABIC_VOICE = "ar-SA-HamedNeural";

function configuredVoice(value: string | undefined, prefix: string): string | null {
  const voice = value?.trim();
  if (!voice) return null;
  return voice.toLowerCase().startsWith(prefix) ? voice : null;
}

export function getDidVoiceId(language: ConciergeLanguage): string {
  if (language === "ar") {
    return configuredVoice(process.env.DID_VOICE_ID_AR, "ar-") ?? DEFAULT_ARABIC_VOICE;
  }

  return configuredVoice(process.env.DID_VOICE_ID, "en-") ?? DEFAULT_ENGLISH_VOICE;
}

export function resolveDidSpeech(
  text: string,
  fallback: ConciergeLanguage
): { language: ConciergeLanguage; voiceId: string } {
  const language = detectLanguageFromText(text, fallback);
  return {
    language,
    voiceId: getDidVoiceId(language),
  };
}

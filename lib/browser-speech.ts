"use client";

import { detectLanguageFromText, type ConciergeLanguage } from "@/lib/language";

const FEMALE_VOICE_PATTERN =
  /female|woman|samantha|victoria|karen|zira|hazel|emma|siri|fiona|moira|tessa|allison|ava|susan|kate|linda|alice|amelie|anna|joana|laura|lekha|luciana|mariska|mei|monica|nora|paulina|satu|sin-ji|soledad|ting-ting|veena|yuna/i;

let voiceCache: SpeechSynthesisVoice[] = [];
let voiceListenerAttached = false;

function refreshVoiceCache(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  voiceCache = window.speechSynthesis.getVoices();
  return voiceCache;
}

function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];

  if (!voiceListenerAttached) {
    voiceListenerAttached = true;
    refreshVoiceCache();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoiceCache);
  }

  return voiceCache.length ? voiceCache : refreshVoiceCache();
}

function chooseEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang.startsWith("en") && /\bmale\b/i.test(voice.name)) ??
    voices.find((voice) =>
      voice.lang.startsWith("en") &&
      /\b(david|mark|daniel|james|george|ryan|richard|alex|fred|guy|tom|oliver|rishi|aaron|arthur|thomas)\b/i.test(
        voice.name
      )
    ) ??
    voices.find(
      (voice) => voice.lang.startsWith("en-US") && !FEMALE_VOICE_PATTERN.test(voice.name)
    ) ??
    voices.find((voice) => voice.lang.startsWith("en") && !FEMALE_VOICE_PATTERN.test(voice.name))
  );
}

function chooseArabicVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => voice.lang === "ar-SA") ?? voices.find((voice) => voice.lang.startsWith("ar"));
}

export function stopBrowserSpeech(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function speakWithBrowserSpeech(
  text: string,
  fallbackLanguage: ConciergeLanguage = "en"
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    stopBrowserSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = getBrowserVoices();
    const language = detectLanguageFromText(text, fallbackLanguage);

    if (language === "ar") {
      utterance.lang = "ar-SA";
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      const voice = chooseArabicVoice(voices);
      if (voice) utterance.voice = voice;
    } else {
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      utterance.pitch = 0.82;
      const voice = chooseEnglishVoice(voices);
      if (voice) utterance.voice = voice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

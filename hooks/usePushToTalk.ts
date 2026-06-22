"use client";

// hooks/usePushToTalk.ts
// Push-to-talk with automatic bilingual support (Arabic/English).
//
// How language detection works:
// 1. Speech recognition lang is set from navigator.language (Arabic phones → ar-SA, English → en-US)
// 2. After transcription, we detect language from the text (Arabic Unicode chars)
// 3. API receives the detected language and responds in that language
// 4. TTS speaks the answer in the detected language with appropriate voice

import { useRef, useState, useCallback } from "react";
import type { DIDAvatar } from "@/components/AvatarStream";

// ── Language detection from text ─────────────────────────────────────────────
type Lang = "en" | "ar";

function detectLang(text: string): Lang {
  // Count Arabic Unicode characters (U+0600–U+06FF range)
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  // If the text contains ANY Arabic characters, it's Arabic
  // (speech recognition in ar-SA mode produces Arabic text)
  return arabicCount > 0 ? "ar" : "en";
}

// ── Female voice blocklist (filter OUT on all platforms) ─────────────────────
const FEMALE = /female|woman|samantha|victoria|karen|zira|hazel|emma|siri|fiona|moira|tessa|allison|ava|susan|kate|linda|alice|amelie|anna|joana|laura|lekha|luciana|mariska|mei|monica|nora|paulina|satu|sin-ji|soledad|ting-ting|veena|yuna/i;

// ── Voice cache — iOS fix: getVoices() returns [] on first call ──────────────
let _voiceCache: SpeechSynthesisVoice[] = [];
if (typeof window !== "undefined" && window.speechSynthesis) {
  const load = () => { _voiceCache = window.speechSynthesis.getVoices(); };
  load();
  window.speechSynthesis.addEventListener("voiceschanged", load);
}
function cachedVoices(): SpeechSynthesisVoice[] {
  return _voiceCache.length ? _voiceCache : (window.speechSynthesis?.getVoices() ?? []);
}

// ── TTS helper ──────────────────────────────────────────────────────────────
function speakTTS(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = cachedVoices();

    if (lang === "ar") {
      utter.lang  = "ar-SA";
      utter.rate  = 0.88;
      utter.pitch = 1.0;
      const arVoice =
        voices.find(v => v.lang === "ar-SA") ??
        voices.find(v => v.lang.startsWith("ar"));
      if (arVoice) utter.voice = arVoice;
    } else {
      utter.lang  = "en-US";
      utter.rate  = 0.92;
      utter.pitch = 0.82; // lower pitch → masculine
      const male =
        voices.find(v => v.lang.startsWith("en") && /\bmale\b/i.test(v.name)) ??
        voices.find(v => v.lang.startsWith("en") && /\b(david|mark|daniel|james|george|ryan|richard|alex|fred|guy|tom|oliver|rishi|aaron|arthur|thomas)\b/i.test(v.name)) ??
        voices.find(v => v.lang.startsWith("en-US") && !FEMALE.test(v.name)) ??
        voices.find(v => v.lang.startsWith("en")    && !FEMALE.test(v.name));
      if (male) utter.voice = male;
    }

    utter.onend   = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis?.speak(utter);
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────
export type PTTStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

interface UsePushToTalkOptions {
  avatar?:       DIDAvatar | null;
  onTranscript?: (text: string) => void;
  onAnswer?:     (text: string) => void;
  onLanguageDetected?: (lang: Lang) => void;  // tells parent what language was detected
}

export function usePushToTalk({
  avatar,
  onTranscript,
  onAnswer,
  onLanguageDetected,
}: UsePushToTalkOptions) {
  const [status, setStatus] = useState<PTTStatus>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError]   = useState<string | null>(null);

  const recognitionRef     = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

  // ── Start recording ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (status !== "idle") return;

    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError("Speech recognition is not supported in this browser. Use Chrome.");
      setStatus("error");
      return;
    }

    const recognition = new SpeechRecognitionAPI();

    // Auto-detect recognition language from device:
    // Arabic phones (ar-SA, ar-AE, etc.) → recognize Arabic
    // Everything else → recognize English
    const navLang = (navigator.language || "en-US").toLowerCase();
    recognition.lang = navLang.startsWith("ar") ? "ar-SA" : "en-US";

    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";
    setLiveTranscript("");
    setError(null);
    setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }
      finalTranscriptRef.current += final;
      setLiveTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return;
      setError(`Microphone error: ${event.error}`);
      setStatus("error");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [status]);

  // ── Stop recording → detect language → ask API → speak answer ──────────
  const stopListening = useCallback(async () => {
    if (status !== "listening") return;

    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const transcript = (finalTranscriptRef.current || liveTranscript).trim();
    if (!transcript) {
      setStatus("idle");
      setLiveTranscript("");
      return;
    }

    onTranscript?.(transcript);
    setStatus("thinking");

    // Detect language from what the user actually said
    const lang = detectLang(transcript);
    onLanguageDetected?.(lang);

    try {
      const res = await fetch("/api/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: transcript, language: lang }),
      });
      const data   = await res.json();
      const answer = data.answer ?? (
        lang === "ar"
          ? "عذرًا، لم أتمكن من الحصول على إجابة. يرجى المحاولة مرة أخرى."
          : "Sorry, I couldn't get an answer. Please try again."
      );

      // Double-check: if the API returned Arabic text, speak in Arabic
      const answerLang = detectLang(answer);
      onLanguageDetected?.(answerLang);
      onAnswer?.(answer);

      setStatus("speaking");

      // Speak the answer
      if (avatar) {
        try {
          await avatar.speak(answer, answerLang);
        } catch {
          await speakTTS(answer, answerLang);
        }
      } else {
        await speakTTS(answer, answerLang);
      }

      setStatus("idle");
    } catch (err) {
      console.error("Concierge error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }

    setLiveTranscript("");
  }, [status, liveTranscript, avatar, onTranscript, onAnswer, onLanguageDetected]);

  // ── Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
    setLiveTranscript("");
    setError(null);
  }, []);

  return { status, liveTranscript, error, startListening, stopListening, reset };
}

"use client";

// hooks/usePushToTalk.ts
// Full push-to-talk lifecycle:
//   hold button / space bar → Web Speech API recording
//   release                 → POST to /api/ask with language → speak answer in same language

import { useRef, useState, useCallback, useEffect } from "react";
import type { DIDAvatar } from "@/components/AvatarStream";
import { detectLanguageFromText, type ConciergeLanguage } from "@/lib/language";

// ── Female voice blocklist (works on iOS/Android/Windows) ──────────────────────────
const FEMALE = /female|woman|samantha|victoria|karen|zira|hazel|emma|siri|fiona|moira|tessa|allison|ava|susan|kate|linda|alice|amelie|anna|joana|laura|lekha|luciana|mariska|mei|monica|nora|paulina|satu|sin-ji|soledad|ting-ting|veena|yuna/i;

// ── Voice cache — iOS fix: getVoices() returns [] on first call; must listen to voiceschanged ──
let _cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== "undefined" && window.speechSynthesis) {
  const loadVoices = () => { _cachedVoices = window.speechSynthesis.getVoices(); };
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}
const getVoices = () =>
  _cachedVoices.length ? _cachedVoices : (window.speechSynthesis?.getVoices() ?? []);

export type PTTStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

interface UsePushToTalkOptions {
  avatar?:      DIDAvatar | null;
  language?:    ConciergeLanguage;        // set from parent language toggle
  onTranscript?: (text: string) => void;
  onAnswer?:     (text: string) => void;
  onLanguageResolved?: (language: ConciergeLanguage) => void;
}

export function usePushToTalk({
  avatar,
  language = "en",
  onTranscript,
  onAnswer,
  onLanguageResolved,
}: UsePushToTalkOptions) {
  const [status, setStatus] = useState<PTTStatus>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const languageRef = useRef<ConciergeLanguage>(language);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // ── Start recording ─────────────────────────────────────────────────────────
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
    const recognitionLanguage = languageRef.current;
    recognition.lang           = recognitionLanguage === "ar" ? "ar-SA" : "en-US";
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";
    setLiveTranscript("");
    setError(null);
    setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
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

  // ── Stop recording, send to Gemini, speak answer ────────────────────────────
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

    // The transcript decides the answer language. The toggle is only a recognition hint.
    const requestLang = detectLanguageFromText(transcript, languageRef.current);
    onLanguageResolved?.(requestLang);

    try {
      const res = await fetch("/api/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: transcript, language: requestLang }),
      });
      const data   = await res.json();
      const answer = data.answer ?? (
        requestLang === "ar"
          ? "عذرًا، لم أتمكن من الحصول على إجابة. يرجى المحاولة مرة أخرى."
          : "Sorry, I couldn't get an answer. Please try again."
      );
      const answerFallbackLang: ConciergeLanguage = data.language === "ar" ? "ar" : requestLang;
      const speechLang = detectLanguageFromText(
        answer,
        answerFallbackLang
      );
      onLanguageResolved?.(speechLang);
      onAnswer?.(answer);

      setStatus("speaking");

      const speakViaTTS = async (text: string) => {
        await new Promise<void>((resolve) => {
          window.speechSynthesis?.cancel();
          const utter  = new SpeechSynthesisUtterance(text);
          const voices = getVoices();

          if (speechLang === "ar") {
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
            utter.pitch = 0.82;
            const maleVoice =
              voices.find(v => v.lang.startsWith("en") && /\bmale\b/i.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en") && /\b(david|mark|daniel|james|george|ryan|richard|alex|fred|guy|tom|oliver|rishi|aaron|arthur|thomas)\b/i.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en-US") && !FEMALE.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en")    && !FEMALE.test(v.name));
            if (maleVoice) utter.voice = maleVoice;
          }
          utter.onend  = () => resolve();
          utter.onerror= () => resolve();
          window.speechSynthesis?.speak(utter);
        });
      };

      if (avatar) {
        try {
          await avatar.speak(answer, speechLang);
        } catch {
          await speakViaTTS(answer);
        }
      } else {
        await speakViaTTS(answer);
      }

      setStatus("idle");
    } catch (err) {
      console.error("Concierge error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }

    setLiveTranscript("");
  }, [status, liveTranscript, avatar, onTranscript, onAnswer, onLanguageResolved]);

  // ── Reset error ─────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
    setLiveTranscript("");
    setError(null);
  }, []);

  return { status, liveTranscript, error, startListening, stopListening, reset };
}

"use client";

// hooks/usePushToTalk.ts
// Full push-to-talk lifecycle:
//   hold button / space bar → Web Speech API recording
//   release                 → detect language → POST to /api/ask → speak answer in same language
//   language auto-detected from Arabic Unicode characters in transcript

import { useRef, useState, useCallback } from "react";
import type { DIDAvatar } from "@/components/AvatarStream";

// ── Language detection ──────────────────────────────────────────────────────────────────
function detectLanguage(text: string): "en" | "ar" {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars > 2 ? "ar" : "en";
}

// ── Female voice pattern (to exclude on all platforms) ──────────────────────────────
const FEMALE_VOICE_PATTERN = /female|woman|samantha|victoria|karen|zira|hazel|emma|siri|fiona|moira|tessa|allison|ava|susan|kate|linda|alice|amelie|anna|joana|laura|lekha|luciana|mariska|mei|monica|nora|paulina|satu|sin-ji|soledad|ting-ting|veena|yuna/i;

export type PTTStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

interface UsePushToTalkOptions {
  avatar:      DIDAvatar | null;
  onTranscript?: (text: string) => void;
  onAnswer?:     (text: string) => void;
}

export function usePushToTalk({ avatar, onTranscript, onAnswer }: UsePushToTalkOptions) {
  const [status, setStatus] = useState<PTTStatus>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");

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
    // Use browser language as hint — Arabic speakers get better recognition in ar-SA
    const browserLang = navigator.language || "en-US";
    recognition.lang = browserLang.startsWith("ar") ? "ar-SA" : "en-US";
    recognition.continuous    = true;
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

    // Auto-detect language from transcript characters
    const language = detectLanguage(transcript);

    try {
      const res = await fetch("/api/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: transcript, language }),
      });
      const data   = await res.json();
      const answer = data.answer ?? "Sorry, I couldn't get an answer. Please try again.";
      onAnswer?.(answer);

      setStatus("speaking");

      const speakViaTTS = async (text: string, lang: "en" | "ar") => {
        await new Promise<void>((resolve) => {
          window.speechSynthesis?.cancel();
          const utter  = new SpeechSynthesisUtterance(text);
          const voices = window.speechSynthesis?.getVoices() ?? [];

          if (lang === "ar") {
            utter.lang  = "ar-SA";
            utter.rate  = 0.88;
            utter.pitch = 1.0;
            const arVoice = voices.find(v => v.lang.startsWith("ar"));
            if (arVoice) utter.voice = arVoice;
          } else {
            utter.lang  = "en-US";
            utter.rate  = 0.92;
            utter.pitch = 0.82;
            const maleVoice =
              voices.find(v => v.lang.startsWith("en") && /\bmale\b/i.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en") && /\b(david|mark|daniel|james|george|ryan|richard|alex|fred|guy|tom|oliver|rishi|aaron|arthur|thomas)\b/i.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en-US") && !FEMALE_VOICE_PATTERN.test(v.name)) ??
              voices.find(v => v.lang.startsWith("en")    && !FEMALE_VOICE_PATTERN.test(v.name));
            if (maleVoice) utter.voice = maleVoice;
          }
          utter.onend  = () => resolve();
          utter.onerror= () => resolve();
          window.speechSynthesis?.speak(utter);
        });
      };

      if (avatar) {
        try {
          await avatar.speak(answer, language);
        } catch {
          await speakViaTTS(answer, language);
        }
      } else {
        await speakViaTTS(answer, language);
      }

      setStatus("idle");
    } catch (err) {
      console.error("Concierge error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }

    setLiveTranscript("");
  }, [status, liveTranscript, avatar, onTranscript, onAnswer]);

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

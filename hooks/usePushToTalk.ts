"use client";

// hooks/usePushToTalk.ts
// Push-to-talk with automatic bilingual support (Arabic/English).
//
// How language detection works:
// 1. Speech recognition lang is set from the kiosk language toggle
// 2. After transcription, we detect language from the text (Arabic Unicode chars)
// 3. API receives the detected language and responds in that language
// 4. TTS speaks the answer in the detected language with appropriate voice

import { useRef, useState, useCallback } from "react";
import type { DIDAvatar } from "@/components/AvatarStream";
import { detectLanguageFromText, detectSpokenLanguage, type ConciergeLanguage } from "@/lib/language";
import { speakWithBrowserSpeech } from "@/lib/browser-speech";

// ── Exports ─────────────────────────────────────────────────────────────────
export type PTTStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

const MAX_LISTENING_MS = 18_000;
const MIN_REPORTED_CONFIDENCE = 0.45;

interface UsePushToTalkOptions {
  avatar?:       DIDAvatar | null;
  language?:     ConciergeLanguage; // set by toggle in page.tsx — controls recognition language
  onTranscript?: (text: string) => void;
  onAnswer?:     (text: string) => void;
  onLanguageDetected?: (lang: ConciergeLanguage) => void;
}

export function usePushToTalk({
  avatar,
  language = "en",
  onTranscript,
  onAnswer,
  onLanguageDetected,
}: UsePushToTalkOptions) {
  const [status, setStatus] = useState<PTTStatus>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [speechConfidence, setSpeechConfidence] = useState<number | null>(null);

  const recognitionRef     = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const confidenceSamplesRef = useRef<number[]>([]);
  const listeningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearListeningTimer = useCallback(() => {
    if (!listeningTimerRef.current) return;
    clearTimeout(listeningTimerRef.current);
    listeningTimerRef.current = null;
  }, []);

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

    // The toggle controls recognition language.
    // This is REQUIRED — Web Speech API can only transcribe one language at a time.
    // If set to en-US and user speaks Arabic, transcript is garbage.
    recognition.lang = language === "ar" ? "ar-SA" : "en-US";

    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    finalTranscriptRef.current = "";
    confidenceSamplesRef.current = [];
    setLiveTranscript("");
    setError(null);
    setResponseTimeMs(null);
    setSpeechConfidence(null);
    setStatus("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const alternative = event.results[i][0];
        const text = alternative.transcript;
        if (event.results[i].isFinal) {
          final += text;
          if (alternative.confidence > 0 && alternative.confidence <= 1) {
            confidenceSamplesRef.current.push(alternative.confidence);
            const average =
              confidenceSamplesRef.current.reduce((sum, value) => sum + value, 0) /
              confidenceSamplesRef.current.length;
            setSpeechConfidence(average);
          }
        } else {
          interim += text;
        }
      }
      finalTranscriptRef.current += final;
      setLiveTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") return;
      clearListeningTimer();
      recognitionRef.current = null;
      setError(`Microphone error: ${event.error}`);
      setStatus("error");
    };

    recognition.onend = () => {
      clearListeningTimer();
    };

    recognitionRef.current = recognition;
    recognition.start();

    listeningTimerRef.current = setTimeout(() => {
      recognition.stop();
      recognitionRef.current = null;
      setLiveTranscript("");
      setError(
        language === "ar"
          ? "انتهى وقت الاستماع. يرجى المحاولة مرة أخرى والتحدث بالقرب من الميكروفون."
          : "Listening timed out. Please try again and speak close to the microphone."
      );
      setStatus("error");
    }, MAX_LISTENING_MS);
  }, [clearListeningTimer, status, language]);

  // ── Stop recording → detect language → ask API → speak answer ──────────
  const stopListening = useCallback(async () => {
    if (status !== "listening") return;

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearListeningTimer();

    const transcript = (finalTranscriptRef.current || liveTranscript).trim();
    if (!transcript) {
      setStatus("idle");
      setLiveTranscript("");
      return;
    }

    const confidenceSamples = confidenceSamplesRef.current;
    const averageConfidence = confidenceSamples.length
      ? confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length
      : null;
    setSpeechConfidence(averageConfidence);

    if (averageConfidence !== null && averageConfidence < MIN_REPORTED_CONFIDENCE) {
      setError(
        language === "ar"
          ? "لم ألتقط الصوت بوضوح. يرجى المحاولة مرة أخرى بالقرب من الميكروفون."
          : "I did not catch that clearly. Please try again close to the microphone."
      );
      setStatus("error");
      setLiveTranscript("");
      return;
    }

    onTranscript?.(transcript);
    setStatus("thinking");

    // Detect language from what the user actually said. If Arabic recognition
    // was selected but Chrome returns Latin text, keep Arabic as the language.
    const lang = detectSpokenLanguage(transcript, language);
    onLanguageDetected?.(lang);

    try {
      const requestStartedAt = performance.now();
      const res = await fetch("/api/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: transcript, language: lang }),
      });
      const data   = await res.json();
      setResponseTimeMs(Math.round(performance.now() - requestStartedAt));
      const answer = data.answer ?? (
        lang === "ar"
          ? "عذرًا، لم أتمكن من الحصول على إجابة. يرجى المحاولة مرة أخرى."
          : "Sorry, I couldn't get an answer. Please try again."
      );

      // Double-check: if the API returned Arabic text, speak in Arabic
      const answerLang = detectLanguageFromText(answer, lang);
      onLanguageDetected?.(answerLang);
      onAnswer?.(answer);

      setStatus("speaking");

      // Speak the answer
      if (avatar) {
        try {
          await avatar.speak(answer, answerLang);
        } catch {
          await speakWithBrowserSpeech(answer, answerLang);
        }
      } else {
        await speakWithBrowserSpeech(answer, answerLang);
      }

      setStatus("idle");
    } catch (err) {
      console.error("Concierge error:", err);
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }

    setLiveTranscript("");
  }, [clearListeningTimer, status, liveTranscript, avatar, language, onTranscript, onAnswer, onLanguageDetected]);

  // ── Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearListeningTimer();
    confidenceSamplesRef.current = [];
    setStatus("idle");
    setLiveTranscript("");
    setError(null);
    setResponseTimeMs(null);
    setSpeechConfidence(null);
  }, [clearListeningTimer]);

  return {
    status,
    liveTranscript,
    error,
    responseTimeMs,
    speechConfidence,
    startListening,
    stopListening,
    reset,
  };
}

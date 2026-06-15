"use client";

// hooks/usePushToTalk.ts
// Full push-to-talk lifecycle:
//   hold button / space bar → Web Speech API recording
//   release                 → POST transcript to /api/did-agent/ask (D-ID agent LLM)
//   answer received         → avatar.speak(answer)  [D-ID animation or browser TTS]

import { useRef, useState, useCallback } from "react";
import type { DIDAvatar } from "@/components/AvatarStream";

export type PTTStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

interface UsePushToTalkOptions {
  avatar:      DIDAvatar | null;
  streamId?:   string | null;    // D-ID stream ID for agent ask endpoint
  sessionId?:  string | null;    // D-ID session ID for agent ask endpoint
  onTranscript?: (text: string) => void;
  onAnswer?:     (text: string) => void;
}

export function usePushToTalk({ avatar, streamId, sessionId, onTranscript, onAnswer }: UsePushToTalkOptions) {
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
    recognition.lang = "en-US";
    recognition.continuous = true;
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

    try {
      // Try D-ID agent's built-in LLM first (has event knowledge base, no Gemini quota needed)
      // Falls back to /api/ask if D-ID agent is unreachable
      let answer = "";
      try {
        const agentRes = await fetch("/api/did-agent/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: transcript, streamId, sessionId }),
        });
        const agentData = await agentRes.json();
        if (agentData.answer) answer = agentData.answer;
      } catch { /* fall through to /api/ask */ }

      if (!answer) {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: transcript }),
        });
        const data = await res.json();
        answer = data.answer ?? "Sorry, I couldn't get an answer. Please try again.";
      }
      onAnswer?.(answer);

      setStatus("speaking");

      const speakViaTTS = async (text: string) => {
        await new Promise<void>((resolve) => {
          window.speechSynthesis?.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang  = "en-US";
          utter.rate  = 0.92;
          utter.pitch = 0.9; // lower pitch = male tone
          const voices = window.speechSynthesis?.getVoices() ?? [];
          const preferred =
            voices.find(v => v.lang.startsWith("en") && /\bmale\b/i.test(v.name)) ??
            voices.find(v => v.lang.startsWith("en") && /david|mark|daniel|james|george|ryan|richard/i.test(v.name));
          if (preferred) utter.voice = preferred;
          utter.onend  = () => resolve();
          utter.onerror= () => resolve();
          window.speechSynthesis?.speak(utter);
        });
      };

      if (avatar) {
        try {
          await avatar.speak(answer);
        } catch {
          // D-ID stream failed mid-session — fall back to browser TTS
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
  }, [status, liveTranscript, avatar, streamId, sessionId, onTranscript, onAnswer]);

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

"use client";

// components/AvatarStream.tsx
// D-ID WebRTC manager for image/presenter streams.
// All visuals delegated to <HologramAvatar>.
// This component owns:
//   • the <video> element (via videoRef)
//   • the WebRTC / D-ID stream session lifecycle
//   • generated speech playback through /api/tts
//   • browser-TTS fallback when generated speech is unavailable

import { useEffect, useRef, useState, useCallback } from "react";
import HologramAvatar from "./HologramAvatar";
import { detectLanguageFromText, type ConciergeLanguage } from "@/lib/language";
import { speakWithBrowserSpeech, stopBrowserSpeech } from "@/lib/browser-speech";

// ── Public types ─────────────────────────────────────────────────────────────
export type AvatarState = "loading" | "ready" | "speaking" | "stopped" | "error";

export interface DIDAvatar {
  speak: (text: string, lang?: ConciergeLanguage) => Promise<void>;
  stop:  () => Promise<void>;
}

interface AvatarStreamProps {
  onAvatarReady:  (avatar: DIDAvatar, streamId?: string, sessionId?: string) => void;
  onAvatarError?: (msg: string) => void;
  onStateChange?: (state: AvatarState) => void;
  speaking?: boolean;
  enabled?: boolean;
}

const AGENT_PORTRAIT = "/male-avatar-hologram.webp";

// ─────────────────────────────────────────────────────────────────────────────
export default function AvatarStream({
  onAvatarReady,
  onAvatarError,
  onStateChange,
  speaking = false,
  enabled = true,
}: AvatarStreamProps) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const pcRef        = useRef<RTCPeerConnection | null>(null);
  const streamIdRef  = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isConnecting, setIsConnecting] = useState(enabled);

  const updateState = useCallback((s: AvatarState) => onStateChange?.(s), [onStateChange]);

  const stopGeneratedAudio = useCallback(() => {
    const audio = generatedAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    generatedAudioRef.current = null;
  }, []);

  const playGeneratedSpeech = useCallback(async (
    text: string,
    lang: ConciergeLanguage
  ): Promise<boolean> => {
    stopGeneratedAudio();
    let objectUrl: string | null = null;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });

      if (!res.ok) return false;

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      generatedAudioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Generated speech playback failed"));
        audio.play().catch(reject);
      });

      return true;
    } catch {
      return false;
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (generatedAudioRef.current?.src === objectUrl) {
        generatedAudioRef.current = null;
      }
    }
  }, [stopGeneratedAudio]);

  // ── speak: generated speech first, browser TTS as fallback ─────────────────
  const didSpeak = useCallback(async (text: string, lang: ConciergeLanguage = "en") => {
    const speechLang = detectLanguageFromText(text, lang);

    if (videoRef.current) videoRef.current.muted = true;
    const spoken = await playGeneratedSpeech(text, speechLang);
    if (spoken) return;
    await speakWithBrowserSpeech(text, speechLang);
  }, [playGeneratedSpeech]);

  const didStop = useCallback(async () => {
    stopBrowserSpeech();
    stopGeneratedAudio();
    if (!streamIdRef.current) return;
    await fetch("/api/did-stream/close", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ streamId: streamIdRef.current, sessionId: sessionIdRef.current }),
    }).catch(() => {});
  }, [stopGeneratedAudio]);

  // ── WebRTC session lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let iceTimer: ReturnType<typeof setTimeout> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;

    function closeSession() {
      if (streamIdRef.current) {
        fetch("/api/did-stream/close", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ streamId: streamIdRef.current, sessionId: sessionIdRef.current }),
        }).catch(() => {});
        streamIdRef.current  = null;
        sessionIdRef.current = null;
      }
      pcRef.current?.close();
      pcRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.muted = true;
      }
    }

    function signalReady() {
      if (!mounted) return;
      setIsConnecting(false);
      updateState("ready");
      onAvatarReady({ speak: didSpeak, stop: didStop },
        streamIdRef.current  ?? undefined,
        sessionIdRef.current ?? undefined);
    }

    async function init() {
      setIsConnecting(true);
      try {
        // 1. Create D-ID presenter stream from DID_PRESENTER_URL
        const res     = await fetch("/api/did-stream", { method: "POST" });
        const session = await res.json();
        const offer = session.offer ?? session.jsep;
        if (!res.ok || !session.id || !offer) {
          onAvatarError?.(session?.error ?? "D-ID stream unavailable");
          signalReady();
          return;
        } // portrait+TTS

        streamIdRef.current  = session.id;
        sessionIdRef.current = session.sessionId;
        if (!mounted) return;

        // 2. RTCPeerConnection
        const pc = new RTCPeerConnection({ iceServers: session.iceServers ?? [] });
        pcRef.current = pc;

        // 3. Route incoming track to video element
        pc.ontrack = (event) => {
          if (!mounted) return;
          const [stream] = event.streams;
          if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted     = true;
            videoRef.current.play().catch(() => {});
          }
        };

        // 4. Connection failure → portrait+TTS gracefully
        const onFail = () => {
          if (!mounted) return;
          clearTimeout(iceTimer);
          closeSession();
          signalReady();          // HologramAvatar will stay in portrait mode
        };
        pc.onconnectionstatechange    = () => { if (pc.connectionState    === "failed") onFail(); };
        pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === "failed") onFail(); };

        // 5. Relay ICE candidates
        pc.onicecandidate = (e) => {
          if (!e.candidate || !streamIdRef.current) return;
          fetch("/api/did-stream/ice", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              streamId: streamIdRef.current, sessionId: sessionIdRef.current,
              candidate: e.candidate.toJSON(),
            }),
          }).catch(() => {});
        };

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        // 6. SDP handshake
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const sdpRes = await fetch("/api/did-stream/sdp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            streamId: session.id, sessionId: session.sessionId,
            answer: { type: answer.type, sdp: answer.sdp },
          }),
        });
        if (!sdpRes.ok) throw new Error("SDP failed");
        if (!mounted) return;

        // 7. HologramAvatar polls for real frames (max 20 s); if none arrive,
        //    it falls back to portrait mode on its own.  We just signal ready now
        //    so the PTT button unlocks immediately.
        signalReady();

        // 8. Hard timeout: close orphaned session after 25 s if ICE never connected
        iceTimer = setTimeout(() => {
          if (mounted && pc.iceConnectionState !== "connected" &&
              pc.iceConnectionState !== "completed") {
            closeSession();
          }
        }, 25_000);

      } catch {
        onAvatarError?.("D-ID stream unavailable");
        if (mounted) signalReady(); // portrait + TTS
      }
    }

    function onUnload() {
      if (streamIdRef.current)
        navigator.sendBeacon("/api/did-stream/close",
          JSON.stringify({ streamId: streamIdRef.current, sessionId: sessionIdRef.current }));
    }

    window.addEventListener("beforeunload", onUnload);
    if (enabled) {
      init();
    } else {
      closeSession();
      stopTimer = setTimeout(() => {
        if (!mounted) return;
        setIsConnecting(false);
        updateState("stopped");
      }, 0);
    }

    return () => {
      mounted = false;
      clearTimeout(iceTimer);
      clearTimeout(stopTimer);
      window.removeEventListener("beforeunload", onUnload);
      closeSession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* The premium hologram UI — owns the <video> element via videoRef */}
      <HologramAvatar
        videoRef={videoRef as React.RefObject<HTMLVideoElement | null>}
        isConnecting={isConnecting}
        isSpeaking={speaking}
        fallbackImageSrc={AGENT_PORTRAIT}
      />
    </div>
  );
}

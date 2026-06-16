"use client";

// components/AvatarStream.tsx
// D-ID WebRTC manager for image/presenter streams.
// All visuals delegated to <HologramAvatar>.
// This component owns:
//   • the <video> element (via videoRef)
//   • the WebRTC / D-ID stream session lifecycle
//   • the speak/stop API calls
//   • browser-TTS fallback when D-ID stream is unavailable

import { useEffect, useRef, useState, useCallback } from "react";
import HologramAvatar from "./HologramAvatar";

// ── Public types ─────────────────────────────────────────────────────────────
export type AvatarState = "loading" | "ready" | "speaking" | "stopped" | "error";

export interface DIDAvatar {
  speak: (text: string) => Promise<void>;
  stop:  () => Promise<void>;
}

interface AvatarStreamProps {
  onAvatarReady:  (avatar: DIDAvatar, streamId?: string, sessionId?: string) => void;
  onAvatarError?: (msg: string) => void;
  onStateChange?: (state: AvatarState) => void;
  speaking?: boolean;
  enabled?: boolean;
}

const AGENT_PORTRAIT = "/male-avatar-hologram.png";

function estimateSpeechMs(text: string) {
  return Math.max(1600, Math.min(24_000, text.length * 58));
}

// ── Browser TTS helper — male voice preferred ────────────────────────────────
function browserSpeak(text: string): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = "en-US";
    utter.rate  = 0.92;
    utter.pitch = 0.9;  // slightly lower = more authoritative male tone
    const voices = window.speechSynthesis?.getVoices() ?? [];
    // Prefer a male English voice
    const preferred =
      voices.find(v => v.lang.startsWith("en") && /\bmale\b/i.test(v.name)) ??
      voices.find(v => v.lang.startsWith("en") && /david|mark|daniel|james|george|ryan|richard/i.test(v.name));
    if (preferred) utter.voice = preferred;
    utter.onend  = () => resolve();
    utter.onerror= () => resolve();
    window.speechSynthesis?.speak(utter);
  });
}

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

  const [isConnecting, setIsConnecting] = useState(enabled);

  const updateState = useCallback((s: AvatarState) => onStateChange?.(s), [onStateChange]);

  // ── speak: D-ID stream first, browser TTS as fallback ───────────────────────
  const didSpeak = useCallback(async (text: string) => {
    if (streamIdRef.current && sessionIdRef.current) {
      try {
        const video = videoRef.current;
        if (video) {
          video.muted = false;
          video.volume = 1;
          video.play().catch(() => {});
        }

        const res = await fetch("/api/did-stream/talk", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ streamId: streamIdRef.current, sessionId: sessionIdRef.current, text }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const durationMs =
            typeof data?.duration === "number"
              ? Math.max(1200, Math.min(24_000, data.duration * 1000))
              : estimateSpeechMs(text);
          await new Promise((resolve) => window.setTimeout(resolve, durationMs));
          return;
        }
      } catch { /* fall through to TTS */ }
    }
    await browserSpeak(text);
  }, []);

  const didStop = useCallback(async () => {
    window.speechSynthesis?.cancel();
    if (!streamIdRef.current) return;
    await fetch("/api/did-stream/close", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ streamId: streamIdRef.current, sessionId: sessionIdRef.current }),
    }).catch(() => {});
  }, []);

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

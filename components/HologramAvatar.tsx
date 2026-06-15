"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type AvatarMode = "idle" | "connecting" | "live" | "fallback";

interface HologramAvatarProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isConnecting?: boolean;
  isSpeaking?: boolean;
  fallbackImageSrc: string;
  className?: string;
}

export default function HologramAvatar({
  videoRef,
  isConnecting = false,
  isSpeaking = false,
  fallbackImageSrc,
  className = "",
}: HologramAvatarProps) {
  const [hasLiveFrames, setHasLiveFrames] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const mounted = useRef(true);
  const mode: AvatarMode = hasLiveFrames ? "live" : isConnecting ? "connecting" : timedOut ? "fallback" : "idle";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let attempts = 0;
    const maxAttempts = 150;

    const inspect = () => {
      if (!mounted.current) return;
      const hasFrames = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
      setHasLiveFrames(hasFrames);
      setTimedOut(!hasFrames && !isConnecting && attempts >= maxAttempts);
      attempts += 1;
    };

    inspect();
    const interval = window.setInterval(inspect, 140);
    video.addEventListener("loadedmetadata", inspect);
    video.addEventListener("canplay", inspect);

    const fail = () => {
      if (!mounted.current) return;
      setHasLiveFrames(false);
      setTimedOut(true);
    };

    video.addEventListener("error", fail);
    video.addEventListener("stalled", fail);
    video.addEventListener("emptied", fail);

    return () => {
      window.clearInterval(interval);
      video.removeEventListener("loadedmetadata", inspect);
      video.removeEventListener("canplay", inspect);
      video.removeEventListener("error", fail);
      video.removeEventListener("stalled", fail);
      video.removeEventListener("emptied", fail);
    };
  }, [isConnecting, videoRef]);

  return (
    <>
      <style>{`
        .cyber-avatar {
          --cyan: 0, 218, 255;
          --blue: 20, 84, 255;
          position: relative;
          width: clamp(282px, 62vw, 408px);
          height: clamp(282px, 62vw, 408px);
          min-width: 0;
          min-height: 0;
          display: grid;
          place-items: center;
          isolation: isolate;
        }

        .cyber-avatar::before,
        .cyber-avatar::after {
          content: "";
          position: absolute;
          inset: 7%;
          border-radius: 50%;
          pointer-events: none;
        }

        .cyber-avatar::before {
          background:
            radial-gradient(circle at center, rgba(var(--cyan), 0.08), transparent 58%),
            repeating-radial-gradient(circle at center, rgba(var(--cyan), 0.16) 0 1px, transparent 1px 32px);
          filter: drop-shadow(0 0 20px rgba(var(--cyan), 0.18));
          animation: avatar-spin 32s linear infinite;
          z-index: 0;
        }

        .cyber-avatar::after {
          inset: 12%;
          border: 1px solid rgba(var(--cyan), 0.18);
          box-shadow:
            inset 0 0 28px rgba(var(--cyan), 0.08),
            0 0 42px rgba(var(--cyan), 0.08);
          animation: avatar-breathe 5.2s ease-in-out infinite;
          z-index: 0;
        }

        .cyber-avatar__halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            conic-gradient(from 30deg, transparent 0 12%, rgba(var(--cyan), 0.26) 13% 15%, transparent 16% 35%, rgba(var(--cyan), 0.14) 36% 38%, transparent 39% 100%),
            radial-gradient(circle, transparent 51%, rgba(var(--cyan), 0.11) 52%, transparent 67%);
          mask-image: radial-gradient(circle, transparent 36%, #000 37% 73%, transparent 74%);
          opacity: 0.72;
          animation: avatar-spin 42s linear infinite reverse;
          z-index: 1;
        }

        .cyber-avatar__core {
          position: relative;
          width: 78%;
          height: 78%;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(var(--cyan), 0.2);
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 40%, rgba(var(--cyan), 0.14), transparent 44%),
            radial-gradient(circle at 50% 65%, rgba(10, 48, 87, 0.72), rgba(1, 10, 21, 0.92) 66%);
          box-shadow:
            inset 0 0 34px rgba(var(--cyan), 0.08),
            0 0 46px rgba(var(--cyan), 0.12);
          z-index: 3;
        }

        .cyber-avatar__core::before {
          content: "";
          position: absolute;
          inset: 9%;
          border: 1px solid rgba(var(--cyan), 0.12);
          border-radius: 50%;
          pointer-events: none;
          z-index: 6;
        }

        .cyber-avatar__core::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          z-index: 7;
          background:
            radial-gradient(ellipse 44% 32% at 50% 38%, rgba(var(--cyan), 0.12) 0%, rgba(var(--cyan), 0.08) 42%, transparent 70%),
            radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.055), transparent 48%),
            linear-gradient(180deg, rgba(1, 9, 18, 0.02), rgba(1, 9, 18, 0.2));
          backdrop-filter: blur(0.45px);
        }

        .cyber-avatar__figure {
          position: relative;
          width: 91%;
          height: 108%;
          overflow: hidden;
          z-index: 2;
          filter:
            drop-shadow(0 0 14px rgba(var(--cyan), 0.28))
            drop-shadow(0 0 36px rgba(var(--blue), 0.16));
          animation: avatar-float 6.2s ease-in-out infinite;
          mask-image:
            radial-gradient(ellipse 78% 89% at 50% 36%, #000 0 67%, rgba(0,0,0,0.68) 80%, transparent 100%),
            linear-gradient(180deg, #000 0 76%, transparent 100%);
          mask-composite: intersect;
        }

        .cyber-avatar__media {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 44%;
          transform: scale(1.05);
          filter: blur(0.8px) brightness(0.92) saturate(1.06) contrast(0.86);
          opacity: 0.82;
          mix-blend-mode: screen;
        }

        .cyber-avatar__fallback {
          display: block;
          opacity: 0.82;
          animation: ${isSpeaking ? "avatar-speak" : "avatar-idle"} ${isSpeaking ? "0.66s" : "4.2s"} ease-in-out infinite;
        }

        .cyber-avatar__video {
          display: ${hasLiveFrames ? "block" : "none"};
          opacity: 0.82;
        }

        .cyber-avatar__overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 4;
        }

        .cyber-avatar__overlay.scan {
          background:
            repeating-linear-gradient(0deg, transparent 0 5px, rgba(var(--cyan), 0.045) 5px 6px),
            linear-gradient(180deg, transparent, rgba(var(--cyan), 0.1), transparent);
          background-size: auto, 100% 46%;
          animation: avatar-scan 4.8s linear infinite;
          mix-blend-mode: screen;
        }

        .cyber-avatar__overlay.glow {
          background:
            radial-gradient(ellipse at 50% 24%, rgba(255, 255, 255, 0.18), transparent 12%),
            radial-gradient(ellipse at 50% 42%, rgba(var(--cyan), 0.12), transparent 42%),
            linear-gradient(180deg, transparent 62%, rgba(2, 12, 30, 0.9) 100%);
        }

        .cyber-avatar__equalizer {
          position: absolute;
          left: 16%;
          right: 16%;
          bottom: 7%;
          height: 24px;
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 3px;
          opacity: ${isSpeaking ? "0.82" : "0.18"};
          z-index: 6;
        }

        .cyber-avatar__bar {
          width: 2px;
          height: 7px;
          border-radius: 99px;
          background: rgba(var(--cyan), 0.64);
          box-shadow: 0 0 7px rgba(var(--cyan), 0.35);
          animation: avatar-wave 0.86s ease-in-out infinite;
        }

        .cyber-avatar__bar:nth-child(2n) {
          animation-delay: 0.08s;
          background: rgba(38, 246, 255, 0.72);
        }

        .cyber-avatar__bar:nth-child(3n) {
          animation-delay: 0.16s;
          height: 14px;
        }

        .cyber-avatar__state {
          display: none;
        }

        .cyber-avatar__state-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${mode === "live" ? "#15f5a4" : mode === "fallback" ? "#35d9ff" : "#00d8ff"};
          box-shadow: 0 0 11px currentColor;
        }

        @keyframes avatar-spin {
          to { rotate: 360deg; }
        }

        @keyframes avatar-breathe {
          0%, 100% { transform: scale(1); opacity: 0.72; }
          50% { transform: scale(1.045); opacity: 1; }
        }

        @keyframes avatar-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -8px; }
        }

        @keyframes avatar-idle {
          0%, 100% { transform: scale(1.05); filter: blur(0.8px) brightness(0.92) saturate(1.06) contrast(0.86); opacity: 0.8; }
          50% { transform: scale(1.072); filter: blur(1px) brightness(0.98) saturate(1.1) contrast(0.84); opacity: 0.86; }
        }

        @keyframes avatar-speak {
          0%, 100% { transform: scale(1.055); filter: blur(0.75px) brightness(1) saturate(1.12) contrast(0.88); opacity: 0.86; }
          45% { transform: scale(1.085); filter: blur(0.95px) brightness(1.08) saturate(1.18) contrast(0.86); opacity: 0.9; }
        }

        @keyframes avatar-scan {
          from { background-position: 0 0, 0 -120%; }
          to { background-position: 0 0, 0 180%; }
        }

        @keyframes avatar-wave {
          0%, 100% { height: 6px; opacity: 0.34; }
          50% { height: 21px; opacity: 1; }
        }
      `}</style>

      <div className={`cyber-avatar ${className}`} aria-label="Aivent hologram avatar">
        <div className="cyber-avatar__halo" aria-hidden />
        <div className="cyber-avatar__core">
          <div className="cyber-avatar__figure">
            <Image
              className="cyber-avatar__media cyber-avatar__fallback"
              src={fallbackImageSrc}
              alt="Aivent AI concierge"
              fill
              sizes="370px"
              priority
              unoptimized
            />
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              className="cyber-avatar__media cyber-avatar__video"
              autoPlay
              playsInline
              muted
            />
            <div className="cyber-avatar__overlay glow" aria-hidden />
            <div className="cyber-avatar__overlay scan" aria-hidden />
            <div className="cyber-avatar__equalizer" aria-hidden>
              {Array.from({ length: 48 }).map((_, index) => (
                <span
                  className="cyber-avatar__bar"
                  key={index}
                  style={{ animationDelay: `${(index % 9) * 0.045}s` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="cyber-avatar__state">
          <span className="cyber-avatar__state-dot" />
          {mode === "live" ? "AI Core Live" : mode === "connecting" ? "Connecting" : "AI Core Ready"}
        </div>
      </div>
    </>
  );
}

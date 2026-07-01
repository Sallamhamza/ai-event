"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./HologramAvatar.module.css";

type AvatarMode = "idle" | "connecting" | "live" | "fallback";

interface HologramAvatarProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isConnecting?: boolean;
  isSpeaking?: boolean;
  fallbackImageSrc: string;
  className?: string;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
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
  const isEqualizerActive = isSpeaking;

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
    const maxAttempts = 90;
    let interval: number | undefined;

    const stopPolling = () => {
      if (interval === undefined) return;
      window.clearInterval(interval);
      interval = undefined;
    };

    const inspect = () => {
      if (!mounted.current) return;
      const hasFrames = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0;
      setHasLiveFrames(hasFrames);
      setTimedOut(!hasFrames && !isConnecting && attempts >= maxAttempts);
      if (hasFrames || (!hasFrames && !isConnecting && attempts >= maxAttempts)) {
        stopPolling();
      }
      attempts += 1;
    };

    inspect();
    interval = window.setInterval(inspect, 220);
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
      stopPolling();
      video.removeEventListener("loadedmetadata", inspect);
      video.removeEventListener("canplay", inspect);
      video.removeEventListener("error", fail);
      video.removeEventListener("stalled", fail);
      video.removeEventListener("emptied", fail);
    };
  }, [isConnecting, videoRef]);

  return (
    <div className={cx(styles.avatar, className)} aria-label="Aivent hologram avatar">
      <div className={styles.halo} aria-hidden />
      <div className={styles.core}>
        <div className={styles.figure}>
          <Image
            className={cx(styles.media, styles.fallback, isSpeaking && styles.fallbackSpeaking)}
            src={fallbackImageSrc}
            alt="Aivent AI concierge"
            fill
            sizes="370px"
            priority
          />
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            className={cx(styles.media, styles.video, hasLiveFrames && styles.videoVisible)}
            autoPlay
            playsInline
          />
          <div className={cx(styles.overlay, styles.glow)} aria-hidden />
          <div className={cx(styles.overlay, styles.scan)} aria-hidden />
          <div
            className={cx(styles.equalizer, isEqualizerActive && styles.equalizerActive)}
            aria-hidden
          >
            {Array.from({ length: 48 }).map((_, index) => (
              <span
                className={cx(styles.bar, styles[`delay${index % 9}`])}
                key={index}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.state}>
        <span
          className={cx(
            styles.stateDot,
            mode === "live" && styles.stateDotLive,
            mode === "fallback" && styles.stateDotFallback
          )}
        />
        {mode === "live" ? "AI Core Live" : mode === "connecting" ? "Connecting" : "AI Core Ready"}
      </div>
    </div>
  );
}

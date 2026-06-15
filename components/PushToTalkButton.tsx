"use client";

import { useCallback, useEffect } from "react";
import { PTTStatus } from "@/hooks/usePushToTalk";

interface PushToTalkButtonProps {
  status: PTTStatus;
  onPressStart: () => void;
  onPressEnd: () => void;
  onReset?: () => void;
  disabled?: boolean;
}

const COPY: Record<PTTStatus, { title: string; subtitle: string; tone: string }> = {
  idle: { title: "Voice Ready", subtitle: "Hold to speak", tone: "cyan" },
  listening: { title: "Voice Active", subtitle: "Listening...", tone: "red" },
  thinking: { title: "Processing", subtitle: "Searching...", tone: "gold" },
  speaking: { title: "Speaking", subtitle: "Live response", tone: "green" },
  error: { title: "Retry Voice", subtitle: "Tap to reset", tone: "orange" },
};

export default function PushToTalkButton({
  status,
  onPressStart,
  onPressEnd,
  onReset,
  disabled = false,
}: PushToTalkButtonProps) {
  const copy = COPY[status];
  const isListening = status === "listening";
  const isBusy = status === "thinking" || status === "speaking";
  const isInteractive = status === "idle" || status === "error";

  const handleStart = useCallback(() => {
    if (disabled || isBusy) return;
    if (status === "error") {
      onReset?.();
      return;
    }
    if (status === "idle") onPressStart();
  }, [disabled, isBusy, onPressStart, onReset, status]);

  const handleEnd = useCallback(() => {
    if (!disabled && isListening) onPressEnd();
  }, [disabled, isListening, onPressEnd]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat && status === "idle" && !disabled) {
        event.preventDefault();
        onPressStart();
      }
    },
    [disabled, onPressStart, status]
  );

  const onKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.code === "Space" && status === "listening" && !disabled) {
        event.preventDefault();
        onPressEnd();
      }
    },
    [disabled, onPressEnd, status]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onKeyDown, onKeyUp]);

  return (
    <>
      <style>{`
        .voice-control {
          --voice: #00d9ff;
          display: grid;
          justify-items: center;
          gap: 8px;
          user-select: none;
          -webkit-user-select: none;
        }

        .voice-control[data-tone="red"] {
          --voice: #ff4d6d;
        }

        .voice-control[data-tone="gold"] {
          --voice: #ffd166;
        }

        .voice-control[data-tone="green"] {
          --voice: #18f3a2;
        }

        .voice-control[data-tone="orange"] {
          --voice: #ff9f43;
        }

        .voice-button {
          position: relative;
          width: 68px;
          height: 68px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--voice) 44%, transparent);
          border-radius: 50%;
          color: var(--voice);
          background:
            radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--voice) 16%, transparent) 0 27%, transparent 28%),
            rgba(3, 26, 48, 0.9);
          box-shadow:
            0 0 18px color-mix(in srgb, var(--voice) 18%, transparent),
            inset 0 0 18px color-mix(in srgb, var(--voice) 11%, transparent);
          cursor: pointer;
          touch-action: none;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.16s ease, border-color 0.16s ease, opacity 0.16s ease;
        }

        .voice-button::before,
        .voice-button::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .voice-button::before {
          inset: -7px;
          border: 1px solid color-mix(in srgb, var(--voice) 16%, transparent);
        }

        .voice-button::after {
          inset: 7px;
          border: 1px solid color-mix(in srgb, var(--voice) 24%, transparent);
        }

        .voice-button:hover:not(:disabled) {
          transform: translateY(-1px) scale(1.025);
          border-color: color-mix(in srgb, var(--voice) 84%, transparent);
        }

        .voice-button:active:not(:disabled),
        .voice-button.is-listening {
          transform: scale(1.07);
        }

        .voice-button:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }

        .voice-ripple {
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--voice) 12%, transparent);
          animation: voice-ripple 1.5s ease-out infinite;
          opacity: ${isListening || status === "speaking" ? "1" : "0"};
        }

        .voice-ripple.delay {
          animation-delay: 0.52s;
        }

        .mic-glyph {
          position: relative;
          width: 20px;
          height: 32px;
          z-index: 2;
          filter: drop-shadow(0 0 7px color-mix(in srgb, currentColor 58%, transparent));
        }

        .mic-glyph::before {
          content: "";
          position: absolute;
          left: 6px;
          top: 0;
          width: 9px;
          height: 19px;
          border-radius: 8px;
          background: currentColor;
        }

        .mic-glyph::after {
          content: "";
          position: absolute;
          left: 2px;
          top: 15px;
          width: 17px;
          height: 12px;
          border: 2px solid currentColor;
          border-top: 0;
          border-radius: 0 0 14px 14px;
        }

        .mic-stem {
          position: absolute;
          left: 10px;
          top: 27px;
          width: 3px;
          height: 5px;
          background: currentColor;
          border-radius: 99px;
        }

        .mic-stem::after {
          content: "";
          position: absolute;
          left: -6px;
          top: 5px;
          width: 14px;
          height: 3px;
          border-radius: 99px;
          background: currentColor;
        }

        .voice-label {
          display: grid;
          justify-items: center;
          gap: 3px;
          text-align: center;
        }

        .voice-label strong {
          color: rgba(116, 232, 255, 0.92);
          font-size: 9.5px;
          line-height: 1;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .voice-label span {
          color: rgba(151, 201, 220, 0.56);
          font-size: 8.5px;
          line-height: 1;
        }

        @keyframes voice-ripple {
          0% { transform: scale(0.82); opacity: 0.68; }
          100% { transform: scale(1.42); opacity: 0; }
        }
      `}</style>

      <div className="voice-control" data-tone={copy.tone}>
        <button
          className={`voice-button ${isListening ? "is-listening" : ""}`}
          type="button"
          aria-label={copy.title}
          disabled={disabled || isBusy}
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={(event) => {
            event.preventDefault();
            handleStart();
          }}
          onTouchEnd={(event) => {
            event.preventDefault();
            handleEnd();
          }}
          onClick={() => {
            if (isInteractive && status === "error") onReset?.();
          }}
        >
          <span className="voice-ripple" />
          <span className="voice-ripple delay" />
          <span className="mic-glyph">
            <span className="mic-stem" />
          </span>
        </button>
        <span className="voice-label">
          <strong>{copy.title}</strong>
          <span>{copy.subtitle}</span>
        </span>
      </div>
    </>
  );
}

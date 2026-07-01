"use client";

import { useCallback, type KeyboardEvent } from "react";
import { PTTStatus } from "@/hooks/usePushToTalk";
import styles from "./PushToTalkButton.module.css";

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

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.code === "Space" && !event.repeat && status === "idle" && !disabled) {
        event.preventDefault();
        onPressStart();
      }
    },
    [disabled, onPressStart, status]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.code === "Space" && status === "listening" && !disabled) {
        event.preventDefault();
        onPressEnd();
      }
    },
    [disabled, onPressEnd, status]
  );

  return (
    <div className={styles.voiceControl} data-tone={copy.tone}>
      <button
        className={cx(styles.voiceButton, isListening && styles.voiceButtonListening)}
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
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onClick={() => {
          if (isInteractive && status === "error") onReset?.();
        }}
      >
        <span
          className={cx(
            styles.voiceRipple,
            (isListening || status === "speaking") && styles.voiceRippleActive
          )}
        />
        <span
          className={cx(
            styles.voiceRipple,
            styles.voiceRippleDelay,
            (isListening || status === "speaking") && styles.voiceRippleActive
          )}
        />
        <span className={styles.micGlyph}>
          <span className={styles.micStem} />
        </span>
      </button>
      <span className={styles.voiceLabel}>
        <strong>{copy.title}</strong>
        <span>{copy.subtitle}</span>
      </span>
    </div>
  );
}

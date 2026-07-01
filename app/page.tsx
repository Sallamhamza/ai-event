"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AvatarStream, { type DIDAvatar } from "@/components/AvatarStream";
import PushToTalkButton from "@/components/PushToTalkButton";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { trackClientEvent } from "@/lib/client-analytics";
import type { ConciergeLanguage } from "@/lib/language";
import styles from "./page.module.css";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function formatResponseTime(responseTimeMs: number | null, isThinking: boolean): string {
  if (isThinking) return "...";
  if (responseTimeMs === null) return "Pending";
  return `${(responseTimeMs / 1000).toFixed(2)}s`;
}

function formatSpeechConfidence(confidence: number | null, isListening: boolean): string {
  if (confidence !== null) return `${Math.round(confidence * 100)}%`;
  return isListening ? "Listening" : "Awaiting voice";
}

const KIOSK_IDLE_RESET_MS = 60_000;
const MAX_CONVERSATION_MESSAGES = 16;

interface ConversationMessage {
  id: string;
  role: "user" | "aivent";
  text: string;
  language: ConciergeLanguage;
}

function trimConversation(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.slice(-MAX_CONVERSATION_MESSAGES);
}

function createMessage(
  role: ConversationMessage["role"],
  text: string,
  language: ConciergeLanguage
): ConversationMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
    language,
  };
}

export default function KioskPage() {
  const [avatar, setAvatar] = useState<DIDAvatar | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [lang, setLang] = useState<ConciergeLanguage>("en");
  const [isAttractMode, setIsAttractMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);

  const handleAvatarReady = useCallback((av: DIDAvatar, sid?: string) => {
    setAvatar(av);
    if (sid) setStreamId(sid);
  }, []);

  const handleTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      setAnswer("");
      setConversation((current) =>
        trimConversation([...current, createMessage("user", text, lang)])
      );
      trackClientEvent({ event: "question", language: lang });
    },
    [lang]
  );

  const handleAnswer = useCallback(
    (text: string) => {
      setAnswer(text);
      setConversation((current) =>
        trimConversation([...current, createMessage("aivent", text, lang)])
      );
      trackClientEvent({ event: "answer", language: lang });
    },
    [lang]
  );

  const handleLanguageDetected = useCallback((language: ConciergeLanguage) => {
    setLang(language);
  }, []);

  const {
    status,
    liveTranscript,
    error,
    responseTimeMs,
    speechConfidence,
    startListening,
    stopListening,
    reset,
  } = usePushToTalk({
    avatar,
    language: lang,
    onTranscript: handleTranscript,
    onAnswer: handleAnswer,
    onLanguageDetected: handleLanguageDetected,
  });

  const resetSession = useCallback(() => {
    reset();
    setTranscript("");
    setAnswer("");
    setConversation([]);
    setSettingsOpen(false);
    trackClientEvent({ event: "session_reset", language: lang });
  }, [lang, reset]);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((current) => {
      const next = !current;
      if (next) trackClientEvent({ event: "settings_open", language: lang });
      return next;
    });
  }, [lang]);

  useEffect(() => {
    trackClientEvent({ event: "page_view", language: lang });
  }, [lang]);

  useEffect(() => {
    if (!error) return;
    trackClientEvent({ event: "voice_error", language: lang });
  }, [error, lang]);

  useEffect(() => {
    let idleTimer: number | undefined;

    const clearIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
    };

    const scheduleIdleReset = () => {
      clearIdleTimer();

      if (status !== "idle") {
        setIsAttractMode(false);
        return;
      }

      idleTimer = window.setTimeout(() => {
        setTranscript("");
        setAnswer("");
        setConversation([]);
        setSettingsOpen(false);
        reset();
        setIsAttractMode(true);
      }, KIOSK_IDLE_RESET_MS);
    };

    const handleActivity = () => {
      setIsAttractMode(false);
      scheduleIdleReset();
    };

    scheduleIdleReset();
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);

    return () => {
      clearIdleTimer();
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [reset, status]);

  const displayTranscript = liveTranscript || transcript;

  const statusCopy = useMemo(() => {
    if (status === "listening") return "Listening";
    if (status === "thinking") return "Processing";
    if (status === "speaking") return "Speaking";
    if (status === "error") return "Attention";
    return streamId ? "Live" : avatar ? "Voice Ready" : "Connecting";
  }, [avatar, status, streamId]);

  const assistantCopy = useMemo(() => {
    if (status === "thinking" && !answer) {
      return lang === "ar"
        ? "جارٍ البحث في قاعدة معلومات الفعالية..."
        : "Scanning the event knowledge base...";
    }

    if (answer) return answer;

    return lang === "ar"
      ? "يمكنني مساعدتك بالجدول، المتحدثين، التسجيل، الموقع، المواصلات، الواي فاي وخدمات الفعالية."
      : "I can help with the agenda, speakers, registration, venue directions, transport, WiFi, and event services.";
  }, [answer, status, lang]);

  const responseTime = formatResponseTime(responseTimeMs, status === "thinking");
  const confidence = formatSpeechConfidence(speechConfidence, status === "listening");
  const streamQuality = streamId ? "Live stream" : avatar ? "TTS fallback" : "Pending";
  const languageMode = lang === "ar" ? "Arabic" : "English";
  const welcomeTitle = lang === "ar" ? (
    <>
      مرحبًا، أنا <strong>AIVENT</strong>
    </>
  ) : (
    <>
      Hello, I&apos;m <strong>AIVENT</strong>
    </>
  );
  const welcomeSubtitle = lang === "ar" ? "مساعدك الذكي للفعالية" : "Your AI Event Concierge";
  const defaultUserPrompt =
    lang === "ar" ? "ما هي أبرز مميزات هذه الفعالية؟" : "What are the main highlights of this event?";
  const renderedConversation = useMemo<ConversationMessage[]>(() => {
    if (conversation.length > 0 || liveTranscript) return conversation;

    return [
      { id: "default-user", role: "user", text: defaultUserPrompt, language: lang },
      { id: "default-aivent", role: "aivent", text: assistantCopy, language: lang },
    ];
  }, [assistantCopy, conversation, defaultUserPrompt, lang, liveTranscript]);

  return (
    <main className={cx(styles.page, isAttractMode && styles.pageAttract)}>
      <div className={styles.shell}>
        <section className={styles.main} aria-label="Aivent live AI event concierge">
          <header className={styles.topBar}>
            <div className={styles.livePill}>
              <span className={styles.livePillDot} />
              {statusCopy}
            </div>

            <div className={styles.topActions}>
              <button
                className={cx(
                  styles.iconButton,
                  styles.langToggle,
                  lang === "ar" && styles.langToggleActive
                )}
                type="button"
                aria-label={`Speech language mode: ${languageMode}`}
                title={`Speech language mode: ${languageMode}`}
                onClick={() => setLang((current) => (current === "en" ? "ar" : "en"))}
              >
                {lang === "ar" ? "عربي" : "English"}
              </button>

              <button
                className={cx(styles.iconButton, styles.muteButton)}
                type="button"
                aria-label="Mute or stop avatar audio"
                onClick={() => avatar?.stop()}
              >
                <span />
              </button>

              <button
                className={cx(styles.iconButton, styles.settingsButton)}
                type="button"
                aria-label="Settings"
                aria-expanded={settingsOpen}
                onClick={toggleSettings}
              >
                <span />
              </button>
            </div>

            {settingsOpen && (
              <div className={styles.settingsPanel} role="dialog" aria-label="Kiosk settings">
                <div className={styles.settingsRow}>
                  <span>Language</span>
                  <strong>{languageMode}</strong>
                </div>
                <div className={styles.settingsRow}>
                  <span>Voice</span>
                  <strong>OpenAI + Browser</strong>
                </div>
                <div className={styles.settingsRow}>
                  <span>Offline</span>
                  <strong>Ready</strong>
                </div>
                <div className={styles.settingsActions}>
                  <button type="button" onClick={resetSession}>
                    Reset
                  </button>
                  <a href="/admin/analytics">Analytics</a>
                  <a href="/admin/event">Event</a>
                </div>
              </div>
            )}
          </header>

          <div className={styles.avatarZone}>
            <AvatarStream onAvatarReady={handleAvatarReady} speaking={status === "speaking"} />
          </div>

          <section className={styles.welcome} aria-label="Welcome">
            <h1>{welcomeTitle}</h1>
            <p>{welcomeSubtitle}</p>
          </section>

          <section className={styles.conversation} aria-live="polite" aria-label="Conversation">
            <div className={styles.conversationLog}>
              {renderedConversation.map((message) => (
                <div
                  className={cx(
                    styles.bubble,
                    message.role === "user" ? styles.bubbleUser : styles.bubbleAivent
                  )}
                  key={message.id}
                >
                  <span className={styles.bubbleLabel}>
                    {message.role === "user" ? (message.language === "ar" ? "أنت" : "You") : "Aivent"}
                  </span>
                  <p dir={message.language === "ar" ? "rtl" : "ltr"}>{message.text}</p>
                </div>
              ))}

              {liveTranscript && (
                <div className={cx(styles.bubble, styles.bubbleUser, styles.bubbleDraft)}>
                  <span className={styles.bubbleLabel}>{lang === "ar" ? "أنت" : "You"}</span>
                  <p dir={lang === "ar" ? "rtl" : "ltr"}>{displayTranscript}</p>
                </div>
              )}

              {status === "thinking" && !answer && (
                <div className={cx(styles.bubble, styles.bubbleAivent, styles.bubbleDraft)}>
                  <span className={styles.bubbleLabel}>Aivent</span>
                  <p dir={lang === "ar" ? "rtl" : "ltr"}>{assistantCopy}</p>
                </div>
              )}
            </div>
          </section>

          {error && <div className={styles.errorBanner}>{error}</div>}
        </section>

        <section className={styles.statusSection} aria-label="Concierge system status">
          <article className={styles.statusCard}>
            <h2>Voice Status</h2>
            <PushToTalkButton
              status={status}
              onPressStart={startListening}
              onPressEnd={stopListening}
              onReset={reset}
              disabled={false}
            />
            <div className={styles.voiceMeta}>
              <div className={styles.voiceMetaRow}>
                <span>Speech Mode</span>
                <strong>{languageMode}</strong>
              </div>
              <div className={styles.voiceMetaRow}>
                <span>Clarity</span>
                <strong>{confidence}</strong>
              </div>
            </div>
          </article>

          <article className={styles.statusCard}>
            <h2>Connection Status</h2>
            <div className={styles.connectionMark} aria-hidden />
            <div>
              <div className={styles.statusValue}>
                {streamId ? "Connected" : avatar ? "Voice Ready" : "Connecting"}
              </div>
              <div className={styles.statusNote}>
                {streamId ? "D-ID live stream active" : "Secure session handshake"}
              </div>
            </div>
          </article>

          <article className={styles.statusCard}>
            <h2>System Information</h2>
            <div className={styles.metricList}>
              <div className={styles.metricRow}>
                <span>Stream Quality</span>
                <strong>{streamQuality}</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Response Time</span>
                <strong>{responseTime}</strong>
              </div>
              <div className={styles.metricRow}>
                <span>Session</span>
                <strong>{avatar ? "Stable" : "Opening"}</strong>
              </div>
            </div>
            <div className={styles.signalLine} aria-hidden>
              {Array.from({ length: 48 }).map((_, index) => (
                <span key={index} className={styles[`signalDelay${index % 12}`]} />
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

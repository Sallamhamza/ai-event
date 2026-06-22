"use client";

import { useCallback, useMemo, useState } from "react";
import AvatarStream, { type DIDAvatar } from "@/components/AvatarStream";
import PushToTalkButton from "@/components/PushToTalkButton";
import { usePushToTalk } from "@/hooks/usePushToTalk";

export default function KioskPage() {
  const [avatar,   setAvatar]   = useState<DIDAvatar | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [answer,     setAnswer]     = useState("");
  const [lang,       setLang]       = useState<"en" | "ar">("en");

  const handleAvatarReady = useCallback((av: DIDAvatar, sid?: string) => {
    setAvatar(av);
    if (sid) setStreamId(sid);
  }, []);

  const { status, liveTranscript, error, startListening, stopListening, reset } =
    usePushToTalk({
      avatar,
      language: lang,
      onTranscript: (text) => {
        setTranscript(text);
        setAnswer("");
      },
      onAnswer: setAnswer,
      onLanguageResolved: setLang,
    });

  const displayTranscript = liveTranscript || transcript;

  const statusCopy = useMemo(() => {
    if (status === "listening") return "Listening";
    if (status === "thinking") return "Processing";
    if (status === "speaking") return "Speaking";
    if (status === "error") return "Attention";
    return streamId ? "Live" : avatar ? "Voice Ready" : "Connecting";
  }, [avatar, status, streamId]);

  const assistantCopy = useMemo(() => {
    if (status === "thinking" && !answer)
      return lang === "ar" ? "جارٍ البحث في قاعدة معلومات الفعالية..." : "Scanning the event knowledge base...";
    if (answer) return answer;
    return lang === "ar"
      ? "يمكنني مساعدتك بالجدول، المتحدثين، التسجيل، الموقع، المواصلات، الواي فاي وخدمات الفعالية."
      : "I can help with the agenda, speakers, registration, venue directions, transport, WiFi, and event services.";
  }, [answer, status, lang]);

  return (
    <main className="concierge-page">
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        .concierge-page {
          --navy-950: #020713;
          --navy-900: #04101f;
          --navy-800: #061b32;
          --panel: rgba(4, 22, 42, 0.78);
          --panel-strong: rgba(5, 28, 54, 0.9);
          --line: rgba(93, 220, 255, 0.22);
          --line-strong: rgba(93, 220, 255, 0.38);
          --cyan: #20dfff;
          --cyan-soft: rgba(32, 223, 255, 0.62);
          --green: #2cf2a7;
          --text: rgba(239, 250, 255, 0.94);
          --muted: rgba(178, 214, 228, 0.68);
          --dim: rgba(132, 174, 193, 0.46);
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: clamp(10px, 1.8svh, 22px);
          overflow: hidden auto;
          color: var(--text);
          background:
            radial-gradient(circle at 50% 15%, rgba(15, 119, 183, 0.22), transparent 34%),
            radial-gradient(circle at 50% 88%, rgba(32, 223, 255, 0.08), transparent 34%),
            linear-gradient(180deg, #06172b 0%, #030b17 56%, #01050d 100%);
          font-family: var(--font-geist-sans), Inter, system-ui, sans-serif;
        }

        .concierge-page::before {
          content: "";
          position: fixed;
          inset: 0;
          background:
            linear-gradient(90deg, transparent 0 49.8%, rgba(32, 223, 255, 0.035) 50%, transparent 50.2%),
            radial-gradient(circle, rgba(124, 228, 255, 0.12) 0 1px, transparent 1px);
          background-size: 100% 100%, 72px 72px;
          opacity: 0.58;
          pointer-events: none;
        }

        .concierge-shell {
          position: relative;
          width: min(100%, 560px);
          min-height: min(900px, calc(100svh - 20px));
          display: flex;
          flex-direction: column;
          gap: 12px;
          isolation: isolate;
        }

        .concierge-main {
          position: relative;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
          padding: 18px 18px 22px;
          border: 1px solid var(--line);
          border-radius: 22px;
          background:
            linear-gradient(180deg, rgba(5, 29, 55, 0.72), rgba(2, 12, 26, 0.94)),
            radial-gradient(circle at 50% 23%, rgba(32, 223, 255, 0.13), transparent 39%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            inset 0 0 54px rgba(32, 223, 255, 0.045),
            0 24px 60px rgba(0, 0, 0, 0.28);
        }

        .top-bar {
          position: relative;
          z-index: 20;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          height: 30px;
          padding: 0 14px;
          border: 1px solid var(--line-strong);
          border-radius: 999px;
          color: var(--green);
          background: rgba(2, 25, 46, 0.66);
          box-shadow: inset 0 0 18px rgba(32, 223, 255, 0.055);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .live-pill__dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
          animation: soft-pulse 1.9s ease-in-out infinite;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-button {
          position: relative;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(93, 220, 255, 0.3);
          border-radius: 50%;
          background: rgba(2, 25, 46, 0.62);
          color: rgba(218, 250, 255, 0.84);
          cursor: pointer;
          box-shadow: inset 0 0 14px rgba(32, 223, 255, 0.05);
        }

        .icon-button:hover {
          border-color: rgba(93, 220, 255, 0.56);
        }

        .icon-button span,
        .icon-button span::before,
        .icon-button span::after {
          position: absolute;
          display: block;
          content: "";
        }

        .icon-button--mute span {
          width: 10px;
          height: 10px;
          left: 9px;
          top: 11px;
          border-left: 2px solid currentColor;
          border-bottom: 2px solid currentColor;
          transform: skewY(-18deg);
        }

        .icon-button--mute span::after {
          width: 18px;
          height: 2px;
          left: 4px;
          top: 8px;
          background: currentColor;
          transform: rotate(45deg);
        }

        .icon-button--settings span {
          width: 16px;
          height: 2px;
          left: 8px;
          top: 10px;
          background: currentColor;
          box-shadow: 0 7px 0 currentColor, 0 14px 0 currentColor;
        }

        .icon-button--settings span::before {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          left: 3px;
          top: -1px;
          background: currentColor;
          box-shadow: 8px 7px 0 currentColor, 0 14px 0 currentColor;
        }

        .avatar-zone {
          position: relative;
          z-index: 4;
          width: 100%;
          height: clamp(300px, 42svh, 430px);
          display: grid;
          place-items: center;
          margin-top: 2px;
          pointer-events: none;
          flex-shrink: 0;
        }

        .avatar-zone > * {
          pointer-events: auto;
        }

        .welcome {
          position: relative;
          z-index: 6;
          text-align: center;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .welcome h1 {
          margin: 0;
          color: var(--text);
          font-size: clamp(25px, 5vw, 34px);
          font-weight: 500;
          letter-spacing: -0.025em;
          line-height: 1.06;
        }

        .welcome strong {
          color: var(--cyan);
          font-weight: 850;
          text-shadow: 0 0 16px rgba(32, 223, 255, 0.28);
        }

        .welcome p {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: clamp(12px, 2vw, 14px);
        }

        .conversation {
          position: relative;
          z-index: 8;
          width: min(100%, 430px);
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 18px;
          flex-shrink: 0;
        }

        .bubble {
          position: relative;
          padding: 13px 15px;
          border: 1px solid rgba(93, 220, 255, 0.24);
          border-radius: 16px;
          background: rgba(3, 23, 44, 0.78);
          box-shadow:
            inset 0 0 22px rgba(32, 223, 255, 0.035),
            0 12px 30px rgba(0, 0, 0, 0.2);
          animation: bubble-in 0.26s ease-out;
        }

        .bubble-user {
          align-self: flex-end;
          width: min(86%, 360px);
        }

        .bubble-aivent {
          align-self: flex-start;
          width: min(94%, 390px);
          border-color: rgba(93, 220, 255, 0.32);
          background: rgba(4, 31, 59, 0.82);
        }

        .bubble-label {
          display: block;
          margin-bottom: 7px;
          color: var(--cyan);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .bubble p {
          margin: 0;
          color: rgba(235, 248, 255, 0.88);
          font-size: clamp(12px, 1.85vw, 14px);
          line-height: 1.48;
        }

        .status-section {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          min-height: 148px;
        }

        .status-card {
          min-width: 0;
          min-height: 148px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          padding: 14px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(5, 29, 55, 0.82), rgba(2, 14, 30, 0.94));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            inset 0 0 24px rgba(32, 223, 255, 0.035);
        }

        .status-card h2 {
          margin: 0;
          color: rgba(119, 230, 255, 0.92);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .status-value {
          color: var(--text);
          font-size: 13px;
          font-weight: 750;
        }

        .status-note {
          color: var(--dim);
          font-size: 11px;
          line-height: 1.35;
        }

        .connection-mark {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 1px solid rgba(93, 220, 255, 0.26);
          background:
            radial-gradient(circle, rgba(32, 223, 255, 0.16), transparent 48%),
            conic-gradient(from 90deg, rgba(32, 223, 255, 0.76) 0 18%, transparent 19% 100%);
          box-shadow: inset 0 0 18px rgba(32, 223, 255, 0.08);
          animation: slow-rotate 3.2s linear infinite;
        }

        .metric-list {
          display: grid;
          gap: 7px;
        }

        .metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          color: var(--muted);
          font-size: 10.5px;
        }

        .metric-row strong {
          min-width: 0;
          color: var(--cyan);
          font-size: 10.5px;
          font-weight: 700;
          text-align: right;
          white-space: nowrap;
        }

        .signal-line {
          height: 18px;
          display: flex;
          align-items: center;
          gap: 2px;
          overflow: hidden;
          opacity: 0.62;
        }

        .signal-line span {
          width: 2px;
          height: 5px;
          border-radius: 99px;
          background: var(--cyan);
          animation: signal 1.05s ease-in-out infinite;
        }

        .error-banner {
          position: absolute;
          z-index: 30;
          left: 18px;
          right: 18px;
          bottom: 18px;
          padding: 11px 14px;
          border: 1px solid rgba(255, 91, 91, 0.32);
          border-radius: 14px;
          color: #ffc9c9;
          background: rgba(74, 9, 20, 0.82);
          font-size: 12px;
          text-align: center;
        }

        @keyframes soft-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.78); }
        }

        @keyframes bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slow-rotate {
          to { rotate: 360deg; }
        }

        @keyframes signal {
          0%, 100% { height: 4px; opacity: 0.36; }
          50% { height: 15px; opacity: 1; }
        }

        @media (min-width: 900px) {
          .concierge-shell {
            width: min(64vw, 680px);
          }

          .conversation {
            width: min(92%, 520px);
          }
        }

        @media (max-width: 520px) {
          .concierge-page {
            padding: 6px;
          }

          .concierge-shell {
            min-height: 100svh;
            gap: 10px;
          }

          .concierge-main {
            padding: 14px 14px 18px;
            border-radius: 18px;
          }

          .avatar-zone {
            height: clamp(286px, 39svh, 358px);
          }

          .status-section {
            gap: 7px;
          }

          .status-card {
            min-height: 136px;
            padding: 11px 9px;
            border-radius: 15px;
          }

          .status-card h2 {
            font-size: 8.5px;
            letter-spacing: 0.12em;
          }

          .status-value {
            font-size: 11.5px;
          }

          .status-note,
          .metric-row,
          .metric-row strong {
            font-size: 9px;
          }
        }

        @media (max-width: 360px) {
          .status-section {
            grid-template-columns: 1fr;
          }

          .status-card {
            min-height: 124px;
          }
        }
      `}</style>

      <div className="concierge-shell">
        <section className="concierge-main" aria-label="Aivent live AI event concierge">
          <header className="top-bar">
            <div className="live-pill">
              <span className="live-pill__dot" />
              {statusCopy}
            </div>
            <div className="top-actions">
              <button
                className="icon-button lang-toggle"
                type="button"
                aria-label={`Current language: ${lang === "ar" ? "Arabic" : "English"}. Toggle language.`}
                aria-pressed={lang === "ar"}
                title={lang === "ar" ? "Arabic selected" : "English selected"}
                onClick={() => setLang(l => l === "en" ? "ar" : "en")}
                style={{
                  fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "4px 10px",
                  border: "1px solid rgba(32,223,255,0.35)",
                  borderRadius: "999px",
                  background: lang === "ar" ? "rgba(32,223,255,0.15)" : "transparent",
                  color: "var(--cyan)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  minWidth: 44,
                }}
              >
                {lang === "ar" ? "AR" : "EN"}
              </button>
              <button
                className="icon-button icon-button--mute"
                type="button"
                aria-label="Mute or stop avatar audio"
                onClick={() => avatar?.stop()}
              >
                <span />
              </button>
              <button className="icon-button icon-button--settings" type="button" aria-label="Settings">
                <span />
              </button>
            </div>
          </header>

          <div className="avatar-zone">
            <AvatarStream onAvatarReady={handleAvatarReady} speaking={status === "speaking"} />
          </div>

          <section className="welcome" aria-label="Welcome">
            <h1>
              Hello, I&apos;m <strong>AIVENT</strong>
            </h1>
            <p>Your AI Event Concierge</p>
          </section>

          <section className="conversation" aria-live="polite" aria-label="Conversation">
            <div className="bubble bubble-user">
              <span className="bubble-label">{lang === "ar" ? "أنت" : "You"}</span>
              <p dir={lang === "ar" ? "rtl" : "ltr"}>
                {displayTranscript || (lang === "ar" ? "ما هي أبرز مميزات هذه الفعالية؟" : "What are the main highlights of this event?")}
              </p>
            </div>

            <div className="bubble bubble-aivent">
              <span className="bubble-label">Aivent</span>
              <p dir={lang === "ar" ? "rtl" : "ltr"}>{assistantCopy}</p>
            </div>
          </section>

          {error && <div className="error-banner">{error}</div>}
        </section>

        <section className="status-section" aria-label="Concierge system status">
          <article className="status-card">
            <h2>Voice Status</h2>
            <PushToTalkButton
              status={status}
              onPressStart={startListening}
              onPressEnd={stopListening}
              onReset={reset}
              disabled={false}
            />
          </article>

          <article className="status-card">
            <h2>Connection Status</h2>
            <div className="connection-mark" aria-hidden />
            <div>
              <div className="status-value">{streamId ? "Connected" : avatar ? "Voice Ready" : "Connecting"}</div>
              <div className="status-note">{streamId ? "D-ID live stream active" : "Secure session handshake"}</div>
            </div>
          </article>

          <article className="status-card">
            <h2>System Information</h2>
            <div className="metric-list">
              <div className="metric-row">
                <span>Stream Quality</span>
                <strong>{streamId ? "Excellent" : "Pending"}</strong>
              </div>
              <div className="metric-row">
                <span>Response Time</span>
                <strong>{status === "thinking" ? "..." : "0.42s"}</strong>
              </div>
              <div className="metric-row">
                <span>Session</span>
                <strong>{avatar ? "Stable" : "Opening"}</strong>
              </div>
            </div>
            <div className="signal-line" aria-hidden>
              {Array.from({ length: 48 }).map((_, index) => (
                <span key={index} style={{ animationDelay: `${(index % 12) * 0.035}s` }} />
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

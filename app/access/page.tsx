"use client";

import { FormEvent, useState } from "react";

function getSafeNextPath(): string {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const nextPath = params.get("next") || "/";

  return nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
}

export default function AccessPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || "Invalid access code.");
        return;
      }

      window.location.assign(getSafeNextPath());
    } catch {
      setError("Unable to verify access right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-page">
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }

        .access-page {
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: 24px;
          color: rgba(239, 250, 255, 0.94);
          background:
            radial-gradient(circle at 50% 18%, rgba(20, 150, 210, 0.22), transparent 34%),
            radial-gradient(circle at 50% 85%, rgba(32, 223, 255, 0.09), transparent 36%),
            linear-gradient(180deg, #031426 0%, #020812 100%);
          font-family: Arial, Helvetica, sans-serif;
        }

        .access-panel {
          width: min(100%, 440px);
          padding: 32px;
          border: 1px solid rgba(93, 220, 255, 0.26);
          border-radius: 28px;
          background: rgba(4, 22, 42, 0.78);
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(18px);
        }

        .access-status {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 8px 14px;
          border: 1px solid rgba(32, 223, 255, 0.34);
          border-radius: 999px;
          color: #20dfff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .access-status::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #2cf2a7;
          box-shadow: 0 0 14px rgba(44, 242, 167, 0.8);
        }

        .access-title {
          margin: 28px 0 8px;
          font-size: clamp(30px, 7vw, 44px);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .access-title strong {
          color: #20dfff;
        }

        .access-copy {
          margin: 0 0 28px;
          color: rgba(178, 214, 228, 0.74);
          font-size: 15px;
          line-height: 1.6;
        }

        .access-form {
          display: grid;
          gap: 14px;
        }

        .access-label {
          color: rgba(178, 214, 228, 0.72);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .access-input {
          width: 100%;
          min-height: 54px;
          padding: 0 16px;
          border: 1px solid rgba(93, 220, 255, 0.34);
          border-radius: 16px;
          outline: none;
          color: rgba(239, 250, 255, 0.96);
          background: rgba(2, 11, 22, 0.72);
          font-size: 16px;
        }

        .access-input:focus {
          border-color: rgba(32, 223, 255, 0.72);
          box-shadow: 0 0 0 4px rgba(32, 223, 255, 0.1);
        }

        .access-button {
          min-height: 54px;
          border: 0;
          border-radius: 16px;
          color: #00131c;
          background: linear-gradient(135deg, #20dfff, #2cf2a7);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform 160ms ease, filter 160ms ease;
        }

        .access-button:hover {
          filter: brightness(1.05);
          transform: translateY(-1px);
        }

        .access-button:disabled {
          cursor: not-allowed;
          filter: saturate(0.6);
          opacity: 0.72;
          transform: none;
        }

        .access-error {
          min-height: 20px;
          margin: 2px 0 0;
          color: #ff8d9a;
          font-size: 13px;
          line-height: 1.4;
        }
      `}</style>

      <section className="access-panel" aria-labelledby="access-title">
        <div className="access-status">Private Demo</div>
        <h1 id="access-title" className="access-title">
          AIVENT <strong>Access</strong>
        </h1>
        <p className="access-copy">
          Enter the event demo access code to continue to the AI concierge.
        </p>

        <form className="access-form" onSubmit={handleSubmit}>
          <label className="access-label" htmlFor="access-password">
            Access code
          </label>
          <input
            id="access-password"
            className="access-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
          <button className="access-button" type="submit" disabled={submitting}>
            {submitting ? "Checking..." : "Enter Demo"}
          </button>
          <p className="access-error" aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}

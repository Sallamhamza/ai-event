"use client";

import { FormEvent, useState } from "react";
import styles from "./page.module.css";

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
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="access-title">
        <div className={styles.status}>Private Demo</div>
        <h1 id="access-title" className={styles.title}>
          AIVENT <strong>Access</strong>
        </h1>
        <p className={styles.copy}>
          Enter the event demo access code to continue to the AI concierge.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="access-password">
            Access code
          </label>
          <input
            id="access-password"
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? "Checking..." : "Enter Demo"}
          </button>
          <p className={styles.error} aria-live="polite">
            {error}
          </p>
        </form>
      </section>
    </main>
  );
}

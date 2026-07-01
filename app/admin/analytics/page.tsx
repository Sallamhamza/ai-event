import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/analytics-store";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

function formatTime(value: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export default function AnalyticsPage() {
  const summary = getAnalyticsSummary();
  const answered = summary.counts.answer;
  const questions = summary.counts.question;
  const answerRate = questions ? Math.round((answered / questions) * 100) : 0;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>Analytics</h1>
            <p>Session started {new Date(summary.startedAt).toLocaleString("en")}</p>
          </div>
          <nav className={styles.nav} aria-label="Admin navigation">
            <Link href="/">Kiosk</Link>
            <Link href="/admin/event">Event Content</Link>
          </nav>
        </header>

        <section className={styles.grid} aria-label="Analytics summary">
          <article className={styles.panel}>
            <h2>Total Events</h2>
            <div className={styles.stat}>{summary.totalEvents}</div>
          </article>
          <article className={styles.panel}>
            <h2>Questions</h2>
            <div className={styles.stat}>{questions}</div>
          </article>
          <article className={styles.panel}>
            <h2>Answers</h2>
            <div className={styles.stat}>{answered}</div>
          </article>
          <article className={styles.panel}>
            <h2>Answer Rate</h2>
            <div className={styles.stat}>{answerRate}%</div>
          </article>
        </section>

        <section className={styles.grid} aria-label="Language summary">
          <article className={styles.panel}>
            <h2>English</h2>
            <div className={styles.stat}>{summary.languages.en}</div>
          </article>
          <article className={styles.panel}>
            <h2>Arabic</h2>
            <div className={styles.stat}>{summary.languages.ar}</div>
          </article>
          <article className={styles.panel}>
            <h2>Voice Errors</h2>
            <div className={styles.stat}>{summary.counts.voice_error}</div>
          </article>
          <article className={styles.panel}>
            <h2>Resets</h2>
            <div className={styles.stat}>{summary.counts.session_reset}</div>
          </article>
        </section>

        <section className={styles.panel}>
          <h2>Latest Events</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Language</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              {summary.latest.map((event) => (
                <tr key={`${event.at}-${event.event}`}>
                  <td>{formatTime(event.at)}</td>
                  <td>{event.event}</td>
                  <td>{event.language ?? "-"}</td>
                  <td>{event.meta ? JSON.stringify(event.meta) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

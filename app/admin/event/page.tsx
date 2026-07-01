import Link from "next/link";
import { readEventAdminSnapshot } from "@/lib/event-admin";
import EventEditor from "./EventEditor";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default function EventAdminPage() {
  const snapshot = readEventAdminSnapshot();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>Event Content</h1>
            <p>{snapshot.relativePath}</p>
          </div>
          <nav className={styles.nav} aria-label="Admin navigation">
            <Link href="/">Kiosk</Link>
            <Link href="/admin/analytics">Analytics</Link>
          </nav>
        </header>

        <section className={styles.grid} aria-label="Event content summary">
          <article className={styles.panel}>
            <h2>Event ID</h2>
            <div className={styles.stat}>{snapshot.eventId}</div>
          </article>
          <article className={styles.panel}>
            <h2>Sections</h2>
            <div className={styles.stat}>{snapshot.sections.length}</div>
          </article>
          <article className={styles.panel}>
            <h2>Q&A</h2>
            <div className={styles.stat}>{snapshot.questionCount}</div>
          </article>
          <article className={styles.panel}>
            <h2>Dialogues</h2>
            <div className={styles.stat}>{snapshot.sampleDialogueCount}</div>
          </article>
        </section>

        <EventEditor initialContent={snapshot.content} />
      </div>
    </main>
  );
}

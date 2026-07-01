"use client";

import { useState, useTransition } from "react";
import styles from "../admin.module.css";

interface EventEditorProps {
  initialContent: string;
}

export default function EventEditor({ initialContent }: EventEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setMessage("");
    setError("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/event", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Could not save event content.");
          return;
        }

        setContent(data.content);
        setMessage("Saved");
      } catch {
        setError("Could not save event content.");
      }
    });
  };

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <h2>JSON Content</h2>
        <button className={styles.button} type="button" onClick={save} disabled={isPending}>
          {isPending ? "Saving" : "Save"}
        </button>
      </div>
      <textarea
        className={styles.editor}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        aria-label="Event JSON content"
      />
      {message && <p className={styles.status}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

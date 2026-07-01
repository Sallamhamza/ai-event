"use client";

import { useEffect } from "react";
import styles from "./global-error.module.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={styles.body}>
        <main className={styles.panel}>
          <title>AIVENT Concierge Error</title>
          <h1>AIVENT needs a quick refresh</h1>
          <p>The kiosk hit a temporary issue.</p>
          <button type="button" onClick={() => unstable_retry()}>
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}

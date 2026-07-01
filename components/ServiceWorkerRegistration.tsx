"use client";

import { useEffect } from "react";
import { trackClientEvent } from "@/lib/client-analytics";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        trackClientEvent({ event: "offline_ready" });
      })
      .catch(() => {});
  }, []);

  return null;
}

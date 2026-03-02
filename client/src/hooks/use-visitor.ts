import { useEffect } from "react";

function generateFingerprint(): string {
  const nav = window.navigator;
  const screen = window.screen;
  const data = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return "fp_" + Math.abs(hash).toString(36);
}

export function useVisitorTracking() {
  useEffect(() => {
    const fingerprint = generateFingerprint();
    const referrer = document.referrer || "direct";

    fetch("/api/visitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint, referrer }),
    }).catch(() => {});
  }, []);
}

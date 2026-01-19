// core/telemetryIngestClient.js
// Debug-only client → POST /api/telemetry/ingest (fire-and-forget, deduped)
// Rules:
// - Must be a no-op unless URL has ?debug=1
// - Must never throw
// - Must not change UI/UX; only one console.warn line allowed on failure
// - Must dedupe (same body sent only once per session)

const SENT_KEY = "__telemetryIngestSentV1";
const sentMem = new Set();

function stableStringify(obj) {
  // Keep payload contract intact; do not normalize/rewrite payload.
  return JSON.stringify(obj);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

function loadSentSet() {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) arr.forEach((x) => sentMem.add(String(x)));
  } catch {
    // no-op
  }
}

function persistSentSet() {
  try {
    const arr = Array.from(sentMem);
    const trimmed = arr.slice(Math.max(0, arr.length - 500));
    sessionStorage.setItem(SENT_KEY, JSON.stringify(trimmed));
  } catch {
    // no-op
  }
}

export function isDebugIngestEnabled() {
  try {
    return new URLSearchParams(location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

export function sendTelemetryToIngestOnce({ source, payload }) {
  try {
    // Safe no-op unless explicitly enabled
    if (!isDebugIngestEnabled()) return;

    if (sentMem.size === 0) loadSentSet();

    const bodyObj = { source: String(source || "unknown"), payload };
    const sig = fnv1a(stableStringify(bodyObj));

    if (sentMem.has(sig)) return;
    sentMem.add(sig);
    persistSentSet();

    const body = JSON.stringify(bodyObj);

    // fire-and-forget: sendBeacon preferred, fetch keepalive fallback
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry/ingest", blob);
      return;
    }

    fetch("/api/telemetry/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // only one warn line allowed
      console.warn("[telemetry] ingest POST failed (debug-only)");
    });
  } catch {
    // only one warn line allowed
    console.warn("[telemetry] ingest POST failed (debug-only)");
  }
}



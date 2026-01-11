// core/usage/usageTriggerV1.js
// Log-only usage trigger hook (V1)
// Hard rules:
// - NO quota deduction
// - NO server calls
// - NO localStorage writes (read-only allowed)

/**
 * Safely reads the current report id from localStorage.
 * - tries localStorage.getItem('__currentReportId')
 * - returns non-empty string, else null
 * - safe if localStorage is unavailable
 */
export function getCurrentReportIdSafe() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    const v = localStorage.getItem('__currentReportId');
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed ? trimmed : null;
  } catch (_) {
    return null;
  }
}

function getSeenSet() {
  // Requirement: global Set stored on window: window.__usageTriggerV1Seen
  // Create if missing.
  if (typeof window !== 'undefined' && window) {
    if (!window.__usageTriggerV1Seen || !(window.__usageTriggerV1Seen instanceof Set)) {
      window.__usageTriggerV1Seen = new Set();
    }
    return window.__usageTriggerV1Seen;
  }

  // Non-browser fallback to avoid crashes (still dedupes within this module instance).
  if (!globalThis.__usageTriggerV1Seen || !(globalThis.__usageTriggerV1Seen instanceof Set)) {
    globalThis.__usageTriggerV1Seen = new Set();
  }
  return globalThis.__usageTriggerV1Seen;
}

/**
 * Logs (once per (reportId || 'NO_REPORT') per page session) that usage would be consumed.
 * This is NOT a deduction; it's informational only.
 */
export function markUsageWouldConsumeOnce({ source, action, meta } = {}) {
  const reportId = getCurrentReportIdSafe();
  const key = reportId || 'NO_REPORT';

  const seen = getSeenSet();
  if (seen.has(key)) return false;
  seen.add(key);

  const ts = Date.now();
  console.info('[USAGE_TRIGGER_V2] usage would be consumed', {
    reportId,
    source,
    action,
    ts,
    meta,
  });

  return true;
}



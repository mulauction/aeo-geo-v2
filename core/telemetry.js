// core/telemetry.js
// Minimal, sessionStorage-only telemetry (no network by default).
// Hard rules:
// - Never throw (wrap everything in try/catch)
// - No PII: do not store raw reportId/r; only store hashes

const KEY = '__shareTelemetryV1';
const SID_KEY = '__shareTelemetrySidV1';

export function getSessionId() {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    const existing = sessionStorage.getItem(SID_KEY);
    if (existing && existing.length > 0) return existing;
    const sid = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(SID_KEY, sid);
    return sid;
  } catch (_) {
    return '';
  }
}

// Simple non-cryptographic hash (FNV-1a 32-bit), returns hex string.
export function hashId(input) {
  try {
    if (!input) return '';
    const s = String(input);
    if (!s) return '';
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      // h *= 16777619 (mod 2^32) via shifts
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  } catch (_) {
    return '';
  }
}

export function track(eventName, payload = {}) {
  try {
    if (!eventName || typeof eventName !== 'string') return;
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(KEY);
    let arr = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) arr = parsed;
    } catch (_) {
      arr = [];
    }
    const evt = { ts: Date.now(), event: eventName, ...(payload && typeof payload === 'object' ? payload : {}) };
    arr.push(evt);
    if (arr.length > 200) arr = arr.slice(arr.length - 200);
    sessionStorage.setItem(KEY, JSON.stringify(arr));
  } catch (_) {
    // never throw
  }
}

export function readStore() {
  try {
    if (typeof sessionStorage === 'undefined') return [];
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function dumpTelemetry() {
  return readStore();
}

function csvEscape(v) {
  const s = (v === null || typeof v === 'undefined') ? '' : String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export function toCsv(rows) {
  try {
    const arr = Array.isArray(rows) ? rows : [];
    const header = [
      'ts',
      'event',
      'sid',
      'reportIdHash',
      'preState',
      'finalState',
      'reason',
      'hasLastV2',
      'requestedLoaded',
    ];
    const lines = [header.join(',')];
    for (const r of arr) {
      const o = (r && typeof r === 'object') ? r : {};
      const line = [
        o.ts,
        o.event,
        o.sid,
        o.reportIdHash,
        o.preState,
        o.finalState,
        o.reason,
        o.hasLastV2,
        o.requestedLoaded,
      ].map(csvEscape).join(',');
      lines.push(line);
    }
    return lines.join('\n');
  } catch (_) {
    return 'ts,event,sid,reportIdHash,preState,finalState,reason,hasLastV2,requestedLoaded\n';
  }
}

export function downloadText(filename, text, mime = 'text/plain') {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([String(text || '')], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `download-${Date.now()}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 0);
  } catch (_) {
    // never throw
  }
}

export function downloadTelemetryJSON() {
  try {
    const rows = dumpTelemetry();
    downloadText(`share-telemetry-${Date.now()}.json`, JSON.stringify(rows, null, 2), 'application/json');
  } catch (_) {}
}

export function downloadTelemetryCSV() {
  try {
    const rows = dumpTelemetry();
    downloadText(`share-telemetry-${Date.now()}.csv`, toCsv(rows), 'text/csv');
  } catch (_) {}
}

export function summarize() {
  try {
    if (typeof sessionStorage === 'undefined') {
      return { countsByFinalState: {}, countsByPreState: {}, topReasons: [], okRate: 0, total: 0 };
    }
    const arr = readStore();

    const countsByFinalState = {};
    const countsByPreState = {};
    const reasonCounts = {};

    let totalFinal = 0;
    let okCount = 0;

    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      if (e.event === 'share_pre_state') {
        const ps = e.preState || '';
        if (ps) countsByPreState[ps] = (countsByPreState[ps] || 0) + 1;
      }
      if (e.event === 'share_final_state') {
        totalFinal += 1;
        const fs = e.finalState || '';
        if (fs) countsByFinalState[fs] = (countsByFinalState[fs] || 0) + 1;
        if (fs === 'OK') okCount += 1;
        const r = e.reason || '';
        if (r) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    const okRate = totalFinal > 0 ? (okCount / totalFinal) : 0;
    return { countsByFinalState, countsByPreState, topReasons, okRate, total: totalFinal };
  } catch (_) {
    return { countsByFinalState: {}, countsByPreState: {}, topReasons: [], okRate: 0, total: 0 };
  }
}

// Window helper: print telemetry summary
try {
  if (typeof window !== 'undefined') {
    window.__printTelemetrySummary = () => {
      const s = summarize();
      try {
        const finalRows = Object.entries(s.countsByFinalState).map(([state, count]) => ({ state, count }));
        const preRows = Object.entries(s.countsByPreState).map(([state, count]) => ({ state, count }));
        console.log('[telemetry] total =', s.total, 'okRate =', s.okRate);
        console.log('[telemetry] topReasons =', s.topReasons);
        console.table(finalRows);
        console.table(preRows);
      } catch (_) {
        console.log('[telemetry]', s);
      }
      return s;
    };
  }
} catch (_) {
  // ignore
}



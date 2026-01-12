import { buildTelemetryExportV1 } from './telemetryExport.js';
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
    const events = dumpTelemetry();
    const s = summarize();
    const meta = {
      generatedAt: new Date().toISOString(),
      total: s.total,
      okRate: s.okRate,
      countsByFinalState: s.countsByFinalState,
      countsByPreState: s.countsByPreState,
      topReasons: s.topReasons,
      transitionMatrix: s.transitionMatrix,
      dropOffTopToFetchFail: s.dropOffTopToFetchFail,
      dropOffTopOverall: s.dropOffTopOverall,
    };
    // ✅ [Phase 32-0] debug=1에서만 meta를 localStorage에 캐시 (read-only UI를 위한 보조 저장; 기존 키/스키마 영향 없음)
    try {
      const isDebug = (typeof location !== 'undefined') && (new URLSearchParams(location.search).get('debug') === '1');
      if (isDebug && typeof localStorage !== 'undefined') {
        localStorage.setItem('__telemetry_meta_v1', JSON.stringify(meta));
      }
    } catch (_) {}
    // ✅ [Phase 32 Step 1] TelemetryExportV1 wrapper (schema 고정)
    const url = (typeof location !== 'undefined' && location.href) ? String(location.href) : '';
    const reportId = (() => {
      try {
        if (typeof location === 'undefined') return '';
        const p = new URLSearchParams(location.search);
        return String(p.get('r') || p.get('id') || '');
      } catch (_) {
        return '';
      }
    })();
    const finalState = (typeof window !== 'undefined' && window.__shareViewState) ? String(window.__shareViewState) : '';
    const environment = (typeof location !== 'undefined' && location.hostname) ? String(location.hostname) : '';
    const sid = getSessionId();
    const payload = buildTelemetryExportV1(events, { url, reportId, finalState, environment, sid });
    downloadText(
      `share-telemetry-${Date.now()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  } catch (_) {}
}

export function downloadTelemetryCSV() {
  try {
    const events = dumpTelemetry();
    const s = summarize();

    const generatedAt = new Date().toISOString();
    const okRateText = (typeof s.okRate === 'number' && Number.isFinite(s.okRate))
      ? `${(s.okRate * 100).toFixed(1)}%`
      : '';
    const totalText = (typeof s.total === 'number' && Number.isFinite(s.total)) ? String(s.total) : '';

    const finalStatePairs = Object.entries(s.countsByFinalState || {})
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .map(([k, v]) => `${k}=${v}`);

    const topReasonsText = (Array.isArray(s.topReasons) ? s.topReasons : [])
      .slice(0, 5)
      .map((r) => `${r.reason}(${r.count})`)
      .join(', ');

    const metaLines = [
      `# top_transition_to_FETCH_FAIL: ${s.dropOffTopToFetchFail ? `${s.dropOffTopToFetchFail.preState} -> FETCH_FAIL = ${s.dropOffTopToFetchFail.count}` : 'none'}`,
      `# top_transition_overall: ${s.dropOffTopOverall ? `${s.dropOffTopOverall.preState} -> ${s.dropOffTopOverall.finalState} = ${s.dropOffTopOverall.count}` : 'none'}`,
      `# generatedAt: ${generatedAt}`,
      `# total: ${totalText}`,
      `# okRate: ${okRateText}`,
      `# finalState: ${finalStatePairs.join(' ')}`,
      `# topReasons: ${topReasonsText}`,
    ];

    const csvBody = toCsv(events);
    // ✅ [Phase 32-0] debug=1에서만 meta를 localStorage에 캐시 (read-only UI를 위한 보조 저장; 기존 키/스키마 영향 없음)
    try {
      const isDebug = (typeof location !== 'undefined') && (new URLSearchParams(location.search).get('debug') === '1');
      if (isDebug && typeof localStorage !== 'undefined') {
        const meta = {
          generatedAt,
          total: s.total,
          okRate: s.okRate,
          countsByFinalState: s.countsByFinalState,
          countsByPreState: s.countsByPreState,
          topReasons: s.topReasons,
          transitionMatrix: s.transitionMatrix,
          dropOffTopToFetchFail: s.dropOffTopToFetchFail,
          dropOffTopOverall: s.dropOffTopOverall,
        };
        localStorage.setItem('__telemetry_meta_v1', JSON.stringify(meta));
      }
    } catch (_) {}
    downloadText(
      `share-telemetry-${Date.now()}.csv`,
      metaLines.join('\n') + '\n' + csvBody,
      'text/csv'
    );
  } catch (_) {}
}

export function summarize() {
  try {
    if (typeof sessionStorage === 'undefined') {
      return {
        countsByFinalState: {},
        countsByPreState: {},
        topReasons: [],
        okRate: 0,
        total: 0,
        transitionMatrix: {},
        dropOffTopToFetchFail: null,
        dropOffTopOverall: null,
      };
    }
    const arr = readStore();

    const countsByFinalState = {};
    const countsByPreState = {};
    const reasonCounts = {};

    let totalFinal = 0;
    let okCount = 0;

    // --- transition tracking (best-effort, schema-tolerant) ---
    const transitionMatrix = {};
    function normState(v) {
      try {
        if (v === null || typeof v === 'undefined') return '';
        const s = String(v).trim();
        if (!s) return '';
        const low = s.toLowerCase();
        if (low === 'unknown' || low === 'undefined' || low === 'null') return '';
        return s;
      } catch (_) {
        return '';
      }
    }
    function pickFirst(obj, keys) {
      try {
        if (!obj || typeof obj !== 'object') return '';
        for (const k of keys) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            const v = normState(obj[k]);
            if (v) return v;
          }
        }
        return '';
      } catch (_) {
        return '';
      }
    }
    function pickPreFinal(evt) {
      // A) If both pre and final exist on the same event, prefer that.
      const pre = pickFirst(evt, ['preState', 'pre_state', 'prevState', 'prev_state', 'from', 'pre', 'initialState', 'initial_state']);
      const fin = pickFirst(evt, ['finalState', 'final_state', 'nextState', 'next_state', 'to', 'final', 'state']);
      return { pre, fin };
    }
    function incMatrix(pre, fin) {
      try {
        if (!pre || !fin) return;
        if (!transitionMatrix[pre]) transitionMatrix[pre] = {};
        transitionMatrix[pre][fin] = (transitionMatrix[pre][fin] || 0) + 1;
      } catch (_) {}
    }

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

      // Transition extraction (A): event-local pre+final pairs
      const { pre, fin } = pickPreFinal(e);
      if (pre && fin) incMatrix(pre, fin);
    }

    // Transition extraction (B): if no pairs were found, use consecutive finalState events
    const hasAnyTransition = Object.keys(transitionMatrix).length > 0;
    if (!hasAnyTransition) {
      const withIdx = arr.map((e, i) => ({ e, i }));
      withIdx.sort((a, b) => {
        const ta = (a.e && typeof a.e === 'object' && typeof a.e.ts === 'number') ? a.e.ts : 0;
        const tb = (b.e && typeof b.e === 'object' && typeof b.e.ts === 'number') ? b.e.ts : 0;
        if (ta !== tb) return ta - tb;
        return a.i - b.i;
      });
      const finals = [];
      for (const it of withIdx) {
        const evt = it.e;
        if (!evt || typeof evt !== 'object') continue;
        const fin = pickFirst(evt, ['finalState', 'final_state', 'nextState', 'next_state', 'to', 'final', 'state']);
        if (fin) finals.push(fin);
      }
      for (let i = 1; i < finals.length; i++) {
        const from = finals[i - 1];
        const to = finals[i];
        if (!from || !to) continue;
        incMatrix(from, to);
      }
    }

    // Drop-off summaries
    let dropOffTopToFetchFail = null;
    let dropOffTopOverall = null;
    try {
      const all = [];
      for (const pre of Object.keys(transitionMatrix)) {
        const row = transitionMatrix[pre] || {};
        for (const fin of Object.keys(row)) {
          const count = row[fin] || 0;
          if (!count) continue;
          all.push({ preState: pre, finalState: fin, count });
        }
      }
      for (const t of all) {
        if (t.finalState === 'FETCH_FAIL') {
          if (!dropOffTopToFetchFail || t.count > dropOffTopToFetchFail.count) dropOffTopToFetchFail = t;
        }
      }
      const nonSelf = all.filter((t) => t.preState !== t.finalState);
      const pool = nonSelf.length > 0 ? nonSelf : all;
      for (const t of pool) {
        if (!dropOffTopOverall || t.count > dropOffTopOverall.count) dropOffTopOverall = t;
      }
    } catch (_) {
      dropOffTopToFetchFail = null;
      dropOffTopOverall = null;
    }

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    const okRate = totalFinal > 0 ? (okCount / totalFinal) : 0;
    return {
      countsByFinalState,
      countsByPreState,
      topReasons,
      okRate,
      total: totalFinal,
      transitionMatrix,
      dropOffTopToFetchFail,
      dropOffTopOverall,
    };
  } catch (_) {
    return {
      countsByFinalState: {},
      countsByPreState: {},
      topReasons: [],
      okRate: 0,
      total: 0,
      transitionMatrix: {},
      dropOffTopToFetchFail: null,
      dropOffTopOverall: null,
    };
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



import { buildTelemetryExportCsvV1, buildTelemetryExportV1 } from './telemetryExport.js';
import { sendTelemetryToIngestOnce } from "./telemetryIngestClient.js";
import { buildFunnelActionChecklist, buildFunnelRecommendedActions, pickTopActionFromChecklist } from './funnelActions.js';
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
    sendTelemetryToIngestOnce({ source: "export-json", payload });
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
    const csvBody = buildTelemetryExportCsvV1(events, { url, reportId, finalState, environment, sid });
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
      csvBody,
      'text/csv'
    );
  } catch (_) {}
}

// -----------------------------
// ✅ [Phase 90 debug helpers][observe-only]
// - Dev-only helpers for sessionStorage telemetry inspection
// - No network, no UI changes, no schema changes (read-only)
// - Exposed only on share.html with debug=1
// -----------------------------

const BEFORE_KEY = "__funnel_snapshot_before_v1";

function _lsGetJSON(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function _lsSetJSON(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
}

function _isShareDebugOn() {
  try {
    if (typeof location === 'undefined') return false;
    const p = new URLSearchParams(location.search || '');
    const isDebug = p.get('debug') === '1';
    const isShare = String(location.pathname || '').endsWith('/share.html') || String(location.pathname || '') === '/share.html';
    return !!(isDebug && isShare);
  } catch (_) {
    return false;
  }
}

function _readRawTelemetryEvents() {
  try {
    if (typeof sessionStorage === 'undefined') return [];
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function _getSidFallback() {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    return String(sessionStorage.getItem(SID_KEY) || '');
  } catch (_) {
    return '';
  }
}

function _fmtTs(ts) {
  try {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '';
    return new Date(n).toISOString();
  } catch (_) {
    return '';
  }
}

function _pick(o, keys) {
  try {
    for (const k of keys) {
      if (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) && o[k] != null) return o[k];
    }
    return undefined;
  } catch (_) {
    return undefined;
  }
}

function _groupBySid(events) {
  const sidFallback = _getSidFallback();
  const map = new Map();
  for (const ev of Array.isArray(events) ? events : []) {
    const o = (ev && typeof ev === 'object') ? ev : {};
    const sid = String(o.sid || sidFallback || 'unknown');
    const arr = map.get(sid) || [];
    arr.push(o);
    map.set(sid, arr);
  }
  return map;
}

function _countByEvent(events) {
  const counts = Object.create(null);
  for (const ev of Array.isArray(events) ? events : []) {
    const name = (ev && typeof ev === 'object') ? String(ev.event || '') : '';
    if (!name) continue;
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

function _pct(n, d) {
  try {
    const nn = Number(n);
    const dd = Number(d);
    if (!Number.isFinite(nn) || !Number.isFinite(dd) || dd <= 0) return '0%';
    return `${Math.round((nn / dd) * 1000) / 10}%`;
  } catch (_) {
    return '0%';
  }
}

// ✅ [Phase 91-1] Pure funnel outcome classifier (no side effects; no schema/event changes)
// - Uses actual emitted event names (verified via rg):
//   share_view, analyze_view, analyze_action_run, generate_view, generate_action_run
export function computeTelemetryFunnelOutcome(events = [], _meta = null) {
  try {
    const arr = Array.isArray(events) ? events : [];
    const getName = (e) => {
      try {
        if (!e || typeof e !== 'object') return '';
        return String(e.event || e.name || '');
      } catch (_) {
        return '';
      }
    };
    const has = (name) => arr.some((e) => getName(e) === name);

    const hasShareView = has('share_view');
    const hasAnalyzeView = has('analyze_view');
    const hasAnalyzeRun = has('analyze_action_run');
    const hasGenerateView = has('generate_view');
    const hasGenerateRun = has('generate_action_run');

    const flags = {
      hasShareView,
      hasAnalyzeView,
      hasAnalyzeRun,
      hasGenerateView,
      hasGenerateRun,
    };

    // Priority:
    // 1) CASE_OK
    // 2) CASE_A
    // 3) CASE_B
    // 4) CASE_C
    // 5) CASE_D
    if (hasAnalyzeRun && hasGenerateRun && hasShareView) {
      return {
        dominant_drop_case: 'CASE_OK',
        human_reason: '완주',
        next_action_hint: '유지',
        flags,
      };
    }
    if (hasAnalyzeView && !hasAnalyzeRun) {
      return {
        dominant_drop_case: 'CASE_A',
        human_reason: 'Analyze 진입했으나 실행하지 않음',
        next_action_hint: 'Analyze 실행 CTA/가이드 강화',
        flags,
      };
    }
    if (hasAnalyzeRun && !hasGenerateView) {
      return {
        dominant_drop_case: 'CASE_B',
        human_reason: 'Analyze 실행 후 Generate로 이동 안 함',
        next_action_hint: 'Analyze→Generate 전환 CTA 강화/자동 이동 고려',
        flags,
      };
    }
    if (hasGenerateView && !hasGenerateRun) {
      return {
        dominant_drop_case: 'CASE_C',
        human_reason: 'Generate 화면은 봤으나 실행 안 함',
        next_action_hint: 'Generate 실행 버튼 가시성/마찰 감소',
        flags,
      };
    }
    if (hasGenerateRun && !hasShareView) {
      return {
        dominant_drop_case: 'CASE_D',
        human_reason: 'Generate 실행 후 Share로 돌아오지 않음',
        next_action_hint: 'Share 복귀 유도(리포트 보기/자동 리다이렉트) 강화',
        flags,
      };
    }

    // Fallback (should be rare in normal Share-driven sessions)
    return {
      dominant_drop_case: 'CASE_A',
      human_reason: 'Analyze 진입했으나 실행하지 않음',
      next_action_hint: 'Analyze 실행 CTA/가이드 강화',
      flags: { ...flags, fallback: true, emptyEvents: arr.length === 0 },
    };
  } catch (_) {
    return {
      dominant_drop_case: 'CASE_A',
      human_reason: 'Analyze 진입했으나 실행하지 않음',
      next_action_hint: 'Analyze 실행 CTA/가이드 강화',
      flags: { fallback: true, error: true },
    };
  }
}

// -----------------------------
// [Phase 97-1 / Step 1] Before vs After funnel snapshot compare (PURE)
// - No side effects, no console, no storage, no exports required
// -----------------------------

function _safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function _round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function _pct1(count, sessions) {
  const s = _safeNum(sessions);
  const c = _safeNum(count);
  if (!(s > 0)) return 0;
  return _round1((c / s) * 100);
}

function _fmtPP(n) {
  const v = _round1(n);
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}pp`;
}

function _fmtPct(n) {
  return `${_round1(n).toFixed(1)}%`;
}

function _dominantDropCase(counts_by_case) {
  const c = counts_by_case && typeof counts_by_case === 'object' ? counts_by_case : {};
  const cases = ['CASE_A', 'CASE_B', 'CASE_C', 'CASE_D'];

  let bestCase = null;
  let bestCount = -1;
  for (const k of cases) {
    const n = _safeNum(c[k]);
    if (n > bestCount) {
      bestCount = n;
      bestCase = k;
    }
  }
  if (!(bestCount > 0)) return null;
  return bestCase;
}

function normalizeFunnelSnapshot(snapshot) {
  const s = snapshot && typeof snapshot === 'object' ? snapshot : null;
  const totals = s && s.totals && typeof s.totals === 'object' ? s.totals : null;

  const sessionsRaw = totals ? totals.sessions : 0;
  const sessions = Math.max(0, _safeNum(sessionsRaw));

  const inCounts = s && s.counts_by_case && typeof s.counts_by_case === 'object' ? s.counts_by_case : {};
  const counts_by_case = {
    CASE_OK: Math.max(0, _safeNum(inCounts.CASE_OK)),
    CASE_A: Math.max(0, _safeNum(inCounts.CASE_A)),
    CASE_B: Math.max(0, _safeNum(inCounts.CASE_B)),
    CASE_C: Math.max(0, _safeNum(inCounts.CASE_C)),
    CASE_D: Math.max(0, _safeNum(inCounts.CASE_D)),
  };

  return { totals: { sessions }, counts_by_case };
}

function compareFunnelSnapshots(before, after) {
  const notes = [];
  const b = before ? normalizeFunnelSnapshot(before) : null;
  const a = after ? normalizeFunnelSnapshot(after) : null;

  const bSessions = b ? _safeNum(b.totals.sessions) : 0;
  const aSessions = a ? _safeNum(a.totals.sessions) : 0;

  const minSessions = 30;

  const comparable = !!(b && a && bSessions > 0 && aSessions > 0 && bSessions >= minSessions && aSessions >= minSessions);
  if (!b) notes.push('before snapshot missing');
  if (!a) notes.push('after snapshot missing');
  if (b && !(bSessions > 0)) notes.push('before.sessions==0');
  if (a && !(aSessions > 0)) notes.push('after.sessions==0');
  if (b && bSessions > 0 && bSessions < minSessions) notes.push(`before.sessions<${minSessions}`);
  if (a && aSessions > 0 && aSessions < minSessions) notes.push(`after.sessions<${minSessions}`);

  const bCounts = b ? b.counts_by_case : { CASE_OK: 0, CASE_A: 0, CASE_B: 0, CASE_C: 0, CASE_D: 0 };
  const aCounts = a ? a.counts_by_case : { CASE_OK: 0, CASE_A: 0, CASE_B: 0, CASE_C: 0, CASE_D: 0 };

  const beforeOkRate = _pct1(bCounts.CASE_OK, bSessions);
  const afterOkRate = _pct1(aCounts.CASE_OK, aSessions);

  const beforeDomCase = _dominantDropCase(bCounts);
  const afterDomCase = _dominantDropCase(aCounts);

  const beforeDomRate = beforeDomCase ? _pct1(bCounts[beforeDomCase], bSessions) : 0;
  const afterDomRate = afterDomCase ? _pct1(aCounts[afterDomCase], aSessions) : 0;

  const deltasByCase = {
    CASE_A: _round1(_pct1(aCounts.CASE_A, aSessions) - _pct1(bCounts.CASE_A, bSessions)),
    CASE_B: _round1(_pct1(aCounts.CASE_B, aSessions) - _pct1(bCounts.CASE_B, bSessions)),
    CASE_C: _round1(_pct1(aCounts.CASE_C, aSessions) - _pct1(bCounts.CASE_C, bSessions)),
    CASE_D: _round1(_pct1(aCounts.CASE_D, aSessions) - _pct1(bCounts.CASE_D, bSessions)),
    CASE_OK: _round1(afterOkRate - beforeOkRate),
  };

  const okDelta = deltasByCase.CASE_OK;
  const dominantDelta = _round1(afterDomRate - beforeDomRate);

  const improved = !!(comparable && okDelta >= 0.5 && dominantDelta <= -0.5);

  const summary = comparable
    ? `CASE_OK ${_fmtPct(beforeOkRate)}→${_fmtPct(afterOkRate)}(${_fmtPP(okDelta)}), dominant ${beforeDomCase || 'n/a'} ${_fmtPct(beforeDomRate)}→${_fmtPct(afterDomRate)}(${_fmtPP(dominantDelta)}) — ${improved ? 'improved' : 'not improved'}`
    : `Not comparable: before.sessions=${_safeNum(bSessions)}, after.sessions=${_safeNum(aSessions)}`;

  return {
    comparable,
    improved,
    summary,
    rates: {
      before: { CASE_OK: beforeOkRate, dominant_drop_case: beforeDomCase, dominant_drop_rate: beforeDomRate },
      after: { CASE_OK: afterOkRate, dominant_drop_case: afterDomCase, dominant_drop_rate: afterDomRate },
    },
    deltas: {
      CASE_OK: okDelta,
      dominant_drop_rate: dominantDelta,
      by_case: deltasByCase,
    },
    notes,
  };
}

function __debugTelemetryLast(n = 20) {
  try {
    const limit = Math.max(1, Math.min(200, Number(n) || 20));
    const events = _readRawTelemetryEvents().slice(-limit);
    const sidFallback = _getSidFallback();
    const rows = events.map((e) => {
      const o = (e && typeof e === 'object') ? e : {};
      const sid = String(o.sid || sidFallback || '');
      const report_id = _pick(o, ['report_id', 'reportIdHash']);
      const share_state = _pick(o, ['share_state', 'finalState', 'preState']);
      const from = _pick(o, ['from']);
      const has_previous_report = _pick(o, ['has_previous_report']);
      return {
        event: String(o.event || ''),
        ts: _fmtTs(o.ts),
        sid,
        has_report_id: !!report_id,
        report_id: report_id != null ? String(report_id) : '',
        share_state: share_state != null ? String(share_state) : '',
        from: from != null ? String(from) : '',
        has_previous_report: typeof has_previous_report === 'boolean' ? has_previous_report : '',
      };
    });
    console.table(rows);
    return rows;
  } catch (_) {
    return [];
  }
}

function __debugTelemetryFunnel() {
  try {
    const events = _readRawTelemetryEvents();
    const bySid = _groupBySid(events);
    const sidsAll = Array.from(bySid.keys());

    const hasEvent = (arr, name) => {
      try {
        return (arr || []).some((e) => e && typeof e === 'object' && String(e.event || '') === name);
      } catch (_) {
        return false;
      }
    };

    const sidHasShare = new Set();
    const sidHasCopy = new Set();
    const sidHasPdf = new Set();
    const sidHasAnalyze = new Set();
    const sidHasAnalyzeView = new Set();
    const sidHasGenerateView = new Set();
    const sidHasAnalyzeRun = new Set();
    const sidHasGenerateRun = new Set();

    for (const sid of sidsAll) {
      const arr = bySid.get(sid) || [];
      if (hasEvent(arr, 'share_view')) sidHasShare.add(sid);
      if (hasEvent(arr, 'share_action_copy_link')) sidHasCopy.add(sid);
      if (hasEvent(arr, 'share_action_pdf')) sidHasPdf.add(sid);
      if (hasEvent(arr, 'share_action_analyze')) sidHasAnalyze.add(sid);
      if (hasEvent(arr, 'analyze_view')) sidHasAnalyzeView.add(sid);
      if (hasEvent(arr, 'generate_view')) sidHasGenerateView.add(sid);
      if (hasEvent(arr, 'analyze_action_run')) sidHasAnalyzeRun.add(sid);
      if (hasEvent(arr, 'generate_action_run')) sidHasGenerateRun.add(sid);
    }

    const counts = _countByEvent(events);
    const views = {
      share_view: counts.share_view || 0,
      analyze_view: counts.analyze_view || 0,
      generate_view: counts.generate_view || 0,
    };
    const actions = {
      share_action_copy_link: counts.share_action_copy_link || 0,
      share_action_pdf: counts.share_action_pdf || 0,
      share_action_analyze: counts.share_action_analyze || 0,
      analyze_action_run: counts.analyze_action_run || 0,
      generate_action_run: counts.generate_action_run || 0,
    };

    const shareSessions = sidHasShare.size;
    const analyzeClickSessions = sidHasAnalyze.size;
    const funnel = [
      { metric: 'share_view sessions', value: shareSessions },
      { metric: 'copy_link sessions', value: sidHasCopy.size, rate: _pct(sidHasCopy.size, shareSessions) },
      { metric: 'pdf sessions', value: sidHasPdf.size, rate: _pct(sidHasPdf.size, shareSessions) },
      { metric: 'analyze_click sessions', value: sidHasAnalyze.size, rate: _pct(sidHasAnalyze.size, shareSessions) },
      { metric: 'analyze_run sessions', value: sidHasAnalyzeRun.size, rate: _pct(sidHasAnalyzeRun.size, shareSessions), rate_from_analyze_click: _pct(sidHasAnalyzeRun.size, analyzeClickSessions) },
      { metric: 'generate_run sessions', value: sidHasGenerateRun.size, rate: _pct(sidHasGenerateRun.size, shareSessions), rate_from_analyze_click: _pct(sidHasGenerateRun.size, analyzeClickSessions) },
    ];

    // ✅ [Phase 91-2] Latest-session outcome (representative session = latest sid by max ts)
    let latest_drop_case = '';
    let latest_human_reason = '';
    let latest_next_action_hint = '';
    try {
      let latestSid = '';
      let latestTs = -1;
      for (const sid of sidsAll) {
        const arr = bySid.get(sid) || [];
        for (const e of arr) {
          const t = (e && typeof e === 'object') ? Number(e.ts) : NaN;
          if (Number.isFinite(t) && t > latestTs) {
            latestTs = t;
            latestSid = sid;
          }
        }
      }
      const representativeEvents = latestSid ? (bySid.get(latestSid) || []) : events;
      const outcome = computeTelemetryFunnelOutcome(representativeEvents);
      latest_drop_case = String(outcome?.dominant_drop_case || '');
      latest_human_reason = String(outcome?.human_reason || '');
      latest_next_action_hint = String(outcome?.next_action_hint || '');
    } catch (e) {
      try { console.warn('[telemetry] outcome compute failed'); } catch (_) {}
    }

    // ✅ [Phase 92-1] Aggregate-session dominant outcome (by sid counts; drop-case tie-break)
    const counts_by_case = { CASE_OK: 0, CASE_A: 0, CASE_B: 0, CASE_C: 0, CASE_D: 0 };
    let dominant_drop_case = 'CASE_A';
    let human_reason = 'Analyze 진입했으나 실행하지 않음';
    let next_action_hint = 'Analyze 실행 CTA/가이드 강화';
    const dominant_basis = 'aggregate_sessions';
    let recommended_actions = [];
    let recommendation_reason = '';
    let action_checklist = [];
    let checklist_note = '';
    let top_action = null;
    let top_action_reason = '';
    try {
      for (const sid of sidsAll) {
        const arr = bySid.get(sid) || [];
        const o = computeTelemetryFunnelOutcome(arr);
        const c = String(o?.dominant_drop_case || '');
        if (Object.prototype.hasOwnProperty.call(counts_by_case, c)) counts_by_case[c] += 1;
      }

      const priority = ['CASE_D', 'CASE_C', 'CASE_B', 'CASE_A', 'CASE_OK'];
      let maxCount = -1;
      let chosen = 'CASE_A';
      for (const c of priority) {
        const n = Number(counts_by_case[c] || 0);
        if (n > maxCount) {
          maxCount = n;
          chosen = c;
        }
      }
      // If no sessions exist (all 0), keep safe defaults per spec
      if (maxCount > 0) {
        dominant_drop_case = chosen;
        if (chosen === 'CASE_OK') {
          human_reason = '완주';
          next_action_hint = '유지';
        } else if (chosen === 'CASE_A') {
          human_reason = 'Analyze 진입했으나 실행하지 않음';
          next_action_hint = 'Analyze 실행 CTA/가이드 강화';
        } else if (chosen === 'CASE_B') {
          human_reason = 'Analyze 실행 후 Generate로 이동 안 함';
          next_action_hint = 'Analyze→Generate 전환 CTA 강화/자동 이동 고려';
        } else if (chosen === 'CASE_C') {
          human_reason = 'Generate 화면은 봤으나 실행 안 함';
          next_action_hint = 'Generate 실행 버튼 가시성/마찰 감소';
        } else if (chosen === 'CASE_D') {
          human_reason = 'Generate 실행 후 Share로 돌아오지 않음';
          next_action_hint = 'Share 복귀 유도(리포트 보기/자동 리다이렉트) 강화';
        }
      }
    } catch (e) {
      try { console.warn('[telemetry] outcome aggregate failed'); } catch (_) {}
    }

    // ✅ [Phase 93-1] Dev-only recommended UX actions (pure rules; no UI/track/store changes)
    try {
      const rec = buildFunnelRecommendedActions({
        dominant_drop_case,
        counts_by_case,
        totals: { sessions: sidsAll.length },
      });
      recommended_actions = Array.isArray(rec?.recommended_actions) ? rec.recommended_actions : [];
      recommendation_reason = String(rec?.recommendation_reason || '');
    } catch (_) {
      recommended_actions = [
        'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
        '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
      ];
      recommendation_reason = 'Analyze 진입 대비 실행 비율이 낮습니다.';
    }

    // ✅ [Phase 94-1] Dev-only action checklist (pure rules; no UI/track/store changes)
    try {
      const checklist = buildFunnelActionChecklist({
        dominant_drop_case,
        counts_by_case,
        totals: { sessions: shareSessions },
      });
      action_checklist = Array.isArray(checklist?.action_checklist) ? checklist.action_checklist : [];
      checklist_note = String(checklist?.checklist_note || '');
    } catch (_) {
      action_checklist = [];
      checklist_note = '';
    }

    // ✅ [Phase 95-1] Dev-only Top-1 action (derived from checklist; no UI/track/store changes)
    try {
      const top = pickTopActionFromChecklist({ action_checklist, dominant_drop_case });
      top_action = top?.top_action || null;
      top_action_reason = String(top?.top_action_reason || '');
    } catch (_) {
      top_action = null;
      top_action_reason = '';
    }

    console.groupCollapsed('[telemetry] funnel summary');
    console.table([{ kind: 'views', ...views }]);
    console.table([{ kind: 'actions', ...actions }]);
    console.table(funnel);
    try {
      console.table([{
        kind: 'recommended_actions',
        recommendation_reason,
        recommended_actions: (Array.isArray(recommended_actions) ? recommended_actions : []).join(' | '),
      }]);
    } catch (_) {}
    console.groupEnd();

    const sessions = sidsAll.length;
    const afterSnapshot = {
      totals: { sessions },
      counts_by_case
    };

    const beforeSnapshot = _lsGetJSON(BEFORE_KEY);

    let improvement_snapshot;

    if (!beforeSnapshot) {
      _lsSetJSON(BEFORE_KEY, afterSnapshot);
      improvement_snapshot = {
        comparable: false,
        improved: false,
        summary: "Baseline saved (before). Re-run to compare.",
        notes: ["baseline_saved"]
      };
    } else {
      improvement_snapshot = compareFunnelSnapshots(
        beforeSnapshot,
        afterSnapshot
      );
    }

    return {
      views,
      actions,
      funnel,
      dominant_drop_case,
      human_reason,
      next_action_hint,
      recommended_actions,
      recommendation_reason,
      action_checklist,
      checklist_note,
      top_action,
      top_action_reason,
      dominant_basis,
      counts_by_case,
      latest_drop_case,
      latest_human_reason,
      latest_next_action_hint,
      improvement_snapshot
    };
  } catch (_) {
    return {
      views: {},
      actions: {},
      funnel: [],
      dominant_drop_case: 'CASE_A',
      human_reason: 'Analyze 진입했으나 실행하지 않음',
      next_action_hint: 'Analyze 실행 CTA/가이드 강화',
      recommended_actions: [
        'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
        '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
      ],
      recommendation_reason: 'Analyze 진입 대비 실행 비율이 낮습니다.',
      action_checklist: [],
      checklist_note: '',
      top_action: null,
      top_action_reason: '',
      dominant_basis: 'aggregate_sessions',
      counts_by_case: { CASE_OK: 0, CASE_A: 0, CASE_B: 0, CASE_C: 0, CASE_D: 0 },
      latest_drop_case: '',
      latest_human_reason: '',
      latest_next_action_hint: '',
      improvement_snapshot: {
        comparable: false,
        improved: false,
        summary: "Not comparable: error",
        notes: ["error"]
      }
    };
  }
}

// Attach only for share.html?debug=1
try {
  if (typeof window !== 'undefined' && _isShareDebugOn()) {
    if (typeof window.__debugTelemetryLast !== 'function') window.__debugTelemetryLast = __debugTelemetryLast;
    if (typeof window.__debugTelemetryFunnel !== 'function') window.__debugTelemetryFunnel = __debugTelemetryFunnel;
  }
} catch (_) {}

// === DEBUG HELPERS ATTACH (Share only; debug=1) ==========
export function __attachTelemetryDebugHelpers() {
  try {
    if (typeof window === 'undefined') return;

    const p = new URLSearchParams(location.search);
    if (p.get('debug') !== '1') return;
    const isShare = String(location.pathname || '').endsWith('/share.html') || String(location.pathname || '') === '/share.html';
    if (!isShare) return;

    if (window.__telemetryDebugAttached) return;
    window.__telemetryDebugAttached = true;

    // Attach only when helpers exist
    if (typeof __debugTelemetryLast === 'function') window.__debugTelemetryLast = __debugTelemetryLast;
    if (typeof __debugTelemetryFunnel === 'function') window.__debugTelemetryFunnel = __debugTelemetryFunnel;
    // aliases (guard against user typos)
    if (typeof __debugTelemetryLast === 'function') window._debugTelemetryLast = __debugTelemetryLast;
    if (typeof __debugTelemetryFunnel === 'function') window._debugTelemetryFunnel = __debugTelemetryFunnel;

    console.info('[telemetry] debug helpers attached');
  } catch (_) {}
}

// --- Phase 90 debug helpers: attach once on module load (Share only; debug=1; fail-quiet)
function isDebugMode() {
  try {
    const p = new URLSearchParams(location.search || '');
    return p.get('debug') === '1';
  } catch (_) {
    return false;
  }
}

function _isSharePage() {
  try {
    const path = String(location.pathname || '');
    return path.endsWith('/share.html') || path === '/share.html';
  } catch (_) {
    return false;
  }
}

function attachTelemetryDebugHelpersOnce() {
  try {
    if (typeof window === 'undefined') return;
    if (!isDebugMode()) return;
    if (!_isSharePage()) return;
    if (window.__telemetryDebugAttached) return;
    __attachTelemetryDebugHelpers();
  } catch (_) {}
}

try { attachTelemetryDebugHelpersOnce(); } catch (_) {}

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



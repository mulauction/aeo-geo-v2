// core/shareTelemetryUI.js
// UI-only renderer for Share telemetry debug card.
// Hard rules:
// - dev-only + debug-only: never render or fetch outside shouldRenderTelemetryLocal()
// - Read-only rendering
// - No telemetry mutation / no storage mutation (local summary fetch is best-effort)
// - Never throw

function isDebugEnabled() {
  try {
    if (typeof location === 'undefined') return false;
    return new URLSearchParams(location.search || '').get('debug') === '1';
  } catch (_) {
    return false;
  }
}

function isDevHost() {
  try {
    if (typeof location === 'undefined') return false;
    const hostname = String(location.hostname || '').toLowerCase();
    const port = String(location.port || '');
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || port === '5502';
  } catch (_) {
    return false;
  }
}

function shouldRenderTelemetryLocal() {
  try {
    return isDebugEnabled() && isDevHost();
  } catch (_) {
    return false;
  }
}

async function fetchTelemetrySummaryLatest() {
  try {
    // dev-only safety: never fetch unless explicitly enabled
    if (!shouldRenderTelemetryLocal()) return null;
    if (typeof fetch !== 'function') return null;

    async function tryFetch(url) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res || !res.ok) return null;
        const data = await res.json();
        return (data && typeof data === 'object') ? data : null;
      } catch (_) {
        return null;
      }
    }

    // Policy fixed (Phase 36-3): dev-only endpoint (no same-origin fallback)
    return await tryFetch('http://localhost:3001/api/telemetry/summary/latest');
  } catch (_) {
    return null;
  }
}

export function renderTelemetrySummaryCard({ container, meta } = {}) {
  try {
    if (!container) return;
    container.innerHTML = '';

    const m = (meta && typeof meta === 'object') ? meta : null;
    const safeStr = (v) => {
      try { return (v === null || typeof v === 'undefined') ? '' : String(v); } catch (_) { return ''; }
    };
    const fmtPct = (v) => {
      try {
        const n = Number(v);
        if (!Number.isFinite(n)) return '';
        return `${(n * 100).toFixed(1)}%`;
      } catch (_) { return ''; }
    };

    const total = m ? safeStr(m.total) : '';
    const okRate = m ? fmtPct(m.okRate) : '';
    const genAt = m ? safeStr(m.generatedAt) : '';

    const dropToFail = m && m.dropOffTopToFetchFail ? m.dropOffTopToFetchFail : null;
    const dropOverall = m && m.dropOffTopOverall ? m.dropOffTopOverall : null;

    const matrix = m ? m.transitionMatrix : null;
    const matrixJson = (matrix && typeof matrix === 'object')
      ? JSON.stringify(matrix, null, 2)
      : '';

    const dropToFailText = dropToFail
      ? `${safeStr(dropToFail.preState)} -> ${safeStr(dropToFail.finalState)} = ${safeStr(dropToFail.count)}`
      : 'none';
    const dropOverallText = dropOverall
      ? `${safeStr(dropOverall.preState)} -> ${safeStr(dropOverall.finalState)} = ${safeStr(dropOverall.count)}`
      : 'none';

    container.innerHTML = `
      <section role="note" aria-label="Telemetry summary (debug)" style="margin: 16px 0; padding: 14px 16px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap;">
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">Telemetry 요약 (debug)</div>
          <div style="font-size: 11px; color: #64748b;">generatedAt: ${safeStr(genAt)}</div>
        </div>
        ${m ? `
          <div style="margin-top: 10px; display:flex; gap:14px; flex-wrap:wrap; font-size: 12px; color:#0f172a;">
            <div><span style="color:#64748b;">total</span> <strong>${safeStr(total)}</strong></div>
            <div><span style="color:#64748b;">okRate</span> <strong>${safeStr(okRate)}</strong></div>
          </div>
          <div style="margin-top: 10px; font-size: 12px; color:#0f172a; line-height: 1.5;">
            <div><span style="color:#64748b;">top_transition_to_FETCH_FAIL</span>: <strong>${safeStr(dropToFailText)}</strong></div>
            <div><span style="color:#64748b;">top_transition_overall</span>: <strong>${safeStr(dropOverallText)}</strong></div>
          </div>
          <details style="margin-top: 10px;">
            <summary style="cursor:pointer; font-size: 12px; color:#0f172a; font-weight: 600;">transitionMatrix 보기</summary>
            <pre style="margin-top: 8px; padding: 10px 12px; background: #0b1220; color: #e2e8f0; border-radius: 8px; overflow:auto; font-size: 11px; line-height: 1.45;">${safeStr(matrixJson)}</pre>
          </details>
        ` : `
          <div style="margin-top: 10px; font-size: 12px; color:#64748b;">
            Telemetry meta 없음 (debug=1에서 Export JSON/CSV를 한 번 실행해 생성하세요)
          </div>
        `}
      </section>
    `;
  } catch (_) {
    // never throw
  }
}


function safeStr(v) {
  try { return (v === null || typeof v === 'undefined') ? '' : String(v); } catch (_) { return ''; }
}

function pickTopCounts(obj, n = 3) {
  try {
    if (!obj || typeof obj !== 'object') return [];
    const entries = Object.entries(obj)
      .map(([k, v]) => ({ key: safeStr(k), count: Number(v) }))
      .filter((x) => x.key && Number.isFinite(x.count) && x.count > 0)
      .sort((a, b) => (b.count - a.count));
    return entries.slice(0, n);
  } catch (_) {
    return [];
  }
}

function pickTopReasons(arr, n = 3) {
  try {
    if (!Array.isArray(arr)) return [];
    const rows = arr
      .map((r) => ({
        reason: safeStr(r && r.reason).trim(),
        count: Number(r && r.count),
      }))
      .filter((x) => x.reason && Number.isFinite(x.count) && x.count > 0)
      .sort((a, b) => (b.count - a.count));
    return rows.slice(0, n);
  } catch (_) {
    return [];
  }
}

function sumCounts(obj) {
  try {
    if (!obj || typeof obj !== 'object') return 0;
    let sum = 0;
    for (const v of Object.values(obj)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return sum;
  } catch (_) {
    return 0;
  }
}

function fmtPctFromRatio(num, den) {
  try {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return '';
    return `${((n / d) * 100).toFixed(1)}%`;
  } catch (_) {
    return '';
  }
}

function renderLocalTelemetrySection(container, summary) {
  try {
    if (!container) return;
    container.innerHTML = '';

    const s = (summary && typeof summary === 'object') ? summary : null;
    const meta = (s && s.meta && typeof s.meta === 'object') ? s.meta : null;

    const genAt = meta ? safeStr(meta.generatedAt) : '';
    const exportRecordsSeenNum = meta ? Number(meta.exportRecordsSeen) : NaN;
    const linesParsedNum = meta ? Number(meta.linesParsed) : NaN;
    const reasonCoverage = meta ? safeStr(meta.reasonCoverage) : '';

    const countsByFinalState = s ? s.countsByFinalState : null;
    const totalFromCounts = s ? sumCounts(countsByFinalState) : NaN;
    const totalEventsNum = s ? Number(s.totalEvents) : NaN;
    const total = s
      ? (Number.isFinite(totalEventsNum)
        ? totalEventsNum
        : (Number.isFinite(exportRecordsSeenNum) ? exportRecordsSeenNum : totalFromCounts))
      : NaN;
    const okCount = (s && countsByFinalState && typeof countsByFinalState === 'object')
      ? Number(countsByFinalState.OK)
      : NaN;
    const okRate = (s && Number.isFinite(okCount) && Number.isFinite(total) && total > 0)
      ? fmtPctFromRatio(okCount, total)
      : '';

    const hasAnyRawRecords = (() => {
      try {
        if (!s || !meta) return null;
        if (typeof meta.hasAnyRawRecords === 'boolean') return meta.hasAnyRawRecords;
        if (Number.isFinite(linesParsedNum)) return linesParsedNum > 0;
        return null;
      } catch (_) {
        return null;
      }
    })();

    const status = (() => {
      try {
        if (!s) return 'UNAVAILABLE';
        if (hasAnyRawRecords === true) return 'OK';
        if (hasAnyRawRecords === false) return 'EMPTY';
        // best-effort fallback when meta is missing
        if (Number.isFinite(total) && total > 0) return 'OK';
        return 'EMPTY';
      } catch (_) {
        return 'UNAVAILABLE';
      }
    })();

    const badge = (() => {
      try {
        const label = status;
        const styleByStatus = {
          OK: 'background:#dcfce7;color:#166534;border:1px solid #86efac;',
          EMPTY: 'background:#ffedd5;color:#9a3412;border:1px solid #fdba74;',
          UNAVAILABLE: 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;',
        };
        const style = styleByStatus[label] || styleByStatus.UNAVAILABLE;
        return `<span data-testid="telemetry-local-status" style="display:inline-block; margin-left:8px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 0.02em; ${style}">${safeStr(label)}</span>`;
      } catch (_) {
        return '';
      }
    })();

    const topStates = pickTopCounts(countsByFinalState, 8);
    const topReasons = pickTopReasons(s ? s.topReasons : null, 5);

    const statesHtml = topStates.length > 0
      ? `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12px; color:#0f172a;">
          ${topStates.map((x) => `<li>${safeStr(x.key)}: <strong>${safeStr(x.count)}</strong></li>`).join('')}
        </ul>`
      : `<div style="margin-top:6px; font-size: 12px; color:#64748b;">(no states)</div>`;

    const reasonsHtml = topReasons.length > 0
      ? `<ul style="margin: 6px 0 0 16px; padding: 0; font-size: 12px; color:#0f172a;">
          ${topReasons.map((x) => `<li>${safeStr(x.reason)}: <strong>${safeStr(x.count)}</strong></li>`).join('')}
        </ul>`
      : `<div style="margin-top:6px; font-size: 12px; color:#64748b;">(no reasons)</div>`;

    const summaryBits = s ? [
      (Number.isFinite(total) ? `total ${safeStr(total)}` : ''),
      (okRate ? `ok ${safeStr(okRate)}` : ''),
      (genAt ? `generatedAt ${safeStr(genAt)}` : ''),
    ].filter(Boolean) : [];
    const summaryLine = summaryBits.length > 0 ? summaryBits.join(' · ') : 'debug';

    container.innerHTML = `
      <section id="telemetry-local" data-testid="telemetry-local" class="telemetry-local" role="note" aria-label="Telemetry (local)" style="margin: 16px 0; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <details>
          <summary style="cursor:pointer; font-size: 13px; font-weight: 700; color: #0f172a;">
            Telemetry (local)${badge} <span style="font-size: 11px; font-weight: 500; color:#64748b;">— ${safeStr(summaryLine)}</span>
          </summary>
          ${s ? `
            <div style="margin-top: 10px; font-size: 12px; color:#0f172a; line-height: 1.55;">
              <div><span style="color:#64748b;">generatedAt</span>: <strong>${safeStr(genAt)}</strong></div>
              ${Number.isFinite(total) ? `<div><span style="color:#64748b;">total</span>: <strong>${safeStr(total)}</strong></div>` : ``}
              ${okRate ? `<div><span style="color:#64748b;">okRate</span>: <strong>${safeStr(okRate)}</strong></div>` : ``}
              ${Number.isFinite(linesParsedNum) ? `<div><span style="color:#64748b;">linesParsed</span>: <strong>${safeStr(linesParsedNum)}</strong></div>` : ``}
              ${Number.isFinite(exportRecordsSeenNum) ? `<div><span style="color:#64748b;">exportRecordsSeen</span>: <strong>${safeStr(exportRecordsSeenNum)}</strong></div>` : ``}
              ${reasonCoverage ? `<div><span style="color:#64748b;">reasonCoverage</span>: <strong>${safeStr(reasonCoverage)}</strong></div>` : ``}
            </div>
            <div style="margin-top: 10px;">
              <div style="font-size: 12px; font-weight: 700; color:#0f172a;">countsByFinalState</div>
              ${statesHtml}
            </div>
            <div style="margin-top: 10px;">
              <div style="font-size: 12px; font-weight: 700; color:#0f172a;">topReasons (top 5)</div>
              ${reasonsHtml}
            </div>
          ` : `
            <div style="margin-top: 10px; font-size: 12px; color:#64748b;">
              No local telemetry summary found.
            </div>
          `}
        </details>
      </section>
    `;
  } catch (_) {
    // never throw
  }
}

export async function renderTelemetryLocalSummary({ container } = {}) {
  try {
    if (!container) return;
    if (!shouldRenderTelemetryLocal()) return; // no DOM insert / no fetch unless debug=1 + dev
    const summary = await fetchTelemetrySummaryLatest();
    renderLocalTelemetrySection(container, summary);
  } catch (_) {
    // never throw
  }
}



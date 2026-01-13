// core/shareTelemetryUI.js
// UI-only renderer for Share telemetry debug card.
// Hard rules:
// - Read-only rendering
// - No telemetry mutation / no storage mutation (local summary fetch is best-effort)
// - Never throw

async function fetchTelemetrySummaryLatest() {
  try {
    if (typeof fetch !== 'function') return null;

    const isStatic5502 = (() => {
      try {
        if (typeof location === 'undefined') return false;
        return location.hostname === 'localhost' && /^(5502)$/.test(location.port || '');
      } catch (_) {
        return false;
      }
    })();

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

    // 1) Static dev server (5502): prefer dev API server (3001)
    if (isStatic5502) {
      const d = await tryFetch('http://localhost:3001/api/telemetry/summary/latest');
      if (d) return d;
    }

    // 2) Same-origin endpoint fallback
    return await tryFetch('/api/telemetry/summary/latest');
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

function renderLocalTelemetrySection(container, summary) {
  try {
    if (!container) return;
    container.innerHTML = '';

    const s = (summary && typeof summary === 'object') ? summary : null;
    const meta = (s && s.meta && typeof s.meta === 'object') ? s.meta : null;

    const genAt = meta ? safeStr(meta.generatedAt) : '';
    const mode = meta ? safeStr(meta.mode) : '';
    const sourceFile = meta ? safeStr(meta.sourceFile) : '';
    const sourcePath = meta ? safeStr(meta.sourcePath) : '';
    const exportRecordsSeen = meta ? safeStr(meta.exportRecordsSeen) : '';
    const reasonCoverage = meta ? safeStr(meta.reasonCoverage) : '';

    const topStates = pickTopCounts(s ? s.countsByFinalState : null, 3);
    const topReasons = pickTopReasons(s ? s.topReasons : null, 3);

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

    container.innerHTML = `
      <section id="telemetry-local" data-testid="telemetry-local" class="telemetry-local" role="note" aria-label="Telemetry (local)" style="margin: 16px 0; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
        <details>
          <summary style="cursor:pointer; font-size: 13px; font-weight: 700; color: #0f172a;">Telemetry (local)</summary>
          ${s ? `
            <div style="margin-top: 10px; font-size: 12px; color:#0f172a; line-height: 1.55;">
              <div><span style="color:#64748b;">generatedAt</span>: <strong>${safeStr(genAt)}</strong></div>
              ${mode ? `<div><span style="color:#64748b;">mode</span>: <strong>${safeStr(mode)}</strong></div>` : ``}
              <div><span style="color:#64748b;">sourceFile</span>: <strong>${safeStr(sourceFile)}</strong></div>
              <div><span style="color:#64748b;">sourcePath</span>: <strong>${safeStr(sourcePath)}</strong></div>
              <div><span style="color:#64748b;">exportRecordsSeen</span>: <strong>${safeStr(exportRecordsSeen)}</strong></div>
              <div><span style="color:#64748b;">reasonCoverage</span>: <strong>${safeStr(reasonCoverage)}</strong></div>
            </div>
            <div style="margin-top: 10px;">
              <div style="font-size: 12px; font-weight: 700; color:#0f172a;">countsByFinalState (top 3)</div>
              ${statesHtml}
            </div>
            <div style="margin-top: 10px;">
              <div style="font-size: 12px; font-weight: 700; color:#0f172a;">topReasons (top 3)</div>
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
    const summary = await fetchTelemetrySummaryLatest();
    renderLocalTelemetrySection(container, summary);
  } catch (_) {
    // never throw
  }
}



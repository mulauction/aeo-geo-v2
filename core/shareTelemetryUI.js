// core/shareTelemetryUI.js
// UI-only renderer for Share telemetry debug card.
// Hard rules:
// - Read-only rendering
// - No telemetry mutation / no storage / no network
// - Never throw

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



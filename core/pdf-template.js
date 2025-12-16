import { buildReportPayload } from "./report.js";
import { renderKpi, esc } from "./view.js";

/**
 * ✅ [Phase 3-2D] PDF 리포트 템플릿 생성 함수
 * Share 화면과 동일한 데이터/표시 규칙 사용
 * @returns {string} PDF용 HTML 문자열
 */
export function generatePdfTemplate() {
  const payload = buildReportPayload();
  const scores = payload.analysis?.scores || {};
  const brandingScore = scores.branding;
  const contentStructureV2Score = scores.contentStructureV2;
  const urlStructureV1Score = scores.urlStructureV1;
  
  // ✅ [Phase 3-2D] PDF 템플릿 KPI 섹션 (Share 화면과 동일한 규칙)
  const kpiSection = `
    <div style="margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; page-break-inside: avoid;">
      ${renderKpi({ label: '엔티티 점수', value: brandingScore })}
      ${renderKpi({ label: '콘텐츠 구조 점수', value: contentStructureV2Score })}
      ${(() => {
        const urlKpi = renderKpi({ label: 'URL 구조 점수', value: urlStructureV1Score });
        if (urlStructureV1Score && urlStructureV1Score.score !== null && urlStructureV1Score.score !== undefined) {
          return urlKpi.replace('</span>', ` · 연결됨</span>`);
        } else {
          return urlKpi.replace('</span>', ` · 측정 필요</span>`);
        }
      })()}
    </div>
  `;
  
  // ✅ [Phase 3-2D] 콘텐츠 구조 점수 근거 섹션 (PDF 템플릿)
  let contentStructureEvidenceSection = '';
  if (contentStructureV2Score && contentStructureV2Score.evidence && Array.isArray(contentStructureV2Score.evidence) && contentStructureV2Score.evidence.length > 0) {
    contentStructureEvidenceSection = `
      <div style="margin-bottom: 24px; page-break-inside: avoid;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px;">콘텐츠 구조 점수 근거</h3>
        <ul style="margin: 0; padding-left: 24px;">
          ${contentStructureV2Score.evidence.map(e => `<li style="margin-bottom: 4px;">${esc(e)}</li>`).join("")}
        </ul>
      </div>
    `;
  }
  
  const result = payload.result;
  let resultSection = '';
  if (result) {
    resultSection = `
      <div style="margin-bottom: 16px;">
        <h2 style="margin: 0 0 12px 0; font-size: 18px;">분석 결과</h2>
        <div><strong>${esc(result.score)}점 / ${esc(result.grade)}</strong></div>
        <p>${esc(result.summary)}</p>
        <h3 style="margin: 16px 0 8px 0; font-size: 16px;">근거</h3>
        <ul style="margin: 0; padding-left: 24px;">
          ${result.evidence.map(e => `<li style="margin-bottom: 4px;">${esc(e)}</li>`).join("")}
        </ul>
        <h3 style="margin: 16px 0 8px 0; font-size: 16px;">액션</h3>
        <ul style="margin: 0; padding-left: 24px;">
          ${result.actions.map(a => `<li style="margin-bottom: 4px;">${esc(a)}</li>`).join("")}
        </ul>
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <title>AEO/GEO v2 리포트</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .kpi-item {
          padding: 8px 12px;
          background: #f5f5f5;
          border-radius: 6px;
          border: 1px solid #ddd;
          font-size: 13px;
        }
        .kpi-item.muted {
          color: #666;
        }
        @media print {
          .kpi-section {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <h1 style="margin: 0 0 24px 0;">AEO/GEO v2 리포트</h1>
      ${kpiSection}
      ${contentStructureEvidenceSection}
      ${resultSection}
    </body>
    </html>
  `;
}


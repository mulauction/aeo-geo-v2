/**
 * ✅ [Phase 12-3] Share 페이지 WHY 패널 UI 렌더링 모듈
 * 실데이터 기반 이유 렌더링 + action line, read-only 렌더링만 담당
 */

import { buildWhyReasons, buildWhyActionLine } from './why.js';

/**
 * HTML 이스케이프 함수
 */
function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * ✅ [Phase 12-2] WHY 패널 렌더링 함수
 * @param {HTMLElement} targetEl - 렌더링할 대상 DOM 요소
 * @param {Object} reportModel - 리포트 모델 객체
 */
export function renderWhyPanel(targetEl, reportModel) {
  if (!targetEl) return;

  // buildWhyReasons로 이유 생성
  const whyResult = buildWhyReasons(reportModel || {});
  const { level, reasons } = whyResult;

  // buildWhyActionLine으로 action line 생성 (reportModel 전달하여 evidence-driven)
  const actionLine = buildWhyActionLine(whyResult, reportModel || {});

  // WHY 패널 HTML 생성 (기존 Share 카드 스타일 활용)
  let whyPanelHtml = '';
  
  if (level === 'high') {
    // high면 1줄 메시지 + actionLine 표시
    whyPanelHtml = `
      <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
        <div style="font-size: 12px; color: #555; line-height: 1.6; margin-bottom: 12px;">현재 데이터는 충분합니다</div>
        <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
      </div>
    `;
  } else {
    // 아니면 ul로 reasons 렌더 + actionLine 표시
    if (reasons.length === 0) {
      // reasons가 비어있으면 기본 메시지 표시 + actionLine
      whyPanelHtml = `
        <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
          <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
          <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
            <li style="margin-bottom: 6px;">측정 데이터가 부족합니다</li>
          </ul>
          <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
        </div>
      `;
    } else {
      whyPanelHtml = `
        <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
          <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
          <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
            ${reasons.map(reason => `<li style="margin-bottom: 6px;">${esc(reason.detail)}</li>`).join('')}
          </ul>
          <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
        </div>
      `;
    }
  }

  // targetEl에 렌더링
  targetEl.innerHTML = whyPanelHtml;
}


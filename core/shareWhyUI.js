/**
 * ✅ [Phase 12-3] Share 페이지 WHY 패널 UI 렌더링 모듈
 * ✅ [Phase 20-C] WHY는 읽기 전용 (재계산 금지)
 * 저장된 why 데이터만 읽어서 렌더링
 */

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
 * ✅ [Phase 20-C] WHY는 읽기 전용 (재계산 금지)
 * @param {HTMLElement} targetEl - 렌더링할 대상 DOM 요소
 * @param {Object} reportModel - 리포트 모델 객체
 */
export function renderWhyPanel(targetEl, reportModel) {
  if (!targetEl) return;

  // ✅ [Phase 20-C] 저장된 why만 읽기 (재계산 금지)
  const why = reportModel?.why || reportModel?.analysis?.why || null;
  
  // why가 없거나 유효하지 않으면 fallback 표시
  if (!why || typeof why !== 'object') {
    const fallbackHtml = `
      <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
        <div style="font-size: 12px; color: #555; line-height: 1.6;">WHY 분석 정보가 없습니다. Analyze 화면에서 분석을 실행하세요.</div>
      </div>
    `;
    targetEl.innerHTML = fallbackHtml;
    return;
  }

  // ✅ [Phase 20-C] reasons 배열 검증 (방어적 처리)
  const reasonsArray = Array.isArray(why.reasons) ? why.reasons : [];
  const actionLine = why.actionLine || '추천: 리포트를 갱신하세요.';

  // WHY 패널 HTML 생성 (기존 Share 카드 스타일 활용)
  let whyPanelHtml = '';
  
  if (reasonsArray.length === 0) {
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
    // reasons 배열 렌더링
    // reasons 배열의 각 항목이 객체인지 문자열인지 확인
    const reasonsHtml = reasonsArray.map(reason => {
      if (typeof reason === 'string') {
        return `<li style="margin-bottom: 6px;">${esc(reason)}</li>`;
      } else if (reason && typeof reason === 'object') {
        // reason 객체에서 detail 또는 title 필드 사용
        const text = reason.detail || reason.title || JSON.stringify(reason);
        return `<li style="margin-bottom: 6px;">${esc(text)}</li>`;
      } else {
        return `<li style="margin-bottom: 6px;">${esc(String(reason))}</li>`;
      }
    }).join('');
    
    whyPanelHtml = `
      <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
        <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
          ${reasonsHtml}
        </ul>
        <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
      </div>
    `;
  }

  // targetEl에 렌더링
  targetEl.innerHTML = whyPanelHtml;
}


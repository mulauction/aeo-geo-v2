/**
 * ✅ [Phase 8-3] Share 페이지 신뢰도 UI 렌더링 모듈
 * HTML 생성 및 이벤트 바인딩 담당
 */

import { computeReliabilityV2 } from './reliability.js';

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
 * ✅ [Phase 8-3] 신뢰도 블록 렌더링
 * @param {Object} reportModel - 리포트 모델 객체
 * @param {Object} options - 옵션 객체 (현재 사용 안 함)
 * @returns {Object} { html: string, bind: (rootEl)=>void }
 */
export function renderReliabilityBlock(reportModel, options = {}) {
  // 신뢰도 계산
  const reliability = computeReliabilityV2(reportModel);
  
  // 신뢰도 배지 HTML 생성
  const reliabilityBadge = `
    <div class="reliability-container">
      <div class="reliability-badge" title="측정 필요 항목이 많을수록 신뢰도는 낮게 표시됩니다.">
        신뢰도: ${esc(reliability.level)}
      </div>
      <div class="reliability-reason">${reliability.reasonText}</div>
    </div>
  `;
  
  // HTML 반환
  const html = reliabilityBadge;
  
  // 이벤트 바인딩 함수 (현재 신뢰도 배지는 토글이 없으므로 빈 함수)
  const bind = (rootEl) => {
    // 현재 신뢰도 배지에는 토글 기능이 없으므로 이벤트 바인딩 없음
    // 향후 "근거 보기" 버튼이 추가되면 여기에 토글 이벤트 핸들러 추가
  };
  
  return { html, bind };
}

/**
 * ✅ 신뢰도 배지 렌더링 함수
 * el이 null이면 조용히 return
 * 배지 DOM은 el 내부만 채운다 (기존 KPI/증거 DOM을 건드리지 않음)
 * @param {HTMLElement|null} el - 배지를 렌더링할 DOM 요소
 * @param {Object} rel - 신뢰도 계산 결과 { level, label, reasons }
 */
export function renderReliabilityBadge(el, rel) {
  // el이 null이면 조용히 return
  if (!el) {
    return;
  }

  // rel이 없거나 유효하지 않으면 기본값 사용
  const reliability = rel || {
    level: 'unknown',
    label: '측정 필요',
    reasons: []
  };

  // 배지 HTML 생성
  const badgeHtml = `
    <div class="reliability-badge">
      신뢰도: ${esc(reliability.label || reliability.level || '측정 필요')}
    </div>
  `;

  // el 내부만 채우기 (기존 내용은 유지하지 않고 교체)
  el.innerHTML = badgeHtml;
}


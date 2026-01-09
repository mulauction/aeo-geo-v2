/**
 * ✅ [Phase 12-3] Share 페이지 WHY 패널 UI 렌더링 모듈
 * 실데이터 기반 이유 렌더링 + action line, read-only 렌더링만 담당
 */

import { buildWhyReasons, buildWhyActionLine } from './why.js';
import { buildWhyContract } from './whyContract.js';

/**
 * HTML 이스케이프 함수
 */
function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// ✅ [Phase21] Debug 로그 플래그 (1회만 출력)
let __whyContractDebugLogged = false;

/**
 * ✅ [Phase 12-2] WHY 패널 렌더링 함수
 * @param {HTMLElement} targetEl - 렌더링할 대상 DOM 요소
 * @param {Object} reportModel - 리포트 모델 객체
 */
export function renderWhyPanel(targetEl, reportModel) {
  if (!targetEl) return;

  // ✅ [Phase21] Contract adapter 우선 시도, 실패 시 기존 로직 fallback
  let contractResult = null;
  try {
    contractResult = buildWhyContract(reportModel || {});
    
    // ✅ [Phase21] Debug 로그 (스파이크용, 1회만)
    if (!__whyContractDebugLogged && contractResult) {
      console.log('[whyContract] Debug:', {
        reasons: contractResult.reasons,
        actionLine: contractResult.actionLine,
        confidence: contractResult.confidence
      });
      __whyContractDebugLogged = true;
    }
  } catch (e) {
    // Contract adapter 실패 시 기존 로직 사용
    console.warn('[shareWhyUI] Contract adapter failed, using fallback:', e);
  }

  let level, reasons, actionLine;

  if (contractResult && contractResult.reasons && contractResult.actionLine && contractResult.confidence) {
    // Contract adapter 결과 사용
    const confidence = contractResult.confidence;
    // confidence를 level로 매핑 (high->high, medium->mid, low->low)
    level = confidence === 'medium' ? 'mid' : confidence;
    reasons = contractResult.reasons.map(r => ({
      key: r.id,
      title: r.title,
      detail: r.detail || r.title
    }));
    actionLine = contractResult.actionLine;
  } else {
    // 기존 로직 fallback
    const whyResult = buildWhyReasons(reportModel || {});
    level = whyResult.level;
    reasons = whyResult.reasons;
    actionLine = buildWhyActionLine(whyResult, reportModel || {});
  }
  
  // ✅ [Phase21] reasons 최소 1개 보장 (데이터 없을 때도 항상 보이도록)
  if (!reasons || reasons.length === 0) {
    reasons = [{
      key: 'insufficient_data',
      title: '데이터 부족',
      detail: '근거가 부족해 추가 측정이 필요합니다'
    }];
  }

  // ✅ [Phase21] share.html의 .why-panel[data-why="ok"] 요소 찾기
  const okWhyPanel = document.querySelector('.why-panel[data-why="ok"]');
  
  if (okWhyPanel) {
    // 요소가 있으면 그 안에 렌더링 + display 해제
    okWhyPanel.style.display = 'block';
    
    // WHY 패널 내용 HTML 생성
    let whyContentHtml = '';
    
    if (level === 'high') {
      // high면 1줄 메시지 + actionLine 표시
      whyContentHtml = `
        <div style="font-size: 12px; color: #555; line-height: 1.6; margin-bottom: 12px;">현재 데이터는 충분합니다</div>
        <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
      `;
    } else {
      // ul로 reasons 렌더 + actionLine 표시
      whyContentHtml = `
        <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
          ${reasons.map(reason => `<li style="margin-bottom: 6px;">${esc(reason.detail)}</li>`).join('')}
        </ul>
        <p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>
      `;
    }
    
    // 기존 내용 제거 후 새 내용 삽입 (WHY 헤더는 유지)
    const existingHeader = okWhyPanel.querySelector('div[style*="font-size: 13px"]');
    if (existingHeader) {
      // 헤더 다음부터 내용 교체
      let nextSibling = existingHeader.nextSibling;
      while (nextSibling) {
        const toRemove = nextSibling;
        nextSibling = nextSibling.nextSibling;
        okWhyPanel.removeChild(toRemove);
      }
      // 새 내용 삽입
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = whyContentHtml;
      while (tempDiv.firstChild) {
        okWhyPanel.appendChild(tempDiv.firstChild);
      }
    } else {
      // 헤더가 없으면 전체 교체
      okWhyPanel.innerHTML = `
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">WHY</div>
        ${whyContentHtml}
      `;
    }
  } else {
    // 요소가 없으면 기존 방식(innerHTML) fallback
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
      // ul로 reasons 렌더 + actionLine 표시
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
    
    // targetEl에 렌더링
    targetEl.innerHTML = whyPanelHtml;
  }
}


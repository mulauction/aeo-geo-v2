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

/**
 * ✅ [Phase 12-2] WHY 패널 렌더링 함수
 * @param {HTMLElement} targetEl - 렌더링할 대상 DOM 요소 (fallback용)
 * @param {Object} reportModel - 리포트 모델 객체
 */
export function renderWhyPanel(targetEl, reportModel) {
  if (!targetEl) return;

  // ✅ [Phase22-UX] viewState 읽기 (window.__shareViewState에서)
  const viewState = typeof window !== 'undefined' ? (window.__shareViewState || 'OK') : 'OK';

  // ✅ [Phase22-UX] Hide WHY panel when viewState is NOT 'OK'
  if (viewState !== 'OK') {
    const okWhyPanel = document.querySelector('.why-panel[data-why="ok"]');
    if (okWhyPanel) {
      okWhyPanel.style.display = 'none';
      okWhyPanel.innerHTML = '';
    }
    return;
  }

  // ✅ [Phase22] Contract adapter 우선 시도, 실패 시 기존 로직 fallback
  let contractResult = null;
  try {
    contractResult = buildWhyContract(reportModel || {});
  } catch (e) {
    // Contract adapter 실패 시 기존 로직 사용
    if (typeof window !== 'undefined' && window.__WHY_DEBUG__) {
      console.warn('[shareWhyUI] Contract adapter failed, using fallback:', e);
    }
  }

  let level, reasons, actionLine, confidence;

  if (contractResult && contractResult.reasons && contractResult.actionLine && contractResult.confidence) {
    // Contract adapter 결과 사용
    confidence = contractResult.confidence;
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
    confidence = level === 'mid' ? 'medium' : level;
  }
  
  // ✅ [Phase22] reasons 최소 1개 보장 (데이터 없을 때도 항상 보이도록)
  if (!reasons || reasons.length === 0) {
    reasons = [{
      key: 'insufficient_data',
      title: '데이터 부족',
      detail: '근거가 부족해 추가 측정이 필요합니다'
    }];
  }
  
  // ✅ [Phase22-UX] viewState별 문구 및 스타일 결정
  let whyHeaderText = 'WHY';
  let whyIntroText = '';
  let confidenceBadge = '';
  
  if (viewState === 'OK') {
    // OK: 개선 이유 중심
    whyHeaderText = '개선이 필요한 이유';
    if (confidence === 'high') {
      whyIntroText = '현재 데이터는 충분합니다. 아래 항목을 유지하세요.';
      confidenceBadge = '<span style="display: inline-block; padding: 2px 8px; margin-left: 8px; font-size: 11px; background: #d4edda; color: #155724; border-radius: 3px; font-weight: 500;">높음</span>';
    } else if (confidence === 'medium') {
      whyIntroText = '일부 측정이 완료되었습니다. 아래 항목을 확인하세요.';
      confidenceBadge = '<span style="display: inline-block; padding: 2px 8px; margin-left: 8px; font-size: 11px; background: #fff3cd; color: #856404; border-radius: 3px; font-weight: 500;">보통</span>';
    } else {
      whyIntroText = '측정이 필요한 항목이 있습니다. 아래를 확인하세요.';
      confidenceBadge = '<span style="display: inline-block; padding: 2px 8px; margin-left: 8px; font-size: 11px; background: #f8d7da; color: #721c24; border-radius: 3px; font-weight: 500;">낮음</span>';
    }
  } else if (viewState === 'EXPIRED') {
    // EXPIRED: 접근 제한 사유 중심
    whyHeaderText = '접근 제한 사유';
    whyIntroText = '이 링크로는 리포트를 열 수 없습니다.';
    reasons = [{
      key: 'expired_access',
      title: '링크 만료',
      detail: '이 링크에 연결된 리포트 데이터가 현재 브라우저에 없습니다.'
    }];
    actionLine = '홈에서 다시 분석하시면 최신 리포트를 확인할 수 있습니다.';
  } else if (viewState === 'OTHER_DEVICE') {
    // OTHER_DEVICE: 기기 제한 안내 중심
    whyHeaderText = '기기 제한 안내';
    whyIntroText = '다른 기기에서 생성된 최신 리포트가 있습니다.';
    reasons = [{
      key: 'other_device',
      title: '기기 불일치',
      detail: '현재 브라우저에서 생성된 최신 리포트를 보거나 홈으로 이동할 수 있습니다.'
    }];
    actionLine = '최신 리포트를 보거나 홈으로 이동하세요.';
  } else if (viewState === 'NO_REPORT') {
    // NO_REPORT: 데이터 없음 안내 중심
    whyHeaderText = '데이터 없음 안내';
    whyIntroText = '공유할 리포트가 없습니다.';
    reasons = [{
      key: 'no_report',
      title: '리포트 없음',
      detail: '현재 기기에는 공유할 리포트가 없습니다. 홈에서 분석을 실행해 주세요.'
    }];
    actionLine = '홈에서 분석을 실행하여 리포트를 생성하세요.';
  }

  // ✅ [Phase22-UX] actionLine 개선: "다음 행동"이 더 명확히 느껴지도록 문장 개선
  if (actionLine) {
    // "추천:" 접두사를 "다음 행동:"으로 변경하여 더 명확하게
    if (actionLine.startsWith('추천: ')) {
      actionLine = actionLine.replace(/^추천: /, '다음 행동: ');
    } else if (actionLine.startsWith('추천:')) {
      actionLine = actionLine.replace(/^추천:/, '다음 행동:');
    }
    // "현재 데이터는 충분합니다" 같은 설명문은 그대로 유지
    // 동사로 시작하는 문장에만 "다음 행동:" 접두사 추가 (없는 경우만)
    if (!actionLine.match(/^(다음 행동|현재 데이터|홈에서|이 링크|최신 리포트)/)) {
      // 동사로 시작하는 문장인지 확인 (입력하세요, 실행하세요, 확인하세요 등)
      if (actionLine.match(/^(입력|실행|확인|추가|보강|갱신|이동|보기)/)) {
        actionLine = `다음 행동: ${actionLine}`;
      }
    }
  }
  
  // ✅ [Phase22] share.html의 .why-panel[data-why="ok"] 요소 찾기
  const okWhyPanel = document.querySelector('.why-panel[data-why="ok"]');
  
  if (okWhyPanel) {
    // 요소가 있으면 그 안에 렌더링 + display 해제
    okWhyPanel.style.display = 'block';
    
    // ✅ [Phase22-UX] WHY 패널 내용 HTML 생성 (viewState별 스타일 적용)
    let whyContentHtml = '';
    
    // Intro 텍스트가 있으면 표시
    if (whyIntroText) {
      whyContentHtml += `<div style="font-size: 12px; color: #555; line-height: 1.6; margin-bottom: 12px;">${esc(whyIntroText)}</div>`;
    }
    
    // reasons 렌더링
    if (reasons && reasons.length > 0) {
      whyContentHtml += `
        <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
          ${reasons.map(reason => `<li style="margin-bottom: 6px;">${esc(reason.detail)}</li>`).join('')}
        </ul>
      `;
    }
    
    // Action line 표시
    if (actionLine) {
      whyContentHtml += `<p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>`;
    }
    
    // 기존 내용 제거 후 새 내용 삽입 (WHY 헤더는 유지)
    const existingHeader = okWhyPanel.querySelector('div[style*="font-size: 13px"]');
    if (existingHeader) {
      // 헤더 업데이트 (confidence badge 포함)
      existingHeader.innerHTML = `${esc(whyHeaderText)}${confidenceBadge}`;
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
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">${esc(whyHeaderText)}${confidenceBadge}</div>
        ${whyContentHtml}
      `;
    }
  } else {
    // 요소가 없으면 기존 방식(innerHTML) fallback
    let whyPanelHtml = '';
    
    // Intro 텍스트가 있으면 표시
    if (whyIntroText) {
      whyPanelHtml += `<div style="font-size: 12px; color: #555; line-height: 1.6; margin-bottom: 12px;">${esc(whyIntroText)}</div>`;
    }
    
    // reasons 렌더링
    if (reasons && reasons.length > 0) {
      whyPanelHtml += `
        <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 12px; color: #555; line-height: 1.6;">
          ${reasons.map(reason => `<li style="margin-bottom: 6px;">${esc(reason.detail)}</li>`).join('')}
        </ul>
      `;
    }
    
    // Action line 표시
    if (actionLine) {
      whyPanelHtml += `<p style="margin: 0; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #0066cc; font-weight: 500;">${esc(actionLine)}</p>`;
    }
    
    // 전체 패널 HTML 생성
    const fullPanelHtml = `
      <div class="why-panel" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px;">${esc(whyHeaderText)}${confidenceBadge}</div>
        ${whyPanelHtml}
      </div>
    `;
    
    // targetEl에 렌더링
    targetEl.innerHTML = fullPanelHtml;
  }
}


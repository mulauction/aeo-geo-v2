/**
 * ✅ [Phase 8-3] 신뢰도 계산 모듈
 * 순수 계산 함수만 포함 (DOM 접근/이벤트/localStorage 접근 금지)
 */

/**
 * ✅ [Phase 8-2A/8-2B] 신뢰도 계산 (evidence 기반 규칙 고정)
 * @param {Object} reportModel - 리포트 모델 객체
 * @param {Object} opts - 옵션 객체 (현재 사용 안 함)
 * @returns {Object} 신뢰도 계산 결과 { level, reasonText, brandStatus, contentStatus, urlStatus, missingItems, missingCount }
 */
export function computeReliabilityV2(reportModel, opts = {}) {
  const scores = reportModel?.analysis?.scores || {};
  const brandingScore = scores.branding;
  const contentStructureV2Score = scores.contentStructureV2;
  const urlStructureV1Score = scores.urlStructureV1;
  
  // ✅ [Phase 8-2A/8-2B] 신뢰도 계산 (evidence 기반 규칙 고정)
  const isMeasured = (value) => {
    if (value === null || value === undefined) return false;
    const score = value.score;
    return score !== null && score !== undefined && !isNaN(score) && isFinite(score);
  };
  
  const hasEvidence = contentStructureV2Score && 
    contentStructureV2Score.evidence && 
    Array.isArray(contentStructureV2Score.evidence) && 
    contentStructureV2Score.evidence.length > 0;
  
  const isDummyState = !hasEvidence && 
    !isMeasured(brandingScore) && 
    !isMeasured(contentStructureV2Score) && 
    !isMeasured(urlStructureV1Score);
  
  // ✅ [Phase 8-2B] 측정 상태 추적
  const brandStatus = isMeasured(brandingScore) ? '측정됨' : '미측정';
  const contentStatus = isMeasured(contentStructureV2Score) ? '측정됨' : '미측정';
  const urlStatus = isMeasured(urlStructureV1Score) ? '측정됨' : '미측정';
  
  const missingItems = [];
  if (!isMeasured(brandingScore)) missingItems.push('BRAND');
  if (!isMeasured(contentStructureV2Score)) missingItems.push('CONTENT');
  if (!isMeasured(urlStructureV1Score)) missingItems.push('URL');
  const missingCount = missingItems.length;
  
  // ✅ [Phase 8-2B] 신뢰도 레벨 결정 (evidence 기반 규칙)
  let reliabilityLevel = '높음';
  if (!hasEvidence || isDummyState) {
    reliabilityLevel = '낮음';
  } else if (missingCount >= 1) {
    reliabilityLevel = missingCount >= 2 ? '낮음' : '보통';
  }
  
  // ✅ [Phase 8-2B] Reason line 생성 ("BRAND 미측정 · CONTENT 측정됨 · URL 측정됨" 형태)
  const reasonText = `BRAND ${brandStatus} · CONTENT ${contentStatus} · URL ${urlStatus}`;
  
  return {
    level: reliabilityLevel,
    reasonText: reasonText,
    brandStatus: brandStatus,
    contentStatus: contentStatus,
    urlStatus: urlStatus,
    missingItems: missingItems,
    missingCount: missingCount
  };
}


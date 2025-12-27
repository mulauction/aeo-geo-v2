/**
 * ✅ [Phase 8-3] 신뢰도 계산 모듈
 * 순수 계산 함수만 포함 (DOM 접근/이벤트/localStorage 접근 금지)
 */

/**
 * ✅ [Phase 8-3A-1] 측정값이 실측 상태인지 엄격히 판정
 * null/undefined/"측정 필요"/더미 플래그/NaN은 실측 아님
 * @param {Object} value - 점수 객체
 * @returns {boolean} 실측 여부
 */
function isStrictlyMeasured(value) {
  if (value === null || value === undefined) return false;
  const score = value.score;
  return score !== null && score !== undefined && !isNaN(score) && isFinite(score);
}

/**
 * ✅ [Phase 8-3A-1] 점수가 최소 기준(threshold)을 충족하는지 확인
 * 기존 코드에서 점수가 0 이상이면 유효한 것으로 간주하므로, 0 이상이면 기준 충족
 * @param {Object} value - 점수 객체
 * @returns {boolean} 최소 기준 충족 여부
 */
function meetsMinimumThreshold(value) {
  if (!isStrictlyMeasured(value)) return false;
  const score = value.score;
  // 점수가 0 이상이면 최소 기준 충족 (기존 코드의 isMeasured 로직 재사용)
  return score >= 0;
}

/**
 * ✅ [Phase 8-3A-1] '높음' 신뢰도 Gate 함수
 * - measured 3개(branding/contentStructureV2/urlStructureV1)가 모두 "실측" 상태일 때만 '높음' 가능
 * - 각 점수가 최소 기준(threshold)을 충족해야만 '높음'
 * - 더미/미측정/null/NaN/측정 필요 상태가 하나라도 섞이면 '높음'은 절대 불가
 * @param {Object} param0 - { brandingScore, contentStructureV2Score, urlStructureV1Score, hasEvidence }
 * @returns {boolean} '높음' 신뢰도 가능 여부
 */
function canBeHighReliability({ brandingScore, contentStructureV2Score, urlStructureV1Score, hasEvidence }) {
  // Evidence가 없으면 '높음' 불가
  if (!hasEvidence) return false;
  
  // 3개 항목 모두 실측 상태인지 엄격히 판정
  const brandMeasured = isStrictlyMeasured(brandingScore);
  const contentMeasured = isStrictlyMeasured(contentStructureV2Score);
  const urlMeasured = isStrictlyMeasured(urlStructureV1Score);
  
  if (!brandMeasured || !contentMeasured || !urlMeasured) {
    return false;
  }
  
  // 각 점수가 최소 기준을 충족하는지 확인
  const brandMeetsThreshold = meetsMinimumThreshold(brandingScore);
  const contentMeetsThreshold = meetsMinimumThreshold(contentStructureV2Score);
  const urlMeetsThreshold = meetsMinimumThreshold(urlStructureV1Score);
  
  if (!brandMeetsThreshold || !contentMeetsThreshold || !urlMeetsThreshold) {
    return false;
  }
  
  return true;
}

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
  
  // ✅ [Phase 8-3A-1] 신뢰도 레벨 결정 (evidence 기반 규칙 + '높음' Gate 강화)
  // '높음' Gate 통과 여부 확인 (가장 먼저 확인)
  const canBeHigh = canBeHighReliability({
    brandingScore,
    contentStructureV2Score,
    urlStructureV1Score,
    hasEvidence
  });
  
  let reliabilityLevel;
  
  if (!canBeHigh) {
    // '높음' Gate를 통과하지 못하면 어떤 경우에도 '높음' 불가
    if (!hasEvidence || isDummyState) {
      reliabilityLevel = '낮음';
    } else if (missingCount >= 1) {
      reliabilityLevel = missingCount >= 2 ? '낮음' : '보통';
    } else {
      // 측정은 되었지만 Gate를 통과하지 못한 경우 (예: 최소 기준 미충족)
      reliabilityLevel = '보통';
    }
  } else {
    // '높음' Gate를 통과한 경우: 3개 모두 실측 + 최소 기준 충족
    // canBeHigh가 true면 missingCount는 항상 0이어야 하므로 '높음' 가능
    reliabilityLevel = '높음';
  }
  
  // ✅ [Phase 8-2B] Reason line 생성 ("BRAND 미측정 · CONTENT 측정됨 · URL 측정됨" 형태)
  // ✅ [Phase 8-3A-1] reason 문구 명확화: "3개 항목 모두 측정 + 최소 기준 충족 시에만 '높음' 가능"
  let reasonText = `BRAND ${brandStatus} · CONTENT ${contentStatus} · URL ${urlStatus}`;
  if (reliabilityLevel === '높음') {
    // '높음'인 경우: 3개 항목 모두 측정 + 최소 기준 충족
    reasonText += ' · 3개 항목 모두 측정 + 최소 기준 충족';
  } else if (!canBeHigh) {
    // Gate를 통과하지 못한 경우: 미측정/더미/최소 기준 미충족
    if (missingCount > 0) {
      // 미측정 항목이 있는 경우는 이미 brandStatus 등에 표시되므로 추가 문구 생략
    } else {
      // 측정은 되었지만 최소 기준 미충족 또는 기타 이유
      reasonText += ' · 미측정/더미가 포함되면 "높음" 불가';
    }
  }
  
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

/**
 * ✅ [Phase 8-2C] 신뢰도 계산 함수 (완성도 규칙 기반)
 * 순수 함수, DOM/Storage 접근 금지
 * 입력이 비어도 안전하게 기본값 반환
 * @param {Object|null|undefined} reportModel - 리포트 모델 객체
 * @param {Object|null|undefined} lastV2 - 마지막 리포트 데이터 (현재 사용 안 함)
 * @returns {Object} 신뢰도 계산 결과 { level, label, reasons }
 */
export function computeReliability(reportModel, lastV2) {
  // ✅ [Phase 14-0] 리포트 없음 케이스: "측정 필요"와 혼동되지 않게 분리 문구 유지
  // 입력이 비어있거나 유효하지 않으면 기본값 반환
  if (!reportModel || typeof reportModel !== 'object') {
    return {
      level: 'unknown',
      label: '측정 필요',
      reasons: ['리포트 없음 · 리포트를 불러올 수 없습니다']
    };
  }

  try {
    const scores = reportModel?.analysis?.scores || {};
    const brandingScore = scores.branding;
    const contentStructureV2Score = scores.contentStructureV2;
    const urlStructureV1Score = scores.urlStructureV1;
    
    // ✅ [Phase 8-2C] 점수 유효성 검사 함수 (기존 방식 유지)
    const isMeasured = (value) => {
      if (value === null || value === undefined) return false;
      const score = value.score;
      return score !== null && score !== undefined && !isNaN(score) && isFinite(score);
    };
    
    // ✅ [Phase 8-2C] 3개 신호를 boolean으로 추출
    // 1) hasBrand: branding 점수/입력이 유효 (기존 방식 유지)
    const hasBrand = isMeasured(brandingScore);
    
    // 2) hasContentEvidence: contentStructureV2.evidence가 배열이고 length>0
    const hasContentEvidence = contentStructureV2Score && 
      contentStructureV2Score.evidence && 
      Array.isArray(contentStructureV2Score.evidence) && 
      contentStructureV2Score.evidence.length > 0;
    
    // 3) hasUrl: urlStructureV1 점수/결과가 유효 (기존 방식 유지)
    const hasUrl = isMeasured(urlStructureV1Score);
    
    // ✅ [Phase 8-2C] 충족 개수 계산
    const n = (hasBrand ? 1 : 0) + (hasContentEvidence ? 1 : 0) + (hasUrl ? 1 : 0);
    
    // ✅ [Phase 8-2C] 입력 자체가 거의 없는지 확인
    const hasInput = reportModel.inputs?.product || reportModel.inputs?.brand || reportModel.input;
    const hasMinimalInput = hasInput && (
      (typeof hasInput === 'string' && hasInput.trim().length > 0) ||
      (typeof hasInput === 'object' && Object.keys(hasInput).length > 0)
    );
    
    // ✅ [Phase 8-2C] 레벨/라벨 규칙 적용
    let level, label;
    
    if (n === 3) {
      level = 'high';
      label = '높음';
    } else if (n === 2) {
      level = 'mid';
      label = '중간';
    } else if (n <= 1) {
      if (n === 0 && !hasMinimalInput) {
        // n===0이고 입력 자체가 거의 없으면
        level = 'unknown';
        label = '측정 필요';
      } else {
        level = 'low';
        label = '낮음';
      }
    } else {
      // 예외 상황 (n이 3보다 큰 경우는 없지만 안전장치)
      level = 'unknown';
      label = '측정 필요';
    }
    
    // ✅ [Phase 14-0] reasons 배열 생성: 출력 순서 고정 (brand -> content -> url -> no-report)
    // ✅ [Phase 14-0] reasons 문구 표준화: 짧고 일관된 톤으로 통일 (동일 조사/동일 종결)
    const reasons = [];
    
    // 1. BRAND 측정 상태 (고정 순서)
    reasons.push(`BRAND ${hasBrand ? '측정됨' : '미측정'}`);
    
    // 2. CONTENT 측정 상태 (고정 순서)
    reasons.push(`CONTENT ${hasContentEvidence ? '측정됨' : '미측정'}`);
    
    // 3. URL 측정 상태 (고정 순서)
    reasons.push(`URL ${hasUrl ? '측정됨' : '미측정'}`);
    
    // 완성도 정보 추가 (기존 로직 유지)
    if (n === 3) {
      reasons.push('3개 항목 모두 측정 완료');
    } else if (n === 2) {
      reasons.push('2개 항목 측정 완료');
    } else if (n === 1) {
      reasons.push('1개 항목만 측정 완료');
    } else {
      reasons.push('측정된 항목이 없습니다');
    }
    
    return {
      level: level,
      label: label,
      reasons: reasons
    };
  } catch (e) {
    // ✅ [Phase 14-0] 에러 발생 시 리포트 없음 케이스: "측정 필요"와 혼동되지 않게 분리 문구 유지
    // 에러 발생 시 기본값 반환 (절대 throw 하지 않음)
    return {
      level: 'unknown',
      label: '측정 필요',
      reasons: ['리포트 없음 · 리포트를 불러올 수 없습니다']
    };
  }
}


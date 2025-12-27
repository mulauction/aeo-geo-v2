/**
 * ✅ [Phase 12-2] WHY 패널 이유 생성 모듈
 * 읽기 전용 계산만 수행 (저장/부작용 없음)
 */

/**
 * ✅ [Phase 13-0A] WHY 패널 observable facts 추출 함수 (내부 헬퍼)
 * reportModel에서 관찰 가능한 사실들을 구조화된 객체로 추출
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} facts 객체
 */
function deriveWhyFacts(reportModel) {
  // null-safe 기본값
  const safeModel = reportModel || {};
  
  // scores 읽기 (null-safe)
  const scores = safeModel?.analysis?.scores || safeModel?.scores || {};
  
  // score values + null flags
  const brandingScore = scores?.branding?.score ?? null;
  const contentStructureV2Score = scores?.contentStructureV2?.score ?? null;
  const urlStructureV1Score = scores?.urlStructureV1?.score ?? null;
  
  const brandingIsNull = scores?.branding == null;
  const contentStructureV2IsNull = scores?.contentStructureV2 == null;
  const urlStructureV1IsNull = scores?.urlStructureV1 == null;
  
  // input presence flags
  const inputs = safeModel?.inputs || {};
  const brandProvided = Boolean(
    inputs?.brand && 
    typeof inputs.brand === 'string' && 
    inputs.brand.trim().length > 0
  );
  const productProvided = Boolean(
    (inputs?.product && typeof inputs.product === 'string' && inputs.product.trim().length > 0) ||
    (safeModel?.input && typeof safeModel.input === 'string' && safeModel.input.trim().length > 0)
  );
  
  // ✅ [Phase 13-0E] evidence counts (total + per KPI) - initialize as null, only set when source exists
  let totalEvidenceCount = null;
  let brandingEvidenceCount = null;
  let contentEvidenceCount = null;
  let urlEvidenceCount = null;
  
  // Total evidence count (우선순위 순서) - only set if path exists
  try {
    if (safeModel?.analysis?.evidence?.items?.length != null) {
      totalEvidenceCount = Number(safeModel.analysis.evidence.items.length) || 0;
    } else if (safeModel?.analysis?.evidence?.length != null) {
      totalEvidenceCount = Number(safeModel.analysis.evidence.length) || 0;
    } else if (safeModel?.evidence?.items?.length != null) {
      totalEvidenceCount = Number(safeModel.evidence.items.length) || 0;
    } else if (safeModel?.evidence?.length != null) {
      totalEvidenceCount = Number(safeModel.evidence.length) || 0;
    }
    // If none of the paths exist, totalEvidenceCount remains null
  } catch (e) {
    // On error, keep null (unknown)
    totalEvidenceCount = null;
  }
  
  // Per-KPI evidence counts (if accessible) - only set if source exists
  try {
    // branding evidence (if available in scores.branding.evidence)
    if (Array.isArray(scores?.branding?.evidence)) {
      brandingEvidenceCount = scores.branding.evidence.length;
    }
    // If not array, brandingEvidenceCount remains null
    
    // contentStructureV2 evidence (if available)
    if (Array.isArray(scores?.contentStructureV2?.evidence)) {
      contentEvidenceCount = scores.contentStructureV2.evidence.length;
    }
    // If not array, contentEvidenceCount remains null
    
    // urlStructureV1 evidence (if available)
    if (Array.isArray(scores?.urlStructureV1?.evidence)) {
      urlEvidenceCount = scores.urlStructureV1.evidence.length;
    }
    // If not array, urlEvidenceCount remains null
  } catch (e) {
    // On error, keep null (unknown)
  }
  
  // ✅ [Phase 13-0E] urlConnected tri-state: true / false / null (unknown)
  let urlConnected = null;
  try {
    if (safeModel?.analysis?.url?.connected === true) {
      urlConnected = true;
    } else if (safeModel?.analysis?.url?.connected === false) {
      urlConnected = false;
    } else if (safeModel?.url?.connected === true) {
      urlConnected = true;
    } else if (safeModel?.url?.connected === false) {
      urlConnected = false;
    } else if (safeModel?.analysis?.urlConnected === true) {
      urlConnected = true;
    } else if (safeModel?.analysis?.urlConnected === false) {
      urlConnected = false;
    }
    // If no path exists or value is not explicitly true/false, urlConnected remains null
  } catch (e) {
    // On error, keep null (unknown)
    urlConnected = null;
  }
  
  // ✅ [Phase 13-0E] missingSignals array derived from observable facts (only when known)
  const missingSignals = [];
  
  // Brand signal missing if: score is null OR (score exists but evidenceCount === 0 when known)
  if (brandingIsNull) {
    missingSignals.push('brand');
  } else if (!Number.isFinite(brandingScore) && brandingEvidenceCount !== null && brandingEvidenceCount === 0) {
    // Only mark missing if evidenceCount is known (not null) and is 0
    missingSignals.push('brand');
  }
  
  // Content signal missing if: score is null OR (score exists but evidenceCount === 0 when known)
  if (contentStructureV2IsNull || contentStructureV2Score == null) {
    missingSignals.push('content');
  } else if (contentEvidenceCount !== null && contentEvidenceCount === 0) {
    // Only mark missing if evidenceCount is known (not null) and is 0
    missingSignals.push('content');
  }
  
  // URL signal missing if: score is null OR urlConnected === false (explicitly false) OR urlConnected is null (status unknown)
  if (urlStructureV1IsNull || urlStructureV1Score == null) {
    missingSignals.push('url');
  } else if (urlConnected === false) {
    // Explicitly false - mark as missing
    missingSignals.push('url');
  } else if (urlConnected === null) {
    // Status unknown - mark as missing with "status unknown" reason
    missingSignals.push('url');
  }
  
  return {
    // Score values
    brandingScore,
    contentStructureV2Score,
    urlStructureV1Score,
    
    // Null flags
    brandingIsNull,
    contentStructureV2IsNull,
    urlStructureV1IsNull,
    
    // Input presence flags
    brandProvided,
    productProvided,
    
    // Evidence counts
    totalEvidenceCount,
    brandingEvidenceCount,
    contentEvidenceCount,
    urlEvidenceCount,
    
    // URL connection status
    urlConnected,
    
    // Derived missing signals
    missingSignals
  };
}

/**
 * ✅ [Phase 13-0B] WHY 패널 이유 생성 함수 (evidence-driven)
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} { level: 'high'|'mid'|'low', reasons: Array<{ key, title, detail }> }
 */
export function buildWhyReasons(reportModel) {
  // level 결정: reliability 레벨 읽기 (우선순위 순서)
  let level = 'low';
  if (reportModel?.reliability?.level) {
    level = reportModel.reliability.level;
  } else if (reportModel?.reliabilityLevel) {
    level = reportModel.reliabilityLevel;
  } else if (reportModel?.analysis?.reliability?.level) {
    level = reportModel.analysis.reliability.level;
  }

  // level 정규화: high/mid/low로 통일
  const normalizedLevel = String(level).toLowerCase();
  let normalizedLevelValue = 'low';
  if (normalizedLevel === 'high' || normalizedLevel === '높음') {
    normalizedLevelValue = 'high';
  } else if (normalizedLevel === 'mid' || normalizedLevel === 'medium' || normalizedLevel === 'normal' || normalizedLevel === '보통' || normalizedLevel === '중간') {
    normalizedLevelValue = 'mid';
  } else {
    normalizedLevelValue = 'low';
  }

  // ✅ [Phase 13-0B] observable facts 추출
  const facts = deriveWhyFacts(reportModel);

  // 이유 생성 (evidence-driven, observable facts 기반)
  const allReasons = [];

  // ✅ [Phase 13-0E] (브랜드) 브랜드 근거 부족 또는 점수 미측정
  if (facts.missingSignals.includes('brand')) {
    let detail = '';
    // 점수 객체 자체가 없으면 측정 필요
    if (facts.brandingIsNull) {
      detail = '브랜드 점수 측정 필요';
    } 
    // 근거 개수가 null이면 확인 불가
    else if (facts.brandingEvidenceCount === null) {
      detail = '브랜드 근거 확인 불가';
    }
    // 점수는 있지만 유효하지 않고 근거도 없으면
    else if (!Number.isFinite(facts.brandingScore) && facts.brandingEvidenceCount === 0) {
      if (facts.totalEvidenceCount === null) {
        detail = '브랜드 근거 0개';
      } else if (facts.totalEvidenceCount === 0) {
        detail = '브랜드 근거 0개';
      } else {
        detail = `브랜드 근거 0개 (전체 근거 ${facts.totalEvidenceCount}개)`;
      }
    }
    // 점수는 있지만 근거가 없으면
    else if (facts.brandingEvidenceCount === 0) {
      if (facts.totalEvidenceCount === null) {
        detail = '브랜드 근거 0개';
      } else if (facts.totalEvidenceCount === 0) {
        detail = '브랜드 근거 0개';
      } else {
        detail = `브랜드 근거 0개 (전체 근거 ${facts.totalEvidenceCount}개)`;
      }
    }
    // 기본: 근거 부족 (known count)
    else {
      detail = `브랜드 근거 ${facts.brandingEvidenceCount}개 부족`;
    }
    
    allReasons.push({
      key: 'brand',
      title: '브랜드',
      detail: detail
    });
  }

  // ✅ [Phase 13-0E] (콘텐츠) 콘텐츠 구조 점수 미측정 또는 근거 부족
  if (facts.missingSignals.includes('content')) {
    let detail = '';
    if (facts.contentStructureV2IsNull) {
      detail = '콘텐츠 구조 점수 측정 필요';
    } else if (facts.contentEvidenceCount === null) {
      detail = '콘텐츠 구조 근거 확인 불가';
    } else if (facts.contentEvidenceCount === 0) {
      detail = '콘텐츠 구조 근거 0개';
    } else {
      detail = `콘텐츠 구조 근거 ${facts.contentEvidenceCount}개 부족`;
    }
    
    allReasons.push({
      key: 'content',
      title: '콘텐츠 구조',
      detail: detail
    });
  }

  // ✅ [Phase 13-0E] (URL) URL 측정 미실행 또는 연결 미확인
  if (facts.missingSignals.includes('url')) {
    let detail = '';
    if (facts.urlStructureV1IsNull) {
      detail = 'URL 구조 점수 측정 필요';
    } else if (facts.urlConnected === false) {
      // Explicitly false (not null/unknown)
      detail = 'URL 미연결';
    } else if (facts.urlConnected === null) {
      // Unknown status
      detail = 'URL 연결 상태 확인 불가';
    } else {
      detail = 'URL 측정 미실행';
    }
    
    allReasons.push({
      key: 'url',
      title: 'URL 구조',
      detail: detail
    });
  }

  // level별 노출 필터링 (최대 3개, 가장 blocking한 항목 우선)
  let reasons = [];
  if (normalizedLevelValue === 'high') {
    // high면 reasons를 비우고, UI는 "현재 데이터는 충분합니다"만 표시
    reasons = [];
  } else if (normalizedLevelValue === 'mid') {
    // mid면 reasons를 최대 2개로 제한(brand, content 우선)
    reasons = allReasons
      .filter(r => r.key === 'brand' || r.key === 'content')
      .slice(0, 2);
  } else {
    // low면 reasons 최대 3개(brand/content/url, 우선순위 순서)
    reasons = allReasons.slice(0, 3);
  }

  return {
    level: normalizedLevelValue,
    reasons: reasons,
    allReasons: allReasons // ✅ [Phase 12-3] action line을 위한 전체 이유 목록
  };
}

/**
 * ✅ [Phase 13-0C] WHY 패널 action line 생성 함수 (evidence-driven, executable)
 * @param {Object} whyResult - buildWhyReasons 반환값 { level, reasons, allReasons }
 * @param {Object} reportModel - 리포트 모델 객체 (optional, for backward compatibility)
 * @returns {string} action line 문구 (exactly one line)
 */
export function buildWhyActionLine(whyResult, reportModel) {
  // Backward compatibility: if only whyResult provided, use old logic
  if (!whyResult || typeof whyResult !== 'object') {
    return '추천: 리포트를 갱신하세요.';
  }

  const { level } = whyResult;

  // level==='high' => "현재 데이터는 충분합니다. 유지하세요."
  if (level === 'high') {
    return '현재 데이터는 충분합니다. 유지하세요.';
  }

  // ✅ [Phase 13-0E] Evidence-driven action selection (tri-state aware)
  // If reportModel provided, use facts; otherwise fallback to old logic
  if (reportModel) {
    const facts = deriveWhyFacts(reportModel);
    
    // Priority 1: If urlConnected is false (explicitly false) => action: connect URL then reopen share/analyze to validate
    if (facts.urlConnected === false) {
      return '추천: URL 연결을 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요.';
    }
    
    // Priority 1b: If urlConnected is null (unknown) => action: check URL connection status
    if (facts.urlConnected === null) {
      return '추천: URL 연결 상태를 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요.';
    }
    
    // Priority 2: Else if any KPI score is null => action: add missing inputs or rerun analyze to measure
    if (facts.brandingIsNull || facts.contentStructureV2IsNull || facts.urlStructureV1IsNull) {
      if (facts.brandingIsNull && !facts.brandProvided) {
        return '추천: 브랜드명을 입력하고 analyze를 다시 실행하여 측정하세요.';
      }
      if (facts.contentStructureV2IsNull && !facts.productProvided) {
        return '추천: 콘텐츠를 입력하고 analyze를 다시 실행하여 측정하세요.';
      }
      if (facts.urlStructureV1IsNull) {
        return '추천: URL을 입력하고 analyze를 다시 실행하여 측정하세요.';
      }
      return '추천: 누락된 입력을 추가하고 analyze를 다시 실행하여 측정하세요.';
    }
    
    // Priority 3: Else if evidenceCount for branding/content is 0 (known, not null) => action: add 1~2 explicit evidence lines
    if ((facts.brandingEvidenceCount !== null && facts.brandingEvidenceCount === 0) || 
        (facts.contentEvidenceCount !== null && facts.contentEvidenceCount === 0)) {
      if (facts.brandingEvidenceCount !== null && facts.brandingEvidenceCount === 0) {
        return '추천: 브랜드명과 핵심 스펙 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
      }
      if (facts.contentEvidenceCount !== null && facts.contentEvidenceCount === 0) {
        return '추천: 핵심 스펙 bullets 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
      }
    }
    
    // Priority 4: Else => action: suggest the next highest leverage improvement
    return '추천: 비교표나 FAQ 스니펫을 추가하여 신뢰도를 높이세요.';
  }

  // Fallback to old logic (backward compatibility)
  const reasons = Array.isArray(whyResult.allReasons) ? whyResult.allReasons : [];
  
  if (reasons.length === 0) {
    return '추천: 리포트를 갱신하세요.';
  }

  const firstReasonKey = reasons[0]?.key;
  
  if (firstReasonKey === 'brand') {
    return '추천: 공식 구매 링크 + 브랜드 소개 문장 1줄을 추가하세요.';
  } else if (firstReasonKey === 'content') {
    return '추천: H3 3개 + 장점 리스트 5개 구조로 요약 블록을 추가하세요.';
  } else if (firstReasonKey === 'url') {
    return '추천: URL 측정을 실행한 뒤 리포트를 갱신하세요.';
  }
  
  return '추천: 리포트를 갱신하세요.';
}


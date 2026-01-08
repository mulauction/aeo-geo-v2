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
  
  // ✅ [Phase 20-B-1] Evidence 플래그 계산 (읽기 전용, HTML/텍스트 기반)
  let evidenceFlags = {
    hasFAQ: false,
    hasBrandName: false,
    hasProductName: false,
    hasStructure: false,
    hasShoppingHints: false
  };
  
  try {
    // HTML/텍스트 소스 확인 (우선순위 순서)
    const htmlText = safeModel?.analysis?.inputText ||
                     safeModel?.input || 
                     safeModel?.result?.summary || 
                     safeModel?.analysis?.summary || 
                     '';
    
    if (htmlText && typeof htmlText === 'string' && htmlText.trim().length > 0) {
      // hasFAQ: FAQ 관련 키워드 존재 여부
      evidenceFlags.hasFAQ = /faq|자주\s*묻는|질문|q\s*:|question/i.test(htmlText);
      
      // hasBrandName: 브랜드명 존재 여부 (inputs.brand가 htmlText에 포함되어 있는지 확인)
      const brandName = inputs?.brand || '';
      if (brandName && brandName.trim().length > 0) {
        // 브랜드명을 정규화하여 htmlText에서 검색 (공백 정규화, 대소문자 무시)
        const normalizedBrand = brandName.trim().replace(/\s+/g, '\\s*');
        const brandPattern = new RegExp(normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        evidenceFlags.hasBrandName = brandPattern.test(htmlText);
      } else {
        // HTML 내 브랜드 관련 패턴 검색
        evidenceFlags.hasBrandName = /브랜드|brand/i.test(htmlText);
      }
      
      // hasProductName: 제품명 존재 여부 (inputs.product가 htmlText에 포함되어 있는지 확인)
      const productName = inputs?.product || '';
      if (productName && productName.trim().length > 0) {
        // 제품명을 정규화하여 htmlText에서 검색 (공백 정규화, 대소문자 무시)
        const normalizedProduct = productName.trim().replace(/\s+/g, '\\s*');
        const productPattern = new RegExp(normalizedProduct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        evidenceFlags.hasProductName = productPattern.test(htmlText);
      } else {
        // HTML 내 제품 관련 패턴 검색
        evidenceFlags.hasProductName = /제품|product|상품/i.test(htmlText);
      }
      
      // hasStructure: h3, ul, p 존재 여부
      evidenceFlags.hasStructure = (
        /<h3[^>]*>/i.test(htmlText) ||
        /<ul[^>]*>/i.test(htmlText) ||
        /<p[^>]*>/i.test(htmlText)
      );
      
      // hasShoppingHints: 쇼핑 관련 키워드 언급 여부
      evidenceFlags.hasShoppingHints = /(가격|배송|as|a\/s|교환|반품|옵션|사이즈|소재|구성품)/i.test(htmlText);
    }
  } catch (e) {
    // 에러 시 기본값 유지 (모두 false)
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
    missingSignals,
    
    // ✅ [Phase 20-B-1] Evidence 플래그 (읽기 전용 계산 결과)
    evidenceFlags
  };
}

/**
 * ✅ [Phase 13-1A] 리포트 로드 실패/근거 접근 불가 판별 함수
 * 리포트 없음/로드 실패/근거 접근 불가를 판별하는 최소 조건
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {boolean} 리포트 로드 실패 여부
 */
function isReportLoadFailed(reportModel) {
  // 리포트가 null이거나 undefined인 경우
  if (reportModel == null) {
    return true;
  }
  
  // 리포트가 있지만 analysis가 없거나 analysis.scores가 없는 경우
  if (!reportModel.analysis || !reportModel.analysis.scores) {
    return true;
  }
  
  // 리포트가 있지만 모든 필수 필드가 비어있는 경우 (빈 객체 fallback 케이스)
  // share.html에서 reportModel || { analysis: { scores: {} } }로 전달되는 경우 처리
  const scores = reportModel.analysis.scores;
  const hasAnyScore = scores?.branding != null || 
                      scores?.contentStructureV2 != null || 
                      scores?.urlStructureV1 != null;
  
  // createdAt이 없고, 모든 scores가 null이고, input/inputs/result가 모두 비어있는 경우
  if (!reportModel.createdAt && !hasAnyScore) {
    const hasInput = (reportModel.inputs && Object.keys(reportModel.inputs).length > 0) ||
                     (reportModel.input && typeof reportModel.input === 'string' && reportModel.input.trim().length > 0) ||
                     (reportModel.result != null);
    
    if (!hasInput) {
      return true;
    }
  }
  
  return false;
}

/**
 * ✅ [Phase 20-B-2] Evidence 플래그 스냅샷 포맷팅 헬퍼
 * @param {Object} evidenceFlags - evidenceFlags 객체
 * @returns {string} 포맷된 스냅샷 문자열
 */
function formatEvidenceSnapshot(evidenceFlags) {
  if (!evidenceFlags || typeof evidenceFlags !== 'object') {
    return '현재 상태: 측정 필요';
  }
  
  const parts = [];
  
  // FAQ
  parts.push(`FAQ(${evidenceFlags.hasFAQ ? '있음' : '없음'})`);
  
  // 브랜드
  parts.push(`브랜드(${evidenceFlags.hasBrandName ? '있음' : '없음'})`);
  
  // 상품명
  parts.push(`상품명(${evidenceFlags.hasProductName ? '있음' : '없음'})`);
  
  // 구조
  parts.push(`구조(${evidenceFlags.hasStructure ? '적정' : '부족'})`);
  
  // 구매힌트
  parts.push(`구매힌트(${evidenceFlags.hasShoppingHints ? '있음' : '부족'})`);
  
  return `현재 상태: ${parts.join(' · ')}`;
}

/**
 * ✅ [Phase 13-0B] WHY 패널 이유 생성 함수 (evidence-driven)
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} { level: 'high'|'mid'|'low', reasons: Array<{ key, title, detail }> }
 */
export function buildWhyReasons(reportModel) {
  // ✅ [Phase 13-1A] 리포트 로드 실패 케이스 분기 처리
  if (isReportLoadFailed(reportModel)) {
    return {
      level: 'low',
      reasons: [{
        key: 'report_load_failed',
        title: '리포트 로드 실패',
        detail: '리포트를 불러오지 못했어요'
      }],
      allReasons: [{
        key: 'report_load_failed',
        title: '리포트 로드 실패',
        detail: '리포트를 불러오지 못했어요'
      }]
    };
  }

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
  
  // ✅ [Phase 20-B-2] Evidence 플래그 스냅샷 생성 (읽기 전용 관찰)
  const evidenceSnapshot = formatEvidenceSnapshot(facts.evidenceFlags);

  // 이유 생성 (evidence-driven, observable facts 기반)
  const allReasons = [];
  
  // ✅ [Phase 20-B-2] Evidence 플래그 스냅샷을 첫 번째 이유로 추가 (읽기 전용 관찰)
  allReasons.push({
    key: 'evidence_snapshot',
    title: '현재 상태',
    detail: evidenceSnapshot
  });

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
      .filter(r => r.key !== 'evidence_snapshot' && (r.key === 'brand' || r.key === 'content'))
      .slice(0, 2);
  } else {
    // low면 reasons 최대 3개(brand/content/url, 우선순위 순서, 스냅샷 제외)
    reasons = allReasons
      .filter(r => r.key !== 'evidence_snapshot')
      .slice(0, 3);
  }
  
  // ✅ [Phase 20-B-2] Evidence 스냅샷을 항상 첫 번째에 포함 (읽기 전용 관찰)
  const snapshotReason = allReasons.find(r => r.key === 'evidence_snapshot');
  if (snapshotReason) {
    reasons = [snapshotReason, ...reasons];
  }

  return {
    level: normalizedLevelValue,
    reasons: reasons,
    allReasons: allReasons // ✅ [Phase 12-3] action line을 위한 전체 이유 목록
  };
}

/**
 * ✅ [Phase 20-B-2] WHY 전체 결과 생성 함수 (Analyze 저장용)
 * @param {Object} reportModel - 리포트 모델 객체 (v2Summary 형태)
 * @returns {Object} { reasons: whyResult, actionLine: string, evidenceFlags: object }
 */
export function buildWhyFromReportModel(reportModel) {
  try {
    // WHY reasons 및 action line 생성
    const whyResult = buildWhyReasons(reportModel);
    const actionLine = buildWhyActionLine(whyResult, reportModel);
    
    // Evidence flags 추출 (deriveWhyFacts에서 계산된 것)
    const facts = deriveWhyFacts(reportModel);
    const evidenceFlags = facts.evidenceFlags || {};
    
    // ✅ [Phase 20-B Fix] reasons는 배열이어야 함 (whyResult.reasons 배열 추출)
    const reasonsArray = Array.isArray(whyResult?.reasons) 
      ? whyResult.reasons 
      : (Array.isArray(whyResult?.allReasons) ? whyResult.allReasons : []);
    
    return {
      reasons: reasonsArray,
      actionLine: actionLine,
      evidenceFlags: evidenceFlags
    };
  } catch (e) {
    // 실패 시 기본값 반환 (reasons는 배열)
    return {
      reasons: [],
      actionLine: '추천: 리포트를 갱신하세요.',
      evidenceFlags: {}
    };
  }
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

  // ✅ [Phase 13-1A] 리포트 로드 실패 케이스 분기 처리
  if (isReportLoadFailed(reportModel)) {
    return '공유 링크가 만료되었거나 저장된 리포트가 없습니다. 홈에서 다시 분석 후 공유를 생성해 주세요.';
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


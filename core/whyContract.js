/**
 * ✅ [Phase21] WHY Data Contract Adapter
 * Phase21 WHY_DATA_CONTRACT.md 계약을 구현하는 어댑터
 * 
 * Non-negotiables:
 * - 저장 스키마 __lastV2 변경 금지
 * - Share 렌더 파이프라인 변경 금지
 * - Unknown-safe: 입력 누락/형태 변화에도 예외 금지
 * - reasons 최소 1개 보장
 */

/**
 * Evidence summary 추출 헬퍼
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} evidence summary 객체
 */
function extractEvidenceSummary(reportModel) {
  const safeModel = reportModel || {};
  
  // ✅ [Phase21] evidenceSummary 직접 추출 시도 (v2Summary 우선)
  let evidenceSummary = null;
  try {
    evidenceSummary = safeModel?.evidenceSummary || safeModel?.v2Summary?.evidenceSummary || null;
  } catch (e) {
    evidenceSummary = null;
  }
  
  // evidenceSummary가 있으면 그것을 사용, 없으면 기존 방식으로 추출
  if (evidenceSummary && typeof evidenceSummary === 'object') {
    // evidenceSummary 객체가 있으면 그대로 사용 (필요한 필드만 추출)
    return {
      totalCount: evidenceSummary.totalCount ?? null,
      brandingCount: evidenceSummary.brandingCount ?? null,
      contentCount: evidenceSummary.contentCount ?? null,
      urlCount: evidenceSummary.urlCount ?? null,
      urlConnected: evidenceSummary.urlConnected ?? null
    };
  }
  
  // evidenceSummary가 없으면 기존 방식으로 추출
  // Total evidence count
  let totalCount = null;
  try {
    if (safeModel?.analysis?.evidence?.items?.length != null) {
      totalCount = Number(safeModel.analysis.evidence.items.length) || 0;
    } else if (safeModel?.analysis?.evidence?.length != null) {
      totalCount = Number(safeModel.analysis.evidence.length) || 0;
    } else if (safeModel?.evidence?.items?.length != null) {
      totalCount = Number(safeModel.evidence.items.length) || 0;
    } else if (safeModel?.evidence?.length != null) {
      totalCount = Number(safeModel.evidence.length) || 0;
    }
  } catch (e) {
    totalCount = null;
  }
  
  // Per-KPI evidence counts
  const scores = safeModel?.analysis?.scores || safeModel?.v2Summary?.analysis?.scores || safeModel?.scores || {};
  let brandingCount = null;
  let contentCount = null;
  let urlCount = null;
  
  try {
    if (Array.isArray(scores?.branding?.evidence)) {
      brandingCount = scores.branding.evidence.length;
    }
    if (Array.isArray(scores?.contentStructureV2?.evidence)) {
      contentCount = scores.contentStructureV2.evidence.length;
    }
    if (Array.isArray(scores?.urlStructureV1?.evidence)) {
      urlCount = scores.urlStructureV1.evidence.length;
    }
  } catch (e) {
    // Keep null on error
  }
  
  // URL connection status
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
  } catch (e) {
    urlConnected = null;
  }
  
  return {
    totalCount,
    brandingCount,
    contentCount,
    urlCount,
    urlConnected
  };
}

/**
 * Confidence 레벨 결정
 * @param {Object} scores - analysis.scores 객체
 * @param {Object} evidenceSummary - evidence summary 객체
 * @returns {"high" | "medium" | "low"}
 */
function determineConfidence(scores, evidenceSummary) {
  // high: 주요 슬롯 측정됨 + evidence summary 충분
  const brandingMeasured = scores?.branding != null && scores.branding.score != null;
  const contentMeasured = scores?.contentStructureV2 != null && scores.contentStructureV2.score != null;
  const urlMeasured = scores?.urlStructureV1 != null && scores.urlStructureV1.score != null;
  
  const hasSufficientEvidence = 
    (evidenceSummary.totalCount != null && evidenceSummary.totalCount > 0) ||
    (evidenceSummary.brandingCount != null && evidenceSummary.brandingCount > 0) ||
    (evidenceSummary.contentCount != null && evidenceSummary.contentCount > 0);
  
  if (brandingMeasured && contentMeasured && urlMeasured && hasSufficientEvidence) {
    return 'high';
  }
  
  // medium: 일부 측정/일부 근거
  const measuredCount = [brandingMeasured, contentMeasured, urlMeasured].filter(Boolean).length;
  if (measuredCount >= 2 || (measuredCount >= 1 && hasSufficientEvidence)) {
    return 'medium';
  }
  
  // low: 다수가 null/근거 부족/측정 필요
  return 'low';
}

/**
 * Reasons 생성
 * @param {Object} scores - analysis.scores 객체
 * @param {Object} evidenceSummary - evidence summary 객체
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Array<{id: string, title: string, detail?: string, evidenceRefs?: string[], severity?: string}>}
 */
function buildReasons(scores, evidenceSummary, reportModel) {
  const reasons = [];
  
  // 리포트 로드 실패 케이스
  if (!reportModel || !reportModel.analysis || !reportModel.analysis.scores) {
    reasons.push({
      id: 'report_load_failed',
      title: '리포트 로드 실패',
      detail: '리포트를 불러올 수 없습니다',
      severity: 'risk'
    });
    return reasons;
  }
  
  // 브랜드 관련 reason
  const brandingScore = scores?.branding?.score ?? null;
  const brandingIsNull = scores?.branding == null;
  
  if (brandingIsNull) {
    reasons.push({
      id: 'brand_measurement_needed',
      title: '브랜드',
      detail: '브랜드 점수 측정 필요',
      severity: 'warn'
    });
  } else if (!Number.isFinite(brandingScore)) {
    if (evidenceSummary.brandingCount === null) {
      reasons.push({
        id: 'brand_evidence_unknown',
        title: '브랜드',
        detail: '브랜드 근거 확인 불가',
        severity: 'info'
      });
    } else if (evidenceSummary.brandingCount === 0) {
      reasons.push({
        id: 'brand_evidence_zero',
        title: '브랜드',
        detail: '브랜드 근거 0개',
        severity: 'warn'
      });
    } else {
      reasons.push({
        id: 'brand_evidence_low',
        title: '브랜드',
        detail: `브랜드 근거 ${evidenceSummary.brandingCount}개 부족`,
        severity: 'info'
      });
    }
  }
  
  // 콘텐츠 구조 관련 reason
  const contentScore = scores?.contentStructureV2?.score ?? null;
  const contentIsNull = scores?.contentStructureV2 == null;
  
  if (contentIsNull) {
    reasons.push({
      id: 'content_measurement_needed',
      title: '콘텐츠 구조',
      detail: '콘텐츠 구조 점수 측정 필요',
      severity: 'warn'
    });
  } else if (!Number.isFinite(contentScore)) {
    if (evidenceSummary.contentCount === null) {
      reasons.push({
        id: 'content_evidence_unknown',
        title: '콘텐츠 구조',
        detail: '콘텐츠 구조 근거 확인 불가',
        severity: 'info'
      });
    } else if (evidenceSummary.contentCount === 0) {
      reasons.push({
        id: 'content_evidence_zero',
        title: '콘텐츠 구조',
        detail: '콘텐츠 구조 근거 0개',
        severity: 'warn'
      });
    } else {
      reasons.push({
        id: 'content_evidence_low',
        title: '콘텐츠 구조',
        detail: `콘텐츠 구조 근거 ${evidenceSummary.contentCount}개 부족`,
        severity: 'info'
      });
    }
  }
  
  // URL 구조 관련 reason
  const urlScore = scores?.urlStructureV1?.score ?? null;
  const urlIsNull = scores?.urlStructureV1 == null;
  
  if (urlIsNull) {
    reasons.push({
      id: 'url_measurement_needed',
      title: 'URL 구조',
      detail: 'URL 구조 점수 측정 필요',
      severity: 'warn'
    });
  } else if (evidenceSummary.urlConnected === false) {
    reasons.push({
      id: 'url_not_connected',
      title: 'URL 구조',
      detail: 'URL 미연결',
      severity: 'risk'
    });
  } else if (evidenceSummary.urlConnected === null) {
    reasons.push({
      id: 'url_status_unknown',
      title: 'URL 구조',
      detail: 'URL 연결 상태 확인 불가',
      severity: 'info'
    });
  }
  
  // ✅ [Phase21] 최소 1개 보장 (unknown-safe, 항상 보장)
  // 리포트 로드 실패 케이스가 아닌 경우에만 fallback 추가
  if (reasons.length === 0) {
    reasons.push({
      id: 'insufficient_data',
      title: '데이터 부족',
      detail: '근거가 부족해 추가 측정이 필요합니다',
      severity: 'info'
    });
  }
  
  return reasons;
}

/**
 * Action line 생성
 * @param {Object} scores - analysis.scores 객체
 * @param {Object} evidenceSummary - evidence summary 객체
 * @param {Object} reportModel - 리포트 모델 객체
 * @param {string} confidence - confidence 레벨
 * @returns {string} action line 문구
 */
function buildActionLine(scores, evidenceSummary, reportModel, confidence) {
  // 리포트 로드 실패 케이스
  if (!reportModel || !reportModel.analysis || !reportModel.analysis.scores) {
    return '공유 링크가 만료되었거나 저장된 리포트가 없습니다. 홈에서 다시 분석 후 공유를 생성해 주세요.';
  }
  
  // high confidence
  if (confidence === 'high') {
    return '현재 데이터는 충분합니다. 유지하세요.';
  }
  
  // Priority 1: URL 연결 문제
  if (evidenceSummary.urlConnected === false) {
    return '추천: URL 연결을 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요.';
  }
  if (evidenceSummary.urlConnected === null) {
    return '추천: URL 연결 상태를 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요.';
  }
  
  // Priority 2: 점수 미측정
  const inputs = reportModel?.inputs || {};
  const brandProvided = Boolean(
    inputs?.brand && 
    typeof inputs.brand === 'string' && 
    inputs.brand.trim().length > 0
  );
  const productProvided = Boolean(
    (inputs?.product && typeof inputs.product === 'string' && inputs.product.trim().length > 0) ||
    (reportModel?.input && typeof reportModel.input === 'string' && reportModel.input.trim().length > 0)
  );
  
  const brandingIsNull = scores?.branding == null;
  const contentIsNull = scores?.contentStructureV2 == null;
  const urlIsNull = scores?.urlStructureV1 == null;
  
  if (brandingIsNull && !brandProvided) {
    return '추천: 브랜드명을 입력하고 analyze를 다시 실행하여 측정하세요.';
  }
  if (contentIsNull && !productProvided) {
    return '추천: 콘텐츠를 입력하고 analyze를 다시 실행하여 측정하세요.';
  }
  if (urlIsNull) {
    return '추천: URL을 입력하고 analyze를 다시 실행하여 측정하세요.';
  }
  if (brandingIsNull || contentIsNull || urlIsNull) {
    return '추천: 누락된 입력을 추가하고 analyze를 다시 실행하여 측정하세요.';
  }
  
  // Priority 3: 근거 부족
  if (evidenceSummary.brandingCount !== null && evidenceSummary.brandingCount === 0) {
    return '추천: 브랜드명과 핵심 스펙 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
  }
  if (evidenceSummary.contentCount !== null && evidenceSummary.contentCount === 0) {
    return '추천: 핵심 스펙 bullets 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
  }
  
  // Priority 4: 기본 개선 제안
  if (confidence === 'low') {
    return '추천: 측정 데이터를 보강한 뒤 analyze를 다시 실행하세요.';
  }
  
  return '추천: 비교표나 FAQ 스니펫을 추가하여 신뢰도를 높이세요.';
}

/**
 * ✅ [Phase21] WHY Data Contract Builder
 * 
 * 입력:
 * - reportModel: 리포트 모델 객체
 * - analysis.scores: KPI 점수 슬롯 (reportModel.analysis.scores에서 추출)
 * - evidence summary: 근거 요약 (reportModel에서 추출)
 * 
 * 출력:
 * - reasons: Array<Reason> (최소 1개 보장)
 * - actionLine: string (1줄 문장)
 * - confidence: "high" | "medium" | "low"
 * 
 * Unknown-safe: 입력 누락/형태 변화에도 예외를 던지지 않음
 * 
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} { reasons: Array<Reason>, actionLine: string, confidence: string }
 */
export function buildWhyContract(reportModel) {
  try {
    // ✅ [Phase21] 입력 추출 (unknown-safe, v2Summary 우선)
    const safeModel = reportModel || {};
    const scores = safeModel?.analysis?.scores || safeModel?.v2Summary?.analysis?.scores || safeModel?.scores || {};
    const evidenceSummary = extractEvidenceSummary(safeModel);
    
    // Confidence 결정
    const confidence = determineConfidence(scores, evidenceSummary);
    
    // Reasons 생성 (최소 1개 보장)
    let reasons = buildReasons(scores, evidenceSummary, safeModel);
    
    // ✅ [Phase21] reasons는 무조건 최소 1개 보장 (high일 때도 보장)
    // UI에서 high일 때는 "현재 데이터는 충분합니다"를 표시하지만,
    // reasons는 항상 최소 1개를 보장하여 패널이 항상 보이도록 함
    if (!reasons || reasons.length === 0) {
      reasons = [{
        id: 'insufficient_data',
        title: '데이터 부족',
        detail: '근거가 부족해 추가 측정이 필요합니다',
        severity: 'info'
      }];
    }
    
    // Action line 생성 (무조건 1줄 보장)
    let actionLine = buildActionLine(scores, evidenceSummary, safeModel, confidence);
    if (!actionLine || typeof actionLine !== 'string' || actionLine.trim().length === 0) {
      actionLine = '추천: 리포트를 갱신하세요.';
    }
    
    return {
      reasons,
      actionLine,
      confidence
    };
  } catch (error) {
    // Unknown-safe: 예외 발생 시에도 최소 출력 보장 (throw 금지)
    console.warn('[whyContract] Error building contract, returning fallback:', error);
    return {
      reasons: [{
        id: 'error_fallback',
        title: '데이터 처리 오류',
        detail: '근거가 부족해 추가 측정이 필요합니다',
        severity: 'info'
      }],
      actionLine: '추천: 리포트를 갱신하세요.',
      confidence: 'low'
    };
  }
}


/**
 * ✅ [Phase22] WHY Data Contract Adapter
 * Phase21 WHY_DATA_CONTRACT.md 계약을 정식 채택한 구현
 * 
 * Non-negotiables:
 * - 저장 스키마 __lastV2 변경 금지
 * - Share 렌더 파이프라인 변경 금지
 * - Unknown-safe: 입력 누락/형태 변화에도 예외 금지
 * - Output 계약 보장: reasons(1~5), actionLine(1줄), confidence(high|medium|low)
 */

/**
 * 입력 표준화: reportModel에서 scores 추출
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} scores 객체
 */
function extractScores(reportModel) {
  const safeModel = reportModel || {};
  try {
    return safeModel?.analysis?.scores || 
           safeModel?.v2Summary?.analysis?.scores || 
           safeModel?.scores || 
           {};
  } catch (e) {
    return {};
  }
}

/**
 * 입력 표준화: reportModel에서 evidenceSummary 추출
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object|null} evidenceSummary 객체 또는 null
 */
function extractEvidenceSummary(reportModel) {
  const safeModel = reportModel || {};
  
  try {
    // 직접 evidenceSummary 객체가 있는 경우
    if (safeModel?.evidenceSummary && typeof safeModel.evidenceSummary === 'object') {
      return safeModel.evidenceSummary;
    }
    if (safeModel?.v2Summary?.evidenceSummary && typeof safeModel.v2Summary.evidenceSummary === 'object') {
      return safeModel.v2Summary.evidenceSummary;
    }
  } catch (e) {
    // Continue to fallback extraction
  }
  
  // evidenceSummary가 없으면 기존 방식으로 추출
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
  
  const scores = extractScores(safeModel);
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
 * @param {Object|null} evidenceSummary - evidence summary 객체
 * @returns {"high" | "medium" | "low"}
 */
function determineConfidence(scores, evidenceSummary) {
  try {
    const brandingMeasured = scores?.branding != null && scores.branding.score != null;
    const contentMeasured = scores?.contentStructureV2 != null && scores.contentStructureV2.score != null;
    const urlMeasured = scores?.urlStructureV1 != null && scores.urlStructureV1.score != null;
    
    const hasSufficientEvidence = evidenceSummary && (
      (evidenceSummary.totalCount != null && evidenceSummary.totalCount > 0) ||
      (evidenceSummary.brandingCount != null && evidenceSummary.brandingCount > 0) ||
      (evidenceSummary.contentCount != null && evidenceSummary.contentCount > 0)
    );
    
    if (brandingMeasured && contentMeasured && urlMeasured && hasSufficientEvidence) {
      return 'high';
    }
    
    const measuredCount = [brandingMeasured, contentMeasured, urlMeasured].filter(Boolean).length;
    if (measuredCount >= 2 || (measuredCount >= 1 && hasSufficientEvidence)) {
      return 'medium';
    }
    
    return 'low';
  } catch (e) {
    return 'low';
  }
}

/**
 * Reasons 생성 (1~5개 보장)
 * @param {Object} scores - analysis.scores 객체
 * @param {Object|null} evidenceSummary - evidence summary 객체
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Array<{id: string, title: string, detail?: string, severity?: string}>}
 */
function buildReasons(scores, evidenceSummary, reportModel) {
  const reasons = [];
  
  try {
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
      const brandingCount = evidenceSummary?.brandingCount ?? null;
      if (brandingCount === null) {
        reasons.push({
          id: 'brand_evidence_unknown',
          title: '브랜드',
          detail: '브랜드 근거 확인 불가',
          severity: 'info'
        });
      } else if (brandingCount === 0) {
        reasons.push({
          id: 'brand_evidence_zero',
          title: '브랜드',
          detail: '브랜드 근거 0개',
          severity: 'warn'
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
      const contentCount = evidenceSummary?.contentCount ?? null;
      if (contentCount === null) {
        reasons.push({
          id: 'content_evidence_unknown',
          title: '콘텐츠 구조',
          detail: '콘텐츠 구조 근거 확인 불가',
          severity: 'info'
        });
      } else if (contentCount === 0) {
        reasons.push({
          id: 'content_evidence_zero',
          title: '콘텐츠 구조',
          detail: '콘텐츠 구조 근거 0개',
          severity: 'warn'
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
    } else {
      const urlConnected = evidenceSummary?.urlConnected ?? null;
      if (urlConnected === false) {
        reasons.push({
          id: 'url_not_connected',
          title: 'URL 구조',
          detail: 'URL 미연결',
          severity: 'risk'
        });
      } else if (urlConnected === null) {
        reasons.push({
          id: 'url_status_unknown',
          title: 'URL 구조',
          detail: 'URL 연결 상태 확인 불가',
          severity: 'info'
        });
      }
    }
    
    // 최소 1개 보장 (unknown-safe)
    if (reasons.length === 0) {
      reasons.push({
        id: 'insufficient_data',
        title: '데이터 부족',
        detail: '근거가 부족해 추가 측정이 필요합니다',
        severity: 'info'
      });
    }
    
    // 최대 5개로 제한
    return reasons.slice(0, 5);
  } catch (e) {
    // Unknown-safe: 예외 발생 시에도 최소 1개 반환
    return [{
      id: 'error_fallback',
      title: '데이터 처리 오류',
      detail: '근거가 부족해 추가 측정이 필요합니다',
      severity: 'info'
    }];
  }
}

/**
 * Action line 생성 (1줄 보장)
 * @param {Object} scores - analysis.scores 객체
 * @param {Object|null} evidenceSummary - evidence summary 객체
 * @param {Object} reportModel - 리포트 모델 객체
 * @param {string} confidence - confidence 레벨
 * @returns {string} action line 문구 (1줄)
 */
function buildActionLine(scores, evidenceSummary, reportModel, confidence) {
  try {
    // 리포트 로드 실패 케이스
    if (!reportModel || !reportModel.analysis || !reportModel.analysis.scores) {
      return '공유 링크가 만료되었거나 저장된 리포트가 없습니다. 홈에서 다시 분석 후 공유를 생성해 주세요.';
    }
    
    // high confidence
    if (confidence === 'high') {
      return '현재 데이터는 충분합니다. 유지하세요.';
    }
    
    // Priority 1: URL 연결 문제
    const urlConnected = evidenceSummary?.urlConnected ?? null;
    if (urlConnected === false) {
      return '추천: URL 연결을 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요.';
    }
    if (urlConnected === null) {
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
    const brandingCount = evidenceSummary?.brandingCount ?? null;
    const contentCount = evidenceSummary?.contentCount ?? null;
    
    if (brandingCount !== null && brandingCount === 0) {
      return '추천: 브랜드명과 핵심 스펙 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
    }
    if (contentCount !== null && contentCount === 0) {
      return '추천: 핵심 스펙 bullets 1~2줄을 추가한 뒤 analyze를 다시 실행하세요.';
    }
    
    // Priority 4: 기본 개선 제안
    if (confidence === 'low') {
      return '추천: 측정 데이터를 보강한 뒤 analyze를 다시 실행하세요.';
    }
    
    return '추천: 비교표나 FAQ 스니펫을 추가하여 신뢰도를 높이세요.';
  } catch (e) {
    // Unknown-safe: 예외 발생 시에도 1줄 반환
    return '추천: 리포트를 갱신하세요.';
  }
}

/**
 * ✅ [Phase22] WHY Data Contract Builder
 * 
 * 입력 표준화:
 * - reportModel: 리포트 모델 객체 (scores/evidenceSummary는 내부에서 추출)
 * 
 * 출력 계약 보장:
 * - reasons: Array<Reason> (1~5개 보장)
 * - actionLine: string (1줄 보장)
 * - confidence: "high" | "medium" | "low"
 * 
 * Unknown-safe: 입력 누락/형태 변화에도 예외를 던지지 않음
 * 
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {Object} { reasons: Array<Reason>, actionLine: string, confidence: string }
 */
export function buildWhyContract(reportModel) {
  try {
    // 입력 표준화 (unknown-safe)
    const safeModel = reportModel || {};
    const scores = extractScores(safeModel);
    const evidenceSummary = extractEvidenceSummary(safeModel);
    
    // Confidence 결정
    const confidence = determineConfidence(scores, evidenceSummary);
    
    // Reasons 생성 (1~5개 보장)
    const reasons = buildReasons(scores, evidenceSummary, safeModel);
    
    // Action line 생성 (1줄 보장)
    const actionLine = buildActionLine(scores, evidenceSummary, safeModel, confidence);
    
    const result = {
      reasons,
      actionLine,
      confidence
    };
    
    // ✅ [Phase22] 디버그 로그 (window.__WHY_DEBUG__일 때만)
    if (typeof window !== 'undefined' && window.__WHY_DEBUG__) {
      console.log('[whyContract] Debug:', result);
    }
    
    return result;
  } catch (error) {
    // Unknown-safe: 예외 발생 시에도 최소 출력 보장 (throw 금지)
    if (typeof window !== 'undefined' && window.__WHY_DEBUG__) {
      console.warn('[whyContract] Error building contract, returning fallback:', error);
    }
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


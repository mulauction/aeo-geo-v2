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
 * ✅ [Phase 112] Evidence impact scoring helper (heuristic-based, text-only)
 * Assigns impact score (0-100) to evidence strings based on severity keywords
 * @param {string} evidenceText - Evidence string from contentStructureV2
 * @returns {number} Impact score (0-100, higher = more severe)
 */
function scoreEvidenceImpact(evidenceText) {
  if (!evidenceText || typeof evidenceText !== 'string') return 30; // 기본값 30
  
  const text = evidenceText.toLowerCase();
  let impact = 30; // 기본값 30
  
  // Very high impact: "부재" / "없음" / "문단 없음" / "리스트 부재" / "0개" => 90~100
  if (text.includes('부재') || text.includes('없음') || text.includes('문단 없음') || text.includes('리스트 부재') || text.match(/0개/)) {
    impact = 95; // 기본 90~100 범위의 중간값
    
    // "문단 없음" / "리스트 부재" -> high (90~100)
    if (text.includes('문단 없음') || text.includes('리스트 부재')) {
      impact = 95;
    }
  }
  
  // "충족률 XX%" 처리
  if (text.includes('충족률')) {
    const ratioMatch = text.match(/충족률\s*(\d+)%/);
    if (ratioMatch) {
      const ratio = parseInt(ratioMatch[1], 10);
      if (ratio >= 0 && ratio <= 49) {
        impact = 90; // 80~95 범위의 중간값
      } else if (ratio >= 50 && ratio <= 79) {
        impact = 65; // 50~79 범위의 중간값
      } else {
        impact = 25; // >=80 => 10~40 범위의 중간값
      }
    }
  }
  
  // "H1" 관련 결함 => +20 가산 (최대 100)
  if (text.includes('h1')) {
    impact = Math.min(100, impact + 20);
  }
  
  return Math.max(0, Math.min(100, impact));
}

/**
 * ✅ [Phase 112] Rank contentStructureV2 evidence by impact and return top N
 * @param {string[]} evidenceArray - Evidence strings from contentStructureV2
 * @param {number} topN - Number of top items to return (default 3)
 * @returns {Array<{text: string, impact: number}>} Top N evidence items sorted by impact descending
 */
function getTopImpactEvidence(evidenceArray, topN = 3) {
  if (!Array.isArray(evidenceArray) || evidenceArray.length === 0) {
    return [];
  }
  
  // Compute impact for each evidence string
  const withImpact = evidenceArray.map(text => ({
    text: String(text),
    impact: scoreEvidenceImpact(text)
  }));
  
  // Sort by impact descending, then take top N
  return withImpact
    .sort((a, b) => b.impact - a.impact)
    .slice(0, topN);
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
  // ✅ [Phase 112] Prioritize top 3 highest-impact evidence items
  if (facts.missingSignals.includes('content')) {
    const safeModel = reportModel || {};
    const scores = safeModel?.analysis?.scores || safeModel?.scores || {};
    const contentEvidence = scores?.contentStructureV2?.evidence;
    
    // If we have evidence array, prioritize top 3 by impact
    if (Array.isArray(contentEvidence) && contentEvidence.length > 0) {
      const topEvidence = getTopImpactEvidence(contentEvidence, 3);
      
      // Create individual reasons for top 3 evidence items
      topEvidence.forEach((item, index) => {
        allReasons.push({
          key: `content_evidence_${index}`,
          title: '콘텐츠 구조',
          detail: item.text
        });
      });
      
      // If there are more than 3 evidence items, add a summary reason
      if (contentEvidence.length > 3) {
        allReasons.push({
          key: 'content',
          title: '콘텐츠 구조',
          detail: `기타 구조 이슈 ${contentEvidence.length - 3}개`
        });
      }
    } else {
      // Fallback: no evidence array available, use generic reason
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

  // ✅ [Phase 172] HTML fetch evidence proof lines
  const f = reportModel?.analysis?.evidence?.fetch ?? reportModel?.analysis?.evidenceFetch ?? null;
  if (f && typeof f === 'object') {
    // Add numeric proof lines
    const h1Count = f.headings?.h1 ?? 0;
    const h2Count = f.headings?.h2 ?? 0;
    const h3Count = f.headings?.h3 ?? 0;
    const ulCount = f.lists?.ul ?? 0;
    const olCount = f.lists?.ol ?? 0;
    const linksCount = f.links ?? 0;
    const textLength = f.textLength ?? 0;
    const hasMetaDesc = Boolean(f.metaDescription && f.metaDescription.trim().length > 0);
    const hasCanonical = Boolean(f.canonical);
    const hasJsonLd = Boolean(f.jsonLd);

    // Proof line 1: Headings and lists
    allReasons.push({
      key: 'fetch_evidence_1',
      title: 'HTML 증거',
      detail: `H1 ${h1Count} / H2 ${h2Count} / H3 ${h3Count}, UL ${ulCount} / OL ${olCount}`
    });

    // Proof line 2: Meta and canonical
    allReasons.push({
      key: 'fetch_evidence_2',
      title: '메타',
      detail: `설명 ${hasMetaDesc ? '있음' : '없음'}, canonical ${hasCanonical ? '있음' : '없음'}`
    });

    // Proof line 3: Structured data and links
    allReasons.push({
      key: 'fetch_evidence_3',
      title: '구조화',
      detail: `JSON-LD ${hasJsonLd ? '있음' : '없음'}, 링크 ${linksCount}, 텍스트 ${textLength}자`
    });
  } else if (f === null) {
    // Fetch evidence missing
    allReasons.push({
      key: 'fetch_evidence_missing',
      title: 'HTML fetch 증거',
      detail: 'HTML fetch 증거 없음(수집 실패/차단/타임아웃)'
    });
  }

  // ✅ [Phase 112] level별 노출 필터링 (최대 3개, 가장 blocking한 항목 우선)
  // Top 3 contentStructureV2 evidence items (content_evidence_*) are already prioritized first in allReasons
  let reasons = [];
  if (normalizedLevelValue === 'high') {
    // high면 reasons를 비우고, UI는 "현재 데이터는 충분합니다"만 표시
    reasons = [];
  } else if (normalizedLevelValue === 'mid') {
    // mid면 reasons를 최대 2개로 제한
    // content_evidence_* items (top 3 prioritized) appear first, then brand/content
    const evidenceReasons = allReasons.filter(r => r.key.startsWith('content_evidence_'));
    const otherReasons = allReasons.filter(r => r.key === 'brand' || r.key === 'content');
    reasons = [...evidenceReasons, ...otherReasons].slice(0, 2);
  } else {
    // low면 reasons 최대 3개
    // Top 3 contentStructureV2 evidence items (content_evidence_*) appear first
    const evidenceReasons = allReasons.filter(r => r.key.startsWith('content_evidence_'));
    const otherReasons = allReasons.filter(r => r.key === 'brand' || r.key === 'content' || r.key === 'url');
    reasons = [...evidenceReasons, ...otherReasons].slice(0, 3);
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

/**
 * ✅ [Phase 118/119] Share 화면 상단 Action Line 생성 함수 (V2: 출처 추적 포함)
 * WHY Top3 + Improvements Top3 + Reliability summaryLine을 종합해 단일 Action 문장 생성
 * @param {Object} options - 옵션 객체
 * @param {Object} options.reportModel - 리포트 모델 객체
 * @param {string} options.viewState - Share view state ('OK' | 'EXPIRED' | 'NO_REPORT' | etc.)
 * @param {string} [options.reliabilityLevel] - Reliability level ('높음' | '보통' | '낮음' 또는 'high' | 'medium' | 'low')
 * @param {string} [options.reliabilityLabel] - Reliability label (reliabilityLevel이 없을 때 사용)
 * @returns {{ text: string, sources: Array<{ text: string, from: 'WHY'|'IMPROVEMENTS', index: number }>, prefix: string } | null}
 */
export function buildShareActionLineV2(options) {
  // Backward compatibility: 첫 번째 인자가 객체가 아니면 기존 시그니처로 처리
  let reportModel, viewState, reliabilityLevel, reliabilityLabel;
  if (typeof options === 'object' && options !== null && !options.analysis) {
    // 새 시그니처: { reportModel, viewState, reliabilityLevel, reliabilityLabel }
    reportModel = options.reportModel;
    viewState = options.viewState || 'OK';
    reliabilityLevel = options.reliabilityLevel;
    reliabilityLabel = options.reliabilityLabel;
  } else {
    // 기존 시그니처: (reportModel, viewState)
    reportModel = options;
    viewState = arguments[1] || 'OK';
    reliabilityLevel = null;
    reliabilityLabel = null;
  }
  try {
    // OK 상태에서만 생성
    if (viewState !== 'OK') {
      return null;
    }

    if (!reportModel || !reportModel.analysis) {
      return null;
    }

    // 1) WHY Top3 추출
    const whyResult = buildWhyReasons(reportModel);
    const whyTop3 = (whyResult.reasons || []).slice(0, 3).map(r => r.detail || r.title || '').filter(Boolean);

    // 2) Improvements Top3 추출 (evidence 기반 간소화 파싱)
    let improvementsTop3 = [];
    try {
      const evidenceList = [];
      if (reportModel.result && Array.isArray(reportModel.result.evidence)) {
        evidenceList.push(...reportModel.result.evidence);
      }
      if (reportModel.analysis?.scores?.contentStructureV2?.evidence && Array.isArray(reportModel.analysis.scores.contentStructureV2.evidence)) {
        evidenceList.push(...reportModel.analysis.scores.contentStructureV2.evidence);
      }

      if (evidenceList.length > 0) {
        const evidenceText = evidenceList.join(' ').toLowerCase();
        const checklist = [];
        
        // 간단한 액션 추출 (짧은 형태)
        if (evidenceText.includes('h1') && (evidenceText.includes('부재') || evidenceText.includes('없음') || evidenceText.match(/0개/))) {
          checklist.push('H1 제목 추가');
        }
        if (evidenceText.includes('리스트') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
          checklist.push('리스트 구조 추가');
        }
        if (evidenceText.includes('문단') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
          checklist.push('요약 문단 추가');
        }
        if (evidenceText.includes('h2') && (evidenceText.includes('부재') || evidenceText.match(/0개/) || evidenceText.includes('1개'))) {
          checklist.push('H2 섹션 추가');
        }
        if (evidenceText.includes('키워드') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
          checklist.push('핵심 키워드 강조');
        }
        
        improvementsTop3 = [...new Set(checklist)].slice(0, 3);
      }
    } catch (e) {
      // Improvements 추출 실패 시 무시
    }

    // 3) Reliability 정보 추출 (입력으로 받은 값 사용)
    // reliabilityLevel이 없으면 reliabilityLabel에서 추론
    if (!reliabilityLevel && reliabilityLabel) {
      const labelLower = String(reliabilityLabel).toLowerCase();
      if (labelLower === '높음' || labelLower === 'high') {
        reliabilityLevel = '높음';
      } else if (labelLower === '보통' || labelLower === 'medium' || labelLower === 'mid') {
        reliabilityLevel = '보통';
      } else if (labelLower === '낮음' || labelLower === 'low') {
        reliabilityLevel = '낮음';
      }
    }

    // 4) Action 후보 수집 및 출처 추적
    const actionCandidates = [];
    const actionSources = []; // { text, from, index } 배열
    
    // WHY Top3에서 최대 2개 추출 (출처 추적)
    whyTop3.slice(0, 2).forEach((detail, idx) => {
      const detailLower = detail.toLowerCase();
      let actionText = null;
      
      // 간단한 액션 추출
      if (detailLower.includes('h1') && (detailLower.includes('부재') || detailLower.includes('없음') || detailLower.match(/0개/))) {
        actionText = 'H1 제목 추가';
      } else if (detailLower.includes('리스트') && (detailLower.includes('부재') || detailLower.includes('없음'))) {
        actionText = '리스트 구조 추가';
      } else if (detailLower.includes('문단') && (detailLower.includes('부재') || detailLower.includes('없음'))) {
        actionText = '요약 문단 추가';
      } else if (detailLower.includes('brand') && detailLower.includes('미측정')) {
        actionText = '브랜드 정보 추가';
      } else if (detailLower.includes('url') && detailLower.includes('미측정')) {
        actionText = 'URL 구조 측정';
      }
      
      if (actionText && !actionCandidates.includes(actionText)) {
        actionCandidates.push(actionText);
        actionSources.push({ text: actionText, from: 'WHY', index: idx + 1 });
      }
    });

    // Improvements Top3 추가 (중복 제거, 출처 추적)
    improvementsTop3.forEach((item, idx) => {
      if (!actionCandidates.includes(item)) {
        actionCandidates.push(item);
        actionSources.push({ text: item, from: 'IMPROVEMENTS', index: idx + 1 });
      }
    });

    // Reliability summaryLine에서 액션 힌트 추출 (선택적, 출처 없음)
    if (reliabilitySummaryLine && actionCandidates.length < 3) {
      if (reliabilitySummaryLine.includes('결함') && !actionCandidates.some(a => a.includes('구조'))) {
        actionCandidates.push('콘텐츠 구조 개선');
        // Reliability는 출처로 표시하지 않음 (WHY/IMPROVEMENTS만)
      }
    }

    // ✅ [Phase 119] Reliability 레벨에 따른 프리픽스 결정
    let prefix = '다음 조치:'; // 기본값
    if (reliabilityLevel) {
      const levelLower = String(reliabilityLevel).toLowerCase();
      if (levelLower === '높음' || levelLower === 'high') {
        prefix = '권장 조치:';
      } else if (levelLower === '보통' || levelLower === 'medium' || levelLower === 'mid') {
        prefix = '우선 조치:';
      } else if (levelLower === '낮음' || levelLower === 'low') {
        prefix = '즉시 조치:';
      }
    }

    // 5) 최종 Action Line 생성 (2~3개, "→"로 연결, 최대 80자)
    if (actionCandidates.length === 0) {
      // Fallback: 조치가 없을 때 레벨별 메시지
      let fallbackText = '';
      if (reliabilityLevel) {
        const levelLower = String(reliabilityLevel).toLowerCase();
        if (levelLower === '높음' || levelLower === 'high') {
          fallbackText = '권장 조치: 개선 항목을 확인하세요';
        } else if (levelLower === '보통' || levelLower === 'medium' || levelLower === 'mid') {
          fallbackText = '권장 조치: 개선 항목을 확인하세요';
        } else {
          fallbackText = '즉시 조치: 측정/근거를 먼저 보강하세요';
        }
      } else {
        fallbackText = '우선 측정을 완료한 뒤 개선 항목을 확인하세요';
      }
      return { text: fallbackText, sources: [], prefix: prefix };
    }

    // 2~3개로 제한
    let finalActions = actionCandidates.slice(0, 3);
    let finalSources = actionSources.slice(0, 3);
    let actionLine = finalActions.join(' → ');

    // 길이 제한 (80자 초과 시 3개→2개로 축소, prefix 길이 고려)
    const prefixLength = prefix.length + 1; // prefix + 공백
    const maxActionLength = 80 - prefixLength;
    
    if (actionLine.length > maxActionLength && finalActions.length > 2) {
      const shortened = finalActions.slice(0, 2).join(' → ');
      if (shortened.length <= maxActionLength) {
        actionLine = shortened;
        finalActions = finalActions.slice(0, 2);
        finalSources = finalSources.slice(0, 2);
      } else {
        // 여전히 길면 첫 번째만 사용
        actionLine = finalActions[0];
        finalActions = finalActions.slice(0, 1);
        finalSources = finalSources.slice(0, 1);
        if (actionLine.length > maxActionLength) {
          actionLine = actionLine.substring(0, maxActionLength - 3) + '...';
        }
      }
    }

    // finalActions와 finalSources의 순서 일치 확인
    const matchedSources = finalActions.map(action => 
      finalSources.find(s => s.text === action) || { text: action, from: null, index: 0 }
    ).filter(s => s.from !== null);

    // prefix + actionLine 조합
    const finalText = actionLine.length > 0 ? `${prefix} ${actionLine}` : null;
    
    return finalText ? { text: finalText, sources: matchedSources, prefix: prefix } : null;
  } catch (e) {
    // 예외 발생 시 null 반환 (기존 UI 영향 없음)
    return null;
  }
}

/**
 * ✅ [Phase 117] Share 화면 상단 Action Line 생성 함수 (기존 호환성 유지)
 * WHY Top3 + Improvements Top3 + Reliability summaryLine을 종합해 단일 Action 문장 생성
 * @param {Object} reportModel - 리포트 모델 객체
 * @param {string} viewState - Share view state ('OK' | 'EXPIRED' | 'NO_REPORT' | etc.)
 * @returns {string|null} Action line 문구 (최대 80자, 2~3개 조치를 "→"로 연결) 또는 null
 */
export function buildShareActionLine(reportModel, viewState = 'OK') {
  // ✅ [Phase 118] V2를 호출하여 text만 반환 (기존 호환성 유지)
  const v2Result = buildShareActionLineV2({ reportModel, viewState });
  return v2Result ? v2Result.text : null;
}


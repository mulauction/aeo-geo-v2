/**
 * ✅ [Phase 12-2] WHY 패널 이유 생성 모듈
 * 읽기 전용 계산만 수행 (저장/부작용 없음)
 */

/**
 * ✅ [Phase 12-2] WHY 패널 이유 생성 함수
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

  // scores 읽기
  const scores = reportModel?.analysis?.scores || reportModel?.scores || {};

  // 측정 상태 확인 (읽기 전용)
  const brandingMeasured = Number.isFinite(scores?.branding?.score);
  const contentMeasured = scores?.contentStructureV2 != null && scores?.contentStructureV2 !== undefined;
  const urlMeasured = scores?.urlStructureV1 != null && scores?.urlStructureV1 !== undefined;

  // evidenceCount 읽기 (우선순위 순서)
  let evidenceCount = 0;
  if (reportModel?.analysis?.evidence?.items?.length != null) {
    evidenceCount = Number(reportModel.analysis.evidence.items.length) || 0;
  } else if (reportModel?.analysis?.evidence?.length != null) {
    evidenceCount = Number(reportModel.analysis.evidence.length) || 0;
  } else if (reportModel?.evidence?.items?.length != null) {
    evidenceCount = Number(reportModel.evidence.items.length) || 0;
  } else if (reportModel?.evidence?.length != null) {
    evidenceCount = Number(reportModel.evidence.length) || 0;
  }

  // urlConnection 읽기 (우선순위 순서)
  let urlConnection = false;
  if (reportModel?.analysis?.url?.connected === true) {
    urlConnection = true;
  } else if (reportModel?.url?.connected === true) {
    urlConnection = true;
  } else if (reportModel?.analysis?.urlConnected === true) {
    urlConnection = true;
  }

  // 이유 생성 (모든 가능한 이유를 먼저 생성)
  const allReasons = [];

  // (브랜드) brandingMeasured가 아니거나 evidenceCount가 0이면
  if (!brandingMeasured || evidenceCount === 0) {
    allReasons.push({
      key: 'brand',
      title: '브랜드',
      detail: '브랜드 근거 부족(문서 내 고유명/공식 링크 부족)'
    });
  }

  // (콘텐츠) contentMeasured가 아니면
  if (!contentMeasured) {
    allReasons.push({
      key: 'content',
      title: '콘텐츠 구조',
      detail: 'H3/리스트/FAQ 구조 근거 부족'
    });
  }

  // (URL) urlMeasured가 아니거나 urlConnection이 true가 아니면
  if (!urlMeasured || !urlConnection) {
    allReasons.push({
      key: 'url',
      title: 'URL 구조',
      detail: 'URL 측정 미실행(연결 미확인)'
    });
  }

  // level별 노출 필터링
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
    // low면 reasons 최대 3개(brand/content/url)
    reasons = allReasons.slice(0, 3);
  }

  return {
    level: normalizedLevelValue,
    reasons: reasons
  };
}


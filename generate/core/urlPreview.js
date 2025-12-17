/**
 * ✅ [Generate] URL 구조 점수 미리보기 (로컬 규칙)
 * URL 문자열만으로 점수를 계산하는 로컬 규칙 기반 미리보기
 * Phase 3의 analyze/urlStructureV1 점수 파이프라인과는 독립적
 */

/**
 * URL 파싱 및 검증
 * @param {string} urlInput - 입력 URL 문자열
 * @returns {URL|null} 파싱된 URL 객체 또는 null
 */
function parseUrl(urlInput) {
  if (!urlInput || typeof urlInput !== 'string') {
    return null;
  }

  let urlStr = urlInput.trim();
  
  // 프로토콜이 없으면 https:// 추가
  if (!urlStr.match(/^https?:\/\//i)) {
    urlStr = 'https://' + urlStr;
  }

  try {
    return new URL(urlStr);
  } catch (e) {
    return null;
  }
}

/**
 * path depth 계산 (짧을수록 가점)
 * @param {string} pathname - URL pathname
 * @returns {number} depth 점수 (0~30점)
 */
function scorePathDepth(pathname) {
  if (!pathname || pathname === '/') {
    return 30; // 최상위 경로는 최고점
  }

  const segments = pathname.split('/').filter(s => s.length > 0);
  const depth = segments.length;

  // depth 1: 30점, depth 2: 25점, depth 3: 20점, depth 4: 15점, depth 5+: 10점
  if (depth === 1) return 30;
  if (depth === 2) return 25;
  if (depth === 3) return 20;
  if (depth === 4) return 15;
  return 10;
}

/**
 * 의미있는 slug 가점
 * @param {string} pathname - URL pathname
 * @returns {number} slug 점수 (0~30점)
 */
function scoreSlugQuality(pathname) {
  if (!pathname || pathname === '/') {
    return 0;
  }

  const segments = pathname.split('/').filter(s => s.length > 0);
  let score = 0;

  for (const segment of segments) {
    // 한글 포함 (가점)
    if (/[\uAC00-\uD7A3]/.test(segment)) {
      score += 8;
    }
    
    // 영문 단어 포함 (하이픈으로 구분된 경우 가점)
    if (/^[a-z]+(-[a-z]+)+$/i.test(segment)) {
      score += 8;
    }
    
    // 영문 단어만 (하이픈 없이)
    if (/^[a-z]+$/i.test(segment) && segment.length >= 3) {
      score += 5;
    }
    
    // 숫자만 가득한 경우 감점
    if (/^\d+$/.test(segment)) {
      score -= 5;
    }
    
    // 랜덤 토큰 같은 긴 세그먼트 감점 (32자 이상)
    if (segment.length >= 32) {
      score -= 10;
    }
    
    // UUID 형식 감점
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      score -= 10;
    }
  }

  return Math.max(0, Math.min(30, score));
}

/**
 * query params 감점
 * @param {URLSearchParams} searchParams - URL search params
 * @returns {number} query 점수 (0~20점, 감점 방식)
 */
function scoreQueryParams(searchParams) {
  if (!searchParams || searchParams.toString().length === 0) {
    return 20; // query 없으면 최고점
  }

  const params = Array.from(searchParams.keys());
  let score = 20;

  // 과도한 query params 감점
  if (params.length > 5) {
    score -= 10;
  } else if (params.length > 3) {
    score -= 5;
  }

  // utm, ref, session 등 트래킹 파라미터 감점
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'referrer', 'session', 'sessionid', 'tracking', 'track'];
  for (const param of params) {
    if (trackingParams.some(tp => param.toLowerCase().includes(tp))) {
      score -= 3;
    }
  }

  return Math.max(0, score);
}

/**
 * URL 구조 점수 계산 (로컬 규칙 미리보기)
 * @param {string} urlInput - 입력 URL 문자열
 * @returns {{score: number, grade: string, reasons: string[]}|null} 점수 결과 또는 null (파싱 실패)
 */
export function calculateUrlPreviewScore(urlInput) {
  const url = parseUrl(urlInput);
  
  if (!url) {
    return null; // 파싱 실패
  }

  // 각 항목별 점수 계산
  const depthScore = scorePathDepth(url.pathname);
  const slugScore = scoreSlugQuality(url.pathname);
  const queryScore = scoreQueryParams(url.searchParams);

  // 총점 계산 (0~100)
  const totalScore = Math.round(depthScore + slugScore + queryScore);

  // 등급 결정
  let grade;
  if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 60) grade = 'B';
  else if (totalScore >= 40) grade = 'C';
  else grade = 'D';

  // 이유 생성 (3줄 정도)
  const reasons = [];
  
  if (depthScore >= 25) {
    reasons.push('경로 깊이가 적절합니다');
  } else if (depthScore <= 10) {
    reasons.push('경로가 너무 깊습니다');
  } else {
    reasons.push('경로 깊이가 보통입니다');
  }

  if (slugScore >= 20) {
    reasons.push('의미있는 슬러그가 포함되어 있습니다');
  } else if (slugScore <= 5) {
    reasons.push('슬러그가 불명확하거나 숫자/토큰 위주입니다');
  } else {
    reasons.push('슬러그 품질이 보통입니다');
  }

  if (queryScore >= 15) {
    reasons.push('쿼리 파라미터가 적절합니다');
  } else {
    reasons.push('쿼리 파라미터가 과도하거나 트래킹 파라미터가 많습니다');
  }

  return {
    score: totalScore,
    grade: grade,
    reasons: reasons.slice(0, 3)
  };
}


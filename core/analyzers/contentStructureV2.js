/**
 * ✅ [Phase 3-2B] Content Structure V2 분석기
 * 순수 함수로 구현되어 상태 저장/로컬스토리지 직접 접근 금지
 * 
 * ⚠️ [PRODUCT_PRINCIPLES] Score Mutation 허용 함수
 * 
 * 이 모듈은 Analyze 단계에서만 호출되어야 합니다.
 * - ✅ Analyze 단계에서 점수를 계산합니다
 * - ❌ Generate나 Amplify 단계에서 호출되어서는 안 됩니다
 * - ❌ 점수를 변경하거나 재계산하는 용도로 사용되어서는 안 됩니다
 */

/**
 * 점수를 등급으로 변환
 */
function scoreToGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

/**
 * HTML 문자열에서 텍스트만 추출
 */
function extractText(html) {
  if (!html) return '';
  // 간단한 HTML 태그 제거 (실제로는 DOMParser 사용하는 것이 더 정확하지만 순수 함수 유지)
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 제목 구조 체크 (h1, h2, h3 등)
 */
function checkHeadingStructure(text) {
  const h1Matches = text.match(/<h1[^>]*>/gi) || [];
  const h2Matches = text.match(/<h2[^>]*>/gi) || [];
  const h3Matches = text.match(/<h3[^>]*>/gi) || [];
  
  let score = 0;
  const evidence = [];
  
  if (h1Matches.length > 0) {
    score += 20;
    evidence.push('H1 제목 존재');
  } else {
    evidence.push('H1 제목 부재');
  }
  
  if (h2Matches.length >= 2) {
    score += 15;
    evidence.push('H2 제목 2개 이상');
  } else if (h2Matches.length === 1) {
    score += 10;
    evidence.push('H2 제목 1개');
  } else {
    evidence.push('H2 제목 부재');
  }
  
  if (h3Matches.length > 0) {
    score += 5;
    evidence.push('H3 제목 존재');
  }
  
  return { score: Math.min(score, 40), evidence };
}

/**
 * 요약 문단 체크 (첫 100자 내 요약성 문단)
 */
function checkSummaryParagraph(text) {
  const paragraphs = text.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  if (paragraphs.length === 0) {
    return { score: 0, evidence: ['문단 구조 부재'] };
  }
  
  const firstParagraph = extractText(paragraphs[0]);
  const firstParagraphLength = firstParagraph.length;
  
  let score = 0;
  const evidence = [];
  
  if (firstParagraphLength >= 50 && firstParagraphLength <= 200) {
    score += 15;
    evidence.push('적절한 길이의 첫 문단');
  } else if (firstParagraphLength > 0) {
    score += 5;
    evidence.push('첫 문단 존재 (길이 부적절)');
  }
  
  // 요약성 키워드 체크
  const summaryKeywords = ['요약', '개요', '소개', '개념', '특징', '주요'];
  const hasSummaryKeyword = summaryKeywords.some(kw => firstParagraph.includes(kw));
  if (hasSummaryKeyword) {
    score += 5;
    evidence.push('요약성 키워드 포함');
  }
  
  return { score: Math.min(score, 20), evidence };
}

/**
 * 리스트 사용 체크 (ul, ol)
 */
function checkListUsage(text) {
  const ulMatches = text.match(/<ul[^>]*>[\s\S]*?<\/ul>/gi) || [];
  const olMatches = text.match(/<ol[^>]*>[\s\S]*?<\/ol>/gi) || [];
  const liMatches = text.match(/<li[^>]*>/gi) || [];
  
  let score = 0;
  const evidence = [];
  
  const totalLists = ulMatches.length + olMatches.length;
  if (totalLists >= 2) {
    score += 15;
    evidence.push('리스트 2개 이상');
  } else if (totalLists === 1) {
    score += 10;
    evidence.push('리스트 1개');
  } else {
    evidence.push('리스트 부재');
  }
  
  if (liMatches.length >= 5) {
    score += 5;
    evidence.push('리스트 항목 5개 이상');
  }
  
  return { score: Math.min(score, 20), evidence };
}

/**
 * 섹션 분리 체크 (section, div, article 등)
 */
function checkSectionSeparation(text) {
  const sectionMatches = text.match(/<section[^>]*>/gi) || [];
  const articleMatches = text.match(/<article[^>]*>/gi) || [];
  const divMatches = text.match(/<div[^>]*>/gi) || [];
  
  let score = 0;
  const evidence = [];
  
  const semanticSections = sectionMatches.length + articleMatches.length;
  if (semanticSections >= 2) {
    score += 10;
    evidence.push('시맨틱 섹션 2개 이상');
  } else if (semanticSections === 1) {
    score += 5;
    evidence.push('시맨틱 섹션 1개');
  }
  
  if (divMatches.length >= 3) {
    score += 5;
    evidence.push('구조적 분리 (div 3개 이상)');
  }
  
  return { score: Math.min(score, 15), evidence };
}

/**
 * 키워드 명시 체크 (strong, em, mark 등)
 */
function checkKeywordEmphasis(text) {
  const strongMatches = text.match(/<strong[^>]*>/gi) || [];
  const emMatches = text.match(/<em[^>]*>/gi) || [];
  const markMatches = text.match(/<mark[^>]*>/gi) || [];
  const bMatches = text.match(/<b[^>]*>/gi) || [];
  
  let score = 0;
  const evidence = [];
  
  const totalEmphasis = strongMatches.length + emMatches.length + markMatches.length + bMatches.length;
  if (totalEmphasis >= 5) {
    score += 10;
    evidence.push('키워드 강조 5개 이상');
  } else if (totalEmphasis >= 2) {
    score += 5;
    evidence.push('키워드 강조 2개 이상');
  } else {
    evidence.push('키워드 강조 부족');
  }
  
  return { score: Math.min(score, 10), evidence };
}

/**
 * CTA 문맥 체크 (버튼, 링크, 액션 관련)
 */
function checkCtaContext(text) {
  const buttonMatches = text.match(/<button[^>]*>/gi) || [];
  const linkMatches = text.match(/<a[^>]*>/gi) || [];
  const ctaKeywords = ['구매', '신청', '문의', '연락', '더보기', '자세히', '지금', '바로'];
  
  const plainText = extractText(text);
  const hasCtaKeyword = ctaKeywords.some(kw => plainText.includes(kw));
  
  let score = 0;
  const evidence = [];
  
  if (buttonMatches.length > 0) {
    score += 5;
    evidence.push('버튼 요소 존재');
  }
  
  if (linkMatches.length >= 2) {
    score += 3;
    evidence.push('링크 2개 이상');
  }
  
  if (hasCtaKeyword) {
    score += 2;
    evidence.push('CTA 키워드 포함');
  }
  
  return { score: Math.min(score, 10), evidence };
}

/**
 * 중복/빈 문단 체크
 */
function checkDuplicateEmptyParagraphs(text) {
  const paragraphs = text.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  if (paragraphs.length === 0) {
    return { score: 0, evidence: ['문단 없음'] };
  }
  
  let score = 10;
  const evidence = [];
  
  // 빈 문단 체크
  const emptyParagraphs = paragraphs.filter(p => {
    const content = extractText(p);
    return content.trim().length === 0;
  });
  
  if (emptyParagraphs.length > 0) {
    score -= emptyParagraphs.length * 2;
    evidence.push(`빈 문단 ${emptyParagraphs.length}개`);
  }
  
  // 중복 문단 체크 (간단한 휴리스틱)
  const paragraphTexts = paragraphs.map(p => extractText(p).toLowerCase().substring(0, 50));
  const uniqueParagraphs = new Set(paragraphTexts);
  const duplicateRatio = 1 - (uniqueParagraphs.size / paragraphTexts.length);
  
  if (duplicateRatio > 0.3) {
    score -= 5;
    evidence.push('중복 문단 다수');
  }
  
  return { score: Math.max(score, 0), evidence };
}

/**
 * ✅ [Phase 3-2B] Content Structure V2 계산 함수
 * @param {string} input - 분석할 HTML 텍스트
 * @returns {{score: number, grade: string, evidence: string[]} | null}
 */
export function computeContentStructureV2(input) {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return null;
  }
  
  try {
    const checks = [
      { name: '제목 구조', ...checkHeadingStructure(input), weight: 0.25 },
      { name: '요약 문단', ...checkSummaryParagraph(input), weight: 0.15 },
      { name: '리스트 사용', ...checkListUsage(input), weight: 0.20 },
      { name: '섹션 분리', ...checkSectionSeparation(input), weight: 0.15 },
      { name: '키워드 명시', ...checkKeywordEmphasis(input), weight: 0.10 },
      { name: 'CTA 문맥', ...checkCtaContext(input), weight: 0.10 },
      { name: '중복/빈 문단', ...checkDuplicateEmptyParagraphs(input), weight: 0.05 },
    ];
    
    // 가중 평균 계산
    let totalScore = 0;
    let totalWeight = 0;
    const allEvidence = [];
    
    for (const check of checks) {
      const weightedScore = check.score * check.weight;
      totalScore += weightedScore;
      totalWeight += check.weight;
      
      if (check.evidence && check.evidence.length > 0) {
        allEvidence.push(...check.evidence.map(e => `${check.name}: ${e}`));
      }
    }
    
    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    const grade = scoreToGrade(finalScore);
    
    return {
      score: Math.max(0, Math.min(100, finalScore)),
      grade,
      evidence: allEvidence.length > 0 ? allEvidence : ['분석 결과 없음']
    };
  } catch (error) {
    // 계산 실패 시 null 반환
    return null;
  }
}

/**
 * ✅ [Phase 3-2B] 최소 검증 테스트 케이스
 * DEBUG 플래그가 있을 때만 실행
 */
if (globalThis.DEBUG) {
  // 테스트 케이스 1: 구조가 잘 된 콘텐츠 → 70점 이상 기대
  const goodContent = `
    <h1>프리미엄 무선 이어폰 Pro Max</h1>
    <div class="summary">
      <p>프리미엄 무선 이어폰 Pro Max는 최고급 오디오 품질과 편안한 착용감을 제공하는 차세대 무선 이어폰입니다.</p>
    </div>
    <h2>주요 특징</h2>
    <h3>USP (Unique Selling Points)</h3>
    <ul>
      <li>프리미엄 오디오 품질: 40mm 드라이버로 깊고 풍부한 베이스</li>
      <li>적응형 노이즈 캔슬링: 주변 소음을 지능적으로 차단</li>
      <li>30시간 연속 재생: 충전 케이스 포함 시 최대 30시간</li>
    </ul>
    <h2>자주 묻는 질문</h2>
    <p><strong>배터리는 얼마나 오래 가나요?</strong></p>
    <p>이어폰 본체만으로 8시간, 충전 케이스와 함께 사용하면 최대 30시간까지 사용할 수 있습니다.</p>
    <p><a href="/products">다른 제품 보기</a> | <a href="/support">고객 지원</a></p>
    <button>지금 구매하기</button>
  `;
  
  // 테스트 케이스 2: 구조가 거의 없는 콘텐츠 → 30점 이하 기대
  const badContent = `
    <p>무선 이어폰을 판매합니다. 좋은 음질과 합리적인 가격을 제공합니다.</p>
    <p>이 제품은 블루투스로 연결되며, 배터리 수명은 약 10시간입니다.</p>
    <p>운동 중에도 사용할 수 있고, 편안한 착용감을 제공합니다.</p>
    <p>자세한 내용은 문의해주세요.</p>
  `;
  
  const testGood = computeContentStructureV2(goodContent);
  const testBad = computeContentStructureV2(badContent);
  
  console.log('[TEST] 구조가 잘 된 콘텐츠:', testGood?.score, testGood?.grade, testGood?.score >= 70 ? '✅' : '❌');
  console.log('[TEST] 구조가 거의 없는 콘텐츠:', testBad?.score, testBad?.grade, testBad?.score <= 30 ? '✅' : '❌');
}


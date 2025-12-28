/**
 * ✅ [Phase 4-1A] 룰 기반 개선안 생성 모듈
 * evidence를 기반으로 체크리스트와 HTML skeleton 생성
 * 외부 API 호출 금지 (순수 룰 기반)
 */

/**
 * HTML 이스케이프 함수
 */
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * evidence에서 부족한 항목을 파싱하여 체크리스트 생성
 * @param {string[]} evidenceList - evidence 배열
 * @returns {string[]} 체크리스트 항목 배열
 */
function parseEvidenceToChecklist(evidenceList) {
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return [];
  }

  const checklist = [];
  const evidenceText = evidenceList.join(' ').toLowerCase();

  // 제목 구조 관련
  if (evidenceText.includes('h1') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('H1 제목 추가: 상품명을 H1 태그로 명확히 표시');
  }
  if (evidenceText.includes('h2') && (evidenceText.includes('부재') || evidenceText.includes('없음') || evidenceText.includes('1개'))) {
    checklist.push('H2 제목 추가: 주요 섹션을 H2로 구분 (최소 2개 이상)');
  }
  if (evidenceText.includes('h3') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('H3 제목 추가: 세부 섹션을 H3로 구분');
  }

  // 요약/문단 관련
  if (evidenceText.includes('요약') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('상단 요약 블록 추가: 첫 5~7줄에 상품 핵심 정보 요약');
  }
  if (evidenceText.includes('첫 문단') && (evidenceText.includes('부재') || evidenceText.includes('부적절'))) {
    checklist.push('첫 문단 최적화: 50~200자 길이의 요약성 첫 문단 작성');
  }
  if (evidenceText.includes('요약성 키워드') && evidenceText.includes('포함') === false) {
    checklist.push('요약성 키워드 추가: "요약", "개요", "특징", "주요" 등 키워드 포함');
  }

  // 리스트 관련
  if (evidenceText.includes('리스트') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('리스트 구조 추가: USP/스펙을 ul/ol 리스트로 구조화');
  }
  if (evidenceText.includes('리스트') && evidenceText.includes('1개')) {
    checklist.push('리스트 확장: 최소 2개 이상의 리스트 블록 추가');
  }
  if (evidenceText.includes('리스트 항목') && !evidenceText.includes('5개 이상')) {
    checklist.push('리스트 항목 확장: 각 리스트에 최소 5개 이상의 항목 추가');
  }

  // 섹션 분리 관련
  if (evidenceText.includes('섹션') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('섹션 구조 추가: section 또는 article 태그로 콘텐츠 구분');
  }
  if (evidenceText.includes('구조적 분리') && !evidenceText.includes('3개 이상')) {
    checklist.push('구조적 분리 강화: div 또는 시맨틱 태그로 섹션 분리');
  }

  // 키워드 강조 관련
  if (evidenceText.includes('키워드 강조') && (evidenceText.includes('부족') || evidenceText.includes('없음'))) {
    checklist.push('키워드 강조 추가: strong, em, mark 태그로 핵심 키워드 강조');
  }
  if (evidenceText.includes('키워드 강조') && !evidenceText.includes('5개 이상')) {
    checklist.push('키워드 강조 확장: 최소 5개 이상의 키워드 강조');
  }

  // CTA 관련
  if (evidenceText.includes('버튼') && (evidenceText.includes('부재') || evidenceText.includes('없음'))) {
    checklist.push('CTA 버튼 추가: 구매/문의 버튼 요소 추가');
  }
  if (evidenceText.includes('cta 키워드') && evidenceText.includes('포함') === false) {
    checklist.push('CTA 키워드 추가: "구매", "신청", "문의", "지금" 등 액션 키워드 포함');
  }

  // 중복/빈 문단 관련
  if (evidenceText.includes('빈 문단')) {
    checklist.push('빈 문단 제거: 내용이 없는 빈 p 태그 제거');
  }
  if (evidenceText.includes('중복 문단')) {
    checklist.push('중복 콘텐츠 제거: 유사하거나 중복된 문단 정리');
  }

  // 기본 체크리스트 (evidence가 부족한 경우)
  if (checklist.length === 0) {
    checklist.push(
      'H1 제목 추가: 상품명을 H1 태그로 명확히 표시',
      '상단 요약 블록 추가: 첫 5~7줄에 상품 핵심 정보 요약',
      '리스트 구조 추가: USP/스펙을 ul/ol 리스트로 구조화',
      'H2 제목 추가: 주요 섹션을 H2로 구분 (최소 2개 이상)',
      'FAQ 섹션 추가: 자주 묻는 질문 3개 이상 구성',
      '키워드 강조 추가: strong, em 태그로 핵심 키워드 강조',
      'CTA 버튼 추가: 구매/문의 버튼 요소 추가'
    );
  }

  // 중복 제거 및 최대 10개로 제한
  return [...new Set(checklist)].slice(0, 10);
}

/**
 * HTML skeleton 생성
 * @param {Object} report - 리포트 객체
 * @returns {string} HTML skeleton 문자열
 */
function generateHtmlSkeleton(report) {
  const input = report.input || '상품명';
  const productName = input.split(' ').pop() || '상품명';
  
  return `<!-- ✅ [Phase 4-1A] 개선안 HTML Skeleton -->
<h1>${esc(productName)}</h1>

<!-- 상단 요약 블록 (5~7줄) -->
<div class="summary">
  <p>${esc(productName)}는 [핵심 특징 1], [핵심 특징 2], [핵심 특징 3]을 제공하는 [카테고리]입니다.</p>
  <p>[주요 사용 사례나 타겟 고객 설명]</p>
  <p>[핵심 가치 제안 또는 차별화 포인트]</p>
</div>

<!-- 주요 특징/USP 리스트 -->
<h2>주요 특징</h2>
<ul>
  <li><strong>USP 1:</strong> [첫 번째 핵심 특징 설명]</li>
  <li><strong>USP 2:</strong> [두 번째 핵심 특징 설명]</li>
  <li><strong>USP 3:</strong> [세 번째 핵심 특징 설명]</li>
  <li><strong>USP 4:</strong> [네 번째 핵심 특징 설명]</li>
  <li><strong>USP 5:</strong> [다섯 번째 핵심 특징 설명]</li>
</ul>

<!-- 상세 스펙 리스트 -->
<h2>상세 스펙</h2>
<ul>
  <li><strong>스펙 항목 1:</strong> [상세 정보]</li>
  <li><strong>스펙 항목 2:</strong> [상세 정보]</li>
  <li><strong>스펙 항목 3:</strong> [상세 정보]</li>
</ul>

<!-- FAQ 섹션 -->
<h2>자주 묻는 질문</h2>
<h3>Q1: [자주 묻는 질문 1]</h3>
<p>A: [답변 내용 1]</p>

<h3>Q2: [자주 묻는 질문 2]</h3>
<p>A: [답변 내용 2]</p>

<h3>Q3: [자주 묻는 질문 3]</h3>
<p>A: [답변 내용 3]</p>

<!-- CTA 버튼 -->
<div class="cta-section">
  <button class="btn-primary">지금 구매하기</button>
  <a href="/contact">문의하기</a>
</div>`;
}

/**
 * ✅ [Phase 4-1A] 리포트에서 개선안 생성
 * @param {Object} report - 리포트 객체 (buildReportPayload() 결과)
 * @returns {string} HTML 문자열
 */
export function buildImprovementsFromReport(report) {
  if (!report) {
    return '<div style="padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted);">리포트 데이터가 없습니다.</div>';
  }

  // evidence 수집
  const evidenceList = [];
  
  // result.evidence 수집
  if (report.result && Array.isArray(report.result.evidence)) {
    evidenceList.push(...report.result.evidence);
  }
  
  // contentStructureV2.evidence 수집
  if (report.analysis?.scores?.contentStructureV2?.evidence && Array.isArray(report.analysis.scores.contentStructureV2.evidence)) {
    evidenceList.push(...report.analysis.scores.contentStructureV2.evidence);
  }

  // 체크리스트 생성
  const checklist = parseEvidenceToChecklist(evidenceList);

  // HTML skeleton 생성
  const htmlSkeleton = generateHtmlSkeleton(report);

  // URL 구조 점수 확인
  const urlStructureScore = report.analysis?.scores?.urlStructureV1;
  const needsUrlStructure = !urlStructureScore || urlStructureScore.score === null || urlStructureScore.score === undefined;

  let urlStructureSection = '';
  if (needsUrlStructure) {
    urlStructureSection = `
      <div style="margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border);">
        <h4 style="margin: 0 0 8px 0;">URL 구조 개선</h4>
        <ul style="margin: 0; padding-left: 24px;">
          <li>URL 구조 점수 측정: <a href="./generate/index.html#url" data-cta="url-structure">URL 구조 점수 측정하기</a></li>
          <li>URL에 상품명/브랜드명 포함: /products/[상품명] 형식 권장</li>
        </ul>
      </div>
    `;
  }

  return `
    <div style="padding: 16px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border);">
      <h3 style="margin: 0 0 16px 0;">개선 체크리스트</h3>
      <ul style="margin: 0 0 16px 0; padding-left: 24px;">
        ${checklist.map(item => `<li style="margin-bottom: 8px;">${esc(item)}</li>`).join('')}
      </ul>
      
      <h3 style="margin: 16px 0 8px 0;">복붙용 HTML Skeleton</h3>
      <pre style="background: var(--background); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); overflow-x: auto; font-size: 12px; line-height: 1.5;"><code>${esc(htmlSkeleton)}</code></pre>
      
      ${urlStructureSection}
      
      <button id="btnAiImprove" class="btn btn-primary" style="width: 100%; margin-top: 16px;">AI 개선 생성 (테스트)</button>
    </div>
  `;
}


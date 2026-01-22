/**
 * Phase 171: Execution MVP - AI-friendly HTML 구조 생성
 * 
 * ⚠️ [PRODUCT_PRINCIPLES] Execution MVP - Score Mutation 금지
 * 
 * 이 모듈은 Execution HTML 생성만 담당합니다.
 * 
 * 절대 금지 사항:
 * - ❌ analysis.scores를 계산하거나 변경할 수 없습니다
 * - ❌ reportModel의 점수/분석 데이터를 변경할 수 없습니다
 * 
 * 허용되는 것:
 * - ✅ reportModel에서 존재하는 값만 읽어서 HTML 생성
 * - ✅ 없는 정보는 생성/추측 금지 (빈 문자열/placeholder 금지)
 */

const EXECUTION_HISTORY_KEY = 'execution_history_v1';
const MAX_HISTORY_ITEMS = 10;

/**
 * Execution HTML 생성
 * @param {Object} reportModel - 리포트 모델 객체
 * @returns {{html: string, meta: Object}} 생성된 HTML과 메타 정보
 */
export function buildExecutionMVP(reportModel) {
  if (!reportModel || typeof reportModel !== 'object') {
    return { html: '', meta: {} };
  }

  // reportModel에서 존재하는 값만 사용
  const targetUrl = reportModel.input?.url || reportModel.url || '';
  const reportId = reportModel.reportId || reportModel.meta?.reportId || reportModel.meta?.id || '';
  const score = typeof reportModel.analysis?.scores?.overall === 'number' 
    ? reportModel.analysis.scores.overall 
    : null;
  
  // 분석 항목들 (존재하는 것만)
  const brandingScore = typeof reportModel.analysis?.scores?.branding === 'number'
    ? reportModel.analysis.scores.branding
    : null;
  const contentStructure = reportModel.analysis?.contentStructureV2 || null;
  const urlStructure = reportModel.analysis?.urlStructureV1 || null;

  // WHY 항목들 (존재하는 것만)
  const whyItems = Array.isArray(reportModel.analysis?.why) 
    ? reportModel.analysis.why.filter(item => item && typeof item === 'object')
    : [];

  // Improvements 항목들 (존재하는 것만)
  const improvements = Array.isArray(reportModel.improvements)
    ? reportModel.improvements.filter(item => item && typeof item === 'object')
    : [];

  // HTML 생성 (AI-friendly 구조)
  const sections = [];

  // 헤더 섹션
  if (targetUrl) {
    sections.push(`<section>
  <h1>상품 페이지 구조 분석</h1>
  <p>분석 대상: ${escapeHtml(targetUrl)}</p>
</section>`);
  }

  // 점수 섹션
  if (score !== null) {
    sections.push(`<section>
  <h2>종합 점수</h2>
  <p>${score}점</p>
</section>`);
  }

  // 분석 항목 섹션
  const analysisItems = [];
  if (brandingScore !== null) {
    analysisItems.push(`<li>브랜딩: ${brandingScore}점</li>`);
  }
  if (contentStructure !== null) {
    analysisItems.push(`<li>구조: ${contentStructure}</li>`);
  }
  if (urlStructure !== null) {
    analysisItems.push(`<li>URL: ${urlStructure}</li>`);
  }
  if (analysisItems.length > 0) {
    sections.push(`<section>
  <h2>세부 분석</h2>
  <ul>
${analysisItems.join('\n')}
  </ul>
</section>`);
  }

  // WHY 섹션
  if (whyItems.length > 0) {
    const whyList = whyItems.map((item, idx) => {
      const text = item.text || item.reason || '';
      return text ? `    <li>${escapeHtml(text)}</li>` : '';
    }).filter(Boolean);
    
    if (whyList.length > 0) {
      sections.push(`<section>
  <h2>핵심 근거</h2>
  <ul>
${whyList.join('\n')}
  </ul>
</section>`);
    }
  }

  // 개선사항 섹션
  if (improvements.length > 0) {
    const impList = improvements.map((item, idx) => {
      const text = item.text || item.title || item.description || '';
      return text ? `    <li>${escapeHtml(text)}</li>` : '';
    }).filter(Boolean);
    
    if (impList.length > 0) {
      sections.push(`<section>
  <h2>개선 제안</h2>
  <ul>
${impList.join('\n')}
  </ul>
</section>`);
    }
  }

  const html = sections.length > 0 ? sections.join('\n\n') : '';

  return {
    html,
    meta: {
      reportId: String(reportId || ''),
      targetUrl: String(targetUrl || ''),
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Execution 히스토리 저장
 * @param {Object} entry - 저장할 항목
 */
export function saveExecutionHistory(entry) {
  if (!entry || typeof entry !== 'object') return;
  
  try {
    const existing = loadExecutionHistory();
    const newEntry = {
      reportId: String(entry.reportId || ''),
      targetUrl: String(entry.targetUrl || ''),
      createdAt: String(entry.createdAt || new Date().toISOString()),
      html: String(entry.html || ''),
      mode: 'manual'
    };

    // 중복 제거 (같은 reportId는 최신 것으로 교체)
    const filtered = existing.filter(item => item.reportId !== newEntry.reportId);
    
    // 최신 항목을 앞에 추가
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(EXECUTION_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[ExecutionMVP] Failed to save history:', e);
  }
}

/**
 * Execution 히스토리 로드
 * @returns {Array} 히스토리 배열
 */
export function loadExecutionHistory() {
  try {
    const raw = localStorage.getItem(EXECUTION_HISTORY_KEY);
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[ExecutionMVP] Failed to load history:', e);
    return [];
  }
}

/**
 * HTML 이스케이프 헬퍼
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

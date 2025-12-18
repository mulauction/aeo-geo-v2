import { appendEvidence } from "./evidenceStore.js";
import { getState } from "./state.js";

/**
 * ✅ [Phase 5-7] 현재 분석 결과 기반 read-only Evidence 요약 생성
 * 더미 데이터를 제거하고 실제 분석 결과를 읽어서 Evidence items 구성
 */
export function buildEvidenceFromViewContext(ctx) {
  const state = getState();
  const scores = state.analysis?.scores || {};
  const result = state.result;
  
  const items = [];
  let itemIdCounter = 1;
  
  // 1) 브랜딩 점수 (엔티티 점수)
  const branding = scores.branding;
  if (branding && branding.score !== null && branding.score !== undefined) {
    const gradeText = branding.grade || 'N/A';
    const statusText = branding.score >= 80 ? '브랜드 인지도가 높습니다' : 
                       branding.score >= 60 ? '브랜드 인지도가 보통입니다' : 
                       '브랜드 인지도 개선이 필요합니다';
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '엔티티',
      title: `엔티티 점수: ${branding.score}점 (${gradeText})`,
      detail: statusText
    });
  } else {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '엔티티',
      title: '엔티티 점수: 측정 필요',
      detail: '브랜드/상품 엔티티 점수가 측정되지 않았습니다.'
    });
  }
  
  // 2) 콘텐츠 구조 점수
  const contentStructureV2 = scores.contentStructureV2;
  if (contentStructureV2 && contentStructureV2.score !== null && contentStructureV2.score !== undefined) {
    let evidenceSummary = '';
    if (contentStructureV2.evidence && Array.isArray(contentStructureV2.evidence)) {
      const passedChecks = contentStructureV2.evidence.filter(e => 
        !e.includes('부재') && !e.includes('부족') && !e.includes('없음')
      ).length;
      const failedChecks = contentStructureV2.evidence.length - passedChecks;
      evidenceSummary = `구조 점검: 통과 ${passedChecks} / 미흡 ${failedChecks}`;
      
      // 대표 체크 항목 1~2개 선택
      const representativeChecks = contentStructureV2.evidence
        .filter(e => !e.includes('부재') && !e.includes('부족') && !e.includes('없음'))
        .slice(0, 2)
        .map(e => {
          const parts = e.split(':');
          return parts.length > 1 ? parts[1].trim() : e;
        });
      
      if (representativeChecks.length > 0) {
        evidenceSummary += ` (${representativeChecks.join(', ')})`;
      }
    }
    
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '구조',
      title: `콘텐츠 구조 점수: ${contentStructureV2.score}점 (${contentStructureV2.grade || 'N/A'})`,
      detail: evidenceSummary || '콘텐츠 구조 점수가 측정되었습니다.'
    });
  } else {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '구조',
      title: '콘텐츠 구조 점수: 측정 필요',
      detail: '콘텐츠 구조 점수가 측정되지 않았습니다.'
    });
  }
  
  // 3) URL 구조 점수
  const urlStructureV1 = scores.urlStructureV1;
  if (urlStructureV1 && urlStructureV1.score !== null && urlStructureV1.score !== undefined) {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: 'URL',
      title: `URL 구조 점수: ${urlStructureV1.score}점 (${urlStructureV1.grade || 'N/A'})`,
      detail: 'URL 구조 점수가 측정되었고 연결 상태가 확인되었습니다.'
    });
  } else {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: 'URL',
      title: 'URL 구조 점수: 측정 필요',
      detail: 'URL 구조 점수가 측정되지 않았습니다.'
    });
  }
  
  // 4) result.evidence 근거 리스트 (있으면 포함)
  if (result && result.evidence && Array.isArray(result.evidence) && result.evidence.length > 0) {
    // 근거 리스트를 요약하여 표시 (최대 2개)
    const evidenceItems = result.evidence.slice(0, 2);
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '근거',
      title: `분석 근거 (${result.evidence.length}개 항목)`,
      detail: evidenceItems.join('; ')
    });
  } else {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '근거',
      title: '분석 근거: 측정 필요',
      detail: '분석 근거가 생성되지 않았습니다.'
    });
  }
  
  // 5) 전체 점수 요약 (최소 5개를 위해 추가)
  if (result && result.score !== null && result.score !== undefined) {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '종합',
      title: `종합 점수: ${result.score}점 / ${result.grade || 'N/A'}`,
      detail: result.summary || '전체 분석 결과 요약'
    });
  } else {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '종합',
      title: '종합 점수: 측정 필요',
      detail: '종합 점수가 계산되지 않았습니다.'
    });
  }
  
  // 최소 5개 보장 (부족하면 추가)
  while (items.length < 5) {
    items.push({
      id: `item-${itemIdCounter++}`,
      label: '기타',
      title: '추가 정보: 측정 필요',
      detail: '추가 분석 정보가 필요합니다.'
    });
  }
  
  const entry = {
    meta: {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      source: "phase5-7-readonly-v1"
    },
    items: items
  };
  
  appendEvidence(entry);
  
  return entry;
}


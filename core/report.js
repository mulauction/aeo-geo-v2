import { getState } from "./state.js";

/**
 * ✅ [Phase 3-2D] 리포트 모델 생성 함수
 * 리포트 export/share에서 사용할 리포트 payload 생성
 * @returns {Object} 리포트 payload 객체
 */
export function buildReportPayload() {
  const state = getState();
  
  // ✅ [Phase 3-2D] analysis.scores를 그대로 전달 (가공/합산/재계산 금지)
  const reportPayload = {
    input: state.input || null,
    result: state.result || null,
    analysis: {
      scores: state.analysis?.scores || {
        branding: null,
        contentStructureV2: null,
        urlStructureV1: null
      }
    },
    generatedAt: Date.now()
  };
  
  return reportPayload;
}


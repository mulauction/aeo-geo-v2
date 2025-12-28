const STATE_KEY = "aeo_state_v2";

// ✅ [Phase 3-2A] analysis.scores 정식 스키마 슬롯 정의
export const ANALYSIS_SCORE_SLOTS = ['branding', 'contentStructureV2', 'urlStructureV1'];

export const initialState = {
    input: "",
    phase: "idle", // idle | loading | done
    result: null,
  };

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return defaultValue;
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[state] Failed to save to localStorage:', e);
  }
}

// 페이지 로드 시 localStorage에서 복원
const storedState = loadFromStorage(STATE_KEY, null);
let state = storedState 
  ? { ...initialState, ...storedState }
  : { ...initialState };

export function getState() {
  return state;
}

/**
 * ✅ [Phase 3-2A] analysis.scores를 정식 스키마 기준으로 정규화
 * - 슬롯이 없으면 null로 명시
 * - 기존 값은 유지
 */
function normalizeAnalysisScores(scores) {
  const normalized = {};
  
  for (const slot of ANALYSIS_SCORE_SLOTS) {
    if (scores && scores[slot] !== undefined) {
      normalized[slot] = scores[slot];
    } else {
      normalized[slot] = null;
    }
  }
  
  return normalized;
}

export function setState(patch) {
  state = { ...state, ...patch };
  
  // result가 있으면 localStorage에 저장
  if (state.result) {
    // ✅ [Phase 3-1 Commit B] localStorage 저장 직전: URL 구조 점수 승격 (조건부)
    // 조건: state.result.urlStructureV1가 있고 state.analysis.scores.urlStructureV1가 없을 때만
    if (state.result.urlStructureV1 && !state.analysis?.scores?.urlStructureV1) {
      state = promoteUrlStructureScore(state);
    }
    
    const stateToSave = {
      input: state.input,
      phase: state.phase,
      result: state.result,
      updatedAt: Date.now()
    };
    
    // ✅ [Phase 3-2A] analysis.scores를 정식 스키마 기준으로 정규화하여 저장
    stateToSave.analysis = {
      scores: normalizeAnalysisScores(state.analysis?.scores)
    };
    
    saveToStorage(STATE_KEY, stateToSave);
    
    // ✅ [Phase 3-1 Commit B] 디버그 로그 (DEBUG 플래그 조건)
    if (globalThis.DEBUG) {
      const stored = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      const urlScoreExists = !!stored.analysis?.scores?.urlStructureV1;
      console.log('[DEBUG] localStorage 저장 후 analysis.scores.urlStructureV1 존재 여부:', urlScoreExists);
      console.log('[DEBUG] 확인:', !!JSON.parse(localStorage.getItem(STATE_KEY) || '{}').analysis?.scores?.urlStructureV1);
    }
  }
}

/**
 * URL 구조 점수를 analysis.scores.urlStructureV1으로 승격시키는 순수 함수
 * @param {Object} state - 전체 app state
 * @returns {Object} - analysis.scores.urlStructureV1이 세팅된 새 state 객체
 */
export function promoteUrlStructureScore(state) {
  // 우선순위: analysis.result.urlStructureV1 → generate.result.urlStructureV1 → result.urlStructureV1
  let urlScore = null;
  let source = null;

  if (state.analysis?.result?.urlStructureV1) {
    urlScore = state.analysis.result.urlStructureV1;
    source = 'analysis';
  } else if (state.generate?.result?.urlStructureV1) {
    urlScore = state.generate.result.urlStructureV1;
    source = 'generate';
  } else if (state.result?.urlStructureV1) {
    urlScore = state.result.urlStructureV1;
    source = 'result';
  }

  // 새 state 객체 생성
  const newState = { ...state };
  
  // analysis가 없으면 생성
  if (!newState.analysis) {
    newState.analysis = { ...(state.analysis || {}) };
  } else {
    newState.analysis = { ...newState.analysis };
  }
  
  // scores가 없으면 생성
  if (!newState.analysis.scores) {
    newState.analysis.scores = {};
  } else {
    newState.analysis.scores = { ...newState.analysis.scores };
  }

  // 찾은 경우 세팅
  if (urlScore && urlScore.score !== null && urlScore.score !== undefined) {
    newState.analysis.scores.urlStructureV1 = {
      score: urlScore.score,
      grade: urlScore.grade,
      connected: true,
      source: source,
      ts: Date.now()
    };
  } else {
    // 없으면 null로 세팅
    newState.analysis.scores.urlStructureV1 = null;
  }

  return newState;
}
  
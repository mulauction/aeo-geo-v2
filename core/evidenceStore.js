const EVIDENCE_KEY = "__evidenceV1";

export function loadEvidence() {
  try {
    return JSON.parse(localStorage.getItem(EVIDENCE_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveEvidence(data) {
  // 레거시 호환: 단일 객체인 경우 root 구조로 변환
  if (data && !data.history && !data.currentId) {
    const root = {
      currentId: data.meta?.id || Date.now().toString(),
      history: [data]
    };
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(root));
  } else {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(data));
  }
}

export function appendEvidence(entry) {
  const existing = loadEvidence();
  let root;
  
  if (!existing || !existing.history) {
    // 레거시 데이터 또는 빈 상태
    root = {
      currentId: entry.meta?.id || Date.now().toString(),
      history: []
    };
  } else {
    root = { ...existing };
  }
  
  // history에 entry 추가
  root.history = root.history || [];
  root.history.push(entry);
  
  // 최대 10개 유지
  if (root.history.length > 10) {
    root.history = root.history.slice(-10);
  }
  
  // currentId 갱신
  root.currentId = entry.meta?.id || Date.now().toString();
  
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(root));
}

export function getCurrentEvidence(evidenceRoot) {
  if (!evidenceRoot || !evidenceRoot.history || evidenceRoot.history.length === 0) {
    return null;
  }
  
  if (evidenceRoot.currentId) {
    const found = evidenceRoot.history.find(e => e.meta?.id === evidenceRoot.currentId);
    if (found) {
      return found;
    }
  }
  
  // currentId가 없거나 찾지 못한 경우 최신 항목 반환
  return evidenceRoot.history[evidenceRoot.history.length - 1];
}

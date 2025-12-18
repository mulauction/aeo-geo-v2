const EVIDENCE_KEY = "__evidenceV1";

export function loadEvidence() {
  try {
    return JSON.parse(localStorage.getItem(EVIDENCE_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveEvidence(data) {
  localStorage.setItem(EVIDENCE_KEY, JSON.stringify(data));
}

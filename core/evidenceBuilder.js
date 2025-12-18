import { appendEvidence } from "./evidenceStore.js";

export function buildEvidenceFromViewContext(ctx) {
  const entry = {
    meta: {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      source: "phase5-builder-v1"
    },
    items: [
      { type: "summary", text: "임시 더미 텍스트: 요약 정보", weight: 1 },
      { type: "structure", text: "임시 더미 텍스트: 구조 정보", weight: 2 }
    ]
  };
  
  appendEvidence(entry);
  
  return entry;
}


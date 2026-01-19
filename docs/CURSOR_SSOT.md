# CURSOR SSOT (Single Source of Truth)
# Phase 3 ~ Phase 33 기준 헌법

## 목적
이 문서는 본 프로젝트의 최종 판단 기준이다.
Cursor, ChatGPT, 인간 판단이 충돌할 경우 이 문서를 우선한다.

---

## 절대 불변 규칙 (ALL PHASE)
- analysis.scores 스키마 변경 금지
- localStorage (__lastV2, __currentReportId) 구조 변경 금지
- 점수 계산 로직과 UI 렌더 로직 혼합 금지
- Share / Generate / Analyze 간 상태 공유 로직 추가 금지
- 기존 Phase 결과물 리팩터링 금지
- “겸사겸사”, “김에”, “정리 차원” 수정 전면 금지

---

## Phase 고정 기준선
- Phase 3: score schema 동결
- Phase 7: Evidence UI 기준선
- Phase 8: Reliability 정의 고정
- Phase 12: WHY / Action line 구조 고정
- Phase 14: Share Empty UX 기준선
- Phase 19~28: CTA / 상태 분기 안정화
- Phase 33: Telemetry 수집/전송 안정화

위 Phase 결과는 기능 확장 대상이 아니며 참조 전용이다.

---

## 변경 허용 원칙
- UI-only 변경은 허용 (로직 변경 금지)
- 새 파일 추가는 허용 (기존 파일 침범 금지)
- 실험 코드는 scripts/ 또는 docs/ 한정

---

## 커밋 규칙
- 커밋 전 필수:
  - git diff --stat 확인
  - TEST_PROTOCOL 수행
- 사용자가 “커밋완료” 선언 시 해당 상태는 새 기준선이 된다.

---

## 작업 요청 형식
모든 작업 요청은 아래 중 하나로만 진행한다.
- PATCH: 최소 변경 구현
- DIAG: 원인 분석만 수행
- REVIEW: SSOT 위반 여부 검토

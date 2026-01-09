# WHY / Evidence Data Contract (Phase21, Docs-only)

## Purpose
WHY 패널은 "점수와 근거가 왜 그렇게 나왔는지"를 요약해 설명한다.
Phase21에서는 코드가 아니라, WHY 생성 로직의 인터페이스(입력/출력)와 불변 규칙을 문서로 고정한다.

## Non-negotiables (절대 불변)
- 저장 스키마 `__lastV2` 변경 금지.
- Share 렌더 파이프라인 변경 금지.
- Phase21은 문서-only. 코드 변경 금지.
- WHY는 *읽기 전용 계산/표현 레이어*로 취급한다(저장 스키마를 확장하지 않는다).

---

## Terminology
- reportModel: Share 화면에서 리포트를 렌더링할 때 사용하는 상위 모델(복원/정규화된 상태 포함)
- analysis.scores: KPI 점수 슬롯(브랜딩/콘텐츠구조/url구조 등) 및 null-normalization 규칙이 적용된 점수 집합
- evidence summary: 분석 근거의 요약(텍스트/리스트/상태)로, Share에서 표시 가능한 최소 형태

---

## Inputs (WHY builder input)
WHY 생성 함수는 다음 입력만을 사용한다. (새로운 의존성 추가 금지)

### 1) reportModel
- 역할: 화면 상태와 분석 결과(복원된 데이터)를 한 곳에서 제공
- 안정성 규칙: reportModel의 구조가 일부 누락돼도 WHY 생성이 실패하면 안 된다(unknown-safe)

### 2) analysis.scores
- 역할: WHY가 "무엇이 좋고/나쁘고/측정 필요인지"를 판단하는 기준 점수
- 규칙: 점수는 숫자 또는 null(측정 필요)로 정규화되어 있어야 한다.
- 안정성 규칙: 특정 슬롯이 없거나 null이어도 reasons를 생성할 수 있어야 한다.

### 3) evidence summary
- 역할: WHY reasons의 근거 텍스트/키워드/상태를 제공
- 규칙: evidence summary가 비어도 WHY는 "근거 부족" reasons를 출력해야 한다.

---

## Outputs (WHY builder output)
WHY 생성 결과는 다음 형태를 가진다.

### 1) reasons: Array<Reason>
각 reason은 한 줄로 읽히는 설명이어야 하며, UI에서 토글/리스트로 표시 가능해야 한다.

권장 필드:
- id: string (stable key)
- title: string (짧은 요약)
- detail?: string (선택, 1~3문장)
- evidenceRefs?: string[] (선택, 근거 요약 참조)
- severity?: "info" | "warn" | "risk" (선택)

### 2) actionLine: string
- 1줄 개선 액션 문장
- 불확실할 경우에도 "다음에 뭘 하면 되는지"가 드러나야 한다.
- 과장/확정 표현 금지(unknown-safe)

### 3) confidence: "high" | "medium" | "low"
- 목적: reasons/actionLine이 얼마나 데이터에 의해 뒷받침되는지의 "완성도 레벨"
- 원칙(문서 기준):
  - high: scores의 주요 슬롯이 측정되어 있고, evidence summary가 충분
  - medium: 일부 측정/일부 근거
  - low: 다수가 null/근거 부족/측정 필요

---

## Unknown-safe Rules (중요)
- 입력 누락/형태 변화가 있어도 WHY 생성은 예외를 던지지 않는다.
- reasons는 최소 1개 이상을 항상 반환한다(예: "근거가 부족해 추가 측정이 필요합니다").
- confidence가 low일 때 actionLine은 "측정/자료 보강" 중심으로 유도한다.
- 저장 스키마를 확장하지 않는다(WHY 출력은 런타임 계산 결과로 취급).

---

## Compatibility
- Phase21은 문서-only이므로, 현재 Share/Analyze의 동작과 충돌하지 않아야 한다.
- 이후 Phase20-C(스파이크)에서 모델을 바꾸더라도,
  - 입력 3종(reportModel/scores/evidence summary)
  - 출력 3종(reasons/actionLine/confidence)
  이 계약은 유지하는 것을 목표로 한다.


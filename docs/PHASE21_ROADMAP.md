# Phase21 Roadmap (Docs-only)

## Non-negotiables (절대 불변)
- phase20-a3-baseline(Analyze 테스트 통과) 상태를 절대 깨지 않는다.
- 저장 스키마 `__lastV2` 변경 금지.
- Share 렌더 파이프라인 변경 금지.
- Phase21에서는 코드 변경 금지. 문서/계약만 고정한다.
- 변경 파일은 `docs/*` 로만 제한한다.

## Goal
- WHY/evidence 데이터 계약(interfaces) 확정
- 회귀 테스트 케이스 확장(문서 기준)
- 이후 Phase20-C(WHY/evidence 모델 스파이크)는 별도 브랜치에서만 진행 가능하도록 범위 고정

## Deliverables
1) `docs/WHY_DATA_CONTRACT.md` (WHY 입력/출력 계약 + 용어 정의 + 안정성 규칙)
2) `docs/PHASE21_ROADMAP.md` (본 문서)
3) `docs/TEST_CASES_SHARE.md` Phase21 회귀 케이스 3개 추가

## Scope (Phase21에서 하는 일)
- WHY 생성 로직의 입력/출력 인터페이스를 문서화
- evidence summary의 "최소 보장 필드" 정의
- 신뢰도(confidence)의 의미/범위/계산 책임(문서상) 확정
- Share UX 관측 기반 회귀 테스트 케이스를 문서에 추가

## Out of Scope (Phase21에서 절대 하지 않는 일)
- 코드 변경(Share/Analyze/Storage/Scoring 전부)
- `__lastV2` 스키마 수정/확장
- Share 렌더링 플로우 변경
- 점수 로직 변경

## Success Criteria (DoD)
- 변경된 파일이 `docs/*`만이다.
- Phase21 문서 2개가 계약 수준으로 충분히 명확하다(입력/출력/예외/불변 규칙 포함).
- TEST_CASES_SHARE.md에 3개의 Phase21 회귀 케이스가 추가되어 있다.
- 기준선 Analyze 테스트는 기존대로 통과해야 한다(Phase21은 코드 변경이 없으므로 "유지"가 목표).


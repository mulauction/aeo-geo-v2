# Work Contract v1 — AEO/GEO v2

## 목적
- raw telemetry ingest 기준선을 절대 깨지 않으면서
- 해석(interpret) / 집계(aggregate) 레이어를 안전하게 확장한다.

## 작업 지시 필수 항목 (매 작업마다)
- Goal: 1문장
- Phase: 명확한 단계명
- Allowed files: 최대 1~2개
- Change type: Logic-only / UI-only / Test-only / Docs-only
- Required tests: 실행할 터미널 명령

## 절대 보호 기준 (명시적 승인 없이는 변경 금지)
- POST /api/telemetry/ingest 동작 (항상 204)
- raw JSONL append-only 규칙
- raw 경로 규칙
- record 구조 (receivedAt / source / request / payload)

## Cursor 의무 출력
1) 변경 요약 (무엇을, 왜 안전한지)
2) 실제 수정 파일 목록
3) 실행한 테스트 명령 + 결과
4) 실패 시: 원인 + 최소 수정 + 재테스트 결과
## 완료 보고 필수 첨부 (자동 검증)
Cursor는 완료 보고에 반드시 아래 실출력 결과를 포함해야 한다.

- `git diff --stat` 출력
- (telemetry 관련 변경이 포함될 때만) `bash scripts/telemetry-interpret-sample.sh 3 | head -n 1` 실제 출력 1줄

위 출력이 누락되면 작업은 완료로 간주되지 않는다.

## Required Tests Matrix (SSOT)

작업 타입에 따라 “필수 테스트 커맨드”는 아래 매트릭스를 SSOT로 따른다.

1) 작업 타입 (3개)
- UI-only (CSS/Copy/HTML attributes/doc 포함)
- Docs-only
- Logic/API/Storage/Scoring (기능/정책/저장/점수 영향)

2) 타입별 필수 커맨드
- UI-only: `git diff --stat` + `bash scripts/smoke.sh`
- Docs-only: `git diff --stat` + `bash scripts/smoke.sh` (repo dirty 확인 포함)
- Logic/API/Storage/Scoring: `git diff --stat` + `bash scripts/smoke.sh` + (필요 시) telemetry-interpret-sample
  - telemetry 관련 변경이 포함될 때만: `bash scripts/telemetry-interpret-sample.sh 3 | head -n 1`

3) 예외/승인 규칙
- 매트릭스 밖의 커맨드를 추가로 요구하려면, 해당 Phase에서 명시적으로 합의해야 한다.

## Smoke Output Interpretation (SSOT)

1) “repo dirty check (informational)”의 의미
- docs-only / UI-only 변경에서는 정상이며 실패가 아님.
- untracked/modified docs 또는 CSS만 있을 때 허용.

2) 실패로 간주되는 경우
- conflict markers
- policy/guard 실패 라인
- restore/open/telemetry guard 실패 등

3) 완료 보고 규칙
- smoke 통과 기준을 위 해석에 따라 판단.
- 의심 시, 변경 타입(UI-only/Docs-only/Logic)을 보고서 첫 줄에 명시.

## 중단 조건 (즉시 STOP)
- ingest / raw writer 수정 필요
- allowed files 초과
- 테스트 실패 또는 요구사항 모호

## 최소 테스트 게이트
- bash scripts/smoke.sh


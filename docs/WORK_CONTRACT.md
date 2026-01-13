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

## 중단 조건 (즉시 STOP)
- ingest / raw writer 수정 필요
- allowed files 초과
- 테스트 실패 또는 요구사항 모호

## 최소 테스트 게이트
- bash scripts/smoke.sh


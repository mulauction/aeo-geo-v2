# Telemetry(local) — Dev-only diagnostics

## Purpose (dev-only diagnostics)
Telemetry(local)은 Share 화면에서 **로컬 개발 환경에서만** Telemetry 요약(summary)을 확인하기 위한 **진단용(read-only)** UI입니다.

## Gate (debug=1 + devHost)
Telemetry(local)은 아래 조건을 모두 만족할 때만 렌더/요청이 발생합니다.
- `debug=1`: URL query에 `debug=1`이 있을 때
- `devHost`: `localhost` / `127.0.0.1` / `::1` 이거나 port가 `5502`일 때

위 조건이 아니면 **섹션 DOM이 생성되지 않으며**, summary fetch도 수행하지 않습니다.

## States (OK / EMPTY / UNAVAILABLE)
- **OK**: Telemetry 이벤트가 감지되었습니다.
- **EMPTY**: 원본 데이터는 있으나 이벤트가 0건입니다.
- **UNAVAILABLE**: 현재 환경에서는 Telemetry를 확인할 수 없습니다.

## Decision rules (Phase 38-A reference)
배지 상태는 Share UI에서 summary 객체를 파싱한 숫자(`totalEvents`, `exportRecordsSeen`, `linesSeen`, `hasAnyRawRecords`)를 기반으로 결정합니다.
구체 규칙은 Phase 38-A의 “Required decision rules”를 SSOT로 따릅니다.

## Interpretation notes
- **EMPTY ≠ bug**: raw 파일이 존재하더라도 export 이벤트가 없으면 EMPTY가 정상입니다.
- **UNAVAILABLE cases**:
  - debug=1 + devHost 조건이 아니어서 렌더 자체가 안 되는 경우(기본 비노출)
  - devHost이지만 API 서버(3001) 미실행/네트워크 실패/응답 파싱 실패 등으로 summary를 가져오지 못한 경우

## Test checklist (A/B/C/D)
- **A) no debug=1**: `#telemetry-local`이 생성되지 않아야 함
- **B) debug=1 + devHost + server ON + totalEvents>0**: 배지 OK + 콘솔 error 0 + 기본 접힘 유지
- **C) debug=1 + devHost + server ON + EMPTY**: 배지 EMPTY(UNAVAILABLE 금지) + 콘솔 error 0
- **D) debug=1 + devHost + server OFF**: 배지 UNAVAILABLE + 콘솔 error 0

## Non-goals
- Telemetry 수집/저장/점수/리포트 렌더 파이프라인을 변경하지 않습니다.
- prod/외부 환경에서 Telemetry(local)을 노출하지 않습니다.



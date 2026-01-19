# Reliability/WHY vs Telemetry(local) — Boundary

## Purpose
Share 화면에서 **사용자 결과(리포트/WHY/신뢰도 표시)**를 결정하는 로직과, **dev-only 진단용 Telemetry(local)**를 명확히 구분합니다.

## Definitions
- **Reliability / WHY**
  - 사용자에게 보여지는 “왜 이런 결과가 나왔는지(WHY)”와 “신뢰도(Reliability)”를 설명/표현하는 영역
  - Share 렌더 파이프라인/점수/상태 해석에 연결되는 사용자-facing 결과물
- **Telemetry(local)**
  - 로컬 개발 환경에서만 확인 가능한 **dev-only diagnostics UI**
  - raw/summary를 **읽기만(read-only)** 하며, best-effort + fail-quiet 원칙을 따름
  - 사용자 결과를 “설명”하는 참고 자료일 뿐, 결과를 “결정”하지 않음

## What affects user results (yes/no)
- **Reliability/WHY가 사용자 결과에 영향을 주나요?**: **YES**
  - Share 화면의 결과/표시(WHY/신뢰도 포함)는 해당 로직에 의해 결정됩니다.
- **Telemetry(local)가 사용자 결과에 영향을 주나요?**: **NO**
  - Telemetry(local)는 **진단용 표시**이며, Share 결과/점수/저장(localStorage `__lastV2` 포함)/렌더 파이프라인을 변경하지 않습니다.

## Common confusions (FAQ)
- **Q. Telemetry(local) 배지가 EMPTY면 WHY/신뢰도가 잘못된 건가요?**
  - A. 아닙니다. EMPTY는 “원본은 있으나 export 이벤트가 0건”인 상태일 수 있으며, 사용자 결과의 correctness를 직접 의미하지 않습니다.
- **Q. Telemetry(local)가 UNAVAILABLE면 Share 결과가 깨진 건가요?**
  - A. 아닙니다. UNAVAILABLE은 dev 환경/서버 상태/네트워크/파싱 실패 등으로 local summary를 볼 수 없다는 뜻입니다.
- **Q. Telemetry(local)를 켰는데 결과가 달라졌어요. Telemetry가 영향을 준 건가요?**
  - A. 원칙적으로 NO입니다. Telemetry(local)는 debug+dev에서만 표시되며 read-only입니다. 결과가 달라졌다면 다른 로직(입력/환경/리포트 상태)을 점검해야 합니다.
- **Q. Telemetry(local)는 prod에서도 볼 수 있나요?**
  - A. NO. `debug=1 + devHost`에서만 렌더됩니다.

## Non-goals
- Telemetry(local)를 사용자 기능으로 제공하지 않습니다.
- Telemetry(local)로 Reliability/WHY 결과를 대체하거나 자동 수정하지 않습니다.
- Share 결과/점수/스토리지/렌더 파이프라인 변경은 이 문서의 범위가 아닙니다.

## References
- Phase 38-A/38-B: Telemetry(local) 상태 규칙/헬퍼 카피 (SSOT)
- Phase 39 docs: Telemetry(local) dev-only 진단 문서
  - `docs/TELEMETRY_LOCAL_DEV_ONLY.md`



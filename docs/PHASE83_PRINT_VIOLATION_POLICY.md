# Phase 83 — Print Violation Policy (DOCS ONLY)

## Problem statement
Share의 “PDF로 내보내기”는 `setTimeout(..., 0)`로 `window.print()`를 호출하더라도, Chrome DevTools에서 `[Violation] 'setTimeout' handler took ...ms` 같은 경고가 남을 수 있다. 이는 `window.print()`가 브라우저/OS 프린트 다이얼로그를 여는 과정에서 **메인 스레드를 블로킹**할 수 있고, DevTools가 이를 **long-task(긴 작업) 경고**로 표시하기 때문이다.

---

## Classification
- 이 Violation 로그는 **브라우저 long-task 경고**로 분류한다.
- 아래 SSOT 수용 기준을 만족하면 **기능 버그가 아니다**.
- 반대로 SSOT 수용 기준이 실패하면(지연/취소 복귀 지연/레이아웃 불일치) **기능/UX 버그로 분류**한다.

---

## SSOT acceptance criteria (must be explicit)
- Export button opens print dialog within 1s.
- Cancel returns immediately to Share.
- Cmd+P and Export button produce identical page count/layout.
- debug=1 prints exactly these logs:
  - `[print] export button clicked`
  - `[print] window.print invoked`
  - `[print] dialog returned`

---

## Regression checklist (3 lines)
- debug=1에서 Export 클릭 → 위 3개 로그가 **순서/문구 정확히** 출력되는지 확인
- Export vs ⌘P 미리보기의 **페이지 수/레이아웃이 동일**한지 확인
- Cancel 시 **즉시 Share로 복귀**하는지 확인(지연/멈춤/추가 작업 없음)

---

## Future work boundary
- 허용 범위: **UX 안전장치**(예: in-flight guard, 중복 실행 방지) 등 “안전성/체감” 개선
- 금지 범위: “Violation=0”을 **하드 목표로 추적**하지 않는다 (브라우저/DevTools 경고를 0으로 만드는 것 자체가 목표가 아님)
- 불변 규칙: Print CSS/Print SSOT 키워드/Phase77 CTA 정책/telemetry/state/schema는 변경하지 않는다.


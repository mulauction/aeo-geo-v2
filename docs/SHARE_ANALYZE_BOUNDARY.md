# Share ↔ Analyze 경계/정책 (SSOT 고정)

본 문서는 **Share 페이지와 Analyze 페이지의 역할 경계**, 그리고 Share URL 파라미터/상태/Telemetry 노출 정책을 “회귀 테스트 가능한 규칙”으로 고정한다.  
코드 변경 없이, 현재 구현의 의도를 문서로만 명시한다.

---

## 1) 상태/진입 경로 정의

### 1.1 Analyze → Share (navigate)
- **의미**: Analyze에서 생성/열람 중인 리포트를 사용자가 **Share 화면으로 이동**해 확인하는 흐름.
- **특징**:
  - Share는 “최종 렌더 UI” 중심. 점수/저장 스키마는 Analyze와 공유하되, Share에서 새 스키마를 만들지 않는다.
  - Share는 페이지 라이프사이클(pageshow/visibilitychange) 재진입이 있을 수 있어, **중복 실행/중복 렌더에 대한 가드**가 존재한다.

### 1.2 Share direct open (`?r=<id>` 등)
- **의미**: 사용자가 Share URL을 직접 열어 특정 reportId를 요청하는 흐름.
- **특징**:
  - `r`은 숫자형 id만 유효(숫자 외 값은 무효 처리)라는 “파싱 강건화”가 전제된다.
  - r-only 링크 정책(로컬 fallback 억제 등)은 Share의 보안/동작 정책에 의해 제어될 수 있다.

### 1.3 Share restore (`?restore=1`)
- **의미(UX SSOT)**: “이 브라우저(동일 기기)에 저장된 **최근 리포트 목록을 열기**”.
- **특징**:
  - 자동으로 단일 리포트를 열기(open)가 아니라, **목록 모드**가 기본 의미다.
  - restore 플로우에서는 URL 정리(replaceState) 시에도 restore 플래그가 유지될 수 있다(아래 2.2 참조).

### 1.4 Share open (`?restore=1&open=<id>`)
- **의미**: restore 목록에서 사용자가 “열기”를 클릭해 **특정 리포트 1개를 즉시 오픈**하는 흐름.
- **특징**:
  - `open=<id>`는 “사용자 클릭 의도”이므로, URL 정리 단계에서도 보존되어야 한다(아래 2.2 참조).

---

## 1.5 ShareViewState 최종 상태 정의 (의미)

Share는 내부적으로 “최종 상태(final state)”를 확정하여 UI/CTA를 제어한다. 대표 상태와 의미:

- **OK**: 정상적으로 리포트 본문 렌더가 가능한 상태.
- **EXPIRED**: 요청한 리포트가 만료/부재/유효하지 않아 본문을 렌더할 수 없는 상태.
- **OTHER_DEVICE**: 동일 브라우저/기기 정책에 의해 로컬 복원/열람이 제한되는 상태(링크/스토리지 조건 불일치 등).
- **NO_REPORT**: reportId가 없거나, 로컬/URL로부터 유효한 대상 리포트를 얻지 못한 상태.
- **FETCH_FAIL**: 네트워크/로드 실패 등으로 필요한 데이터를 얻지 못한 상태(표시 정책은 “조용히 degrade” 방향).

> 상태는 “설명/카피”를 바꾸기 위한 것이 아니라, **Share UI가 어떤 섹션을 렌더/스킵하는지**를 결정하기 위한 분기 기준이다.

---

## 2) URL 파라미터 SSOT 규칙

### 2.1 `open=<id>` 보존 규칙
- restore 리스트에서 “열기” 클릭 시 생성되는 URL은 **반드시** `restore=1&open=<id>`를 포함해야 한다.
- 사용자 클릭 후에는 URL이 변경되더라도 `open=<id>`가 “사라지면” 안 된다.

### 2.2 replaceState 단계의 restore/open 유지 정책
- Share는 “URL 정리/정규화(replaceState)” 단계를 수행할 수 있다.
- 이 때 정책 SSOT:
  - `restore=1`은 유지될 수 있다(UX 의미: “최근 리포트 목록 모드”).
  - `restore=1`이고 `open=<digits>`가 유효하면 **open은 반드시 유지**한다.
  - `q.delete('open')` 같은 open 제거는 회귀로 간주한다(정적 smoke 가드로 고정됨).

### 2.3 “현재 열람중” SSOT
- restore 리스트에서 “현재 열람중” 표시의 단일 SSOT는 **`reportModel.id` 1개**다.
- 아래 값들은 “로드 후보/저장”에는 쓰일 수 있지만, **UI 표시 판정(현재 열람중 배지/하이라이트)에는 사용하지 않는다**:
  - URL의 `open`
  - `localStorage.__currentReportId`

---

## 3) Telemetry 노출 정책 (Phase 58 기준)

### 3.1 기본 정책: Telemetry 비노출
- 기본(`debug!=1`, `restore=1` 여부 무관)에서는:
  - Telemetry 관련 **DOM 생성/mount/렌더/fetch 호출을 모두 차단**한다.
  - 대신 Share 하단(또는 하단 근처)에 안내 1줄만 표시한다:
    - “실행 로그/텔레메트리는 로그인 환경 또는 디버그 모드에서만 확인할 수 있습니다.”

### 3.2 debug=1에서만 Telemetry 섹션 노출
- `debug=1`이면:
  - ShareViewState가 **OK/EXPIRED/NO_REPORT/OTHER_DEVICE** 등 무엇이든, Telemetry 섹션은 “항상” 보이도록 유지한다.
  - 데이터/메타가 없으면 **UNAVAILABLE/빈 상태**로 표시해 섹션 자체가 사라지지 않게 한다.

### 3.3 debug=1 단독(EXPIRED 등)에서의 fallback
- `share.html?debug=1`로 단독 진입하여 EXPIRED/NO_REPORT 등이 되면,
  - Telemetry 메타가 없어 `renderTelemetrySummaryCard()`가 no-op일 수 있다.
  - 이 경우에도 디버그 섹션이 보이도록, **Share 측에서 UNAVAILABLE fallback UI를 직접 채우는 보정**이 존재한다(로직 삭제 금지).

### 3.4 OK 상태에서의 정상 요약 렌더
- OK 상태에서는(정상 리포트 렌더 경로),
  - Telemetry meta가 존재할 때 정상 요약 렌더가 수행된다.
  - meta가 없으면(또는 원격이 비활성/불가하면) UNAVAILABLE로 degrade될 수 있다.

---

## 4) 회귀 테스트 체크리스트 (브라우저 수동)

다음 케이스를 수동으로 확인한다:

### 4.1 기본 진입/디버그 토글
- `share.html`
  - Telemetry 섹션이 **보이면 실패**
  - 안내 문구 1줄만 보이는지 확인
- `share.html?debug=1`
  - EXPIRED/NO_REPORT 등 상태가 되더라도 Telemetry 섹션이 **UNAVAILABLE 포함해 “보여야 함”**

### 4.2 restore/open 모드
- `share.html?restore=1`
  - 최근 리포트 리스트가 보이는지
  - Telemetry 섹션은 기본적으로 **비노출**
- `share.html?restore=1&debug=1`
  - Telemetry(debug)/Telemetry(local) 섹션이 **1세트만** 유지되는지
  - 탭 전환/복귀(visibilitychange) 후에도 누적/중복 렌더가 없는지

### 4.3 open 파라미터 보존
- `share.html?restore=1&open=<digits>`
  - 리스트 모드가 아니라 **해당 리포트 본문 1개가 열려야 함**(리스트만 보이면 실패)
- restore 리스트에서 다른 항목 “열기” 클릭
  - URL이 반드시 `...restore=1&open=<clickedId>`로 갱신되는지
  - replaceState가 실행되어도 `open`이 사라지지 않는지

### 4.4 “현재 열람중” 1개 규칙
- restore 리스트에서 “현재 열람중” 배지가 **항상 1개만** 보이는지
- 표시 대상이 실제로 로드된 `reportModel.id`와 일치하는지



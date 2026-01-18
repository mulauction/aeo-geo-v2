# A11Y Minimal Manual Checklist (UI-only)

목적: Share/Analyze의 **접근성(UI-only) 회귀**를 수동으로 빠르게 검증한다.  
범위: 키보드(Tab) 접근, `:focus-visible` 포커스 링, 기본 스크린리더 확인(최소).

전제:
- Share/Analyze 모두 **global `:focus-visible` 포커스 링**이 적용되어 있어야 한다.
- icon-only 버튼/링크가 없다는 전제를 둔다(따라서 대부분은 버튼 텍스트 자체가 accessible name).

---

## 0) 실행 절차 (URL + 순서)
1) `share.html`
2) `share.html?debug=1`
3) `analyze.html`

각 단계에서 **Tab/Shift+Tab** 이동으로 포커스 이동을 확인한다.

---

## 1) Share 체크리스트

### 1.1 Tab 순서/포커스 링
- 페이지 진입 후 Tab을 눌렀을 때 포커스가 “예상 가능한 순서”로 이동한다.
- 포커스 링이 **명확하게 보인다**(라이트/다크 배경 모두).
- Shift+Tab으로 역방향 이동도 정상 동작한다.

### 1.2 주요 CTA 접근 (키보드)
- “홈으로 이동” 등 상단 네비게이션 링크에 키보드로 접근 가능.
- Recent Reports 섹션이 있는 경우:
  - “열기” 버튼에 Tab으로 접근 가능.
  - “전체 보기/접기”, “목록 비우기” 버튼에 Tab으로 접근 가능.
- NO_REPORT/EXPIRED 상태에서:
  - “이 브라우저의 최근 리포트 목록 열기” 버튼에 Tab으로 접근 가능.

### 1.3 Telemetry (debug 모드에서만)
대상 URL: `share.html?debug=1`
- Telemetry 섹션이 보이는 경우, 그 안의 링크/버튼/컨트롤에 Tab으로 접근 가능.
- EXPIRED/NO_REPORT 등 상태에서도:
  - Telemetry 섹션이 **UNAVAILABLE** 형태로라도 보여서 “섹션이 사라지지 않음”을 확인.

---

## 2) Analyze 체크리스트

### 2.1 Tab 순서/포커스 링
- Tab 이동 시 포커스 링이 명확하게 보인다.
- 마우스 클릭만으로는 `:focus-visible`이 과도하게 표시되지 않는다(아래 공통 3.1 참조).

### 2.2 입력 폼 및 실행 버튼 접근
- URL 입력/텍스트 입력 필드(`#inputText`)에 Tab으로 접근 가능.
- Analyze 실행 버튼(`#btnAnalyze`)에 Tab으로 접근 가능.
- 추가 버튼(예: 채널 자동 변환 버튼들)이 있다면 Tab으로 접근 가능.

---

## 3) 공통 체크리스트

### 3.1 `:focus-visible` 동작 확인
- 키보드(Tab) 이동 시에만 포커스 링이 표시된다.
- 마우스 클릭만으로는 포커스 링이 “항상 표시되는 것처럼” 과도하게 보이지 않는다.

### 3.2 포커스 트랩/이탈
- 모달이 있는 경우(Analyze/Share):
  - 모달 내부 컨트롤에 Tab으로 접근 가능.
  - ESC/닫기 버튼으로 모달을 닫은 후, 포커스가 자연스럽게 복귀한다(완전 엄격한 포커스 트랩을 요구하진 않음).

---

## 4) 스크린리더 최소 확인 (가능하면)
도구 예: macOS VoiceOver / ChromeVox 등(환경 제약에 맞게 선택)
- 버튼/링크의 텍스트가 정상적으로 읽힌다.
- icon-only 컨트롤은 “없다”는 전제를 확인한다(새로 icon-only 버튼이 추가되면 회귀로 간주).
- “열기”, “Analyze” 등 주요 액션이 스크린리더로 구분 가능하다.



# Share Page A/B/C Test Cases

## Preconditions

1. **Server Running**: Ensure the development server is running on `http://localhost:5502`
   ```bash
   # If using VS Code Live Server or similar, ensure it's running on port 5502
   # Or start the server as per project setup instructions
   ```

2. **Valid Report ID**: Have a valid report ID (`r` parameter) ready for Test A
   - This can be obtained from:
     - A previously created snapshot ID
     - A report ID from `localStorage.__currentReportId`
     - A report ID from a successful share link

---

## Test A: Valid Report ID (`/share.html?r=<valid>`)

### Steps
1. Navigate to: `/share.html?r=<valid-report-id>`
   - Replace `<valid-report-id>` with an actual valid report ID

### Expected Results
- ✅ Page loads without console errors
- ✅ Page is not blank (report content is visible)
- ✅ WHY panel is rendered below Reliability section
- ✅ WHY panel shows:
  - "WHY" header
  - Reason list (if applicable) or "현재 데이터는 충분합니다" (if high reliability)
  - Action line (blue text, separated by border)
- ✅ Action line displays appropriate recommendation based on reliability level
- ✅ No JavaScript errors in browser console
- ✅ No network errors (404, 500, etc.)

### Pass Criteria
- All expected results are met
- WHY block + action line renders correctly
- Page functionality is not broken

---

## Test B: Non-existent Report ID (`/share.html?r=does-not-exist`)

### Steps
1. Navigate to: `/share.html?r=does-not-exist`

### Expected Results
- ✅ Page loads without console errors
- ✅ Page shows fallback/error message (not blank)
- ✅ WHY panel is still rendered (even if report data is missing)
- ✅ WHY panel shows default/fallback content:
  - "WHY" header
  - Reason list or default message
  - Action line (should still render)
- ✅ No JavaScript errors in browser console
- ✅ Graceful error handling (no uncaught exceptions)

### Pass Criteria
- Page handles missing report gracefully
- WHY panel doesn't break rendering
- No console errors
- User sees meaningful feedback (not blank page)

---

## Test C: Cleared localStorage (`/share.html` without `r` parameter)

### Steps
1. Open browser console (F12 or Cmd+Option+I)
2. Execute the following commands:
   ```javascript
   localStorage.removeItem('__lastV2');
   localStorage.removeItem('__currentReportId');
   localStorage.removeItem('aeo_state_v2');
   ```
3. Navigate to: `/share.html` (no `r` parameter)

### Expected Results
- ✅ Page loads without console errors
- ✅ Page shows appropriate fallback message (e.g., "리포트를 불러올 수 없습니다")
- ✅ WHY panel is still rendered (even without report data)
- ✅ WHY panel shows default/fallback content:
  - "WHY" header
  - Default reason message or empty state
  - Action line (should still render)
- ✅ No JavaScript errors in browser console
- ✅ No localStorage access errors

### Pass Criteria
- Page handles missing localStorage gracefully
- WHY panel doesn't break rendering
- No console errors
- User sees meaningful feedback

---

## Common Pass Criteria (All Tests)

For all tests (A, B, C), the following must be true:

1. **No Console Errors**
   - No JavaScript runtime errors
   - No uncaught exceptions
   - No network errors (unless expected, like 404 for Test B)

2. **Page Not Blank**
   - Some content is visible (report, error message, or fallback UI)
   - Page is not completely white/blank

3. **WHY Block Renders**
   - WHY panel container is present in DOM
   - WHY header is visible
   - Reason list or default message is visible
   - Action line is visible (blue text, separated by border)

4. **Action Line Doesn't Break Rendering**
   - Action line text is properly escaped (no HTML injection)
   - Action line doesn't cause layout issues
   - Action line is readable and styled correctly

5. **No Logic Changes**
   - Existing functionality (reliability, scores, etc.) still works
   - No regressions in other features

---

## WHY Copy Guardrails

### WHY Reasons Must Reference Observable Facts

WHY panel reasons must cite observable facts from the report model, not generic messages:

✅ **Valid Examples:**
- "브랜드 근거 0개"
- "브랜드 근거 5개 부족"
- "브랜드 점수 측정 필요"
- "콘텐츠 구조 근거 0개"
- "콘텐츠 구조 점수 측정 필요"
- "URL 미연결"
- "URL 구조 점수 측정 필요"

❌ **Invalid Examples (too generic):**
- "브랜드 근거 부족" (should specify count)
- "측정 필요" (should specify which KPI)
- "데이터 부족" (should cite specific observable fact)

**Observable Facts Sources:**
- Evidence counts: `brandingEvidenceCount`, `contentEvidenceCount`, `totalEvidenceCount`
- Score null flags: `brandingIsNull`, `contentStructureV2IsNull`, `urlStructureV1IsNull`
- URL connection status: `urlConnected`

### Action Line Must Be Executable

Action line must be a verb sentence that targets the top missing signal:

✅ **Valid Examples (executable, specific):**
- "URL 연결을 확인한 뒤 share/analyze 화면을 다시 열어 검증하세요."
- "브랜드명을 입력하고 analyze를 다시 실행하여 측정하세요."
- "브랜드명과 핵심 스펙 1~2줄을 추가한 뒤 analyze를 다시 실행하세요."
- "비교표나 FAQ 스니펫을 추가하여 신뢰도를 높이세요."

❌ **Invalid Examples (not executable or too vague):**
- "브랜드를 개선하세요" (too vague, no specific action)
- "데이터를 추가하세요" (which data? how?)
- "측정하세요" (where? how?)

**Action Line Priority:**
1. **URL connection** (if `urlConnected === false`)
2. **Missing inputs** (if any KPI score is null)
3. **Missing evidence** (if evidence count is 0)
4. **Next improvement** (comparison/FAQ snippet)

**Format Requirements:**
- Exactly one line of text
- Starts with "추천: " prefix
- Contains executable verb (입력하세요, 실행하세요, 추가하세요, 확인하세요)
- Targets the top missing signal (highest priority blocking item)

---

## Quick Test Checklist

- [ ] Test A: Valid report ID loads correctly
- [ ] Test A: WHY panel renders with reasons/action line
- [ ] Test B: Non-existent ID shows fallback gracefully
- [ ] Test B: WHY panel still renders
- [ ] Test C: Cleared localStorage shows fallback
- [ ] Test C: WHY panel still renders
- [ ] All tests: No console errors
- [ ] All tests: Page not blank
- [ ] All tests: Action line visible and styled correctly

---

## ✅ [Phase 14-0] Reliability Definition & Copy Standardization Tests

### Test A: 정상 리포트일 때 신뢰도 라벨/한줄 안내/토글 reasons가 일관됨

**Steps:**
1. Navigate to: `/share.html?r=<valid-report-id>` (정상 리포트 ID 사용)

**Expected Results:**
- ✅ 신뢰도 배지 라벨이 정확히 표시됨 (높음/보통/낮음/측정 필요 중 하나)
- ✅ 신뢰도 배지 옆 한 줄 안내 문구가 표시됨 (해당 시)
- ✅ "자세히" 버튼 클릭 시 reasons가 표시됨
- ✅ reasons 출력 순서가 고정됨: BRAND → CONTENT → URL 순서
- ✅ reasons 문구가 표준화됨: "BRAND 측정됨" / "BRAND 미측정" 형식
- ✅ 한 줄 안내 문구와 WHY 패널/Action line이 충돌하지 않음

**Pass Criteria:**
- 신뢰도 라벨, 한 줄 안내, 토글 reasons가 모두 일관되게 표시됨
- reasons 순서가 brand → content → url로 고정됨
- 문구가 표준화되어 있음

---

### Test B: does-not-exist일 때 "리포트 없음" 이유가 명확하고 측정 필요와 구분됨

**Steps:**
1. Navigate to: `/share.html?r=does-not-exist`

**Expected Results:**
- ✅ 신뢰도 배지 라벨이 "측정 필요"로 표시됨
- ✅ "자세히" 버튼 클릭 시 reasons에 "리포트 없음 · 리포트를 불러올 수 없습니다" 표시됨
- ✅ 한 줄 안내 문구에 "리포트를 불러올 수 없습니다" 문구 포함됨
- ✅ "측정 필요" 케이스와 명확히 구분됨 (리포트 없음 vs 모든 항목 미측정)

**Pass Criteria:**
- 리포트 없음 케이스가 "측정 필요"와 혼동되지 않게 분리 문구로 표시됨
- reasons에 "리포트 없음" 키워드가 포함됨

---

### Test C: localStorage cleared일 때도 동일

**Steps:**
1. Open browser console (F12 or Cmd+Option+I)
2. Execute:
   ```javascript
   localStorage.removeItem('__lastV2');
   localStorage.removeItem('__currentReportId');
   localStorage.removeItem('aeo_state_v2');
   ```
3. Navigate to: `/share.html` (no `r` parameter)

**Expected Results:**
- ✅ 신뢰도 배지 라벨이 "측정 필요"로 표시됨
- ✅ "자세히" 버튼 클릭 시 reasons에 "리포트 없음 · 리포트를 불러올 수 없습니다" 표시됨
- ✅ 한 줄 안내 문구에 "리포트를 불러올 수 없습니다" 문구 포함됨
- ✅ Test B와 동일한 동작 (리포트 없음 케이스 처리)

**Pass Criteria:**
- localStorage cleared 상태에서도 Test B와 동일하게 리포트 없음 케이스가 처리됨
- reasons 출력 순서와 문구가 표준화되어 있음

---

---

## ✅ [Phase 14-1] Share Empty UX Baseline Checkpoint

**기준 문서**: `docs/PHASE14_1_SHARE_EMPTY_UX_BASELINE.md`

### 통과 조건 (5개)

1. **NO_REPORT → 노란 상태 배너 정상 노출 (로그인 화면 X)**
   - viewState가 'NO_REPORT'일 때 노란색 상태 패널이 정상적으로 표시됨
   - 로그인 화면으로 리다이렉트되지 않음

2. **OTHER_DEVICE → 노란 상태 배너 + 최신 리포트/홈 버튼 정상**
   - viewState가 'OTHER_DEVICE'일 때 노란색 상태 패널이 표시됨
   - "최신 리포트 보기" 및 "홈으로" 버튼이 정상적으로 동작함

3. **정상 r 값 → OK 상태로 리포트 렌더링**
   - 유효한 r 파라미터가 있을 때 viewState가 'OK'로 설정됨
   - 리포트가 정상적으로 렌더링됨

4. **next-actions 블록 완전 제거됨**
   - share.html에서 next-actions 관련 코드가 완전히 제거됨
   - extractReasonKeys, buildNextActionsFromReasonKeys 등 actionMap 관련 의존성 없음

5. **콘솔 에러 없음**
   - 브라우저 콘솔에 JavaScript 에러가 없음
   - 모든 참조가 정상적으로 해결됨

### 절대 금지 규칙

- share.html의 viewState 분기(NO_REPORT/OTHER_DEVICE/OK) 흐름 변경 금지
- next-actions 블록 재도입 금지
- localStorage 스키마/복원 파이프라인(__lastV2, reportModel 등) 변경 금지
- UI-only 변경만 허용, 로직/저장/스키마 변경 금지

---

## Notes

- These tests focus on **UI rendering** and **error handling**, not on data correctness
- The WHY panel should be resilient to missing or invalid data
- Action line should always render, even if reasons are empty
- All tests should pass without modifying core logic files


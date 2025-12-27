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

## Notes

- These tests focus on **UI rendering** and **error handling**, not on data correctness
- The WHY panel should be resilient to missing or invalid data
- Action line should always render, even if reasons are empty
- All tests should pass without modifying core logic files


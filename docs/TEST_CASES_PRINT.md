...
# Print/PDF Smoke Checklist (Share)

## 목적
- OK는 멀티페이지 유지
- Non-OK는 1페이지 SSOT 유지
- afterprint 이후 html.is-printing 잔존 금지
- Phase74 SSOT 키워드/가드 유지

## 환경
- Chrome 최신
- Safari 최신(가능하면)

---

## A. Non-OK (1페이지 SSOT)
각 케이스에서 공통 확인:
- "PDF로 내보내기" 클릭 → 미리보기 1페이지
- ⌘P → 미리보기 1페이지
- 인쇄 종료 후 화면에서 html.is-printing 제거(개발자도구 Elements로 확인)

### A1 NO_REPORT
- URL: /share.html (리포트 없는 브라우저)

### A2 OTHER_DEVICE
- URL: /share.html?r=<다른 기기에서 만든 reportId>

### A3 EXPIRED
- URL: /share.html?r=<expired 상태 유도 링크>

### A4 FETCH_FAIL
- 네트워크 끊기/서버 중지 후 share 진입

### A5 INVALID_ID
- URL: /share.html?r=abc (숫자 아닌 r)

---

## B. OK (멀티페이지 유지)
공통 확인:
- PDF 버튼 → 멀티페이지 유지
- ⌘P → 미리보기 멀티페이지 유지

### B1 OK 리포트
- Analyze → Share로 정상 리포트 생성 후 Share 진입

---

## C. 회귀 방지
- bash scripts/smoke.sh에서
  - print ssot keywords guard: OK 출력 확인
---

## D. 테스트 결과

### Chrome
- A1 NO_REPORT: 1p ✅
- A2 OTHER_DEVICE(EXPIRED): 1p ✅
- A5 INVALID_ID: 1p ✅
- B1 OK: multi-page ✅

## Phase 77-2 — Non-OK Print/PDF Details Closed Verification

- 대상: Non-OK 상태 (NO_REPORT, INVALID_ID, FETCH_FAIL, EXPIRED, OTHER_DEVICE)
- 조건: Print/PDF 미리보기 진입 시 `<details>`는 기본 closed 상태여야 함
- 확인 항목:
  - PDF로 내보내기 → `<details>` 닫힘 유지
  - ⌘P → `<details>` 닫힘 유지
  - 페이지 전환/재렌더 후에도 자동 open 없음
- 제외:
  - CTA 개수/순서/문구 변경 없음
  - 상태 판정 로직 변경 없음

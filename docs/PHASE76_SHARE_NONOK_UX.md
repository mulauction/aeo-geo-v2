# Phase 76 — Share Non-OK UX 확정

## 목적
Share 화면에서 **Non-OK 상태 전용 안내 UX**를 명확히 정의하고,
OK 리포트 UX와의 **완전 분리**를 고정한다.

---

## Non-OK 상태 정의
다음 상태에서는 **노란 안내박스(Notice Box)**를 노출한다.

- NO_REPORT
- OTHER_DEVICE
- EXPIRED
- FETCH_FAIL
- INVALID_ID

### 공통 UX
- 상단 노란 안내박스 노출
- 리포트 본문은 읽기 불가
- 행동 유도 버튼 제공

---

## 상태별 URL 예시
- NO_REPORT: `/share.html`
- OTHER_DEVICE / EXPIRED: `/share.html?r=<없는 reportId>` / `/share.html?r=1700000000000`
- INVALID_ID: `/share.html?r=abc`

---

## 안내박스 구성 요소
- 제목: 이 링크로는 리포트를 열 수 없습니다
- 설명: 현재 브라우저에 연결된 리포트 데이터가 없습니다
- 버튼:
  - 이 브라우저의 최근 리포트 목록 열기
  - 다시 분석하러 가기
- 보조 링크: 더 알아보기

> 본 UX는 **오류가 아닌 정상 상태 안내**로 간주한다.

---

## OK 리포트 UX (대조)
다음 조건에서는 **안내박스를 절대 노출하지 않는다**.

- Analyze → Share 정상 플로우
- URL 예시: `/share.html?id=<snapshotId>&r=<reportId>`

### OK UX 특징
- 파란 정보 박스: “이 리포트는 읽기 전용 공유 리포트입니다”
- 리포트 본문 정상 표시
- 최근 리포트 목록 + 열기 버튼 제공

---

## 인쇄/출력 정책 연계
- Non-OK: Print/PDF **1페이지 SSOT**
- OK: Print/PDF **멀티페이지 유지**
- Phase 74 규칙과 완전 호환

---

## 변경 금지
- 본 문서 이후 Share Non-OK UX는 **기획 변경 없이 유지**
- UI/문구 변경 시 별도 Phase로 진행


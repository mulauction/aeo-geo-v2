# Phase 14-1 Share Empty UX Baseline

## 목적

Share 화면의 empty/edge 상태 기준선 고정

## 기준 브랜치/커밋

- **브랜치**: `feat/phase14-1-share-empty-ux`
- **커밋**: `fix(share): stabilize viewState handling (NO_REPORT/OTHER_DEVICE) and remove next-actions block`

## 통과 조건

1. NO_REPORT → 노란 상태 배너 정상 노출 (로그인 화면 X)
2. OTHER_DEVICE → 노란 상태 배너 + 최신 리포트/홈 버튼 정상
3. 정상 r 값 → OK 상태로 리포트 렌더링
4. next-actions 블록 완전 제거
5. 콘솔 에러 없음

## Do Not Touch (절대 금지)

- share.html의 viewState 분기(NO_REPORT / OTHER_DEVICE / OK) 변경 금지
- next-actions 블록 재도입 금지
- localStorage 스키마 및 복원 파이프라인(__lastV2, reportModel) 변경 금지
- UI-only 변경만 허용, 로직/저장/스키마 변경 금지

## 회귀 체크

- `scripts/share-smoke.sh`
- 콘솔 에러 0 확인
